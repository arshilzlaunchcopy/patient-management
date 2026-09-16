import Link from "next/link";
import { addDays, daysInMonth, toIso, weekdayOf } from "@/lib/dates";
import type { MonthOverview } from "@/lib/schedule/queries";
import { cardClass } from "@/components/ui/styles";

/** Weeks start on Saturday, the first working day in Bangladesh. */
const WEEK_START = 6;
const DAY_HEADERS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

/** First date shown in the grid for a month: the Saturday on or before the 1st. */
export function gridStart(y: number, m1: number): string {
  const first = toIso(y, m1, 1);
  const offset = (weekdayOf(first) - WEEK_START + 7) % 7;
  return addDays(first, -offset);
}

/** Last date shown: the Friday on or after the last day of the month. */
export function gridEnd(y: number, m1: number): string {
  const last = toIso(y, m1, daysInMonth(y, m1));
  const offset = (WEEK_START + 6 - weekdayOf(last) + 7) % 7;
  return addDays(last, offset);
}

/**
 * One month, Saturday to Friday. A consultation day reads at a glance:
 * a teal bar with the video count against capacity, an "Open" tag when new
 * patients may book it, red when cancelled. Days with nothing on them stay
 * quiet so the eye goes to the days that matter.
 */
export function MonthGrid({
  y,
  m1,
  today,
  selected,
  overview,
}: {
  y: number;
  m1: number;
  today: string;
  selected: string | null;
  overview: MonthOverview;
}) {
  const start = gridStart(y, m1);
  const end = gridEnd(y, m1);
  const monthPrefix = toIso(y, m1, 1).slice(0, 7);

  const cells: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d);

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
        {DAY_HEADERS.map((h, i) => (
          <div
            key={h}
            className={`px-2 py-2 text-center text-xs font-medium uppercase tracking-wide ${
              i === 6 ? "text-neutral-400" : "text-neutral-600"
            }`}
          >
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const inMonth = date.startsWith(monthPrefix);
          const day = overview.days[date];
          const counts = overview.counts[date];
          const isToday = date === today;
          const isSelected = date === selected;
          const isPast = date < today;
          const isFriday = (i + 1) % 7 === 0;
          const cancelled = day?.is_cancelled ?? false;
          const video = counts?.video ?? 0;
          const walkIn = counts?.in_person ?? 0;
          const cap = day?.capacity ?? null;
          const full = cap !== null && video >= cap;
          const fill = cap ? Math.min(100, Math.round((video / cap) * 100)) : video ? 100 : 0;

          const title = day
            ? cancelled
              ? `${date}: cancelled`
              : `${date}: video ${video}${cap ? ` of ${cap}` : ""}${walkIn ? `, ${walkIn} walk-in` : ""}${
                  day.is_open_for_new ? ", open to new patients" : ""
                }`
            : `${date}${walkIn ? `: ${walkIn} walk-in` : ""}`;

          return (
            <Link
              key={date}
              href={`/schedule?month=${monthPrefix}&day=${date}`}
              title={title}
              aria-label={title}
              aria-current={isSelected ? "true" : undefined}
              className={[
                "flex min-h-[4.75rem] flex-col gap-1 border-b border-r border-neutral-100 p-1.5 text-left md:min-h-[6rem] md:p-2",
                isFriday ? "border-r-0" : "",
                inMonth ? (isFriday ? "bg-neutral-50/70" : "bg-white") : "bg-neutral-50/60",
                cancelled ? "bg-red-50/60" : "",
                isSelected ? "ring-2 ring-inset ring-accent" : "hover:bg-accent-soft/30",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={[
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm tabular-nums",
                    isToday
                      ? "bg-accent font-semibold text-white"
                      : inMonth
                        ? isPast
                          ? "text-neutral-400"
                          : "font-medium text-neutral-800"
                        : "text-neutral-300",
                    cancelled ? "line-through" : "",
                  ].join(" ")}
                >
                  {Number(date.slice(8, 10))}
                </span>
                {day && !cancelled && day.is_open_for_new ? (
                  <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-accent-strong">
                    Open
                  </span>
                ) : null}
                {cancelled ? (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-red-700">
                    Off
                  </span>
                ) : null}
              </div>

              {day && !cancelled ? (
                <div className="mt-auto">
                  <div className="flex items-baseline justify-between text-xs tabular-nums">
                    <span className={`font-medium ${full ? "text-amber-700" : "text-neutral-800"}`}>
                      {video}
                      {cap ? <span className="text-neutral-400">/{cap}</span> : null}
                    </span>
                    <span className="hidden text-neutral-400 md:inline">video</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-accent"}`}
                      style={{ width: `${fill}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {walkIn ? (
                <span className="text-xs tabular-nums text-neutral-600">
                  {walkIn} <span className="hidden md:inline">walk-in</span>
                  <span className="md:hidden">w</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
