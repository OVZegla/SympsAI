import "server-only";

import { aiConfig } from "@/lib/ai/models";
import { generateStructured } from "@/lib/ai/structured";
import { loadPrompt, PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { parsedQuerySchema, type ParsedQuery } from "@/lib/ai/schemas";

/**
 * Turn a free-text problem description into the structured analysis (spec §16),
 * before retrieval. Uses the fast model. On failure the caller falls back to
 * using the raw text as the search query, so a parser hiccup never blocks the
 * assistant.
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
  promptVersion: string;
}> {
  const system = await loadPrompt(PROMPT_VERSIONS.queryParser);
  const result = await generateStructured({
    model: aiConfig.fastModel,
    system,
    messages: [{ role: "user", content: text }],
    toolName: "record_analysis",
    toolDescription: "Record the structured analysis of the technician's description.",
    inputSchema: PARSED_QUERY_INPUT_SCHEMA,
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
