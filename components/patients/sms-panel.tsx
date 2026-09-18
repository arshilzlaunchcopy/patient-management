"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { sendPatientSmsAction, type PatientSmsState } from "@/lib/sms/actions";
import { analyzeSms, MAX_CAMPAIGN_SEGMENTS } from "@/lib/sms/segments";
import { buttonPrimaryClass, labelClass } from "@/components/ui/styles";
import { Spinner } from "@/components/ui/spinner";

const DEFAULT_BODY = "প্রিয় রোগী, ";

export interface QuickText {
  id: string;
  name: string;
  body: string;
}

/**
 * Compose box on a patient's page: one SMS to this person, with the same
 * saved texts and segment counter as the Messages page. The sent message
 * shows up in the thread below as soon as the action returns.
 */
export function SmsPanel({
  patientId,
  phoneLabel,
  templates,
  configured,
}: {
  patientId: string;
  phoneLabel: string;
  templates: QuickText[];
  configured: boolean;
}) {
  const [state, action, pending] = useActionState<PatientSmsState, FormData>(
    sendPatientSmsAction,
    {},
  );
  const [body, setBody] = useState(DEFAULT_BODY);

  // Clear the box after each successful send.
  useEffect(() => {
    if (state.sentAt) setBody(DEFAULT_BODY);
  }, [state.sentAt]);

  const a = analyzeSms(body);
  const tooLong = a.segments > MAX_CAMPAIGN_SEGMENTS;
  const empty = body.trim().length === 0;
  const hasPlaceholder = /\{\{\s*\w+\s*\}\}/.test(body);
  const canSend = !empty && !tooLong && !hasPlaceholder && !pending;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="patient_id" value={patientId} />

      {templates.length > 0 ? (
        <div>
          <p className={labelClass}>Saved texts</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setBody(t.body)}
                  title={t.body}
                  className="inline-flex max-w-full items-center rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 transition-colors hover:border-accent hover:bg-accent-soft"
                >
                  <span className="truncate">{t.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <label htmlFor="patient-sms-body" className={labelClass}>
          Message to {phoneLabel}
        </label>
        <textarea
          id="patient-sms-body"
          name="body"
          lang="bn"
          dir="auto"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={tooLong || hasPlaceholder || undefined}
          className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-lg leading-relaxed text-neutral-900 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-red-500"
        />
        <p className={`mt-1 text-sm ${tooLong ? "text-red-700" : "text-neutral-500"}`}>
          {a.length} of {a.length + a.remaining} characters · {a.segments}{" "}
          {a.segments === 1 ? "segment" : "segments"}
          {tooLong ? ` · keep it to ${MAX_CAMPAIGN_SEGMENTS} segments or fewer` : ""}
          {hasPlaceholder ? " · replace the {{…}} parts first" : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!canSend} className={buttonPrimaryClass}>
          {pending ? (
            <>
              <Spinner className="mr-2" />
              Sending…
            </>
          ) : (
            "Send SMS"
          )}
        </button>
        {state.ok ? (
          <span className="text-sm text-accent-strong" aria-live="polite">
            {state.status === "sent"
              ? "Sent. Press “Check delivery” in a minute to see if it arrived."
              : configured
                ? "Queued."
                : "Queued. It will go out once the SMS gateway key is added."}
          </span>
        ) : null}
        {state.error ? (
          <span className="text-sm text-red-700" role="alert">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
