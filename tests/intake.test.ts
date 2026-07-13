import { describe, it, expect } from "vitest";
import {
  matchMachineModel,
  matchClient,
  matchMachineBySerial,
  extractSerialNumber,
  extractPhone,
  extractClientName,
  buildIntake,
  suggestTitle,
  type MachineModelRef,
  type ClientRef,
  type MachineRef,
} from "@/lib/incidents/intake";

const MODELS: MachineModelRef[] = [
  { id: "m1", name: "M1", slug: "m1" },
  { id: "op", name: "Opaline", slug: "opaline" },
  { id: "bk", name: "Black 2.0", slug: "black-2-0" },
  { id: "t1000", name: "T1000", slug: "t1000" },
  { id: "acc", name: "Access", slug: "access" },
];

const CLIENTS: ClientRef[] = [
  { id: "c1", name: "Dupont" },
  { id: "c2", name: "Imprimerie Martin" },
];

const MACHINES: MachineRef[] = [
  { id: "ma1", machineModelId: "m1", clientId: "c1", serialNumber: "4521" },
  { id: "ma2", machineModelId: "op", clientId: null, serialNumber: "OP-77" },
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

  it("matches the compact form of a multi-word name", () => {
    expect(matchMachineModel("la black2.0 est en panne", MODELS)?.id).toBe("bk");
  });

  it("does not match a model token buried inside another word", () => {
    // "m1" must not match inside "hdmi1".
    expect(matchMachineModel("le port hdmi1 est mort", MODELS)).toBeNull();
  });

  it("prefers the first model mentioned", () => {
    expect(
      matchMachineModel("c'est Durand avec sa T1000, pas la boutique Access", MODELS)?.id,
    ).toBe("t1000");
  });

  it("ignores a negated mention — correction phrasing", () => {
    expect(
      matchMachineModel("c'était une M1 en fait, pas une Opaline", MODELS)?.id,
    ).toBe("m1");
    expect(
      matchMachineModel("c'était pas une M1, c'était une Opaline", MODELS)?.id,
    ).toBe("op");
  });

  it("uses the AI parser hint when the text alone is ambiguous", () => {
    expect(matchMachineModel("la machine ne répond plus", MODELS, "Opaline")?.id).toBe("op");
  });

  it("returns null when no known model is mentioned", () => {
    expect(matchMachineModel("la machine ne répond plus", MODELS)).toBeNull();
  });
});

describe("client & machine extraction", () => {
  it("matches an existing client named in the text", () => {
    expect(matchClient("c'est Dupont qui a un souci", CLIENTS)?.id).toBe("c1");
  });

  it("matches a multi-word client name", () => {
    expect(matchClient("appel de l'Imprimerie Martin ce matin", CLIENTS)?.id).toBe("c2");
  });

  it("extracts a new client name from 'c'est X qui'", () => {
    expect(extractClientName("c'est Durand qui a eu un problème")).toBe("Durand");
  });

  it("extracts a serial number after n°", () => {
    expect(extractSerialNumber("sa M1 n° 4521 ne répond plus")).toBe("4521");
  });

  it("does not mistake 'numéro de tel' for a serial", () => {
    expect(extractSerialNumber("je n'ai pas le numéro de tel du client")).toBeNull();
  });

  it("extracts a French phone number", () => {
    expect(extractPhone("son tel c'est le 06 12 34 56 78")).toBe("06 12 34 56 78");
  });

  it("matches an existing machine by serial, format-insensitive", () => {
    expect(matchMachineBySerial("op77", MACHINES)?.id).toBe("ma2");
    expect(matchMachineBySerial("9999", MACHINES)).toBeNull();
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

  it("builds a full dossier: new client + new machine + follow-up question", () => {
    const result = buildIntake({
      description: "c'est Durand qui a eu un problème avec sa M1 n° 8899",
      models: MODELS,
      clients: CLIENTS,
      machines: MACHINES,
    });
    expect(result.machineModel?.id).toBe("m1");
    expect(result.existingClient).toBeNull();
    expect(result.newClientName).toBe("Durand");
    expect(result.existingMachine).toBeNull();
    expect(result.newMachineSerial).toBe("8899");
    // The assistant asks for what's missing to complete the dossier.
    expect(result.dossierQuestions.join(" ")).toMatch(/téléphone de Durand/);
    expect(result.readyToCreate).toBe(true);
  });

  it("matches an existing machine by serial and pins model + client", () => {
    const result = buildIntake({
      description: "problème d'impression sur la machine n° 4521",
      models: MODELS,
      clients: CLIENTS,
      machines: MACHINES,
    });
    expect(result.existingMachine?.id).toBe("ma1");
    expect(result.machineModel?.id).toBe("m1"); // pinned by the machine
    expect(result.existingClient?.id).toBe("c1"); // owner of the machine
    expect(result.newMachineSerial).toBeNull();
  });

  it("asks for the client name and the serial when nothing identifies them", () => {
    const result = buildIntake({
      description: "une Opaline n'imprime plus",
      models: MODELS,
      clients: CLIENTS,
      machines: MACHINES,
    });
    expect(result.dossierQuestions.join(" ")).toMatch(/nom du client/);
    expect(result.dossierQuestions.join(" ")).toMatch(/numéro de série/);
  });

  it("does not mistake a model mention for a client name", () => {
    const result = buildIntake({
      description: "c'est la M1 qui plante",
      models: MODELS,
      clients: CLIENTS,
      hints: { clientName: "M1" }, // even a bad AI hint is filtered out
    });
    expect(result.newClientName).toBeNull();
  });

  it("uses AI hints as fallback for client and phone", () => {
    const result = buildIntake({
      description: "panne totale chez le client habituel",
      models: MODELS,
      clients: [],
      hints: { machineModel: "M1", clientName: "Durand", clientPhone: "0612345678" },
    });
    expect(result.machineModel?.id).toBe("m1");
    expect(result.newClientName).toBe("Durand");
    expect(result.clientPhone).toBe("0612345678");
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
