# lib/security — safety & authorization helpers

Home for cross-cutting safety logic (spec §40-§41, §53):

- Gating dangerous operations (mains voltage, UV, open power supply, sensor
  bypass, mechanical movement, chemicals) behind an approved Symp's procedure —
  the AI must never invent a dangerous procedure from general knowledge.
- Enforcing that sensitive writes (confirm a cause, close an incident, publish a
  procedure) require explicit human confirmation and are recorded in
  `audit_logs` (§24, §11).

Per-organization / per-role access is enforced primarily by Postgres RLS
(`supabase/migrations/0006_rls.sql`) and by `lib/auth.ts`; this module holds the
application-level rules that RLS cannot express.
