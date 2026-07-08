import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchIncidents } from "@/lib/rag/search";

/** POST /api/search/incidents — similar incidents from validated memory (spec §54). */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    machineModelId?: string | null;
    excludeIncidentId?: string | null;
  };
  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  try {
    const hits = await searchIncidents(supabase, query, {
      machineModelId: body.machineModelId ?? null,
      excludeIncidentId: body.excludeIncidentId ?? null,
    });
    return NextResponse.json({ hits });
  } catch (err) {
    console.error("[api/search/incidents] failed:", (err as Error).message);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
