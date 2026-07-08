import type { SupportLevel } from "@/lib/ai/schemas";

/** Qualitative support level badge — never a fake percentage (spec §34). */
const CONFIG: Record<SupportLevel, { label: string; className: string }> = {
  none: { label: "Non soutenu", className: "bg-slate-200 text-slate-700" },
  low: { label: "Faible", className: "bg-amber-100 text-amber-800" },
  moderate: { label: "Modéré", className: "bg-blue-100 text-blue-800" },
  high: { label: "Élevé", className: "bg-green-100 text-green-800" },
};

export function SupportBadge({ level }: { level: SupportLevel }) {
  const { label, className } = CONFIG[level];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      Soutien : {label}
    </span>
  );
}
