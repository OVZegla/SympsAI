import type { DiagnosticResponse } from "@/lib/ai/schemas";
import { SupportBadge } from "@/components/ui/SupportBadge";

/**
 * Renders the model's structured diagnostic response (spec §20, §36, §43). The
 * model returns JSON; the UI owns the presentation, so the model never controls
 * the rendered output directly.
 */
export function DiagnosticView({ data }: { data: DiagnosticResponse }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Assistant
        </span>
        <SupportBadge level={data.support_level} />
      </div>

      {data.confirmed_facts.length > 0 && (
        <Block title="Ce que nous savons">
          <ul className="list-disc pl-5 text-slate-700">
            {data.confirmed_facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Block>
      )}

      {data.similar_cases.length > 0 && (
        <Block title="Cas similaires">
          <ul className="space-y-1 text-slate-700">
            {data.similar_cases.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.incident_number}</span>{" "}
                <span className="text-xs text-slate-400">({c.similarity})</span>
                {c.note ? ` — ${c.note}` : ""}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {data.hypotheses.length > 0 && (
        <Block title="Hypothèses">
          <div className="space-y-2">
            {data.hypotheses.map((h, i) => (
              <div key={i} className="rounded-md border border-slate-200 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{h.title}</span>
                  <SupportBadge level={h.support_level} />
                </div>
                {h.reasons.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                    {h.reasons.map((r, j) => (
                      <li key={j}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {data.recommended_action && (
        <Block title="Prochain test recommandé">
          <p className="font-medium text-slate-800">{data.recommended_action.title}</p>
          <p className="text-slate-600">{data.recommended_action.reason}</p>
          {data.recommended_action.procedure_id && (
            <p className="mt-1 text-xs text-slate-500">
              📄 {data.recommended_action.procedure_id}
            </p>
          )}
        </Block>
      )}

      {data.questions.length > 0 && (
        <Block title="Informations manquantes">
          <ul className="list-disc pl-5 text-slate-700">
            {data.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Block>
      )}

      {data.sources.length > 0 && (
        <Block title="Sources utilisées">
          <ul className="space-y-1">
            {data.sources.map((s, i) => (
              <li key={i} className="text-xs text-slate-600">
                {s.kind === "incident" ? "🔧" : "📄"}{" "}
                <span className="font-medium">{s.ref}</span> — {s.label}
                {s.location ? ` (${s.location})` : ""}
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}
