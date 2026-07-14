import type { GuidedTest } from "./types";

/**
 * Bibliothèque de tests guidés (Base §9-§11 + cahier d'intégration §10).
 * Chaque test est sûr d'abord : aucun test destructif ou non documenté n'est
 * inclus. Le moteur les propose dans l'ordre sécurité → simplicité →
 * capacité à éliminer des hypothèses, et n'invente jamais de procédure.
 */
const DOC = "Base Symp's v0.1";

export const GUIDED_TESTS: GuidedTest[] = [
  {
    id: "test.ethernet_leds",
    name: "Vérification des LED Ethernet",
    objective: "Vérifier le lien physique PC ↔ machine.",
    prerequisites: ["PC allumé", "Machine allumée"],
    instructions: [
      "Regarder les LED du port RJ45 du PC (seules LED visibles).",
      "PC et machine allumés, elles doivent s'allumer même si BetterPrinter est fermé.",
    ],
    expectedResults: [
      {
        result: "LED allumées",
        meaning: "Lien physique probable : examiner logiciel, configuration ou carte.",
        eliminatesCauseIds: ["physical_network_path"],
        supportsCauseIds: ["software_or_configuration"],
      },
      {
        result: "LED éteintes",
        meaning: "Priorité au chemin physique (RJ45, base, multipoints, connecteur arrière, RJ45 interne, carte).",
        supportsCauseIds: ["physical_network_path"],
        nextTestIds: ["test.multipin_check"],
      },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "1 min",
    sourceIds: ["network.led_behavior"],
    source: { document: DOC, section: "§3 — Communication PC-machine" },
  },
  {
    id: "test.motor_hold",
    name: "Vérification du maintien des moteurs sous tension",
    objective: "Vérifier que les moteurs sont alimentés et asservis.",
    prerequisites: ["Machine sous tension"],
    instructions: [
      "Sans forcer, sentir si l'axe résiste au déplacement manuel.",
      "Sous tension, les moteurs doivent maintenir leur position.",
    ],
    expectedResults: [
      { result: "Axe tenu", meaning: "Alimentation et maintien OK ; chercher côté commande.", eliminatesCauseIds: ["power_driver_motor_hold", "common_power"] },
      { result: "Axe libre", meaning: "Alimentation, servo-driver, moteur ou maintien en cause.", supportsCauseIds: ["power_driver_motor_hold"] },
    ],
    safetyLevel: "CAUTION",
    estimatedDuration: "2 min",
    sourceIds: ["power.motors_hold"],
    source: { document: DOC, section: "§2 — Architecture électrique" },
  },
  {
    id: "test.flash_spray_256",
    name: "Flash Spray 256 Hz",
    objective: "Vérifier l'éjection générale des têtes et dégager certaines impuretés.",
    prerequisites: ["BetterPrinter connecté", "Feuille à ~15-20 cm"],
    instructions: [
      "Lancer Flash Spray à 256 Hz dans BetterPrinter.",
      "Tenir la feuille à environ 15-20 cm pendant ~5 secondes.",
    ],
    expectedResults: [
      { result: "Blanc présent", meaning: "La tête blanche et son circuit fonctionnent au moins partiellement : chercher côté fichier/logiciel.", eliminatesCauseIds: ["white_head", "white_ink_path"], supportsCauseIds: ["photoshop_spot_color", "ultraprint_white_ink"] },
      { result: "Blanc absent", meaning: "Circuit blanc : amorçage, bulles, dampers, tête, nappes P1, carte fille.", supportsCauseIds: ["white_ink_path", "priming_and_bubbles"], nextTestIds: ["test.low_freq_lines", "test.dampers_bubbles"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "2 min",
    sourceIds: ["flash.spray_256"],
    source: { document: DOC, section: "§11 — Flash Spray et tests de lignes" },
  },
  {
    id: "test.low_freq_lines",
    name: "Test de lignes basse fréquence",
    objective: "Vérifier la continuité des lignes de chaque tête.",
    prerequisites: ["Feuille proche de la tête"],
    instructions: [
      "Lancer le test basse fréquence (2 Hz selon le manuel ; une valeur de 1 Hz a été évoquée — contradiction non résolue).",
      "~5 secondes ; lignes couleur d'un côté, blanc de l'autre.",
      "Les lignes doivent être continues.",
    ],
    expectedResults: [
      { result: "Lignes continues", meaning: "Buses OK." },
      { result: "Lignes interrompues", meaning: "Buses/encre : amorçage, bulles, dampers.", supportsCauseIds: ["priming_and_bubbles", "white_dampers"], nextTestIds: ["test.dampers_bubbles"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "3 min",
    sourceIds: ["flash.low_freq"],
    source: { document: DOC, section: "§11 — Flash Spray et tests de lignes" },
  },
  {
    id: "test.spot_color_present",
    name: "Contrôle de la présence du canal Spot Color",
    objective: "Vérifier la préparation du fichier blanc dans Photoshop.",
    prerequisites: ["Fichier source ouvert dans Photoshop"],
    instructions: [
      "Vérifier la sélection de la zone blanche et sa contraction (~2 mm vers l'intérieur).",
      "Vérifier la présence du canal Spot Color.",
      "Vérifier que le TIFF est enregistré avec les Spot Colors.",
    ],
    expectedResults: [
      { result: "Canal présent et contracté", meaning: "Fichier OK : passer à UltraPrint.", eliminatesCauseIds: ["photoshop_spot_color", "tiff_saved_with_spot_colors", "spot_color_contraction"], nextTestIds: ["test.ultraprint_white_ink"] },
      { result: "Canal absent ou non contracté", meaning: "Corriger le fichier puis régénérer le PRN.", supportsCauseIds: ["photoshop_spot_color", "spot_color_contraction"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "5 min",
    sourceIds: ["software.chain"],
    source: { document: DOC, section: "§8 — Chaîne logicielle (Photoshop)" },
  },
  {
    id: "test.ultraprint_white_ink",
    name: "Contrôle White Ink = Spot Color dans UltraPrint",
    objective: "Vérifier la conversion TIFF → PRN pour le blanc.",
    prerequisites: ["UltraPrint ouvert"],
    instructions: [
      "Vérifier que White Ink est réglé sur Spot Color (menu séparé d'Accuracy et Curve ; nom exact du menu UNKNOWN).",
      "Régénérer le PRN si le réglage a changé.",
    ],
    expectedResults: [
      { result: "White Ink = Spot Color", meaning: "Conversion OK : passer à BetterPrinter.", eliminatesCauseIds: ["ultraprint_white_ink", "prn_regenerated"], nextTestIds: ["test.bp_white_enabled"] },
      { result: "Autre réglage", meaning: "Corriger puis régénérer le PRN.", supportsCauseIds: ["ultraprint_white_ink"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "3 min",
    sourceIds: ["software.chain"],
    source: { document: DOC, section: "§8 — Chaîne logicielle (UltraPrint)" },
  },
  {
    id: "test.bp_white_enabled",
    name: "Contrôle de l'activation de l'encre blanche",
    objective: "Vérifier les réglages blancs de BetterPrinter.",
    prerequisites: ["BetterPrinter ouvert", "PRN chargé"],
    instructions: [
      "Vérifier que « Encre blanche » est activée.",
      "Vérifier le pourcentage de blanc.",
    ],
    expectedResults: [
      { result: "Activée, pourcentage plausible", meaning: "Réglages machine OK.", eliminatesCauseIds: ["betterprinter_white_enabled", "betterprinter_white_percentage"] },
      { result: "Désactivée", meaning: "Un fichier avec Spot Color imprime sans blanc si l'option est désactivée.", supportsCauseIds: ["betterprinter_white_enabled"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "1 min",
    sourceIds: ["software.chain", "software.spot_optional"],
    source: { document: DOC, section: "§8 — Chaîne logicielle (BetterPrinter)" },
  },
  {
    id: "test.manual_depth",
    name: "Test manuel de profondeur",
    objective: "Vérifier le déplacement avant/arrière du module hors automatisme.",
    prerequisites: ["Machine sous tension", "Écran d'accueil"],
    instructions: ["Utiliser les flèches de l'écran d'accueil pour avancer/reculer le module."],
    expectedResults: [
      { result: "Le module bouge", meaning: "Moteur et mécanique de profondeur OK : chercher côté automatisme (bouton vert, mode, capteurs, logique).", eliminatesCauseIds: [], supportsCauseIds: ["green_button_state", "mode_selection", "wall_sensors", "sensor_wiring_logic"] },
      { result: "Aucun mouvement", meaning: "Chaîne moteur/mécanique de profondeur en cause.", nextTestIds: [] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "1 min",
    sourceIds: ["wall.modes"],
    source: { document: DOC, section: "§9 / §10 — Écran" },
  },
  {
    id: "test.mode3",
    name: "Test du mode 3 (suivi automatique)",
    objective: "Vérifier la correction automatique de profondeur.",
    prerequisites: ["Mode 3 sélectionné", "Bouton vert NON activé"],
    instructions: [
      "Activer le mode 3 (suivi automatique continu, même hors impression).",
      "Passer une main devant un capteur : le module doit normalement reculer.",
    ],
    expectedResults: [
      { result: "Le module recule", meaning: "Suivi automatique fonctionnel.", eliminatesCauseIds: ["green_button_state", "mode_selection", "wall_sensors"] },
      { result: "Aucune réaction", meaning: "Vérifier bouton vert, capteurs, câblage, logique.", nextTestIds: ["test.green_button", "test.sensor_top", "test.sensor_bottom"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "2 min",
    sourceIds: ["wall.modes", "wall.architecture"],
    source: { document: DOC, section: "§9 — Suivi automatique du mur" },
  },
  {
    id: "test.sensor_top",
    name: "Test séparé du capteur haut",
    objective: "Vérifier le capteur supérieur (anticipation en montée).",
    prerequisites: ["Mode 3", "Bouton vert non activé"],
    instructions: [
      "Lire la valeur affichée du capteur supérieur.",
      "Passer une main devant : la valeur doit changer et provoquer un recul.",
    ],
    expectedResults: [
      { result: "Valeur réagit + recul", meaning: "Capteur haut OK.", eliminatesCauseIds: [] },
      { result: "Valeur réagit sans recul", meaning: "Détection active : défaut entre logique et actionnement.", supportsCauseIds: ["logic_to_actuation"] },
      { result: "Valeur figée", meaning: "Capteur haut ou câblage en cause.", supportsCauseIds: ["wall_sensors"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "2 min",
    sourceIds: ["wall.architecture"],
    source: { document: DOC, section: "§9 — Capteurs" },
  },
  {
    id: "test.sensor_bottom",
    name: "Test séparé du capteur bas",
    objective: "Vérifier le capteur inférieur (anticipation en descente).",
    prerequisites: ["Mode 3", "Bouton vert non activé"],
    instructions: [
      "Lire la valeur affichée du capteur inférieur.",
      "Passer une main devant : la valeur doit changer et provoquer un recul.",
    ],
    expectedResults: [
      { result: "Valeur réagit + recul", meaning: "Capteur bas OK." },
      { result: "Valeur figée", meaning: "Capteur bas ou câblage en cause.", supportsCauseIds: ["wall_sensors"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "2 min",
    sourceIds: ["wall.architecture"],
    source: { document: DOC, section: "§9 — Capteurs" },
  },
  {
    id: "test.green_button",
    name: "Contrôle du bouton vert",
    objective: "Vérifier que la correction automatique n'est pas volontairement bloquée.",
    prerequisites: [],
    instructions: [
      "Vérifier l'état du bouton vert : activé, il désactive la correction automatique (les flèches manuelles restent actives).",
    ],
    expectedResults: [
      { result: "Bouton activé", meaning: "Cause probable du suivi inactif : le désactiver (risque de frottement s'il reste activé en mode 3).", supportsCauseIds: ["green_button_state"] },
      { result: "Bouton non activé", meaning: "Chercher côté mode, capteurs, câblage.", eliminatesCauseIds: ["green_button_state"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "30 s",
    sourceIds: ["wall.green_button"],
    source: { document: DOC, section: "§9 — Bouton vert" },
  },
  {
    id: "test.multipin_check",
    name: "Contrôle du multipoints",
    objective: "Vérifier le câble multipoints base ↔ bloc (alimentation, commandes, communication).",
    prerequisites: ["MACHINE ÉTEINTE avant toute manipulation de connecteur"],
    instructions: [
      "Machine éteinte, contrôler visuellement le branchement et l'état du multipoints aux deux extrémités.",
      "Rebrancher fermement sans forcer.",
      "Rappel : une fonction qui marche ne valide pas toutes les broches.",
    ],
    expectedResults: [
      { result: "Connecteurs corrects", meaning: "Poursuivre sur les maillons suivants du chemin.", nextTestIds: [] },
      { result: "Connecteur déboîté/abîmé", meaning: "Cause physique plausible.", supportsCauseIds: ["physical_network_path", "multipin", "command_chain"] },
    ],
    safetyLevel: "CAUTION",
    estimatedDuration: "5 min",
    sourceIds: ["power.multipin"],
    source: { document: DOC, section: "§2 — Architecture électrique" },
  },
  {
    id: "test.ribbons_p1p2",
    name: "Contrôle des nappes P1/P2",
    objective: "Vérifier les nappes entre carte fille JETHIO et têtes.",
    prerequisites: [
      "MACHINE ÉTEINTE ET HORS TENSION",
      "Procédure Symp's validée sous la main (notice de remplacement des têtes)",
    ],
    instructions: [
      "Machine hors tension, contrôler visuellement l'assise des nappes P1 (blanche) et P2 (couleur).",
      "Respecter strictement P1-1→J1 … P2-4→J4 : ne JAMAIS croiser.",
      "Ne pas débrancher/rebrancher sans la procédure validée.",
    ],
    expectedResults: [
      { result: "Nappes en place, non croisées", meaning: "Passer aux autres maillons (carte fille, tête)." },
      { result: "Nappe déboîtée ou croisée", meaning: "Cause très plausible : remettre conformément au mapping J1→1…J4→4.", supportsCauseIds: ["p1_ribbons", "splitter_or_hardware_command"] },
    ],
    safetyLevel: "STOP_MACHINE",
    estimatedDuration: "10 min",
    sourceIds: ["heads.mapping"],
    source: { document: DOC, section: "§5 — Têtes et électronique" },
  },
  {
    id: "test.dampers_bubbles",
    name: "Contrôle des dampers et des bulles",
    objective: "Vérifier l'alimentation en encre (amorçage, bulles).",
    prerequisites: ["Accès visuel aux dampers"],
    instructions: [
      "Inspecter visuellement les dampers (blancs, ou couleur : ordre documenté bas → haut M, C, Y, K).",
      "Chercher bulles, dampers vides ou tuyaux désamorcés.",
      "Si une extraction est nécessaire, suivre la procédure §6 (protéger la lampe UV, seringue progressive).",
    ],
    expectedResults: [
      { result: "Dampers pleins, pas de bulles", meaning: "Circuit d'encre plausiblement OK côté amont.", eliminatesCauseIds: ["priming_and_bubbles", "white_dampers"] },
      { result: "Bulles ou damper vide", meaning: "Amorçage/circuit d'encre en cause.", supportsCauseIds: ["white_ink_path", "priming_and_bubbles", "ink_bubbles_ribbons"] },
    ],
    safetyLevel: "CAUTION",
    estimatedDuration: "10 min",
    sourceIds: ["ink.path", "ink.extraction"],
    source: { document: DOC, section: "§6 — Circuit d'encre" },
  },
  {
    id: "test.parallelism",
    name: "Contrôle du parallélisme de la machine",
    objective: "Vérifier que la machine est parallèle au mur.",
    prerequisites: [],
    instructions: [
      "Contrôler la distance au mur en plusieurs points (positionnement : bord noir à ~6-8 cm, distance finale ~0,5-0,8 cm).",
    ],
    expectedResults: [
      { result: "Parallèle", meaning: "Chercher côté pas Y/roues/adhérence si la dérive persiste." },
      { result: "Non parallèle", meaning: "Corriger le positionnement avant tout autre diagnostic de dérive.", supportsCauseIds: ["y_step_wheels_grip"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "3 min",
    sourceIds: ["wall.positioning"],
    source: { document: DOC, section: "§9 — Positionnement" },
  },
  {
    id: "test.y_adhesion",
    name: "Contrôle de l'adhérence et du déplacement Y",
    objective: "Vérifier le pas Y : roues, adhérence, jeu, synchronisation.",
    prerequisites: ["Sol propre sous les roues"],
    instructions: [
      "Inspecter les roues (propreté, usure) et le contact au sol.",
      "Observer un pas Y : il doit être net, sans glissement, uniquement entre deux passages verticaux.",
    ],
    expectedResults: [
      { result: "Pas Y régulier", meaning: "Chercher côté synchronisation/jeu." },
      { result: "Glissement ou pas irrégulier", meaning: "Adhérence/roues en cause (colonnes décalées, bandes).", supportsCauseIds: ["y_step_wheels_grip"] },
    ],
    safetyLevel: "SAFE",
    estimatedDuration: "5 min",
    sourceIds: ["movement.cycle"],
    source: { document: DOC, section: "§4 / §12 — Déplacements" },
  },
];

export const GUIDED_TEST_INDEX: ReadonlyMap<string, GuidedTest> = new Map(
  GUIDED_TESTS.map((t) => [t.id, t]),
);
