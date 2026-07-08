# SYMP'S AI

## Mission

Build an internal technical support assistant for Symp's printing machines.

The application is a **knowledge and diagnostic system**. It is not a general
chatbot. Its value comes from the whole: machine structure + documentation +
incident history + intelligent retrieval + progressive diagnosis + human
validation + cumulative memory. Claude is the engine that traverses that
memory — Symp's owns the truth.

## Core principles (non-negotiable)

1. PostgreSQL is the source of truth. The AI model is **not**.
2. AI hypotheses are never stored as confirmed facts.
3. All confirmed causes require human validation.
4. Technical answers must expose their sources.
5. Approved procedures outrank incident history.
6. Resolved & confirmed incidents outrank unresolved incidents.
7. The AI must be able to abstain ("I cannot confirm the cause").
8. Never expose server API keys to the client.
9. Enable RLS on all exposed application tables.
10. All database changes must use migrations.

## Source-of-truth ordering (spec §19)

1. Approved official procedure
2. Approved technical documentation
3. Resolved incident with a confirmed cause
4. Resolved incident without a formally confirmed cause
5. Open incident
6. Internal note

## Stack

- Next.js (App Router) + TypeScript (strict)
- Supabase PostgreSQL / Auth / Storage
- pgvector for embeddings
- Anthropic **native** SDK (no compatibility shims, no LangChain unless proven necessary)
- **Local Ollama embeddings** (`embeddinggemma`, 768-dim) — no external embedding
  API key. The app depends on the `EmbeddingProvider` abstraction
  (`lib/embeddings/`), not on Ollama directly.

Model ids live in environment variables and are **never** hard-coded
(spec §55, avoid error #9). Read Claude model ids from `lib/ai/models.ts` and the
embedding configuration from `lib/embeddings/validation.ts`.

## Architecture rules

Keep these modules separate. Do **not** mix retrieval logic inside React
components.

- `app/` — UI (routes, server components, client components)
- `lib/supabase/` — database access (client / server / admin)
- `lib/embeddings/` — embedding provider abstraction + local Ollama provider + service
- `lib/knowledge/` — document ingestion, chunking, embeddings
- `lib/rag/` — retrieval (query parsing, keyword, semantic, hybrid, context)
- `lib/ai/` — AI orchestration (Anthropic client, tools, schemas, models)
- `prompts/` — versioned system prompts (markdown)

## AI rules

- The model reads through **explicit application tools** (`lib/ai/tools.ts`).
  Never give it arbitrary SQL access (avoid error #6/#5).
- Read tools (search, history, excerpts) run automatically.
- Any sensitive **write** (confirm a cause, close an incident, publish a
  procedure, modify a procedure, delete data) requires explicit user
  confirmation.
- All AI structured responses are validated against Zod/JSON schemas
  (`lib/ai/schemas.ts`).
- Show a qualitative support level (NONE / LOW / MODERATE / HIGH), never a
  fabricated confidence percentage (spec §34, avoid error #8).

## Security

- Server secrets stay server-side only: `SUPABASE_SERVICE_ROLE_KEY`,
  `ANTHROPIC_API_KEY`. The browser never receives them. Embeddings run on a
  local Ollama server reached only from server code (`OLLAMA_BASE_URL` is not
  public); no embedding API key exists.
- Every application table has RLS. Baseline rule: a user's `organization_id`
  must equal the row's `organization_id`.
- Dangerous physical operations (mains voltage, UV, sensor bypass, mechanical
  movement, chemicals) require an approved Symp's procedure. The AI must never
  invent a dangerous procedure from general knowledge (spec §40/§41).

## Code quality

- TypeScript strict mode. No `any` unless documented with a reason.
- Reusable domain types in `lib/types/`.
- Error handling on every external call (DB, Anthropic, Ollama).
- Audit sensitive actions (`audit_logs`).
- Tests for critical workflows.
- Comments explain **why**, not obvious syntax.

## Development process

Before implementing a large feature:

1. inspect the existing architecture;
2. explain the files that will change;
3. implement the smallest coherent version;
4. run checks (`npm run typecheck`, `npm run lint`, `npm test`);
5. fix errors;
6. summarize changes.

Never redesign unrelated parts without a reason.

## Build phases (spec §58)

- **Phase 0** — foundations: Next.js, Supabase, auth, navigation, DB, RLS.
- **Phase 1** — technical data: machine models, components, clients, machines,
  incidents; manual incident creation.
- **Phase 2** — documentation: upload, versioning, metadata, storage,
  extraction, chunking, embeddings.
- **Phase 3** — search (keyword + semantic + filters + fusion). Tested WITHOUT
  the AI first: retrieval alone must surface PROC-M1-COM-003 and INC-0042.
- **Phase 4** — assistant: query analysis, tools, retrieval, cited answers.
- **Phase 5** — interactive diagnosis: tests, results, branches, history.
- **Phase 6** — memory: closure, validation, summary, indexing.
- **Phase 7** — photos: screenshot/component analysis, incident association.
- **Phase 8** — statistics: frequent problems/causes, affected models, recurrence.

**Current status: Phases 0–8 implemented.** (Odoo, spec §9/§58 Phase 9, is
intentionally not built — out of scope.) The full database schema and RLS exist
for all phases; retrieval (Phase 3) works standalone and is exercised by the
manual search screen; the assistant (Phase 4) grounds its answers on retrieval,
never on model memory. Anthropic and Storage are implemented against their real
APIs; embeddings run locally via Ollama (`embeddinggemma`, 768-dim); pure logic
(chunking, RRF fusion, source-authority ordering, incident numbering, embedding
provider/validation) is unit-tested.
