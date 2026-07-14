/**
 * Rapports d'incident (§17B/§17C) — génération Markdown pure et déterministe
 * (pas de LLM : le rapport reflète exactement la base, rien d'inventé).
 *
 * - Rapport final : incident résolu (cause confirmée, solution, tests, durée).
 * - Résumé de transmission : bilingue FR/EN, pour transmettre le dossier à un
 *   autre technicien, au fabricant ou au support chinois.
 */

export interface ReportTest {
  name: string;
  status: string;
  notes?: string | null;
  at?: string | null;
}

export interface IncidentReportData {
  incidentNumber: string;
  title: string;
  status: string;
  openedAt: string;
  closedAt?: string | null;
  machineModel?: string | null;
  serialNumber?: string | null;
  clientName?: string | null;
  machineProfile?: string[];
  description: string;
  tests: ReportTest[];
  confirmedCause?: string | null;
  solution?: string | null;
  finalSummary?: string | null;
  remainingHypotheses?: string[];
  generatedAt: string;
}

const STATUS_FR: Record<string, string> = {
  passed: "✅ Réussi",
  failed: "❌ Échoué",
  inconclusive: "❓ Inconclusif",
  not_applicable: "➖ Non applicable",
  cancelled: "Annulé",
  proposed: "Proposé (non réalisé)",
  in_progress: "En cours",
};

const STATUS_EN: Record<string, string> = {
  passed: "✅ Passed",
  failed: "❌ Failed",
  inconclusive: "❓ Inconclusive",
  not_applicable: "➖ Not applicable",
  cancelled: "Cancelled",
  proposed: "Proposed (not performed)",
  in_progress: "In progress",
};

function durationLabel(openedAt: string, closedAt?: string | null): string | null {
  if (!closedAt) return null;
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return "moins d'une heure / under one hour";
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} jours / days`;
}

function machineBlock(data: IncidentReportData): string {
  const lines = [
    `- **Modèle / Model :** ${data.machineModel ?? "—"}`,
    `- **N° de série / Serial :** ${data.serialNumber ?? "—"}`,
    `- **Client :** ${data.clientName ?? "—"}`,
  ];
  for (const p of data.machineProfile ?? []) lines.push(`- ${p}`);
  return lines.join("\n");
}

function testsBlock(tests: ReportTest[], labels: Record<string, string>): string {
  if (tests.length === 0) return "_Aucun test enregistré. / No recorded test._";
  return tests
    .map(
      (t) =>
        `| ${t.name} | ${labels[t.status] ?? t.status} | ${t.notes?.replaceAll("|", "/") ?? ""} |`,
    )
    .join("\n");
}

/** Rapport final (incident résolu) — Markdown, français. */
export function buildFinalReport(data: IncidentReportData): string {
  const duration = durationLabel(data.openedAt, data.closedAt);
  return `# Rapport d'intervention — ${data.incidentNumber}

**${data.title}**

_Généré le ${data.generatedAt} par Symp's AI (contenu issu de la base — aucune information générée par IA)._

## Machine

${machineBlock(data)}

## Problème déclaré

${data.description || "—"}

## Tests réalisés

| Test | Résultat | Détail |
|---|---|---|
${testsBlock(data.tests, STATUS_FR)}

## Cause confirmée

${data.confirmedCause ?? "_Aucune cause formellement confirmée._"}

## Solution appliquée

${data.solution ?? "—"}

## Synthèse

${data.finalSummary ?? "—"}

## Durée

- Ouvert le : ${data.openedAt}
- Clos le : ${data.closedAt ?? "—"}
${duration ? `- Durée totale : ${duration}` : ""}

## Recommandations

- Vérifier ce dossier dans Symp's AI (${data.incidentNumber}) avant toute intervention similaire.
- Si la leçon est réutilisable, la soumettre à la base de connaissance (validation admin requise).
`;
}

/** Résumé de transmission bilingue FR/EN (dossier en cours ou clos). */
export function buildTransmissionSummary(data: IncidentReportData): string {
  const hypotheses =
    (data.remainingHypotheses ?? []).length > 0
      ? data.remainingHypotheses!.map((h) => `- ${h}`).join("\n")
      : "- —";

  return `# Résumé de transmission / Handover summary — ${data.incidentNumber}

_Généré le / generated on ${data.generatedAt}. Contenu factuel issu du dossier — aucune information inventée. Factual content from the case file — nothing invented._

## 🇫🇷 Français

### Machine

${machineBlock(data)}

### Problème

${data.description || "—"}

### Tests réalisés et résultats

| Test | Résultat | Détail |
|---|---|---|
${testsBlock(data.tests, STATUS_FR)}

### Hypothèses restantes

${hypotheses}

### État / demande

- Statut du dossier : ${data.status}
- Cause confirmée : ${data.confirmedCause ?? "aucune pour l'instant"}
- Demande : merci d'indiquer les vérifications ou paramètres à contrôler ensuite.

---

## 🇬🇧 English

### Machine

${machineBlock(data)}

### Problem

${data.description || "—"}

### Tests performed and results

| Test | Result | Detail |
|---|---|---|
${testsBlock(data.tests, STATUS_EN)}

### Remaining hypotheses

${hypotheses}

### Status / request

- Case status: ${data.status}
- Confirmed cause: ${data.confirmedCause ?? "none so far"}
- Request: please advise the next checks or parameters to verify.
`;
}
