"use client";

import { useActionState } from "react";
import { resetDemoData, type ResetState } from "@/lib/settings/actions";
import { cardClass } from "@/components/ui/styles";

export function ResetDemo() {
  const [state, action, pending] = useActionState<ResetState>(resetDemoData, {});

  return (
    <section className={`${cardClass} border-amber-200 p-6`}>
      <h2 className="text-base font-semibold text-neutral-900">Demo data</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Deletes the demo patients with their visits, bookings and messages, removes online
        self-registrations that were never accepted, and re-creates the demo set with dates
        relative to today. Patients you registered yourself are kept.
      </p>
      <details className="mt-4">
        <summary className="cursor-pointer text-base font-medium text-amber-800">
          Reset demo data…
        </summary>
        <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-amber-700 px-4 py-2.5 text-base font-medium text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {pending ? "Resetting…" : "Yes, reset demo data now"}
          </button>
        </form>
      </details>
      {state.message ? (
        <p className="mt-3 text-sm text-accent-strong" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
