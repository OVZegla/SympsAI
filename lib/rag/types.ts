import type {
  DocumentStatus,
  IncidentStatus,
  IncidentKnowledgeType,
} from "@/lib/types/database";

/**
 * Source authority levels — the ordering that governs whose word wins when
 * evidence conflicts (spec §19). Lower number = higher authority.
 */
export enum SourceLevel {
  ApprovedProcedure = 1,
  ApprovedDocumentation = 2,
  ResolvedIncidentConfirmedCause = 3,
  ResolvedIncidentNoConfirmedCause = 4,
  OpenIncident = 5,
  InternalNote = 6,
}

export interface DocumentHit {
  kind: "document";
  chunkId: string;
  documentId: string;
  documentCode: string | null;
  documentTitle: string;
  documentStatus: DocumentStatus;
  machineModelId: string | null;
  heading: string | null;
  content: string;
  pageNumber: number | null;
  /** Fused relevance score (higher = better). */
  score: number;
  sourceLevel: SourceLevel;
}

export interface IncidentHit {
  kind: "incident";
  chunkId: string;
  incidentId: string;
  incidentNumber: string;
  incidentStatus: IncidentStatus;
  machineModelId: string | null;
  knowledgeType: IncidentKnowledgeType;
  content: string;
  hasConfirmedCause: boolean;
  score: number;
  sourceLevel: SourceLevel;
}

export type Hit = DocumentHit | IncidentHit;

/** The "dossier de preuves" (spec §18): searches kept separate by source type. */
export interface EvidenceDossier {
  procedures: DocumentHit[];
  documentation: DocumentHit[];
  resolvedIncidents: IncidentHit[];
  openIncidents: IncidentHit[];
}

export interface SearchFilters {
  machineModelId?: string | null;
  excludeIncidentId?: string | null;
}
