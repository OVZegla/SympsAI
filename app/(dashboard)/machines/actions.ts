"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";

function field(formData: FormData, name: string): string | null {
  const v = String(formData.get(name) || "").trim();
  return v.length > 0 ? v : null;
}

/** Create a physical machine at a client site (spec §11, §25). */
export async function createMachine(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Permissions insuffisantes.");

  const machineModelId = field(formData, "machine_model_id");
  if (!machineModelId) throw new Error("Le modèle de machine est requis.");

  const supabase = createClient();
  const { error } = await supabase.from("machines").insert({
    organization_id: profile.organization_id,
    machine_model_id: machineModelId,
    client_id: field(formData, "client_id"),
    serial_number: field(formData, "serial_number"),
    internal_reference: field(formData, "internal_reference"),
    software_version: field(formData, "software_version"),
    installation_date: field(formData, "installation_date"),
    notes: field(formData, "notes"),
    // Profil détaillé (Base Symp's) : génération/versions peuvent changer le
    // diagnostic, une règle peut n'être valable que pour certains montages.
    generation: field(formData, "generation"),
    mounting_type: field(formData, "mounting_type"),
    head_type: field(formData, "head_type"),
    betterprinter_version: field(formData, "betterprinter_version"),
    ultraprint_version: field(formData, "ultraprint_version"),
    modifications: field(formData, "modifications"),
    replaced_parts: field(formData, "replaced_parts"),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/machines");
  revalidatePath("/incidents/new");
}
