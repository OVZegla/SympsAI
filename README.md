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
**local Ollama AI by default** (LLM `qwen2.5`, vision `llama3.2-vision`,
embeddings `embeddinggemma` 768-dim) · Anthropic native SDK as an optional
higher-quality backend. Model ids are configured via environment variables and
never hard-coded (spec §55). **By default the app runs 100% free and offline —
no API key of any kind.**

## Démarrage rapide (une commande)

Prérequis : [Node 20+](https://nodejs.org), [Docker Desktop](https://docs.docker.com/get-docker/)
et [Ollama](https://ollama.com/download) (pour l'IA locale gratuite — optionnel).

```bash
npm install
npm run setup      # une fois : base locale + schéma + compte admin + modèles IA
npm start          # tout démarre tout seul + ouvre le navigateur
```

- Connexion par défaut : `admin@symps.local` / `symps-admin` (à changer).
- **Tout se sauvegarde automatiquement** : les données vivent dans PostgreSQL
  (volumes Docker persistants). Quitter avec Ctrl+C ne perd rien ;
  `npm run stop` arrête la base en conservant les données.
- `npm run setup -- --vision` télécharge aussi le modèle d'analyse d'images
  (~8 Go, optionnel).
- Sans Ollama : incidents, machines, clients, recherche par mots-clés et
  statistiques fonctionnent quand même.

## AI backends (local by default, Claude optional)

| Task | Default (free, local) | Optional (paid) |
|---|---|---|
| Query analysis | Ollama `qwen2.5` | Claude (`CLAUDE_FAST_MODEL`) |
| Diagnosis | Ollama `qwen2.5` | Claude (`CLAUDE_PRIMARY_MODEL`) |
| Image analysis | Ollama `llama3.2-vision` | Claude |
| Embeddings | Ollama `embeddinggemma` | — (always local) |

Switch by env var — no code change:

```env
# everything on Claude:
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# or hybrid: keep local parsing/vision, route only the diagnosis to Claude:
LLM_DIAGNOSIS_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Provider health is shown on the **Admin** page and the dashboard.

### Manual setup (without the one-command scripts)

```bash
cp .env.example .env.local            # defaults are fine for local use
npx supabase start                     # local Postgres/Auth/Storage (Docker)
npx supabase db reset                  # migrations + seed
ollama pull embeddinggemma && ollama pull qwen2.5
npm run dev                            # http://localhost:3000
npm run embeddings:reindex             # (re)generate vectors for existing data
```

Create users from Supabase Studio (http://localhost:54323 → Auth → Users); the
`handle_new_user` trigger provisions the profile. Set `role` to `admin` in
`profiles` for the first account.

## Scripts

| Command                      | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `npm run setup`              | One-time install: local DB + schema + admin + AI models |
| `npm start`                  | Start everything (DB, Ollama, app) + open the browser |
| `npm run stop`               | Stop the local DB (data is kept)               |
| `npm run dev`                | Start only the Next.js dev server              |
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
  ai/           LLM orchestration (llm/ provider abstraction: Ollama | Claude)
  embeddings/   provider abstraction + local Ollama provider + service
  rag/          retrieval pipeline (keyword + semantic + fusion)
  knowledge/    document/incident ingestion, chunking, embedding
  supabase/     client / server / admin DB access
  types/        reusable domain types
prompts/        versioned system prompts
evals/          AI evaluation cases + runner
scripts/        setup/start/stop + embeddings:reindex
supabase/       migrations + seed
tests/          unit tests
```
