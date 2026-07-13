import "server-only";

import { getLLMService } from "@/lib/ai/llm/service";
import { loadPrompt, PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { intakeEntitiesSchema, type IntakeEntities } from "@/lib/ai/schemas";

/**
 * Extract the entities named in an incident description (client, phone, model,
 * serial number) so the intake can create/complete the dossier (spec §15,
 * §25-§26). Runs on the "fast" task lane (local Ollama by default; Claude if
 * configured). Best-effort: callers fall back to the pure keyword/regex
 * matching in lib/incidents/intake.ts when this fails.
 */
const INTAKE_ENTITIES_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    client_name: { type: ["string", "null"] },
    client_phone: { type: ["string", "null"] },
    client_email: { type: ["string", "null"] },
    machine_model: { type: ["string", "null"] },
    serial_number: { type: ["string", "null"] },
  },
  required: [
    "client_name",
    "client_phone",
    "client_email",
    "machine_model",
    "serial_number",
  ],
};

export async function extractIntakeEntities(text: string): Promise<{
  value: IntakeEntities;
  model: string;
  provider: string;
  promptVersion: string;
}> {
  const system = await loadPrompt(PROMPT_VERSIONS.intakeExtractor);
  const result = await getLLMService().run("fast", {
    system,
    userText: text,
    toolName: "record_entities",
    toolDescription:
      "Record the client/machine entities named in the incident description.",
    jsonSchema: INTAKE_ENTITIES_INPUT_SCHEMA,
    schema: intakeEntitiesSchema,
    maxTokens: 512,
  });

  return { ...result, promptVersion: PROMPT_VERSIONS.intakeExtractor };
}
