# SYMP'S AI — BASE DE CONNAISSANCE TECHNIQUE DES MACHINES

**Version :** 0.1  
**Statut :** Brouillon contrôlé  
**Date :** 14 juillet 2026  
**Usage :** interne / source de vérité pour l'assistant technique Symp's

---

## 0. Règles fondamentales de l'assistant

### Niveaux de certitude

- `CONFIRMED_USER` : confirmé directement par Loïc.
- `CONFIRMED_MANUAL` : confirmé par une documentation interne identifiée.
- `PROBABLE` : hypothèse cohérente mais non vérifiée.
- `UNKNOWN` : non testé ou non documenté.
- `DO_NOT_INVENT` : l'assistant ne doit jamais compléter par imagination.

### Format de raisonnement

```yaml
facts_observed: []
expected_behavior: []
dependencies: []
prioritized_hypotheses: []
tests:
  - order: 1
    action: ""
    expected_result: ""
conclusion:
  status: "confirmed | probable | unknown"
  cause: ""
```

### Règles

1. Séparer les faits, les attentes et les hypothèses.
2. Utiliser les fonctions qui marchent pour déprioriser certaines causes.
3. Chercher d'abord les dépendances communes lorsque plusieurs fonctions sont en panne.
4. Commencer par les tests simples, sûrs et réversibles.
5. Une LED ne prouve jamais le bon fonctionnement complet d'une carte.
6. Ne pas modifier un réglage usine avant d'avoir éliminé le fichier, le logiciel et les causes mécaniques simples.
7. Toute information non confirmée doit rester `UNKNOWN`.

---

## 1. Vocabulaire contrôlé

| Terme | Définition |
|---|---|
| Socle / base | Partie basse sur roues contenant alimentation, distribution, bornier, deux alimentations grises, contacteur et servo-drivers. |
| Structure verticale | Montants aluminium, traverse, plaque basse rouge, poulie supérieure et courroie principale. |
| Bloc d'impression | Ensemble mobile contenant têtes, réservoirs, capteurs, UV et électronique embarquée. |
| PC | Ordinateur Windows séparé et alimenté indépendamment. |
| Axe X | Déplacement vertical du bloc : montée / descente. |
| Axe Y | Déplacement horizontal de la machine entière sur ses roues. |
| Profondeur | Avance / recul du module avant par rapport au chariot arrière. Ne pas lui attribuer de lettre d'axe non confirmée. |

> **Important : chez Symp's, X = vertical et Y = horizontal.**

---

## 2. Architecture électrique

```yaml
power_chain:
  - mains_machine
  - base_contactor_terminal_block
  - grey_power_supplies_and_servo_drivers
  - motors_and_multipin_cable
  - main_block_board
  - block_subsystems
```

### Faits confirmés

- Le PC a sa propre alimentation et peut fonctionner machine éteinte.
- Sous tension, les moteurs maintiennent leur position.
- La LED verte de la carte principale indique la présence du 32 V uniquement.
- Le câble multipoints transporte alimentation, commandes et communication entre la base et le bloc.
- Une fonction qui marche ne valide pas toutes les broches du multipoints.

### Bornier

- Connecteur supérieur : axe Y horizontal.
- Connecteur central : axe X vertical.
- Connecteur inférieur : alimentation.

---

## 3. Communication PC-machine

```yaml
network_path:
  - pc_rj45
  - base
  - internal_path_and_multipin
  - rear_block_connector
  - internal_rj45
  - main_block_board
```

- Les seules LED Ethernet visibles sont sur le port du PC.
- PC et machine allumés : les LED Ethernet doivent s'allumer même si BetterPrinter est fermé.
- `No Connect + LED éteintes` : priorité au chemin physique.
- `No Connect + LED allumées` : lien physique probable ; vérifier logiciel/configuration/carte.
- Les adresses IP et paramètres réseau exacts sont `UNKNOWN` et ne doivent pas être inventés.

---

## 4. Mouvements et cycle d'impression

```yaml
axes:
  X:
    direction: vertical
    object_moved: print_block
    status: CONFIRMED_USER
  Y:
    direction: horizontal
    object_moved: whole_machine
    status: CONFIRMED_USER
```

### Trajectoire

```text
montée X en imprimant
→ fin complète de la montée
→ petit pas Y vers la droite
→ descente X en imprimant
→ fin complète de la descente
→ petit pas Y vers la droite
→ répétition
```

- L'axe Y ne se déplace pas pendant le passage vertical.
- Il n'y a pas de trajectoire diagonale.
- Les têtes impriment en montée et en descente.
- Le bloc peut continuer à bouger sans projeter d'encre.
- L'éjection suit les pixels du fichier : zone pleine = projection continue sur la zone ; transparence = absence normale de projection.

---

## 5. Têtes et électronique

```yaml
heads:
  white:
    model: Epson_I1600
    splitter_port: P1
  color:
    model: Epson_I1600
    splitter_port: P2
```

