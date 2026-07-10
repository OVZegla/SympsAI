"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";

function field(formData: FormData, name: string): string | null {
  const v = String(formData.get(name) || "").trim();
  return v.length > 0 ? v : null;
}

/** Create a client (spec §11, §26). */
export async function createClientRecord(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Permissions insuffisantes.");

  const name = field(formData, "name");
  if (!name) throw new Error("Le nom du client est requis.");

  const supabase = createClient();
  const { error } = await supabase.from("clients").insert({
    organization_id: profile.organization_id,
    name,
    company_name: field(formData, "company_name"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    notes: field(formData, "notes"),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/incidents/new");
}
