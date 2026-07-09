import "server-only";

import { getLLMService } from "@/lib/ai/llm/service";
import { loadPrompt, PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { parsedQuerySchema, type ParsedQuery } from "@/lib/ai/schemas";

/**
 * Turn a free-text problem description into the structured analysis (spec §16),
 * before retrieval. Runs on the "fast" task lane (local Ollama by default;
 * Claude if configured). On failure the caller falls back to using the raw text
 * as the search query, so a parser hiccup never blocks the assistant.
 */
const PARSED_QUERY_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    intent: { type: "string" },
    machine_model: { type: ["string", "null"] },
    machine_id: { type: ["string", "null"] },
    subsystem: { type: ["string", "null"] },
    components: { type: "array", items: { type: "string" } },
    symptoms: {
      type: "array",
      items: {
        type: "object",
        properties: { raw: { type: "string" }, normalized: { type: "string" } },
        required: ["raw", "normalized"],
      },
    },
    actions_already_done: { type: "array", items: { type: "string" } },
    error_codes: { type: "array", items: { type: "string" } },
    safety_risk: { type: "string", enum: ["normal", "elevated", "dangerous"] },
    missing_information: { type: "array", items: { type: "string" } },
  },
  required: [
    "intent",
    "machine_model",
    "machine_id",
    "subsystem",
    "components",
    "symptoms",
    "actions_already_done",
    "error_codes",
    "safety_risk",
    "missing_information",
  ],
};

export async function parseQuery(text: string): Promise<{
  value: ParsedQuery;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
  promptVersion: string;
}> {
  const system = await loadPrompt(PROMPT_VERSIONS.queryParser);
  const result = await getLLMService().run("fast", {
    system,
    userText: text,
    toolName: "record_analysis",
    toolDescription: "Record the structured analysis of the technician's description.",
    jsonSchema: PARSED_QUERY_INPUT_SCHEMA,
    schema: parsedQuerySchema,
    maxTokens: 1024,
  });

  return { ...result, promptVersion: PROMPT_VERSIONS.queryParser };
}

/** Build the keyword/semantic search query from a parsed analysis. */
export function searchQueryFromParsed(parsed: ParsedQuery, fallback: string): string {
  const parts = [
    ...parsed.symptoms.map((s) => s.normalized),
    ...parsed.components,
    parsed.subsystem ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : fallback;
}
