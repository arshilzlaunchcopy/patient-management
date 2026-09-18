import Link from "next/link";
import type { VerifiedClaimRow } from "@/lib/bookings/queries";
import { displayBD } from "@/lib/phone";
import { formatDate, formatDateTime, todayDhaka } from "@/lib/dates";
import { StatusBadge } from "@/components/schedule/status";
import { cardClass } from "@/components/ui/styles";

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

function amountOf(c: VerifiedClaimRow): number {
  return Number(c.amount ?? c.appointment.fee_amount ?? 0) || 0;
}

/**
 * The bKash money that has actually arrived: every verified online payment,
 * newest first, with the patient it belongs to. Totals for this month and
 * for everything shown sit on top so the doctor can reconcile against the
 * bKash statement at a glance.
 */
export function VerifiedList({ rows, limit }: { rows: VerifiedClaimRow[]; limit: number }) {
  const month = todayDhaka().slice(0, 7);
  const monthRows = rows.filter((c) => (c.reviewed_at ?? c.created_at).startsWith(month));
  const monthTotal = monthRows.reduce((s, c) => s + amountOf(c), 0);
  const shownTotal = rows.reduce((s, c) => s + amountOf(c), 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:max-w-md">
        <div className={`${cardClass} p-4`}>
          <p className="text-sm text-neutral-600">This month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{taka(monthTotal)}</p>
          <p className="text-sm text-neutral-500">
            {monthRows.length} {monthRows.length === 1 ? "payment" : "payments"}
          </p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-sm text-neutral-600">Shown below</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{taka(shownTotal)}</p>
          <p className="text-sm text-neutral-500">
            {rows.length === limit ? `latest ${limit}` : `${rows.length} ${rows.length === 1 ? "payment" : "payments"}`}
          </p>
        </div>
      </div>

      {/* Cards on a phone, a table on a laptop. */}
      <ul className={`${cardClass} divide-y divide-neutral-100 md:hidden`}>
        {rows.map((c) => (
          <li key={c.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/patients/${c.appointment.patient.id}`}
                className="truncate text-base font-medium text-accent-strong hover:underline"
              >
                {c.appointment.patient.name}
              </Link>
              <span className="shrink-0 text-lg font-semibold tabular-nums text-neutral-900">
                {taka(amountOf(c))}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-neutral-600">
              <span className="tabular-nums">{displayBD(c.appointment.patient.phone)}</span>
              {c.appointment.patient.serial_no ? (
                <span className="ml-2 text-neutral-400">{c.appointment.patient.serial_no}</span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {c.trx_id ? <span className="font-mono">TrxID {c.trx_id}</span> : null}
              {c.trx_id && c.sender_phone ? " · " : null}
              {c.sender_phone ? <span className="tabular-nums">from {displayBD(c.sender_phone)}</span> : null}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
              <span>
                Booking {formatDate(c.appointment.scheduled_date)}
                {c.appointment.queue_no !== null ? ` · serial ${c.appointment.queue_no}` : ""}
              </span>
              <StatusBadge status={c.appointment.status} />
            </p>
            <p className="mt-1 text-xs text-neutral-500">verified {formatDateTime(c.reviewed_at ?? c.created_at)}</p>
          </li>
        ))}
      </ul>

      <div className={`${cardClass} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-sm text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Proof</th>
              <th className="px-4 py-3 font-medium">Booking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-base">
            {rows.map((c) => (
              <tr key={c.id} className="align-top hover:bg-neutral-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-neutral-600">
                  {formatDateTime(c.reviewed_at ?? c.created_at)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/patients/${c.appointment.patient.id}`}
                    className="font-medium text-accent-strong hover:underline"
                  >
                    {c.appointment.patient.name}
                  </Link>
                  <p className="text-sm text-neutral-600">
                    <span className="tabular-nums">{displayBD(c.appointment.patient.phone)}</span>
                    {c.appointment.patient.serial_no ? (
                      <span className="ml-2 text-neutral-400">{c.appointment.patient.serial_no}</span>
                    ) : null}
                    {c.claimed_name.trim().toLowerCase() !==
                    c.appointment.patient.name.trim().toLowerCase() ? (
                      <span className="ml-2 text-neutral-500">paid as “{c.claimed_name}”</span>
                    ) : null}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-neutral-900">
                  {taka(amountOf(c))}
                </td>
                <td className="px-4 py-3 text-sm text-neutral-700">
                  {c.trx_id ? <span className="font-mono tracking-wide">{c.trx_id}</span> : null}
                  {c.sender_phone ? (
                    <span className="block tabular-nums text-neutral-600">from {displayBD(c.sender_phone)}</span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                  {formatDate(c.appointment.scheduled_date)}
                  {c.appointment.queue_no !== null ? ` · serial ${c.appointment.queue_no}` : ""}
                  <span className="mt-1 block">
                    <StatusBadge status={c.appointment.status} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
