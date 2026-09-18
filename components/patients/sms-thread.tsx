import { formatDateTime } from "@/lib/dates";
import type { SmsLogRow } from "@/lib/sms/queries";
import { Linkified } from "@/components/outbox/linkified";
import { SmsStatusBadge } from "@/components/outbox/sms-status";
import { cardClass } from "@/components/ui/styles";

/**
 * Every SMS this patient has been sent, newest first, in the same shape as
 * the visit history so the page reads as one record. The gateway is
 * send-only, so replies do not appear here.
 */
export function SmsThread({ rows }: { rows: SmsLogRow[] }) {
  if (rows.length === 0) {
    return (
      <div className={`${cardClass} p-8 text-center`}>
        <p className="text-base text-neutral-600">No messages sent to this patient yet.</p>
      </div>
    );
  }

  return (
    <ol className={`${cardClass} divide-y divide-neutral-100`}>
      {rows.map((r) => (
        <li key={r.id} className="px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <SmsStatusBadge
              status={r.status}
              deliveryStatus={r.delivery_status}
              deliveryDetail={r.delivery_detail}
            />
            <p className="text-sm tabular-nums text-neutral-500">{formatDateTime(r.created_at)}</p>
          </div>
          <p className="mt-2 text-lg leading-relaxed text-neutral-900">
            <Linkified text={r.body} lang="bn" />
          </p>
          {r.error_message ? (
            <p className="mt-1 text-sm text-red-700">{r.error_message}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
