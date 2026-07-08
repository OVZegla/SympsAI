import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definitions the model uses to reach the memory (spec §23). The model
 * never runs arbitrary SQL — it can only call these explicit tools (CLAUDE.md
 * AI rules; avoid error #5/#6).
 *
 * `access: "read"` tools run automatically. `access: "write"` tools require
 * explicit human confirmation before execution (spec §24) — the orchestrator
 * must surface a confirmation UI and never auto-execute them.
 *
 * The handlers themselves belong to later phases (Phase 4+). This file defines
 * the contract only; the schemas here are the source of truth for those
 * handlers.
 */

export type ToolAccess = "read" | "write";

export interface SympsTool {
  access: ToolAccess;
  definition: Anthropic.Tool;
}

export const tools: Record<string, SympsTool> = {
  search_knowledge: {
    access: "read",
    definition: {
      name: "search_knowledge",
      description:
        "Search approved procedures, technical documentation and validated knowledge. " +
        "Returns cited excerpts. Prefer this over incident history for authoritative guidance.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          machine_model_id: { type: ["string", "null"] },
          component_ids: { type: "array", items: { type: "string" } },
          knowledge_types: { type: "array", items: { type: "string" } },
          limit: { type: "integer", default: 10 },
        },
        required: ["query"],
      },
    },
  },

  search_similar_incidents: {
    access: "read",
    definition: {
      name: "search_similar_incidents",
      description:
        "Find previous incidents similar to the current situation. Resolved incidents " +
        "with a confirmed cause are stronger precedents than unresolved ones (spec §19).",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          machine_model_id: { type: ["string", "null"] },
          symptoms: { type: "array", items: { type: "string" } },
          exclude_incident_id: { type: ["string", "null"] },
          limit: { type: "integer", default: 10 },
        },
        required: ["query"],
      },
    },
  },

  get_machine_history: {
    access: "read",
    definition: {
      name: "get_machine_history",
      description: "Return the incident history of one physical machine.",
      input_schema: {
        type: "object",
        properties: { machine_id: { type: "string" } },
        required: ["machine_id"],
      },
    },
  },

  get_incident_details: {
    access: "read",
    definition: {
      name: "get_incident_details",
      description: "Return the full detail of one incident (symptoms, tests, causes, solution).",
      input_schema: {
        type: "object",
        properties: { incident_id: { type: "string" } },
        required: ["incident_id"],
      },
    },
  },

  get_document_excerpt: {
    access: "read",
    definition: {
      name: "get_document_excerpt",
      description: "Return a specific excerpt of a document so its content can be cited exactly.",
      input_schema: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          location: { type: "string" },
        },
        required: ["document_id"],
      },
    },
  },

  get_available_tests: {
    access: "read",
    definition: {
      name: "get_available_tests",
      description: "List known diagnostic tests for a machine model / components.",
      input_schema: {
        type: "object",
        properties: {
          machine_model_id: { type: "string" },
          component_ids: { type: "array", items: { type: "string" } },
        },
        required: ["machine_model_id"],
      },
    },
  },

  // --- WRITE tools: require explicit human confirmation (spec §24) -----------
  record_test_result: {
    access: "write",
    definition: {
      name: "record_test_result",
      description:
        "Record the result of a diagnostic test on an incident. WRITE — only after an " +
        "explicit user action; never invent a result (spec §35 interdictions).",
      input_schema: {
        type: "object",
        properties: {
          incident_id: { type: "string" },
          test_run_id: { type: "string" },
          status: {
            type: "string",
            enum: ["passed", "failed", "inconclusive", "not_applicable", "cancelled"],
          },
          notes: { type: "string" },
        },
        required: ["incident_id", "test_run_id", "status"],
      },
    },
  },

  propose_incident_closure: {
    access: "write",
    definition: {
      name: "propose_incident_closure",
      description:
        "Prepare a closure summary for human review. Does NOT close the incident and does " +
        "NOT confirm a cause on its own — a human validates (spec §24, §32).",
      input_schema: {
        type: "object",
        properties: { incident_id: { type: "string" } },
        required: ["incident_id"],
      },
    },
  },
};

/** All tool definitions in the shape the Anthropic SDK expects. */
export function toolDefinitions(): Anthropic.Tool[] {
  return Object.values(tools).map((t) => t.definition);
}

/** Names of tools that require human confirmation before execution. */
export function writeToolNames(): string[] {
  return Object.entries(tools)
    .filter(([, t]) => t.access === "write")
    .map(([name]) => name);
}
