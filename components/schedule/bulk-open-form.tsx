"use client";

import { startTransition, useActionState } from "react";
import { bulkOpenDays, type BulkOpenState } from "@/lib/schedule/actions";
import { buttonSecondaryClass, inputClass, labelClass } from "@/components/ui/styles";

const WEEKDAYS = [
  [6, "Saturday"],
  [0, "Sunday"],
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
] as const;

export function BulkOpenForm() {
  const [state, formAction, pending] = useActionState<BulkOpenState, FormData>(
    bulkOpenDays,
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div>
        <label htmlFor="bulk-count" className={labelClass}>
          Open the next
        </label>
        <select id="bulk-count" name="count" defaultValue="4" className={`${inputClass} w-24`}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="bulk-weekday" className={labelClass}>
          Weekday
        </label>
        <select
          id="bulk-weekday"
          name="weekday"
          defaultValue="6"
          className={`${inputClass} w-40`}
        >
          {WEEKDAYS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}s
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 pb-2.5 text-base text-neutral-800">
        <input type="checkbox" name="open_to_new" className="h-5 w-5 accent-accent" />
        Open to new patients
      </label>
      <button type="submit" disabled={pending} className={buttonSecondaryClass}>
        {pending ? "Opening…" : "Open days"}
      </button>
      {state.message ? (
        <span className="text-sm text-neutral-700" aria-live="polite">
          {state.message}
        </span>
      ) : null}
      {state.error ? (
        <span className="text-sm text-red-700" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
