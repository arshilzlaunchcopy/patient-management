"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonPrimaryClass, buttonSecondaryClass, cardClass } from "@/components/ui/styles";

/**
 * Catches anything a dashboard page throws. The most common cause during
 * setup is a missing table or view, so that case gets a specific hint.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const schemaMissing = /schema cache|does not exist|Could not find/i.test(error.message);

  return (
    <div className={`${cardClass} p-8`}>
      <h1 className="text-xl font-semibold text-neutral-900">Something went wrong</h1>
      {schemaMissing ? (
        <p className="mt-2 text-base text-neutral-700">
          The database is not set up yet. Paste the files in <code>supabase/migrations</code> into
          the Supabase SQL editor in order, then try again.
        </p>
      ) : (
        <p className="mt-2 text-base text-neutral-700">
          The page could not load. Try again, and if it keeps happening check the server logs.
        </p>
      )}
      <p className="mt-3 rounded-md bg-neutral-50 p-3 font-mono text-sm text-neutral-600">
        {error.message}
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className={buttonPrimaryClass}>
          Try again
        </button>
        <Link href="/" className={buttonSecondaryClass}>
          Today
        </Link>
      </div>
    </div>
  );
}