### Carte fille JETHIO I1600

- P1-1 → tête blanche J1
- P1-2 → tête blanche J2
- P1-3 → tête blanche J3
- P1-4 → tête blanche J4
- P2-1 → tête couleur J1
- P2-2 → tête couleur J2
- P2-3 → tête couleur J3
- P2-4 → tête couleur J4

Repères :

- J1 : supérieur / avant
- J2 : supérieur / arrière
- J3 : inférieur / avant
- J4 : inférieur / arrière

**Règle : J1→1, J2→2, J3→3, J4→4. Ne pas croiser.**

### Dépendances

- Communes : multipoints, carte principale, carte fille, alimentation générale, commande globale.
- Blanc : P1, nappes, tête blanche, réservoir blanc, mélangeur, dampers, Spot Color, paramètres blancs.
- Couleur : P2, nappes, tête couleur, CMYK, dampers couleur, données couleur.

---

## 6. Circuit d'encre

```yaml
ink_path: [reservoir, tube, damper, printhead, nozzles]
reservoirs: [cyan, magenta, yellow, black, white]
pump_confirmed: false
```

- Tête couleur : quatre dampers, ordre documenté du bas vers le haut `M, C, Y, K`.
- Tête blanche : quatre dampers blancs, tuyaux naturels sans croisement forcé.
- Mélangeur blanc au-dessus du réservoir ; fonctionnement apparemment temporisé.
- Aucun capteur de densité confirmé.

### Extraction

1. Desserrer les bouchons des réservoirs.
2. Protéger la lampe UV.
3. Poser l'extracteur sur la tête.
4. Tirer progressivement à la seringue en plusieurs étapes.
5. Continuer jusqu'à obtenir encre, pression et absence de bulles.
6. Essuyer doucement sans frotter.

---

## 7. Pipeline blanc + couleur

### Position physique et progression

```text
Sens de progression →
[Tête couleur]    [Tête blanche]
```

- La tête blanche est à droite de la tête couleur.
- La machine progresse vers la droite.
- La tête blanche atteint donc une nouvelle zone avant la tête couleur.
- Les deux têtes travaillent dans le même cycle global, pas en deux impressions complètes séparées.

### Déroulement

- Début : blanc seul momentanément.
- Milieu : blanc en avance et couleur sur une colonne précédemment blanchie.
- Fin : bord blanc net temporaire, ensuite recouvert par la couleur.
- Blanc visible après la fin complète alors que de la couleur était prévue : anomalie.

### Alignement

- BetterPrinter possède un réglage d'alignement blanc/couleur configuré en usine.
- Ne pas le modifier en première intention.
- Un liseré blanc régulier doit d'abord faire vérifier le canal Spot Color et la contraction de sélection dans Photoshop.

---

## 8. Chaîne logicielle

```yaml
workflow:
  photoshop:
    role: define_image_and_white_areas
    output: TIFF_with_spot_colors
  ultraprint:
    role: convert_TIFF_to_PRN
    white_ink_source: Spot_Color
  betterprinter:
    role: machine_control_and_print_execution
    controls:
      - white_ink_enabled
      - white_percentage
```

### Photoshop

1. Sélectionner la zone qui doit recevoir du blanc.
2. Contracter la sélection d'environ 2 mm vers l'intérieur.
3. Créer le canal Spot Color.
4. Enregistrer le TIFF avec les Spot Colors.

Le blanc est ainsi légèrement plus petit que la couleur, ce qui évite un liseré visible.

### UltraPrint

- Régler `White Ink = Spot Color`.
- Le réglage est dans un menu séparé de `Accuracy` et `Curve`.
- Le nom exact du menu est `UNKNOWN` ; probablement un menu de type Settings.
- L'intensité du blanc ne se règle pas dans UltraPrint.

### BetterPrinter

- Charge le PRN et pilote la machine.
- Active/désactive l'encre blanche.
- Règle le pourcentage de blanc.
- Un fichier avec Spot Color peut imprimer sans blanc si `Encre blanche` est désactivé.
- Un fichier sans Spot Color peut imprimer en couleur sans blanc.
- `Encre blanche activée + fichier sans Spot Color` : comportement `UNKNOWN`, jamais testé.

---

## 9. Suivi automatique du mur

### Architecture

- Le chariot arrière monte/descend sur X.
- Le module avant avance/recule sur un rail interne avec petite courroie et deux poulies.
- Deux capteurs jaunes : supérieur et inférieur.

### Capteurs

- Supérieur : anticipation pendant la montée.
- Inférieur : anticipation pendant la descente.
- Les valeurs sont affichées séparément.
- Une main devant un capteur provoque normalement le recul lorsque l'automatisme est actif.

### Modes

- Mode 1 : profondeur fixe, flèches manuelles, aucune correction automatique.
- Mode 2 : `UNKNOWN`.
- Mode 3 : suivi automatique continu, même hors impression.

