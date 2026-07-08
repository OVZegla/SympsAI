import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { MachineStatus } from "@/lib/types/database";

interface MachineRow {
  id: string;
  serial_number: string | null;
  internal_reference: string | null;
  status: MachineStatus;
  installation_date: string | null;
  software_version: string | null;
  machine_models: { name: string } | null;
  clients: { name: string } | null;
}

export default async function MachinesPage() {
  const supabase = createClient();

  const { data: machines } = await supabase
    .from("machines")
    .select(
      "id, serial_number, internal_reference, status, installation_date, software_version, machine_models(name), clients(name)",
    )
    .order("created_at", { ascending: false })
    .returns<MachineRow[]>();

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Machines</h1>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Numéro de série</th>
              <th className="px-4 py-3 font-medium">Modèle</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Logiciel</th>
              <th className="px-4 py-3 font-medium">Installée</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(machines ?? []).map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {m.serial_number ?? m.internal_reference ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {m.machine_models?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {m.clients?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {m.software_version ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {formatDate(m.installation_date)}
                </td>
                <td className="px-4 py-3 text-slate-500 capitalize">
                  {m.status}
                </td>
              </tr>
            ))}
            {(machines ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Aucune machine enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
