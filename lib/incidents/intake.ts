/**
 * Conversational incident intake (spec §15-§16). The technician describes a
 * problem in free text ("c'est Dupont qui a un problème avec sa M1 n° 12345");
 * we extract the machine model, the client and the machine, match them against
 * what already exists, and report what is still missing so the assistant can
 * ask for it ("quel est le numéro de téléphone du client ?") before the
 * incident dossier is recorded.
 *
 * Everything here is pure and unit-tested so it works even when the AI
 * extractor is unavailable (graceful degradation): keyword/regex matching of
 * known names against the description. AI hints, when available, are passed in
 * as `hints` and only complement the deterministic matching.
 */
export interface MachineModelRef {
  id: string;
  name: string;
  slug: string;
}

export interface ClientRef {
  id: string;
  name: string;
}

export interface MachineRef {
  id: string;
  machineModelId: string;
  clientId: string | null;
  serialNumber: string | null;
}

/** Optional AI-extracted hints complementing the deterministic matching. */
export interface IntakeHints {
  machineModel?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  serialNumber?: string | null;
}

export interface IntakeResult {
  /** Resolved machine model, or null when it could not be determined. */
  machineModel: MachineModelRef | null;
  /** Existing client matched in the text, if any. */
  existingClient: ClientRef | null;
  /** Name of a client to create (mentioned but unknown), if any. */
  newClientName: string | null;
  /** Client phone number found in the text, if any. */
  clientPhone: string | null;
  /** Existing machine matched by serial number, if any. */
  existingMachine: MachineRef | null;
  /** Serial number of a machine to create (mentioned but unknown), if any. */
  newMachineSerial: string | null;
  /** A short title suggestion derived from the description. */
  suggestedTitle: string;
  /** Blocking gaps the user should fill to reference the incident well. */
  missingRequired: string[];
  /** Questions to complete the dossier (client phone, serial number…). */
  dossierQuestions: string[];
  /** Non-blocking, useful-to-have details (from the AI parser, if any). */
  suggestedQuestions: string[];
  /** Whether we have enough to record the incident. */
  readyToCreate: boolean;
}

/** Lowercase + strip accents so "Opaline" matches "opaline". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface NameMention {
  index: number;
  /** True when the mention is negated ("pas une opaline"). */
  negated: boolean;
}

/**
 * Find whole-word mentions of a name in free text ("M1" matches but not inside
 * "HDMI1"). Multi-word names also match their compact form ("Black 2.0" ↔
 * "black2.0"). Each mention carries a negation flag so corrections like
 * "c'était une M1, pas une Opaline" keep M1 and drop Opaline.
 */
function findMentions(haystack: string, name: string): NameMention[] {
  const variants = new Set(
    [name, name.replace(/\s+/g, "")].map(normalize).filter(Boolean),
  );
  const mentions: NameMention[] = [];
  for (const variant of variants) {
    const re = new RegExp(
      `(?<![a-z0-9])${escapeRegExp(variant)}(?![a-z0-9])`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(haystack)) !== null) {
      const before = haystack.slice(Math.max(0, m.index - 14), m.index);
      const negated = /\bpas\s+(?:une?|la|le|les|de la|d'|du)?\s*$/.test(before);
      if (!mentions.some((x) => x.index === m!.index)) {
        mentions.push({ index: m.index, negated });
      }
    }
  }
  return mentions.sort((a, b) => a.index - b.index);
}

/**
 * Find a known machine model mentioned in free text. The first non-negated
 * mention wins, so a correction ("c'était une M1 en fait, pas une Opaline")
 * resolves to M1. If a parser hint is provided (the model name the AI
 * extracted), it is used as a fallback.
 */
export function matchMachineModel(
  description: string,
  models: MachineModelRef[],
  parserHint?: string | null,
): MachineModelRef | null {
  for (const text of [description, parserHint ?? ""]) {
    const haystack = normalize(text);
    if (!haystack) continue;

    let best: { model: MachineModelRef; index: number; length: number } | null =
      null;
    for (const model of models) {
      for (const name of [model.name, model.slug]) {
        for (const mention of findMentions(haystack, name)) {
          if (mention.negated) continue;
          // Earliest mention wins; at the same position the longest name wins
          // so "Black 2.0" beats a hypothetical "Black".
          if (
            !best ||
            mention.index < best.index ||
            (mention.index === best.index && name.length > best.length)
          ) {
            best = { model, index: mention.index, length: name.length };
          }
        }
      }
    }
    if (best) return best.model;
  }
  return null;
}

/** Find a known client mentioned by name in free text (first mention wins). */
export function matchClient(
  description: string,
  clients: ClientRef[],
  nameHint?: string | null,
): ClientRef | null {
  for (const text of [description, nameHint ?? ""]) {
    const haystack = normalize(text);
    if (!haystack) continue;

    let best: { client: ClientRef; index: number } | null = null;
    for (const client of clients) {
      for (const mention of findMentions(haystack, client.name)) {
        if (mention.negated) continue;
        if (!best || mention.index < best.index) {
          best = { client, index: mention.index };
        }
      }
    }
    if (best) return best.client;
  }
  return null;
}

/**
 * Pull a serial/machine number out of free text ("sa M1 n° 12345",
 * "numéro de série AB-4521"). The captured token must contain a digit so
 * phrases like "numéro de tel" don't produce a bogus serial.
 */
