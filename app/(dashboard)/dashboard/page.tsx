import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  // Small dashboard counters (spec §14). RLS scopes these to the user's org.
  const [openRes, waitingRes, draftDocsRes] = await Promise.all([
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "investigating", "reopened"]),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting_client"),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "review"]),
  ]);

  const openCount = openRes.count ?? 0;
  const waitingCount = waitingRes.count ?? 0;
  const draftDocs = draftDocsRes.count ?? 0;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Bonjour {profile.full_name || profile.email.split("@")[0]}
      </h1>
      <p className="mt-1 text-slate-500">Que veux-tu faire ?</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link
          href="/incidents/new"
          className="rounded-lg border border-slate-200 bg-white p-4 text-center font-medium text-slate-800 shadow-sm hover:border-slate-400"
        >
          Décrire un problème
        </Link>
        <Link
          href="/incidents"
          className="rounded-lg border border-slate-200 bg-white p-4 text-center font-medium text-slate-800 shadow-sm hover:border-slate-400"
        >
          Rechercher un incident
        </Link>
        <Link
          href="/documents"
          className="rounded-lg border border-slate-200 bg-white p-4 text-center font-medium text-slate-800 shadow-sm hover:border-slate-400"
        >
          Ouvrir la documentation
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Incidents ouverts" value={openCount} />
        <Stat label="En attente client" value={waitingCount} />
        <Stat label="Documents à valider" value={draftDocs} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
