import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Native Anthropic SDK client (spec §6: native API, not a compatibility shim).
 * Server-only — ANTHROPIC_API_KEY must never reach the browser (spec §47).
 *
 * Lazily instantiated so importing this module doesn't throw when the key is
 * absent (e.g. during a build that doesn't call the model).
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
