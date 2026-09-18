import type { PatientPayment } from "@/lib/bookings/queries";
import { displayBD } from "@/lib/phone";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cardClass } from "@/components/ui/styles";

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

const CLAIM: Record<PatientPayment["status"], { label: string; className: string }> = {
  verified: { label: "Verified", className: "bg-accent-soft text-accent-strong" },
  submitted: { label: "Awaiting review", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700" },
};

/** Total of the verified payments, for the tab heading. */
export function verifiedTotal(rows: PatientPayment[]): number {
  return rows
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + (Number(p.amount ?? p.appointment.fee_amount ?? 0) || 0), 0);
}

/**
 * The bKash payments this patient has submitted for online bookings,
 * newest first. Chamber fees are recorded on the visits themselves; this
 * is only the money that came through the booking link.
 */
export function PaymentsList({ rows }: { rows: PatientPayment[] }) {
  if (rows.length === 0) {
    return (
      <div className={`${cardClass} p-8 text-center`}>
        <p className="text-base text-neutral-600">No online payments from this patient yet.</p>
        <p className="mt-2 text-sm text-neutral-500">
          Chamber fees are recorded on each visit; this list is only bKash payments made through the
          booking link.
        </p>
      </div>
    );
  }

  return (
    <ol className={`${cardClass} divide-y divide-neutral-100`}>
      {rows.map((p) => {
        const s = CLAIM[p.status];
        return (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
            <div className="min-w-0">
              <p className="text-base text-neutral-900">
                Booking for {formatDate(p.appointment.scheduled_date)}
                {p.appointment.queue_no !== null ? ` · serial ${p.appointment.queue_no}` : ""}
              </p>
              <p className="text-sm text-neutral-600">
                {p.trx_id ? <span className="font-mono">TrxID {p.trx_id}</span> : null}
                {p.trx_id && p.sender_phone ? " · " : null}
                {p.sender_phone ? <span className="tabular-nums">from {displayBD(p.sender_phone)}</span> : null}
                {p.review_note ? <span className="ml-2 text-neutral-500">“{p.review_note}”</span> : null}
              </p>
              <p className="text-xs text-neutral-500">
                submitted {formatDateTime(p.created_at)}
                {p.reviewed_at ? ` · reviewed ${formatDateTime(p.reviewed_at)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
                {s.label}
              </span>
              <span className="text-lg font-semibold tabular-nums text-neutral-900">
                {taka(Number(p.amount ?? p.appointment.fee_amount ?? 0) || 0)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
