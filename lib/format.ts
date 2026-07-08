import type { IncidentStatus } from "@/lib/types/database";

/** Human-readable French labels for incident statuses (spec §11). */
export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  new: "Nouveau",
  investigating: "En cours",
  waiting_client: "Attente client",
  waiting_supplier: "Attente fournisseur",
  resolved: "Résolu",
  closed: "Clôturé",
  reopened: "Rouvert",
};

/** Tailwind badge classes per status. */
export const INCIDENT_STATUS_CLASSES: Record<IncidentStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  investigating: "bg-amber-100 text-amber-800",
  waiting_client: "bg-purple-100 text-purple-800",
  waiting_supplier: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-slate-200 text-slate-700",
  reopened: "bg-orange-100 text-orange-800",
};

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
