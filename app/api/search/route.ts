import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEvidenceDossier } from "@/lib/rag/context-builder";

/**
 * POST /api/search — the full evidence dossier (documents + incidents) for a
 * query (spec §54, §44). Runs under the caller's RLS. This is retrieval WITHOUT
 * the AI (spec §58 Phase 3).
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { query?: string; machineModelId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const dossier = await buildEvidenceDossier(supabase, query, {
      machineModelId: body.machineModelId ?? null,
    });
    return NextResponse.json({ dossier });
  } catch (err) {
    console.error("[api/search] failed:", (err as Error).message);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
