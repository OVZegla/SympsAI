import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceStatuses } from "@/lib/status";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_CLASSES,
  formatDate,
} from "@/lib/format";
import type { IncidentStatus } from "@/lib/types/database";

interface RecentIncident {
  id: string;
  incident_number: string;
  title: string;
  status: IncidentStatus;
  opened_at: string;
  machine_models: { name: string } | null;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [openRes, recentRes, statuses] = await Promise.all([
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "investigating", "reopened"]),
    supabase
      .from("incidents")
      .select("id, incident_number, title, status, opened_at, machine_models(name)")
      .order("opened_at", { ascending: false })
      .limit(5)
      .returns<RecentIncident[]>(),
    getServiceStatuses(),
  ]);

  const openCount = openRes.count ?? 0;
  const recent = recentRes.data ?? [];
  const firstName = profile.full_name?.split(" ")[0] || profile.email.split("@")[0];

  return (
    <div className="mx-auto max-w-4xl p-8">
      {/* Hero */}
      <div className="rounded-2xl bg-slate-900 p-8 text-white">
        <h1 className="text-2xl font-semibold">Bonjour {firstName} 👋</h1>
        <p className="mt-2 max-w-xl text-slate-300">
          Décris un problème machine : l&apos;assistant identifie la machine,
          retrouve les cas similaires et les procédures, te guide test par test —
          et enregistre l&apos;incident dans la mémoire technique.
        </p>
        <Link
          href="/incidents/new"
          className="mt-5 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
        >
          🔧 Décrire un problème
        </Link>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <QuickAction href="/incidents" emoji="📋" label="Incidents" detail={`${openCount} ouvert(s)`} />
        <QuickAction href="/search" emoji="🔍" label="Recherche" detail="mémoire technique" />
        <QuickAction href="/documents" emoji="📄" label="Documents" detail="procédures & manuels" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_260px]">
        {/* Recent incidents */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Derniers incidents
          </h2>
          {recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              Aucun incident pour l&apos;instant.
              <br />
              <Link href="/incidents/new" className="font-medium text-slate-800 underline">
                Décris ton premier problème
              </Link>{" "}
              pour commencer à remplir la mémoire technique.
            </div>
          ) : (
            <ul className="space-y-2">
              {recent.map((inc) => (
                <li key={inc.id}>
                  <Link
                    href={`/incidents/${inc.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {inc.incident_number} — {inc.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {inc.machine_models?.name ?? "Machine ?"} · {formatDate(inc.opened_at)}
                      </p>
                    </div>
                    <span
                      className={
                        "ml-3 shrink-0 rounded-full px-2 py-1 text-xs font-medium " +
                        INCIDENT_STATUS_CLASSES[inc.status]
                      }
                    >
                      {INCIDENT_STATUS_LABELS[inc.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Service status */}
        <aside>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Services
          </h2>
          <ul className="space-y-2">
            {statuses.map((s) => (
              <li
                key={s.label}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "h-2 w-2 rounded-full " + (s.ok ? "bg-green-500" : "bg-amber-500")
                    }
                  />
                  <p className="text-sm font-medium text-slate-800">{s.label}</p>
                </div>
                <p className="mt-1 text-xs text-slate-400">{s.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            L&apos;IA tourne en local (gratuit). Détails dans{" "}
            {profile.role === "admin" ? (
              <Link href="/admin" className="underline">
                Admin
              </Link>
            ) : (
              "Admin"
            )}
            .
          </p>
        </aside>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  emoji,
  label,
  detail,
}: {
  href: string;
  emoji: string;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400"
    >
      <span className="text-xl">{emoji}</span>
      <p className="mt-1 font-semibold text-slate-900">{label}</p>
      <p className="text-xs text-slate-400">{detail}</p>
    </Link>
  );
}
