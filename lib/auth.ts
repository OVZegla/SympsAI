import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

/**
 * Fetch the signed-in user's profile (organization + role). Redirects to
 * /login if there is no session. Use in server components / actions that
 * require an authenticated user.
 */
export async function requireProfile(): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    // Authenticated but no profile row yet (trigger pending / misconfigured).
    redirect("/login");
  }

  return profile;
}

/** True if the profile may write technical data (spec §8). */
export function canWrite(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "technician";
}
