import "server-only";

import { rerank } from "@/lib/voyage/client";
import type { Hit } from "@/lib/rag/types";

/**
 * Rerank a candidate set with Voyage (spec §17 step 7): 30 candidates → top N.
 * Best-effort — if reranking fails we keep the fused order rather than losing
 * the results. Reranking is a relevance refinement; source-authority ordering
 * (spec §19) is applied afterwards by the context builder, not here.
 */
export async function rerankHits<T extends Hit>(
  query: string,
  hits: T[],
  topN: number,
): Promise<T[]> {
  if (hits.length <= 1) return hits.slice(0, topN);

  try {
    const results = await rerank(
      query,
      hits.map((h) => h.content),
      topN,
    );
    return results
      .map((r) => hits[r.index])
      .filter((h): h is T => Boolean(h));
  } catch (err) {
    console.error("[rag] rerank failed, keeping fused order:", (err as Error).message);
    return hits.slice(0, topN);
  }
}
