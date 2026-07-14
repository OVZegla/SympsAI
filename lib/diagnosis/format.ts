import type { EngineResult } from "./engine";
import { LIKELIHOOD_LABEL_FR } from "./engine";

/**
 * Sérialise le résultat du moteur déterministe pour le contexte du LLM
 * (couche 3). Ce bloc est AUTORITAIRE : le modèle reformule, guide et cite —
 * il ne contredit pas la Base et ne complète jamais une inconnue.
 */
export function formatEngineResult(result: EngineResult): string {
  const parts: string[] = [];

  if (result.facts.length > 0) {
    parts.push(
      "## Faits de la Base Symp's (autoritaires — cite la section)\n" +
        result.facts
          .map(
            (f) =>
              `- [${f.certainty}] ${f.statement} (source : ${f.source.document} — ${f.source.section ?? ""})`,
          )
          .join("\n"),
    );
  }

  if (result.normalBehaviors.length > 0) {
    parts.push(
      "## Comportements NORMAUX détectés (ne pas signaler comme panne)\n" +
        result.normalBehaviors
          .map(
            (nb) =>
              `- ${nb.statement}${nb.abnormalCounterpart ? `\n  En revanche : ${nb.abnormalCounterpart}` : ""} (source : ${nb.source.document} — ${nb.source.section ?? ""})`,
          )
          .join("\n"),
    );
  }

  if (result.hypotheses.length > 0) {
    parts.push(
      "## Hypothèses classées par le moteur déterministe\n" +
        result.hypotheses
          .map((h, i) => {
            const lines = [
              `${i + 1}. ${h.label} — ${LIKELIHOOD_LABEL_FR[h.likelihood]}`,
              ...h.supportingEvidence.map((e) => `   + ${e}`),
              ...h.contradictingEvidence.map((e) => `   − ${e}`),
              `   Sources : ${h.sourceRefs.join(" ; ")}`,
            ];
            return lines.join("\n");
          })
          .join("\n"),
    );
  }

  if (result.nextTests.length > 0) {
    parts.push(
      "## Prochains tests recommandés (dans cet ordre, un seul à la fois)\n" +
        result.nextTests
          .map(
            (nt, i) =>
              `${i + 1}. ${nt.test.name} [sécurité: ${nt.test.safetyLevel}${nt.test.estimatedDuration ? `, ~${nt.test.estimatedDuration}` : ""}]\n` +
              `   Pourquoi : ${nt.reason}\n` +
              `   Comment : ${nt.test.instructions.join(" ")}\n` +
              `   Interprétation : ${nt.test.expectedResults.map((r) => `« ${r.result} » → ${r.meaning}`).join(" | ")}`,
          )
          .join("\n"),
    );
  }

  if (result.unknowns.length > 0) {
    parts.push(
      "## Inconnues contrôlées (Base §13 — NE PAS compléter par imagination)\n" +
        result.unknowns
          .map((u) => `- ${u.topic} : ${u.statement}`)
          .join("\n") +
        "\nRéponds : « Ce comportement n'est pas encore documenté dans la base Symp's. " +
        "Je ne peux pas confirmer sans un test contrôlé. »",
    );
  }

  if (result.contradictions.length > 0) {
    parts.push(
      "## Contradictions non résolues (cite les deux positions, n'en tranche aucune)\n" +
        result.contradictions
          .map(
            (c) =>
              `- ${c.topic} : ${c.positions.map((p) => `${p.statement} (${p.source})`).join(" vs ")} — à confirmer selon la version de machine.`,
          )
          .join("\n"),
    );
  }

  if (result.cautions.length > 0) {
    parts.push(
      "## Garde-fous (à respecter strictement)\n" +
        result.cautions.map((c) => `- ${c}`).join("\n"),
    );
  }

  return parts.join("\n\n") || "(Aucune règle de la Base Symp's ne matche ces observations.)";
}
