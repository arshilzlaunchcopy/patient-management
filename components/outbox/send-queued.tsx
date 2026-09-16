"use client";

import { useActionState } from "react";
import { sendQueuedAction, type SendQueuedState } from "@/lib/sms/actions";
import { buttonSecondaryClass } from "@/components/ui/styles";

/**
 * Gateway status line for the Outbox, with a button to push queued
 * messages out once a key is configured.
 */
export function SendQueued({ configured, queued }: { configured: boolean; queued: number }) {
  const [state, action, pending] = useActionState<SendQueuedState>(sendQueuedAction, {});

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
          configured ? "bg-accent-soft text-accent-strong" : "bg-amber-100 text-amber-800"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${configured ? "bg-accent" : "bg-amber-500"}`} />
        {configured ? "SMS gateway connected" : "No SMS gateway yet"}
      </span>
      <span className="text-neutral-600">
        {queued} {queued === 1 ? "message" : "messages"} queued
      </span>
      {configured && queued > 0 ? (
        <form action={action}>
          <button type="submit" disabled={pending} className={`${buttonSecondaryClass} px-3 py-1.5 text-sm`}>
            {pending ? "Sending…" : `Send queued now`}
          </button>
        </form>
      ) : null}
      {state.message ? <span className="text-neutral-700" aria-live="polite">{state.message}</span> : null}
      {state.error ? <span className="text-red-700" role="alert">{state.error}</span> : null}
    </div>
  );
}
