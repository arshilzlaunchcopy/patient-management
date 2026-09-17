/**
 * Shown while a dashboard page is fetching on first load. A pulsing sketch
 * of a page header, four counters and a list, so it is obvious something is
 * on its way rather than a blank screen.
 */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-48 rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-neutral-100" />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="h-3 w-20 rounded bg-neutral-100" />
            <div className="mt-3 h-8 w-12 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-neutral-100 px-5 py-4 last:border-b-0"
          >
            <div className="h-9 w-9 rounded bg-neutral-100" />
            <div className="flex-1">
              <div className="h-4 w-40 rounded bg-neutral-200" />
              <div className="mt-2 h-3 w-24 rounded bg-neutral-100" />
            </div>
            <div className="h-10 w-24 rounded-md bg-neutral-100" />
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading…</p>
    </div>
  );
}
