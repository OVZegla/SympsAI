import { confirmAndClose } from "@/app/(dashboard)/incidents/[id]/closure-actions";

/**
 * Human validation + closure form (spec §32). The technician confirms the
 * cause and the applied solution; submitting promotes the cause to `confirmed`,
 * closes the incident, and indexes it into confirmed knowledge. The AI can
 * propose a summary but never performs this step itself (spec §24, §2.4).
 */
export function ClosurePanel({ incidentId }: { incidentId: string }) {
  return (
    <details className="rounded-md border border-slate-200 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
        Clôturer l&apos;incident
      </summary>

      <form
        action={confirmAndClose.bind(null, incidentId)}
        className="mt-3 space-y-2 text-sm"
      >
        <label className="block text-xs font-medium text-slate-600">
          Cause confirmée
          <input
            name="cause_name"
            required
            placeholder="Connecteur d'alimentation mal enfiché"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Détail de la cause
          <textarea
            name="cause_description"
            rows={2}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Solution appliquée
          <textarea
            name="solution_text"
            required
            rows={2}
            placeholder="Reconnexion et sécurisation du connecteur."
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Synthèse finale
          <textarea
            name="final_summary"
            rows={2}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-slate-600">
          Soumettre une leçon à la base de connaissance (facultatif)
          <textarea
            name="knowledge_statement"
            rows={2}
            placeholder="Ex. Sur M1, un liseré blanc régulier venait d'une contraction de sélection oubliée dans Photoshop."
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
            Elle restera « en attente de validation » jusqu&apos;à ce qu&apos;un
            admin la confirme sur la page Connaissance.
          </span>
        </label>

        <button className="w-full rounded bg-green-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-800">
          Valider &amp; clôturer
        </button>
        <p className="text-xs text-slate-400">
          Valide la cause (validation humaine) et rend l&apos;incident
          retrouvable pour les prochains diagnostics.
        </p>
      </form>
    </details>
  );
}
