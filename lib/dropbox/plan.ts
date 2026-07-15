/**
 * Planification pure de la synchronisation Dropbox → Documents (testée sans
 * réseau) : quels fichiers importer, lesquels re-versionner, lesquels ignorer.
 * Règle : un fichier n'est réimporté que si sa révision Dropbox a changé, et
 * un changement crée une NOUVELLE version (jamais d'écrasement, spec §30).
 */

export interface RemoteFile {
  name: string;
  pathDisplay: string;
  pathLower: string;
  rev: string;
}

export interface ExistingDropboxDoc {
  documentId: string;
  sourcePath: string;
  sourceRev: string | null;
}

export interface SyncPlan {
  toCreate: RemoteFile[];
  toUpdate: { file: RemoteFile; documentId: string }[];
  unchanged: number;
  /** Fichiers ignorés (format non pris en charge), pour l'afficher à l'utilisateur. */
  ignored: string[];
}

/** Formats importables : texte + PDF (extraction locale via unpdf). */
const SUPPORTED: Record<string, string> = {
  ".pdf": "application/pdf",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".text": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
};

export function mimeForFilename(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  return SUPPORTED[name.slice(dot).toLowerCase()] ?? null;
}

/** "manuel-demarrage_M1 v2.pdf" → "manuel demarrage M1 v2". */
export function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || name;
}

export function planSync(
  files: RemoteFile[],
  existing: ExistingDropboxDoc[],
): SyncPlan {
  const byPath = new Map(existing.map((d) => [d.sourcePath.toLowerCase(), d]));
  const plan: SyncPlan = { toCreate: [], toUpdate: [], unchanged: 0, ignored: [] };

  for (const file of files) {
    if (!mimeForFilename(file.name)) {
      plan.ignored.push(file.name);
      continue;
    }
    const known = byPath.get(file.pathLower);
    if (!known) {
      plan.toCreate.push(file);
    } else if (known.sourceRev !== file.rev) {
      plan.toUpdate.push({ file, documentId: known.documentId });
    } else {
      plan.unchanged += 1;
    }
  }
  return plan;
}
