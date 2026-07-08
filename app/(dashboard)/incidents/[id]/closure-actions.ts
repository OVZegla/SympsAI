"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { indexIncidentKnowledge } from "@/lib/knowledge/incident-indexing";

/**
 * Confirm the cause, apply the solution, and close the incident (spec §32).
 * This is the human-validation step: only a person triggers it, and it is the
 * only path that promotes a cause to `confirmed` and turns the incident into
 * searchable confirmed knowledge (spec §2.3, §2.4, §11, §33).
 *
 * All of it is audited (spec §11). The AI can only PROPOSE this (spec §24).
 */
export async function confirmAndClose(incidentId: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Insufficient permissions.");

  const causeName = String(formData.get("cause_name") || "").trim();
  const causeDescription = String(formData.get("cause_description") || "").trim();
  const solutionText = String(formData.get("solution_text") || "").trim();
  const finalSummary = String(formData.get("final_summary") || "").trim();

  if (!causeName || !solutionText) {
    throw new Error("A confirmed cause and an applied solution are required to close.");
  }

  const supabase = createClient();

  const { data: incident } = await supabase
    .from("incidents")
    .select("id, organization_id, machine_model_id, description_initial, title")
    .eq("id", incidentId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      machine_model_id: string | null;
      description_initial: string | null;
      title: string;
    }>();
  if (!incident) throw new Error("Incident not found.");

  // 1. Catalogue the cause (reusable across incidents).
  const { data: cause } = await supabase
    .from("causes")
    .insert({
      organization_id: incident.organization_id,
      machine_model_id: incident.machine_model_id,
      name: causeName,
      description: causeDescription || null,
    })
    .select("id")
    .single<{ id: string }>();

  // 2. Link it to the incident as a HUMAN-CONFIRMED cause (spec §11).
  const { data: incidentCause } = await supabase
    .from("incident_causes")
    .insert({
      incident_id: incidentId,
      cause_id: cause?.id ?? null,
      status: "confirmed",
      evidence: causeDescription || null,
      validated_by: profile.id,
      validated_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  // 3. Record the validated solution.
  await supabase.from("incident_solutions").insert({
    incident_id: incidentId,
    solution_text: solutionText,
    validated: true,
    validated_by: profile.id,
    validated_at: new Date().toISOString(),
  });

  // 4. Close the incident, pointing at the confirmed cause.
  const now = new Date().toISOString();
  await supabase
    .from("incidents")
    .update({
      status: "closed",
      confirmed_cause_id: incidentCause?.id ?? null,
      current_summary: finalSummary || null,
      resolved_at: now,
      closed_at: now,
    })
    .eq("id", incidentId);

  // 5. Index the incident into confirmed knowledge (spec §33): now searchable.
  await indexIncidentKnowledge(supabase, incidentId, [
    { type: "symptoms", content: incident.description_initial ?? incident.title },
    { type: "confirmed_cause", content: `${causeName}. ${causeDescription}`.trim() },
    { type: "validated_solution", content: solutionText },
    {
      type: "final_summary",
      content: finalSummary || `${incident.title} — cause : ${causeName}.`,
    },
  ]);

  await recordAudit(supabase, {
    organizationId: incident.organization_id,
    userId: profile.id,
    action: "incident.close_with_confirmed_cause",
    entityType: "incident",
    entityId: incidentId,
    after: { cause: causeName, solution: solutionText },
  });

  revalidatePath(`/incidents/${incidentId}`);
}
