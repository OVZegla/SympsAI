"use client";

import { useState } from "react";
import type { EvidenceDossier } from "@/lib/rag/types";

/**
 * Manual search bar, independent of the chat (spec §44). Calls the Phase 3
 * retrieval API directly — no AI involved — and shows results grouped by source
 * type in authority order (spec §18-§19).
 */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [dossier, setDossier] = useState<EvidenceDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { dossier: EvidenceDossier };
      setDossier(json.dossier);
    } catch {
      setError("La recherche a échoué.");
    } finally {
      setLoading(false);
    }
  }

  const total = dossier
    ? dossier.procedures.length +
      dossier.documentation.length +
      dossier.resolvedIncidents.length +
      dossier.openIncidents.length
    : 0;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Recherche</h1>
      <p className="mt-1 text-sm text-slate-500">
        Recherche mots-clés + sémantique dans la mémoire technique (sans IA).
      </p>

      <form onSubmit={runSearch} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="voyant vert carte mère"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "…" : "Rechercher"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {dossier && (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-slate-500">{total} résultat(s)</p>
          <Group title="Procédures approuvées" hits={dossier.procedures} />
          <Group title="Documentation approuvée" hits={dossier.documentation} />
          <IncidentGroup title="Incidents résolus" hits={dossier.resolvedIncidents} />
          <IncidentGroup title="Incidents ouverts" hits={dossier.openIncidents} />
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  hits,
}: {
  title: string;
  hits: EvidenceDossier["procedures"];
}) {
  if (hits.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title} ({hits.length})
      </h2>
      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={h.chunkId} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">
              {h.documentCode ? `${h.documentCode} — ` : ""}
              {h.documentTitle}
            </p>
            {h.heading && <p className="text-xs text-slate-400">{h.heading}</p>}
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{h.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IncidentGroup({
  title,
  hits,
}: {
  title: string;
  hits: EvidenceDossier["resolvedIncidents"];
}) {
  if (hits.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title} ({hits.length})
      </h2>
      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={h.chunkId} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">
              {h.incidentNumber}
              {h.hasConfirmedCause && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  cause confirmée
                </span>
              )}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{h.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
