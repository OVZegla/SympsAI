import { uploadAttachment } from "@/app/(dashboard)/incidents/[id]/attachment-actions";
import type { AttachmentType } from "@/lib/types/database";

export interface AttachmentItem {
  id: string;
  filename: string | null;
  attachment_type: AttachmentType;
  description: string | null;
}

const TYPE_ICON: Record<AttachmentType, string> = {
  photo: "📷",
  screenshot: "🖼️",
  video: "🎥",
  pdf: "📄",
  log: "📃",
  configuration: "⚙️",
  other: "📎",
};

export function AttachmentsPanel({
  incidentId,
  attachments,
}: {
  incidentId: string;
  attachments: AttachmentItem[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Pièces jointes
      </p>

      <ul className="space-y-2">
        {attachments.map((a) => (
          <li key={a.id} className="rounded-md border border-slate-200 p-2 text-xs">
            <p className="text-slate-800">
              {TYPE_ICON[a.attachment_type]} {a.filename ?? "fichier"}
            </p>
            {a.description && (
              <p className="mt-1 whitespace-pre-wrap text-slate-500">{a.description}</p>
            )}
          </li>
        ))}
        {attachments.length === 0 && (
          <li className="text-xs text-slate-400">Aucune pièce jointe.</li>
        )}
      </ul>

      <form
        action={uploadAttachment.bind(null, incidentId)}
        className="mt-3 space-y-2 border-t border-slate-100 pt-3"
      >
        <input type="file" name="file" required className="block w-full text-xs" />
        <select
          name="attachment_type"
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          defaultValue=""
        >
          <option value="">Type auto</option>
          <option value="photo">Photo</option>
          <option value="screenshot">Capture d&apos;écran</option>
          <option value="video">Vidéo</option>
        </select>
        <button className="w-full rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
          Téléverser
        </button>
        <p className="text-xs text-slate-400">
          Les images sont analysées automatiquement (§38).
        </p>
      </form>
    </div>
  );
}
