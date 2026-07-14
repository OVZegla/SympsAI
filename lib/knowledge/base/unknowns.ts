import type { Contradiction, UnknownItem } from "./types";

/**
 * Inconnues contrôlées (Base §13) : quand la question du technicien touche
 * l'un de ces sujets, l'assistant doit dire que ce n'est pas documenté chez
 * Symp's et NE JAMAIS compléter avec des connaissances générales d'autres
 * imprimantes.
 */
const DOC = "Base Symp's v0.1";
const SECTION = "§13 — Inconnues contrôlées";

export const UNKNOWNS: UnknownItem[] = [
  {
    id: "unk.network_ip",
    topic: "Paramètres réseau exacts",
    statement:
      "Les adresses IP, le masque et la configuration réseau exacts ne sont pas documentés. Ne pas inventer de valeurs.",
    keywords: ["adresse ip", "masque", "parametres reseau", "configuration reseau", "dhcp", "passerelle"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.ultraprint_menu",
    topic: "Nom exact du menu UltraPrint",
    statement:
      "Le nom exact du menu UltraPrint contenant White Ink est inconnu (probablement un menu de type Settings, séparé d'Accuracy et Curve).",
    keywords: ["menu ultraprint", "nom du menu"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.factory_alignment_param",
    topic: "Paramètre usine d'alignement blanc/couleur",
    statement:
      "La valeur exacte du réglage usine d'alignement blanc/couleur de BetterPrinter n'est pas documentée.",
    keywords: ["valeur d'alignement", "parametre d'alignement", "offset usine"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.white_percentage_meaning",
    topic: "Signification exacte du pourcentage de blanc",
    statement:
      "La signification exacte du pourcentage de blanc de BetterPrinter n'est pas documentée.",
    keywords: ["signification du pourcentage", "que veut dire le pourcentage"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.mode2",
    topic: "Rôle du mode 2",
    statement: "La fonction du mode 2 est inconnue : non testée, non documentée.",
    keywords: ["mode 2"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.sensor_units",
    topic: "Unités et algorithme des capteurs",
    statement:
      "Les unités exactes des capteurs de suivi de mur, leurs valeurs cibles et l'algorithme de correction ne sont pas documentés.",
    keywords: ["unite des capteurs", "valeur cible", "algorithme des capteurs", "unites capteurs"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.small_board",
    topic: "Petite carte non identifiée",
    statement: "Le rôle de la petite carte non identifiée est inconnu.",
    keywords: ["petite carte"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.uv_control",
    topic: "Commande UV et ventilation interne",
    statement:
      "Le chemin de commande électronique exact de la lampe UV et la ventilation interne ne sont pas documentés.",
    keywords: ["commande uv", "ventilation", "ventilateurs"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.low_freq_value",
    topic: "Fréquence exacte du test de lignes",
    statement:
      "La valeur définitive du test basse fréquence (1 Hz ou 2 Hz) est à confirmer : le manuel indique 2 Hz, une valeur de 1 Hz a aussi été évoquée.",
    keywords: ["1 hz", "2 hz", "frequence du test"],
    source: { document: DOC, section: SECTION },
  },
  {
    id: "unk.white_without_spot",
    topic: "Encre blanche activée sans Spot Color",
    statement:
      "Le comportement « Encre blanche activée + fichier sans Spot Color » n'a jamais été testé chez Symp's. Impossible de confirmer s'il est normal ou non sans un test contrôlé.",
    keywords: ["sans spot color", "sans canal spot", "fichier sans spot"],
    source: { document: DOC, section: "§8 — Chaîne logicielle / §13" },
  },
];

/** Contradictions conservées telles quelles, jamais tranchées en silence (§15). */
export const CONTRADICTIONS: Contradiction[] = [
  {
    id: "contradiction.low_freq",
    topic: "Fréquence du test de lignes basse fréquence",
    positions: [
      { statement: "Test basse fréquence à 2 Hz", source: "Manuel interne" },
      { statement: "Valeur de 1 Hz évoquée", source: "Retour terrain" },
    ],
    resolution: "UNRESOLVED",
    keywords: ["basse frequence", "1 hz", "2 hz", "test de lignes"],
    source: { document: DOC, section: "§11 — Flash Spray et tests de lignes" },
  },
];
