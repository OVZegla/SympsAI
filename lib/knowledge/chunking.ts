/**
 * Structure-aware document chunking (spec §29). We do NOT split blindly every N
 * characters: we respect the document structure (Markdown headings) and only
 * pack paragraphs up to a target size, with a light overlap when the meaning
 * carries across a boundary.
 *
 * Pure and unit-tested (tests/chunking.test.ts) so the chunking behaviour is
 * verifiable independently of any file/PDF parsing.
 *
 * Token counts are approximated (≈ 4 chars/token) — good enough for sizing
 * chunks; exact counts are recorded per chunk when embeddings are produced.
 */

export interface Chunk {
  chunkIndex: number;
  content: string;
  heading: string | null;
  tokenCount: number;
}

export interface ChunkOptions {
  /** Target chunk size in tokens (spec §29: ~500-800). */
  targetTokens?: number;
  /** Overlap in tokens carried into the next chunk when a section is split. */
  overlapTokens?: number;
}

const CHARS_PER_TOKEN = 4;

export function approxTokens(text: string): number {
  return Math.ceil(text.trim().length / CHARS_PER_TOKEN);
}

/** A heading line like `## Vérification alimentation` → its text, else null. */
function headingOf(line: string): string | null {
  const m = /^(#{1,6})\s+(.*)$/.exec(line.trim());
  return m ? m[2]!.trim() : null;
}

interface Section {
  heading: string | null;
  paragraphs: string[];
}

/** Split raw text into sections keyed by the nearest preceding heading. */
function toSections(text: string): Section[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let current: Section = { heading: null, paragraphs: [] };
  let buffer: string[] = [];

  const flushParagraph = () => {
    const para = buffer.join("\n").trim();
    if (para) current.paragraphs.push(para);
    buffer = [];
  };

  for (const line of lines) {
    const heading = headingOf(line);
    if (heading !== null) {
      flushParagraph();
      if (current.heading !== null || current.paragraphs.length > 0) {
        sections.push(current);
      }
      current = { heading, paragraphs: [] };
    } else if (line.trim() === "") {
      flushParagraph();
    } else {
      buffer.push(line);
    }
  }
  flushParagraph();
  if (current.heading !== null || current.paragraphs.length > 0) {
    sections.push(current);
  }

  return sections;
}

/** Tail of `text` containing roughly `overlapTokens` tokens, on a word boundary. */
function overlapTail(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return "";
  const chars = overlapTokens * CHARS_PER_TOKEN;
  if (text.length <= chars) return text;
  const tail = text.slice(text.length - chars);
  const spaceIdx = tail.indexOf(" ");
  return spaceIdx > 0 ? tail.slice(spaceIdx + 1) : tail;
}

/**
 * Chunk a (Markdown-ish) document. Paragraphs under the same heading are packed
 * together up to `targetTokens`; an oversized single paragraph is hard-split.
 */
export function chunkDocument(text: string, options: ChunkOptions = {}): Chunk[] {
  const targetTokens = options.targetTokens ?? 650;
  const overlapTokens = options.overlapTokens ?? 60;

  const chunks: Chunk[] = [];
  let index = 0;

  const push = (content: string, heading: string | null) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    chunks.push({
      chunkIndex: index++,
      content: trimmed,
      heading,
      tokenCount: approxTokens(trimmed),
    });
  };

  for (const section of toSections(text)) {
    let currentParts: string[] = [];
    let currentTokens = 0;

    const flush = () => {
      if (currentParts.length === 0) return;
      push(currentParts.join("\n\n"), section.heading);
      currentTokens = 0;
      currentParts = [];
    };

    for (const paragraph of section.paragraphs) {
      const paraTokens = approxTokens(paragraph);

      // A single oversized paragraph: emit what we have, then hard-split it.
      if (paraTokens > targetTokens) {
        flush();
        const words = paragraph.split(/\s+/);
        let part: string[] = [];
        for (const word of words) {
          part.push(word);
          if (approxTokens(part.join(" ")) >= targetTokens) {
            push(part.join(" "), section.heading);
            part = [];
          }
        }
        if (part.length > 0) push(part.join(" "), section.heading);
        continue;
      }

      // Packing this paragraph would overflow: flush with overlap first.
      if (currentTokens + paraTokens > targetTokens && currentParts.length > 0) {
        const previous = currentParts.join("\n\n");
        flush();
        const tail = overlapTail(previous, overlapTokens);
        if (tail) {
          currentParts.push(tail);
          currentTokens += approxTokens(tail);
        }
      }

      currentParts.push(paragraph);
      currentTokens += paraTokens;
    }

    flush();
  }

  // Re-index sequentially in case sections produced interleaved pushes.
  return chunks.map((c, i) => ({ ...c, chunkIndex: i }));
}
