"use client";

import { useEffect } from "react";
import { bn } from "@/lib/i18n/bn";
import { bigButtonClass, Notice } from "@/components/patient/shell";

/** Patient-facing error boundary. Never shows a raw error message. */
export default function PatientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <Notice tone="error">
        <p className="font-semibold">{bn.errorHeading}</p>
        <p className="mt-1 text-base">{bn.errorBody}</p>
      </Notice>
      <button type="button" onClick={reset} className={`${bigButtonClass} mt-6`}>
        {bn.tryAgain}
      </button>
    </>
  );
}
