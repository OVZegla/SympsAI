# lib/knowledge — document ingestion (Phase 2)

Turns uploaded documents into searchable, cited chunks (spec §28-§30, §53).

Planned modules:

- `ingestion.ts` — upload → store original → extract → detect structure →
  chunk → add metadata → embed → index (§28 pipeline).
- `chunking.ts` — structure-aware chunks of ~500-800 tokens with light overlap;
  respect headings/sections, never split blindly every N characters (§29).
- `embeddings.ts` — call Voyage with `EMBEDDING_MODEL` / `EMBEDDING_DIMENSION`
  (§55); write into `document_chunks.embedding` (vector(1024)).

Keep the original file in Supabase Storage, and preserve page numbers and
important images so answers can cite exact locations and pass diagrams to Claude
(§30). Every document version is retained so old incidents keep showing the
version used at diagnosis time (§11).
