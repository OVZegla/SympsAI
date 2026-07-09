/**
 * Conversational incident intake (spec §15-§16). The technician describes a
 * problem in free text; we extract what we can and report what is still missing
 * so the assistant can ask for it before the incident is recorded.
 *
 * The machine-model matching here is pure and unit-tested so it works even when
 * the AI query parser is unavailable (graceful degradation): keyword matching of
 * known model names/slugs against the description.
 */
export interface MachineModelRef {
  id: string;
  name: string;
  slug: string;
}

export interface IntakeResult {
  /** Resolved machine model, or null when it could not be determined. */
  machineModel: MachineModelRef | null;
  /** A short title suggestion derived from the description. */
  suggestedTitle: string;
  /** Blocking gaps the user should fill to reference the incident well. */
  missingRequired: string[];
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

/**
 * Find a known machine model mentioned in free text. Matches the model name or
 * slug as a whole token (so "M1" matches but not inside "HDMI1"). If a parser
 * hint is provided (the model name the AI extracted), it is tried too.
 */
export function matchMachineModel(
  description: string,
  models: MachineModelRef[],
  parserHint?: string | null,
): MachineModelRef | null {
  const haystack = normalize(`${description} ${parserHint ?? ""}`);
  const tokens = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));

  // Prefer the longest model name so "Black 2.0" wins over a stray "black".
  const sorted = [...models].sort((a, b) => b.name.length - a.name.length);

  for (const model of sorted) {
    const name = normalize(model.name);
    const slug = normalize(model.slug);
    // Multi-word names: require the full phrase to appear.
    if (name.includes(" ") && haystack.includes(name)) return model;
    // Single-token names/slugs: require an exact token match.
    if (tokens.has(name) || tokens.has(slug)) return model;
  }
  return null;
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
 * incident well (it scopes retrieval to the right machine family); everything
 * else is optional and surfaced as suggestions.
 */
export function buildIntake(params: {
  description: string;
  models: MachineModelRef[];
  parserMachineModel?: string | null;
  parserMissingInformation?: string[];
}): IntakeResult {
  const description = params.description.trim();
  const missingRequired: string[] = [];

  if (!description) {
    missingRequired.push("une description du problème");
  }

  const machineModel = matchMachineModel(
    description,
    params.models,
    params.parserMachineModel,
  );
  if (!machineModel) {
    const names = params.models.map((m) => m.name).join(" / ");
    missingRequired.push(
      names
        ? `le modèle de machine concerné (${names})`
        : "le modèle de machine concerné",
    );
  }

  return {
    machineModel,
    suggestedTitle: suggestTitle(description),
    missingRequired,
    suggestedQuestions: params.parserMissingInformation ?? [],
    readyToCreate: missingRequired.length === 0,
  };
}
