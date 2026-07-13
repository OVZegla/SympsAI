# Intake entity extractor prompt — v1

<!-- prompt_version: intake-extractor-v1 -->

Extract the entities named in a technician's incident description so the
application can build the incident dossier (client + machine). Return JSON
conforming to the intake-entities schema (`lib/ai/schemas.ts`).

The descriptions are in French, e.g. « c'est Dupont qui a eu un problème avec
sa M1 n° 4521, son tel c'est le 06 12 34 56 78 ».

Rules:

- Only extract what is explicitly stated. Every field is `null` when the
  information is absent — never guess or invent.
- `client_name`: the person or company having the problem (not the technician).
- `client_phone` / `client_email`: contact details of that client, verbatim.
- `machine_model`: the machine model name as written (e.g. "M1", "Opaline",
  "Black 2.0", "T1000", "Graphite", "White", "TUP", "Access").
- `serial_number`: the machine's serial/identification number ("n° 4521" →
  "4521"). A phone number is NOT a serial number.
- If the text corrects a previous statement (« c'était une M1 en fait, pas une
  Opaline »), return the corrected value (`machine_model` = "M1").
