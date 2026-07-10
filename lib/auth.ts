import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, UserRole } from "@/lib/types/database";

const ROLES: UserRole[] = ["admin", "technician", "viewer"];

/**
 * Ensure the authenticated user has a profile, creating one if missing.
 *
 * There is no public sign-up (spec §13): every auth user is a legitimate member
 * of the single V1 organization. The handle_new_user trigger normally creates
 * the profile, but if it didn't fire (e.g. the account was created before the
 * org existed), we self-heal here using the service-role client so login never
 * dead-ends. Returns null only if no organization exists at all.
 */
async function ensureProfile(userId: string, email: string, metadata: Record<string, unknown>): Promise<Profile | null> {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!org) return null;

  const metaRole = typeof metadata.role === "string" ? metadata.role : "";
  const role: UserRole = ROLES.includes(metaRole as UserRole)
    ? (metaRole as UserRole)
    : "technician";
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name : null;

  await admin.from("profiles").upsert(
    {
      id: userId,
      organization_id: org.id,
      email,
      full_name: fullName,
      role,
    },
    { onConflict: "id" },
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();
  return profile ?? null;
}

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
    .maybeSingle<Profile>();

  if (profile) return profile;

  // Authenticated but no profile — self-heal (create it) rather than bounce.
  const healed = await ensureProfile(user.id, user.email ?? "", user.user_metadata ?? {});
  if (!healed) {
    // No organization exists at all — the seed didn't run. Nothing we can do
    // here; surface it clearly.
    redirect("/login?error=noprofile");
  }
  return healed;
}

/** True if the profile may write technical data (spec §8). */
export function canWrite(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "technician";
}
