"use client";

import dynamic from "next/dynamic";
import type { Visit } from "@/lib/types";

/**
 * Recharts is the largest thing in the dashboard bundle. Load it only on
 * the patient page, only in the browser, and only when there is a number
 * to plot, so opening a patient with no readings costs nothing extra.
 */
const TrendCharts = dynamic(() => import("./trend-charts").then((m) => m.TrendCharts), {
  ssr: false,
  loading: () => (
    <section className="mb-10" aria-busy="true">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">Trends</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-lg border border-neutral-200 bg-white" />
        <div className="h-64 rounded-lg border border-neutral-200 bg-white" />
      </div>
    </section>
  ),
});

export function TrendChartsLazy({ visits }: { visits: Visit[] }) {
  const hasNumbers = visits.some(
    (v) =>
      v.hba1c !== null ||
      v.fbs !== null ||
      v.weight_kg !== null ||
      v.bp_systolic !== null ||
      v.bp_diastolic !== null,
  );
  if (!hasNumbers) return null;
  return <TrendCharts visits={visits} />;
}
