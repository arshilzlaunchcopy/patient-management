"use client";

import { startTransition, useActionState } from "react";
import type { ConsultDayFormState } from "@/lib/schedule/actions";
import {
  buttonPrimaryClass,
  errorClass,
  helpClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";

type Action = (
  prev: ConsultDayFormState,
  formData: FormData,
) => Promise<ConsultDayFormState>;

export function ConsultDayForm({
  action,
  exists,
  initial,
}: {
  action: Action;
  exists: boolean;
  initial: {
    call_start: string;
    call_end: string;
    capacity: number | null;
    is_open_for_new: boolean;
    note: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
    >
      {state.message ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="call_start" className={labelClass}>
            Calls from
          </label>
          <input
            id="call_start"
            name="call_start"
            type="time"
            required
            defaultValue={initial.call_start}
            className={inputClass}
            aria-invalid={errors.call_start ? true : undefined}
          />
          {errors.call_start ? <p className={errorClass}>{errors.call_start}</p> : null}
        </div>
        <div>
          <label htmlFor="call_end" className={labelClass}>
            Until
          </label>
          <input
            id="call_end"
            name="call_end"
            type="time"
            required
            defaultValue={initial.call_end}
            className={inputClass}
            aria-invalid={errors.call_end ? true : undefined}
          />
          {errors.call_end ? <p className={errorClass}>{errors.call_end}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="capacity" className={labelClass}>
          Capacity
        </label>
        <input
          id="capacity"
          name="capacity"
          type="text"
          inputMode="numeric"
          defaultValue={initial.capacity ?? ""}
          className={`${inputClass} tabular-nums`}
          aria-invalid={errors.capacity ? true : undefined}
        />
        {errors.capacity ? (
          <p className={errorClass}>{errors.capacity}</p>
        ) : (
          <p className={helpClass}>Video patients this evening. Blank means unlimited.</p>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-md border border-neutral-200 p-3">
        <input
          type="checkbox"
          name="is_open_for_new"
          defaultChecked={initial.is_open_for_new}
          className="mt-1 h-5 w-5 accent-accent"
        />
        <span>
          <span className="block text-base font-medium text-neutral-900">
            Open to new patients
          </span>
          <span className="block text-sm text-neutral-600">
            Shows this date on the public booking link. Returning patients with
            a follow-up on this date can book either way.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="note" className={labelClass}>
          Note
        </label>
        <input
          id="note"
          name="note"
          type="text"
          defaultValue={initial.note ?? ""}
          className={inputClass}
          aria-invalid={errors.note ? true : undefined}
        />
        {errors.note ? <p className={errorClass}>{errors.note}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? "Saving…" : exists ? "Save changes" : "Open this day"}
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
