"use client";

import { useState } from "react";
import { applyDossierCorrection } from "@/app/(dashboard)/incidents/[id]/dossier-actions";
import type { IntakeResult } from "@/lib/incidents/intake";

interface Option {
  id: string;
  name: string;
}

export interface MachineChoice {
  id: string;
  label: string;
}

export interface CurrentDossier {
  machineModelId: string | null;
  machineModelName: string | null;
  clientId: string | null;
  clientName: string | null;
  machineId: string | null;
  machineSerial: string | null;
}

interface ProposedChange {
  field: string;
  from: string;
  to: string;
}

const inputClass =
  "w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-900";

/**
 * The incident dossier (machine / client) with chat-style correction (spec
 * §24-§26): the technician writes "c'était une M1 en fait, pas une Opaline",
 * the backend analyses it, the proposed changes are shown, and nothing is
 * written until "Appliquer" is clicked (AI proposes, human validates). A manual
 * edit fold covers everything the free-text analysis can't.
 */
export function DossierPanel({
  incidentId,
  current,
  models,
  clients,
  machines,
}: {
  incidentId: string;
  current: CurrentDossier;
  models: Option[];
  clients: Option[];
  machines: MachineChoice[];
}) {
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<IntakeResult | null>(null);
  const [changes, setChanges] = useState<ProposedChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { proposal: IntakeResult };
      const p = json.proposal;

      const next: ProposedChange[] = [];
      if (p.machineModel && p.machineModel.id !== current.machineModelId) {
        next.push({
          field: "Modèle",
          from: current.machineModelName ?? "—",
          to: p.machineModel.name,
        });
      }
      if (p.existingClient && p.existingClient.id !== current.clientId) {
        next.push({
          field: "Client",
          from: current.clientName ?? "—",
          to: p.existingClient.name,
        });
      } else if (p.newClientName) {
        next.push({
          field: "Client",
          from: current.clientName ?? "—",
          to: `${p.newClientName} (nouveau)`,
        });
      }
      if (p.existingMachine && p.existingMachine.id !== current.machineId) {
        next.push({
          field: "Machine",
          from: current.machineSerial ?? "—",
          to: p.existingMachine.serialNumber ?? "machine existante",
        });
      } else if (p.newMachineSerial) {
        next.push({
          field: "Machine",
          from: current.machineSerial ?? "—",
          to: `n° ${p.newMachineSerial} (nouvelle)`,
        });
      }

      setProposal(p);
      setChanges(next);
    } catch {
      setError("L'analyse a échoué. Utilise la modification manuelle ci-dessous.");
    } finally {
      setLoading(false);
    }
  }

  const summary = changes
    .map((c) => `${c.field} : ${c.from} → ${c.to}`)
    .join(" · ");

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Corriger le dossier
      </p>

      {/* Free-text correction, chat style */}
      <form onSubmit={analyzeCorrection} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Ex. c'était une M1 en fait, pas une Opaline"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "Analyse…" : "Analyser la correction"}
        </button>
        {error && <p className="text-xs text-amber-700">{error}</p>}
      </form>

      {/* Proposal → explicit confirmation before anything is written */}
      {proposal && changes.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Je n&apos;ai pas identifié de changement dans ta phrase. Reformule
          (ex. « c&apos;était une M1 ») ou utilise la modification manuelle.
        </p>
      )}
      {proposal && changes.length > 0 && (
        <form
          action={applyDossierCorrection.bind(null, incidentId)}
          className="mt-2 space-y-2 rounded-md bg-sky-50 p-2"
        >
          <p className="text-xs font-medium text-sky-900">Je vais changer :</p>
          <ul className="space-y-0.5 text-xs text-sky-800">
            {changes.map((c, i) => (
              <li key={i}>
                {c.field} : <span className="line-through">{c.from}</span> →{" "}
                <strong>{c.to}</strong>
              </li>
            ))}
          </ul>
          <input
            type="hidden"
            name="machine_model_id"
            value={
              proposal.machineModel &&
              proposal.machineModel.id !== current.machineModelId
                ? proposal.machineModel.id
                : ""
            }
          />
          <input
            type="hidden"
            name="client_id"
            value={
              proposal.existingClient &&
              proposal.existingClient.id !== current.clientId
                ? proposal.existingClient.id
                : ""
            }
          />
          <input
            type="hidden"
            name="new_client_name"
            value={proposal.existingClient ? "" : proposal.newClientName ?? ""}
          />
          <input
            type="hidden"
            name="new_client_phone"
            value={proposal.clientPhone ?? ""}
          />
          <input
            type="hidden"
            name="machine_id"
            value={
              proposal.existingMachine &&
              proposal.existingMachine.id !== current.machineId
                ? proposal.existingMachine.id
                : ""
            }
          />
          <input
            type="hidden"
            name="new_machine_serial"
            value={proposal.existingMachine ? "" : proposal.newMachineSerial ?? ""}
          />
          <input type="hidden" name="summary" value={summary} />
          <div className="flex gap-1">
            <button className="flex-1 rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-800">
              ✔ Appliquer
            </button>
            <button
              type="button"
              onClick={() => {
                setProposal(null);
                setChanges([]);
              }}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Manual fallback */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-500">
          Modifier manuellement
        </summary>
        <form
          action={applyDossierCorrection.bind(null, incidentId)}
          className="mt-2 space-y-2"
        >
          <label className="block text-xs font-medium text-slate-600">
            Modèle
            <select
              name="machine_model_id"
              defaultValue={current.machineModelId ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Client
            <select
              name="client_id"
              defaultValue={current.clientId ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Machine
            <select
              name="machine_id"
              defaultValue={current.machineId ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button className="w-full rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
            Enregistrer
          </button>
        </form>
      </details>
    </div>
  );
}
