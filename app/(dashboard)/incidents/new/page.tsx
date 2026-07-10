import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createIncident } from "../actions";
import {
  IncidentIntake,
  type MachineOption,
} from "@/components/incidents/IncidentIntake";

interface MachineRow {
  id: string;
  serial_number: string | null;
  internal_reference: string | null;
  machine_model_id: string;
  client_id: string | null;
  machine_models: { name: string } | null;
  clients: { name: string } | null;
}

export default async function NewIncidentPage() {
  const supabase = createClient();

  const [{ data: models }, { data: clients }, { data: machineRows }] = await Promise.all([
    supabase.from("machine_models").select("id, name").eq("active", true).order("name"),
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("machines")
      .select(
        "id, serial_number, internal_reference, machine_model_id, client_id, machine_models(name), clients(name)",
      )
      .order("created_at", { ascending: false })
      .returns<MachineRow[]>(),
  ]);

  const machines: MachineOption[] = (machineRows ?? []).map((m) => ({
    id: m.id,
    machineModelId: m.machine_model_id,
    clientId: m.client_id,
    label:
      `${m.machine_models?.name ?? "Machine"} · ${m.serial_number ?? m.internal_reference ?? "?"}` +
      (m.clients?.name ? ` · ${m.clients.name}` : ""),
  }));

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Nouvel incident</h1>
      <p className="mt-1 text-sm text-slate-500">
        Décris le problème en langage naturel. L&apos;assistant identifie la
        machine et te signale ce qui manque avant de créer l&apos;incident.
      </p>

      <p className="mt-2 text-xs text-slate-400">
        Pas encore de client ou de machine ?{" "}
        <Link href="/clients" className="underline">
          Ajoute un client
        </Link>{" "}
        ·{" "}
        <Link href="/machines" className="underline">
          ajoute une machine
        </Link>
        .
      </p>

      <div className="mt-6">
        <IncidentIntake
          models={models ?? []}
          clients={clients ?? []}
          machines={machines}
        />
      </div>

      {/* Fallback: fill everything manually without the assistant. */}
      <details className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">
          Saisie manuelle
        </summary>
        <form action={createIncident} className="mt-4 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Modèle de machine
              <select
                name="machine_model_id"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                defaultValue=""
              >
                <option value="">—</option>
                {(models ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Client
              <select
                name="client_id"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                defaultValue=""
              >
                <option value="">—</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Titre (facultatif)
            <input
              name="title"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="Résumé court du problème"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Description du problème
            <textarea
              name="description"
              required
              rows={6}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>

          <button
            type="submit"
            className="rounded-md bg-slate-900 px-5 py-2 font-medium text-white hover:bg-slate-800"
          >
            Créer l&apos;incident
          </button>
        </form>
      </details>
    </div>
  );
}
