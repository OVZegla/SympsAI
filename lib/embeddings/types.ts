/**
 * Embedding provider abstraction. The rest of the application depends on this
 * interface — never on a concrete provider's HTTP details. Swapping the local
 * Ollama provider for another backend later means implementing this interface
 * and changing the factory (lib/embeddings/provider.ts), nothing else.
 */
export interface EmbeddingProvider {
  /** Embed a single text into one vector. */
  embedText(text: string): Promise<number[]>;
  /** Embed several texts in one call when the backend supports it. */
  embedTexts(texts: string[]): Promise<number[][]>;
  /** Expected vector dimension for this provider/model. */
  getDimension(): number;
  /** Stable provider id, e.g. "ollama". */
  getProviderName(): string;
  /** Model id, e.g. "embeddinggemma". */
  getModelName(): string;
}

/**
 * Provenance stored alongside every vector so vectors from different
 * providers/models/dimensions can never be silently mixed in one index.
 */
export interface EmbeddingMetadata {
  provider: string;
  model: string;
  dimension: number;
}

export interface EmbeddingHealth {
  provider: string;
  model: string;
  expectedDimension: number;
  status: "connected" | "error";
  /** Dimension actually returned by a probe embedding, when reachable. */
  observedDimension?: number;
  error?: string;
}

/** Raised for any embedding failure so callers can react explicitly. */
export class EmbeddingError extends Error {
  readonly detail?: unknown;
  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "EmbeddingError";
    this.detail = detail;
  }
}
