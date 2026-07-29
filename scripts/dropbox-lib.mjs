/**
 * Helpers partagés par les scripts Dropbox (liaison + choix du dossier).
 * Node pur, aucune dépendance : appels directs à l'API Dropbox v2.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

export const ENV_PATH = path.join(ROOT, ".env.local");

export function readEnvLocal() {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
}

export function getEnvValue(content, key) {
  const m = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

export function setEnv(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return content.trimEnd() + `\n${line}\n`;
}

export function writeEnvLocal(content) {
  writeFileSync(ENV_PATH, content);
}

/** Échange le refresh token contre un access token court. */
export async function accessTokenFromRefresh(appKey, appSecret, refreshToken) {
  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });
  if (!res.ok) throw new Error(`Dropbox a refusé la liaison (${res.status}) : ${await res.text()}`);
  const json = await res.json();
  if (!json.access_token) throw new Error("Réponse Dropbox invalide (pas de token).");
  return json.access_token;
}

/** Dossiers directement sous `parent` ("" = racine visible du compte/app). */
export async function listFolders(token, parent = "") {
  const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, recursive: false, limit: 200 }),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.entries
    .filter((e) => e[".tag"] === "folder")
    .map((e) => e.path_display ?? `/${e.name}`);
}

/**
 * Fait CHOISIR le dossier dans une liste numérotée plutôt que de le faire
 * taper : c'est la source d'erreur n°1 (chemin inexistant, commande collée
 * par mégarde). La saisie libre reste possible mais est validée.
 */
export async function pickFolder(rl, token) {
  const folders = await listFolders(token);

  if (folders.length === 0) {
    console.log(
      "\nAucun dossier visible à la racine. La synchro portera sur tout ce que l'app peut voir.",
    );
    return "";
  }

  console.log("\nDossiers trouvés dans ton Dropbox :\n");
  folders.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log(`  0. Tout le Dropbox (aucun filtre)\n`);

  for (;;) {
    const answer = (
      await rl.question("Numéro du dossier à fouiller (ou chemin exact) : ")
    ).trim();

    if (answer === "0") return "";
    if (answer === "") {
      console.log("→ Choisis un numéro dans la liste (ou 0 pour tout le Dropbox).");
      continue;
    }

    const index = Number(answer);
    if (Number.isInteger(index) && index >= 1 && index <= folders.length) {
      return folders[index - 1];
    }

    // Saisie libre : on vérifie l'existence AVANT d'enregistrer.
    if (answer.startsWith("/")) {
      const exists = await folderExists(token, answer);
      if (exists) return answer;
      console.log(`→ « ${answer} » n'existe pas dans ce Dropbox. Réessaie.`);
      continue;
    }

    console.log("→ Réponse non comprise : donne un numéro de la liste, ou un chemin commençant par /.");
  }
}

async function folderExists(token, folderPath) {
  const res = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: folderPath }),
  });
  if (!res.ok) return false;
  const json = await res.json();
  return json[".tag"] === "folder";
}
