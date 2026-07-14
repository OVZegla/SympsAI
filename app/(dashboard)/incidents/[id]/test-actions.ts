"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import type { TestRunStatus } from "@/lib/types/database";

const RESULT_STATUSES: TestRunStatus[] = [
  "passed",
  "failed",
  "inconclusive",
  "not_applicable",
  "cancelled",
];

/**
 * Propose a diagnostic test run on an incident (spec §21, §23). Created as
 * `proposed`; the technician then records the actual result. This is the
 * interactive branch: one test at a time, the next adapts to the result.
 */
export async function proposeTestRun(
  incidentId: string,
  formData: FormData,
) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Insufficient permissions.");

  const supabase = createClient();
  const diagnosticTestId = String(formData.get("diagnostic_test_id") || "").trim() || null;
  const title = String(formData.get("title") || "").trim();

  await supabase.from("incident_test_runs").insert({
    incident_id: incidentId,
    diagnostic_test_id: diagnosticTestId,
    proposed_by: "user",
    status: "proposed",
    result_notes: title || null,
  });

  revalidatePath(`/incidents/${incidentId}`);
}

/**
 * Record the result of a GUIDED test proposed by the deterministic engine
 * (Base Symp's — carte « Prochaine vérification »). One click: the run is
 * created already completed, the transcript gets a system entry, and the
 * engine takes the result into account on the next turn (it never re-asks a
 * performed test). Guided tests live in code (lib/knowledge/base/tests.ts),
 * not in the diagnostic_tests table, so the run is identified by its name in
 * result_notes.
 */
export async function recordGuidedTestResult(
  incidentId: string,
  testName: string,
  formData: FormData,
) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Insufficient permissions.");

  const statusRaw = String(formData.get("status") || "");
  const status: TestRunStatus = RESULT_STATUSES.includes(statusRaw as TestRunStatus)
    ? (statusRaw as TestRunStatus)
    : "inconclusive";
  const notes = String(formData.get("notes") || "").trim();

  const supabase = createClient();
  await supabase.from("incident_test_runs").insert({
    incident_id: incidentId,
    diagnostic_test_id: null,
    proposed_by: "assistant",
    status,
    performed_by: profile.id,
    completed_at: new Date().toISOString(),
    // Le nom du test guidé sert d'identifiant pour le moteur (résolution par
    // libellé) et de titre lisible dans le panneau des tests.
    result_notes: notes ? `${testName} — ${notes}` : testName,
  });

  await supabase.from("incident_messages").insert({
    incident_id: incidentId,
    author_type: "system",
    content: `Vérification « ${testName} » : ${status}${notes ? ` — ${notes}` : ""}`,
  });

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "test_run.record_guided_result",
    entityType: "incident",
    entityId: incidentId,
    after: { test: testName, status, notes },
  });

  revalidatePath(`/incidents/${incidentId}`);
}

/**
 * Record the result of a test run (spec §22). This is a WRITE the technician
 * performs explicitly — the AI never fabricates a result (spec §35). It also
 * appends a system message to the transcript so the diagnostic history is
 * complete and the next assistant turn can react to it.
 */
export async function recordTestResult(
  incidentId: string,
  testRunId: string,
  formData: FormData,
) {
  const profile = await requireProfile();
  if (!canWrite(profile)) throw new Error("Insufficient permissions.");

  const statusRaw = String(formData.get("status") || "");
  const status: TestRunStatus = RESULT_STATUSES.includes(statusRaw as TestRunStatus)
    ? (statusRaw as TestRunStatus)
    : "inconclusive";
  const notes = String(formData.get("notes") || "").trim() || null;

  const supabase = createClient();

  const { data: run } = await supabase
    .from("incident_test_runs")
    .select("id, diagnostic_test_id")
    .eq("id", testRunId)
    .maybeSingle<{ id: string; diagnostic_test_id: string | null }>();
  if (!run) throw new Error("Test run not found.");

  await supabase
    .from("incident_test_runs")
    .update({
      status,
      result_notes: notes,
      performed_by: profile.id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", testRunId);

  // Fetch the test title for a readable transcript entry.
  let testTitle = "Test";
  if (run.diagnostic_test_id) {
    const { data: test } = await supabase
      .from("diagnostic_tests")
      .select("title")
      .eq("id", run.diagnostic_test_id)
      .maybeSingle<{ title: string }>();
    if (test) testTitle = test.title;
  }

  await supabase.from("incident_messages").insert({
    incident_id: incidentId,
    author_type: "system",
    content: `Résultat du test « ${testTitle} » : ${status}${notes ? ` — ${notes}` : ""}`,
  });

  await recordAudit(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "test_run.record_result",
    entityType: "incident_test_run",
    entityId: testRunId,
    after: { status, notes },
  });

  revalidatePath(`/incidents/${incidentId}`);
}
