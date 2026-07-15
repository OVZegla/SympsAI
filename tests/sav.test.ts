import { describe, it, expect } from "vitest";
import { buildSavPrefill, buildSavMarkdown, SAV_FIELDS } from "@/lib/reports/sav";

const FULL_SOURCE = {
  date: "14/07/2026",
  clientName: "Dupont",
  company: "Imprimerie Dupont",
  phone: "06 12 34 56 78",
  email: "dupont@example.com",
  machineModel: "M1",
  serialNumber: "4521",
  technician: "Loïc",
  problemDescription: "Pas de blanc pendant l'impression.",
  confirmedCause: "White Ink non réglé sur Spot Color",
  currentSummary: null,
  solutionText: "Réglage UltraPrint corrigé, PRN régénéré.",
  replacedParts: "Aucune",
  tests: [
    { name: "Flash Spray 256 Hz", status: "passed", notes: "blanc présent" },
    { name: "Contrôle White Ink", status: "failed", notes: null },
    { name: "Test proposé", status: "proposed", notes: null }, // non réalisé → exclu
  ],
};

describe("buildSavPrefill", () => {
  it("remplit la fiche depuis le dossier (conversation, tests, clôture)", () => {
    const { fields, missingQuestions } = buildSavPrefill(FULL_SOURCE);
    expect(fields.client_name).toBe("Dupont");
    expect(fields.contact).toBe("06 12 34 56 78 / dupont@example.com");
    expect(fields.machine_model).toBe("M1");
    expect(fields.diagnosis).toContain("Cause confirmée : White Ink");
    expect(fields.actions_done).toContain("PRN régénéré");
    expect(fields.post_tests).toContain("Flash Spray 256 Hz : OK (blanc présent)");
    expect(fields.post_tests).toContain("Contrôle White Ink : échec");
    expect(fields.post_tests).not.toContain("Test proposé");
    expect(missingQuestions).toHaveLength(0);
  });

  it("pose les questions des champs requis manquants", () => {
    const { missingQuestions } = buildSavPrefill({
      date: "14/07/2026",
      technician: "Loïc",
      problemDescription: "Panne",
      tests: [],
    });
    expect(missingQuestions.join(" ")).toMatch(/nom du client/i);
    expect(missingQuestions.join(" ")).toMatch(/modèle de la machine/i);
    expect(missingQuestions.join(" ")).toMatch(/numéro de série/i);
  });

  it("la saisie du technicien écrase le pré-remplissage", () => {
    const { fields } = buildSavPrefill(FULL_SOURCE, {
      client_name: "Durand (corrigé)",
      delivery_note: "BL-2026-118",
    });
    expect(fields.client_name).toBe("Durand (corrigé)");
    expect(fields.delivery_note).toBe("BL-2026-118");
    expect(fields.machine_model).toBe("M1"); // le reste vient du dossier
  });
});

describe("buildSavMarkdown", () => {
  it("reprend tous les champs du formulaire officiel + signatures", () => {
    const { fields } = buildSavPrefill(FULL_SOURCE);
    const md = buildSavMarkdown(fields, "INC-0042");
    for (const f of SAV_FIELDS) {
      expect(md).toContain(f.label);
    }
    expect(md).toContain("FICHE SAV / INTERVENTION MACHINE — INC-0042");
    expect(md).toContain("Signature du client");
    expect(md).toContain("Signature du technicien");
  });
});
