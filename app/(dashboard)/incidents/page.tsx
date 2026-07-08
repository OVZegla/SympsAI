import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_CLASSES,
  formatDate,
} from "@/lib/format";
import type { IncidentStatus } from "@/lib/types/database";

interface IncidentRow {
  id: string;
  incident_number: string;
  title: string;
  status: IncidentStatus;
  opened_at: string;
  machine_models: { name: string } | null;
  clients: { name: string } | null;
}

export default async function IncidentsPage() {
  const supabase = createClient();

  const { data: incidents } = await supabase
    .from("incidents")
    .select(
      "id, incident_number, title, status, opened_at, machine_models(name), clients(name)",
    )
    .order("opened_at", { ascending: false })
    .returns<IncidentRow[]>();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Incidents</h1>
        <Link
          href="/incidents/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nouvel incident
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Titre</th>
              <th className="px-4 py-3 font-medium">Machine</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Ouvert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(incidents ?? []).map((inc) => (
              <tr key={inc.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/incidents/${inc.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {inc.incident_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{inc.title}</td>
                <td className="px-4 py-3 text-slate-500">
                  {inc.machine_models?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {inc.clients?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      "rounded-full px-2 py-1 text-xs font-medium " +
                      INCIDENT_STATUS_CLASSES[inc.status]
                    }
                  >
                    {INCIDENT_STATUS_LABELS[inc.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {formatDate(inc.opened_at)}
                </td>
              </tr>
            ))}
            {(incidents ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Aucun incident pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
