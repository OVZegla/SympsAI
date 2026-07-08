import "server-only";

/**
 * Central place for AI model configuration. Model ids are ALWAYS read from the
 * environment, never hard-coded across the app (spec §55, avoid error #9). If a
 * newer model ships, only the environment changes.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const aiConfig = {
  /** Primary reasoning model for diagnosis. */
  get primaryModel(): string {
    return requireEnv("CLAUDE_PRIMARY_MODEL");
  },
  /** Cheaper/faster model for lightweight tasks (query parsing, classification). */
  get fastModel(): string {
    return process.env.CLAUDE_FAST_MODEL || requireEnv("CLAUDE_PRIMARY_MODEL");
  },
} as const;

// Embedding configuration lives in lib/embeddings/validation.ts
// (getEmbeddingConfig) — the app reaches embeddings only through the
// EmbeddingService abstraction, not through this Claude-model config.
