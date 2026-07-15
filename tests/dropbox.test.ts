import { describe, it, expect } from "vitest";
import {
  planSync,
  mimeForFilename,
  titleFromFilename,
  type RemoteFile,
} from "@/lib/dropbox/plan";

const file = (name: string, rev: string): RemoteFile => ({
  name,
  pathDisplay: `/Symps/Documentations/${name}`,
  pathLower: `/symps/documentations/${name.toLowerCase()}`,
  rev,
});

describe("mimeForFilename", () => {
  it("prend en charge PDF, Markdown et texte", () => {
    expect(mimeForFilename("Manuel-M1.pdf")).toBe("application/pdf");
    expect(mimeForFilename("notes.md")).toBe("text/markdown");
    expect(mimeForFilename("liste.TXT")).toBe("text/plain");
  });

  it("prend en charge les photos (importées sans extraction)", () => {
    expect(mimeForFilename("carte-principale.jpg")).toBe("image/jpeg");
    expect(mimeForFilename("IMG_0042.HEIC")).toBe("image/heic");
    expect(mimeForFilename("capture.png")).toBe("image/png");
  });

  it("ignore les vidéos et autres formats non importables", () => {
    expect(mimeForFilename("video.mp4")).toBeNull();
    expect(mimeForFilename("demo.mov")).toBeNull();
    expect(mimeForFilename("archive.zip")).toBeNull();
    expect(mimeForFilename("sans-extension")).toBeNull();
  });
});

describe("titleFromFilename", () => {
  it("nettoie tirets/underscores et retire l'extension", () => {
    expect(titleFromFilename("manuel-demarrage_M1 v2.pdf")).toBe("manuel demarrage M1 v2");
  });
});

describe("planSync", () => {
  it("importe les nouveaux (PDF + photos), re-versionne les modifiés, ignore les vidéos", () => {
    const remote = [
      file("nouveau.pdf", "r1"),
      file("photo-carte.jpg", "r5"),
      file("modifie.pdf", "r2-nouvelle"),
      file("inchange.md", "r3"),
      file("video.mp4", "r4"),
    ];
    const existing = [
      { documentId: "d1", sourcePath: "/symps/documentations/modifie.pdf", sourceRev: "r2-ancienne" },
      { documentId: "d2", sourcePath: "/symps/documentations/inchange.md", sourceRev: "r3" },
    ];

    const plan = planSync(remote, existing);
    expect(plan.toCreate.map((f) => f.name)).toEqual(["nouveau.pdf", "photo-carte.jpg"]);
    expect(plan.toUpdate).toEqual([
      { file: remote[2], documentId: "d1" },
    ]);
    expect(plan.unchanged).toBe(1);
    expect(plan.ignored).toEqual(["video.mp4"]);
  });

  it("écarte les fichiers trop volumineux sans les traiter en erreur", () => {
    const big = { ...file("scan-geant.pdf", "r9"), size: 200 * 1024 * 1024 };
    const plan = planSync([big], []);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.tooLarge).toEqual(["scan-geant.pdf"]);
  });

  it("ne réimporte rien quand les révisions sont identiques", () => {
    const remote = [file("doc.pdf", "r1")];
    const plan = planSync(remote, [
      { documentId: "d1", sourcePath: "/symps/documentations/doc.pdf", sourceRev: "r1" },
    ]);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });
});
