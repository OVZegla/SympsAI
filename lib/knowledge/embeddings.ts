import "server-only";

import { getEmbeddingService } from "@/lib/embeddings/service";
import type { EmbeddingMetadata } from "@/lib/embeddings/types";

/**
 * Knowledge-layer adapter over the generic embedding service. The ingestion and
 * incident-indexing pipelines call these helpers; they never touch a provider
 * directly (the app depends on the abstraction, not on Ollama).
 */

/** Format a vector as the "[0.1,0.2,...]" literal pgvector accepts. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/** Provenance for the current embedding configuration. */
export function embeddingMetadata(): EmbeddingMetadata {
  return getEmbeddingService().getMetadata();
}

/**
 * Embed document/knowledge chunks in batches. Throws on failure — callers must
 * not mark chunks as embedded when this rejects (they stay retriable).
 */
export function embedChunks(
  contents: string[],
  onBatch?: (done: number, total: number) => void,
): Promise<number[][]> {
  return getEmbeddingService().embedDocuments(contents, onBatch);
}

/**
 * The column fragment written next to a chunk's embedding so the provider/model/
 * dimension that produced it are recorded (prevents mixing vectors from
 * different models in one index).
 */
export function embeddingColumns(vector: number[], meta: EmbeddingMetadata) {
  return {
    embedding: toVectorLiteral(vector),
    embedding_provider: meta.provider,
    embedding_model: meta.model,
    embedding_dimension: meta.dimension,
    embedded_at: new Date().toISOString(),
  };
}
