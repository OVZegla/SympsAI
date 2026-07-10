import type { TestRunStatus } from "@/lib/types/database";
import { proposeTestRun, recordTestResult } from "@/app/(dashboard)/incidents/[id]/test-actions";

export interface TestRunItem {
  id: string;
  status: TestRunStatus;
  result_notes: string | null;
  diagnostic_tests: { title: string; code: string | null } | null;
}

export interface AvailableTest {
  id: string;
  code: string | null;
  title: string;
}

const STATUS_LABEL: Record<TestRunStatus, string> = {
  proposed: "Proposé",
  in_progress: "En cours",
  passed: "✅ Réussi",
  failed: "❌ Échoué",
  inconclusive: "❓ Inconclusif",
  not_applicable: "➖ Non applicable",
  cancelled: "Annulé",
};

// The structured result buttons (spec §22).
const RESULT_CHOICES: { value: TestRunStatus; label: string }[] = [
  { value: "passed", label: "✅ Réussi" },
  { value: "failed", label: "❌ Échoué" },
  { value: "inconclusive", label: "❓ Inconclusif" },
  { value: "not_applicable", label: "➖ N/A" },
];

export function TestRunsPanel({
  incidentId,
  runs,
  availableTests,
}: {
  incidentId: string;
  runs: TestRunItem[];
  availableTests: AvailableTest[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Tests de diagnostic
      </p>

      <ul className="space-y-3">
        {runs.map((run) => (
          <li key={run.id} className="rounded-md border border-slate-200 p-2">
            <p className="text-sm font-medium text-slate-800">
              {run.diagnostic_tests?.title ?? run.result_notes ?? "Test"}
            </p>
            <p className="text-xs text-slate-500">{STATUS_LABEL[run.status]}</p>

            {(run.status === "proposed" || run.status === "in_progress") && (
              <form
                action={recordTestResult.bind(null, incidentId, run.id)}
                className="mt-2 space-y-2"
              >
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Explique le résultat (ex. le multimètre indique 0 V, le voyant reste éteint…)"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  Choisis le résultat (l&apos;explication est enregistrée avec) :
                </p>
                <div className="flex flex-wrap gap-1">
                  {RESULT_CHOICES.map((c) => (
                    <button
                      key={c.value}
                      name="status"
                      value={c.value}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </form>
            )}
          </li>
        ))}
        {runs.length === 0 && (
          <li className="text-xs text-slate-400">Aucun test enregistré.</li>
        )}
      </ul>

      {availableTests.length > 0 && (
        <form
          action={proposeTestRun.bind(null, incidentId)}
          className="mt-3 space-y-2 border-t border-slate-100 pt-3"
        >
          <select
            name="diagnostic_test_id"
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            defaultValue=""
          >
            <option value="">Ajouter un test du catalogue…</option>
            {availableTests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code ? `${t.code} — ` : ""}
                {t.title}
              </option>
            ))}
          </select>
          <button className="w-full rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
            Proposer ce test
          </button>
        </form>
      )}
    </div>
  );
}
