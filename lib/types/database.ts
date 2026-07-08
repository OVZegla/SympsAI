// Hand-written domain types mirroring the SQL schema (supabase/migrations).
//
// These are the reusable domain types referenced across the app (CLAUDE.md:
// "Reusable domain types in lib/types/"). When the Supabase CLI is available,
// generated types (`supabase gen types typescript`) can supersede or augment
// these, but hand-written types keep the foundation self-contained and readable.

export type UserRole = "admin" | "technician" | "viewer";
export type MachineStatus = "active" | "inactive" | "decommissioned";

export type IncidentStatus =
  | "new"
  | "investigating"
  | "waiting_client"
  | "waiting_supplier"
  | "resolved"
  | "closed"
  | "reopened";

export type IncidentSeverity = "low" | "normal" | "high" | "critical";
export type MessageAuthor = "user" | "assistant" | "system";

export type TestRunStatus =
  | "proposed"
  | "in_progress"
  | "passed"
  | "failed"
  | "inconclusive"
  | "not_applicable"
  | "cancelled";

export type RiskLevel = "low" | "normal" | "high";
export type CauseStatus = "hypothesis" | "eliminated" | "probable" | "confirmed";

export type DocumentType =
  | "procedure"
  | "manual"
  | "technical_note"
  | "configuration"
  | "training"
  | "troubleshooting"
  | "other";

export type DocumentStatus = "draft" | "review" | "approved" | "archived";

export type IncidentKnowledgeType =
  | "symptoms"
  | "diagnostic_path"
  | "confirmed_cause"
  | "validated_solution"
  | "final_summary";

export type AttachmentType =
  | "photo"
  | "screenshot"
  | "video"
  | "pdf"
  | "log"
  | "configuration"
  | "other";

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  odoo_external_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MachineModel {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Component {
  id: string;
  organization_id: string;
  machine_model_id: string;
  parent_component_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  organization_id: string;
  client_id: string | null;
  machine_model_id: string;
  serial_number: string | null;
  internal_reference: string | null;
  installation_date: string | null;
  status: MachineStatus;
  software_version: string | null;
  configuration_json: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  organization_id: string;
  incident_number: string;
  client_id: string | null;
  machine_id: string | null;
  machine_model_id: string | null;
  title: string;
  description_initial: string | null;
  status: IncidentStatus;
  severity: IncidentSeverity;
  current_summary: string | null;
  confirmed_cause_id: string | null;
  created_by: string | null;
  assigned_to: string | null;
  opened_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentMessage {
  id: string;
  incident_id: string;
  author_type: MessageAuthor;
  author_user_id: string | null;
  content: string | null;
  structured_content_json: unknown | null;
  created_at: string;
}
