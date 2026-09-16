import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { displayBD } from "@/lib/phone";
import { listSmsLog, OUTBOX_LIMIT } from "@/lib/sms/queries";
import { Linkified } from "@/components/outbox/linkified";
import { cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Outbox" };

const STATUS: Record<string, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-amber-100 text-amber-800" },
  sent: { label: "Sent", className: "bg-accent-soft text-accent-strong" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700" },
};

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  const rows = await listSmsLog(campaign);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Outbox</h1>
        <p className="mt-1 text-base text-neutral-600">
          Every SMS the system has generated, newest first. No gateway is connected
          yet, so messages stay queued. Links inside a message can be opened here to
          walk through the patient flow.
        </p>
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
            {rows.map((r) => {
              const s = STATUS[r.status] ?? STATUS.queued;
              return (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-base text-neutral-900">
                      {r.patient ? (
                        <Link
                          href={`/patients/${r.patient.id}`}
                          className="font-medium text-accent-strong hover:underline"
                        >
                          {r.patient.name}
                        </Link>
                      ) : (
                        <span className="font-medium">Unknown patient</span>
                      )}
                      <span className="ml-2 tabular-nums text-neutral-600">
                        {displayBD(r.phone)}
                      </span>
                    </p>
                    <p className="text-sm tabular-nums text-neutral-500">
                      {formatDateTime(r.created_at)}
                    </p>
                  </div>
                  <p className="mt-2 text-lg leading-relaxed text-neutral-900">
                    <Linkified text={r.body} lang="bn" />
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}
                    >
                      {s.label}
                    </span>
                    <span className="tabular-nums">
                      {r.segments} {r.segments === 1 ? "segment" : "segments"}
                    </span>
                    {r.error_message ? (
                      <span className="text-red-700">{r.error_message}</span>
                    ) : null}
                  </p>
                </li>
              );
            })}
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
