import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/ai/anthropic";
import {
  LLMError,
  type LLMHealth,
  type LLMProvider,
  type StructuredRequest,
  type StructuredResult,
} from "@/lib/ai/llm/types";

/**
 * Anthropic (Claude) LLM provider — the optional, paid, higher-quality backend.
 * Uses the native "forced tool" pattern for schema-constrained output (spec
 * §16, §36): one tool whose input schema is the required shape, tool_choice
 * forced. The result is validated with Zod before the app trusts it.
 *
 * Only constructed when LLM_PROVIDER / LLM_DIAGNOSIS_PROVIDER selects it, so
 * the app runs entirely without an ANTHROPIC_API_KEY by default.
 */
export class AnthropicLLMProvider implements LLMProvider {
  getProviderName(): string {
    return "anthropic";
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const client = getAnthropic();

    const content: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] = [
      ...(req.images ?? []).map(
        (image): Anthropic.ImageBlockParam => ({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mediaType,
            data: image.base64,
          },
        }),
      ),
      { type: "text", text: req.userText },
    ];

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        messages: [{ role: "user", content }],
        tools: [
          {
            name: req.toolName,
            description: req.toolDescription,
            input_schema: req.jsonSchema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: req.toolName },
      });
    } catch (err) {
      throw new LLMError(
        `Anthropic request failed: ${(err as Error).message}`,
        err,
      );
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      throw new LLMError("Model did not return the expected structured tool call.");
    }

    const parsed = req.schema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new LLMError(
        `Structured output failed schema validation: ${parsed.error.message}`,
      );
    }

    return {
      value: parsed.data,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: req.model,
      provider: "anthropic",
    };
  }

  /** Config-level check: the API key must be present (no paid call is made). */
  async healthCheck(model: string): Promise<LLMHealth> {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        provider: "anthropic",
        model,
        status: "error",
        error: "ANTHROPIC_API_KEY manquante (ajoute-la dans .env.local).",
      };
    }
    return { provider: "anthropic", model, status: "connected" };
  }
}
