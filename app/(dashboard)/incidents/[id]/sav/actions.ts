"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { SAV_FIELDS } from "@/lib/reports/sav";

/**
 * Enregistre la fiche SAV éditée (incidents.sav_json). Ce que le technicien
 * saisit fait foi sur le pré-remplissage automatique — la fiche reste
 * rééditable et réimprimable à l'identique.
 */
export async function saveSav(incidentId: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Permissions insuffisantes.");

  const fields: Record<string, string> = {};
  for (const f of SAV_FIELDS) {
    fields[f.id] = String(formData.get(f.id) ?? "").trim();
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("incidents")
    .update({ sav_json: fields })
    .eq("id", incidentId);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "incident.save_sav",
    entityType: "incident",
    entityId: incidentId,
  });

  revalidatePath(`/incidents/${incidentId}/sav`);
  revalidatePath(`/incidents/${incidentId}`);
}
