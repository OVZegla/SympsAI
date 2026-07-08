import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkDocument } from "@/lib/knowledge/chunking";
import {
  embedChunks,
  embeddingColumns,
  embeddingMetadata,
} from "@/lib/knowledge/embeddings";

/**
 * Ingestion pipeline (spec §28). Flow (per the migration brief):
 *   text (extracted by caller) → chunk → store chunks → embed via the local
 *   Ollama service → validate → store vectors in pgvector.
 *
 * Chunks are stored FIRST with a null embedding, then embedded and updated. If
 * embedding fails, the chunks remain (searchable by keyword) with null vectors
 * and can be regenerated with `npm run embeddings:reindex` — we never lose the
 * text and never mark unembedded chunks as done.
 *
 * Runs under the caller's Supabase client so RLS applies (spec §46).
 */
export interface IngestResult {
  chunkCount: number;
  embedded: boolean;
}

export async function ingestDocumentVersion(
  supabase: SupabaseClient,
  params: { documentVersionId: string; text: string },
): Promise<IngestResult> {
  const { documentVersionId, text } = params;

  const chunks = chunkDocument(text);
  if (chunks.length === 0) {
    return { chunkCount: 0, embedded: false };
  }

  // Replace any existing chunks for this version so re-processing is idempotent.
  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_version_id", documentVersionId);
  if (deleteError) {
    throw new Error(`Failed to clear existing chunks: ${deleteError.message}`);
  }

  // 1. Store chunks first (embedding null), preserving all chunk metadata.
  const baseRows = chunks.map((chunk) => ({
    document_version_id: documentVersionId,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    heading: chunk.heading,
    token_count: chunk.tokenCount,
  }));
  const { data: inserted, error: insertError } = await supabase
    .from("document_chunks")
    .insert(baseRows)
    .select("id, chunk_index")
    .returns<{ id: string; chunk_index: number }[]>();
  if (insertError || !inserted) {
    throw new Error(`Failed to insert chunks: ${insertError?.message}`);
  }

  // 2. Embed via the local service, then 3. update each chunk with its vector.
  //    A failure here leaves retriable chunks (keyword search still works).
  const meta = embeddingMetadata();
  const vectors = await embedChunks(chunks.map((c) => c.content));
  const idByIndex = new Map(inserted.map((r) => [r.chunk_index, r.id]));

  for (let i = 0; i < chunks.length; i++) {
    const id = idByIndex.get(chunks[i]!.chunkIndex);
    if (!id) continue;
    const { error } = await supabase
      .from("document_chunks")
      .update(embeddingColumns(vectors[i]!, meta))
      .eq("id", id);
    if (error) throw new Error(`Failed to store embedding: ${error.message}`);
  }

  return { chunkCount: baseRows.length, embedded: true };
}
