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
  get embeddingModel(): string {
    return process.env.EMBEDDING_MODEL || "voyage-4";
  },
  get embeddingDimension(): number {
    return Number(process.env.EMBEDDING_DIMENSION || "1024");
  },
  get rerankModel(): string {
    return process.env.RERANK_MODEL || "rerank-2.5-lite";
  },
} as const;
