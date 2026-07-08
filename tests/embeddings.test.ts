import { describe, it, expect } from "vitest";
import { OllamaEmbeddingProvider } from "@/lib/embeddings/ollama-provider";
import { createEmbeddingService } from "@/lib/embeddings/service";
import {
  getEmbeddingConfig,
  validateVector,
  assertCompatibleMetadata,
} from "@/lib/embeddings/validation";
import { EmbeddingError } from "@/lib/embeddings/types";

const DIM = 768;

function vec(n = DIM): number[] {
  return Array.from({ length: n }, () => 0.01);
}

/** Build a minimal fetch that returns the given JSON body. */
function jsonFetch(body: unknown, init: { ok?: boolean; status?: number } = {}): typeof fetch {
  return (async () =>
    ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response) as unknown as typeof fetch;
}

function provider(fetchImpl: typeof fetch): OllamaEmbeddingProvider {
  return new OllamaEmbeddingProvider({
    baseUrl: "http://127.0.0.1:11434",
    model: "embeddinggemma",
    dimension: DIM,
    fetchImpl,
  });
}

describe("OllamaEmbeddingProvider", () => {
  it("(1) embeds a single text", async () => {
    const p = provider(jsonFetch({ embeddings: [vec()] }));
    const out = await p.embedText("hello");
    expect(out).toHaveLength(DIM);
  });

  it("(2) embeds a batch of texts", async () => {
    const p = provider(jsonFetch({ embeddings: [vec(), vec(), vec()] }));
    const out = await p.embedTexts(["a", "b", "c"]);
    expect(out).toHaveLength(3);
    expect(out[0]).toHaveLength(DIM);
  });

  it("(3) throws a clear error when Ollama is unreachable", async () => {
    const failing = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const p = provider(failing);
    await expect(p.embedText("x")).rejects.toThrowError(/not reachable at http:\/\/127\.0\.0\.1:11434/);
  });

  it("(4) throws a pull hint when the model is missing (404)", async () => {
    const p = provider(jsonFetch({ error: "model not found" }, { ok: false, status: 404 }));
    await expect(p.embedText("x")).rejects.toThrowError(/ollama pull embeddinggemma/);
  });

  it("(5) throws when the response has no embeddings", async () => {
    const p = provider(jsonFetch({ embeddings: [] }));
    await expect(p.embedTexts(["a"])).rejects.toBeInstanceOf(EmbeddingError);
  });

  it("(6) throws on a wrong vector dimension", async () => {
    const p = provider(jsonFetch({ embeddings: [vec(512)] }));
    await expect(p.embedText("x")).rejects.toThrowError(/dimension mismatch: expected 768, got 512/);
  });

  it("reports its provider, model and dimension", () => {
    const p = provider(jsonFetch({ embeddings: [vec()] }));
    expect(p.getProviderName()).toBe("ollama");
    expect(p.getModelName()).toBe("embeddinggemma");
    expect(p.getDimension()).toBe(DIM);
  });
});

describe("EmbeddingService", () => {
  it("(7) batches document embedding across multiple requests", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      // Each call embeds up to batchSize=2 → the service must call twice for 3 texts.
      return {
        ok: true,
        status: 200,
        json: async () => ({ embeddings: [vec(), vec()] }),
        text: async () => "",
      } as unknown as Response;
    }) as unknown as typeof fetch;

    // Provider returns 2 vectors per call; give it exactly batch-sized inputs.
    const p = new OllamaEmbeddingProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "embeddinggemma",
      dimension: DIM,
      fetchImpl,
    });
    const service = createEmbeddingService(p, 2);
    const out = await service.embedDocuments(["a", "b", "c", "d"]);
    expect(out).toHaveLength(4);
    expect(calls).toBe(2); // two batches of two
  });

  it("(8) embeds a query", async () => {
    const p = provider(jsonFetch({ embeddings: [vec()] }));
    const service = createEmbeddingService(p, 32);
    const out = await service.embedQuery("betterprinter grisé");
    expect(out).toHaveLength(DIM);
  });

  it("(9) health check confirms the 768-dimensional vector", async () => {
    const p = provider(jsonFetch({ embeddings: [vec()] }));
    const service = createEmbeddingService(p, 32);
    const health = await service.healthCheck();
    expect(health.status).toBe("connected");
    expect(health.observedDimension).toBe(768);
    expect(health.model).toBe("embeddinggemma");
  });

  it("health check reports an error state when unreachable", async () => {
    const failing = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    const service = createEmbeddingService(provider(failing), 32);
    const health = await service.healthCheck();
    expect(health.status).toBe("error");
    expect(health.error).toMatch(/not reachable/);
  });
});

describe("validation", () => {
  it("defaults to ollama / embeddinggemma / 768", () => {
    const config = getEmbeddingConfig({});
    expect(config.provider).toBe("ollama");
    expect(config.model).toBe("embeddinggemma");
    expect(config.dimension).toBe(768);
    expect(config.ollamaBaseUrl).toBe("http://127.0.0.1:11434");
    expect(config.batchSize).toBe(32);
  });

  it("does not require a Voyage (or any embedding) API key", () => {
    // No VOYAGE_API_KEY in env → config still resolves.
    const config = getEmbeddingConfig({ EMBEDDING_PROVIDER: "ollama" });
    expect(config.provider).toBe("ollama");
  });

  it("validateVector rejects empty / mismatched / non-numeric vectors", () => {
    expect(() => validateVector([], 768)).toThrow(EmbeddingError);
    expect(() => validateVector(vec(512), 768)).toThrow(/mismatch/);
    expect(() => validateVector([1, 2, "x"] as unknown[], 3)).toThrow(/non-numeric/);
    expect(validateVector(vec(), 768)).toHaveLength(768);
  });

  it("(10) prevents mixing incompatible embedding models", () => {
    const current = { provider: "ollama", model: "embeddinggemma", dimension: 768 };
    // Same config: OK.
    expect(() => assertCompatibleMetadata(current, current)).not.toThrow();
    // Old Voyage vectors: must be rejected.
    expect(() =>
      assertCompatibleMetadata(
        { provider: "voyage", model: "voyage-4", dimension: 1024 },
        current,
      ),
    ).toThrow(/Incompatible embeddings/);
    // Same provider/dim but different model: still rejected.
    expect(() =>
      assertCompatibleMetadata(
        { provider: "ollama", model: "nomic-embed-text", dimension: 768 },
        current,
      ),
    ).toThrow(/Incompatible/);
  });
});
