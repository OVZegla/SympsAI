import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { aiConfig } from "@/lib/ai/models";
import { generateStructured } from "@/lib/ai/structured";
import { loadPrompt, PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { imageAnalysisSchema, type ImageAnalysis } from "@/lib/ai/schemas";

/**
 * Analyze an incident photo/screenshot (spec §38). Returns a structured,
 * schema-validated observation. The model must report ONLY what is visible and
 * put anything uncertain into `uncertainties` — it must never claim to have
 * read invisible information (spec §38, §35).
 */
const IMAGE_ANALYSIS_INPUT_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    visible_software: { type: ["string", "null"] },
    observations: { type: "array", items: { type: "string" } },
    visible_errors: { type: "array", items: { type: "string" } },
    uncertainties: { type: "array", items: { type: "string" } },
  },
  required: ["visible_software", "observations", "visible_errors", "uncertainties"],
};

export async function analyzeImage(params: {
  base64Data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  incidentContext?: string;
}): Promise<{
  value: ImageAnalysis;
  inputTokens: number;
  outputTokens: number;
  promptVersion: string;
}> {
  const system = await loadPrompt(PROMPT_VERSIONS.imageAnalysis);

  const content: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] = [
    {
      type: "image",
      source: { type: "base64", media_type: params.mediaType, data: params.base64Data },
    },
    {
      type: "text",
      text: params.incidentContext
        ? `Contexte de l'incident : ${params.incidentContext}`
        : "Analyse cette image dans le contexte d'un diagnostic technique.",
    },
  ];

  const result = await generateStructured({
    model: aiConfig.primaryModel,
    system,
    messages: [{ role: "user", content }],
    toolName: "record_image_analysis",
    toolDescription: "Record only what is visible in the image. Never invent details.",
    inputSchema: IMAGE_ANALYSIS_INPUT_SCHEMA,
    schema: imageAnalysisSchema,
    maxTokens: 1024,
  });

  return { ...result, promptVersion: PROMPT_VERSIONS.imageAnalysis };
}
