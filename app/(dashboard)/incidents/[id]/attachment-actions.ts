"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { analyzeImage } from "@/lib/ai/image-analysis";
import type { AttachmentType } from "@/lib/types/database";

const IMAGE_TYPES: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

function attachmentTypeFor(mime: string, declared: string): AttachmentType {
  if (declared === "screenshot") return "screenshot";
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

/**
 * Upload a file to an incident (spec §38, §39). Images/screenshots are analyzed
 * with Claude vision and the structured observation is added to the transcript.
 * Videos are only stored in V1 (spec §39: no complex video analysis yet).
 */
export async function uploadAttachment(incidentId: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Insufficient permissions.");

  const file = formData.get("file");
  const declaredType = String(formData.get("attachment_type") || "");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A file is required.");
  }

  const supabase = createClient();
  const mime = file.type || "application/octet-stream";
  const path = `${profile.organization_id}/${incidentId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const attachmentType = attachmentTypeFor(mime, declaredType);

  const { data: attachment } = await supabase
    .from("attachments")
    .insert({
      organization_id: profile.organization_id,
      incident_id: incidentId,
      storage_path: path,
      filename: file.name,
      mime_type: mime,
      attachment_type: attachmentType,
      uploaded_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  // Analyze images/screenshots (spec §38). Best-effort — a failure must not lose
  // the uploaded file.
  const mediaType = IMAGE_TYPES[mime];
  if (mediaType) {
    try {
      const { data: incident } = await supabase
        .from("incidents")
        .select("title, description_initial")
        .eq("id", incidentId)
        .maybeSingle<{ title: string; description_initial: string | null }>();

      const buffer = Buffer.from(await file.arrayBuffer());
      const analysis = await analyzeImage({
        base64Data: buffer.toString("base64"),
        mediaType,
        incidentContext: incident?.description_initial ?? incident?.title,
      });

      const summary = [
        analysis.value.visible_software
          ? `Logiciel visible : ${analysis.value.visible_software}`
          : null,
        analysis.value.observations.length
          ? `Observations : ${analysis.value.observations.join("; ")}`
          : null,
        analysis.value.visible_errors.length
          ? `Erreurs visibles : ${analysis.value.visible_errors.join("; ")}`
          : null,
        analysis.value.uncertainties.length
          ? `Incertitudes : ${analysis.value.uncertainties.join("; ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const { data: message } = await supabase
        .from("incident_messages")
        .insert({
          incident_id: incidentId,
          author_type: "assistant",
          content: `Analyse de l'image (${file.name}) :\n${summary}`,
        })
        .select("id")
        .single<{ id: string }>();

      await supabase
        .from("attachments")
        .update({ description: summary, message_id: message?.id ?? null })
        .eq("id", attachment?.id ?? "");

      await supabase.from("ai_runs").insert({
        incident_id: incidentId,
        message_id: message?.id ?? null,
        model: `${analysis.provider}:${analysis.model}`,
        prompt_version: analysis.promptVersion,
        input_tokens: analysis.inputTokens,
        output_tokens: analysis.outputTokens,
        status: "ok",
      });
    } catch (err) {
      console.error("[attachments] image analysis failed:", (err as Error).message);
    }
  }

  revalidatePath(`/incidents/${incidentId}`);
}
