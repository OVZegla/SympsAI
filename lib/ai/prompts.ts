import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Load a versioned prompt from prompts/ (spec §49). The version string is the
 * file basename without extension, and is recorded in ai_runs.prompt_version so
 * a behaviour change can be traced to a prompt change.
 */
const PROMPTS_DIR = join(process.cwd(), "prompts");
const cache = new Map<string, string>();

export async function loadPrompt(version: string): Promise<string> {
  const cached = cache.get(version);
  if (cached) return cached;

  const text = await readFile(join(PROMPTS_DIR, `${version}.md`), "utf8");
  cache.set(version, text);
  return text;
}

export const PROMPT_VERSIONS = {
  diagnostic: "diagnostic-system-v1",
  queryParser: "query-parser-v1",
  incidentClosure: "incident-closure-v1",
  imageAnalysis: "image-analysis-v1",
} as const;
