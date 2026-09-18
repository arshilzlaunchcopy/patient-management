import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { displayBD } from "@/lib/phone";
import { countQueued, listSmsLog, OUTBOX_LIMIT } from "@/lib/sms/queries";
import { getGatewayBalance, smsGatewayConfigured } from "@/lib/sms/provider";
import { SendQueued } from "@/components/outbox/send-queued";
import { SmsStatusBadge } from "@/components/outbox/sms-status";
import { Linkified } from "@/components/outbox/linkified";
import { cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Outbox" };

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  const configured = smsGatewayConfigured();
  const [rows, queued, balance] = await Promise.all([
    listSmsLog(campaign),
    countQueued(),
    configured ? getGatewayBalance() : Promise.resolve(null),
  ]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Outbox</h1>
        <p className="mt-1 text-base text-neutral-600">
          Every SMS the system has generated, newest first.
          {configured
            ? " Messages go out through sms.net.bd as they are created; “Check delivery” asks the gateway whether the phone received them."
            : " Until an SMS gateway key is added, messages stay queued here; links inside them can still be opened to walk through the patient flow."}
        </p>
        <SendQueued configured={configured} queued={queued} balance={balance} />
        {campaign ? (
          <p className="mt-2 text-sm text-neutral-600">
            Showing one bulk send only.{" "}
            <Link href="/outbox" className="font-medium text-accent-strong hover:underline">
              Show everything
            </Link>
          </p>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <div className={`${cardClass} p-10 text-center`}>
          <p className="text-base text-neutral-700">No messages yet.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Booking confirmations and follow-up reminders will appear here.
          </p>
        </div>
      ) : (
        <>
          <ol className={`${cardClass} divide-y divide-neutral-100`}>
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-base text-neutral-900">
                    {r.patient ? (
                      <Link
                        href={`/patients/${r.patient.id}#messages`}
                        className="font-medium text-accent-strong hover:underline"
                      >
                        {r.patient.name}
                      </Link>
                    ) : (
                      <span className="font-medium">Unknown patient</span>
                    )}
                    <span className="ml-2 tabular-nums text-neutral-600">{displayBD(r.phone)}</span>
                  </p>
                  <p className="text-sm tabular-nums text-neutral-500">
                    {formatDateTime(r.created_at)}
                  </p>
                </div>
                <p className="mt-2 text-lg leading-relaxed text-neutral-900">
                  <Linkified text={r.body} lang="bn" />
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                  <SmsStatusBadge
                    status={r.status}
                    deliveryStatus={r.delivery_status}
                    deliveryDetail={r.delivery_detail}
                  />
                  <span className="tabular-nums">
                    {r.segments} {r.segments === 1 ? "segment" : "segments"}
                  </span>
                  {r.error_message ? <span className="text-red-700">{r.error_message}</span> : null}
                  {r.delivery_checked_at ? (
                    <span className="text-neutral-400">
                      checked {formatDateTime(r.delivery_checked_at)}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>
          {rows.length === OUTBOX_LIMIT ? (
            <p className="mt-3 text-sm text-neutral-500">
              Showing the latest {OUTBOX_LIMIT} messages.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
