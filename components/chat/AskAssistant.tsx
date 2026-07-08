"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sends the technician's message to the assistant (spec §15 "Analyser le
 * problème", §21 interactive diagnosis). On success it refreshes the server
 * component so the newly-persisted user + assistant messages render.
 */
export function AskAssistant({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = value.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, query }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setValue("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-white p-4">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Décris le problème ou le résultat d'un test…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Analyse…" : "Analyser"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}
