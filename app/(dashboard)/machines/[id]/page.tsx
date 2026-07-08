import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_CLASSES,
  formatDate,
} from "@/lib/format";
import type { IncidentStatus, MachineStatus } from "@/lib/types/database";

interface MachineDetail {
  id: string;
  serial_number: string | null;
  internal_reference: string | null;
  status: MachineStatus;
  installation_date: string | null;
  software_version: string | null;
  configuration_json: Record<string, unknown>;
  notes: string | null;
  machine_models: { name: string } | null;
  clients: { name: string; company_name: string | null } | null;
}

interface IncidentRow {
  id: string;
  incident_number: string;
  title: string;
  status: IncidentStatus;
  opened_at: string;
}

export default async function MachineDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: machine } = await supabase
    .from("machines")
    .select(
      "id, serial_number, internal_reference, status, installation_date, software_version, configuration_json, notes, machine_models(name), clients(name, company_name)",
    )
    .eq("id", params.id)
    .maybeSingle<MachineDetail>();

  if (!machine) notFound();

  // Full incident history for this physical machine (spec §25).
  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, incident_number, title, status, opened_at")
    .eq("machine_id", params.id)
    .order("opened_at", { ascending: false })
    .returns<IncidentRow[]>();

  const label =
    machine.serial_number || machine.internal_reference || "Machine";

  return (
    <div className="p-8">
      <p className="text-sm text-slate-400">{machine.machine_models?.name}</p>
      <h1 className="text-2xl font-semibold text-slate-900">{label}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
          <Info label="Client" value={machine.clients?.name ?? "—"} />
          <Info label="Livraison" value={formatDate(machine.installation_date)} />
          <Info label="Logiciel" value={machine.software_version ?? "—"} />
          <Info label="Statut" value={machine.status} />
          {machine.notes && <Info label="Notes" value={machine.notes} />}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Historique ({incidents?.length ?? 0})
          </h2>
          <ul className="space-y-2">
            {(incidents ?? []).map((inc) => (
              <li
                key={inc.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
              >
                <div>
                  <Link
                    href={`/incidents/${inc.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {inc.incident_number} — {inc.title}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {formatDate(inc.opened_at)}
                  </p>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-1 text-xs font-medium " +
                    INCIDENT_STATUS_CLASSES[inc.status]
                  }
                >
                  {INCIDENT_STATUS_LABELS[inc.status]}
                </span>
              </li>
            ))}
            {(incidents ?? []).length === 0 && (
              <li className="text-sm text-slate-400">Aucun incident.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}
