"use client";

import { useActionState } from "react";
import { sendQueuedAction, type SendQueuedState } from "@/lib/sms/actions";
import { buttonSecondaryClass } from "@/components/ui/styles";
import { Spinner } from "@/components/ui/spinner";
import { CheckDelivery } from "./check-delivery";

/** Written the way the doctor already writes money: no decimals unless needed. */
function taka(n: number): string {
  return `৳${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/**
 * Gateway status line for the Outbox: connection, prepaid balance, how many
 * messages are waiting, and the buttons to push them out and to ask the
 * gateway what was delivered.
 */
export function SendQueued({
  configured,
  queued,
  balance,
}: {
  configured: boolean;
  queued: number;
  /** Taka left at the gateway; null when unknown or no key. */
  balance: number | null;
}) {
  const [state, action, pending] = useActionState<SendQueuedState>(sendQueuedAction, {});

  return (
    <div className="mt-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            configured ? "bg-accent-soft text-accent-strong" : "bg-amber-100 text-amber-800"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${configured ? "bg-accent" : "bg-amber-500"}`} />
          {configured ? "SMS gateway connected" : "No SMS gateway yet"}
        </span>
        {configured ? (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium tabular-nums ${
              balance !== null && balance < 50
                ? "bg-red-50 text-red-700"
                : "bg-neutral-100 text-neutral-700"
            }`}
            title="Prepaid balance at sms.net.bd"
          >
            Balance {balance === null ? "—" : taka(balance)}
          </span>
        ) : null}
        <span className="text-neutral-600">
          {queued} {queued === 1 ? "message" : "messages"} queued
        </span>
      </div>

      {configured ? (
        <div className="flex flex-wrap items-center gap-3">
          {queued > 0 ? (
            <form action={action} className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className={`${buttonSecondaryClass} px-3 py-1.5 text-sm`}
              >
                {pending ? (
                  <>
                    <Spinner className="mr-2" />
                    Sending…
                  </>
                ) : (
                  "Send queued now"
                )}
              </button>
              {state.message ? (
                <span className="text-neutral-700" aria-live="polite">
                  {state.message}
                </span>
              ) : null}
              {state.error ? (
                <span className="text-red-700" role="alert">
                  {state.error}
                </span>
              ) : null}
            </form>
          ) : null}
          <CheckDelivery compact />
        </div>
      ) : null}
    </div>
  );
}
