export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rr-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
