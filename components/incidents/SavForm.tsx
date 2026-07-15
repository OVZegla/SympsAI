"use client";

import { useMemo, useState } from "react";
import { SAV_FIELDS } from "@/lib/reports/sav";
import { saveSav } from "@/app/(dashboard)/incidents/[id]/sav/actions";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900";

/**
 * Fiche SAV / Intervention (formulaire officiel Symp's). Pré-remplie depuis le
 * dossier ; les champs requis encore vides sont posés comme questions par
 * l'assistant. « Imprimer » produit la fiche propre (avec les lignes de
 * signature) via une mise en page dédiée à l'impression.
 */
export function SavForm({
  incidentId,
  incidentNumber,
  initialFields,
}: {
  incidentId: string;
  incidentNumber: string;
  initialFields: Record<string, string>;
}) {
  const [fields, setFields] = useState<Record<string, string>>(initialFields);
  const [saved, setSaved] = useState(false);

  const set = (id: string, value: string) => {
    setSaved(false);
    setFields((f) => ({ ...f, [id]: value }));
  };

  // Questions vivantes : recalculées à mesure que le technicien remplit.
  const missingQuestions = useMemo(
    () =>
      SAV_FIELDS.filter(
        (f) =>
          ["date", "client_name", "machine_model", "serial_number", "technician", "problem_description"].includes(
            f.id,
          ) && !fields[f.id]?.trim(),
      ).map((f) => f.question),
    [fields],
  );

  const headerFields = SAV_FIELDS.filter((f) => !f.multiline);
  const sectionFields = SAV_FIELDS.filter((f) => f.multiline);

  async function onSave(formData: FormData) {
    await saveSav(incidentId, formData);
    setSaved(true);
  }

  return (
    <>
      {/* ---- Écran : formulaire éditable ---- */}
      <div className="print:hidden">
        {missingQuestions.length > 0 && (
          <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3">
            <p className="text-sm font-medium text-sky-900">
              Pour compléter la fiche, il me manque :
            </p>
            <ul className="mt-1 list-disc pl-5 text-sm text-sky-800">
              {missingQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        <form action={onSave} className="space-y-5">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
            {headerFields.map((f) => (
              <label key={f.id} className="block text-sm font-medium text-slate-700">
                {f.label}
                <input
                  name={f.id}
                  value={fields[f.id] ?? ""}
                  onChange={(e) => set(f.id, e.target.value)}
                  placeholder={f.question}
                  className={
                    inputClass +
                    (!fields[f.id]?.trim() &&
                    ["date", "client_name", "machine_model", "serial_number", "technician"].includes(f.id)
                      ? " border-amber-400 bg-amber-50"
                      : "")
                  }
                />
              </label>
            ))}
          </div>

          {sectionFields.map((f) => (
            <label
              key={f.id}
              className="block rounded-lg border border-slate-200 bg-white p-5 text-sm font-medium text-slate-700"
            >
              {f.label}
              <textarea
                name={f.id}
                value={fields[f.id] ?? ""}
                onChange={(e) => set(f.id, e.target.value)}
                rows={4}
                placeholder={f.question}
                className={inputClass}
              />
            </label>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800">
              💾 Enregistrer la fiche
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              🖨️ Imprimer / PDF
            </button>
            {saved && <span className="text-sm text-green-700">✅ Fiche enregistrée.</span>}
          </div>
          <p className="text-xs text-slate-400">
            Astuce : « Imprimer / PDF » ouvre l&apos;impression du navigateur —
            choisis « Enregistrer au format PDF » pour envoyer la fiche, ou
            imprime-la pour la faire signer.
          </p>
        </form>
      </div>

      {/* ---- Impression : fiche propre, fidèle au formulaire officiel ---- */}
      <div className="hidden print:block">
        <h1 className="text-center text-lg font-bold">
          FICHE SAV / INTERVENTION MACHINE
        </h1>
        <p className="mb-4 text-center text-xs">{incidentNumber}</p>

        <div className="mb-4 space-y-1 text-sm">
          {headerFields.map((f) => (
            <p key={f.id}>
              <strong>{f.label} :</strong> {fields[f.id]?.trim() || "________________"}
            </p>
          ))}
        </div>

        {sectionFields.map((f) => (
          <div key={f.id} className="mb-3 break-inside-avoid">
            <p className="text-sm font-bold">{f.label}</p>
            <div className="min-h-16 whitespace-pre-wrap border border-slate-400 p-2 text-sm">
              {fields[f.id]?.trim() || ""}
            </div>
          </div>
        ))}

        <div className="mt-8 flex justify-between text-sm">
          <p>Signature du client : ______________________</p>
          <p>Signature du technicien : ___________________</p>
        </div>
      </div>
    </>
  );
}