### Bouton vert

- Désactive/bloque la correction automatique.
- Ne bloque pas physiquement le module.
- Les flèches manuelles restent actives.
- Risque de frottement si le bouton est activé en mode 3.

### Positionnement

- Module approximativement à mi-course avant approche.
- Mode 3.
- Bouton vert non activé.
- Bord noir à environ 6–8 cm du mur.
- Machine parallèle.
- Distance finale d'impression environ 0,5–0,8 cm.

---

## 10. UV, laser et écran

### UV

- Lampe sous la zone d'impression.
- Active pendant l'impression en montée et en descente.
- Éteinte hors impression selon les observations actuelles.
- Puissance par potentiomètre physique.
- Deux filtres bas = entrées d'air.
- Commande électronique et ventilation interne exactes : `UNKNOWN`.

### Laser

- Repère visuel de départ d'impression.
- Ce n'est pas un capteur de distance.

### Écran

- Accueil : flèches = avance/recul en profondeur.
- Menu = ouverture/validation.
- Dans les menus : flèches = navigation/valeurs.
- Retour = écran précédent.
- Carte d'écran dédiée : commandes, modes, valeurs capteurs et profondeur.

---

## 11. Flash Spray et tests de lignes

### 256 Hz

- BetterPrinter / Flash Spray.
- Feuille à environ 15–20 cm.
- Environ cinq secondes.
- Vérifie l'éjection générale et aide à dégager certaines impuretés.

### Basse fréquence

- Manuel : 2 Hz.
- Une valeur de 1 Hz a aussi été évoquée : contradiction à clarifier.
- Feuille proche de la tête, environ cinq secondes.
- Lignes couleur d'un côté, blanc de l'autre.
- Les lignes doivent être continues.

---

## 12. Règles de diagnostic prioritaires

### Blanc absent

```yaml
case_1:
  observed: white_flash_ok_but_no_white_in_print
  priority:
    - photoshop_spot_color
    - tiff_saved_with_spot_colors
    - ultraprint_white_ink_equals_spot_color
    - prn_regenerated
    - betterprinter_white_enabled
    - betterprinter_white_percentage

case_2:
  observed: no_white_in_flash_or_line_test
  priority:
    - white_ink_path
    - priming_and_bubbles
    - white_dampers
    - white_head
    - P1_ribbons
    - splitter_or_hardware_command

case_3:
  observed: white_and_color_both_absent
  priority:
    - common_power
    - multipin
    - main_board
    - splitter_board
    - global_data_or_command
```

### Déplacements

- Sous tension mais axe libre : alimentation/driver/moteur/maintien.
- Axe tenu mais aucune commande : chaîne de commande, bornier, multipoints, driver.
- Colonnes décalées mais passages verticaux nets : pas Y, roues, adhérence, jeu, synchronisation.
- Défaut seulement en montée ou en descente : problème bidirectionnel, car les deux sens doivent imprimer.

### Suivi de mur

- Manuel fonctionne, auto non : bouton vert, mode 3, capteurs, câblage, logique auto.
- Valeurs capteurs changent mais pas de mouvement auto : détection active, défaut entre logique et actionnement.
- Un seul sens de suivi fonctionne : capteur correspondant.
- Bruit moteur sans mouvement : courroie, poulie, rail, fixation ou blocage mécanique.

### Qualité

- Liseré blanc régulier : Spot Color / contraction avant réglage usine.
- Décalage blanc variable : mécanique ou pas Y plutôt qu'offset fixe.
- Bandes verticales : pas Y, recouvrement, distance, buses.
- Décalage progressif : parallélisme, roues, dérive Y.
- Manques aléatoires : encre, bulles, nappes, alimentation, communication.
- Vide exactement conforme à la transparence du fichier : normal.

---

## 13. Inconnues contrôlées

```yaml
unknowns:
  - exact_network_IP_mask_and_configuration
  - exact_ultraprint_menu_name_for_white_ink
  - exact_factory_white_color_alignment_parameter
  - exact_meaning_of_betterprinter_white_percentage
  - mode_2_function
  - sensor_units_targets_and_algorithm
  - role_of_unidentified_small_board
  - exact_UV_control_path_and_internal_fans
  - definitive_low_frequency_test_1Hz_or_2Hz
  - behavior_white_enabled_without_spot_color
```

---

## 14. Sources internes

- Entretien technique avec Loïc, juillet 2026.
- Manuel interne « Démarrage machine ».
- « Guide de dépannage - Pannes de déplacement ».
- « Notice de remplacement des têtes d'impression ».

---

## 15. Politique de mise à jour

- Ne jamais supprimer silencieusement une ancienne règle contradictoire.
- Enregistrer la contradiction et la version de machine concernée.
- Ajouter la source, la date et le statut de validation.
- Une règle devient `CONFIRMED` uniquement après preuve utilisateur, test reproductible ou documentation interne.
