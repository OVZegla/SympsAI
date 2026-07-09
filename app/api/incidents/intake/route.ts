import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIntake, type MachineModelRef } from "@/lib/incidents/intake";
import { parseQuery } from "@/lib/ai/query-parser";

/**
 * POST /api/incidents/intake — conversational incident intake (spec §15-§16).
 * The technician describes the problem; we return what we understood and what is
 * still missing (e.g. the machine model), so the UI can ask for it before the
 * incident is recorded.
 *
 * Runs under the caller's RLS. The AI parser is best-effort: if it is
 * unavailable, machine-model matching still works from the description alone.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { description?: string };
  const description = (body.description ?? "").trim();
  if (!description) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const { data: models } = await supabase
    .from("machine_models")
    .select("id, name, slug")
    .eq("active", true)
    .order("name")
    .returns<MachineModelRef[]>();

  // Best-effort AI parse for the machine hint + useful follow-up questions.
  let parserMachineModel: string | null = null;
  let parserMissingInformation: string[] = [];
  try {
    const parsed = await parseQuery(description);
    parserMachineModel = parsed.value.machine_model;
    parserMissingInformation = parsed.value.missing_information;
  } catch {
    // No AI available — degrade to keyword matching only.
  }

  const intake = buildIntake({
    description,
    models: models ?? [],
    parserMachineModel,
    parserMissingInformation,
  });

  return NextResponse.json({ intake });
}
