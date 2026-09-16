"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonPrimaryClass, buttonSecondaryClass, cardClass } from "@/components/ui/styles";

/**
 * Catches anything a dashboard page throws.
 *
 * In production Next.js replaces the real message with a generic one and
 * only passes a digest, so the specific hints here can only fire in
 * development. A missing schema normally never reaches this boundary: the
 * layout checks for it first and renders setup instructions instead.
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
  const redacted = /omitted in production/i.test(error.message);

  return (
    <div className={`${cardClass} p-8`}>
      <h1 className="text-xl font-semibold text-neutral-900">Something went wrong</h1>
      {schemaMissing ? (
        <p className="mt-2 text-base text-neutral-700">
          A table or view is missing. Paste <code>supabase/setup.sql</code> into the Supabase SQL
          editor, then try again.
        </p>
      ) : redacted ? (
        <p className="mt-2 text-base text-neutral-700">
          The page could not load. The live site hides the details; find them in Netlify under
          Logs → Functions, or run <code>npm run dev</code> locally where the full message is shown.
        </p>
      ) : (
        <p className="mt-2 text-base text-neutral-700">
          The page could not load. Try again, and if it keeps happening check the server logs.
        </p>
      )}
      <p className="mt-3 rounded-md bg-neutral-50 p-3 font-mono text-sm text-neutral-600">
        {redacted ? `Error digest: ${error.digest ?? "unknown"}` : error.message}
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
