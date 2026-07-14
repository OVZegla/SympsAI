import { KNOWLEDGE_ITEMS, KNOWLEDGE_ITEM_INDEX } from "./items";
import { DEPENDENCY_PATHS, COMMON_COMPONENTS } from "./dependencies";
import { DIAGNOSTIC_RULES } from "./rules";
import { NORMAL_BEHAVIORS } from "./normal-behaviors";
import { UNKNOWNS, CONTRADICTIONS } from "./unknowns";
import { GUIDED_TESTS, GUIDED_TEST_INDEX } from "./tests";
import { hasAnyPhrase, normalizeText } from "./match";
import type { KnowledgeItem, KnowledgeSource } from "./types";

/**
 * Point d'entrée de la Base Symp's structurée (couche 1). Le document humain
 * de référence est `knowledge/symps-machines/Symps_AI_Base_Connaissance_v0.1.md`.
 */
export {
  KNOWLEDGE_ITEMS,
  KNOWLEDGE_ITEM_INDEX,
  DEPENDENCY_PATHS,
  COMMON_COMPONENTS,
  DIAGNOSTIC_RULES,
  NORMAL_BEHAVIORS,
  UNKNOWNS,
  CONTRADICTIONS,
  GUIDED_TESTS,
  GUIDED_TEST_INDEX,
};
export * from "./types";
export { normalizeText, hasAnyPhrase, hasPhrase, matchesCondition } from "./match";

/** Référence de citation lisible, ex. "Base Symp's v0.1 — §3 — Communication PC-machine". */
export function formatSource(source: KnowledgeSource): string {
  return source.section ? `${source.document} — ${source.section}` : source.document;
}

/** Faits dont un mot-clé apparaît dans le texte (injection ciblée avant LLM). */
export function findRelevantItems(text: string): KnowledgeItem[] {
  const haystack = normalizeText(text);
  return KNOWLEDGE_ITEMS.filter(
    (item) => item.keywords.length > 0 && hasAnyPhrase(haystack, item.keywords),
  );
}
