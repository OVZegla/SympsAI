"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import type { RiskLevel } from "@/lib/types/database";

function field(formData: FormData, name: string): string | null {
  const v = String(formData.get(name) || "").trim();
  return v.length > 0 ? v : null;
}

const RISKS: RiskLevel[] = ["low", "normal", "high"];

/** Create a diagnostic test in the catalogue (spec §11, §23, §60). */
export async function createDiagnosticTest(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Permissions insuffisantes.");

  const title = field(formData, "title");
  if (!title) throw new Error("Le titre du test est requis.");

  const riskRaw = String(formData.get("risk_level") || "normal");
  const risk: RiskLevel = RISKS.includes(riskRaw as RiskLevel)
    ? (riskRaw as RiskLevel)
    : "normal";

  const supabase = createClient();
  const { error } = await supabase.from("diagnostic_tests").insert({
    organization_id: profile.organization_id,
    machine_model_id: field(formData, "machine_model_id"),
    component_id: field(formData, "component_id"),
    code: field(formData, "code"),
    title,
    description: field(formData, "description"),
    instructions: field(formData, "instructions"),
    risk_level: risk,
    active: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/tests");
}
