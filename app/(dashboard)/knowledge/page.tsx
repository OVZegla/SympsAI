import {
  KNOWLEDGE_ITEMS,
  UNKNOWNS,
  CONTRADICTIONS,
  GUIDED_TESTS,
  NORMAL_BEHAVIORS,
  normalizeText,
  formatSource,
} from "@/lib/knowledge/base";
import type { CertaintyLevel } from "@/lib/knowledge/base";

/**
 * Base Symp's v0.1 — consultation de la couche connaissance (§16-§17F du
 * cahier d'intégration) : recherche par mot-clé / catégorie / certitude,
 * inconnues contrôlées, contradictions conservées, tests guidés. Le document
 * humain de référence est versionné dans knowledge/symps-machines/. Toute
 * évolution passe par une modification revue (git), jamais par un apprentissage
 * silencieux de l'assistant.
 */

const CERTAINTY_LABEL: Record<CertaintyLevel, string> = {
  CONFIRMED_USER: "Confirmé (Loïc)",
  CONFIRMED_MANUAL: "Confirmé (manuel)",
  PROBABLE: "Probable",
  UNKNOWN: "Inconnu",
  DO_NOT_INVENT: "Ne pas inventer",
};

const CERTAINTY_STYLE: Record<CertaintyLevel, string> = {
  CONFIRMED_USER: "bg-green-100 text-green-800",
  CONFIRMED_MANUAL: "bg-green-50 text-green-700",
  PROBABLE: "bg-amber-100 text-amber-800",
  UNKNOWN: "bg-slate-100 text-slate-600",
  DO_NOT_INVENT: "bg-red-100 text-red-800",
};

const SAFETY_LABEL = {
  SAFE: "🟢 Sûr",
  CAUTION: "🟠 Prudence",
  STOP_MACHINE: "🔴 Machine éteinte",
} as const;

export default function KnowledgePage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; certainty?: string };
}) {
  const q = normalizeText(searchParams.q ?? "");
  const category = searchParams.category ?? "";
  const certainty = searchParams.certainty ?? "";

  const categories = [...new Set(KNOWLEDGE_ITEMS.map((i) => i.category))].sort();

  const items = KNOWLEDGE_ITEMS.filter((item) => {
    if (category && item.category !== category) return false;
    if (certainty && item.certainty !== certainty) return false;
    if (q) {
      const haystack = normalizeText(
        `${item.title} ${item.statement} ${item.keywords.join(" ")} ${item.category}`,
      );
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">
        Base de connaissance Symp&apos;s
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Base Symp&apos;s v0.1 — source de vérité du moteur de diagnostic. Document de
        référence : <code>knowledge/symps-machines/Symps_AI_Base_Connaissance_v0.1.md</code>.
        Toute nouvelle connaissance passe par une validation humaine avant d&apos;entrer ici.
      </p>

      {/* Recherche technique (§17F) */}
      <form className="mb-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Symptôme, composant, test, mot-clé…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <select
          name="category"
          defaultValue={category}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="certainty"
          defaultValue={certainty}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          <option value="">Toutes certitudes</option>
          {Object.entries(CERTAINTY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Rechercher
        </button>
      </form>

      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">{item.title}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${CERTAINTY_STYLE[item.certainty]}`}
                >
                  {CERTAINTY_LABEL[item.certainty]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{item.statement}</p>
              <p className="mt-2 text-xs text-slate-400">
                {item.category} · {formatSource(item.source)}
                {item.status === "CONTRADICTED" ? " · ⚠️ contradiction non résolue" : ""}
              </p>
            </div>
          ))}
          {items.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              Aucun fait ne correspond à cette recherche.
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Inconnues contrôlées */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Inconnues contrôlées ({UNKNOWNS.length})
            </h2>
            <p className="mb-2 text-xs text-slate-400">
              L&apos;assistant ne complète jamais ces points par imagination.
            </p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {UNKNOWNS.map((u) => (
                <li key={u.id}>
                  <span className="font-medium">{u.topic}</span>
                  <span className="text-xs text-slate-500"> — {u.statement}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Contradictions */}
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="mb-2 text-sm font-semibold text-amber-900">
              Contradictions non résolues ({CONTRADICTIONS.length})
            </h2>
            <ul className="space-y-2 text-sm text-amber-900">
              {CONTRADICTIONS.map((c) => (
                <li key={c.id}>
                  <p className="font-medium">{c.topic}</p>
                  <ul className="mt-0.5 list-disc pl-5 text-xs">
                    {c.positions.map((p, i) => (
                      <li key={i}>
                        {p.statement} <span className="text-amber-700">({p.source})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-0.5 text-xs text-amber-700">
                    Valeur exacte à confirmer selon la version de machine.
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Comportements normaux */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Comportements normaux ({NORMAL_BEHAVIORS.length})
            </h2>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {NORMAL_BEHAVIORS.map((nb) => (
                <li key={nb.id}>
                  <span className="font-medium">{nb.title}</span>
                  <span className="text-xs text-slate-500"> — {nb.statement}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Tests guidés */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Tests guidés ({GUIDED_TESTS.length})
            </h2>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {GUIDED_TESTS.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-slate-500"> — {t.objective}</span>
                  </span>
                  <span className="shrink-0 text-xs">{SAFETY_LABEL[t.safetyLevel]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
