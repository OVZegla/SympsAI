// Server-side only (see ollama-provider.ts). The single embedding entry point
// for the app; reached through server-only modules or Node scripts.
import {
  EmbeddingError,
  type EmbeddingHealth,
  type EmbeddingMetadata,
  type EmbeddingProvider,
} from "@/lib/embeddings/types";
import { getEmbeddingConfig, type EmbeddingConfig } from "@/lib/embeddings/validation";
import { createEmbeddingProvider } from "@/lib/embeddings/provider";

/**
 * The single embedding entry point for the whole application. Ingestion,
 * incident indexing and query-time search all go through this service and never
 * touch a provider's transport details. It adds batching, provenance metadata
 * and a health check on top of the raw provider.
 */
export class EmbeddingService {
  constructor(
    private readonly provider: EmbeddingProvider,
    private readonly batchSize: number,
  ) {}

  getMetadata(): EmbeddingMetadata {
    return {
      provider: this.provider.getProviderName(),
      model: this.provider.getModelName(),
      dimension: this.provider.getDimension(),
    };
  }

  /** Embed a single search query (spec §17: same model as the documents). */
  async embedQuery(text: string): Promise<number[]> {
    return this.provider.embedText(text);
  }

  /**
   * Embed many document chunks, in batches, to avoid sending the whole knowledge
   * base in one request. A batch failure throws — callers must NOT mark those
   * chunks as embedded (they stay retriable via the reindex script).
   */
  async embedDocuments(
    texts: string[],
    onBatch?: (done: number, total: number) => void,
  ): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchVectors = await this.provider.embedTexts(batch);
      vectors.push(...batchVectors);
      onBatch?.(Math.min(i + this.batchSize, texts.length), texts.length);
    }
    return vectors;
  }

  /**
   * Health check (brief §HEALTH CHECK): verify the provider is reachable, the
   * model responds, and the returned vector has the expected dimension.
   */
  async healthCheck(): Promise<EmbeddingHealth> {
    const meta = this.getMetadata();
    try {
      const probe = await this.provider.embedText("ping");
      const observedDimension = probe.length;
      if (observedDimension !== meta.dimension) {
        return {
          provider: meta.provider,
          model: meta.model,
          expectedDimension: meta.dimension,
          observedDimension,
          status: "error",
          error: `Model returned dimension ${observedDimension}, expected ${meta.dimension}.`,
        };
      }
      return {
        provider: meta.provider,
        model: meta.model,
        expectedDimension: meta.dimension,
        observedDimension,
        status: "connected",
      };
    } catch (err) {
      return {
        provider: meta.provider,
        model: meta.model,
        expectedDimension: meta.dimension,
        status: "error",
        error: err instanceof EmbeddingError ? err.message : "Unknown embedding error.",
      };
    }
  }
}

let singleton: EmbeddingService | null = null;

/** Shared service using the environment configuration. */
export function getEmbeddingService(config: EmbeddingConfig = getEmbeddingConfig()): EmbeddingService {
  if (!singleton) {
    singleton = new EmbeddingService(createEmbeddingProvider(config), config.batchSize);
  }
  return singleton;
}

/** Build a service around an explicit provider (used by tests and scripts). */
export function createEmbeddingService(
  provider: EmbeddingProvider,
  batchSize = 32,
): EmbeddingService {
  return new EmbeddingService(provider, batchSize);
}
