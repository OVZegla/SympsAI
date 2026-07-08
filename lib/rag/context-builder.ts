import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { searchDocuments, searchIncidents } from "@/lib/rag/search";
import { orderByAuthorityThenScore } from "@/lib/rag/fusion";
import { SourceLevel, type EvidenceDossier, type SearchFilters } from "@/lib/rag/types";

/**
 * Build the "dossier de preuves" (spec §18): run SEPARATE searches so an
 * unresolved conversation can never drown out an approved procedure. The four
 * buckets are each ordered by authority then relevance (spec §19).
 *
 * This is the retrieval output tested WITHOUT the AI (spec §58 Phase 3): for the
 * reference scenario it must surface PROC-M1-COM-003 and INC-0042.
 */
export async function buildEvidenceDossier(
  supabase: SupabaseClient,
  query: string,
  filters: SearchFilters = {},
): Promise<EvidenceDossier> {
  const [documents, incidents] = await Promise.all([
    searchDocuments(supabase, query, filters, 30),
    searchIncidents(supabase, query, filters, 30),
  ]);

  const procedures = orderByAuthorityThenScore(
    documents.filter((d) => d.sourceLevel === SourceLevel.ApprovedProcedure),
  );
  const documentation = orderByAuthorityThenScore(
    documents.filter((d) => d.sourceLevel === SourceLevel.ApprovedDocumentation),
  );
  const resolvedIncidents = orderByAuthorityThenScore(
    incidents.filter(
      (i) =>
        i.sourceLevel === SourceLevel.ResolvedIncidentConfirmedCause ||
        i.sourceLevel === SourceLevel.ResolvedIncidentNoConfirmedCause,
    ),
  );
  const openIncidents = orderByAuthorityThenScore(
    incidents.filter((i) => i.sourceLevel === SourceLevel.OpenIncident),
  );

  return { procedures, documentation, resolvedIncidents, openIncidents };
}
