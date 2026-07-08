import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkDocument } from "@/lib/knowledge/chunking";
import { embedChunks } from "@/lib/knowledge/embeddings";

/**
 * Ingestion pipeline (spec §28): extract text (done by the caller) → chunk →
 * embed → index into document_chunks. Runs under the caller's Supabase client
 * so RLS applies (spec §46).
 *
 * pgvector columns are written as the textual form "[0.1,0.2,...]" that
 * PostgREST accepts for the `vector` type.
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export interface IngestResult {
  chunkCount: number;
}

export async function ingestDocumentVersion(
  supabase: SupabaseClient,
  params: { documentVersionId: string; text: string },
): Promise<IngestResult> {
  const { documentVersionId, text } = params;

  const chunks = chunkDocument(text);
  if (chunks.length === 0) {
    return { chunkCount: 0 };
  }

  // Replace any existing chunks for this version so re-processing is idempotent.
  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_version_id", documentVersionId);
  if (deleteError) {
    throw new Error(`Failed to clear existing chunks: ${deleteError.message}`);
  }

  const embeddings = await embedChunks(chunks.map((c) => c.content));

  const rows = chunks.map((chunk, i) => ({
    document_version_id: documentVersionId,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    heading: chunk.heading,
    token_count: chunk.tokenCount,
    embedding: toVectorLiteral(embeddings[i]!),
  }));

  const { error: insertError } = await supabase
    .from("document_chunks")
    .insert(rows);
  if (insertError) {
    throw new Error(`Failed to insert chunks: ${insertError.message}`);
  }

  return { chunkCount: rows.length };
}
