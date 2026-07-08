# lib/knowledge — document & incident ingestion (Phase 2 & 6, implemented)

Turns documents and validated incidents into searchable, cited chunks
(spec §28-§33).

Modules:

- `extract.ts` — text extraction (text/markdown; binary formats pluggable, the
  original is always kept in Storage per §30).
- `chunking.ts` — structure-aware Markdown chunking, ~650 tokens with light
  overlap; never blind fixed-size splits (§29). Unit-tested.
- `embeddings.ts` — adapter over the generic embedding service
  (`lib/embeddings/`), which uses the local Ollama provider (`embeddinggemma`).
  Writes embedding provenance (provider/model/dimension/embedded_at) alongside
  each vector.
- `ingestion.ts` — chunk → embed → index into `document_chunks` (RLS-scoped);
  `toVectorLiteral` formats vectors for pgvector.
- `incident-indexing.ts` — indexes a HUMAN-VALIDATED incident into
  `incident_knowledge_chunks` (§33); only reached via the closure/validation
  flow, never for unvalidated incidents (§2.3).

Keyword search keeps working even when embeddings are absent (the `content_tsv`
columns are generated in SQL).
