import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_CLASSES,
  formatDate,
} from "@/lib/format";
import type {
  Incident,
  IncidentMessage,
  MessageAuthor,
} from "@/lib/types/database";
import { DiagnosticView } from "@/components/chat/DiagnosticView";
import { AskAssistant } from "@/components/chat/AskAssistant";
import {
  TestRunsPanel,
  type TestRunItem,
  type AvailableTest,
} from "@/components/incidents/TestRunsPanel";
import { ClosurePanel } from "@/components/incidents/ClosurePanel";
import {
  AttachmentsPanel,
  type AttachmentItem,
} from "@/components/incidents/AttachmentsPanel";
import {
  DossierPanel,
  type MachineChoice,
} from "@/components/incidents/DossierPanel";
import { diagnosticResponseSchema } from "@/lib/ai/schemas";
import { NextCheckCard } from "@/components/incidents/NextCheckCard";
import { runEngine, type EngineTestResult } from "@/lib/diagnosis/engine";

interface IncidentDetail extends Incident {
  machine_models: { name: string } | null;
  clients: { name: string } | null;
  machines: { serial_number: string | null; internal_reference: string | null } | null;
}

interface MachineRow {
  id: string;
  serial_number: string | null;
  internal_reference: string | null;
  machine_models: { name: string } | null;
  clients: { name: string } | null;
}

const AUTHOR_LABELS: Record<MessageAuthor, string> = {
  user: "Technicien",
  assistant: "Assistant",
  system: "Système",
};

