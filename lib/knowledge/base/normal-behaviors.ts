import type { NormalBehavior } from "./types";

/**
 * Comportements NORMAUX à ne pas signaler comme pannes (Base §4, §7, §10).
 * Le moteur les remonte quand la description matche, pour que l'assistant
 * réponde « ce n'est pas forcément une panne » au lieu d'ouvrir un diagnostic.
 */
const DOC = "Base Symp's v0.1";

export const NORMAL_BEHAVIORS: NormalBehavior[] = [
  {
    id: "nb.transparency_no_ink",
    title: "Transparence du fichier",
    statement:
      "Le bloc peut continuer à monter ou descendre sans projeter d'encre lorsque la zone du fichier est transparente : l'éjection suit les pixels du fichier. Un vide exactement conforme à la transparence du fichier est normal.",
    abnormalCounterpart:
      "Des manques qui ne correspondent PAS aux zones transparentes du fichier sont à diagnostiquer (encre, bulles, nappes, alimentation, communication).",
    when: {
      all: [
        ["transparente", "transparence", "transparent"],
      ],
    },
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§4 — Mouvements / §12 Qualité" },
  },
  {
    id: "nb.white_edge_temporary",
    title: "Bord blanc temporaire pendant l'impression",
    statement:
      "La tête blanche est physiquement en avance : pendant une impression blanc + couleur, le blanc peut apparaître seul au début, rester en avance en phase centrale, et un bord blanc net peut apparaître temporairement à la fin avant que la tête couleur ne le recouvre. Un bord blanc temporaire AVANT la fin complète est normal.",
    abnormalCounterpart:
      "Un bord blanc encore visible APRÈS la fin complète, alors que de la couleur était prévue, est anormal.",
    when: {
      all: [
        ["bord blanc", "blanc seul", "blanc en avance", "blanc apparait"],
      ],
      none: ["apres la fin", "fin complete", "impression terminee", "une fois terminee"],
    },
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§7 — Pipeline blanc + couleur" },
  },
  {
    id: "nb.no_diagonal",
    title: "Pas de trajectoire diagonale",
    statement:
      "Le cycle est : montée X complète en imprimant → pas Y à droite → descente X complète en imprimant → pas Y à droite. L'absence de mouvement diagonal simultané X/Y pendant le passage vertical est normale.",
    when: {
      all: [["diagonale", "diagonal"]],
    },
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§4 — Mouvements et cycle d'impression" },
  },
  {
    id: "nb.uv_off_idle",
    title: "UV éteinte hors impression",
    statement:
      "La lampe UV est active pendant l'impression (montée et descente) et éteinte hors impression selon les observations actuelles : une UV éteinte machine à l'arrêt n'est pas une panne.",
    when: {
      all: [["uv"], ["eteinte", "eteint"]],
      none: ["pendant l'impression", "en imprimant"],
    },
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§10 — UV, laser et écran" },
  },
  {
    id: "nb.motors_hold_position",
    title: "Moteurs tenus sous tension",
    statement:
      "Sous tension, les moteurs maintiennent leur position : une résistance au déplacement manuel machine allumée est normale.",
    when: {
      all: [["moteur", "moteurs", "axe"], ["resiste", "bloque", "dur a bouger", "tenu"]],
    },
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§2 — Architecture électrique" },
  },
];
