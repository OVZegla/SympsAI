import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildIntake,
  type ClientRef,
  type MachineModelRef,
  type MachineRef,
  type IntakeHints,
} from "@/lib/incidents/intake";
import { extractIntakeEntities } from "@/lib/ai/intake-extractor";

interface MachineRow {
  id: string;
  machine_model_id: string;
  client_id: string | null;
  serial_number: string | null;
}

/**
 * POST /api/incidents/[id]/correction — analyse a free-text dossier correction
 * ("c'était une M1 en fait, pas une Opaline") and return what should change.
 * Analysis only: nothing is written here. The UI shows the proposal and the
 * user confirms it via the applyDossierCorrection server action (spec §24: the
 * AI proposes, the human validates).
 *
 * Runs under the caller's RLS; the AI extractor is best-effort (keyword/regex
 * matching still works without it, including the "pas une Opaline" negation).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS-visible incident check so we never analyse against foreign data.
  const { data: incident } = await supabase
    .from("incidents")
    .select("id")
    .eq("id", params.id)
    .maybeSingle<{ id: string }>();
  if (!incident) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const [{ data: models }, { data: clientRows }, { data: machineRows }] =
    await Promise.all([
      supabase
        .from("machine_models")
        .select("id, name, slug")
        .eq("active", true)
        .order("name")
        .returns<MachineModelRef[]>(),
      supabase.from("clients").select("id, name").returns<ClientRef[]>(),
      supabase
        .from("machines")
        .select("id, machine_model_id, client_id, serial_number")
        .returns<MachineRow[]>(),
    ]);

  const machines: MachineRef[] = (machineRows ?? []).map((m) => ({
    id: m.id,
    machineModelId: m.machine_model_id,
    clientId: m.client_id,
    serialNumber: m.serial_number,
  }));

  const hints: IntakeHints = {};
  try {
    const entities = (await extractIntakeEntities(text)).value;
    hints.machineModel = entities.machine_model;
    hints.clientName = entities.client_name;
    hints.clientPhone = entities.client_phone;
    hints.serialNumber = entities.serial_number;
  } catch {
    // No AI available — keyword/regex matching only.
  }

  const proposal = buildIntake({
    description: text,
    models: models ?? [],
    clients: clientRows ?? [],
    machines,
    hints,
  });

  return NextResponse.json({ proposal });
}
