// Server-side only: reached exclusively through server-only app modules
// (lib/knowledge/*, lib/rag/*) or standalone Node scripts. Never import from a
// client component — the browser talks to the app, the app talks to Ollama.
import { EmbeddingError, type EmbeddingProvider } from "@/lib/embeddings/types";
import { validateVector } from "@/lib/embeddings/validation";

export interface OllamaProviderOptions {
  baseUrl: string;
  model: string;
  dimension: number;
  timeoutMs?: number;
  /** Injectable fetch, for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface OllamaEmbedResponse {
  model?: string;
  embeddings?: number[][];
  error?: string;
}

/**
 * Local Ollama embedding provider (default implementation). Talks to the Ollama
 * HTTP API at POST {baseUrl}/api/embed with { model, input } and hides every
 * transport detail behind the EmbeddingProvider interface.
 *
 * Server-only: Ollama is reached from the backend, never from the browser
 * (the browser talks to the app, the app talks to Ollama).
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimension: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
    this.dimension = options.dimension;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getDimension(): number {
    return this.dimension;
  }
  getProviderName(): string {
    return "ollama";
  }
  getModelName(): string {
    return this.model;
  }

  async embedText(text: string): Promise<number[]> {
    const [vector] = await this.embedTexts([text]);
    if (!vector) {
      throw new EmbeddingError("Ollama returned no embedding for the input text.");
    }
    return vector;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const url = `${this.baseUrl}/api/embed`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: controller.signal,
      });
    } catch (err) {
      // Network-level failure: connection refused, DNS, timeout/abort.
      throw new EmbeddingError(`Ollama is not reachable at ${this.baseUrl}`, err);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 404 || /not found|try pulling|no such model/i.test(body)) {
        throw new EmbeddingError(
          `The ${this.model} model is not available. Run: ollama pull ${this.model}`,
        );
      }
      throw new EmbeddingError(`Ollama request failed (HTTP ${res.status}).`);
    }

    let json: OllamaEmbedResponse;
    try {
      json = (await res.json()) as OllamaEmbedResponse;
    } catch (err) {
      throw new EmbeddingError("Ollama returned an invalid JSON response.", err);
    }

    if (json.error) {
      if (/not found|try pulling|no such model/i.test(json.error)) {
        throw new EmbeddingError(
          `The ${this.model} model is not available. Run: ollama pull ${this.model}`,
        );
      }
      throw new EmbeddingError(`Ollama error: ${json.error}`);
    }

    if (!Array.isArray(json.embeddings) || json.embeddings.length !== texts.length) {
      throw new EmbeddingError(
        `Ollama returned ${json.embeddings?.length ?? 0} embeddings for ${texts.length} inputs.`,
      );
    }

    // Validate each vector's dimension before it can reach pgvector.
    return json.embeddings.map((vector) => validateVector(vector, this.dimension));
  }
}
