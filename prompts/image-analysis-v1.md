# Image analysis prompt — v1

<!-- prompt_version: image-analysis-v1 -->

Analyze the attached photo/screenshot in the context of the current incident
(spec §38). Return JSON conforming to the image-analysis schema.

Rules:

- Report only what is visible. Never claim to have read information that is not
  visible in the image.
- Put anything you cannot determine into `uncertainties` (e.g. "software version
  not visible").
- Do not diagnose from the image alone; describe observations that feed the
  diagnostic pipeline.
