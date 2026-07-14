"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

/**
 * Mode apprentissage contrôlé (§16-§17E) : les techniciens proposent des
 * connaissances, un admin les valide. Une soumission n'est JAMAIS confirmée
 * automatiquement — c'est la règle de validation humaine (spec §24) appliquée
 * à la mémoire elle-même.
 */

export async function submitKnowledge(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Permissions insuffisantes.");

  const statement = String(formData.get("statement") || "").trim();
  if (!statement) throw new Error("Le fait à proposer est requis.");

  const supabase = createClient();
  const { error } = await supabase.from("knowledge_submissions").insert({
    organization_id: profile.organization_id,
    statement,
    category: String(formData.get("category") || "").trim() || "terrain",
    keywords: String(formData.get("keywords") || "").trim() || null,
    machine_model_id: String(formData.get("machine_model_id") || "").trim() || null,
    incident_id: String(formData.get("incident_id") || "").trim() || null,
    source_note: String(formData.get("source_note") || "").trim() || null,
    status: "PENDING_REVIEW",
    submitted_by: profile.id,
  });
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "knowledge.submit",
    entityType: "knowledge_submission",
    after: { statement },
  });

  revalidatePath("/knowledge");
}

/** Validation ou rejet par un admin (RLS refuse l'update aux non-admins). */
export async function reviewKnowledge(
  submissionId: string,
  decision: "CONFIRMED" | "REJECTED",
  formData: FormData,
) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Réservé aux admins.");

  const supabase = createClient();
  const { error } = await supabase
    .from("knowledge_submissions")
    .update({
      status: decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      review_note: String(formData.get("review_note") || "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: `knowledge.review_${decision.toLowerCase()}`,
    entityType: "knowledge_submission",
    entityId: submissionId,
  });

  revalidatePath("/knowledge");
}
