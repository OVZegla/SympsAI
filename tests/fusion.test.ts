import { describe, it, expect } from "vitest";
import {
  reciprocalRankFusion,
  documentSourceLevel,
  incidentSourceLevel,
  orderByAuthorityThenScore,
} from "@/lib/rag/fusion";
import { SourceLevel, type DocumentHit } from "@/lib/rag/types";

describe("reciprocalRankFusion", () => {
  it("ranks an item appearing high in both lists above single-list items", () => {
    const keyword = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const semantic = [{ id: "a" }, { id: "d" }, { id: "b" }];
    const fused = reciprocalRankFusion([keyword, semantic], (x) => x.id);
    expect(fused[0]!.item.id).toBe("a"); // top of both lists
  });

  it("includes items unique to one list", () => {
    const l1 = [{ id: "x" }];
    const l2 = [{ id: "y" }];
    const fused = reciprocalRankFusion([l1, l2], (x) => x.id);
    expect(fused.map((f) => f.item.id).sort()).toEqual(["x", "y"]);
  });

  it("handles empty lists", () => {
    expect(reciprocalRankFusion([[], []], (x: { id: string }) => x.id)).toEqual([]);
  });
});

describe("source levels (spec §19)", () => {
  it("ranks approved procedure above approved documentation", () => {
    expect(documentSourceLevel("approved", true)).toBe(SourceLevel.ApprovedProcedure);
    expect(documentSourceLevel("approved", false)).toBe(
      SourceLevel.ApprovedDocumentation,
    );
    expect(SourceLevel.ApprovedProcedure).toBeLessThan(
      SourceLevel.ApprovedDocumentation,
    );
  });

  it("ranks a confirmed-cause resolved incident above one without", () => {
    expect(incidentSourceLevel("resolved", true)).toBe(
      SourceLevel.ResolvedIncidentConfirmedCause,
    );
    expect(incidentSourceLevel("closed", false)).toBe(
      SourceLevel.ResolvedIncidentNoConfirmedCause,
    );
  });

  it("treats a new/investigating incident as an open incident", () => {
    expect(incidentSourceLevel("new", false)).toBe(SourceLevel.OpenIncident);
    expect(incidentSourceLevel("investigating", true)).toBe(SourceLevel.OpenIncident);
  });
});

describe("orderByAuthorityThenScore", () => {
  it("an approved procedure outranks a more-relevant note (spec §18)", () => {
    const note: DocumentHit = {
      kind: "document",
      chunkId: "1",
      documentId: "d1",
      documentCode: null,
      documentTitle: "Note",
      documentStatus: "draft",
      machineModelId: null,
      heading: null,
      content: "…",
      pageNumber: null,
      score: 0.99,
      sourceLevel: SourceLevel.InternalNote,
    };
    const procedure: DocumentHit = {
      ...note,
      chunkId: "2",
      documentId: "d2",
      documentTitle: "PROC",
      documentStatus: "approved",
      score: 0.1,
      sourceLevel: SourceLevel.ApprovedProcedure,
    };
    const ordered = orderByAuthorityThenScore([note, procedure]);
    expect(ordered[0]!.documentId).toBe("d2");
  });
});
