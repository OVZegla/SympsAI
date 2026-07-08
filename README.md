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

**Phases 0–8 implemented** (spec §58); Phase 9 (Odoo) is a documented seam only.

- **Phase 0** — Next.js (App Router) + TypeScript strict; Supabase Auth (login,
  no public sign-up) + route-level auth guard; full PostgreSQL schema for all
  phases with RLS on every table; roles (admin/technician/viewer) and
  per-organization isolation.
- **Phase 1** — machine models, component hierarchy, clients, physical machines;
  incidents (create from free text, list, two-pane detail); dashboard.
- **Phase 2** — document upload, versioning, Storage, structure-aware chunking,
  local Ollama (`embeddinggemma`) embeddings, indexing.
- **Phase 3** — retrieval (keyword FTS + pgvector semantic + filters + RRF
  fusion + source-authority ordering), a standalone manual search screen, and
  `/api/search*`. Runs **without** the AI.
- **Phase 4** — assistant: AI query analysis, retrieval-grounded, schema-
  validated cited answers (`/api/chat`), observability (`ai_runs`,
  `retrieval_runs`).
- **Phase 5** — interactive diagnosis: test catalogue, structured result
  recording, machine history.
- **Phase 6** — memory: human-validated closure that confirms a cause and
  indexes the incident into searchable knowledge.
- **Phase 7** — photos: attachment upload + Claude-vision image analysis.
- **Phase 8** — statistics: incidents by model/component, frequent causes,
  recurrence.

Anthropic and Supabase Storage call their real APIs and need live credentials to
run end-to-end; embeddings run locally via Ollama. The pure logic (chunking, RRF
fusion, source-authority ordering, incident numbering, embedding
provider/validation) is covered by unit tests.

## Stack

Next.js · TypeScript · Supabase (PostgreSQL / Auth / Storage) · pgvector ·
Anthropic native SDK · **local Ollama embeddings (`embeddinggemma`, 768-dim)**.
Model ids are configured via environment variables and never hard-coded
(spec §55). Embeddings run fully locally — no external embedding API key.

## Embeddings (local, via Ollama)

Embeddings are generated locally by [Ollama](https://ollama.com) running the
`embeddinggemma` model. There is **no Voyage account and no embedding API key**.

```bash
# 1. Install Ollama (see https://ollama.com/download), then start it.
#    The desktop app runs a server on http://127.0.0.1:11434 automatically;
#    on a headless machine run:  ollama serve

# 2. Download the embedding model:
ollama pull embeddinggemma
```

Ollama must be running and reachable at `OLLAMA_BASE_URL` for semantic search
and document indexing. Keyword / full-text search works even when it is not.
Check the provider status any time on the **Admin** page.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local        # fill Supabase + Anthropic; embedding vars have defaults

# 3. Apply the database schema
#    With the Supabase CLI against a local or linked project:
supabase db reset                 # runs migrations in supabase/migrations/
psql "$DATABASE_URL" -f supabase/seed/seed.sql   # optional: seed M1 + Opaline

# 4. Make sure Ollama is running + the model is pulled (see "Embeddings" above)
ollama pull embeddinggemma

# 5. Run
npm run dev                       # http://localhost:3000

# 6. (When you already have documents/incidents) generate their vectors:
npm run embeddings:reindex
```

Create your first user from the Supabase dashboard (Auth → Users). The
`handle_new_user` trigger provisions the matching profile and attaches it to the
single organization. Set `role` to `admin` in the `profiles` table for the first
account.

### Embedding environment variables

```env
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=embeddinggemma
EMBEDDING_DIMENSION=768
OLLAMA_BASE_URL=http://127.0.0.1:11434
EMBEDDING_BATCH_SIZE=32          # optional
```

## Scripts

| Command                      | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `npm run dev`                | Start the dev server                           |
| `npm run build`              | Production build                               |
| `npm run typecheck`          | `tsc --noEmit` (strict)                        |
| `npm run lint`               | ESLint (next/core-web-vitals)                  |
| `npm test`                   | Unit tests (Vitest)                            |
| `npm run evals`              | Load AI eval cases (spec §50)                  |
| `npm run embeddings:reindex` | (Re)generate chunk embeddings via Ollama; add `-- --all` to re-embed everything |

## Security

- Secrets stay server-side only and never reach the browser (spec §47):
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`. Ollama is called only from
  the server (`OLLAMA_BASE_URL` is not a `NEXT_PUBLIC_` variable) — the browser
  talks to the app, the app talks to Ollama.
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
  ai/           Anthropic client, models, tools, schemas, orchestration
  embeddings/   provider abstraction + local Ollama provider + service
  rag/          retrieval pipeline (keyword + semantic + fusion)
  knowledge/    document/incident ingestion, chunking, embedding
  supabase/     client / server / admin DB access
  types/        reusable domain types
prompts/        versioned system prompts
evals/          AI evaluation cases + runner
scripts/        maintenance scripts (embeddings:reindex)
supabase/       migrations + seed
tests/          unit tests
```
