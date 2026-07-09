import "server-only";

import { getEmbeddingConfig } from "@/lib/embeddings/validation";
import { getLLMConfig, providerForKind, ollamaModelForKind } from "@/lib/ai/llm/config";

/**
 * Lightweight service-status checks for the dashboard/admin — one fast
 * GET /api/tags call (2s timeout), no inference, no cost. Deep checks (real
 * embedding probe) live in the admin EmbeddingStatus component.
 */
export interface ServiceStatus {
  label: string;
  ok: boolean;
  detail: string;
}

async function ollamaTags(baseUrl: string): Promise<string[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as { models?: { name?: string }[] };
    return (json.models ?? []).map((m) => m.name ?? "");
  } catch {
    return null;
  }
}

function hasModel(tags: string[], model: string): boolean {
  return tags.some((n) => n === model || n.split(":")[0] === model);
}

export async function getServiceStatuses(): Promise<ServiceStatus[]> {
  const embedding = getEmbeddingConfig();
  const llm = getLLMConfig();
  const statuses: ServiceStatus[] = [];

  const tags = await ollamaTags(llm.ollamaBaseUrl);

  // Semantic search (embeddings — always local).
  if (tags === null) {
    statuses.push({
      label: "Recherche sémantique",
      ok: false,
      detail: "Ollama injoignable — la recherche par mots-clés reste disponible",
    });
  } else if (!hasModel(tags, embedding.model)) {
    statuses.push({
      label: "Recherche sémantique",
      ok: false,
      detail: `ollama pull ${embedding.model}`,
    });
  } else {
    statuses.push({ label: "Recherche sémantique", ok: true, detail: embedding.model });
  }

  // Assistant (diagnosis lane).
  const diagProvider = providerForKind("primary", llm);
  if (diagProvider === "anthropic") {
    const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
    statuses.push({
      label: "Assistant IA",
      ok: hasKey,
      detail: hasKey ? "Claude (clé configurée)" : "ANTHROPIC_API_KEY manquante",
    });
  } else {
    const model = ollamaModelForKind("primary", llm);
    if (tags === null) {
      statuses.push({ label: "Assistant IA", ok: false, detail: "Ollama injoignable" });
    } else if (!hasModel(tags, model)) {
      statuses.push({ label: "Assistant IA", ok: false, detail: `ollama pull ${model}` });
    } else {
      statuses.push({ label: "Assistant IA", ok: true, detail: `${model} (local, gratuit)` });
    }
  }

  return statuses;
}
