import Link from "next/link";
import { formatDate, formatTime, toInputTime } from "@/lib/dates";
import { displayBD, waLink } from "@/lib/phone";
import type { DayDetail } from "@/lib/schedule/queries";
import { saveConsultDay, setDayCancelled } from "@/lib/schedule/actions";
import { ConsultDayForm } from "./consult-day-form";
import { LIVE_STATUSES, StatusBadge } from "./status";
import { buttonSecondaryClass, cardClass } from "@/components/ui/styles";

export function DayPanel({
  date,
  detail,
  defaults,
  closeHref,
}: {
  date: string;
  detail: DayDetail;
  defaults: { call_start: string; call_end: string; capacity: number | null };
  closeHref: string;
}) {
  const { day, bookings } = detail;
  const action = saveConsultDay.bind(null, date);
  const affected = bookings.filter((b) => LIVE_STATUSES.includes(b.status));

  return (
    <aside className={`${cardClass} p-5`} aria-label={`Details for ${formatDate(date)}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{formatDate(date)}</h2>
          <p className="text-sm text-neutral-600">
            {day
              ? day.is_cancelled
                ? "Cancelled"
                : `Video calls ${formatTime(day.call_start)} to ${formatTime(day.call_end)}` +
                  (day.capacity ? `, up to ${day.capacity}` : ", no limit")
              : "Not a consultation day yet"}
          </p>
        </div>
        <Link
          href={closeHref}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-xl leading-none text-neutral-500 hover:bg-neutral-100"
        >
          ×
        </Link>
      </div>

      {day?.is_cancelled ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-base font-medium text-red-800">This day is cancelled.</p>
          {affected.length ? (
            <>
              <p className="mt-1 text-sm text-red-800">
                {affected.length} {affected.length === 1 ? "patient is" : "patients are"} booked
                and will need to be told.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-red-900">
                {affected.map((b) => (
                  <li key={b.id} className="flex justify-between gap-3">
                    <span>{b.patient.name}</span>
                    <span className="tabular-nums">{displayBD(b.patient.phone)}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled
                title="SMS sending arrives in a later phase"
                className="mt-3 inline-flex cursor-not-allowed items-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-400"
              >
                Notify patients (coming with SMS)
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-red-800">No patients were booked.</p>
          )}
          <form action={setDayCancelled} className="mt-3">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="cancelled" value="false" />
            <button type="submit" className="text-sm font-medium text-red-800 underline">
              Undo cancellation
            </button>
          </form>
        </div>
      ) : null}

      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Consultation day
        </h3>
        <ConsultDayForm
          key={day?.id ?? "new"}
          action={action}
          exists={!!day}
          initial={{
            call_start: toInputTime(day?.call_start) || defaults.call_start,
            call_end: toInputTime(day?.call_end) || defaults.call_end,
            capacity: day ? day.capacity : defaults.capacity,
            is_open_for_new: day?.is_open_for_new ?? false,
            note: day?.note ?? null,
          }}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Booked
          {bookings.length ? (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-500">
              {bookings.length}
            </span>
          ) : null}
        </h3>
        {bookings.length === 0 ? (
          <p className="text-base text-neutral-500">No bookings for this day.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {bookings.map((b) => {
              const wa = waLink(b.patient.phone);
              return (
                <li key={b.id} className="flex items-start gap-3 py-3">
                  <span
                    className="w-8 shrink-0 text-center text-lg font-semibold tabular-nums text-neutral-900"
                    title="Queue number"
                  >
                    {b.queue_no ?? "–"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/patients/${b.patient.id}`}
                      className="block truncate text-base font-medium text-accent-strong hover:underline"
                    >
                      {b.patient.name}
                    </Link>
                    <p className="text-sm tabular-nums text-neutral-600">
                      {displayBD(b.patient.phone)}
                      <span className="ml-2 text-neutral-400">
                        {b.mode === "video" ? "video" : "walk-in"}
                      </span>
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={b.status} holdExpiresAt={b.hold_expires_at} />
                    </div>
                  </div>
                  {wa && b.mode === "video" ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {day && !day.is_cancelled ? (
        <form action={setDayCancelled} className="mt-6 border-t border-neutral-200 pt-4">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="cancelled" value="true" />
          <button
            type="submit"
            className={`${buttonSecondaryClass} border-red-200 text-red-700 hover:bg-red-50`}
          >
            Cancel this day
          </button>
          <p className="mt-2 text-sm text-neutral-500">
            Can be undone. Bookings are kept so you can contact patients.
          </p>
        </form>
      ) : null}
    </aside>
  );
}
