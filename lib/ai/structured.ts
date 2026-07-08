import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropic } from "@/lib/ai/anthropic";

/**
 * Get a schema-validated structured result from Claude using the native
 * "forced tool" pattern (spec §16, §36): we expose a single tool whose input
 * schema is the shape we want, and force the model to call it. The tool input
 * is then validated with Zod before the app trusts it.
 *
 * Returns the parsed value plus token usage so the caller can record ai_runs.
 */
export interface StructuredResult<T> {
  value: T;
  inputTokens: number;
  outputTokens: number;
}

export async function generateStructured<T>(params: {
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  toolName: string;
  toolDescription: string;
  inputSchema: Anthropic.Tool.InputSchema;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<StructuredResult<T>> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 2048,
    system: params.system,
    messages: params.messages,
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.inputSchema,
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Model did not return the expected structured tool call.");
  }

  const parsed = params.schema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Structured output failed schema validation: ${parsed.error.message}`);
  }

  return {
    value: parsed.data,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
