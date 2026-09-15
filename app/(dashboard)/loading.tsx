export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-none">
      <div className="mb-8 h-8 w-48 rounded bg-neutral-200" />
      <div className="space-y-3">
        <div className="h-24 rounded-lg border border-neutral-200 bg-white" />
        <div className="h-24 rounded-lg border border-neutral-200 bg-white" />
        <div className="h-24 rounded-lg border border-neutral-200 bg-white" />
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading…</p>
    </div>
  );
}
