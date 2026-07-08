export function PhasePlaceholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <div className="mt-6 max-w-xl rounded-lg border border-dashed border-slate-300 bg-white p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {phase}
        </p>
        <div className="text-sm text-slate-600">{children}</div>
      </div>
    </div>
  );
}
