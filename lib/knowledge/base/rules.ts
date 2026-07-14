import type { DiagnosticRule } from "./types";

/**
 * Règles de diagnostic déterministes (Base §3 et §12). Les conditions sont des
 * mots-clés NORMALISÉS (minuscules, sans accents) : `all` = tous les groupes
 * doivent matcher, un groupe matche si l'un de ses termes est présent,
 * `none` = termes excluants. L'ordre des `causes` EST la priorité.
 */
const DOC = "Base Symp's v0.1";

// Formulations d'absence du blanc rencontrées sur le terrain.
const WHITE_MISSING = [
  "pas de blanc",
  "blanc absent",
  "blanc absents",
  "aucun blanc",
  "plus de blanc",
  "sans blanc",
  "blanc ne sort pas",
  "blanc manquant",
  "blanc et couleur absents",
  "absence de blanc",
];

export const DIAGNOSTIC_RULES: DiagnosticRule[] = [
  {
    id: "rule.net_no_connect_led_off",
    title: "No Connect avec LED Ethernet éteintes",
    when: {
      all: [
        ["no connect", "pas de connexion", "connexion impossible", "ne se connecte pas", "deconnecte"],
        ["led"],
        ["eteinte", "eteintes", "eteint"],
      ],
      none: ["allumee", "allumees", "allume"],
    },
    causes: [
      {
        id: "physical_network_path",
        label: "Coupure du chemin réseau physique (RJ45 PC → base → multipoints → connecteur arrière → RJ45 interne → carte principale)",
        components: ["pc rj45", "base", "multipoints", "connecteur arriere du bloc", "rj45 interne", "carte principale"],
        testIds: ["test.ethernet_leds", "test.multipin_check"],
      },
    ],
    avoidFirst: [
      "Ne pas inventer d'adresse IP ni de paramètres réseau : ils sont UNKNOWN dans la base.",
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§3 — Communication PC-machine" },
    notes:
      "PC et machine allumés, les LED Ethernet doivent s'allumer même si BetterPrinter est fermé : LED éteintes ⇒ priorité au chemin physique.",
  },
  {
    id: "rule.net_no_connect_led_on",
    title: "No Connect avec LED Ethernet allumées",
    when: {
      all: [
        ["no connect", "pas de connexion", "connexion impossible", "ne se connecte pas"],
        ["led"],
        ["allumee", "allumees", "allume"],
      ],
      none: ["eteinte", "eteintes"],
    },
    causes: [
      {
        id: "software_or_configuration",
        label: "Lien physique probable : examiner le logiciel (BetterPrinter), la configuration ou la carte principale",
        components: ["betterprinter", "configuration", "carte principale"],
        testIds: [],
      },
    ],
    avoidFirst: [
      "Les paramètres IP exacts restent UNKNOWN : ne pas proposer de valeurs inventées.",
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§3 — Communication PC-machine" },
  },
  {
    id: "rule.white_case1_flash_ok",
    title: "Blanc présent au Flash Spray mais absent à l'impression",
    when: {
      all: [
        ["flash spray", "flash"],
        ["impression", "imprime", "imprimer"],
        WHITE_MISSING.concat(["blanc absent pendant"]),
      ],
    },
    causes: [
      {
        id: "photoshop_spot_color",
        label: "Canal Spot Color absent ou mal préparé dans Photoshop (sélection + contraction ~2 mm)",
        components: ["photoshop", "spot color"],
        testIds: ["test.spot_color_present"],
      },
      {
        id: "tiff_saved_with_spot_colors",
        label: "TIFF non enregistré avec les Spot Colors",
        components: ["tiff"],
        testIds: ["test.spot_color_present"],
      },
      {
        id: "ultraprint_white_ink",
        label: "White Ink non réglé sur Spot Color dans UltraPrint",
        components: ["ultraprint"],
        testIds: ["test.ultraprint_white_ink"],
      },
      {
        id: "prn_regenerated",
        label: "PRN non régénéré après correction du fichier",
        components: ["prn"],
        testIds: ["test.ultraprint_white_ink"],
      },
      {
        id: "betterprinter_white_enabled",
        label: "Encre blanche désactivée dans BetterPrinter",
        components: ["betterprinter"],
        testIds: ["test.bp_white_enabled"],
      },
      {
        id: "betterprinter_white_percentage",
        label: "Pourcentage de blanc mal réglé dans BetterPrinter",
        components: ["betterprinter"],
        testIds: ["test.bp_white_enabled"],
      },
    ],
    avoidFirst: [
      "Ne pas proposer le remplacement de la tête blanche : le Flash Spray prouve que la tête et le circuit d'encre fonctionnent au moins partiellement.",
      "Ne pas toucher au réglage usine d'alignement blanc/couleur.",
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Règles de diagnostic (case_1)" },
  },
  {
    id: "rule.white_case2_no_flash",
    title: "Pas de blanc au Flash Spray / test de lignes",
    when: {
      all: [
        ["flash spray", "flash", "test de lignes", "lignes"],
        WHITE_MISSING,
      ],
      none: ["impression", "imprime"],
    },
    causes: [
      {
        id: "white_ink_path",
        label: "Circuit d'encre blanc (réservoir → tuyau → damper → tête)",
        components: ["reservoir blanc", "tuyau", "damper blanc"],
        testIds: ["test.dampers_bubbles"],
      },
      {
        id: "priming_and_bubbles",
        label: "Amorçage et bulles",
        components: ["dampers"],
        testIds: ["test.dampers_bubbles"],
      },
      {
        id: "white_dampers",
        label: "Dampers blancs",
        components: ["damper blanc"],
        testIds: ["test.dampers_bubbles"],
      },
      {
        id: "white_head",
        label: "Tête blanche",
        components: ["tete blanche"],
        testIds: ["test.flash_spray_256", "test.low_freq_lines"],
      },
      {
        id: "p1_ribbons",
        label: "Nappes du port P1",
        components: ["nappes", "port p1"],
        testIds: ["test.ribbons_p1p2"],
      },
      {
        id: "splitter_or_hardware_command",
        label: "Carte fille ou commande matérielle",
        components: ["carte fille"],
        testIds: ["test.ribbons_p1p2"],
      },
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Règles de diagnostic (case_2)" },
  },
  {
    id: "rule.white_and_color_absent",
    title: "Blanc ET couleur absents",
    when: {
      all: [
        ["blanc"],
        ["couleur"],
        ["absents", "absente", "absentes", "absent", "aucune encre", "rien ne sort", "ne sortent pas", "ne sort"],
      ],
    },
    causes: [
      {
        id: "common_power",
        label: "Alimentation commune",
        components: ["alimentation generale"],
        testIds: ["test.motor_hold"],
      },
      {
        id: "multipin",
        label: "Câble multipoints",
        components: ["multipoints"],
        testIds: ["test.multipin_check"],
      },
      {
        id: "main_board",
        label: "Carte principale",
        components: ["carte principale"],
        testIds: [],
      },
      {
        id: "splitter_board",
        label: "Carte fille JETHIO",
        components: ["carte fille"],
        testIds: ["test.ribbons_p1p2"],
      },
      {
        id: "global_data_or_command",
        label: "Données ou commande globale",
        components: ["commande globale"],
        testIds: [],
      },
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Règles de diagnostic (case_3)" },
    notes:
      "Panne commune à plusieurs fonctions ⇒ chercher d'abord une dépendance commune.",
  },
  {
    id: "rule.move_axis_free",
    title: "Sous tension mais axe libre",
    when: {
      all: [["axe", "moteur", "bloc"], ["libre", "ne tient pas", "aucun maintien", "se deplace a la main"]],
    },
    causes: [
      {
        id: "power_driver_motor_hold",
        label: "Alimentation, servo-driver, moteur ou maintien",
        components: ["alimentations grises et servo-drivers", "moteurs"],
        testIds: ["test.motor_hold"],
      },
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Déplacements" },
  },
  {
    id: "rule.move_axis_held_no_command",
    title: "Axe tenu mais aucune commande",
    when: {
      all: [
        ["axe tenu", "maintenu", "maintien ok", "tient"],
        ["aucune commande", "ne repond pas", "ne bouge pas", "aucun mouvement"],
      ],
    },
    causes: [
      {
        id: "command_chain",
        label: "Chaîne de commande : bornier, multipoints, driver",
        components: ["bornier", "multipoints", "servo-drivers"],
        testIds: ["test.multipin_check"],
      },
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Déplacements" },
  },
  {
    id: "rule.move_columns_offset",
    title: "Colonnes décalées horizontalement, passages verticaux nets",
    when: {
      all: [
        ["colonne", "colonnes", "bandes verticales"],
        ["decalee", "decalees", "decalage", "decale"],
      ],
    },
    causes: [
      {
        id: "y_step_wheels_grip",
        label: "Pas Y, roues, adhérence, jeu ou synchronisation du déplacement horizontal",
        components: ["pas y", "roues", "adherence"],
        testIds: ["test.y_adhesion", "test.parallelism"],
      },
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Déplacements / Qualité" },
    notes:
      "Les passages verticaux nets innocentent l'axe X : examiner le déplacement Y (horizontal).",
  },
  {
    id: "rule.wall_manual_ok_auto_ko",
    title: "Profondeur manuelle OK mais suivi automatique KO",
    when: {
      all: [
        ["manuel", "manuelle", "fleches"],
        ["mode 3", "automatique", "auto"],
        ["ne fonctionne pas", "non fonctionnel", "ne marche pas", "inactif", "aucune correction", "ko"],
      ],
    },
    causes: [
      {
        id: "green_button_state",
        label: "Bouton vert activé (il bloque la correction automatique)",
        components: ["bouton vert"],
        testIds: ["test.green_button"],
      },
      {
        id: "mode_selection",
        label: "Mode sélectionné (le suivi n'est actif qu'en mode 3)",
        components: ["mode 3"],
        testIds: ["test.mode3"],
      },
      {
        id: "wall_sensors",
        label: "Capteurs haut/bas",
        components: ["capteur superieur", "capteur inferieur"],
        testIds: ["test.sensor_top", "test.sensor_bottom"],
      },
      {
        id: "sensor_wiring_logic",
        label: "Câblage et logique automatique",
        components: ["cablage"],
        testIds: [],
      },
    ],
    avoidFirst: [
      "Vérifier bouton vert, mode, capteurs, câblage et logique automatique AVANT de suspecter le moteur.",
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Suivi de mur" },
  },
  {
    id: "rule.wall_sensors_change_no_motion",
    title: "Valeurs capteurs vivantes mais aucun mouvement automatique",
    when: {
      all: [
        ["capteur", "capteurs", "valeurs"],
        ["changent", "change", "reagissent", "varient"],
        ["pas de mouvement", "aucun mouvement", "ne bouge pas"],
      ],
    },
    causes: [
      {
        id: "logic_to_actuation",
        label: "Détection active : défaut entre la logique et l'actionnement",
        components: ["logique automatique", "moteur de profondeur"],
        testIds: ["test.mode3", "test.green_button"],
      },
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Suivi de mur" },
  },
  {
    id: "rule.quality_white_edge_regular",
    title: "Liseré blanc régulier",
    when: {
      all: [["lisere", "liseret", "bordure blanche"]],
    },
    causes: [
      {
        id: "spot_color_contraction",
        label: "Canal Spot Color / contraction de sélection (~2 mm) à vérifier dans Photoshop, puis TIFF et PRN régénéré",
        components: ["photoshop", "spot color", "tiff", "prn"],
        testIds: ["test.spot_color_present", "test.ultraprint_white_ink"],
      },
    ],
    avoidFirst: [
      "Ne pas modifier le réglage usine d'alignement blanc/couleur en première intention.",
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Qualité / §7 Alignement" },
  },
  {
    id: "rule.quality_white_after_end",
    title: "Bord blanc encore visible après la fin complète",
    when: {
      all: [
        ["bord blanc", "blanc visible", "blanc restant", "reste du blanc"],
        ["apres la fin", "fin complete", "impression terminee", "une fois terminee"],
      ],
    },
    causes: [
      {
        id: "color_coverage_missing",
        label: "La couleur prévue n'a pas recouvert le blanc : vérifier les données couleur (fichier, PRN), le circuit couleur et le cycle",
        components: ["tete couleur", "prn", "donnees couleur"],
        testIds: ["test.spot_color_present", "test.flash_spray_256"],
      },
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§7 — Pipeline blanc + couleur" },
    notes:
      "Un bord blanc TEMPORAIRE avant la fin est normal ; APRÈS la fin complète, alors que la couleur était prévue, c'est une anomalie.",
  },
  {
    id: "rule.quality_random_gaps",
    title: "Manques aléatoires",
    when: {
      all: [["manques", "trous", "aleatoire", "aleatoires"]],
    },
    causes: [
      {
        id: "ink_bubbles_ribbons",
        label: "Encre, bulles, nappes, alimentation ou communication",
        components: ["dampers", "nappes", "multipoints"],
        testIds: ["test.dampers_bubbles", "test.flash_spray_256"],
      },
    ],
    certainty: "CONFIRMED_USER",
    source: { document: DOC, section: "§12 — Qualité" },
  },
];
