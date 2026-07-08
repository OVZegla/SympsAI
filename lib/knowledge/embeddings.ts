import "server-only";

import { embed } from "@/lib/voyage/client";

/**
 * Embed document chunks in batches (spec §28 pipeline). Voyage accepts many
 * inputs per call; we batch to stay within request limits and to fail a small
 * batch rather than the whole document.
 */
const BATCH_SIZE = 96;

export async function embedChunks(contents: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < contents.length; i += BATCH_SIZE) {
    const batch = contents.slice(i, i + BATCH_SIZE);
    const batchVectors = await embed(batch, "document");
    vectors.push(...batchVectors);
  }
  return vectors;
}
