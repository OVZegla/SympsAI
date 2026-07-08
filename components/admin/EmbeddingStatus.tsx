import { getEmbeddingService } from "@/lib/embeddings/service";

/**
 * Embedding provider status for the admin screen (brief §HEALTH CHECK). Shows a
 * simple Connected/Error state with the provider, model and dimension — no
 * complex admin UI, just the health check rendered.
 */
export async function EmbeddingStatus() {
  const service = getEmbeddingService();
  const health = await service.healthCheck();
  const connected = health.status === "connected";

  return (
    <div className="max-w-md rounded-lg border border-slate-200 bg-white p-5 text-sm">
      <h2 className="mb-3 font-semibold text-slate-900">Fournisseur d&apos;embeddings</h2>
      <dl className="space-y-1">
        <Row label="Provider" value={health.provider} />
        <Row label="Model" value={health.model} />
        <Row
          label="Status"
          value={
            <span className={connected ? "text-green-700" : "text-red-700"}>
              {connected ? "Connecté" : "Erreur"}
            </span>
          }
        />
        <Row label="Dimension" value={String(health.expectedDimension)} />
        {!connected && health.error && (
          <Row label="Détail" value={<span className="text-red-600">{health.error}</span>} />
        )}
      </dl>
      {!connected && (
        <p className="mt-3 text-xs text-slate-500">
          Vérifie qu&apos;Ollama tourne et que le modèle est installé :
          <code className="ml-1">ollama pull embeddinggemma</code>
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
