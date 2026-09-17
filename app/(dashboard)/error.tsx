"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonPrimaryClass, buttonSecondaryClass, cardClass } from "@/components/ui/styles";
import { Spinner } from "@/components/ui/spinner";

const AUTO_RETRY_DELAY_MS = 1500;

/**
 * Catches anything a dashboard page throws.
 *
 * On the live site the first request after a quiet spell sometimes fails
 * while the serverless function and the database wake up, so the boundary
 * retries once by itself before showing anything alarming. In production
 * Next.js replaces the real message with a generic one and a digest; the
 * specific hints below can only fire in development.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retried = useRef(false);
  const [retrying, setRetrying] = useState(true);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    if (retried.current) {
      setRetrying(false);
      return;
    }
    retried.current = true;
    const t = setTimeout(() => reset(), AUTO_RETRY_DELAY_MS);
    return () => clearTimeout(t);
  }, [reset]);

  const schemaMissing = /schema cache|does not exist|Could not find/i.test(error.message);
  const redacted = /omitted in production/i.test(error.message);

  if (retrying) {
    return (
      <div className={`${cardClass} flex items-center gap-3 p-8`} aria-busy="true" aria-live="polite">
        <Spinner className="h-5 w-5 text-accent" />
        <p className="text-base text-neutral-700">Reconnecting…</p>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-8`}>
      <h1 className="text-xl font-semibold text-neutral-900">The page could not load</h1>
      {schemaMissing ? (
        <p className="mt-2 text-base text-neutral-700">
          A table or view is missing. Paste <code>supabase/setup.sql</code> into the Supabase SQL
          editor, then try again.
        </p>
      ) : (
        <p className="mt-2 text-base text-neutral-700">
          It was retried once already. Press “Try again”; if it keeps happening, the details below
          help find it in the server logs.
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className={buttonPrimaryClass}>
          Try again
        </button>
        <Link href="/" className={buttonSecondaryClass}>
          Today
        </Link>
      </div>
      <details className="mt-5">
        <summary className="cursor-pointer text-sm text-neutral-500">Details</summary>
        <p className="mt-2 rounded-md bg-neutral-50 p-3 font-mono text-sm text-neutral-600">
          {redacted ? `Error digest: ${error.digest ?? "unknown"}` : error.message}
        </p>
        {redacted ? (
          <p className="mt-2 text-sm text-neutral-500">
            The live site hides the message. Search for this digest in Netlify under Logs →
            Functions.
          </p>
        ) : null}
      </details>
    </div>
  );
}
