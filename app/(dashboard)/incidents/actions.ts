"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { computeNextIncidentNumber } from "@/lib/incident-number";

/**
 * Generate the next incident number for an organization (INC-0001, INC-0002…).
 * Sequential-per-org and human-readable (spec §11 incident_number, §20 examples).
 * Note: not concurrency-proof under heavy parallel creation; a DB sequence per
 * org can replace this if collisions ever appear (the unique constraint on
 * (organization_id, incident_number) guarantees no duplicates slip through).
 */
async function nextIncidentNumber(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<string> {
  const { data } = await supabase
    .from("incidents")
    .select("incident_number")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1);

  return computeNextIncidentNumber(data?.[0]?.incident_number ?? null);
}

export async function createIncident(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) {
    throw new Error("Insufficient permissions to create an incident.");
  }

  const supabase = createClient();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const machineModelId = String(formData.get("machine_model_id") || "").trim();
  let clientId = String(formData.get("client_id") || "").trim();
  let machineId = String(formData.get("machine_id") || "").trim();

  if (!description) {
    throw new Error("A problem description is required.");
  }

  // Conversational intake can name a client/machine that doesn't exist yet
  // ("c'est Dupont qui a un problème avec sa M1 n° 12345"): create them so the
  // dossier is complete from the start (spec §25-§26). The creation happens on
  // the user's explicit "create" click, satisfying the human-confirmation rule
  // for writes (§24). The trail is recorded as system messages below.
  const systemNotes: string[] = [];

  const newClientName = String(formData.get("new_client_name") || "").trim();
  if (!clientId && newClientName) {
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        organization_id: profile.organization_id,
        name: newClientName,
        phone: String(formData.get("new_client_phone") || "").trim() || null,
        email: String(formData.get("new_client_email") || "").trim() || null,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !client) {
      throw new Error(error?.message || "Failed to create the client.");
    }
    clientId = client.id;
    systemNotes.push(`Client « ${newClientName} » créé`);
  }

  const newMachineSerial = String(formData.get("new_machine_serial") || "").trim();
  if (!machineId && newMachineSerial && machineModelId) {
    const { data: machine, error } = await supabase
      .from("machines")
      .insert({
        organization_id: profile.organization_id,
        machine_model_id: machineModelId,
        client_id: clientId || null,
        serial_number: newMachineSerial,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !machine) {
      throw new Error(error?.message || "Failed to create the machine.");
    }
    machineId = machine.id;
    systemNotes.push(`Machine n° ${newMachineSerial} créée`);
  }

  const incidentNumber = await nextIncidentNumber(supabase, profile.organization_id);

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      organization_id: profile.organization_id,
      incident_number: incidentNumber,
      // Use the first line of the description as a fallback title.
      title: title || description.split("\n")[0]!.slice(0, 120),
      description_initial: description,
      machine_model_id: machineModelId || null,
      client_id: clientId || null,
      machine_id: machineId || null,
      status: "new",
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create incident.");
  }

  // Persist the technician's initial description as the first message so the
  // incident carries a full transcript from the start (spec §11 incident_messages).
  await supabase.from("incident_messages").insert({
    incident_id: data.id,
    author_type: "user",
    author_user_id: profile.id,
    content: description,
  });

  if (systemNotes.length > 0) {
    await supabase.from("incident_messages").insert({
      incident_id: data.id,
      author_type: "system",
      content: systemNotes.join(" · "),
    });
  }

  revalidatePath("/incidents");
  revalidatePath("/clients");
  revalidatePath("/machines");
  redirect(`/incidents/${data.id}`);
}
