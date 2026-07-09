import { describe, it, expect } from "vitest";
import {
  matchMachineModel,
  buildIntake,
  suggestTitle,
  type MachineModelRef,
} from "@/lib/incidents/intake";

const MODELS: MachineModelRef[] = [
  { id: "m1", name: "M1", slug: "m1" },
  { id: "op", name: "Opaline", slug: "opaline" },
  { id: "bk", name: "Black 2.0", slug: "black-2-0" },
];

describe("matchMachineModel", () => {
  it("matches a model named in the description", () => {
    expect(matchMachineModel("Le client a allumé sa M1.", MODELS)?.id).toBe("m1");
  });

  it("is accent- and case-insensitive", () => {
    expect(matchMachineModel("problème sur OPALINE", MODELS)?.id).toBe("op");
  });

  it("matches a multi-word model name", () => {
    expect(matchMachineModel("la Black 2.0 ne démarre pas", MODELS)?.id).toBe("bk");
  });

  it("does not match a model token buried inside another word", () => {
    // "m1" must not match inside "hdmi1".
    expect(matchMachineModel("le port hdmi1 est mort", MODELS)).toBeNull();
  });

  it("uses the AI parser hint when the text alone is ambiguous", () => {
    expect(matchMachineModel("la machine ne répond plus", MODELS, "Opaline")?.id).toBe("op");
  });

  it("returns null when no known model is mentioned", () => {
    expect(matchMachineModel("la machine ne répond plus", MODELS)).toBeNull();
  });
});

describe("suggestTitle", () => {
  it("uses the first non-empty line", () => {
    expect(suggestTitle("\n  BetterPrinter grisé\nsuite…")).toBe("BetterPrinter grisé");
  });
});

describe("buildIntake", () => {
  it("is ready when a machine model is identified", () => {
    const result = buildIntake({
      description: "M1 : les commandes BetterPrinter sont grises.",
      models: MODELS,
    });
    expect(result.machineModel?.id).toBe("m1");
    expect(result.missingRequired).toHaveLength(0);
    expect(result.readyToCreate).toBe(true);
  });

  it("flags the missing machine model and lists the options", () => {
    const result = buildIntake({
      description: "les commandes sont grises",
      models: MODELS,
    });
    expect(result.machineModel).toBeNull();
    expect(result.readyToCreate).toBe(false);
    expect(result.missingRequired.join(" ")).toMatch(/M1 \/ Opaline \/ Black 2\.0/);
  });

  it("flags a missing description", () => {
    const result = buildIntake({ description: "   ", models: MODELS });
    expect(result.readyToCreate).toBe(false);
    expect(result.missingRequired.join(" ")).toMatch(/description/);
  });

  it("passes through the AI parser's missing-information as suggestions", () => {
    const result = buildIntake({
      description: "M1 en panne",
      models: MODELS,
      parserMissingInformation: ["état du voyant de la carte"],
    });
    expect(result.readyToCreate).toBe(true); // model known → not blocking
    expect(result.suggestedQuestions).toContain("état du voyant de la carte");
  });
});
