import type { Metadata } from "next";
import Link from "next/link";
import {
  addDays,
  isIsoDate,
  monthLabel,
  parseMonth,
  todayDhaka,
  toIso,
} from "@/lib/dates";
import { getSettings, settingInt, settingTime } from "@/lib/settings";
import { getDayDetail, getMonthOverview } from "@/lib/schedule/queries";
import { MonthGrid, gridEnd, gridStart } from "@/components/schedule/month-grid";
import { DayPanel } from "@/components/schedule/day-panel";
import { BulkOpenForm } from "@/components/schedule/bulk-open-form";
import { UpcomingDays } from "@/components/schedule/upcoming-days";
import { buttonSecondaryClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Schedule" };

function shiftMonth(y: number, m1: number, delta: number) {
  const idx = y * 12 + (m1 - 1) + delta;
  return { y: Math.floor(idx / 12), m1: (idx % 12) + 1 };
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const sp = await searchParams;
  const today = todayDhaka();
  const selected = sp.day && isIsoDate(sp.day) ? sp.day : null;
  const { y, m1 } =
    parseMonth(sp.month) ??
    parseMonth(selected?.slice(0, 7)) ??
    parseMonth(today.slice(0, 7))!;

  const monthParam = toIso(y, m1, 1).slice(0, 7);
  const prev = shiftMonth(y, m1, -1);
  const next = shiftMonth(y, m1, 1);
  const prevParam = toIso(prev.y, prev.m1, 1).slice(0, 7);
  const nextParam = toIso(next.y, next.m1, 1).slice(0, 7);

  const [overview, upcoming, detail, settings] = await Promise.all([
    getMonthOverview(gridStart(y, m1), gridEnd(y, m1)),
    getMonthOverview(today, addDays(today, 60)),
    selected ? getDayDetail(selected) : Promise.resolve(null),
    getSettings([
      "default_call_start",
      "default_call_end",
      "default_capacity",
    ] as const),
  ]);

  const defaults = {
    call_start: settingTime(settings.default_call_start, "20:00"),
    call_end: settingTime(settings.default_call_end, "22:00"),
    capacity: settingInt(settings.default_capacity, 15),
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/schedule?month=${prevParam}`}
            aria-label="Previous month"
            className={`${buttonSecondaryClass} px-3`}
          >
            ‹
          </Link>
          <h1 className="min-w-[11rem] text-center text-2xl font-semibold text-neutral-900">
            {monthLabel(y, m1)}
          </h1>
          <Link
            href={`/schedule?month=${nextParam}`}
            aria-label="Next month"
            className={`${buttonSecondaryClass} px-3`}
          >
            ›
          </Link>
          {monthParam !== today.slice(0, 7) ? (
            <Link
              href={`/schedule?month=${today.slice(0, 7)}&day=${today}`}
              className="ml-2 text-sm font-medium text-accent-strong hover:underline"
            >
              Today
            </Link>
          ) : null}
        </div>
        <BulkOpenForm />
      </header>

      {/* The calendar takes the full width; the day panel sits beside it only on a wide screen. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
        <div>
          <MonthGrid
            y={y}
            m1={m1}
            today={today}
            selected={selected}
            overview={overview}
          />
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-7 rounded-full bg-accent" /> video bookings
              against capacity
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-strong">
                Open
              </span>
              new patients may book
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                Off
              </span>
              cancelled
            </span>
            <span>Click any day to open or edit it.</span>
          </p>
        </div>

        {selected && detail ? (
          <DayPanel
            date={selected}
            detail={detail}
            defaults={defaults}
            closeHref={`/schedule?month=${monthParam}`}
          />
        ) : (
          <UpcomingDays overview={upcoming} today={today} />
        )}
      </div>
    </>
  );
}
