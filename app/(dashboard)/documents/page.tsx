import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { uploadDocument, publishDocument, syncDropbox } from "./actions";
import { isDropboxLinked } from "@/lib/dropbox/sync";
import type { DocumentStatus, DocumentType } from "@/lib/types/database";

interface DocRow {
  id: string;
  document_code: string | null;
  title: string;
  document_type: DocumentType;
  status: DocumentStatus;
  updated_at: string;
  machine_models: { name: string } | null;
}

const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Brouillon",
  review: "En revue",
  approved: "Approuvé",
  archived: "Archivé",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { sync?: string };
}) {
  const supabase = createClient();
  const dropboxLinked = isDropboxLinked();

  const [{ data: docs }, { data: models }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, document_code, title, document_type, status, updated_at, machine_models(name)",
      )
      .order("updated_at", { ascending: false })
      .returns<DocRow[]>(),
    supabase.from("machine_models").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Documents</h1>

      {/* Import cloud Dropbox (compte lié via `npm run dropbox:link`). */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <span className="text-xl">📦</span>
        {dropboxLinked ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">Dropbox lié</p>
              <p className="text-xs text-slate-500">
                L&apos;app fouille le dossier configuré : nouveaux fichiers importés,
                fichiers modifiés re-versionnés (PDF, Markdown, texte).
              </p>
            </div>
            <form action={syncDropbox}>
              <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                🔄 Synchroniser depuis Dropbox
              </button>
            </form>
          </>
        ) : (
          <div>
            <p className="text-sm font-medium text-slate-800">Dropbox non lié</p>
            <p className="text-xs text-slate-500">
              Pour importer ta documentation depuis le cloud : dans le Terminal,{" "}
              <code className="rounded bg-slate-100 px-1">npm run dropbox:link</code>{" "}
              (une seule fois), puis redémarre l&apos;app.
            </p>
          </div>
        )}
      </div>

      {searchParams.sync && (
        <p className="mb-6 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          Synchronisation Dropbox : {searchParams.sync}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* List */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Machine</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">MAJ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(docs ?? []).map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {d.document_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{d.title}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {d.machine_models?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-1 text-xs font-medium " +
                        (d.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-600")
                      }
                    >
                      {STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(d.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.status !== "approved" && (
                      <form action={publishDocument.bind(null, d.id)}>
                        <button className="text-xs font-medium text-slate-700 hover:underline">
                          Publier
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {(docs ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucun document. Ajoute une procédure à droite.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Upload form */}
        <form
          action={uploadDocument}
          className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-900">Ajouter un document</h2>

          <Field label="Titre">
            <input name="title" required className={inputClass} />
          </Field>
          <Field label="Code (ex. PROC-M1-COM-003)">
            <input name="document_code" className={inputClass} />
          </Field>
          <Field label="Type">
            <select name="document_type" className={inputClass} defaultValue="procedure">
              <option value="procedure">Procédure</option>
              <option value="manual">Manuel</option>
              <option value="technical_note">Note technique</option>
              <option value="configuration">Configuration</option>
              <option value="training">Formation</option>
              <option value="troubleshooting">Dépannage</option>
              <option value="other">Autre</option>
            </select>
          </Field>
          <Field label="Machine">
            <select name="machine_model_id" className={inputClass} defaultValue="">
              <option value="">—</option>
              {(models ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fichier (texte / markdown)">
            <input type="file" name="file" className="mt-1 block w-full text-sm" />
          </Field>
          <Field label="…ou coller le contenu">
            <textarea name="text" rows={4} className={inputClass} />
          </Field>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Ajouter &amp; indexer
          </button>
          <p className="text-xs text-slate-400">
            Le contenu est découpé et vectorisé pour la recherche. Le document
            reste en brouillon jusqu&apos;à publication.
          </p>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}
