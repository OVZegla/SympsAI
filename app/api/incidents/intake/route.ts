import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildIntake,
  type ClientRef,
  type MachineModelRef,
  type MachineRef,
  type IntakeHints,
} from "@/lib/incidents/intake";
import { parseQuery } from "@/lib/ai/query-parser";
import { extractIntakeEntities } from "@/lib/ai/intake-extractor";

interface MachineRow {
  id: string;
  machine_model_id: string;
  client_id: string | null;
  serial_number: string | null;
}

/**
 * POST /api/incidents/intake — conversational incident intake (spec §15-§16,
 * §25-§26). The technician describes the problem; we return what we understood
 * (model, client, machine) and the follow-up questions to complete the dossier
 * (phone, serial number…), so the UI can ask before the incident is recorded.
 *
 * Runs under the caller's RLS. The AI extractors are best-effort: if they are
 * unavailable, keyword/regex matching still works from the description alone.
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

  // Best-effort AI extraction, in parallel: the query parser for the machine
  // hint + follow-up questions, the entity extractor for client/serial.
  const hints: IntakeHints = {};
  let parserMissingInformation: string[] = [];
  const [parsed, entities] = await Promise.allSettled([
    parseQuery(description),
    extractIntakeEntities(description),
  ]);
  if (parsed.status === "fulfilled") {
    hints.machineModel = parsed.value.value.machine_model;
    parserMissingInformation = parsed.value.value.missing_information;
  }
  if (entities.status === "fulfilled") {
    const e = entities.value.value;
    hints.machineModel = hints.machineModel ?? e.machine_model;
    hints.clientName = e.client_name;
    hints.clientPhone = e.client_phone;
    hints.serialNumber = e.serial_number;
  }

  const intake = buildIntake({
    description,
    models: models ?? [],
    clients: clientRows ?? [],
    machines,
    hints,
    parserMissingInformation,
  });

  return NextResponse.json({ intake });
}
