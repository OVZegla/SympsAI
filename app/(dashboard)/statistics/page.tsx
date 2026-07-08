import { createClient } from "@/lib/supabase/server";

interface ModelStat {
  machine_model_name: string | null;
  incident_count: number;
}
interface ComponentStat {
  component_name: string | null;
  incident_count: number;
}
interface CauseStat {
  cause_name: string | null;
  incident_count: number;
}

export default async function StatisticsPage() {
  const supabase = createClient();

  const [byModel, byComponent, frequentCauses] = await Promise.all([
    supabase
      .from("stats_incidents_by_model")
      .select("machine_model_name, incident_count")
      .order("incident_count", { ascending: false })
      .returns<ModelStat[]>(),
    supabase
      .from("stats_incidents_by_component")
      .select("component_name, incident_count")
      .order("incident_count", { ascending: false })
      .returns<ComponentStat[]>(),
    supabase
      .from("stats_frequent_causes")
      .select("cause_name, incident_count")
      .order("incident_count", { ascending: false })
      .limit(10)
      .returns<CauseStat[]>(),
  ]);

  const models = byModel.data ?? [];
  const components = byComponent.data ?? [];
  const causes = frequentCauses.data ?? [];
  const componentTotal = components.reduce((s, c) => s + c.incident_count, 0);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Statistiques</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Incidents par machine">
          <BarList
            items={models.map((m) => ({
              label: m.machine_model_name ?? "—",
              value: m.incident_count,
            }))}
          />
        </Card>

        <Card title="Incidents par composant">
          <BarList
            items={components.map((c) => ({
              label: c.component_name ?? "—",
              value: c.incident_count,
              percent: componentTotal ? Math.round((c.incident_count / componentTotal) * 100) : 0,
            }))}
            showPercent
          />
        </Card>

        <Card title="Causes fréquentes">
          <BarList
            items={causes.map((c) => ({
              label: c.cause_name ?? "—",
              value: c.incident_count,
            }))}
          />
        </Card>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Récurrence : le nombre d&apos;incidents partageant une même cause
        confirmée (spec §45). Les statistiques deviennent significatives à mesure
        que des incidents sont clôturés et validés.
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function BarList({
  items,
  showPercent = false,
}: {
  items: { label: string; value: number; percent?: number }[];
  showPercent?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">Aucune donnée.</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i}>
          <div className="flex justify-between text-sm">
            <span className="text-slate-700">{item.label}</span>
            <span className="text-slate-500">
              {showPercent && item.percent !== undefined
                ? `${item.percent}%`
                : item.value}
            </span>
          </div>
          <div className="mt-1 h-2 rounded bg-slate-100">
            <div
              className="h-2 rounded bg-slate-800"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
