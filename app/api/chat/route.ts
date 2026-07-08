import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDiagnosis } from "@/lib/ai/diagnosis";

/**
 * POST /api/chat — run the assistant on an incident (spec §54, §58 Phase 4).
 * Records the technician's message, runs the diagnosis pipeline (retrieval →
 * Claude → validated structured answer), and returns the structured response.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    incidentId?: string;
    query?: string;
  };
  const incidentId = (body.incidentId ?? "").trim();
  const query = (body.query ?? "").trim();
  if (!incidentId || !query) {
    return NextResponse.json({ error: "incidentId and query are required" }, { status: 400 });
  }

  // Load the incident to scope retrieval to its machine model. RLS guarantees
  // the caller can only read incidents in their organization.
  const { data: incident } = await supabase
    .from("incidents")
    .select("id, machine_model_id")
    .eq("id", incidentId)
    .maybeSingle<{ id: string; machine_model_id: string | null }>();
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  // Record the technician's message.
  await supabase.from("incident_messages").insert({
    incident_id: incidentId,
    author_type: "user",
    author_user_id: user.id,
    content: query,
  });

  try {
    const result = await runDiagnosis(supabase, {
      incidentId,
      machineModelId: incident.machine_model_id,
      query,
    });
    return NextResponse.json({ response: result.response, messageId: result.messageId });
  } catch (err) {
    console.error("[api/chat] diagnosis failed:", (err as Error).message);
    // Record the failure for observability (spec §48).
    await supabase.from("ai_runs").insert({
      incident_id: incidentId,
      status: "error",
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: "L'assistant n'a pas pu produire de diagnostic." },
      { status: 502 },
    );
  }
}
