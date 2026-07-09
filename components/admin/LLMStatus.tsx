import { getLLMService } from "@/lib/ai/llm/service";

/**
 * LLM provider status for the admin screen. Shows which backend handles each
 * task lane (parsing / diagnosis / vision) and whether it is usable — the
 * default is fully local (Ollama), so this also documents that no API key is
 * needed.
 */
export async function LLMStatus() {
  const service = getLLMService();
  const [fast, primary, vision] = await Promise.all([
    service.healthCheck("fast"),
    service.healthCheck("primary"),
    service.healthCheck("vision"),
  ]);

  const rows = [
    { label: "Analyse de la demande", health: fast },
    { label: "Diagnostic", health: primary },
    { label: "Analyse d'images", health: vision },
  ];

  return (
    <div className="max-w-md rounded-lg border border-slate-200 bg-white p-5 text-sm">
      <h2 className="mb-3 font-semibold text-slate-900">Assistant IA</h2>
      <ul className="space-y-2">
        {rows.map(({ label, health }) => (
          <li key={label} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-slate-700">{label}</p>
              <p className="text-xs text-slate-400">
                {health.provider === "ollama" ? "local (gratuit)" : "Claude (API)"} ·{" "}
                {health.model}
              </p>
            </div>
            {health.status === "connected" ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                OK
              </span>
            ) : (
              <span
                className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                title={health.error}
              >
                Erreur
              </span>
            )}
          </li>
        ))}
      </ul>
      {rows.some((r) => r.health.status === "error") && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {rows
            .filter((r) => r.health.status === "error")
            .map((r) => (
              <p key={r.label} className="text-xs text-red-600">
                {r.label} : {r.health.error}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
