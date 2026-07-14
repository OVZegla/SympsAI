import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { createMachine } from "./actions";
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

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900";

export default async function MachinesPage() {
  const supabase = createClient();

  const [{ data: machines }, { data: models }, { data: clients }] = await Promise.all([
    supabase
      .from("machines")
      .select(
        "id, serial_number, internal_reference, status, installation_date, software_version, machine_models(name), clients(name)",
      )
      .order("created_at", { ascending: false })
      .returns<MachineRow[]>(),
    supabase.from("machine_models").select("id, name").eq("active", true).order("name"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Machines</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* List */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Numéro de série</th>
                <th className="px-4 py-3 font-medium">Modèle</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Logiciel</th>
                <th className="px-4 py-3 font-medium">Installée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(machines ?? []).map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/machines/${m.id}`} className="hover:underline">
                      {m.serial_number ?? m.internal_reference ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{m.machine_models?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.clients?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.software_version ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(m.installation_date)}</td>
                </tr>
              ))}
              {(machines ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Aucune machine. Ajoute-en une à droite.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Creation form */}
        <form
          action={createMachine}
          className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-900">Nouvelle machine</h2>

          <label className="block text-sm font-medium text-slate-700">
            Modèle *
            <select name="machine_model_id" required className={inputClass} defaultValue="">
              <option value="" disabled>
                — Choisir —
              </option>
              {(models ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Client
            <select name="client_id" className={inputClass} defaultValue="">
              <option value="">—</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Numéro de série
            <input name="serial_number" className={inputClass} placeholder="M1-2026-0042" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Référence interne
            <input name="internal_reference" className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Version logiciel
            <input name="software_version" className={inputClass} placeholder="BetterPrinter X" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Date d&apos;installation
            <input name="installation_date" type="date" className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea name="notes" rows={2} className={inputClass} />
          </label>

          {/* Profil détaillé (Base Symp's) : une règle peut n'être valable que
              pour certaines générations/versions. */}
          <details>
            <summary className="cursor-pointer text-sm font-medium text-slate-600">
              Profil détaillé (génération, versions…)
            </summary>
            <div className="mt-3 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Génération
                <input name="generation" className={inputClass} placeholder="Gen 2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Montage
                <select name="mounting_type" className={inputClass} defaultValue="">
                  <option value="">—</option>
                  <option value="ancien">Ancien montage</option>
                  <option value="nouveau">Nouveau montage</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Type de tête
                <input name="head_type" className={inputClass} placeholder="Epson I1600" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Version BetterPrinter
                <input name="betterprinter_version" className={inputClass} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Version UltraPrint
                <input name="ultraprint_version" className={inputClass} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Modifications déjà réalisées
                <textarea name="modifications" rows={2} className={inputClass} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Pièces déjà remplacées
                <textarea name="replaced_parts" rows={2} className={inputClass} />
              </label>
            </div>
          </details>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Créer la machine
          </button>
          {(models ?? []).length === 0 && (
            <p className="text-xs text-amber-700">
              Aucun modèle de machine. (M1/Opaline sont normalement pré-remplis.)
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
