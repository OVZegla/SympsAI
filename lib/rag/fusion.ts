import {
  SourceLevel,
  type DocumentHit,
  type IncidentHit,
} from "@/lib/rag/types";
import type { DocumentStatus, IncidentStatus } from "@/lib/types/database";

/**
 * Reciprocal Rank Fusion (RRF) combines the keyword and semantic result lists
 * without needing their scores to be on the same scale (spec §17 step 6, error
 * #6: never rely on vectors alone). A result's fused score is the sum, over
 * every list it appears in, of 1 / (k + rank).
 *
 * Pure and unit-tested (tests/fusion.test.ts).
 */
const RRF_K = 60;

export function reciprocalRankFusion<T>(
  lists: T[][],
  idOf: (item: T) => string,
  k: number = RRF_K,
): { item: T; score: number }[] {
  const scores = new Map<string, number>();
  const items = new Map<string, T>();

  for (const list of lists) {
    list.forEach((item, rank) => {
      const id = idOf(item);
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
      if (!items.has(id)) items.set(id, item);
    });
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ item: items.get(id)!, score }))
    .sort((a, b) => b.score - a.score);
}

/** Map a document status to its source authority level (spec §19). */
export function documentSourceLevel(
  status: DocumentStatus,
  isProcedure: boolean,
): SourceLevel {
  if (status === "approved") {
    return isProcedure
      ? SourceLevel.ApprovedProcedure
      : SourceLevel.ApprovedDocumentation;
  }
  // Non-approved documents are treated as internal notes for ranking purposes.
  return SourceLevel.InternalNote;
}

/** Map an incident to its source authority level (spec §19). */
export function incidentSourceLevel(
  status: IncidentStatus,
  hasConfirmedCause: boolean,
): SourceLevel {
  const isResolved = status === "resolved" || status === "closed";
  if (isResolved) {
    return hasConfirmedCause
      ? SourceLevel.ResolvedIncidentConfirmedCause
      : SourceLevel.ResolvedIncidentNoConfirmedCause;
  }
  return SourceLevel.OpenIncident;
}

/**
 * Order hits so that source authority dominates and relevance breaks ties
 * (spec §18-§19: an unresolved conversation must never outrank an approved
 * procedure). Returns a new sorted array.
 */
export function orderByAuthorityThenScore<T extends DocumentHit | IncidentHit>(
  hits: T[],
): T[] {
  return [...hits].sort((a, b) => {
    if (a.sourceLevel !== b.sourceLevel) return a.sourceLevel - b.sourceLevel;
    return b.score - a.score;
  });
}
