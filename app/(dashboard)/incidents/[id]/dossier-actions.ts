"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

function field(formData: FormData, name: string): string | null {
  const v = String(formData.get(name) || "").trim();
  return v.length > 0 ? v : null;
}

/**
 * Correct an incident's dossier after creation (spec §24-§26): "c'était une M1
 * en fait, pas une Opaline" → the machine model / client / machine are updated.
 * The change is applied only on the user's explicit confirmation (the AI
 * proposes, the human validates), missing entities are created on the fly, and
 * the correction is traced as a system message + audit entry.
 */
export async function applyDossierCorrection(
  incidentId: string,
  formData: FormData,
) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Permissions insuffisantes.");

  const supabase = createClient();

  const { data: incident } = await supabase
    .from("incidents")
    .select("id, machine_model_id, client_id, machine_id")
    .eq("id", incidentId)
    .maybeSingle<{
      id: string;
      machine_model_id: string | null;
      client_id: string | null;
      machine_id: string | null;
    }>();
  if (!incident) throw new Error("Incident introuvable.");

  const machineModelId = field(formData, "machine_model_id");
  let clientId = field(formData, "client_id");
  let machineId = field(formData, "machine_id");
  const newClientName = field(formData, "new_client_name");
  const newClientPhone = field(formData, "new_client_phone");
  const newMachineSerial = field(formData, "new_machine_serial");

  const notes: string[] = [];

  if (!clientId && newClientName) {
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        organization_id: profile.organization_id,
        name: newClientName,
        phone: newClientPhone,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !client) {
      throw new Error(error?.message || "Création du client impossible.");
    }
    clientId = client.id;
    notes.push(`client « ${newClientName} » créé`);
  }

  const effectiveModelId = machineModelId ?? incident.machine_model_id;
  if (!machineId && newMachineSerial && effectiveModelId) {
    const { data: machine, error } = await supabase
      .from("machines")
      .insert({
        organization_id: profile.organization_id,
        machine_model_id: effectiveModelId,
        client_id: clientId ?? incident.client_id,
        serial_number: newMachineSerial,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !machine) {
      throw new Error(error?.message || "Création de la machine impossible.");
    }
    machineId = machine.id;
    notes.push(`machine n° ${newMachineSerial} créée`);
  }

  const update: Record<string, string | null> = {};
  if (machineModelId && machineModelId !== incident.machine_model_id) {
    update.machine_model_id = machineModelId;
    // The old physical machine can't belong to the new model: drop it unless a
    // replacement was chosen/created in the same correction.
    if (!machineId) update.machine_id = null;
  }
  if (clientId && clientId !== incident.client_id) update.client_id = clientId;
  if (machineId && machineId !== incident.machine_id) update.machine_id = machineId;

  if (Object.keys(update).length === 0 && notes.length === 0) {
    return; // nothing to change
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from("incidents")
      .update(update)
      .eq("id", incidentId);
    if (error) throw new Error(error.message);
  }

  // Human-readable trail in the transcript ("Dossier corrigé : modèle → M1").
  const summary = field(formData, "summary");
  await supabase.from("incident_messages").insert({
    incident_id: incidentId,
    author_type: "system",
    content: `Dossier corrigé${summary ? ` : ${summary}` : ""}${
      notes.length > 0 ? ` (${notes.join(", ")})` : ""
    }`,
  });

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "incident.correct_dossier",
    entityType: "incident",
    entityId: incidentId,
    before: {
      machine_model_id: incident.machine_model_id,
      client_id: incident.client_id,
      machine_id: incident.machine_id,
    },
    after: update,
  });

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  revalidatePath("/clients");
  revalidatePath("/machines");
}
