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
import { addMessage } from "./actions";

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

  const addMessageForIncident = addMessage.bind(null, incident.id);

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
            {(messages ?? []).map((m) => (
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
            ))}
          </div>

          {/* The AI assistant answer arrives in Phase 4. For now the transcript
              records the technician's observations and test results. */}
          <form
            action={addMessageForIncident}
            className="border-t border-slate-200 bg-white p-4"
          >
            <div className="flex gap-2">
              <input
                name="content"
                placeholder="Décris le résultat / ajoute une observation…"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Envoyer
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              L&apos;assistant IA (recherche de cas similaires, procédures et
              diagnostic) sera activé en phase 4.
            </p>
          </form>
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

          <ContextBlock title="Incidents similaires">
            <p className="text-xs text-slate-400">
              Recherche de cas similaires — phase 3/4.
            </p>
          </ContextBlock>

          <ContextBlock title="Documents">
            <p className="text-xs text-slate-400">
              Procédures citées — phase 3/4.
            </p>
          </ContextBlock>
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
