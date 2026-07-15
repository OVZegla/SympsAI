import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { buildSavPrefill } from "@/lib/reports/sav";
import { SavForm } from "@/components/incidents/SavForm";

/**
 * Fiche SAV / Intervention d'un incident (formulaire officiel Symp's).
 * Pré-remplie automatiquement depuis le dossier — ce qui a été dit pendant la
 * conversation (client, machine, problème, tests, cause validée, solution) —
 * puis complétée/corrigée par le technicien, enregistrée et imprimable.
 */
export default async function SavPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: incident } = await supabase
    .from("incidents")
    .select(
      `id, incident_number, title, opened_at, closed_at, description_initial,
       current_summary, sav_json,
       machine_models(name),
       clients(name, company_name, email, phone),
       machines(serial_number, internal_reference, replaced_parts)`,
    )
    .eq("id", params.id)
    .maybeSingle<{
      id: string;
      incident_number: string;
      title: string;
      opened_at: string;
      closed_at: string | null;
      description_initial: string | null;
      current_summary: string | null;
      sav_json: Record<string, string> | null;
      machine_models: { name: string } | null;
      clients: {
        name: string;
        company_name: string | null;
        email: string | null;
        phone: string | null;
      } | null;
      machines: {
        serial_number: string | null;
        internal_reference: string | null;
        replaced_parts: string | null;
      } | null;
    }>();
  if (!incident) notFound();

  const [{ data: testRuns }, { data: causes }, { data: solutions }] = await Promise.all([
    supabase
      .from("incident_test_runs")
      .select("status, result_notes, diagnostic_tests(title)")
      .eq("incident_id", params.id)
      .order("created_at", { ascending: true })
      .returns<
        { status: string; result_notes: string | null; diagnostic_tests: { title: string } | null }[]
      >(),
    supabase
      .from("incident_causes")
      .select("evidence, causes(name, description)")
      .eq("incident_id", params.id)
      .eq("status", "confirmed")
      .returns<
        { evidence: string | null; causes: { name: string; description: string | null } | null }[]
      >(),
    supabase
      .from("incident_solutions")
      .select("solution_text")
      .eq("incident_id", params.id)
      .eq("validated", true)
      .returns<{ solution_text: string }[]>(),
  ]);

  const tests = (testRuns ?? []).map((t) => {
    const raw = t.result_notes ?? "";
    const name = t.diagnostic_tests?.title ?? raw.split(" — ")[0] ?? "Test";
    const notes = t.diagnostic_tests?.title
      ? raw
      : raw.includes(" — ")
        ? raw.slice(raw.indexOf(" — ") + 3)
        : null;
    return { name, status: t.status, notes };
  });

  const confirmedCause = causes?.[0]
    ? [causes[0].causes?.name, causes[0].causes?.description ?? causes[0].evidence]
        .filter(Boolean)
        .join(" — ")
    : null;

  const prefill = buildSavPrefill(
    {
      date: new Date(incident.closed_at ?? Date.now()).toLocaleDateString("fr-FR"),
      clientName: incident.clients?.name,
      company: incident.clients?.company_name,
      phone: incident.clients?.phone,
      email: incident.clients?.email,
      machineModel: incident.machine_models?.name,
      serialNumber:
        incident.machines?.serial_number ?? incident.machines?.internal_reference,
      technician: profile.full_name || profile.email,
      problemDescription: incident.description_initial ?? incident.title,
      confirmedCause,
      currentSummary: incident.current_summary,
      solutionText: solutions?.[0]?.solution_text ?? null,
      replacedParts: incident.machines?.replaced_parts ?? null,
      tests,
    },
    incident.sav_json,
  );

  return (
    <div className="mx-auto max-w-3xl p-8 print:max-w-none print:p-0">
      <div className="mb-4 print:hidden">
        <Link
          href={`/incidents/${incident.id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← Retour à l&apos;incident {incident.incident_number}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Fiche SAV / Intervention — {incident.incident_number}
        </h1>
        <p className="text-sm text-slate-500">
          Pré-remplie depuis le dossier. Corrige/complète, enregistre, puis
          imprime pour les signatures.
        </p>
      </div>

      <SavForm
        incidentId={incident.id}
        incidentNumber={incident.incident_number}
        initialFields={prefill.fields}
      />
    </div>
  );
}
