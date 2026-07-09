import type { z } from "zod";

/**
 * LLM provider abstraction. The app depends on this interface, not on a concrete
 * backend, so the reasoning model can be a local Ollama model (free, offline) or
 * Anthropic Claude — switched by environment variable (see config.ts). This
 * mirrors the EmbeddingProvider abstraction in lib/embeddings/.
 */

/** An image passed to a vision-capable model (base64, no data: prefix). */
export interface LLMImage {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

/** A request for a schema-validated structured generation. */
export interface StructuredRequest<T> {
  model: string;
  system: string;
  userText: string;
  images?: LLMImage[];
  /** Name/description of the structured output (Anthropic forced-tool; hint for Ollama). */
  toolName: string;
  toolDescription: string;
  /** JSON Schema describing the required output shape. */
  jsonSchema: Record<string, unknown>;
  /** Zod schema the result is validated against before the app trusts it. */
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface StructuredResult<T> {
  value: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
}

export interface LLMHealth {
  provider: string;
  model: string;
  status: "connected" | "error";
  error?: string;
}

export interface LLMProvider {
  getProviderName(): string;
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  healthCheck(model: string): Promise<LLMHealth>;
}

/** Raised for any LLM failure so callers react explicitly (never silent). */
export class LLMError extends Error {
  readonly detail?: unknown;
  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "LLMError";
    this.detail = detail;
  }
}
