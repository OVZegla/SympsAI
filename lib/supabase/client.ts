"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Uses ONLY public env vars (URL + anon key) — these
 * are safe to ship to the browser. RLS enforces per-organization access on top
 * of the anon key (spec §46). Never import admin.ts here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
