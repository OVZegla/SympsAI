import "server-only";

import { aiConfig } from "@/lib/ai/models";

/**
 * Minimal native Voyage AI client (spec §6). Server-only — VOYAGE_API_KEY must
 * never reach the browser (spec §47). We call the HTTP API directly rather than
 * adding an SDK dependency: two endpoints (embeddings, rerank) are all we need.
 */

const VOYAGE_BASE_URL = "https://api.voyageai.com/v1";

function apiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("Missing VOYAGE_API_KEY.");
  return key;
}

type EmbeddingInputType = "document" | "query";

interface VoyageEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

/**
 * Embed one or more texts. `inputType` lets Voyage optimise document vs query
 * embeddings. Returns vectors aligned to the input order.
 */
export async function embed(
  texts: string[],
  inputType: EmbeddingInputType,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(`${VOYAGE_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: aiConfig.embeddingModel,
      input_type: inputType,
      output_dimension: aiConfig.embeddingDimension,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as VoyageEmbeddingResponse;
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([text], "query");
  if (!vector) throw new Error("Voyage returned no embedding for the query.");
  return vector;
}

interface VoyageRerankResponse {
  data: { index: number; relevance_score: number }[];
}

export interface RerankResult {
  index: number;
  score: number;
}

/**
 * Rerank candidate documents against a query (spec §17 step 7). Returns the
 * candidate indices ordered by relevance, limited to `topK`.
 */
export async function rerank(
  query: string,
  documents: string[],
  topK: number,
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];

  const res = await fetch(`${VOYAGE_BASE_URL}/rerank`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      documents,
      model: aiConfig.rerankModel,
      top_k: topK,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voyage rerank failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as VoyageRerankResponse;
  return json.data.map((d) => ({ index: d.index, score: d.relevance_score }));
}
