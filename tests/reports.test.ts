import { describe, it, expect } from "vitest";
import {
  buildFinalReport,
  buildTransmissionSummary,
  type IncidentReportData,
} from "@/lib/reports/incident-report";
import { detectWorkingFunctions, runEngine } from "@/lib/diagnosis/engine";

const DATA: IncidentReportData = {
  incidentNumber: "INC-0042",
  title: "Pas de blanc à l'impression",
  status: "Clos",
  openedAt: "14/07/2026 09:00",
  closedAt: "14/07/2026 11:30",
  machineModel: "M1",
  serialNumber: "4521",
  clientName: "Dupont",
  machineProfile: ["**Génération / Generation :** Gen 2"],
  description: "Blanc présent au Flash Spray mais absent pendant l'impression.",
  tests: [
    { name: "Contrôle White Ink = Spot Color dans UltraPrint", status: "failed", notes: "réglé sur autre chose" },
    { name: "Flash Spray 256 Hz", status: "passed" },
  ],
  confirmedCause: "White Ink non réglé sur Spot Color dans UltraPrint",
  solution: "Réglage corrigé et PRN régénéré.",
  finalSummary: "Résolu en réglant UltraPrint.",
  remainingHypotheses: [],
  generatedAt: "14/07/2026 12:00",
};

describe("rapport final", () => {
  const md = buildFinalReport(DATA);

  it("contient machine, cause confirmée, solution et tests", () => {
    expect(md).toContain("INC-0042");
    expect(md).toContain("**Modèle / Model :** M1");
    expect(md).toContain("White Ink non réglé sur Spot Color");
    expect(md).toContain("Réglage corrigé et PRN régénéré.");
    expect(md).toContain("Flash Spray 256 Hz");
    expect(md).toContain("❌ Échoué");
  });

  it("n'invente pas de cause quand il n'y en a pas", () => {
    const md2 = buildFinalReport({ ...DATA, confirmedCause: null });
    expect(md2).toContain("Aucune cause formellement confirmée");
  });
});

describe("résumé de transmission", () => {
  const md = buildTransmissionSummary({
    ...DATA,
    confirmedCause: null,
    remainingHypotheses: ["Canal Spot Color absent (très probable)"],
  });

  it("est bilingue FR/EN avec les hypothèses restantes", () => {
    expect(md).toContain("## 🇫🇷 Français");
    expect(md).toContain("## 🇬🇧 English");
    expect(md).toContain("Tests performed and results");
    expect(md).toContain("Canal Spot Color absent (très probable)");
    expect(md).toContain("none so far");
  });
});

describe("détection des fonctions qui marchent", () => {
  it("détecte une fonction déclarée fonctionnelle", () => {
    expect(detectWorkingFunctions("la couleur fonctionne parfaitement")).toContain("couleur");
    expect(detectWorkingFunctions("le déplacement manuel marche")).toContain("manuel");
  });

  it("ignore les mentions niées", () => {
    expect(detectWorkingFunctions("la couleur ne fonctionne pas")).not.toContain("couleur");
    expect(detectWorkingFunctions("le blanc ne sort plus")).not.toContain("blanc");
    expect(detectWorkingFunctions("blanc et couleur absents : rien ne sort")).toEqual([]);
  });

  it("déprioritise automatiquement les dépendances communes depuis le texte", () => {
    const result = runEngine({
      text: "Aucun blanc au flash spray ni au test de lignes, mais la couleur fonctionne.",
    });
    const splitter = result.hypotheses.find((h) => h.id === "splitter_or_hardware_command");
    expect(splitter?.likelihood).toBe("unlikely");
    expect(splitter?.contradictingEvidence.join(" ")).toMatch(/couleur/);
  });
});
