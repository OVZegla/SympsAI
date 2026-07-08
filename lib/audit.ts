import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Record a sensitive action in audit_logs (spec §11, §48). Sensitive actions:
 * validating a cause, publishing/modifying a procedure, deleting data,
 * modifying validated knowledge, changing a role, closing an incident.
 *
 * Audit failures must not silently break the primary action, but we surface
 * them in the server logs so a missing trail is noticed.
 */
export async function recordAudit(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityType?: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    before_json: params.before ?? null,
    after_json: params.after ?? null,
  });

  if (error) {
    console.error(`[audit] failed to record "${params.action}":`, error.message);
  }
}
