import { describe, it, expect } from "vitest";
import { chunkDocument, approxTokens } from "@/lib/knowledge/chunking";

describe("chunkDocument", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkDocument("")).toEqual([]);
    expect(chunkDocument("   \n\n  ")).toEqual([]);
  });

  it("keeps a small document as a single chunk and captures the heading", () => {
    const doc = "# Titre\n\nUn petit paragraphe.";
    const chunks = chunkDocument(doc);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.heading).toBe("Titre");
    expect(chunks[0]!.content).toContain("petit paragraphe");
  });

  it("splits across headings into separate sections", () => {
    const doc =
      "## Section A\n\nContenu A.\n\n## Section B\n\nContenu B.";
    const chunks = chunkDocument(doc);
    const headings = chunks.map((c) => c.heading);
    expect(headings).toContain("Section A");
    expect(headings).toContain("Section B");
  });

  it("packs paragraphs up to the target size then starts a new chunk", () => {
    const para = "mot ".repeat(200).trim(); // ~200 tokens
    const doc = `# H\n\n${para}\n\n${para}\n\n${para}`;
    const chunks = chunkDocument(doc, { targetTokens: 250, overlapTokens: 0 });
    // Three ~200-token paragraphs at target 250 → cannot all fit in one chunk.
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(300);
    }
  });

  it("hard-splits a single oversized paragraph", () => {
    const huge = "mot ".repeat(1000).trim(); // ~1000 tokens
    const chunks = chunkDocument(huge, { targetTokens: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(260);
    }
  });

  it("produces sequential chunk indices", () => {
    const doc = "# A\n\n" + "x ".repeat(500) + "\n\n# B\n\n" + "y ".repeat(500);
    const chunks = chunkDocument(doc, { targetTokens: 150 });
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });
});

describe("approxTokens", () => {
  it("approximates ~4 chars per token", () => {
    expect(approxTokens("abcd")).toBe(1);
    expect(approxTokens("abcdefgh")).toBe(2);
  });
});
