"use client";

import { useState } from "react";
import { createIncident } from "@/app/(dashboard)/incidents/actions";
import type { IntakeResult } from "@/lib/incidents/intake";

interface Option {
  id: string;
  name: string;
}

/**
 * Conversational incident intake (spec §15-§16). The technician describes the
 * problem; "Analyser" asks the backend what it understood and what is missing.
 * If the machine model is missing, the user picks it here ("il me le notifie et
 * je lui donne") before the incident is created with the existing action.
 */
export function IncidentIntake({
  models,
  clients,
}: {
  models: Option[];
  clients: Option[];
}) {
  const [description, setDescription] = useState("");
  const [intake, setIntake] = useState<IntakeResult | null>(null);
  const [chosenModelId, setChosenModelId] = useState("");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { intake: IntakeResult };
      setIntake(json.intake);
      setChosenModelId(json.intake.machineModel?.id ?? "");
      setTitle(json.intake.suggestedTitle);
    } catch {
      setError("L'analyse a échoué. Tu peux quand même remplir les champs manuellement.");
    } finally {
      setLoading(false);
    }
  }

  const modelResolved = Boolean(chosenModelId);
  const canCreate = modelResolved && description.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Step 1 — describe */}
      <form onSubmit={analyze}>
        <label className="block text-sm font-medium text-slate-700">
          Décris le problème
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            placeholder="Le client a allumé sa M1. Les commandes BetterPrinter sont grises. Le voyant vert de la carte est éteint."
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-3 rounded-md bg-slate-900 px-5 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Analyse…" : "Analyser le problème"}
        </button>
        {error && <p className="mt-2 text-sm text-amber-700">{error}</p>}
      </form>

      {/* Step 2 — what was understood + what's missing */}
      {intake && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Ce que j&apos;ai compris
            </p>
            <p className="text-sm text-slate-700">
              Machine :{" "}
              {intake.machineModel ? (
                <span className="font-medium">{intake.machineModel.name}</span>
              ) : (
                <span className="text-amber-700">non identifiée</span>
              )}
            </p>
          </div>

          {/* Missing required → ask the user (notify + let them supply it) */}
          {!modelResolved && (
            <div className="rounded-md bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                Il me manque le <strong>modèle de machine</strong>. Précise-le :
              </p>
              <select
                value={chosenModelId}
                onChange={(e) => setChosenModelId(e.target.value)}
                className="mt-2 w-full rounded-md border border-amber-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">— Choisir —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional useful follow-ups from the AI parser */}
          {intake.suggestedQuestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Infos utiles à ajouter (facultatif)
              </p>
              <ul className="list-disc pl-5 text-sm text-slate-600">
                {intake.suggestedQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-slate-400">
                Ajoute-les dans la description ci-dessus si tu les as ; sinon
                l&apos;assistant te les redemandera dans l&apos;incident.
              </p>
            </div>
          )}

          {/* Step 3 — create with the existing server action */}
          <form action={createIncident} className="space-y-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="machine_model_id" value={chosenModelId} />

            <label className="block text-sm font-medium text-slate-700">
              Titre
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Client (facultatif)
              <select
                name="client_id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={!canCreate}
              className="rounded-md bg-green-700 px-5 py-2 font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Créer l&apos;incident
            </button>
            {!canCreate && (
              <p className="text-xs text-slate-400">
                Renseigne le modèle de machine pour créer l&apos;incident.
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
