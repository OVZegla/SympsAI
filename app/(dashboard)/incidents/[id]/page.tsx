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
import { diagnosticResponseSchema } from "@/lib/ai/schemas";

interface IncidentDetail extends Incident {
  machine_models: { name: string } | null;
  clients: { name: string } | null;
  machines: { serial_number: string | null; internal_reference: string | null } | null;
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
                    <div
                      key={m.id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <DiagnosticView data={parsed.data} />
                    </div>
                  );
                }
              }
              return (
                <div
                  key={m.id}
                  className={
                    m.author_type === "assistant"
                      ? "rounded-lg border border-slate-200 bg-white p-4"
                      : "rounded-lg bg-slate-100 p-4"
                  }
                >
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {AUTHOR_LABELS[m.author_type]}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">
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

          <TestRunsPanel
            incidentId={incident.id}
            runs={testRuns ?? []}
            availableTests={availableTests}
          />
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
