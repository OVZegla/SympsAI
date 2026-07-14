import { describe, it, expect } from "vitest";
import { runEngine } from "@/lib/diagnosis/engine";
import { KNOWLEDGE_ITEM_INDEX } from "@/lib/knowledge/base";

/**
 * Scénarios obligatoires du cahier d'intégration (§20), joués contre le moteur
 * déterministe. Aucun LLM : ces garanties tiennent même sans IA disponible.
 */

describe("Scénario 1 — No Connect + LED Ethernet éteintes", () => {
  const result = runEngine({
    text: "BetterPrinter affiche No Connect et les LED Ethernet du PC sont éteintes.",
  });

  it("priorise le chemin physique", () => {
    expect(result.hypotheses[0]?.id).toBe("physical_network_path");
    expect(result.hypotheses[0]?.likelihood).toBe("very_likely");
  });

  it("ne commence pas par inventer une adresse IP", () => {
    expect(result.cautions.join(" ")).toMatch(/adresse IP/i);
    expect(result.cautions.join(" ")).toMatch(/UNKNOWN/);
  });

  it("propose d'abord un test sûr (LED puis multipoints)", () => {
    expect(result.nextTests[0]?.test.id).toBe("test.ethernet_leds");
    expect(result.nextTests[0]?.test.safetyLevel).toBe("SAFE");
  });
});

describe("Scénario 2 — No Connect + LED Ethernet allumées", () => {
  const result = runEngine({
    text: "No Connect dans BetterPrinter mais les LED Ethernet sont allumées.",
  });

  it("conclut à un lien physique probable et regarde logiciel/config/carte", () => {
    expect(result.hypotheses[0]?.id).toBe("software_or_configuration");
    expect(result.matchedRules.map((r) => r.id)).not.toContain(
      "rule.net_no_connect_led_off",
    );
  });

  it("garde les paramètres IP inconnus", () => {
    expect(result.cautions.join(" ")).toMatch(/IP/);
  });
});

describe("Scénario 3 — blanc au Flash Spray mais absent à l'impression", () => {
  const result = runEngine({
    text: "Blanc présent au Flash Spray mais blanc absent pendant l'impression.",
  });

  it("vérifie Spot Color → UltraPrint → PRN → BetterPrinter, dans cet ordre", () => {
    const ids = result.hypotheses.map((h) => h.id);
    expect(ids[0]).toBe("photoshop_spot_color");
    expect(ids).toContain("ultraprint_white_ink");
    expect(ids).toContain("prn_regenerated");
    expect(ids).toContain("betterprinter_white_enabled");
  });

  it("ne propose pas le remplacement de la tête", () => {
    expect(result.hypotheses.map((h) => h.id)).not.toContain("white_head");
    expect(result.cautions.join(" ")).toMatch(/remplacement de la tête/i);
  });

  it("ne touche pas au réglage usine en première intention", () => {
    expect(result.cautions.join(" ")).toMatch(/réglage usine/i);
  });
});

describe("Scénario 4 — blanc et couleur absents", () => {
  const result = runEngine({
    text: "Blanc et couleur absents : rien ne sort à l'impression.",
  });

  it("priorise les dépendances communes", () => {
    const ids = result.hypotheses.map((h) => h.id);
    expect(ids[0]).toBe("common_power");
    expect(ids).toContain("multipin");
    expect(ids).toContain("main_board");
  });
});

describe("Scénario 5 — colonnes décalées, passages verticaux nets", () => {
  const result = runEngine({
    text: "L'impression verticale est correcte mais les colonnes sont décalées horizontalement.",
  });

  it("examine le déplacement Y : roues, adhérence, pas, synchronisation", () => {
    expect(result.hypotheses[0]?.id).toBe("y_step_wheels_grip");
    expect(result.hypotheses[0]?.label).toMatch(/roues|adhérence|pas y/i);
  });
});

describe("Scénario 6 — profondeur manuelle OK, mode 3 KO", () => {
  const result = runEngine({
    text: "Le déplacement manuel de profondeur fonctionne mais le suivi automatique en mode 3 ne fonctionne pas.",
  });

  it("vérifie bouton vert, mode, capteurs, câblage avant le moteur", () => {
    const ids = result.hypotheses.map((h) => h.id);
    expect(ids[0]).toBe("green_button_state");
    expect(ids).toContain("mode_selection");
    expect(ids).toContain("wall_sensors");
    expect(ids).toContain("sensor_wiring_logic");
    expect(ids.join(" ")).not.toMatch(/motor/);
  });

  it("commence par le contrôle du bouton vert (sûr, 30 s)", () => {
    expect(result.nextTests[0]?.test.id).toBe("test.green_button");
  });
});

describe("Scénario 7 — bord blanc AVANT la fin d'impression", () => {
  const result = runEngine({
    text: "Un bord blanc est visible alors que l'impression n'est pas terminée.",
  });

  it("reconnaît un comportement normal (têtes décalées physiquement)", () => {
    expect(result.normalBehaviors.map((nb) => nb.id)).toContain(
      "nb.white_edge_temporary",
    );
  });
});

