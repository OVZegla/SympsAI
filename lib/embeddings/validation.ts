import { EmbeddingError, type EmbeddingMetadata } from "@/lib/embeddings/types";

/**
 * Embedding environment configuration + validation. Kept separate from the
 * provider so the config rules are unit-testable and enforced in one place.
 *
 * Requirements (per the migration brief):
 *   - EMBEDDING_PROVIDER (default "ollama")
 *   - EMBEDDING_MODEL (default "embeddinggemma")
 *   - EMBEDDING_DIMENSION (default 768)
 *   - OLLAMA_BASE_URL required when provider is "ollama" (default local URL)
 *   - EMBEDDING_BATCH_SIZE (default 32)
 * No embedding API key is required.
 */
export interface EmbeddingConfig {
  provider: string;
  model: string;
  dimension: number;
  ollamaBaseUrl: string;
  batchSize: number;
  timeoutMs: number;
}

const DEFAULTS = {
  provider: "ollama",
  model: "embeddinggemma",
  dimension: 768,
  ollamaBaseUrl: "http://127.0.0.1:11434",
  batchSize: 32,
  timeoutMs: 30_000,
} as const;

export function getEmbeddingConfig(
  env: Record<string, string | undefined> = process.env,
): EmbeddingConfig {
  const provider = (env.EMBEDDING_PROVIDER || DEFAULTS.provider).trim();
  const model = (env.EMBEDDING_MODEL || DEFAULTS.model).trim();

  const dimension = env.EMBEDDING_DIMENSION
    ? Number(env.EMBEDDING_DIMENSION)
    : DEFAULTS.dimension;
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new EmbeddingError(
      `EMBEDDING_DIMENSION must be a positive integer (got "${env.EMBEDDING_DIMENSION}").`,
    );
  }

  const batchSize = env.EMBEDDING_BATCH_SIZE
    ? Number(env.EMBEDDING_BATCH_SIZE)
    : DEFAULTS.batchSize;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new EmbeddingError(
      `EMBEDDING_BATCH_SIZE must be a positive integer (got "${env.EMBEDDING_BATCH_SIZE}").`,
    );
  }

  const ollamaBaseUrl = (env.OLLAMA_BASE_URL || DEFAULTS.ollamaBaseUrl).trim();
  if (provider === "ollama" && !ollamaBaseUrl) {
    throw new EmbeddingError("OLLAMA_BASE_URL is required when EMBEDDING_PROVIDER=ollama.");
  }

  const timeoutMs = env.EMBEDDING_TIMEOUT_MS
    ? Number(env.EMBEDDING_TIMEOUT_MS)
    : DEFAULTS.timeoutMs;

  return {
    provider,
    model,
    dimension,
    ollamaBaseUrl,
    batchSize,
    timeoutMs: Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULTS.timeoutMs,
  };
}

/**
 * Validate a single embedding vector against the expected dimension.
 * Throws an EmbeddingError rather than letting a malformed vector reach the DB.
 */
export function validateVector(vector: unknown, expectedDimension: number): number[] {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new EmbeddingError("Embedding provider returned an empty vector.");
  }
  if (vector.length !== expectedDimension) {
    throw new EmbeddingError(
      `Embedding dimension mismatch: expected ${expectedDimension}, got ${vector.length}. ` +
        "The configured EMBEDDING_DIMENSION does not match the model's output.",
    );
  }
  if (!vector.every((v) => typeof v === "number" && Number.isFinite(v))) {
    throw new EmbeddingError("Embedding vector contains non-numeric values.");
  }
  return vector as number[];
}

/**
 * Guard against mixing vectors from different providers/models/dimensions in a
 * single semantic index (the brief's "prevent incompatible embedding model
 * mixing"). Throws if stored metadata is incompatible with the current config.
 */
export function assertCompatibleMetadata(
  stored: EmbeddingMetadata,
  current: EmbeddingMetadata,
): void {
  if (
    stored.provider !== current.provider ||
    stored.model !== current.model ||
    stored.dimension !== current.dimension
  ) {
    throw new EmbeddingError(
      `Incompatible embeddings: stored ${stored.provider}/${stored.model}/${stored.dimension} ` +
        `but current config is ${current.provider}/${current.model}/${current.dimension}. ` +
        "Re-index with `npm run embeddings:reindex` before searching.",
    );
  }
}
