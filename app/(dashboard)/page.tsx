import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatTime, todayDhaka } from "@/lib/dates";
import { getTodayData } from "@/lib/today/queries";
import { QueueList } from "@/components/today/queue-list";
import { ShareLinks } from "@/components/dashboard/share-links";
import { cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Today" };

function Counter({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: "warn";
}) {
  const body = (
    <>
      <p className="text-sm text-neutral-600">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          tone === "warn" && Number(value) > 0 ? "text-amber-700" : "text-neutral-900"
        }`}
      >
        {value}
      </p>
    </>
  );
  return href ? (
    <Link href={href} className={`${cardClass} block p-4 transition-colors hover:bg-neutral-50`}>
      {body}
    </Link>
  ) : (
    <div className={`${cardClass} p-4`}>{body}</div>
  );
}

export default async function TodayPage() {
  const today = todayDhaka();
  const data = await getTodayData(today);
  const { day, video, walkIn, counters } = data;
  const nothingToday = !day && video.length === 0 && walkIn.length === 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Today</h1>
          <p className="mt-1 text-base text-neutral-600">
            {formatDate(today)}
            {day && !day.is_cancelled ? (
              <>
                {" · "}video calls {formatTime(day.call_start)} to {formatTime(day.call_end)}
                {day.capacity ? ` · up to ${day.capacity}` : ""}
              </>
            ) : null}
            {day?.is_cancelled ? (
              <span className="ml-2 font-medium text-red-700">Consultation day cancelled</span>
            ) : null}
          </p>
        </div>

        <form action="/patients" method="get" role="search" className="w-full md:w-80">
          <label htmlFor="quick-search" className="sr-only">
            Search patients
          </label>
          <input
            id="quick-search"
            name="q"
            type="search"
            placeholder="Find a patient by name, phone or serial"
            autoComplete="off"
            className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </form>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Counter label="Seen today" value={counters.seen} />
        <Counter label="Booked today" value={counters.booked} />
        <Counter
          label="Awaiting verification"
          value={counters.awaiting}
          href="/bookings"
          tone="warn"
        />
        <Counter
          label="Follow-ups overdue"
          value={counters.overdue ?? "—"}
          href="/patients"
          tone="warn"
        />
      </div>

      {data.viewMissing ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Apply migration 003 in Supabase to see last HbA1c and overdue follow-ups.
        </p>
      ) : null}

      {nothingToday ? (
        <div className="space-y-6">
          <div className={`${cardClass} p-10 text-center`}>
            <p className="text-lg font-medium text-neutral-800">
              No consultation day is set for today.
            </p>
            <p className="mt-2 text-base text-neutral-600">
              Nothing is booked. Open today in the schedule if you plan to take video calls.
            </p>
            <Link
              href={`/schedule?month=${today.slice(0, 7)}&day=${today}`}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-base font-medium text-white transition-colors hover:bg-accent-strong"
            >
              Open today in Schedule
            </Link>
          </div>
          <ShareLinks compact />
        </div>
      ) : (
        <div className="space-y-10">
          <QueueList
            title="Video queue"
            rows={video}
            showWhatsApp
            action={
              counters.booked > 0 ? (
                <>
                  Running late, or the call window moved?{" "}
                  <Link
                    href={`/messages?segment=booked_on&date=${today}`}
                    className="font-medium text-accent-strong hover:underline"
                  >
                    Message everyone booked today
                  </Link>
                </>
              ) : null
            }
            emptyText={
              day
                ? "No video bookings yet for today."
                : "No consultation day set for today, and no video bookings."
            }
          />
          <QueueList
            title="Walk-in queue"
            rows={walkIn}
            showWhatsApp={false}
            emptyText="No walk-ins booked for today."
          />
          <ShareLinks compact />
        </div>
      )}
    </>
  );
}
