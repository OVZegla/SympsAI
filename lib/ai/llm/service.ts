import "server-only";

import { aiConfig } from "@/lib/ai/models";
import {
  getLLMConfig,
  ollamaModelForKind,
  providerForKind,
  type LLMConfig,
  type LLMProviderName,
  type LLMTaskKind,
} from "@/lib/ai/llm/config";
import { OllamaLLMProvider } from "@/lib/ai/llm/ollama-provider";
import { AnthropicLLMProvider } from "@/lib/ai/llm/anthropic-provider";
import type {
  LLMHealth,
  LLMProvider,
  StructuredRequest,
  StructuredResult,
} from "@/lib/ai/llm/types";

/**
 * The single LLM entry point for the app. Call sites declare a task kind
 * ("fast" = query parsing, "primary" = diagnosis, "vision" = image analysis);
 * the service routes it to the configured provider and model. Default is the
 * local Ollama provider — free, offline, no API key. Setting
 * LLM_PROVIDER=anthropic (or LLM_DIAGNOSIS_PROVIDER=anthropic for hybrid)
 * routes to Claude instead.
 */
export class LLMService {
  private readonly providers = new Map<LLMProviderName, LLMProvider>();

  constructor(private readonly config: LLMConfig) {}

  private provider(name: LLMProviderName): LLMProvider {
    let provider = this.providers.get(name);
    if (!provider) {
      provider =
        name === "anthropic"
          ? new AnthropicLLMProvider()
          : new OllamaLLMProvider({
              baseUrl: this.config.ollamaBaseUrl,
              timeoutMs: this.config.timeoutMs,
            });
      this.providers.set(name, provider);
    }
    return provider;
  }

  private modelFor(kind: LLMTaskKind, providerName: LLMProviderName): string {
    if (providerName === "ollama") return ollamaModelForKind(kind, this.config);
    // Anthropic model ids come from env (never hard-coded — spec §55).
    return kind === "fast" ? aiConfig.fastModel : aiConfig.primaryModel;
  }

  /** Run a schema-validated structured generation for a task kind. */
  async run<T>(
    kind: LLMTaskKind,
    req: Omit<StructuredRequest<T>, "model">,
  ): Promise<StructuredResult<T>> {
    const providerName = providerForKind(kind, this.config);
    const provider = this.provider(providerName);
    const model = this.modelFor(kind, providerName);
    return provider.generateStructured({ ...req, model });
  }

  /** Health of the provider/model that would handle a task kind. */
  async healthCheck(kind: LLMTaskKind): Promise<LLMHealth> {
    const providerName = providerForKind(kind, this.config);
    const provider = this.provider(providerName);
    return provider.healthCheck(this.modelFor(kind, providerName));
  }

  getConfig(): LLMConfig {
    return this.config;
  }
}

let singleton: LLMService | null = null;

export function getLLMService(config: LLMConfig = getLLMConfig()): LLMService {
  if (!singleton) singleton = new LLMService(config);
  return singleton;
}
