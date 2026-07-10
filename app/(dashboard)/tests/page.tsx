import { createClient } from "@/lib/supabase/server";
import { createDiagnosticTest } from "./actions";
import type { RiskLevel } from "@/lib/types/database";

interface TestRow {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  risk_level: RiskLevel;
  machine_models: { name: string } | null;
  components: { name: string } | null;
}

interface ComponentRow {
  id: string;
  name: string;
  machine_models: { name: string } | null;
}

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900";

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Faible",
  normal: "Normal",
  high: "Élevé",
};

export default async function TestsPage() {
  const supabase = createClient();

  const [{ data: tests }, { data: models }, { data: components }] = await Promise.all([
    supabase
      .from("diagnostic_tests")
      .select("id, code, title, description, risk_level, machine_models(name), components(name)")
      .order("code")
      .returns<TestRow[]>(),
    supabase.from("machine_models").select("id, name").eq("active", true).order("name"),
    supabase
      .from("components")
      .select("id, name, machine_models(name)")
      .order("name")
      .returns<ComponentRow[]>(),
  ]);

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Tests de diagnostic</h1>
      <p className="mb-6 text-sm text-slate-500">
        Le catalogue des tests que l&apos;assistant peut proposer pendant un diagnostic.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* List */}
        <div className="space-y-2">
          {(tests ?? []).map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">
                  {t.code ? <span className="font-mono text-xs text-slate-500">{t.code} · </span> : null}
                  {t.title}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {RISK_LABEL[t.risk_level]}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t.machine_models?.name ?? "Tous modèles"}
                {t.components?.name ? ` · ${t.components.name}` : ""}
              </p>
              {t.description && (
                <p className="mt-1 text-sm text-slate-600">{t.description}</p>
              )}
            </div>
          ))}
          {(tests ?? []).length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              Aucun test. Crée-en un à droite.
            </div>
          )}
        </div>

        {/* Creation form */}
        <form
          action={createDiagnosticTest}
          className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-900">Nouveau test</h2>

          <label className="block text-sm font-medium text-slate-700">
            Titre *
            <input name="title" required className={inputClass} placeholder="Contrôle alimentation carte" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Code
            <input name="code" className={inputClass} placeholder="TEST-M1-COM-004" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Machine
            <select name="machine_model_id" className={inputClass} defaultValue="">
              <option value="">Tous modèles</option>
              {(models ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Composant (facultatif)
            <select name="component_id" className={inputClass} defaultValue="">
              <option value="">—</option>
              {(components ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.machine_models?.name ? `${c.machine_models.name} · ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Description (à quoi sert le test)
            <textarea name="description" rows={2} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Instructions (comment le réaliser)
            <textarea name="instructions" rows={3} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Niveau de risque
            <select name="risk_level" className={inputClass} defaultValue="normal">
              <option value="low">Faible</option>
              <option value="normal">Normal</option>
              <option value="high">Élevé</option>
            </select>
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Créer le test
          </button>
        </form>
      </div>
    </div>
  );
}
