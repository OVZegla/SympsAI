/**
 * Couche 1 — connaissance technique structurée (Base Symp's v0.1).
 *
 * Le document humain de référence vit dans
 * `knowledge/symps-machines/Symps_AI_Base_Connaissance_v0.1.md` (versionné
 * git). Les modules de `lib/knowledge/base/` en sont la représentation
 * exploitable par le code : chaque élément porte sa certitude, sa source
 * (document + section) et son statut de validation. Le moteur de diagnostic
 * (lib/diagnosis/engine.ts) ne raisonne QUE sur ces éléments — jamais sur la
 * mémoire du modèle.
 */

export type CertaintyLevel =
  | "CONFIRMED_USER" // confirmé directement par Loïc
  | "CONFIRMED_MANUAL" // confirmé par une documentation interne identifiée
  | "PROBABLE" // hypothèse cohérente mais non vérifiée
  | "UNKNOWN" // non testé ou non documenté
  | "DO_NOT_INVENT"; // ne jamais compléter par imagination

export type KnowledgeStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "DEPRECATED"
  | "CONTRADICTED";

export type SafetyLevel = "SAFE" | "CAUTION" | "STOP_MACHINE";

export interface KnowledgeSource {
  document: string;
  section?: string;
  version?: string;
  verifiedAt?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  statement: string;
  certainty: CertaintyLevel;
  status: KnowledgeStatus;
  source: KnowledgeSource;
  machineModels?: string[];
  components?: string[];
  dependencies?: string[];
  relatedSymptoms?: string[];
  relatedTests?: string[];
  relatedRules?: string[];
  safetyLevel?: SafetyLevel;
  tags?: string[];
  contradictoryItemIds?: string[];
  notes?: string;
  /** Mots-clés (normalisés sans accents) déclenchant l'injection de ce fait. */
  keywords: string[];
}

/** Chaîne de dépendance technique orientée (ex. PC → RJ45 → … → carte). */
export interface DependencyPath {
  id: string;
  title: string;
  /** Maillons dans l'ordre, du plus amont au plus aval. */
  chain: string[];
  /** Fonctions desservies (ex. "blanc", "couleur", "communication"). */
  functions: string[];
  source: KnowledgeSource;
}

/**
 * Condition de correspondance par mots-clés : `all` = chaque groupe doit
 * matcher (ET), un groupe matche si l'un de ses termes est présent (OU) ;
 * `none` = aucun de ces termes ne doit être présent.
 */
export interface KeywordCondition {
  all: string[][];
  none?: string[];
}

export interface RuleCause {
  id: string;
  label: string;
  /** Composants/étapes impliqués — sert à relier tests et dépendances. */
  components?: string[];
  /** Tests guidés qui vérifient cette cause, dans l'ordre recommandé. */
  testIds?: string[];
}

/**
 * Règle de diagnostic déterministe (Base §3, §12) : si les observations
 * matchent `when`, les causes sont proposées dans l'ordre `causes` (la
 * première est la plus probable). `deprioritizedCauseIds` liste les causes à
 * déclasser parce qu'une fonction qui marche les rend moins plausibles.
 */
export interface DiagnosticRule {
  id: string;
  title: string;
  when: KeywordCondition;
  causes: RuleCause[];
  deprioritizedCauseIds?: string[];
  /** Ce que la règle interdit de faire en première intention. */
  avoidFirst?: string[];
  certainty: CertaintyLevel;
  source: KnowledgeSource;
  notes?: string;
}

/** Comportement normal à ne pas signaler comme panne (Base §4, §7, §12). */
export interface NormalBehavior {
  id: string;
  title: string;
  statement: string;
  /** Ce qui, en revanche, est anormal dans le même registre. */
  abnormalCounterpart?: string;
  when: KeywordCondition;
  certainty: CertaintyLevel;
  source: KnowledgeSource;
}

/** Inconnue contrôlée (Base §13) : ne jamais inventer la réponse. */
export interface UnknownItem {
  id: string;
  topic: string;
  statement: string;
  keywords: string[];
  source: KnowledgeSource;
}

/** Contradiction non résolue conservée telle quelle (Base §11, §15). */
export interface Contradiction {
  id: string;
  topic: string;
  positions: { statement: string; source: string }[];
  resolution: "UNRESOLVED" | "RESOLVED";
  keywords: string[];
  source: KnowledgeSource;
}

export interface GuidedTestExpectedResult {
  result: string;
  meaning: string;
  /** Causes que ce résultat écarte (likelihood → peu probable). */
  eliminatesCauseIds?: string[];
  /** Causes que ce résultat renforce. */
  supportsCauseIds?: string[];
  nextTestIds?: string[];
}

/** Test guidé réutilisable (§10 du cahier d'intégration). */
export interface GuidedTest {
  id: string;
  name: string;
  objective: string;
  prerequisites: string[];
  instructions: string[];
  expectedResults: GuidedTestExpectedResult[];
  safetyLevel: SafetyLevel;
  estimatedDuration?: string;
  applicableModels?: string[];
  sourceIds: string[];
  source: KnowledgeSource;
}
