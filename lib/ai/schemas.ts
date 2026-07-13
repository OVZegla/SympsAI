import { z } from "zod";

/**
 * Schemas for the model's structured outputs. Every structured AI response is
 * validated against one of these before the app trusts it (CLAUDE.md AI rules;
 * spec §16, §36). This keeps the model from controlling raw presentation and
 * guarantees the shape the UI depends on.
 */

// --- Support level (spec §34): a qualitative label, never a fake percentage. --
export const supportLevelSchema = z.enum(["none", "low", "moderate", "high"]);
export type SupportLevel = z.infer<typeof supportLevelSchema>;

export const responseStateSchema = z.enum([
  "needs_information",
  "diagnostic_plan",
  "waiting_test_result",
  "probable_cause",
  "resolution_proposed",
  "ready_to_close",
  "insufficient_evidence",
]);
export type ResponseState = z.infer<typeof responseStateSchema>;

// --- Initial query analysis (spec §16) --------------------------------------
export const parsedQuerySchema = z.object({
  intent: z.string(),
  machine_model: z.string().nullable(),
  machine_id: z.string().nullable(),
  subsystem: z.string().nullable(),
  components: z.array(z.string()),
  symptoms: z.array(
    z.object({
      raw: z.string(),
      normalized: z.string(),
    }),
  ),
  actions_already_done: z.array(z.string()),
  error_codes: z.array(z.string()),
  safety_risk: z.enum(["normal", "elevated", "dangerous"]),
  missing_information: z.array(z.string()),
});
export type ParsedQuery = z.infer<typeof parsedQuerySchema>;

// --- Intake entity extraction (spec §15, §25-§26) ----------------------------
// Entities named in an incident description ("c'est Dupont qui a un problème
// avec sa M1 n° 12345") so the intake can create/complete the dossier. Every
// field is null when not explicitly stated — never invented.
export const intakeEntitiesSchema = z.object({
  client_name: z.string().nullable(),
  client_phone: z.string().nullable(),
  client_email: z.string().nullable(),
  machine_model: z.string().nullable(),
  serial_number: z.string().nullable(),
});
export type IntakeEntities = z.infer<typeof intakeEntitiesSchema>;

// --- Diagnostic response contract (spec §36) --------------------------------
// The model returns this JSON; the UI turns it into the rendered answer so the
// model never controls the full presentation.
export const diagnosticResponseSchema = z.object({
  state: responseStateSchema,
  confirmed_facts: z.array(z.string()),
  similar_cases: z.array(
    z.object({
      incident_number: z.string(),
      similarity: z.enum(["very_similar", "partially_similar", "loosely_related"]),
      note: z.string().optional(),
    }),
  ),
  hypotheses: z.array(
    z.object({
      title: z.string(),
      support_level: supportLevelSchema,
      reasons: z.array(z.string()),
      evidence_ids: z.array(z.string()),
    }),
  ),
  recommended_action: z
    .object({
      title: z.string(),
      reason: z.string(),
      test_id: z.string().nullable(),
      procedure_id: z.string().nullable(),
      risk_level: z.enum(["low", "normal", "high"]),
    })
    .nullable(),
  questions: z.array(z.string()),
  support_level: supportLevelSchema,
  sources: z.array(
    z.object({
      kind: z.enum(["procedure", "document", "incident", "note"]),
      ref: z.string(),
      label: z.string(),
      location: z.string().optional(),
    }),
  ),
});
export type DiagnosticResponse = z.infer<typeof diagnosticResponseSchema>;

// --- Image analysis (spec §38) ----------------------------------------------
export const imageAnalysisSchema = z.object({
  visible_software: z.string().nullable(),
  observations: z.array(z.string()),
  visible_errors: z.array(z.string()),
  uncertainties: z.array(z.string()),
});
export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;