export function extractSerialNumber(description: string): string | null {
  const m = description.match(
    /(?:n[°ºo]\s*|num[ée]ro(?:\s+de\s+s[ée]rie)?\s+|s[ée]rie\s+|\bsn\s+)[:\-]?\s*([A-Za-z]*\d[A-Za-z0-9\-/]*)/i,
  );
  return m ? m[1]! : null;
}

/** Pull a French phone number out of free text (06 12 34 56 78, +33 6…). */
export function extractPhone(description: string): string | null {
  const m = description.match(/(?:\+33\s?|0)[1-9](?:[\s.\-]?\d{2}){4}/);
  return m ? m[0].trim() : null;
}

/**
 * Fallback client-name extraction when no known client matches and no AI hint
 * is available: "c'est Dupont qui…", "le client Dupont", "chez Dupont".
 */
export function extractClientName(description: string): string | null {
  const patterns = [
    /c'?est\s+([A-ZÀ-Ž][\w'À-ž-]*(?:\s+[A-ZÀ-Ž][\w'À-ž-]*)?)\s+qui/,
    /(?:le\s+)?client\s+([A-ZÀ-Ž][\w'À-ž-]*(?:\s+[A-ZÀ-Ž][\w'À-ž-]*)?)/,
    /chez\s+([A-ZÀ-Ž][\w'À-ž-]*(?:\s+[A-ZÀ-Ž][\w'À-ž-]*)?)/,
  ];
  for (const re of patterns) {
    const m = description.match(re);
    if (m) return m[1]!.trim();
  }
  return null;
}

/** Match an existing machine by serial number (case/format-insensitive). */
export function matchMachineBySerial(
  serial: string | null,
  machines: MachineRef[],
): MachineRef | null {
  if (!serial) return null;
  const wanted = normalize(serial).replace(/[^a-z0-9]/g, "");
  if (!wanted) return null;
  return (
    machines.find(
      (m) =>
        m.serialNumber &&
        normalize(m.serialNumber).replace(/[^a-z0-9]/g, "") === wanted,
    ) ?? null
  );
}

/** First non-empty line of the description, trimmed to a title length. */
export function suggestTitle(description: string): string {
  const firstLine = description
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (firstLine ?? "Nouvel incident").slice(0, 120);
}

/**
 * Assemble the intake result. `machineModel` is required to reference an
 * incident well (it scopes retrieval to the right machine family). The client
 * and the machine are optional but actively completed: known ones are matched,
 * unknown ones are proposed for creation, and `dossierQuestions` carries the
 * follow-up questions ("quel est le numéro de téléphone du client ?").
 */
export function buildIntake(params: {
  description: string;
  models: MachineModelRef[];
  clients?: ClientRef[];
  machines?: MachineRef[];
  hints?: IntakeHints;
  parserMachineModel?: string | null;
  parserMissingInformation?: string[];
}): IntakeResult {
  const description = params.description.trim();
  const clients = params.clients ?? [];
  const machines = params.machines ?? [];
  const hints = params.hints ?? {};
  const missingRequired: string[] = [];
  const dossierQuestions: string[] = [];

  if (!description) {
    missingRequired.push("une description du problème");
  }

  let machineModel = matchMachineModel(
    description,
    params.models,
    hints.machineModel ?? params.parserMachineModel,
  );

  // --- Machine (serial number → existing machine or machine to create) ------
  const serial = extractSerialNumber(description) ?? hints.serialNumber ?? null;
  const existingMachine = matchMachineBySerial(serial, machines);
  if (existingMachine) {
    // A known machine pins the model (and often the client) reliably.
    machineModel =
      params.models.find((m) => m.id === existingMachine.machineModelId) ??
      machineModel;
  }
  const newMachineSerial = existingMachine ? null : serial;

  // --- Client (existing match, else a name to create) ------------------------
  let existingClient = matchClient(description, clients, hints.clientName);
  if (!existingClient && existingMachine?.clientId) {
    existingClient =
      clients.find((c) => c.id === existingMachine.clientId) ?? null;
  }
  let newClientName: string | null = null;
  if (!existingClient) {
    newClientName = hints.clientName ?? extractClientName(description);
    // Don't mistake a machine-model mention for a client name.
    if (
      newClientName &&
      matchMachineModel(newClientName, params.models) !== null
    ) {
      newClientName = null;
    }
  }
  const clientPhone = extractPhone(description) ?? hints.clientPhone ?? null;

  // --- What's blocking vs. what completes the dossier ------------------------
  if (!machineModel) {
    const names = params.models.map((m) => m.name).join(" / ");
    missingRequired.push(
      names
        ? `le modèle de machine concerné (${names})`
        : "le modèle de machine concerné",
    );
  }

  if (!existingClient && !newClientName) {
    dossierQuestions.push("Quel est le nom du client ?");
  }
  if (newClientName && !clientPhone) {
    dossierQuestions.push(
      `Quel est le numéro de téléphone de ${newClientName} ?`,
    );
  }
  if (!existingMachine && !newMachineSerial) {
    dossierQuestions.push("Quel est le numéro de série de la machine ?");
  }

  return {
    machineModel,
    existingClient,
    newClientName,
    clientPhone,
    existingMachine,
    newMachineSerial,
    suggestedTitle: suggestTitle(description),
    missingRequired,
    dossierQuestions,
    suggestedQuestions: params.parserMissingInformation ?? [],
    readyToCreate: missingRequired.length === 0,
  };
}
