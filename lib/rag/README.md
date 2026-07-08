# lib/rag — retrieval pipeline (Phase 3)

Built and tested **before** the assistant (Phase 4). Retrieval alone must be
able to surface `PROC-M1-COM-003` and `INC-0042` for the reference scenario
(spec §58 Phase 3, §66).

Planned modules (spec §53, §17):

- `query-parser.ts` — turn free text into the parsed-query structure (§16).
- `keyword-search.ts` — Postgres full-text search over `content_tsv` (§17 step 4).
- `semantic-search.ts` — pgvector cosine search over embeddings (§17 step 3).
- `hybrid-search.ts` — fuse keyword + semantic + technical filters (§17 steps 5-6).
- `rerank.ts` — Voyage reranking of the top candidates (§17 step 7).
- `context-builder.ts` — assemble the "dossier de preuves" with source levels (§18-§19).

Design rules: run **separate** searches for procedures, documents, resolved
incidents and open incidents (§18) so an unresolved conversation can never
overwrite an approved procedure. Record every run in `retrieval_runs` (§48).
Do **not** put retrieval logic inside React components (CLAUDE.md).
