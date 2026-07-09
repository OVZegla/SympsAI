import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLLMService } from "@/lib/ai/llm/service";
import { loadPrompt, PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { parseQuery, searchQueryFromParsed } from "@/lib/ai/query-parser";
import { diagnosticResponseSchema, type DiagnosticResponse } from "@/lib/ai/schemas";
import { buildEvidenceDossier } from "@/lib/rag/context-builder";
import { formatEvidence, evidenceCount } from "@/lib/ai/context-format";

/**
 * The Phase 4 assistant (spec §58, §20, §36). Pipeline:
 *   1. parse the query into a structured analysis (spec §16);
 *   2. run retrieval → evidence dossier (Phase 3, kept separate by source);
 *   3. ask the configured LLM (local Ollama by default; Claude if selected)
 *      for a schema-validated diagnostic response grounded on the dossier,
 *      citing sources (spec §20, §43);
 *   4. persist the assistant message, retrieval_runs and ai_runs (spec §48).
 *
 * Retrieval is done in code and passed as attributed context, so the model
 * cannot invent procedures/incidents (spec §35 interdictions). The read-tools
 * in lib/ai/tools.ts remain available for a future agentic loop.
 */

// JSON schema mirroring diagnosticResponseSchema (lib/ai/schemas.ts).
const DIAGNOSIS_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    state: {
      type: "string",
      enum: [
        "needs_information",
        "diagnostic_plan",
        "waiting_test_result",
        "probable_cause",
        "resolution_proposed",
        "ready_to_close",
        "insufficient_evidence",
      ],
    },
    confirmed_facts: { type: "array", items: { type: "string" } },
    similar_cases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          incident_number: { type: "string" },
          similarity: {
            type: "string",
            enum: ["very_similar", "partially_similar", "loosely_related"],
          },
          note: { type: "string" },
        },
        required: ["incident_number", "similarity"],
      },
    },
    hypotheses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          support_level: { type: "string", enum: ["none", "low", "moderate", "high"] },
          reasons: { type: "array", items: { type: "string" } },
          evidence_ids: { type: "array", items: { type: "string" } },
        },
        required: ["title", "support_level", "reasons", "evidence_ids"],
      },
    },
    recommended_action: {
      type: ["object", "null"],
      properties: {
        title: { type: "string" },
        reason: { type: "string" },
        test_id: { type: ["string", "null"] },
        procedure_id: { type: ["string", "null"] },
        risk_level: { type: "string", enum: ["low", "normal", "high"] },
      },
      required: ["title", "reason", "test_id", "procedure_id", "risk_level"],
    },
    questions: { type: "array", items: { type: "string" } },
    support_level: { type: "string", enum: ["none", "low", "moderate", "high"] },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["procedure", "document", "incident", "note"] },
          ref: { type: "string" },
          label: { type: "string" },
          location: { type: "string" },
        },
        required: ["kind", "ref", "label"],
      },
    },
  },
  required: [
    "state",
    "confirmed_facts",
    "similar_cases",
    "hypotheses",
    "recommended_action",
    "questions",
    "support_level",
    "sources",
  ],
};

export interface DiagnoseParams {
  incidentId: string;
  machineModelId: string | null;
  /** The technician's latest message / problem description. */
  query: string;
}

export interface DiagnoseResult {
  response: DiagnosticResponse;
  messageId: string | null;
}

export async function runDiagnosis(
  supabase: SupabaseClient,
  params: DiagnoseParams,
): Promise<DiagnoseResult> {
  const startedAt = Date.now();
  const { incidentId, machineModelId, query } = params;

  // 1. Parse the query (best-effort).
  let searchQuery = query;
  let parseTokensIn = 0;
  let parseTokensOut = 0;
  try {
    const parsed = await parseQuery(query);
    parseTokensIn = parsed.inputTokens;
    parseTokensOut = parsed.outputTokens;
    searchQuery = searchQueryFromParsed(parsed.value, query);
  } catch (err) {
    console.error("[diagnosis] query parse failed, using raw text:", (err as Error).message);
  }

  // 2. Retrieval → evidence dossier.
  const dossier = await buildEvidenceDossier(supabase, searchQuery, { machineModelId });

  // Persist the retrieval run for observability (spec §48).
  await supabase.from("retrieval_runs").insert({
    incident_id: incidentId,
    user_query: query,
    parsed_query_json: { searchQuery },
    filters_json: { machineModelId },
    retrieved_documents_json: [...dossier.procedures, ...dossier.documentation],
    retrieved_incidents_json: [...dossier.resolvedIncidents, ...dossier.openIncidents],
  });

  // 3. Ask the configured model (local Ollama by default, Claude if selected)
  //    for the structured diagnosis grounded on the dossier.
  const system = await loadPrompt(PROMPT_VERSIONS.diagnostic);
  const userContent =
    `# Problème décrit par le technicien\n${query}\n\n` +
    `# Dossier de preuves (ne cite QUE ces sources)\n${formatEvidence(dossier)}\n\n` +
    (evidenceCount(dossier) === 0
      ? "Aucune source pertinente n'a été trouvée. Utilise l'état insufficient_evidence " +
        "et explique honnêtement que tu ne peux pas confirmer de cause."
      : "Produis un diagnostic progressif : un seul prochain test, sépare faits/hypothèses, " +
        "cite les sources par leur référence.");

  const result = await getLLMService().run("primary", {
    system,
    userText: userContent,
    toolName: "provide_diagnosis",
    toolDescription:
      "Provide the structured diagnostic response. Cite only sources present in the dossier.",
    jsonSchema: DIAGNOSIS_INPUT_SCHEMA,
    schema: diagnosticResponseSchema,
    maxTokens: 2048,
  });

  // 4. Persist the assistant message and the ai_run.
  const { data: message } = await supabase
    .from("incident_messages")
    .insert({
      incident_id: incidentId,
      author_type: "assistant",
      structured_content_json: result.value,
    })
    .select("id")
    .single<{ id: string }>();

  await supabase.from("ai_runs").insert({
    incident_id: incidentId,
    message_id: message?.id ?? null,
    model: `${result.provider}:${result.model}`,
    prompt_version: PROMPT_VERSIONS.diagnostic,
    input_tokens: result.inputTokens + parseTokensIn,
    output_tokens: result.outputTokens + parseTokensOut,
    latency_ms: Date.now() - startedAt,
    status: "ok",
  });

  return { response: result.value, messageId: message?.id ?? null };
}
