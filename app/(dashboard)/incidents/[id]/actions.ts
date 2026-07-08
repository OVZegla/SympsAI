"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";

/**
 * Append a message to an incident transcript. Phase 1: records the technician's
 * notes/observations. The AI assistant reply is added in Phase 4 (spec §58).
 */
export async function addMessage(incidentId: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile)) {
    throw new Error("Insufficient permissions.");
  }

  const content = String(formData.get("content") || "").trim();
  if (!content) return;

  const supabase = createClient();
  await supabase.from("incident_messages").insert({
    incident_id: incidentId,
    author_type: "user",
    author_user_id: profile.id,
    content,
  });

  revalidatePath(`/incidents/${incidentId}`);
}
