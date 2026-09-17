"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, useTransition } from "react";
import {
  deleteTemplateAction,
  saveTemplateAction,
  sendCampaign,
  type SendState,
} from "@/lib/messages/actions";
import { analyzeSms, MAX_CAMPAIGN_SEGMENTS } from "@/lib/sms/segments";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/styles";

const DEFAULT_BODY = "প্রিয় রোগী, ";
const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

export interface SavedText {
  id: string;
  name: string;
  body: string;
  /** Written by the doctor (deletable) rather than one of the automatic texts. */
  custom: boolean;
  /** Placeholders the automatic texts carry, e.g. ["date", "link"]. */
  variables: string[];
}

/** Written the way the doctor already writes money: no decimals unless needed. */
function taka(n: number): string {
  return `৳${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/** Fill the placeholders we know a value for; leave the rest for the doctor to edit. */
function applyFills(body: string, fills: Record<string, string>): string {
  return body.replace(PLACEHOLDER_RE, (match, key: string) => fills[key] || match);
}

function unfilledPlaceholders(body: string): string[] {
  return Array.from(body.matchAll(PLACEHOLDER_RE), (m) => m[0]);
}

function TextCard({
  t,
  onUse,
  onDelete,
  busy,
}: {
  t: SavedText;
  onUse: () => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onUse}
        className="block w-full rounded-md border border-neutral-200 bg-white p-3 pr-9 text-left transition-colors hover:border-accent hover:bg-accent-soft/40 focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        <span className="block truncate text-sm font-medium text-neutral-900">{t.name}</span>
        <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-neutral-600" lang="bn">
          {t.body}
        </span>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete saved text ${t.name}`}
          title="Delete"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          ×
        </button>
      ) : null}
    </li>
  );
}

export function ComposeForm({
  hidden,
  recipientCount,
  audienceLabel,
  pricePerSegment,
  templates,
  initialBody,
  fills = {},
}: {
  /** Segment parameters echoed back so the server re-resolves the same audience. */
  hidden: Record<string, string>;
  recipientCount: number;
  audienceLabel: string;
  pricePerSegment: number;
  templates: SavedText[];
  /** Pre-filled text, e.g. from the schedule's "notify patients" link. */
  initialBody?: string;
  /** Values for placeholders in the automatic texts that this audience already fixes, e.g. the date. */
  fills?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<SendState, FormData>(sendCampaign, {});
  const [body, setBody] = useState(initialBody?.trim() ? initialBody : DEFAULT_BODY);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [templateNote, setTemplateNote] = useState<string | null>(null);
  const [templateBusy, startTemplate] = useTransition();

  const a = analyzeSms(body);
  const capacity = a.length + a.remaining;
  const totalSegments = a.segments * recipientCount;
  const cost = totalSegments * pricePerSegment;
  const tooLong = a.segments > MAX_CAMPAIGN_SEGMENTS;
  const empty = body.trim().length === 0;
  const unfilled = unfilledPlaceholders(body);
  const canSend = recipientCount > 0 && !empty && !tooLong && unfilled.length === 0 && !pending;

  const own = templates.filter((t) => t.custom);
  const automatic = templates.filter((t) => !t.custom);

  function insertText(t: SavedText) {
    setBody(applyFills(t.body, fills));
    setTemplateNote(null);
    document.getElementById("body")?.focus();
  }

  function saveTemplate() {
    startTemplate(async () => {
      const r = await saveTemplateAction({ name: saveName, body });
      setTemplateNote(r.error ?? "Saved. It is now in the list above.");
      if (r.ok) {
        setSaveOpen(false);
        setSaveName("");
      }
    });
  }

  function removeTemplate(t: SavedText) {
    if (!window.confirm(`Delete the saved text “${t.name}”?`)) return;
    startTemplate(async () => {
      const r = await deleteTemplateAction(t.id);
      setTemplateNote(r.error ?? `Deleted “${t.name}”.`);
    });
  }

  if (state.campaignId) {
    return (
      <div className="rounded-md border border-accent bg-accent-soft p-5 text-base text-accent-strong">
        <p className="font-medium">
          Queued {state.sent} {state.sent === 1 ? "message" : "messages"}
          {state.failed ? `, ${state.failed} could not be queued` : ""}.
        </p>
        <p className="mt-1 text-sm">
          Messages go out through the SMS gateway; the Outbox shows what was sent and what is still
          waiting.
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
    <div className="space-y-5">
      <div>
        <p className={labelClass}>Saved texts</p>
        <p className="mt-0.5 text-sm text-neutral-500">Tap one to put it in the message box, then edit if you like.</p>
        {own.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            None of your own yet. Write a message below and press “Save this text” to reuse it later.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {own.map((t) => (
              <TextCard
                key={t.id}
                t={t}
                busy={templateBusy}
                onUse={() => insertText(t)}
                onDelete={() => removeTemplate(t)}
              />
            ))}
          </ul>
        )}

        {automatic.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-accent-strong hover:underline">
              Automatic texts ({automatic.length})
            </summary>
            <p className="mt-1 text-sm text-neutral-500">
              The texts the system sends on its own. Parts like{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono text-xs">{"{{date}}"}</code> are
              filled in when the audience fixes them; anything left must be edited before sending.
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {automatic.map((t) => (
                <TextCard key={t.id} t={t} busy={templateBusy} onUse={() => insertText(t)} />
              ))}
            </ul>
          </details>
        ) : null}

        {templateNote ? (
          <p className="mt-2 text-sm text-neutral-600" aria-live="polite">
            {templateNote}
          </p>
        ) : null}
      </div>

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
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="body" className={labelClass}>
              Message
            </label>
            {!empty ? (
              <button
                type="button"
                onClick={() => {
                  setSaveOpen((v) => !v);
                  setTemplateNote(null);
                }}
                className="text-sm font-medium text-accent-strong hover:underline"
              >
                {saveOpen ? "Cancel" : "Save this text"}
              </button>
            ) : null}
          </div>
          <textarea
            id="body"
            name="body"
            lang="bn"
            dir="auto"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-invalid={tooLong || unfilled.length > 0 || undefined}
            className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-lg leading-relaxed text-neutral-900 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-red-500"
          />
          <p className={`mt-1 text-sm ${tooLong ? "text-red-700" : "text-neutral-500"}`}>
            {a.length} of {capacity} characters · {a.segments} {a.segments === 1 ? "segment" : "segments"} per
            patient
            {a.encoding === "ucs2" ? " · Bangla text fits 70 characters in one segment" : ""}
            {tooLong ? ` · keep it to ${MAX_CAMPAIGN_SEGMENTS} segments or fewer` : ""}
          </p>
          {unfilled.length > 0 ? (
            <p className="mt-1 text-sm text-amber-800">
              Replace {unfilled.join(", ")} with the real text before sending.
            </p>
          ) : null}

          {saveOpen ? (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="min-w-48 flex-1">
                <label htmlFor="template-name" className="text-sm font-medium text-neutral-800">
                  Name for this text
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Eid holiday notice"
                  maxLength={60}
                  className={`${inputClass} mt-1`}
                />
              </div>
              <button
                type="button"
                onClick={saveTemplate}
                disabled={templateBusy || !saveName.trim()}
                className={buttonPrimaryClass}
              >
                {templateBusy ? "Saving…" : "Save"}
              </button>
            </div>
          ) : null}
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
    </div>
  );
}
