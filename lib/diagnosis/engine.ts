import {
  DIAGNOSTIC_RULES,
  NORMAL_BEHAVIORS,
  UNKNOWNS,
  CONTRADICTIONS,
  GUIDED_TEST_INDEX,
  COMMON_COMPONENTS,
  findRelevantItems,
  formatSource,
  matchesCondition,
  normalizeText,
  hasAnyPhrase,
} from "@/lib/knowledge/base";
import type {
  Contradiction,
  DiagnosticRule,
  GuidedTest,
  KnowledgeItem,
  NormalBehavior,
  UnknownItem,
} from "@/lib/knowledge/base";

/**
 * Couche 2 — moteur de diagnostic déterministe.
 *
 * Applique les règles de la Base Symp's v0.1 aux observations : symptômes du
 * texte, fonctions qui marchent / en panne, résultats des tests déjà réalisés.
 * Aucun LLM ici : tout est pur, testé, et chaque conclusion porte sa source.
 * Le LLM (couche 3) reçoit ce résultat comme contexte AUTORITAIRE — il
 * reformule et guide, il n'est jamais l'unique source d'une affirmation.
 */

export type Likelihood =
  | "very_likely"
  | "likely"
  | "possible"
  | "unlikely"
  | "not_verifiable";

/** Libellés qualitatifs affichés — jamais de pourcentage inventé (spec §34). */
export const LIKELIHOOD_LABEL_FR: Record<Likelihood, string> = {
  very_likely: "très probable",
  likely: "probable",
  possible: "possible",
  unlikely: "peu probable",
  not_verifiable: "non vérifiable actuellement",
};

const LIKELIHOOD_RANK: Record<Likelihood, number> = {
  very_likely: 4,
  likely: 3,
  possible: 2,
  unlikely: 1,
  not_verifiable: 0,
};

function rankToLikelihood(rank: number): Likelihood {
  if (rank >= 4) return "very_likely";
  if (rank === 3) return "likely";
  if (rank === 2) return "possible";
  if (rank === 1) return "unlikely";
  return "not_verifiable";
}

export interface EngineTestResult {
  /** Id du test guidé (test.*) si connu, sinon on matche sur le libellé. */
  testId?: string | null;
  /** Libellé/notes du test tel qu'enregistré. */
  text: string;
  status: "passed" | "failed" | "inconclusive" | "not_applicable" | "cancelled";
}

export interface EngineInput {
  /** Description du problème + derniers messages du technicien. */
  text: string;
  /** Fonctions déclarées fonctionnelles (ex. ["couleur"]). */
  workingFunctions?: string[];
  /** Résultats des tests déjà réalisés — ne jamais les redemander. */
  performedTests?: EngineTestResult[];
}

export interface EngineHypothesis {
  id: string;
  label: string;
  likelihood: Likelihood;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  /** Références de citation ("Base Symp's v0.1 — §12 …"). */
  sourceRefs: string[];
  /** Tests guidés qui vérifient cette hypothèse. */
  testIds: string[];
}

export interface EngineNextTest {
  test: GuidedTest;
  reason: string;
}

export interface EngineResult {
  matchedRules: DiagnosticRule[];
  hypotheses: EngineHypothesis[];
  /** Prochain(s) test(s), ordonnés sécurité → simplicité, hors déjà réalisés. */
  nextTests: EngineNextTest[];
  normalBehaviors: NormalBehavior[];
  unknowns: UnknownItem[];
  contradictions: Contradiction[];
  facts: KnowledgeItem[];
  /** Garde-fous : ce qu'il ne faut PAS faire en première intention. */
  cautions: string[];
  sourceRefs: string[];
}

const SAFETY_ORDER = { SAFE: 0, CAUTION: 1, STOP_MACHINE: 2 } as const;

/** Fonctions détectables comme « ça marche » dans une phrase du technicien. */
const FUNCTION_TERMS = ["couleur", "blanc", "manuel", "communication", "impression"];
const WORKS_VERBS = "fonctionne|marche|sort|reussi|correcte?|present|ok";

