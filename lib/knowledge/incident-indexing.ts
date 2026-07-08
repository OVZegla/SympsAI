import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedChunks } from "@/lib/knowledge/embeddings";
import { toVectorLiteral } from "@/lib/knowledge/ingestion";
import type { IncidentKnowledgeType } from "@/lib/types/database";

/**
 * Index a validated incident into incident_knowledge_chunks (spec §33) so it
 * becomes a searchable precedent. Only called AFTER human validation — an
 * unvalidated incident must never enter the confirmed-knowledge space (spec
 * §2.3, §11). Embeddings are best-effort: keyword search still works if Voyage
 * is unavailable (the content_tsv column is generated).
 */
export interface KnowledgePiece {
  type: IncidentKnowledgeType;
  content: string;
}

export async function indexIncidentKnowledge(
  supabase: SupabaseClient,
  incidentId: string,
  pieces: KnowledgePiece[],
): Promise<{ indexed: number }> {
  const nonEmpty = pieces.filter((p) => p.content.trim().length > 0);
  if (nonEmpty.length === 0) return { indexed: 0 };

  // Re-indexing an incident replaces its prior knowledge chunks.
  await supabase.from("incident_knowledge_chunks").delete().eq("incident_id", incidentId);

  let embeddings: number[][] = [];
  try {
    embeddings = await embedChunks(nonEmpty.map((p) => p.content));
  } catch (err) {
    console.error("[incident-indexing] embedding failed, keyword-only:", (err as Error).message);
  }

  const rows = nonEmpty.map((piece, i) => ({
    incident_id: incidentId,
    knowledge_type: piece.type,
    content: piece.content,
    embedding: embeddings[i] ? toVectorLiteral(embeddings[i]!) : null,
  }));

  const { error } = await supabase.from("incident_knowledge_chunks").insert(rows);
  if (error) throw new Error(`Failed to index incident knowledge: ${error.message}`);

  return { indexed: rows.length };
}
