import type { KnowledgeItem } from "./types";

/**
 * Faits techniques extraits de la Base Symp's v0.1 (le document Markdown dans
 * `knowledge/symps-machines/` reste la référence humaine — ici uniquement ce
 * que le moteur et l'assistant exploitent). Chaque fait garde sa section
 * d'origine pour la citation.
 */
const DOC = "Base Symp's v0.1";
const V = "0.1";

export const KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: "vocab.axes",
    title: "Axes X et Y",
    category: "vocabulaire",
    statement:
      "Chez Symp's : l'axe X est le déplacement VERTICAL du bloc d'impression (montée/descente) ; l'axe Y est le déplacement HORIZONTAL de la machine entière sur ses roues. Ne jamais inverser X et Y.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§1 — Vocabulaire contrôlé", version: V },
    keywords: ["axe x", "axe y", "vertical", "horizontal", "montee", "descente", "deplacement", "monte", "descend"],
    tags: ["axes"],
  },
  {
    id: "vocab.depth",
    title: "Profondeur",
    category: "vocabulaire",
    statement:
      "La profondeur est l'avance/recul du module avant par rapport au chariot arrière. Ne pas lui attribuer de lettre d'axe non confirmée.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§1 — Vocabulaire contrôlé", version: V },
    keywords: ["profondeur", "avance", "recul", "module avant"],
  },
  {
    id: "power.pc_independent",
    title: "Alimentation du PC",
    category: "electricite",
    statement:
      "Le PC a sa propre alimentation et peut fonctionner machine éteinte.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§2 — Architecture électrique", version: V },
    keywords: ["pc", "ordinateur", "alimentation"],
  },
  {
    id: "power.motors_hold",
    title: "Maintien des moteurs",
    category: "electricite",
    statement: "Sous tension, les moteurs maintiennent leur position.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§2 — Architecture électrique", version: V },
    keywords: ["moteur", "maintien", "axe libre", "sous tension"],
    relatedTests: ["test.motor_hold"],
  },
  {
    id: "power.green_led_32v",
    title: "LED verte de la carte principale",
    category: "electricite",
    statement:
      "La LED verte de la carte principale indique uniquement la présence du 32 V. Une LED ne prouve jamais le bon fonctionnement complet d'une carte.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§2 — Architecture électrique (+ §0 Règles)", version: V },
    keywords: ["led verte", "carte principale", "32 v", "32v"],
    components: ["carte principale"],
  },
  {
    id: "power.multipin",
    title: "Câble multipoints",
    category: "electricite",
    statement:
      "Le câble multipoints transporte alimentation, commandes et communication entre la base et le bloc. Une fonction qui marche ne valide pas toutes les broches du multipoints.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§2 — Architecture électrique", version: V },
    keywords: ["multipoints", "multipin", "cable"],
    components: ["multipoints"],
    relatedTests: ["test.multipin_check"],
  },
  {
    id: "power.terminal_block",
    title: "Bornier de la base",
    category: "electricite",
    statement:
      "Bornier : connecteur supérieur = axe Y horizontal ; connecteur central = axe X vertical ; connecteur inférieur = alimentation.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§2 — Architecture électrique", version: V },
    keywords: ["bornier", "connecteur"],
    components: ["bornier"],
  },
  {
    id: "network.led_behavior",
    title: "LED Ethernet",
    category: "communication",
    statement:
      "Les seules LED Ethernet visibles sont sur le port du PC. PC et machine allumés, les LED Ethernet doivent s'allumer même si BetterPrinter est fermé.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§3 — Communication PC-machine", version: V },
    keywords: ["led ethernet", "no connect", "connexion", "rj45", "reseau", "ethernet"],
    relatedTests: ["test.ethernet_leds"],
    relatedRules: ["rule.net_no_connect_led_off", "rule.net_no_connect_led_on"],
  },
  {
    id: "movement.cycle",
    title: "Cycle d'impression",
    category: "mouvements",
    statement:
      "Cycle confirmé : montée X complète en imprimant → petit pas Y vers la droite → descente X complète en imprimant → petit pas Y vers la droite. L'axe Y ne se déplace pas pendant le passage vertical ; il n'y a pas de trajectoire diagonale. Les têtes impriment en montée ET en descente.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§4 — Mouvements et cycle d'impression", version: V },
    keywords: ["cycle", "trajectoire", "diagonale", "pas y", "montee", "descente"],
  },
  {
    id: "heads.mapping",
    title: "Têtes et carte fille JETHIO",
    category: "tetes",
    statement:
      "Deux têtes Epson I1600 : blanche sur le port P1 de la carte fille JETHIO, couleur sur P2. Correspondance stricte P1-1→J1 … P1-4→J4 (idem P2) ; J1 = supérieur/avant, J2 = supérieur/arrière, J3 = inférieur/avant, J4 = inférieur/arrière. Ne pas croiser les nappes.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§5 — Têtes et électronique", version: V },
    keywords: ["tete blanche", "tete couleur", "jethio", "p1", "p2", "nappe", "carte fille", "i1600"],
    components: ["carte fille", "nappes", "tete blanche", "tete couleur"],
    relatedTests: ["test.ribbons_p1p2"],
    safetyLevel: "CAUTION",
  },
  {
    id: "ink.path",
    title: "Circuit d'encre",
    category: "encre",
    statement:
      "Chemin d'encre : réservoir → tuyau → damper → tête → buses. Cinq réservoirs (CMJN + blanc). Tête couleur : quatre dampers, ordre documenté du bas vers le haut M, C, Y, K. Mélangeur blanc au-dessus du réservoir, fonctionnement apparemment temporisé. Aucune pompe ni capteur de densité confirmés.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§6 — Circuit d'encre", version: V },
    keywords: ["reservoir", "damper", "encre", "buse", "melangeur", "tuyau"],
    components: ["reservoir", "dampers", "buses"],
    relatedTests: ["test.dampers_bubbles"],
  },
  {
    id: "white.progression",
    title: "Progression blanc/couleur",
    category: "pipeline_blanc",
    statement:
      "La tête blanche est physiquement à droite de la tête couleur ; la machine progresse vers la droite, donc la tête blanche atteint une nouvelle zone AVANT la tête couleur. Les deux têtes travaillent dans le même cycle global, pas en deux impressions séparées.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§7 — Pipeline blanc + couleur", version: V },
    keywords: ["bord blanc", "avance", "progression", "blanc et couleur", "recouvre"],
  },
  {
    id: "white.alignment_factory",
    title: "Alignement blanc/couleur (réglage usine)",
    category: "pipeline_blanc",
    statement:
      "BetterPrinter possède un réglage d'alignement blanc/couleur configuré en usine. Ne pas le modifier en première intention : un liseré blanc régulier doit d'abord faire vérifier le canal Spot Color et la contraction de sélection dans Photoshop.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§7 — Pipeline blanc + couleur", version: V },
    keywords: ["alignement", "lisere", "reglage usine"],
    tags: ["reglage_usine"],
  },
  {
    id: "software.chain",
    title: "Chaîne logicielle du blanc",
    category: "logiciel",
    statement:
      "Photoshop : sélectionner la zone blanche → contracter la sélection d'environ 2 mm vers l'intérieur → créer le canal Spot Color → enregistrer le TIFF avec les Spot Colors (le blanc est ainsi légèrement plus petit que la couleur, ce qui évite un liseré). UltraPrint : régler White Ink = Spot Color (menu séparé d'Accuracy/Curve ; l'intensité du blanc ne s'y règle pas) → générer le PRN. BetterPrinter : charger le PRN, activer l'encre blanche, régler le pourcentage de blanc, lancer l'impression.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§8 — Chaîne logicielle", version: V },
    keywords: ["photoshop", "spot color", "tiff", "ultraprint", "prn", "betterprinter", "encre blanche", "pourcentage de blanc", "white ink"],
    relatedTests: ["test.spot_color_present", "test.ultraprint_white_ink", "test.bp_white_enabled"],
  },
  {
    id: "software.spot_optional",
    title: "Spot Color et encre blanche",
    category: "logiciel",
    statement:
      "Un fichier AVEC Spot Color peut imprimer sans blanc si « Encre blanche » est désactivé dans BetterPrinter. Un fichier SANS Spot Color peut imprimer en couleur sans blanc. Le comportement « Encre blanche activée + fichier sans Spot Color » est UNKNOWN : jamais testé.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§8 — Chaîne logicielle", version: V },
    keywords: ["spot color", "encre blanche"],
  },
  {
    id: "wall.architecture",
    title: "Suivi automatique du mur",
    category: "suivi_mur",
    statement:
      "Le chariot arrière monte/descend sur X ; le module avant avance/recule sur un rail interne (petite courroie, deux poulies). Deux capteurs jaunes : le supérieur anticipe pendant la montée, l'inférieur pendant la descente ; leurs valeurs sont affichées séparément. Une main devant un capteur provoque normalement le recul quand l'automatisme est actif.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§9 — Suivi automatique du mur", version: V },
    keywords: ["capteur", "suivi", "mur", "chariot", "rail", "poulie"],
    relatedTests: ["test.sensor_top", "test.sensor_bottom"],
  },
  {
    id: "wall.modes",
    title: "Modes de profondeur",
    category: "suivi_mur",
    statement:
      "Mode 1 : profondeur fixe, flèches manuelles, aucune correction automatique. Mode 2 : fonction UNKNOWN. Mode 3 : suivi automatique continu, même hors impression.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§9 — Suivi automatique du mur", version: V },
    keywords: ["mode 1", "mode 2", "mode 3", "profondeur"],
    relatedTests: ["test.mode3", "test.manual_depth"],
  },
  {
    id: "wall.green_button",
    title: "Bouton vert",
    category: "suivi_mur",
    statement:
      "Le bouton vert désactive/bloque la correction automatique sans bloquer physiquement le module ; les flèches manuelles restent actives. Risque de frottement s'il est activé en mode 3.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§9 — Suivi automatique du mur", version: V },
    keywords: ["bouton vert"],
    relatedTests: ["test.green_button"],
  },
  {
    id: "wall.positioning",
    title: "Positionnement avant impression",
    category: "suivi_mur",
    statement:
      "Positionnement : module à mi-course avant approche, mode 3, bouton vert non activé, bord noir à environ 6–8 cm du mur, machine parallèle, distance finale d'impression environ 0,5–0,8 cm.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§9 — Suivi automatique du mur", version: V },
    keywords: ["positionnement", "distance", "parallele", "mur"],
    relatedTests: ["test.parallelism"],
  },
  {
    id: "uv.behavior",
    title: "Lampe UV",
    category: "uv",
    statement:
      "Lampe UV sous la zone d'impression, active pendant l'impression en montée et en descente, éteinte hors impression selon les observations actuelles. Puissance réglée par potentiomètre physique. Deux filtres bas = entrées d'air. Commande électronique et ventilation internes exactes : UNKNOWN.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§10 — UV, laser et écran", version: V },
    keywords: ["uv", "lampe", "potentiometre"],
    safetyLevel: "CAUTION",
  },
  {
    id: "laser.marker",
    title: "Laser",
    category: "uv",
    statement:
      "Le laser est un repère visuel de départ d'impression. Ce n'est PAS un capteur de distance.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§10 — UV, laser et écran", version: V },
    keywords: ["laser"],
  },
  {
    id: "flash.spray_256",
    title: "Flash Spray 256 Hz",
    category: "tests",
    statement:
      "Flash Spray (BetterPrinter) à 256 Hz : feuille à environ 15–20 cm, environ cinq secondes. Vérifie l'éjection générale et aide à dégager certaines impuretés.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§11 — Flash Spray et tests de lignes", version: V },
    keywords: ["flash spray", "256"],
    relatedTests: ["test.flash_spray_256"],
  },
  {
    id: "flash.low_freq",
    title: "Test de lignes basse fréquence",
    category: "tests",
    statement:
      "Test basse fréquence : 2 Hz selon le manuel (une valeur de 1 Hz a aussi été évoquée — contradiction non résolue). Feuille proche de la tête, environ cinq secondes ; lignes couleur d'un côté, blanc de l'autre ; les lignes doivent être continues.",
    certainty: "CONFIRMED_MANUAL",
    status: "CONTRADICTED",
    source: { document: DOC, section: "§11 — Flash Spray et tests de lignes", version: V },
    keywords: ["basse frequence", "test de lignes", "1 hz", "2 hz"],
    contradictoryItemIds: ["contradiction.low_freq"],
    relatedTests: ["test.low_freq_lines"],
  },
  {
    id: "rules.method",
    title: "Méthode de diagnostic",
    category: "methode",
    statement:
      "Séparer faits, attentes et hypothèses. Utiliser les fonctions qui marchent pour déprioriser certaines causes. Chercher d'abord les dépendances communes quand plusieurs fonctions sont en panne. Commencer par les tests simples, sûrs et réversibles. Ne pas modifier un réglage usine avant d'avoir éliminé le fichier, le logiciel et les causes mécaniques simples.",
    certainty: "CONFIRMED_USER",
    status: "CONFIRMED",
    source: { document: DOC, section: "§0 — Règles fondamentales", version: V },
    keywords: [],
    tags: ["methode"],
  },
  {
    id: "ink.extraction",
    title: "Extraction d'encre à la tête",
    category: "encre",
    statement:
      "Extraction : desserrer les bouchons des réservoirs, protéger la lampe UV, poser l'extracteur sur la tête, tirer progressivement à la seringue en plusieurs étapes jusqu'à obtenir encre, pression et absence de bulles, essuyer doucement sans frotter.",
    certainty: "CONFIRMED_MANUAL",
    status: "CONFIRMED",
    source: { document: DOC, section: "§6 — Circuit d'encre (Extraction)", version: V },
    keywords: ["extraction", "seringue", "amorcage", "amorce"],
    safetyLevel: "CAUTION",
  },
];

export const KNOWLEDGE_ITEM_INDEX: ReadonlyMap<string, KnowledgeItem> = new Map(
  KNOWLEDGE_ITEMS.map((i) => [i.id, i]),
);