export default async function IncidentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: incident } = await supabase
    .from("incidents")
    .select(
      "*, machine_models(name), clients(name), machines(serial_number, internal_reference)",
    )
    .eq("id", params.id)
    .maybeSingle<IncidentDetail>();

  if (!incident) {
    notFound();
  }

  const { data: messages } = await supabase
    .from("incident_messages")
    .select("*")
    .eq("incident_id", params.id)
    .order("created_at", { ascending: true })
    .returns<IncidentMessage[]>();

  // Test runs on this incident + the catalogue of tests available for its
  // machine model (spec §21-§23 get_available_tests).
  const { data: testRuns } = await supabase
    .from("incident_test_runs")
    .select("id, status, result_notes, diagnostic_tests(title, code)")
    .eq("incident_id", params.id)
    .order("created_at", { ascending: true })
    .returns<TestRunItem[]>();

  let availableTests: AvailableTest[] = [];
  if (incident.machine_model_id) {
    const { data } = await supabase
      .from("diagnostic_tests")
      .select("id, code, title")
      .eq("machine_model_id", incident.machine_model_id)
      .eq("active", true)
      .order("code")
      .returns<AvailableTest[]>();
    availableTests = data ?? [];
  }

  // Reference lists for the dossier-correction panel ("c'était une M1 en
  // fait, pas une Opaline" — spec §24-§26).
  const [{ data: allModels }, { data: allClients }, { data: machineRows }] =
    await Promise.all([
      supabase.from("machine_models").select("id, name").eq("active", true).order("name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase
        .from("machines")
        .select("id, serial_number, internal_reference, machine_models(name), clients(name)")
        .order("created_at", { ascending: false })
        .returns<MachineRow[]>(),
    ]);

  const machineChoices: MachineChoice[] = (machineRows ?? []).map((m) => ({
    id: m.id,
    label:
      `${m.machine_models?.name ?? "Machine"} · ${m.serial_number ?? m.internal_reference ?? "?"}` +
      (m.clients?.name ? ` · ${m.clients.name}` : ""),
  }));

  const { data: attachments } = await supabase
    .from("attachments")
    .select("id, filename, attachment_type, description")
    .eq("incident_id", params.id)
    .order("created_at", { ascending: true })
    .returns<AttachmentItem[]>();

  // Carte « Prochaine vérification » : le moteur déterministe tourne côté
  // serveur sur la description + les messages du technicien + les tests déjà
  // réalisés. Zéro LLM — disponible même quand Ollama est éteint.
  const engineText = [
    incident.description_initial,
    ...(messages ?? [])
      .filter((m) => m.author_type === "user")
      .map((m) => m.content ?? ""),
  ]
    .filter(Boolean)
    .join("\n");
  const performedForEngine: EngineTestResult[] = (testRuns ?? [])
    .filter((r) =>
      ["passed", "failed", "inconclusive", "not_applicable", "cancelled"].includes(r.status),
    )
    .map((r) => ({
      text: [r.diagnostic_tests?.title, r.result_notes].filter(Boolean).join(" — "),
      status: r.status as EngineTestResult["status"],
    }));
  const engine = runEngine({ text: engineText, performedTests: performedForEngine });
  const incidentOpen = incident.status !== "closed";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {incident.incident_number} — {incident.title}
          </h1>
          <p className="text-sm text-slate-500">
            {incident.machine_models?.name ?? "Machine non précisée"}
          </p>
        </div>
        <span
          className={
            "rounded-full px-3 py-1 text-xs font-medium " +
            INCIDENT_STATUS_CLASSES[incident.status]
          }
        >
          {INCIDENT_STATUS_LABELS[incident.status]}
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat column */}
        <section className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-auto p-6">
            {(messages ?? []).map((m) => {
              // Assistant messages carry a structured diagnostic payload the UI
              // renders (spec §36); fall back to plain text if absent/invalid.
              if (m.author_type === "assistant" && m.structured_content_json) {
                const parsed = diagnosticResponseSchema.safeParse(
                  m.structured_content_json,
                );
                if (parsed.success) {
                  return (
                    <div key={m.id} className="mr-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <DiagnosticView data={parsed.data} />
                    </div>
                  );
                }
              }
              if (m.author_type === "system") {
                return (
                  <p key={m.id} className="text-center text-xs text-slate-400">
                    — {m.content} —
                  </p>
                );
              }
              const isAssistant = m.author_type === "assistant";
              return (
                <div
                  key={m.id}
                  className={
                    isAssistant
                      ? "mr-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      : "ml-8 rounded-xl bg-slate-900 p-4 text-white"
                  }
                >
                  <p
                    className={
                      "mb-1 text-xs font-medium uppercase tracking-wide " +
                      (isAssistant ? "text-slate-400" : "text-slate-400")
                    }
                  >
                    {isAssistant ? "🤖 " : "👤 "}
                    {AUTHOR_LABELS[m.author_type]}
                  </p>
                  <p
                    className={
                      "whitespace-pre-wrap text-sm " +
                      (isAssistant ? "text-slate-800" : "text-white")
                    }
                  >
                    {m.content}
                  </p>
                </div>
              );
            })}
          </div>

          <AskAssistant incidentId={incident.id} />
        </section>

        {/* Context column (spec §42) */}
        <aside className="w-72 shrink-0 space-y-5 overflow-auto border-l border-slate-200 bg-white p-5">
          {incidentOpen && <NextCheckCard incidentId={incident.id} engine={engine} />}

          <ContextBlock title="Machine">
            <p className="text-sm text-slate-800">
              {incident.machine_models?.name ?? "—"}
            </p>
            {incident.machines?.serial_number && (
              <p className="text-xs text-slate-500">
                N° {incident.machines.serial_number}
              </p>
            )}
          </ContextBlock>

          <ContextBlock title="Client">
            <p className="text-sm text-slate-800">
              {incident.clients?.name ?? "—"}
            </p>
          </ContextBlock>

          <ContextBlock title="Ouvert le">
            <p className="text-sm text-slate-800">
              {formatDate(incident.opened_at)}
            </p>
          </ContextBlock>

          <DossierPanel
            incidentId={incident.id}
            current={{
              machineModelId: incident.machine_model_id,
              machineModelName: incident.machine_models?.name ?? null,
              clientId: incident.client_id,
              clientName: incident.clients?.name ?? null,
              machineId: incident.machine_id,
              machineSerial:
                incident.machines?.serial_number ??
                incident.machines?.internal_reference ??
                null,
            }}
            models={allModels ?? []}
            clients={allClients ?? []}
            machines={machineChoices}
          />

          <TestRunsPanel
            incidentId={incident.id}
            runs={testRuns ?? []}
            availableTests={availableTests}
          />

          <AttachmentsPanel
            incidentId={incident.id}
            attachments={attachments ?? []}
          />

          <ContextBlock title="Rapports">
              <div className="space-y-1">
                <a
                  href={`/incidents/${incident.id}/sav`}
                  className="block rounded border border-slate-300 px-2 py-1 text-center text-xs text-slate-700 hover:bg-slate-100"
                >
                  📝 Fiche SAV / intervention
                </a>
                <a
                  href={`/api/incidents/${incident.id}/report?type=transmission`}
                  className="block rounded border border-slate-300 px-2 py-1 text-center text-xs text-slate-700 hover:bg-slate-100"
                >
                  📤 Résumé de transmission (FR/EN)
                </a>
                <a
                  href={`/api/incidents/${incident.id}/report?type=final`}
                  className="block rounded border border-slate-300 px-2 py-1 text-center text-xs text-slate-700 hover:bg-slate-100"
                >
                  📋 Rapport final
                </a>
              </div>
          </ContextBlock>

          {incident.status !== "closed" && <ClosurePanel incidentId={incident.id} />}
        </aside>
      </div>
    </div>
  );
}

function ContextBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}
