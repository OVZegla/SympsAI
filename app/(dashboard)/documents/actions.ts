"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { extractText } from "@/lib/knowledge/extract";
import { ingestDocumentVersion } from "@/lib/knowledge/ingestion";
import { syncDropboxDocuments } from "@/lib/dropbox/sync";
import { recordAudit } from "@/lib/audit";
import type { DocumentType } from "@/lib/types/database";

/**
 * Synchronise le dossier Dropbox lié vers la bibliothèque (import cloud) :
 * nouveaux fichiers importés, fichiers modifiés re-versionnés, le reste
 * inchangé. Le résumé revient via l'URL pour être affiché en bannière.
 */
export async function syncDropbox() {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Insufficient permissions.");

  const supabase = createClient();
  let summary: string;
  try {
    const report = await syncDropboxDocuments(supabase, profile);
    summary =
      `✅ ${report.created} importé(s), ${report.updated} mis à jour, ` +
      `${report.unchanged} inchangé(s)` +
      (report.ignored.length > 0 ? `, ${report.ignored.length} ignoré(s) (format)` : "") +
      (report.errors.length > 0 ? ` — ⚠️ erreurs : ${report.errors.join(" · ")}` : "");
  } catch (err) {
    summary = `❌ ${(err as Error).message}`;
  }

  revalidatePath("/documents");
  redirect(`/documents?sync=${encodeURIComponent(summary.slice(0, 500))}`);
}

const DOCUMENT_TYPES: DocumentType[] = [
  "procedure",
  "manual",
  "technical_note",
  "configuration",
  "training",
  "troubleshooting",
  "other",
];

/**
 * Upload + process a document (spec §27, §28). Creates the document and its
 * first version, stores the original file, extracts text, chunks and embeds it.
 * Documents start as `draft`; publishing to `approved` is a separate, audited
 * step (spec §10 — approved procedures have the highest authority).
 */
export async function uploadDocument(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Insufficient permissions.");

  const supabase = createClient();

  const title = String(formData.get("title") || "").trim();
  const code = String(formData.get("document_code") || "").trim() || null;
  const typeRaw = String(formData.get("document_type") || "other");
  const documentType: DocumentType = DOCUMENT_TYPES.includes(typeRaw as DocumentType)
    ? (typeRaw as DocumentType)
    : "other";
  const machineModelId = String(formData.get("machine_model_id") || "").trim() || null;
  const componentId = String(formData.get("component_id") || "").trim() || null;
  const language = String(formData.get("language") || "fr").trim() || "fr";
  const file = formData.get("file");
  // Optional pasted text, used when the file format isn't auto-extractable.
  const pastedText = String(formData.get("text") || "").trim();

  if (!title) throw new Error("A document title is required.");

  // 1. Create the document (draft).
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      organization_id: profile.organization_id,
      document_code: code,
      title,
      document_type: documentType,
      status: "draft",
      machine_model_id: machineModelId,
      component_id: componentId,
      language,
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (docError || !doc) throw new Error(docError?.message || "Failed to create document.");

  // 2. Create version 1.
  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .insert({ document_id: doc.id, version_number: 1 })
    .select("id")
    .single<{ id: string }>();
  if (versionError || !version) {
    throw new Error(versionError?.message || "Failed to create document version.");
  }

  // 3. Store the original file (spec §30: always keep the original).
  let text = pastedText;
  if (file instanceof File && file.size > 0) {
    const path = `${profile.organization_id}/${doc.id}/1/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    await supabase
      .from("document_versions")
      .update({ storage_path: path, mime_type: file.type, file_size: file.size })
      .eq("id", version.id);

    if (!text) {
      const extracted = await extractText(file, file.type);
      text = extracted.text;
    }
  }

  // 4. Chunk + embed (best-effort: a failure here leaves a draft to re-process).
  let chunkCount = 0;
  if (text) {
    try {
      const result = await ingestDocumentVersion(supabase, {
        documentVersionId: version.id,
        text,
      });
      chunkCount = result.chunkCount;
    } catch (err) {
      console.error("[documents] ingestion failed:", (err as Error).message);
    }
  }

  // 5. Point the document at its current version.
  await supabase
    .from("documents")
    .update({ current_version_id: version.id })
    .eq("id", doc.id);

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "document.upload",
    entityType: "document",
    entityId: doc.id,
    after: { title, code, chunkCount },
  });

  revalidatePath("/documents");
}

/**
 * Publish a document: draft/review → approved (spec §10, §27). Approved
 * procedures carry the highest authority, so this is an audited admin/technician
 * action.
 */
export async function publishDocument(documentId: string) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Insufficient permissions.");

  const supabase = createClient();

  const { data: before } = await supabase
    .from("documents")
    .select("status")
    .eq("id", documentId)
    .single<{ status: string }>();

  const { error } = await supabase
    .from("documents")
    .update({ status: "approved" })
    .eq("id", documentId);
  if (error) throw new Error(error.message);

  // Stamp approval on the current version too.
  const { data: doc } = await supabase
    .from("documents")
    .select("current_version_id")
    .eq("id", documentId)
    .single<{ current_version_id: string | null }>();
  if (doc?.current_version_id) {
    await supabase
      .from("document_versions")
      .update({ approved_by: profile.id, approved_at: new Date().toISOString() })
      .eq("id", doc.current_version_id);
  }

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "document.publish",
    entityType: "document",
    entityId: documentId,
    before: before ?? undefined,
    after: { status: "approved" },
  });

  revalidatePath("/documents");
}
