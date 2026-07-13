"use client";

import { useState } from "react";
import { createIncident } from "@/app/(dashboard)/incidents/actions";
import type { IntakeResult } from "@/lib/incidents/intake";

interface Option {
  id: string;
  name: string;
}

export interface MachineOption {
  id: string;
  label: string;
  machineModelId: string;
  clientId: string | null;
}

const NEW = "__new";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900";

/**
 * Conversational incident intake (spec §15-§16, §25-§26). The technician
 * describes the problem ("c'est Dupont qui a un problème avec sa M1 n° 12345");
 * "Analyser" asks the backend what it understood: machine model, client and
 * machine are matched against the base, unknown ones are pre-filled as "to
 * create", and the assistant's follow-up questions ("quel est le numéro de
 * téléphone du client ?") become editable fields. Everything is created in one
 * click — the explicit confirmation required for writes (spec §24).
 */
export function IncidentIntake({
  models,
  clients,
  machines,
}: {
  models: Option[];
  clients: Option[];
  machines: MachineOption[];
}) {
  const [description, setDescription] = useState("");
  const [intake, setIntake] = useState<IntakeResult | null>(null);
  const [title, setTitle] = useState("");
  const [chosenModelId, setChosenModelId] = useState("");
  // "" = none, an id = existing record, NEW = create a new one.
  const [clientChoice, setClientChoice] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [machineChoice, setMachineChoice] = useState("");
  const [newMachineSerial, setNewMachineSerial] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selecting an existing machine auto-fills its model and client.
  function onMachineChange(choice: string) {
    setMachineChoice(choice);
    const m = machines.find((x) => x.id === choice);
    if (m) {
      setChosenModelId(m.machineModelId);
      if (m.clientId) setClientChoice(m.clientId);
    }
  }

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
      const r = json.intake;
      setIntake(r);
      setTitle(r.suggestedTitle);
      setChosenModelId(r.machineModel?.id ?? "");
      if (r.existingClient) {
        setClientChoice(r.existingClient.id);
      } else if (r.newClientName) {
        setClientChoice(NEW);
        setNewClientName(r.newClientName);
        setNewClientPhone(r.clientPhone ?? "");
      } else {
        setClientChoice("");
      }
      if (r.existingMachine) {
        setMachineChoice(r.existingMachine.id);
      } else if (r.newMachineSerial) {
        setMachineChoice(NEW);
        setNewMachineSerial(r.newMachineSerial);
      } else {
        setMachineChoice("");
      }
    } catch {
      setError("L'analyse a échoué. Tu peux quand même remplir les champs manuellement.");
    } finally {
      setLoading(false);
    }
  }

  const modelResolved = Boolean(chosenModelId);
  const canCreate = modelResolved && description.trim().length > 0;
  const existingMachineChosen = machineChoice !== "" && machineChoice !== NEW;
  const existingClientChosen = clientChoice !== "" && clientChoice !== NEW;

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
            placeholder="C'est Dupont qui a un problème avec sa M1 n° 4521 : les commandes BetterPrinter sont grises, le voyant vert de la carte est éteint."
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

      {/* Step 2 — the dossier: what was understood + questions to complete it */}
      {intake && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Ce que j&apos;ai compris
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
              <li>
                Machine :{" "}
                {intake.machineModel ? (
                  <span className="font-medium">{intake.machineModel.name}</span>
                ) : (
                  <span className="text-amber-700">non identifiée</span>
                )}
              </li>
              <li>
                Client :{" "}
                {intake.existingClient ? (
                  <span className="font-medium">
                    {intake.existingClient.name}{" "}
                    <span className="text-xs text-slate-400">(déjà connu)</span>
                  </span>
                ) : intake.newClientName ? (
                  <span className="font-medium">
                    {intake.newClientName}{" "}
                    <span className="text-xs text-green-700">
                      (nouveau — sera créé)
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">non identifié</span>
                )}
              </li>
              <li>
                N° de série :{" "}
                {intake.existingMachine?.serialNumber ? (
                  <span className="font-medium">
                    {intake.existingMachine.serialNumber}{" "}
                    <span className="text-xs text-slate-400">
                      (machine déjà connue)
                    </span>
                  </span>
                ) : intake.newMachineSerial ? (
                  <span className="font-medium">
                    {intake.newMachineSerial}{" "}
                    <span className="text-xs text-green-700">
                      (nouvelle machine — sera créée)
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">non précisé</span>
                )}
              </li>
            </ul>
          </div>

          {/* The assistant's questions to complete the dossier */}
          {intake.dossierQuestions.length > 0 && (
            <div className="rounded-md bg-sky-50 p-3">
              <p className="text-sm font-medium text-sky-900">
                Pour compléter le dossier :
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-sky-800">
                {intake.dossierQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-sky-700">
                Réponds directement dans les champs ci-dessous.
              </p>
            </div>
          )}

          {/* Missing required → ask the user (notify + let them supply it) */}
          {!modelResolved && (
            <div className="rounded-md bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                Il me manque le <strong>modèle de machine</strong>. Choisis-le
                dans le champ « Modèle de machine » ci-dessous.
              </p>
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

          {/* Step 3 — confirm & create everything in one click */}
          <form action={createIncident} className="space-y-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="description" value={description} />
            <input
              type="hidden"
              name="machine_id"
              value={existingMachineChosen ? machineChoice : ""}
            />
            <input
              type="hidden"
              name="client_id"
              value={existingClientChosen ? clientChoice : ""}
            />

            <label className="block text-sm font-medium text-slate-700">
              Titre
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Modèle de machine *
              <select
                name="machine_model_id"
                value={chosenModelId}
                onChange={(e) => setChosenModelId(e.target.value)}
                className={inputClass}
              >
                <option value="">— Choisir —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Client
              <select
                value={clientChoice}
                onChange={(e) => setClientChoice(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW}>➕ Nouveau client…</option>
              </select>
            </label>

            {clientChoice === NEW && (
              <div className="grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Nom du client *
                  <input
                    name="new_client_name"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Quel est le nom du client ?"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Téléphone
                  <input
                    name="new_client_phone"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className={inputClass}
                    placeholder="Quel est son numéro de tel ?"
                  />
                </label>
              </div>
            )}

            <label className="block text-sm font-medium text-slate-700">
              Machine
              <select
                value={machineChoice}
                onChange={(e) => onMachineChange(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                <option value={NEW}>➕ Nouvelle machine…</option>
              </select>
            </label>

            {machineChoice === NEW && (
              <div className="rounded-md bg-slate-50 p-3">
                <label className="block text-sm font-medium text-slate-700">
                  N° de série de la machine
                  <input
                    name="new_machine_serial"
                    value={newMachineSerial}
                    onChange={(e) => setNewMachineSerial(e.target.value)}
                    className={inputClass}
                    placeholder="Quel est le numéro de la machine ?"
                  />
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  La machine sera créée avec le modèle choisi et rattachée au client.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canCreate}
              className="rounded-md bg-green-700 px-5 py-2 font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Créer l&apos;incident
              {clientChoice === NEW || machineChoice === NEW
                ? " (+ fiches client/machine)"
                : ""}
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
