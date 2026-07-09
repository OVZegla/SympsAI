import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  getLLMConfig,
  providerForKind,
  ollamaModelForKind,
} from "@/lib/ai/llm/config";
import { OllamaLLMProvider } from "@/lib/ai/llm/ollama-provider";
import { LLMError } from "@/lib/ai/llm/types";

const schema = z.object({ answer: z.string(), score: z.number() });
const JSON_SCHEMA = {
  type: "object",
  properties: { answer: { type: "string" }, score: { type: "number" } },
  required: ["answer", "score"],
};

function baseRequest() {
  return {
    model: "qwen2.5",
    system: "Tu es un assistant.",
    userText: "Réponds.",
    toolName: "answer",
    toolDescription: "Répond de façon structurée.",
    jsonSchema: JSON_SCHEMA,
    schema,
  };
}

/** Fetch stub returning the given payload as the Ollama /api/chat response. */
function chatFetch(
  payload: unknown,
  init: { ok?: boolean; status?: number } = {},
  capture?: { body?: unknown },
): typeof fetch {
  return (async (_url: unknown, options?: RequestInit) => {
    if (capture && options?.body) capture.body = JSON.parse(String(options.body));
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function provider(fetchImpl: typeof fetch): OllamaLLMProvider {
  return new OllamaLLMProvider({ baseUrl: "http://127.0.0.1:11434", fetchImpl });
}

describe("LLM config (free by default)", () => {
  it("defaults to the local Ollama provider — no API key required", () => {
    const config = getLLMConfig({});
    expect(config.provider).toBe("ollama");
    expect(config.diagnosisProvider).toBeNull();
    expect(config.ollama.model).toBe("qwen2.5");
    expect(config.ollama.visionModel).toBe("llama3.2-vision");
    expect(config.ollamaBaseUrl).toBe("http://127.0.0.1:11434");
  });

  it("routes everything to anthropic when LLM_PROVIDER=anthropic", () => {
    const config = getLLMConfig({ LLM_PROVIDER: "anthropic" });
    expect(providerForKind("fast", config)).toBe("anthropic");
    expect(providerForKind("primary", config)).toBe("anthropic");
    expect(providerForKind("vision", config)).toBe("anthropic");
  });

  it("hybrid: LLM_DIAGNOSIS_PROVIDER routes only the diagnosis to Claude", () => {
    const config = getLLMConfig({ LLM_DIAGNOSIS_PROVIDER: "anthropic" });
    expect(providerForKind("fast", config)).toBe("ollama");
    expect(providerForKind("primary", config)).toBe("anthropic");
    expect(providerForKind("vision", config)).toBe("ollama");
  });

  it("ignores unknown provider values and keeps the free default", () => {
    const config = getLLMConfig({ LLM_PROVIDER: "openai" });
    expect(config.provider).toBe("ollama");
  });

  it("maps task kinds to the configured Ollama models", () => {
    const config = getLLMConfig({
      OLLAMA_LLM_MODEL: "mistral",
      OLLAMA_LLM_FAST_MODEL: "qwen2.5:3b",
      OLLAMA_VISION_MODEL: "llava",
    });
    expect(ollamaModelForKind("primary", config)).toBe("mistral");
    expect(ollamaModelForKind("fast", config)).toBe("qwen2.5:3b");
    expect(ollamaModelForKind("vision", config)).toBe("llava");
  });
});

describe("OllamaLLMProvider", () => {
  it("returns a schema-validated structured result", async () => {
    const p = provider(
      chatFetch({
        message: { content: JSON.stringify({ answer: "ok", score: 0.9 }) },
        prompt_eval_count: 120,
        eval_count: 30,
      }),
    );
    const result = await p.generateStructured(baseRequest());
    expect(result.value).toEqual({ answer: "ok", score: 0.9 });
    expect(result.provider).toBe("ollama");
    expect(result.model).toBe("qwen2.5");
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(30);
  });

  it("constrains generation with the JSON schema and passes images", async () => {
    const capture: { body?: unknown } = {};
    const p = provider(
      chatFetch(
        { message: { content: JSON.stringify({ answer: "ok", score: 1 }) } },
        {},
        capture,
      ),
    );
    await p.generateStructured({
      ...baseRequest(),
      images: [{ base64: "aGVsbG8=", mediaType: "image/png" }],
    });
    const body = capture.body as {
      format: unknown;
      messages: { role: string; images?: string[] }[];
    };
    expect(body.format).toEqual(JSON_SCHEMA); // structured output constraint
    expect(body.messages[1]!.images).toEqual(["aGVsbG8="]); // vision input
  });

  it("throws a clear error when Ollama is unreachable", async () => {
    const failing = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(provider(failing).generateStructured(baseRequest())).rejects.toThrowError(
      /not reachable at http:\/\/127\.0\.0\.1:11434/,
    );
  });

  it("throws a pull hint when the model is missing", async () => {
    const p = provider(chatFetch({ error: "model not found" }, { ok: false, status: 404 }));
    await expect(p.generateStructured(baseRequest())).rejects.toThrowError(
      /ollama pull qwen2\.5/,
    );
  });

  it("rejects non-JSON model output instead of trusting it", async () => {
    const p = provider(chatFetch({ message: { content: "je pense que…" } }));
    await expect(p.generateStructured(baseRequest())).rejects.toBeInstanceOf(LLMError);
  });

  it("rejects JSON that fails Zod validation (spec §36)", async () => {
    const p = provider(
      chatFetch({ message: { content: JSON.stringify({ answer: 42 }) } }),
    );
    await expect(p.generateStructured(baseRequest())).rejects.toThrowError(
      /schema validation/,
    );
  });

  it("health check reports connected when the model is installed", async () => {
    const p = provider(chatFetch({ models: [{ name: "qwen2.5:latest" }] }));
    const health = await p.healthCheck("qwen2.5");
    expect(health.status).toBe("connected");
  });

  it("health check reports a pull hint when the model is absent", async () => {
    const p = provider(chatFetch({ models: [{ name: "embeddinggemma:latest" }] }));
    const health = await p.healthCheck("qwen2.5");
    expect(health.status).toBe("error");
    expect(health.error).toMatch(/ollama pull qwen2\.5/);
  });
});
