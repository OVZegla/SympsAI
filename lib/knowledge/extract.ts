import "server-only";

/**
 * Text extraction (spec §28 "EXTRACTION DU CONTENU"). V1 handles text and
 * Markdown directly. Binary formats (PDF, images) are a pluggable step: the
 * caller can supply already-extracted text, and a PDF extractor (e.g. `unpdf`
 * or a Tika/pdf service) drops in here without changing the ingestion pipeline.
 *
 * We keep the original file in Storage regardless (spec §30) so a better
 * extractor can be re-run later.
 */
export interface ExtractResult {
  text: string;
  /** True when we could extract text; false means the caller must supply it. */
  extracted: boolean;
}

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/xml",
  "application/x-markdown",
]);

export function isTextMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return (
    TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) ||
    TEXT_MIME_EXACT.has(mimeType)
  );
}

export async function extractText(
  file: Blob,
  mimeType: string | null,
): Promise<ExtractResult> {
  if (isTextMime(mimeType)) {
    return { text: await file.text(), extracted: true };
  }
  // Non-text formats are not extracted in V1. The pipeline still stores the
  // original; ingestion must be given pre-extracted text for these.
  return { text: "", extracted: false };
}