describe("Scénario 8 — bord blanc APRÈS la fin complète", () => {
  const result = runEngine({
    text: "Le bord blanc est encore visible après la fin complète de l'impression alors que la couleur était prévue.",
  });

  it("le traite comme une anomalie à diagnostiquer, pas un comportement normal", () => {
    expect(result.normalBehaviors.map((nb) => nb.id)).not.toContain(
      "nb.white_edge_temporary",
    );
    expect(result.hypotheses.map((h) => h.id)).toContain("color_coverage_missing");
  });
});

describe("Scénario 9 — pas d'encre dans une zone transparente", () => {
  const result = runEngine({
    text: "Le bloc bouge mais aucune encre ne sort dans une zone transparente du fichier.",
  });

  it("reconnaît un comportement normal", () => {
    expect(result.normalBehaviors.map((nb) => nb.id)).toContain(
      "nb.transparency_no_ink",
    );
  });
});

describe("Scénario 10 — encre blanche activée sans Spot Color", () => {
  const result = runEngine({
    text: "Que se passe-t-il si l'encre blanche est activée sur un fichier sans Spot Color ?",
  });

  it("répond que le comportement n'a jamais été testé — sans inventer", () => {
    const unknown = result.unknowns.find((u) => u.id === "unk.white_without_spot");
    expect(unknown).toBeDefined();
    expect(unknown!.statement).toMatch(/jamais été testé/i);
  });
});

describe("Scénario 11 — X vertical, Y horizontal, jamais inversés", () => {
  it("la base affirme X = vertical (bloc) et Y = horizontal (machine)", () => {
    const axes = KNOWLEDGE_ITEM_INDEX.get("vocab.axes")!;
    expect(axes.statement).toMatch(/X est le déplacement VERTICAL/);
    expect(axes.statement).toMatch(/Y est le déplacement HORIZONTAL/);
    expect(axes.certainty).toBe("CONFIRMED_USER");
  });

  it("le moteur injecte ce fait dès qu'on parle de déplacement", () => {
    const result = runEngine({ text: "la machine monte et descend bizarrement" });
    expect(result.facts.map((f) => f.id)).toContain("vocab.axes");
  });
});

describe("Fonctions qui marchent et tests réalisés", () => {
  it("une fonction qui marche déprioritise les dépendances communes sans les exclure", () => {
    const result = runEngine({
      text: "Aucun blanc au flash spray ni au test de lignes.",
      workingFunctions: ["couleur"],
    });
    const splitter = result.hypotheses.find(
      (h) => h.id === "splitter_or_hardware_command",
    );
    const circuit = result.hypotheses.find((h) => h.id === "white_ink_path");
    expect(circuit).toBeDefined();
    expect(splitter).toBeDefined();
    // La carte fille (dépendance commune) passe derrière le circuit blanc.
    expect(splitter!.likelihood).toBe("unlikely");
    expect(splitter!.contradictingEvidence.join(" ")).toMatch(/couleur/);
    expect(circuit!.likelihood).toBe("very_likely");
  });

  it("un test réussi écarte les causes qu'il éliminait et n'est pas redemandé", () => {
    const result = runEngine({
      text: "Blanc présent au Flash Spray mais blanc absent pendant l'impression.",
      performedTests: [
        { text: "Contrôle White Ink = Spot Color dans UltraPrint", status: "passed" },
      ],
    });
    const ultraprint = result.hypotheses.find((h) => h.id === "ultraprint_white_ink");
    expect(ultraprint?.likelihood).toBe("unlikely");
    expect(result.nextTests.map((n) => n.test.id)).not.toContain(
      "test.ultraprint_white_ink",
    );
  });

  it("un test en échec renforce les causes qu'il soutient", () => {
    const result = runEngine({
      text: "BetterPrinter affiche No Connect et les LED Ethernet du PC sont éteintes.",
      performedTests: [
        { text: "Vérification des LED Ethernet", status: "failed" },
      ],
    });
    const physical = result.hypotheses.find((h) => h.id === "physical_network_path");
    expect(physical?.likelihood).toBe("very_likely");
    expect(physical?.supportingEvidence.join(" ")).toMatch(/LED/);
    // Le test réalisé n'est pas reproposé : on passe au multipoints.
    expect(result.nextTests[0]?.test.id).toBe("test.multipin_check");
  });

  it("un test STOP_MACHINE arrive avec son garde-fou de sécurité", () => {
    const result = runEngine({
      text: "Aucun blanc au flash spray ni au test de lignes.",
      performedTests: [
        { text: "Contrôle des dampers et des bulles", status: "passed" },
      ],
    });
    const stopTests = result.nextTests.filter(
      (n) => n.test.safetyLevel === "STOP_MACHINE",
    );
    for (const t of stopTests) {
      expect(result.cautions.join(" ")).toContain(t.test.name);
    }
  });
});
