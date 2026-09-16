"use client";

import { startTransition, useActionState, useState } from "react";
import { saveSmsTemplates, type TemplatesFormState } from "@/lib/settings/actions";
import { analyzeSms } from "@/lib/sms/segments";
import { buttonPrimaryClass, cardClass, errorClass, labelClass } from "@/components/ui/styles";

export interface EditableTemplate {
  id: string;
  key: string;
  label: string;
  body: string;
  variables: string[];
}

function Counter({ body }: { body: string }) {
  const a = analyzeSms(body);
  return (
    <span className="tabular-nums">
      {a.length} chars · {a.segments} {a.segments === 1 ? "segment" : "segments"}
    </span>
  );
}

function TemplateField({
  t,
  error,
}: {
  t: EditableTemplate;
  error?: string;
}) {
  const [body, setBody] = useState(t.body);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={`tpl-${t.id}`} className={labelClass}>
          {t.label}
        </label>
        <span className="text-sm text-neutral-500">
          <Counter body={body} />
        </span>
      </div>
      <textarea
        id={`tpl-${t.id}`}
        name={`body_${t.id}`}
        lang="bn"
        dir="auto"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-invalid={error ? true : undefined}
        className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-lg leading-relaxed text-neutral-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-red-500"
      />
      {error ? (
        <p className={errorClass}>{error}</p>
      ) : t.variables.length ? (
        <p className="mt-1 text-sm text-neutral-500">
          Filled in automatically, keep each one:{" "}
          {t.variables.map((v) => (
            <code key={v} className="mr-1.5 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">
              {`{{${v}}}`}
            </code>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The five SMS the system sends on its own (booking confirmed, reminders,
 * and so on). Editing here changes what patients receive from then on;
 * the placeholders must stay because the code fills them in.
 */
export function TemplatesForm({ templates }: { templates: EditableTemplate[] }) {
  const [state, formAction, pending] = useActionState<TemplatesFormState, FormData>(
    saveSmsTemplates,
    {},
  );

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className={`${cardClass} p-6`}
    >
      <h2 className="text-base font-semibold text-neutral-900">Automatic SMS texts</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Sent by the system when a booking is verified, a follow-up comes up, or a day is cancelled.
        Bangla fits 70 characters in one segment, 67 per segment after that.
      </p>

      {state.message ? (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-base text-red-800">
          {state.message}
        </p>
      ) : null}

      <div className="mt-5 space-y-5">
        {templates.map((t) => (
          <TemplateField key={t.id} t={t} error={state.errors?.[t.id]} />
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? "Saving…" : "Save texts"}
        </button>
        {state.savedAt ? (
          <span className="text-sm text-neutral-600" aria-live="polite">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  );
}
