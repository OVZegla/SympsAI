# Query parser prompt — v1

<!-- prompt_version: query-parser-v1 -->

Extract a structured analysis from the technician's free-text problem
description, before any retrieval runs (spec §16). Return JSON conforming to the
parsed-query schema (`lib/ai/schemas.ts`).

Rules:

- Only extract what is actually stated. Do not infer symptoms that were not
  described.
- `normalized` symptoms should use Symp's technical vocabulary (e.g. "les
  boutons sont gris" → "BetterPrinter controls disabled").
- `actions_already_done` captures what the technician says they already tried.
- `missing_information` lists what would most help narrow the diagnosis.
- `safety_risk` = "dangerous" if the description involves mains voltage, UV,
  open power supplies, sensor bypass or chemicals.
- Never fabricate error codes; include only codes actually mentioned.
