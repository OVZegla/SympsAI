// Server-side only: reached exclusively through server-only app modules
// (lib/ai/*) or Node scripts. The browser talks to the app, the app talks to
// Ollama — OLLAMA_BASE_URL is never exposed to the client.
import {
  LLMError,
  type LLMHealth,
  type LLMProvider,
  type StructuredRequest,
  type StructuredResult,
} from "@/lib/ai/llm/types";

export interface OllamaLLMOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** Injectable fetch, for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

interface OllamaTagsResponse {
  models?: { name?: string }[];
}

/**
 * Local Ollama LLM provider (free, offline — the default). Uses POST
 * {baseUrl}/api/chat with the `format` parameter set to the required JSON
 * schema, so the model is constrained to produce parseable structured output.
 * The result is still validated with Zod before the app trusts it (spec §36).
 */
export class OllamaLLMProvider implements LLMProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaLLMOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getProviderName(): string {
    return "ollama";
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const url = `${this.baseUrl}/api/chat`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const body = {
      model: req.model,
      stream: false,
      // Constrain the output to the JSON schema (Ollama structured outputs).
      format: req.jsonSchema,
      options: { num_predict: req.maxTokens ?? 2048 },
      messages: [
        {
          role: "system",
          content:
            `${req.system}\n\n` +
            `Réponds UNIQUEMENT avec un objet JSON valide conforme au schéma demandé ` +
            `(${req.toolName} : ${req.toolDescription}).`,
        },
        {
          role: "user",
          content: req.userText,
          ...(req.images && req.images.length > 0
            ? { images: req.images.map((i) => i.base64) }
            : {}),
        },
      ],
    };

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new LLMError(`Ollama is not reachable at ${this.baseUrl}`, err);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 404 || /not found|try pulling|no such model/i.test(detail)) {
        throw new LLMError(
          `The ${req.model} model is not available. Run: ollama pull ${req.model}`,
        );
      }
      throw new LLMError(`Ollama request failed (HTTP ${res.status}).`);
    }

    let json: OllamaChatResponse;
    try {
      json = (await res.json()) as OllamaChatResponse;
    } catch (err) {
      throw new LLMError("Ollama returned an invalid JSON response.", err);
    }

    if (json.error) {
      if (/not found|try pulling|no such model/i.test(json.error)) {
        throw new LLMError(
          `The ${req.model} model is not available. Run: ollama pull ${req.model}`,
        );
      }
      throw new LLMError(`Ollama error: ${json.error}`);
    }

    const content = json.message?.content;
    if (!content) {
      throw new LLMError("Ollama returned an empty response.");
    }

    let value: unknown;
    try {
      value = JSON.parse(content);
    } catch (err) {
      throw new LLMError("The local model did not produce valid JSON output.", err);
    }

    const parsed = req.schema.safeParse(value);
    if (!parsed.success) {
      throw new LLMError(
        `Structured output failed schema validation: ${parsed.error.message}`,
      );
    }

    return {
      value: parsed.data,
      inputTokens: json.prompt_eval_count ?? 0,
      outputTokens: json.eval_count ?? 0,
      model: req.model,
      provider: "ollama",
    };
  }

  /** Cheap health check: Ollama reachable + model installed (no inference). */
  async healthCheck(model: string): Promise<LLMHealth> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_000);
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.baseUrl}/api/tags`, {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        return {
          provider: "ollama",
          model,
          status: "error",
          error: `Ollama responded with HTTP ${res.status}.`,
        };
      }
      const json = (await res.json()) as OllamaTagsResponse;
      const names = (json.models ?? []).map((m) => m.name ?? "");
      const installed = names.some(
        (n) => n === model || n.split(":")[0] === model,
      );
      if (!installed) {
        return {
          provider: "ollama",
          model,
          status: "error",
          error: `The ${model} model is not available. Run: ollama pull ${model}`,
        };
      }
      return { provider: "ollama", model, status: "connected" };
    } catch {
      return {
        provider: "ollama",
        model,
        status: "error",
        error: `Ollama is not reachable at ${this.baseUrl}`,
      };
    }
  }
}