/**
 * Détecte les fonctions déclarées FONCTIONNELLES dans le texte
 * (« la couleur fonctionne », « le blanc sort au flash »). Une mention niée
 * (« ne sort pas », « ne fonctionne plus ») n'est pas retenue : le doute
 * profite au diagnostic. Sert à déprioriser les dépendances communes
 * (Base §0 règle 2) sans que le technicien ait à remplir un formulaire.
 */
export function detectWorkingFunctions(text: string): string[] {
  const haystack = normalizeText(text);
  const found: string[] = [];
  for (const fn of FUNCTION_TERMS) {
    const re = new RegExp(
      `(?<![a-z0-9])${fn}([^.!?\\n]{0,40}?)(?:${WORKS_VERBS})(?![a-z])( pas| plus)?`,
    );
    const m = re.exec(haystack);
    if (!m) continue;
    if (m[2]) continue; // « fonctionne pas / plus »
    if (/\b(ne|n)\b/.test(m[1] ?? "")) continue; // « ne … pas » entre les deux
    found.push(fn);
  }
  return found;
}

/** Résout un résultat de test enregistré vers le test guidé correspondant. */
function resolveGuidedTest(result: EngineTestResult): GuidedTest | null {
  if (result.testId && GUIDED_TEST_INDEX.has(result.testId)) {
    return GUIDED_TEST_INDEX.get(result.testId)!;
  }
  const haystack = normalizeText(result.text);
  for (const test of GUIDED_TEST_INDEX.values()) {
    if (hasAnyPhrase(haystack, [test.name])) return test;
  }
  return null;
}

