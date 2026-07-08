/**
 * Re-index embeddings with the configured local provider (Ollama/embeddinggemma).
 *
 *   npm run embeddings:reindex          # embed chunks missing a vector
 *   npm run embeddings:reindex -- --all # re-embed everything (clears first)
 *
 * Safe to rerun: by default it only touches chunks whose embedding is null (or
 * was produced by a different model), so it never duplicates chunks. Works in
 * batches and reports progress and failures; a failed batch leaves those chunks
 * unembedded (retriable on the next run) and the script exits non-zero.
 *
 * Standalone Node script: it builds its own Supabase (service-role) client and
 * embedding service, so it does not pull in the app's `server-only` modules.
 */
import { createClient } from "@supabase/supabase-js";
import { getEmbeddingConfig } from "../lib/embeddings/validation";
import { createEmbeddingProvider } from "../lib/embeddings/provider";
import { createEmbeddingService } from "../lib/embeddings/service";

interface ChunkTable {
  table: string;
  select: string;
}

const TABLES: ChunkTable[] = [
  { table: "document_chunks", select: "id, content, embedding_model" },
  { table: "incident_knowledge_chunks", select: "id, content, embedding_model" },
];

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const reembedAll = process.argv.includes("--all");
  const config = getEmbeddingConfig();
  const service = createEmbeddingService(createEmbeddingProvider(config), config.batchSize);
  const meta = service.getMetadata();
  const supabase = supabaseAdmin();

  console.log(`Re-indexing with ${meta.provider}/${meta.model} (dim ${meta.dimension}).`);

  // Fail fast if the provider is not usable.
  const health = await service.healthCheck();
  if (health.status !== "connected") {
    console.error(`Embedding provider not available: ${health.error}`);
    process.exit(1);
  }

  let totalOk = 0;
  let totalFailed = 0;

  for (const { table, select } of TABLES) {
    let query = supabase.from(table).select(select);
    // Default run: only chunks with no compatible vector yet.
    if (!reembedAll) {
      query = query.or(`embedding_model.is.null,embedding_model.neq.${meta.model}`);
    }
    const { data, error } = await query.returns<
      { id: string; content: string; embedding_model: string | null }[]
    >();
    if (error) {
      console.error(`[${table}] failed to list chunks: ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    const chunks = data ?? [];
    if (chunks.length === 0) {
      console.log(`[${table}] nothing to do.`);
      continue;
    }
    console.log(`[${table}] ${chunks.length} chunk(s) to embed.`);

    // Batch through the service so we never load the whole base into one request.
    for (let i = 0; i < chunks.length; i += config.batchSize) {
      const batch = chunks.slice(i, i + config.batchSize);
      try {
        const vectors = await service.embedDocuments(batch.map((c) => c.content));
        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from(table)
            .update({
              embedding: `[${vectors[j]!.join(",")}]`,
              embedding_provider: meta.provider,
              embedding_model: meta.model,
              embedding_dimension: meta.dimension,
              embedded_at: new Date().toISOString(),
            })
            .eq("id", batch[j]!.id);
          if (updateError) throw new Error(updateError.message);
        }
        totalOk += batch.length;
        console.log(`[${table}] embedded ${Math.min(i + batch.length, chunks.length)}/${chunks.length}`);
      } catch (err) {
        // Do NOT mark this batch as embedded — leave it retriable.
        totalFailed += batch.length;
        console.error(`[${table}] batch failed (retry later): ${(err as Error).message}`);
      }
    }
  }

  console.log(`\nDone. Embedded: ${totalOk}. Failed (retriable): ${totalFailed}.`);
  if (totalFailed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
