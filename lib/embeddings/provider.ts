// Server-side only (see ollama-provider.ts). Reached through server-only app
// modules or Node scripts; never from a client component.
import { EmbeddingError, type EmbeddingProvider } from "@/lib/embeddings/types";
import { getEmbeddingConfig, type EmbeddingConfig } from "@/lib/embeddings/validation";
import { OllamaEmbeddingProvider } from "@/lib/embeddings/ollama-provider";

/**
 * Factory that builds the configured EmbeddingProvider. The default (and only
 * shipped) provider is Ollama/embeddinggemma. Adding another backend later means
 * adding a case here — the rest of the app stays untouched.
 */
export function createEmbeddingProvider(
  config: EmbeddingConfig = getEmbeddingConfig(),
): EmbeddingProvider {
  switch (config.provider) {
    case "ollama":
      return new OllamaEmbeddingProvider({
        baseUrl: config.ollamaBaseUrl,
        model: config.model,
        dimension: config.dimension,
        timeoutMs: config.timeoutMs,
      });
    default:
      throw new EmbeddingError(
        `Unknown EMBEDDING_PROVIDER "${config.provider}". Supported: "ollama".`,
      );
  }
}
