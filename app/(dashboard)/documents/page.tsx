import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default function DocumentsPage() {
  return (
    <PhasePlaceholder title="Documents" phase="Phase 2 — à venir">
      <p>
        La gestion documentaire (upload, versioning, métadonnées, extraction,
        chunking et embeddings) est prévue en phase 2. Le schéma de base de
        données (<code>documents</code>, <code>document_versions</code>,{" "}
        <code>document_chunks</code>) existe déjà.
      </p>
    </PhasePlaceholder>
  );
}
