/**
 * LLM configuration + provider routing. Kept separate from the providers so the
 * rules are unit-testable and enforced in one place.
 *
 * Defaults to the LOCAL Ollama provider so the app runs free and offline out of
 * the box — you can list and diagnose incidents with no API key. Add
 * ANTHROPIC_API_KEY and set LLM_PROVIDER=anthropic (or just
 * LLM_DIAGNOSIS_PROVIDER=anthropic for a hybrid setup) to use Claude.
 */

/** The three call sites, each mapped to a model per provider. */
export type LLMTaskKind = "fast" | "primary" | "vision";
export type LLMProviderName = "ollama" | "anthropic";

export interface LLMConfig {
  /** Provider used for everything unless a per-task override applies. */
  provider: LLMProviderName;
  /** Optional override for the main diagnosis (enables a hybrid local+Claude setup). */
  diagnosisProvider: LLMProviderName | null;
  ollamaBaseUrl: string;
  ollama: { model: string; fastModel: string; visionModel: string };
  timeoutMs: number;
}

const DEFAULTS = {
  provider: "ollama" as LLMProviderName,
  ollamaBaseUrl: "http://127.0.0.1:11434",
  model: "qwen2.5",
  fastModel: "qwen2.5",
  visionModel: "llama3.2-vision",
  timeoutMs: 120_000,
};

function parseProvider(value: string | undefined): LLMProviderName | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return v === "ollama" || v === "anthropic" ? v : null;
}

export function getLLMConfig(env: Record<string, string | undefined> = process.env): LLMConfig {
  const provider = parseProvider(env.LLM_PROVIDER) ?? DEFAULTS.provider;
  const diagnosisProvider = parseProvider(env.LLM_DIAGNOSIS_PROVIDER);
  const timeout = env.LLM_TIMEOUT_MS ? Number(env.LLM_TIMEOUT_MS) : DEFAULTS.timeoutMs;

  return {
    provider,
    diagnosisProvider,
    ollamaBaseUrl: (env.OLLAMA_BASE_URL || DEFAULTS.ollamaBaseUrl).trim(),
    ollama: {
      model: (env.OLLAMA_LLM_MODEL || DEFAULTS.model).trim(),
      fastModel: (env.OLLAMA_LLM_FAST_MODEL || env.OLLAMA_LLM_MODEL || DEFAULTS.fastModel).trim(),
      visionModel: (env.OLLAMA_VISION_MODEL || DEFAULTS.visionModel).trim(),
    },
    timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : DEFAULTS.timeoutMs,
  };
}

/** Which provider handles a given task (diagnosis can be overridden for hybrid). */
export function providerForKind(kind: LLMTaskKind, config: LLMConfig): LLMProviderName {
  if (kind === "primary" && config.diagnosisProvider) return config.diagnosisProvider;
  return config.provider;
}

/** The Ollama model for a task kind. */
export function ollamaModelForKind(kind: LLMTaskKind, config: LLMConfig): string {
  if (kind === "fast") return config.ollama.fastModel;
  if (kind === "vision") return config.ollama.visionModel;
  return config.ollama.model;
}
