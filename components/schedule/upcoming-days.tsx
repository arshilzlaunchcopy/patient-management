import Link from "next/link";
import { formatDate, formatTime, weekdayOf } from "@/lib/dates";
import type { MonthOverview } from "@/lib/schedule/queries";
import { cardClass } from "@/components/ui/styles";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The next consultation days as a plain list, so the doctor does not have
 * to read a grid to answer "when am I next on, and how full is it?".
 */
export function UpcomingDays({
  overview,
  today,
  limit = 6,
}: {
  overview: MonthOverview;
  today: string;
  limit?: number;
}) {
  const days = Object.values(overview.days)
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);

  const todayIsConsult = !!overview.days[today];

  return (
    <section className={`${cardClass} p-4`} aria-labelledby="upcoming-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="upcoming-heading" className="text-base font-semibold text-neutral-900">
          Coming up
        </h2>
        {!todayIsConsult ? (
          <Link
            href={`/schedule?month=${today.slice(0, 7)}&day=${today}`}
            className="text-sm font-medium text-accent-strong hover:underline"
          >
            Open today
          </Link>
        ) : null}
      </div>

      {days.length === 0 ? (
        <p className="text-base text-neutral-600">
          No consultation days ahead. Use “Open the next…” above, or click a date.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {days.map((d) => {
            const c = overview.counts[d.date];
            const video = c?.video ?? 0;
            const full = d.capacity !== null && video >= d.capacity;
            return (
              <li key={d.date}>
                <Link
                  href={`/schedule?month=${d.date.slice(0, 7)}&day=${d.date}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-neutral-50"
                >
                  <span className="w-12 shrink-0 text-center">
                    <span className="block text-xs uppercase text-neutral-500">
                      {WEEKDAY[weekdayOf(d.date)]}
                    </span>
                    <span
                      className={`block text-xl font-semibold tabular-nums ${
                        d.date === today ? "text-accent-strong" : "text-neutral-900"
                      }`}
                    >
                      {Number(d.date.slice(8, 10))}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-neutral-900">
                      {d.date === today ? "Today" : formatDate(d.date)}
                      {d.is_cancelled ? (
                        <span className="ml-2 text-sm font-medium text-red-700">Cancelled</span>
                      ) : d.is_open_for_new ? (
                        <span className="ml-2 rounded-full bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent-strong">
                          Open
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-sm text-neutral-600">
                      {formatTime(d.call_start)} to {formatTime(d.call_end)}
                      {c?.in_person ? ` · ${c.in_person} walk-in` : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-right text-sm tabular-nums ${
                      full ? "font-medium text-amber-700" : "text-neutral-700"
                    }`}
                  >
                    {video}
                    {d.capacity !== null ? ` / ${d.capacity}` : ""}
                    <span className="block text-xs font-normal text-neutral-400">
                      {full ? "full" : "video"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
