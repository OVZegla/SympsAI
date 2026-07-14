import type { DependencyPath } from "./types";

/**
 * Graphe de dépendances techniques (Base §2, §3, §5, §6) sous forme de
 * chaînes orientées amont → aval. Le moteur s'en sert pour :
 *  - orienter vers une dépendance COMMUNE quand plusieurs fonctions tombent ;
 *  - DÉPRIORISER les maillons communs quand une fonction qui les traverse
 *    fonctionne encore.
 */
const DOC = "Base Symp's v0.1";

/** Maillons partagés par plusieurs fonctions (blanc + couleur + commande). */
export const COMMON_COMPONENTS = [
  "alimentation generale",
  "multipoints",
  "carte principale",
  "carte fille",
  "commande globale",
] as const;

export const DEPENDENCY_PATHS: DependencyPath[] = [
  {
    id: "dep.network",
    title: "Chemin réseau PC → carte principale",
    chain: [
      "pc rj45",
      "base",
      "chemin interne et multipoints",
      "connecteur arriere du bloc",
      "rj45 interne",
      "carte principale",
    ],
    functions: ["communication"],
    source: { document: DOC, section: "§3 — Communication PC-machine" },
  },
  {
    id: "dep.power",
    title: "Chaîne d'alimentation",
    chain: [
      "secteur machine",
      "contacteur et bornier de la base",
      "alimentations grises et servo-drivers",
      "moteurs et cable multipoints",
      "carte principale du bloc",
      "sous-systemes du bloc",
    ],
    functions: ["alimentation", "blanc", "couleur", "mouvements"],
    source: { document: DOC, section: "§2 — Architecture électrique" },
  },
  {
    id: "dep.white_ink",
    title: "Circuit d'encre blanc",
    chain: ["reservoir blanc", "tuyau", "damper blanc", "tete blanche", "buses"],
    functions: ["blanc"],
    source: { document: DOC, section: "§6 — Circuit d'encre" },
  },
  {
    id: "dep.white_data",
    title: "Commande de la tête blanche",
    chain: ["carte principale", "carte fille", "port p1", "nappes", "tete blanche"],
    functions: ["blanc"],
    source: { document: DOC, section: "§5 — Têtes et électronique" },
  },
  {
    id: "dep.color_data",
    title: "Commande de la tête couleur",
    chain: ["carte principale", "carte fille", "port p2", "nappes", "tete couleur"],
    functions: ["couleur"],
    source: { document: DOC, section: "§5 — Têtes et électronique" },
  },
  {
    id: "dep.color_ink",
    title: "Circuit d'encre couleur",
    chain: ["reservoirs cmjn", "tuyaux", "dampers couleur", "tete couleur", "buses"],
    functions: ["couleur"],
    source: { document: DOC, section: "§6 — Circuit d'encre" },
  },
];
