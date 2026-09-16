"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { sendCampaign, type SendState } from "@/lib/messages/actions";
import { analyzeSms, MAX_CAMPAIGN_SEGMENTS } from "@/lib/sms/segments";
import { buttonPrimaryClass, labelClass } from "@/components/ui/styles";

const DEFAULT_BODY = "প্রিয় রোগী, ";

/** Written the way the doctor already writes money: no decimals unless needed. */
function taka(n: number): string {
  return `৳${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

export function ComposeForm({
  hidden,
  recipientCount,
  audienceLabel,
  pricePerSegment,
}: {
  /** Segment parameters echoed back so the server re-resolves the same audience. */
  hidden: Record<string, string>;
  recipientCount: number;
  audienceLabel: string;
  pricePerSegment: number;
}) {
  const [state, formAction, pending] = useActionState<SendState, FormData>(sendCampaign, {});
  const [body, setBody] = useState(DEFAULT_BODY);

  const a = analyzeSms(body);
  const capacity = a.length + a.remaining;
  const totalSegments = a.segments * recipientCount;
  const cost = totalSegments * pricePerSegment;
  const tooLong = a.segments > MAX_CAMPAIGN_SEGMENTS;
  const empty = body.trim().length === 0;
  const canSend = recipientCount > 0 && !empty && !tooLong && !pending;

  if (state.campaignId) {
    return (
      <div className="rounded-md border border-accent bg-accent-soft p-5 text-base text-accent-strong">
        <p className="font-medium">
          Queued {state.sent} {state.sent === 1 ? "message" : "messages"}
          {state.failed ? `, ${state.failed} could not be queued` : ""}.
        </p>
        <p className="mt-1 text-sm">
          No SMS gateway is connected yet, so messages stay queued in the Outbox until one is.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
          <Link href={`/outbox?campaign=${state.campaignId}`} className="underline">
            See them in the Outbox
          </Link>
          <Link href="/messages" className="underline">
            Write another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) return;
        const ok = window.confirm(
          `Send this message to ${recipientCount} ${recipientCount === 1 ? "patient" : "patients"} (${audienceLabel})?`,
        );
        if (!ok) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="confirm_count" value={recipientCount} />

      <div>
        <label htmlFor="body" className={labelClass}>
          Message
        </label>
        <textarea
          id="body"
          name="body"
          lang="bn"
          dir="auto"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={tooLong || undefined}
          className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-lg leading-relaxed text-neutral-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-red-500"
        />
        <p className={`mt-1 text-sm ${tooLong ? "text-red-700" : "text-neutral-500"}`}>
          {a.length} of {capacity} characters · {a.segments} {a.segments === 1 ? "segment" : "segments"} per
          patient
          {a.encoding === "ucs2" ? " · Bangla text fits 70 characters in one segment" : ""}
          {tooLong ? ` · keep it to ${MAX_CAMPAIGN_SEGMENTS} segments or fewer` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3 rounded-md bg-neutral-50 p-3 text-sm">
        <div>
          <dt className="text-neutral-500">Recipients</dt>
          <dd className="text-lg font-semibold tabular-nums text-neutral-900">{recipientCount}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">SMS segments</dt>
          <dd className="text-lg font-semibold tabular-nums text-neutral-900">{totalSegments}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Estimated cost</dt>
          <dd className="text-lg font-semibold tabular-nums text-neutral-900">{taka(cost)}</dd>
        </div>
      </dl>

      {state.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-base text-red-800">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={!canSend} className={buttonPrimaryClass}>
        {pending
          ? "Queuing…"
          : recipientCount === 0
            ? "Nobody to send to"
            : `Send to ${recipientCount} ${recipientCount === 1 ? "patient" : "patients"}`}
      </button>
    </form>
  );
}
