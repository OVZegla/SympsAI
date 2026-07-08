import "server-only";

import type { EvidenceDossier } from "@/lib/rag/types";

/**
 * Render the evidence dossier (spec §18) into a compact, clearly-labelled text
 * block for the model, tagging each item with its source authority (spec §19)
 * and a stable reference the model must cite. The model never sees raw SQL — it
 * only sees this curated, attributed context.
 */
export function formatEvidence(dossier: EvidenceDossier): string {
  const lines: string[] = [];

  const section = (title: string, body: string[]) => {
    lines.push(`## ${title}`);
    lines.push(body.length ? body.join("\n") : "(aucun résultat)");
    lines.push("");
  };

  section(
    "Procédures approuvées (autorité maximale)",
    dossier.procedures.map(
      (h) =>
        `- [${h.documentCode ?? h.documentId}] ${h.documentTitle}` +
        (h.heading ? ` — ${h.heading}` : "") +
        `\n  ${h.content.slice(0, 500)}`,
    ),
  );

  section(
    "Documentation technique approuvée",
    dossier.documentation.map(
      (h) =>
        `- [${h.documentCode ?? h.documentId}] ${h.documentTitle}` +
        (h.heading ? ` — ${h.heading}` : "") +
        `\n  ${h.content.slice(0, 500)}`,
    ),
  );

  section(
    "Incidents résolus similaires",
    dossier.resolvedIncidents.map(
      (h) =>
        `- [${h.incidentNumber}]${h.hasConfirmedCause ? " (cause confirmée)" : " (cause non confirmée)"}` +
        `\n  ${h.content.slice(0, 500)}`,
    ),
  );

  section(
    "Incidents ouverts similaires (indicatif seulement)",
    dossier.openIncidents.map(
      (h) => `- [${h.incidentNumber}]\n  ${h.content.slice(0, 500)}`,
    ),
  );

  return lines.join("\n");
}

/** Count total evidence items — used to decide the abstention path (spec §37). */
export function evidenceCount(dossier: EvidenceDossier): number {
  return (
    dossier.procedures.length +
    dossier.documentation.length +
    dossier.resolvedIncidents.length +
    dossier.openIncidents.length
  );
}
