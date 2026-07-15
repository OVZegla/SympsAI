/**
 * Fiche SAV / Intervention machine — reproduction du formulaire officiel
 * Symp's (knowledge/… Fiche_SAV_Machine_Symps.pdf). Pré-remplissage pur et
 * déterministe depuis le dossier d'incident : ce qui a été dit pendant la
 * conversation (description, tests, cause validée, solution) remplit les
 * champs ; ce qui manque est signalé pour que l'assistant le demande.
 */

export interface SavField {
  id: string;
  label: string;
  /** Champ multi-lignes (sections du formulaire) ou ligne simple (en-tête). */
  multiline: boolean;
  /** Question à poser quand le champ est vide. */
  question: string;
}

export const SAV_FIELDS: SavField[] = [
  { id: "date", label: "Date", multiline: false, question: "Quelle est la date de l'intervention ?" },
  { id: "client_name", label: "Nom du client", multiline: false, question: "Quel est le nom du client ?" },
  { id: "company", label: "Société", multiline: false, question: "Quelle est la société du client ?" },
  { id: "contact", label: "Téléphone / E-mail", multiline: false, question: "Quel est le téléphone ou l'e-mail du client ?" },
  { id: "machine_model", label: "Modèle de la machine", multiline: false, question: "Quel est le modèle de la machine ?" },
  { id: "serial_number", label: "Numéro de série", multiline: false, question: "Quel est le numéro de série ?" },
  { id: "delivery_note", label: "Numéro de bon de livraison", multiline: false, question: "Quel est le numéro de bon de livraison ?" },
  { id: "invoice_number", label: "Numéro de facture (si applicable)", multiline: false, question: "Y a-t-il un numéro de facture ?" },
  { id: "technician", label: "Technicien", multiline: false, question: "Qui est le technicien ?" },
  { id: "problem_description", label: "Description du problème signalé", multiline: true, question: "Quel est le problème signalé ?" },
  { id: "diagnosis", label: "Diagnostic réalisé", multiline: true, question: "Quel diagnostic a été réalisé ?" },
  { id: "broken_parts", label: "Pièces cassées / défectueuses", multiline: true, question: "Des pièces cassées ou défectueuses ?" },
  { id: "replaced_parts", label: "Pièces remplacées", multiline: true, question: "Des pièces ont-elles été remplacées ?" },
  { id: "actions_done", label: "Actions effectuées / réparations", multiline: true, question: "Quelles actions/réparations ont été effectuées ?" },
  { id: "post_tests", label: "Tests réalisés après intervention", multiline: true, question: "Quels tests ont été réalisés après l'intervention ?" },
  { id: "observations", label: "Observations complémentaires", multiline: true, question: "Des observations complémentaires ?" },
];

/** Champs indispensables pour une fiche exploitable (le reste est optionnel). */
const REQUIRED_IDS = new Set([
  "date",
  "client_name",
  "machine_model",
  "serial_number",
  "technician",
  "problem_description",
]);

const TEST_STATUS_FR: Record<string, string> = {
  passed: "OK",
  failed: "échec",
  inconclusive: "inconclusif",
  not_applicable: "non applicable",
  cancelled: "annulé",
};

export interface SavSourceData {
  date: string;
  clientName?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  machineModel?: string | null;
  serialNumber?: string | null;
  technician?: string | null;
  problemDescription?: string | null;
  confirmedCause?: string | null;
  currentSummary?: string | null;
  solutionText?: string | null;
  replacedParts?: string | null;
  tests: { name: string; status: string; notes?: string | null }[];
}

export interface SavPrefill {
  fields: Record<string, string>;
  /** Questions de l'assistant pour les champs requis encore vides. */
  missingQuestions: string[];
}

/**
 * Pré-remplit la fiche depuis le dossier. `saved` (fiche déjà éditée) écrase
 * toujours le pré-remplissage : ce que le technicien a écrit fait foi.
 */
export function buildSavPrefill(
  data: SavSourceData,
  saved?: Record<string, string> | null,
): SavPrefill {
  const contact = [data.phone, data.email].filter(Boolean).join(" / ");
  const completedTests = data.tests.filter((t) => TEST_STATUS_FR[t.status]);
  const testsText = completedTests
    .map(
      (t) =>
        `- ${t.name} : ${TEST_STATUS_FR[t.status]}${t.notes ? ` (${t.notes})` : ""}`,
    )
    .join("\n");

  const diagnosis = data.confirmedCause
    ? `Cause confirmée : ${data.confirmedCause}`
    : (data.currentSummary ?? "");

  const fields: Record<string, string> = {
    date: data.date,
    client_name: data.clientName ?? "",
    company: data.company ?? "",
    contact,
    machine_model: data.machineModel ?? "",
    serial_number: data.serialNumber ?? "",
    delivery_note: "",
    invoice_number: "",
    technician: data.technician ?? "",
    problem_description: data.problemDescription ?? "",
    diagnosis,
    broken_parts: "",
    replaced_parts: data.replacedParts ?? "",
    actions_done: data.solutionText ?? "",
    post_tests: testsText,
    observations: "",
  };

  // Ce que le technicien a déjà saisi/corrigé sur la fiche fait foi.
  for (const [key, value] of Object.entries(saved ?? {})) {
    if (typeof value === "string" && key in fields) fields[key] = value;
  }

  const missingQuestions = SAV_FIELDS.filter(
    (f) => REQUIRED_IDS.has(f.id) && !fields[f.id]?.trim(),
  ).map((f) => f.question);

  return { fields, missingQuestions };
}

/** Version texte (Markdown) de la fiche, pour export/archivage. */
export function buildSavMarkdown(
  fields: Record<string, string>,
  incidentNumber: string,
): string {
  const line = (f: SavField) => `**${f.label} :** ${fields[f.id]?.trim() || "—"}`;
  const section = (f: SavField) =>
    `## ${f.label}\n\n${fields[f.id]?.trim() || "—"}`;

  const header = SAV_FIELDS.filter((f) => !f.multiline).map(line).join("  \n");
  const sections = SAV_FIELDS.filter((f) => f.multiline).map(section).join("\n\n");

  return `# FICHE SAV / INTERVENTION MACHINE — ${incidentNumber}

${header}

${sections}

---

Signature du client : ______________________  Signature du technicien : ___________________
`;
}
