import "server-only";

/**
 * Client Dropbox minimal (API v2, fetch natif — pas de SDK). Le compte est lié
 * une fois via `npm run dropbox:link` qui stocke un REFRESH token dans
 * .env.local ; ici on l'échange contre des access tokens courts à la demande.
 * Secrets côté serveur uniquement — le navigateur ne voit jamais Dropbox.
 */

export interface DropboxConfig {
  appKey: string;
  appSecret: string;
  refreshToken: string;
  /** Dossier Dropbox à fouiller, ex. "/Symps/Documentations" ("" = racine). */
  folder: string;
}

export function getDropboxConfig(
  env: Record<string, string | undefined> = process.env,
): DropboxConfig | null {
  const appKey = env.DROPBOX_APP_KEY;
  const appSecret = env.DROPBOX_APP_SECRET;
  const refreshToken = env.DROPBOX_REFRESH_TOKEN;
  if (!appKey || !appSecret || !refreshToken) return null;
  let folder = (env.DROPBOX_FOLDER ?? "").trim().replace(/\/+$/, "");
  if (folder && !folder.startsWith("/")) folder = `/${folder}`;
  return { appKey, appSecret, refreshToken, folder };
}

export class DropboxError extends Error {
  constructor(
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "DropboxError";
  }
}

export interface DropboxFile {
  name: string;
  /** Chemin lisible, ex. "/Symps/Documentations/manuel-m1.pdf". */
  pathDisplay: string;
  /** Chemin technique pour download. */
  pathLower: string;
  /** Révision Dropbox — change à chaque modification du fichier. */
  rev: string;
  size: number;
  serverModified: string;
}

interface ListFolderEntry {
  ".tag": "file" | "folder" | "deleted";
  name: string;
  path_display?: string;
  path_lower?: string;
  rev?: string;
  size?: number;
  server_modified?: string;
}

interface ListFolderResponse {
  entries: ListFolderEntry[];
  cursor: string;
  has_more: boolean;
}

async function getAccessToken(config: DropboxConfig): Promise<string> {
  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
      client_id: config.appKey,
      client_secret: config.appSecret,
    }),
  }).catch((err) => {
    throw new DropboxError("Dropbox est injoignable (réseau).", (err as Error).message);
  });
  if (!res.ok) {
    throw new DropboxError(
      "La liaison Dropbox a été refusée — relance `npm run dropbox:link`.",
      await res.text(),
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new DropboxError("Réponse Dropbox invalide (pas de token).");
  return json.access_token;
}

async function rpc<T>(token: string, endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    // 409 = erreur métier Dropbox (ex. path/not_found) : la traduire clairement
    // au lieu d'un code HTTP opaque.
    if (res.status === 409 && detail.includes("not_found")) {
      throw new DropboxError("DROPBOX_PATH_NOT_FOUND", detail);
    }
    throw new DropboxError(`Dropbox ${endpoint} a échoué (HTTP ${res.status}).`, detail);
  }
  return (await res.json()) as T;
}

/** Dossiers à la racine visible du compte/app (pour guider la configuration). */
async function listRootFolders(token: string): Promise<string[]> {
  try {
    const page = await rpc<ListFolderResponse>(token, "files/list_folder", {
      path: "",
      recursive: false,
      limit: 100,
    });
    return page.entries
      .filter((e) => e[".tag"] === "folder")
      .map((e) => e.path_display ?? e.name)
      .slice(0, 15);
  } catch {
    return [];
  }
}

/** Liste récursivement les FICHIERS du dossier configuré. */
export async function listDropboxFiles(config: DropboxConfig): Promise<DropboxFile[]> {
  const token = await getAccessToken(config);
  const files: DropboxFile[] = [];

  let page: ListFolderResponse;
  try {
    page = await rpc<ListFolderResponse>(token, "files/list_folder", {
      path: config.folder,
      recursive: true,
      include_deleted: false,
      limit: 500,
    });
  } catch (err) {
    if (err instanceof DropboxError && err.message === "DROPBOX_PATH_NOT_FOUND") {
      // Dossier introuvable : montrer ce qui existe vraiment pour corriger la
      // config sans deviner (app « App folder » vs « Full Dropbox », faute de
      // frappe…).
      const roots = await listRootFolders(token);
      throw new DropboxError(
        `Le dossier « ${config.folder || "/"} » n'existe pas dans ce Dropbox. ` +
          (roots.length > 0
            ? `Dossiers disponibles : ${roots.join(", ")}. `
            : "Aucun dossier visible à la racine (app de type « App folder » ? Les chemins partent alors de son dossier dédié). ") +
          "Pour corriger : dans le Terminal, lance `npm run dropbox:folder` " +
          "(il te fait choisir le dossier dans une liste), puis redémarre l'app.",
        err.detail,
      );
    }
    throw err;
  }
  for (;;) {
    for (const e of page.entries) {
      if (e[".tag"] === "file" && e.path_lower && e.rev) {
        files.push({
          name: e.name,
          pathDisplay: e.path_display ?? e.path_lower,
          pathLower: e.path_lower,
          rev: e.rev,
          size: e.size ?? 0,
          serverModified: e.server_modified ?? "",
        });
      }
    }
    if (!page.has_more) break;
    page = await rpc<ListFolderResponse>(token, "files/list_folder/continue", {
      cursor: page.cursor,
    });
  }
  return files;
}

/** Télécharge un fichier Dropbox. */
export async function downloadDropboxFile(
  config: DropboxConfig,
  pathLower: string,
): Promise<Blob> {
  const token = await getAccessToken(config);
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: pathLower }),
    },
  });
  if (!res.ok) {
    throw new DropboxError(
      `Téléchargement Dropbox impossible pour ${pathLower} (HTTP ${res.status}).`,
      await res.text(),
    );
  }
  return await res.blob();
}
