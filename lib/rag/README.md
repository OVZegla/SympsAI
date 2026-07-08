# lib/rag — retrieval pipeline (Phase 3, implemented)

Retrieval works standalone, without the AI (spec §58 Phase 3, §17-§19). The
manual search screen and `/api/search*` exercise it directly.

Modules:

- `types.ts` — hit types and `SourceLevel` (source authority, spec §19).
- `fusion.ts` — Reciprocal Rank Fusion + source-authority ordering (unit-tested).
- `search.ts` — keyword (FTS) + semantic (pgvector) search over documents and
  incident knowledge, fused with RRF; degrades to keyword-only if embeddings are
  unavailable. Queries are embedded with the SAME provider/model as the
  documents (via `lib/embeddings/`), and semantic search is filtered to that
  model so vectors from a different model never leak in.
- `context-builder.ts` — the "dossier de preuves": separate buckets per source
  type so an unresolved conversation can't outrank an approved procedure (§18).

The SQL search functions live in `supabase/migrations/0009_search_functions.sql`
(dimensions/RPCs updated to 768 in `0011_embeddings_ollama.sql`) and run under
the caller's RLS. Retrieval runs are recorded in `retrieval_runs` by the
assistant (§48). Retrieval logic stays out of React components (CLAUDE.md).
