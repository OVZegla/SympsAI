import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildFinalReport,
  buildTransmissionSummary,
  type IncidentReportData,
  type ReportTest,
} from "@/lib/reports/incident-report";
import { runEngine, LIKELIHOOD_LABEL_FR } from "@/lib/diagnosis/engine";
import { INCIDENT_STATUS_LABELS } from "@/lib/format";
import type { IncidentStatus } from "@/lib/types/database";

/**
 * GET /api/incidents/[id]/report?type=final|transmission — génère le rapport
 * Markdown du dossier (§17B/§17C). Déterministe : le contenu vient de la base
 * (RLS du demandeur), les hypothèses restantes du moteur — jamais du LLM.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(request.url).searchParams.get("type") ?? "transmission";

  const { data: incident } = await supabase
    .from("incidents")
    .select(
      `id, incident_number, title, status, opened_at, closed_at, description_initial,
       current_summary,
       machine_models(name), clients(name),
       machines(serial_number, internal_reference, generation, mounting_type, head_type,
                betterprinter_version, ultraprint_version, software_version,
                modifications, replaced_parts)`,
    )
    .eq("id", params.id)
    .maybeSingle<{
      id: string;
      incident_number: string;
      title: string;
      status: IncidentStatus;
      opened_at: string;
      closed_at: string | null;
      description_initial: string | null;
      current_summary: string | null;
      machine_models: { name: string } | null;
      clients: { name: string } | null;
      machines: {
        serial_number: string | null;
        internal_reference: string | null;
        generation: string | null;
        mounting_type: string | null;
        head_type: string | null;
        betterprinter_version: string | null;
        ultraprint_version: string | null;
        software_version: string | null;
        modifications: string | null;
        replaced_parts: string | null;
      } | null;
    }>();
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: testRuns }, { data: causes }, { data: solutions }, { data: messages }] =
    await Promise.all([
      supabase
        .from("incident_test_runs")
        .select("status, result_notes, completed_at, diagnostic_tests(title)")
        .eq("incident_id", params.id)
        .order("created_at", { ascending: true })
        .returns<
          {
            status: string;
            result_notes: string | null;
            completed_at: string | null;
            diagnostic_tests: { title: string } | null;
          }[]
        >(),
      supabase
        .from("incident_causes")
        .select("status, evidence, causes(name, description)")
        .eq("incident_id", params.id)
        .eq("status", "confirmed")
        .returns<
          { status: string; evidence: string | null; causes: { name: string; description: string | null } | null }[]
        >(),
      supabase
        .from("incident_solutions")
        .select("solution_text, validated")
        .eq("incident_id", params.id)
        .eq("validated", true)
        .returns<{ solution_text: string; validated: boolean }[]>(),
      supabase
        .from("incident_messages")
        .select("author_type, content")
        .eq("incident_id", params.id)
        .eq("author_type", "user")
        .order("created_at", { ascending: true })
        .returns<{ author_type: string; content: string | null }[]>(),
    ]);

  const tests: ReportTest[] = (testRuns ?? []).map((t) => {
    // Les tests guidés du moteur stockent « Nom du test — détail » dans
    // result_notes ; les tests du catalogue ont leur titre joint.
    const raw = t.result_notes ?? "";
    const name = t.diagnostic_tests?.title ?? raw.split(" — ")[0] ?? "Test";
    const notes = t.diagnostic_tests?.title
      ? raw
      : raw.includes(" — ")
        ? raw.slice(raw.indexOf(" — ") + 3)
        : null;
    return { name, status: t.status, notes, at: t.completed_at };
  });

  const m = incident.machines;
  const machineProfile = [
    m?.generation ? `**Génération / Generation :** ${m.generation}` : null,
    m?.mounting_type ? `**Montage / Mounting :** ${m.mounting_type}` : null,
    m?.head_type ? `**Têtes / Heads :** ${m.head_type}` : null,
    m?.software_version ? `**Logiciel machine / Software :** ${m.software_version}` : null,
    m?.betterprinter_version ? `**BetterPrinter :** ${m.betterprinter_version}` : null,
    m?.ultraprint_version ? `**UltraPrint :** ${m.ultraprint_version}` : null,
    m?.modifications ? `**Modifications :** ${m.modifications}` : null,
    m?.replaced_parts ? `**Pièces remplacées / Replaced parts :** ${m.replaced_parts}` : null,
  ].filter((x): x is string => Boolean(x));

  // Hypothèses restantes calculées par le moteur (dossier non résolu).
  const engine = runEngine({
    text: [incident.description_initial, ...(messages ?? []).map((x) => x.content ?? "")]
      .filter(Boolean)
      .join("\n"),
    performedTests: tests
      .filter((t) =>
        ["passed", "failed", "inconclusive", "not_applicable", "cancelled"].includes(t.status),
      )
      .map((t) => ({
        text: [t.name, t.notes].filter(Boolean).join(" — "),
        status: t.status as "passed" | "failed" | "inconclusive" | "not_applicable" | "cancelled",
      })),
  });

  const confirmedCause = causes?.[0]
    ? [causes[0].causes?.name, causes[0].causes?.description ?? causes[0].evidence]
        .filter(Boolean)
        .join(" — ")
    : null;

  const data: IncidentReportData = {
    incidentNumber: incident.incident_number,
    title: incident.title,
    status: INCIDENT_STATUS_LABELS[incident.status] ?? incident.status,
    openedAt: new Date(incident.opened_at).toLocaleString("fr-FR"),
    closedAt: incident.closed_at ? new Date(incident.closed_at).toLocaleString("fr-FR") : null,
    machineModel: incident.machine_models?.name ?? null,
    serialNumber: m?.serial_number ?? m?.internal_reference ?? null,
    clientName: incident.clients?.name ?? null,
    machineProfile,
    description: incident.description_initial ?? incident.title,
    tests,
    confirmedCause,
    solution: solutions?.[0]?.solution_text ?? null,
    finalSummary: incident.current_summary ?? null,
    remainingHypotheses: confirmedCause
      ? []
      : engine.hypotheses
          .filter((h) => h.likelihood !== "unlikely")
          .map((h) => `${h.label} (${LIKELIHOOD_LABEL_FR[h.likelihood]})`),
    generatedAt: new Date().toLocaleString("fr-FR"),
  };

  const markdown =
    type === "final" ? buildFinalReport(data) : buildTransmissionSummary(data);
  const filename = `${incident.incident_number}-${type === "final" ? "rapport" : "transmission"}.md`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
