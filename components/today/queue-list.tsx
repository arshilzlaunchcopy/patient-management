import Link from "next/link";
import { displayBD, waLink } from "@/lib/phone";
import { formatDate } from "@/lib/dates";
import type { QueueRow } from "@/lib/today/queries";
import { StatusBadge } from "@/components/schedule/status";
import { cardClass } from "@/components/ui/styles";

export function QueueList({
  title,
  rows,
  emptyText,
  showWhatsApp,
  action,
}: {
  title: string;
  rows: QueueRow[];
  emptyText: string;
  showWhatsApp: boolean;
  /** Optional link or hint shown on the right of the heading. */
  action?: React.ReactNode;
}) {
  const remaining = rows.filter((r) => r.status !== "completed").length;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-baseline gap-2 text-lg font-semibold text-neutral-900">
          {title}
          {rows.length ? (
            <span className="text-base font-normal text-neutral-500">
              {remaining} of {rows.length} remaining
            </span>
          ) : null}
        </h2>
        {action ? <div className="text-sm text-neutral-600">{action}</div> : null}
      </div>

      {rows.length === 0 ? (
        <div className={`${cardClass} p-8 text-center`}>
          <p className="text-base text-neutral-600">{emptyText}</p>
        </div>
      ) : (
        <ol className={`${cardClass} divide-y divide-neutral-100`}>
          {rows.map((r) => {
            const done = r.status === "completed";
            const wa = showWhatsApp ? waLink(r.patient.phone) : null;
            return (
              <li
                key={r.id}
                className={`flex items-center gap-4 px-4 py-4 md:px-5 ${
                  done ? "bg-neutral-50/70" : ""
                }`}
              >
                <span
                  aria-label={`Serial ${r.queue_no ?? "none"}`}
                  className={`w-12 shrink-0 text-center text-3xl font-semibold tabular-nums ${
                    done ? "text-neutral-400" : "text-neutral-900"
                  }`}
                >
                  {r.queue_no ?? "–"}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/patients/${r.patient.id}`}
                    className={`block truncate text-lg font-medium hover:underline ${
                      done ? "text-neutral-500" : "text-accent-strong"
                    }`}
                  >
                    {r.patient.name}
                  </Link>
                  <p className="text-sm text-neutral-600">
                    <span className="tabular-nums">{displayBD(r.patient.phone)}</span>
                    {r.patient.serial_no ? (
                      <span className="ml-2 text-neutral-400">{r.patient.serial_no}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="tabular-nums text-neutral-700">
                      {r.last_hba1c !== null ? (
                        <>
                          HbA1c {Number(r.last_hba1c).toFixed(1)}%
                          {r.last_visit_date ? (
                            <span className="text-neutral-400"> · {formatDate(r.last_visit_date)}</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-neutral-400">No HbA1c on record</span>
                      )}
                    </span>
                    <StatusBadge status={r.status} />
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {wa && !done ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-base font-medium text-white transition-colors hover:bg-accent-strong"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                  {done ? (
                    <Link
                      href={`/patients/${r.patient.id}`}
                      className="inline-flex items-center justify-center rounded-md px-4 py-2.5 text-base text-neutral-500 hover:underline"
                    >
                      Seen
                    </Link>
                  ) : (
                    <Link
                      href={`/patients/${r.patient.id}/visit/new?appointment=${r.id}`}
                      className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-base font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
                    >
                      Start visit
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
