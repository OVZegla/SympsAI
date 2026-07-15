import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDropboxConfig,
  listDropboxFiles,
  downloadDropboxFile,
  type DropboxConfig,
} from "./client";
import { planSync, mimeForFilename, titleFromFilename, type RemoteFile } from "./plan";
import { extractText } from "@/lib/knowledge/extract";
import { ingestDocumentVersion } from "@/lib/knowledge/ingestion";
import { recordAudit } from "@/lib/audit";
import type { Profile } from "@/lib/types/database";

/**
 * Synchronisation du cloud Dropbox vers la bibliothèque Documents (spec §27,
 * §30) : l'app fouille le dossier configuré via l'API, importe les nouveaux
 * fichiers et crée une nouvelle version quand un fichier a changé. Le pipeline
 * réutilisé est exactement celui de l'upload manuel : Storage (original
 * conservé) → extraction (texte/PDF) → chunking → embeddings.
 */

export interface SyncReport {
  created: number;
  updated: number;
  unchanged: number;
  /** Vidéos et formats non importables (comportement voulu, pas une erreur). */
  ignored: string[];
  /** Fichiers > 50 Mo, non importés automatiquement. */
  tooLarge: string[];
  errors: string[];
}

interface ExistingRow {
  id: string;
  source_path: string;
  source_rev: string | null;
}

async function importFile(
  supabase: SupabaseClient,
  profile: Profile,
  config: DropboxConfig,
  file: RemoteFile,
  existingDocumentId: string | null,
): Promise<void> {
  const mime = mimeForFilename(file.name) ?? "application/octet-stream";
  const blob = await downloadDropboxFile(config, file.pathLower);

  let documentId = existingDocumentId;
  let versionNumber = 1;

  if (!documentId) {
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        organization_id: profile.organization_id,
        title: titleFromFilename(file.name),
        document_type: "other",
        status: "draft",
        language: "fr",
        created_by: profile.id,
        source: "dropbox",
        source_path: file.pathLower,
        source_rev: file.rev,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !doc) throw new Error(error?.message || "insert document failed");
    documentId = doc.id;
  } else {
    const { data: last } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("document_id", documentId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle<{ version_number: number }>();
    versionNumber = (last?.version_number ?? 0) + 1;
  }

  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .insert({ document_id: documentId, version_number: versionNumber })
    .select("id")
    .single<{ id: string }>();
  if (versionError || !version) {
    throw new Error(versionError?.message || "insert version failed");
  }

  const storagePath = `${profile.organization_id}/${documentId}/${versionNumber}/${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, blob, { upsert: true, contentType: mime });
  if (uploadError) throw new Error(`storage: ${uploadError.message}`);

  await supabase
    .from("document_versions")
    .update({ storage_path: storagePath, mime_type: mime, file_size: blob.size })
    .eq("id", version.id);

  const { text } = await extractText(blob, mime);
  if (text) {
    try {
      await ingestDocumentVersion(supabase, { documentVersionId: version.id, text });
    } catch (err) {
      // Best-effort : le document reste en draft, ré-ingérable plus tard.
      console.error("[dropbox] ingestion failed:", (err as Error).message);
    }
  }

  await supabase
    .from("documents")
    .update({ current_version_id: version.id, source_rev: file.rev })
    .eq("id", documentId);
}

export async function syncDropboxDocuments(
  supabase: SupabaseClient,
  profile: Profile,
): Promise<SyncReport> {
  const config = getDropboxConfig();
  if (!config) {
    throw new Error(
      "Dropbox n'est pas lié. Lance `npm run dropbox:link` puis redémarre l'app.",
    );
  }

  const files = await listDropboxFiles(config);

  const { data: existingRows } = await supabase
    .from("documents")
    .select("id, source_path, source_rev")
    .eq("source", "dropbox")
    .not("source_path", "is", null)
    .returns<ExistingRow[]>();

  const plan = planSync(
    files,
    (existingRows ?? []).map((d) => ({
      documentId: d.id,
      sourcePath: d.source_path,
      sourceRev: d.source_rev,
    })),
  );

  const report: SyncReport = {
    created: 0,
    updated: 0,
    unchanged: plan.unchanged,
    ignored: plan.ignored,
    tooLarge: plan.tooLarge,
    errors: [],
  };

  for (const file of plan.toCreate) {
    try {
      await importFile(supabase, profile, config, file, null);
      report.created += 1;
    } catch (err) {
      report.errors.push(`${file.name} : ${(err as Error).message}`);
    }
  }
  for (const { file, documentId } of plan.toUpdate) {
    try {
      await importFile(supabase, profile, config, file, documentId);
      report.updated += 1;
    } catch (err) {
      report.errors.push(`${file.name} : ${(err as Error).message}`);
    }
  }

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "document.dropbox_sync",
    entityType: "documents",
    after: {
      created: report.created,
      updated: report.updated,
      unchanged: report.unchanged,
      ignored: report.ignored.length,
      tooLarge: report.tooLarge.length,
      errors: report.errors,
    },
  });

  return report;
}

export function isDropboxLinked(): boolean {
  return getDropboxConfig() !== null;
}
