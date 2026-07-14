import type { KeywordCondition } from "./types";

/**
 * Correspondance par mots-clés, pur et déterministe. Normalisation commune
 * (minuscules, accents retirés) puis recherche de phrase à frontières de mots
 * — « pas y » ne matche pas « pays ».
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True si la phrase (déjà normalisée) apparaît à frontières de mots. */
export function hasPhrase(normalizedHaystack: string, phrase: string): boolean {
  const p = normalizeText(phrase).trim();
  if (!p) return false;
  const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(p)}(?![a-z0-9])`);
  return re.test(normalizedHaystack);
}

/** True si l'un des termes apparaît. */
export function hasAnyPhrase(normalizedHaystack: string, phrases: string[]): boolean {
  return phrases.some((p) => hasPhrase(normalizedHaystack, p));
}

/**
 * Évalue une condition : chaque groupe de `all` doit matcher (OU interne),
 * aucun terme de `none` ne doit être présent.
 */
export function matchesCondition(text: string, condition: KeywordCondition): boolean {
  const haystack = normalizeText(text);
  if (condition.none && hasAnyPhrase(haystack, condition.none)) return false;
  return condition.all.every((group) => hasAnyPhrase(haystack, group));
}
