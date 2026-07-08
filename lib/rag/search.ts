import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentStatus, IncidentStatus, IncidentKnowledgeType } from "@/lib/types/database";
import {
  documentSourceLevel,
  incidentSourceLevel,
  reciprocalRankFusion,
} from "@/lib/rag/fusion";
import {
  type DocumentHit,
  type IncidentHit,
  type SearchFilters,
} from "@/lib/rag/types";
import { embedQuery } from "@/lib/voyage/client";

/**
 * Keyword + semantic search over documents and incident knowledge, fused with
 * RRF (spec §17). Keyword search (§17 step 4) works even without embeddings, so
 * retrieval degrades gracefully when Voyage is unavailable.
 */

interface DocRpcRow {
  chunk_id: string;
  document_id: string;
  document_code: string | null;
  document_title: string;
  document_status: DocumentStatus;
  machine_model_id: string | null;
  heading: string | null;
  content: string;
  page_number: number | null;
}

interface IncidentRpcRow {
  chunk_id: string;
  incident_id: string;
  incident_number: string;
  incident_status: IncidentStatus;
  machine_model_id: string | null;
  knowledge_type: IncidentKnowledgeType;
  content: string;
  has_confirmed_cause: boolean;
}

function toDocHit(row: DocRpcRow, score: number): DocumentHit {
  return {
    kind: "document",
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentCode: row.document_code,
    documentTitle: row.document_title,
    documentStatus: row.document_status,
    machineModelId: row.machine_model_id,
    heading: row.heading,
    content: row.content,
    pageNumber: row.page_number,
    score,
    // Whether a document is a "procedure" is carried by document_type; the RPC
    // only returns status, so we infer procedure-ness from the code prefix
    // (PROC-…) as a pragmatic signal, defaulting to documentation otherwise.
    sourceLevel: documentSourceLevel(
      row.document_status,
      (row.document_code ?? "").toUpperCase().startsWith("PROC"),
    ),
  };
}

function toIncidentHit(row: IncidentRpcRow, score: number): IncidentHit {
  return {
    kind: "incident",
    chunkId: row.chunk_id,
    incidentId: row.incident_id,
    incidentNumber: row.incident_number,
    incidentStatus: row.incident_status,
    machineModelId: row.machine_model_id,
    knowledgeType: row.knowledge_type,
    content: row.content,
    hasConfirmedCause: row.has_confirmed_cause,
    score,
    sourceLevel: incidentSourceLevel(row.incident_status, row.has_confirmed_cause),
  };
}

/** Best-effort query embedding: returns null if Voyage is unavailable. */
async function tryEmbedQuery(query: string): Promise<number[] | null> {
  try {
    return await embedQuery(query);
  } catch (err) {
    console.error("[rag] query embedding failed, keyword-only:", (err as Error).message);
    return null;
  }
}

export async function searchDocuments(
  supabase: SupabaseClient,
  query: string,
  filters: SearchFilters = {},
  limit = 30,
): Promise<DocumentHit[]> {
  const machineModelId = filters.machineModelId ?? null;

  const keywordPromise = supabase.rpc("keyword_document_chunks", {
    query_text: query,
    match_count: limit,
    filter_machine_model_id: machineModelId,
  });

  const embedding = await tryEmbedQuery(query);
  const semanticPromise = embedding
    ? supabase.rpc("match_document_chunks", {
        query_embedding: `[${embedding.join(",")}]`,
        match_count: limit,
        filter_machine_model_id: machineModelId,
      })
    : Promise.resolve({ data: [] as DocRpcRow[], error: null });

  const [keywordRes, semanticRes] = await Promise.all([keywordPromise, semanticPromise]);

  const keywordRows = (keywordRes.data ?? []) as DocRpcRow[];
  const semanticRows = (semanticRes.data ?? []) as DocRpcRow[];

  const fused = reciprocalRankFusion(
    [keywordRows, semanticRows],
    (r) => r.chunk_id,
  );
  return fused.slice(0, limit).map(({ item, score }) => toDocHit(item, score));
}

export async function searchIncidents(
  supabase: SupabaseClient,
  query: string,
  filters: SearchFilters = {},
  limit = 30,
): Promise<IncidentHit[]> {
  const machineModelId = filters.machineModelId ?? null;
  const excludeIncidentId = filters.excludeIncidentId ?? null;

  const keywordPromise = supabase.rpc("keyword_incident_chunks", {
    query_text: query,
    match_count: limit,
    filter_machine_model_id: machineModelId,
    exclude_incident_id: excludeIncidentId,
  });

  const embedding = await tryEmbedQuery(query);
  const semanticPromise = embedding
    ? supabase.rpc("match_incident_chunks", {
        query_embedding: `[${embedding.join(",")}]`,
        match_count: limit,
        filter_machine_model_id: machineModelId,
        exclude_incident_id: excludeIncidentId,
      })
    : Promise.resolve({ data: [] as IncidentRpcRow[], error: null });

  const [keywordRes, semanticRes] = await Promise.all([keywordPromise, semanticPromise]);

  const keywordRows = (keywordRes.data ?? []) as IncidentRpcRow[];
  const semanticRows = (semanticRes.data ?? []) as IncidentRpcRow[];

  const fused = reciprocalRankFusion(
    [keywordRows, semanticRows],
    (r) => r.chunk_id,
  );
  return fused.slice(0, limit).map(({ item, score }) => toIncidentHit(item, score));
}
