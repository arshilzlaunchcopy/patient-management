import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import {
  getReport,
  parsePeriod,
  PERIOD_LABELS,
  PERIODS,
  periodRange,
  type Report,
} from "@/lib/reports/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Reports" };

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-neutral-900">{value}</p>
      {sub ? <p className="mt-1 text-sm text-neutral-500">{sub}</p> : null}
    </div>
  );
}

/** Horizontal bars, server-rendered. Widths are plain percentages, no chart library. */
function Bars({
  title,
  rows,
  format = (n) => String(n),
  empty = "Nothing in this period.",
}: {
  title: string;
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  empty?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <section className={`${cardClass} p-5`}>
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-neutral-800">{r.label}</span>
                <span className="shrink-0 tabular-nums text-neutral-700">
                  {format(r.value)}
                  {total > 0 && r.value > 0 ? (
                    <span className="ml-1.5 text-neutral-400">{Math.round((r.value / total) * 100)}%</span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: max ? `${Math.max(2, (r.value / max) * 100)}%` : "0%" }}
                />
              </div>
              {r.hint ? <p className="mt-0.5 text-xs text-neutral-500">{r.hint}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MonthTable({ months }: { months: Report["months"] }) {
  if (months.length === 0) return null;
  const maxRevenue = Math.max(...months.map((m) => m.revenue));
  return (
    <section className={`${cardClass} overflow-x-auto`}>
      <table className="w-full border-collapse md:min-w-[520px]">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-sm text-neutral-600">
          <tr>
            <th className="px-4 py-3 font-medium">Month</th>
            <th className="px-4 py-3 font-medium">Revenue</th>
            <th className="px-4 py-3 text-right font-medium">Visits</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Video</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Chamber</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 text-base">
          {months.map((m) => (
            <tr key={m.month}>
              <td className="whitespace-nowrap px-4 py-3 text-neutral-800">{m.label}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 tabular-nums text-neutral-900 md:w-24">{taka(m.revenue)}</span>
                  <div className="hidden h-2.5 w-full max-w-64 overflow-hidden rounded-full bg-neutral-100 sm:block">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: maxRevenue ? `${(m.revenue / maxRevenue) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{m.visits}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{m.video}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{m.chamber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const { from, to } = periodRange(period);
  const r = await getReport(from, to);

  const avgFee = r.visits ? r.revenue / r.visits : 0;
  const newTotal = r.newPatients.walk_in + r.newPatients.online_booking;
  const bookingsTotal =
    r.bookingsBySource.doctor + r.bookingsBySource.open_link + r.bookingsBySource.followup_link;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Revenue, patients seen, and where they came from. Counted from recorded visits and bookings."
      />

      <nav aria-label="Period" className="mb-2 flex flex-wrap gap-2">
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <Link
              key={p}
              href={p === "month" ? "/reports" : `/reports?period=${p}`}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-full border px-3.5 py-1.5 text-sm font-medium",
                active
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
              ].join(" ")}
            >
              {PERIOD_LABELS[p]}
            </Link>
          );
        })}
      </nav>
      <p className="mb-6 text-sm text-neutral-500">
        {period === "all" ? `Up to ${formatDate(to)}` : `${formatDate(from)} to ${formatDate(to)}`}
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Revenue" value={taka(r.revenue)} sub={r.visits ? `${taka(avgFee)} per visit` : undefined} />
        <Tile
          label="Patients seen"
          value={String(r.visits)}
          sub={`${r.uniquePatients} ${r.uniquePatients === 1 ? "person" : "different people"}`}
        />
        <Tile
          label="New patients"
          value={String(newTotal)}
          sub={newTotal ? `${r.newPatients.online_booking} joined online` : undefined}
        />
        <Tile
          label="Online bookings"
          value={String(r.bookingsBySource.open_link + r.bookingsBySource.followup_link)}
          sub={r.onlineBookingsPending ? `${r.onlineBookingsPending} still awaiting verification` : "verified and paid"}
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Bars
          title="Revenue by payment method"
          rows={[
            { label: "Cash at the chamber", value: r.revenueByPayment.cash, hint: `${r.byPayment.cash} visits` },
            {
              label: "bKash",
              value: r.revenueByPayment.bkash,
              hint: `${r.byPayment.bkash} visits${r.onlinePaidVisits ? `, ${r.onlinePaidVisits} paid online when booking` : ""}`,
            },
            { label: "Free", value: r.revenueByPayment.free, hint: `${r.byPayment.free} visits` },
          ]}
          format={taka}
        />
        <Bars
          title="Visits by mode"
          rows={[
            { label: "Chamber (walk-in)", value: r.chamber },
            { label: "Video call", value: r.video },
          ]}
        />
        <Bars
          title="How new patients arrived"
          rows={[
            { label: "Registered at the chamber", value: r.newPatients.walk_in },
            { label: "Self-registered through the booking link", value: r.newPatients.online_booking },
          ]}
          empty="No new patients registered in this period."
        />
        <Bars
          title="How bookings were made"
          rows={[
            { label: "Entered by the doctor", value: r.bookingsBySource.doctor },
            { label: "New-patient booking link", value: r.bookingsBySource.open_link },
            { label: "Follow-up SMS link", value: r.bookingsBySource.followup_link },
          ]}
          empty={bookingsTotal === 0 ? "No verified bookings in this period." : undefined}
        />
      </div>

      {r.months.length > 1 ? (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">Month by month</h2>
          <MonthTable months={r.months} />
        </div>
      ) : null}

      {r.topDiagnoses.length > 0 ? (
        <div className="md:max-w-xl">
          <Bars
            title="Most recorded diagnoses"
            rows={r.topDiagnoses.map((d) => ({ label: d.label, value: d.count }))}
          />
        </div>
      ) : null}
    </>
  );
}