export function runEngine(input: EngineInput): EngineResult {
  const text = input.text;
  // Fonctions qui marchent : celles fournies + celles détectées dans le texte.
  const working = [
    ...new Set([
      ...(input.workingFunctions ?? []).map(normalizeText),
      ...detectWorkingFunctions(text),
    ]),
  ];
  const performed = input.performedTests ?? [];

  // 1. Règles dont les conditions matchent les observations.
  const matchedRules = DIAGNOSTIC_RULES.filter((rule) =>
    matchesCondition(text, rule.when),
  );

  // 2. Hypothèses : l'ordre des causes d'une règle EST la priorité initiale.
  const hypotheses = new Map<string, EngineHypothesis>();
  for (const rule of matchedRules) {
    rule.causes.forEach((cause, index) => {
      const baseRank = index === 0 ? 4 : index === 1 ? 3 : 2;
      const existing = hypotheses.get(cause.id);
      const sourceRef = formatSource(rule.source);
      if (existing) {
        if (!existing.sourceRefs.includes(sourceRef)) existing.sourceRefs.push(sourceRef);
        return;
      }
      hypotheses.set(cause.id, {
        id: cause.id,
        label: cause.label,
        likelihood: rankToLikelihood(baseRank),
        supportingEvidence: [`Règle « ${rule.title} » déclenchée par les observations.`],
        contradictingEvidence: [],
        sourceRefs: [sourceRef],
        testIds: cause.testIds ?? [],
      });
    });
  }

  // 3. Les fonctions qui marchent DÉPRIORISENT les dépendances communes
  //    (Base §0 règle 2, §12) — moins probable, pas impossible.
  if (working.length > 0) {
    for (const rule of matchedRules) {
      for (const cause of rule.causes) {
        const isCommon = (cause.components ?? []).some((c) =>
          COMMON_COMPONENTS.includes(c as (typeof COMMON_COMPONENTS)[number]),
        );
        if (!isCommon) continue;
        const hyp = hypotheses.get(cause.id);
        if (!hyp) continue;
        // « Moins probable, sans être impossible » : plancher à unlikely.
        hyp.likelihood = rankToLikelihood(
          Math.max(LIKELIHOOD_RANK[hyp.likelihood] - 2, 1),
        );
        hyp.contradictingEvidence.push(
          `La fonction « ${working.join(", ")} » fonctionne : une dépendance commune est moins probable (sans être impossible).`,
        );
      }
    }
  }

  // 4. Les tests déjà réalisés modifient les hypothèses (jamais redemandés).
  const performedTestIds = new Set<string>();
  for (const result of performed) {
    const test = resolveGuidedTest(result);
    if (!test) continue;
    performedTestIds.add(test.id);
    if (result.status !== "passed" && result.status !== "failed") continue;
    // Convention de la bibliothèque : expectedResults[0] = issue nominale
    // (test réussi), expectedResults[1] = issue en défaut.
    const outcome =
      result.status === "passed" ? test.expectedResults[0] : test.expectedResults[1];
    if (!outcome) continue;
    for (const causeId of outcome.eliminatesCauseIds ?? []) {
      const hyp = hypotheses.get(causeId);
      if (!hyp) continue;
      hyp.likelihood = "unlikely";
      hyp.contradictingEvidence.push(
        `Test « ${test.name} » : ${outcome.result} — ${outcome.meaning}`,
      );
    }
    for (const causeId of outcome.supportsCauseIds ?? []) {
      const hyp = hypotheses.get(causeId);
      if (!hyp) continue;
      hyp.likelihood = rankToLikelihood(
        Math.max(LIKELIHOOD_RANK[hyp.likelihood], 4),
      );
      hyp.supportingEvidence.push(
        `Test « ${test.name} » : ${outcome.result} — ${outcome.meaning}`,
      );
    }
  }

  const sortedHypotheses = [...hypotheses.values()].sort(
    (a, b) => LIKELIHOOD_RANK[b.likelihood] - LIKELIHOOD_RANK[a.likelihood],
  );

  // 5. Prochains tests : suivre l'ordre des hypothèses, exclure le déjà-fait,
  //    puis trier par sécurité (SAFE d'abord) à hypothèse égale.
  const nextTests: EngineNextTest[] = [];
  const seenTests = new Set<string>();
  for (const hyp of sortedHypotheses) {
    if (hyp.likelihood === "unlikely") continue;
    const candidates = hyp.testIds
      .map((id) => GUIDED_TEST_INDEX.get(id))
      .filter((t): t is GuidedTest => Boolean(t))
      .filter((t) => !performedTestIds.has(t.id) && !seenTests.has(t.id))
      .sort((a, b) => SAFETY_ORDER[a.safetyLevel] - SAFETY_ORDER[b.safetyLevel]);
    for (const test of candidates) {
      seenTests.add(test.id);
      nextTests.push({
        test,
        reason: `Vérifie l'hypothèse « ${hyp.label} » (${LIKELIHOOD_LABEL_FR[hyp.likelihood]}).`,
      });
    }
    if (nextTests.length >= 3) break;
  }

  // 6. Comportements normaux, inconnues, contradictions, faits pertinents.
  const haystack = normalizeText(text);
  const normalBehaviors = NORMAL_BEHAVIORS.filter((nb) =>
    matchesCondition(text, nb.when),
  );
  const unknowns = UNKNOWNS.filter((u) => hasAnyPhrase(haystack, u.keywords));
  const contradictions = CONTRADICTIONS.filter((c) =>
    hasAnyPhrase(haystack, c.keywords),
  );
  const facts = findRelevantItems(text).slice(0, 8);

  const cautions = [
    ...new Set(matchedRules.flatMap((r) => r.avoidFirst ?? [])),
  ];
  for (const { test } of nextTests) {
    if (test.safetyLevel === "STOP_MACHINE") {
      cautions.push(
        `⚠️ « ${test.name} » exige la machine ÉTEINTE ET HORS TENSION et une procédure Symp's validée.`,
      );
    }
  }

  const sourceRefs = [
    ...new Set([
      ...matchedRules.map((r) => formatSource(r.source)),
      ...normalBehaviors.map((nb) => formatSource(nb.source)),
      ...unknowns.map((u) => formatSource(u.source)),
      ...facts.map((f) => formatSource(f.source)),
    ]),
  ];

  return {
    matchedRules,
    hypotheses: sortedHypotheses.slice(0, 6),
    nextTests: nextTests.slice(0, 3),
    normalBehaviors,
    unknowns,
    contradictions,
    facts,
    cautions,
    sourceRefs,
  };
}
