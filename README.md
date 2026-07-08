# Symp's AI

Internal AI-assisted technical knowledge and diagnostic system for Symp's
printing machines. A technician describes a problem in natural language; the
application identifies the machine and symptoms, searches approved procedures
and past resolved incidents, separates facts from hypotheses, proposes the next
diagnostic test, records results, and — only after human validation — turns a
solved incident into reusable knowledge.

> It is **not** "ChatGPT with Symp's PDFs". It is a technical-memory system
> assisted by AI. PostgreSQL owns the truth; Claude is the engine that traverses
> it. See [`CLAUDE.md`](./CLAUDE.md) for the working principles and the full
> specification for the product vision.

## Status

**Phase 0 + Phase 1 implemented** (spec §58):

- Next.js (App Router) + TypeScript strict foundation.
- Supabase Auth with a login screen (no public sign-up) and route-level auth
  guard via middleware.
- Full PostgreSQL schema for **all** phases with Row Level Security on every
  table (`supabase/migrations/`).
- Roles (admin / technician / viewer) and per-organization isolation.
- Machine models, the component hierarchy, clients, physical machines.
- Incidents: creation from a free-text description, list, and a detail view with
  the two-pane chat/context layout.
- A basic dashboard.

**Scaffolding, not yet wired** (later phases): the AI layer (`lib/ai/`), RAG
(`lib/rag/`, `lib/knowledge/`), versioned prompts (`prompts/`), and the eval
harness (`evals/`) exist as typed placeholders. Per the spec, retrieval (Phase
3) must be built and tested *before* the assistant (Phase 4).

## Stack

Next.js · TypeScript · Supabase (PostgreSQL / Auth / Storage) · pgvector ·
Anthropic native SDK · Voyage embeddings. Model ids are configured via
environment variables and never hard-coded (spec §55).

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local        # then fill in real values

# 3. Apply the database schema
#    With the Supabase CLI against a local or linked project:
supabase db reset                 # runs migrations in supabase/migrations/
psql "$DATABASE_URL" -f supabase/seed/seed.sql   # optional: seed M1 + Opaline

# 4. Run
npm run dev                       # http://localhost:3000
```

Create your first user from the Supabase dashboard (Auth → Users). The
`handle_new_user` trigger provisions the matching profile and attaches it to the
single organization. Set `role` to `admin` in the `profiles` table for the first
account.

## Scripts

| Command             | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server                 |
| `npm run build`     | Production build                     |
| `npm run typecheck` | `tsc --noEmit` (strict)              |
| `npm run lint`      | ESLint (next/core-web-vitals)        |
| `npm test`          | Unit tests (Vitest)                  |
| `npm run evals`     | Load AI eval cases (spec §50)        |

## Security

- Three secrets stay server-side only and never reach the browser (spec §47):
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`.
- RLS baseline: a user's `organization_id` must equal the row's
  `organization_id`. Writes to technical data require the technician/admin role;
  deletions are admin-only (`supabase/migrations/0006_rls.sql`).
- The AI reaches data only through explicit tools (`lib/ai/tools.ts`), never
  arbitrary SQL. Sensitive writes require human confirmation (spec §24).

## Repository layout

```
app/            Next.js routes (auth, dashboard, api)
components/      React components
lib/
  ai/           Anthropic client, models, tools, schemas (scaffold)
  rag/          retrieval pipeline (later phase)
  knowledge/    ingestion / chunking / embeddings (later phase)
  supabase/     client / server / admin DB access
  types/        reusable domain types
prompts/        versioned system prompts
evals/          AI evaluation cases + runner
supabase/       migrations + seed
tests/          unit tests
```
