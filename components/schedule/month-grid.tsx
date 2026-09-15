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
          const cancelled = day?.is_cancelled ?? false;

          return (
            <Link
              key={date}
              href={`/schedule?month=${monthPrefix}&day=${date}`}
              aria-label={date}
              aria-current={isSelected ? "true" : undefined}
              className={[
                "flex min-h-[4.5rem] flex-col border-b border-r border-neutral-100 p-1.5 text-left transition-colors md:min-h-[5.5rem] md:p-2",
                (i + 1) % 7 === 0 ? "border-r-0" : "",
                inMonth ? "bg-white" : "bg-neutral-50/60",
                isSelected
                  ? "ring-2 ring-inset ring-accent"
                  : "hover:bg-neutral-50",
                cancelled ? "bg-red-50/50" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={[
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums",
                    isToday
                      ? "bg-accent font-semibold text-white"
                      : inMonth
                        ? isPast
                          ? "text-neutral-400"
                          : "text-neutral-800"
                        : "text-neutral-300",
                    cancelled ? "line-through" : "",
                  ].join(" ")}
                >
                  {Number(date.slice(8, 10))}
                </span>
                {day ? (
                  <span className="flex items-center gap-1">
                    {day.is_open_for_new && !cancelled ? (
                      <span
                        title="Open to new patients"
                        className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-accent-strong"
                      >
                        new
                      </span>
                    ) : null}
                    <span
                      title={cancelled ? "Cancelled" : "Consultation day"}
                      className={`h-2 w-2 rounded-full ${
                        cancelled ? "bg-red-400" : "bg-accent"
                      }`}
                    />
                  </span>
                ) : null}
              </div>

              {counts ? (
                <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 pt-1 text-xs tabular-nums text-neutral-600">
                  {counts.video ? (
                    <span title="Video bookings">{counts.video} video</span>
                  ) : null}
                  {counts.in_person ? (
                    <span title="Walk-in bookings">{counts.in_person} walk-in</span>
                  ) : null}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
