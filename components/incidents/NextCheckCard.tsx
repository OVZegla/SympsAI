import { recordGuidedTestResult } from "@/app/(dashboard)/incidents/[id]/test-actions";
import { LIKELIHOOD_LABEL_FR, type EngineResult } from "@/lib/diagnosis/engine";
import type { TestRunStatus } from "@/lib/types/database";

const SAFETY_BADGE = {
  SAFE: { label: "🟢 Sûr", cls: "bg-green-100 text-green-800" },
  CAUTION: { label: "🟠 Prudence", cls: "bg-amber-100 text-amber-800" },
  STOP_MACHINE: { label: "🔴 Machine éteinte", cls: "bg-red-100 text-red-800" },
} as const;

// Résultats en un clic (§15) mappés sur les statuts de test existants.
const RESULT_BUTTONS: { value: TestRunStatus; label: string }[] = [
  { value: "passed", label: "✅ Fonctionne" },
  { value: "failed", label: "❌ Ne fonctionne pas" },
  { value: "inconclusive", label: "🤔 Partiellement / autre" },
  { value: "not_applicable", label: "🚫 Non vérifiable" },
];

/**
 * Carte « Prochaine vérification » (§15) pilotée par le moteur déterministe :
 * action, raison, sécurité, durée, interprétation des résultats — et des
 * boutons qui enregistrent le résultat en un clic. 100 % sans LLM : ça marche
 * même quand Ollama est éteint, et le moteur intègre le résultat au tour
 * suivant (jamais deux fois le même test).
 */
export function NextCheckCard({
  incidentId,
  engine,
}: {
  incidentId: string;
  engine: EngineResult;
}) {
  const next = engine.nextTests[0];

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
        🎯 Prochaine vérification
      </p>

      {/* Comportement normal détecté → le dire AVANT de proposer des tests. */}
      {engine.normalBehaviors.length > 0 && (
        <div className="mb-2 rounded-md bg-white p-2">
          <p className="text-xs font-medium text-green-800">
            💡 Pas forcément une panne :
          </p>
          {engine.normalBehaviors.map((nb) => (
            <p key={nb.id} className="mt-1 text-xs text-slate-600">
              {nb.statement}
              {nb.abnormalCounterpart && (
                <span className="text-slate-400"> {nb.abnormalCounterpart}</span>
              )}
            </p>
          ))}
        </div>
      )}

      {next ? (
        <div className="rounded-md bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">{next.test.name}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${SAFETY_BADGE[next.test.safetyLevel].cls}`}
            >
              {SAFETY_BADGE[next.test.safetyLevel].label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">{next.reason}</p>
          {next.test.estimatedDuration && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              ⏱ ~{next.test.estimatedDuration}
            </p>
          )}
          <ol className="mt-2 list-decimal pl-4 text-xs text-slate-700">
            {next.test.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <div className="mt-2 space-y-0.5">
            {next.test.expectedResults.map((r, i) => (
              <p key={i} className="text-[11px] text-slate-500">
                <span className="font-medium">{r.result}</span> → {r.meaning}
              </p>
            ))}
          </div>

          <form
            action={recordGuidedTestResult.bind(null, incidentId, next.test.name)}
            className="mt-3 space-y-1.5 border-t border-slate-100 pt-2"
          >
            <input
              name="notes"
              placeholder="Détail du résultat (facultatif)"
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <div className="grid grid-cols-2 gap-1">
              {RESULT_BUTTONS.map((b) => (
                <button
                  key={b.value}
                  name="status"
                  value={b.value}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] hover:bg-slate-100"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </form>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {engine.matchedRules.length === 0
            ? "Décris les symptômes dans le chat : le moteur proposera la première vérification adaptée."
            : "Toutes les vérifications recommandées ont été réalisées — demande à l'assistant la suite."}
        </p>
      )}

      {engine.cautions.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {engine.cautions.map((c, i) => (
            <li key={i} className="text-[11px] text-amber-800">
              ⚠️ {c}
            </li>
          ))}
        </ul>
      )}

      {/* Vue du raisonnement technique (§15) : faits retenus, hypothèses, pour/contre. */}
      {engine.hypotheses.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-sky-800">
            Voir le raisonnement ({engine.hypotheses.length} hypothèses)
          </summary>
          <ul className="mt-2 space-y-2">
            {engine.hypotheses.map((h) => (
              <li key={h.id} className="rounded-md bg-white p-2">
                <p className="text-xs font-medium text-slate-800">
                  {h.label}{" "}
                  <span className="font-normal text-slate-400">
                    — {LIKELIHOOD_LABEL_FR[h.likelihood]}
                  </span>
                </p>
                {h.supportingEvidence.map((e, i) => (
                  <p key={`s${i}`} className="text-[11px] text-green-700">
                    + {e}
                  </p>
                ))}
                {h.contradictingEvidence.map((e, i) => (
                  <p key={`c${i}`} className="text-[11px] text-red-700">
                    − {e}
                  </p>
                ))}
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {h.sourceRefs.join(" ; ")}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
