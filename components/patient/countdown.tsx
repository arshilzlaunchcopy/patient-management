"use client";

import { useEffect, useState } from "react";
import { formatCountdownBn } from "@/lib/i18n/format";

/**
 * Time left on a hold, ticking once a second. When it hits zero the page is
 * reloaded so the server can show the expired state. Server-renders the
 * initial value so it is readable before JavaScript loads.
 */
export function Countdown({ expiresAt, label }: { expiresAt: string; label: string }) {
  const target = new Date(expiresAt).getTime();
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.round((target - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((target - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0) {
        clearInterval(id);
        window.location.reload();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <p className="text-xl text-neutral-900" aria-live="off">
      {label}{" "}
      <span className="font-semibold tabular-nums">{formatCountdownBn(seconds)}</span>
    </p>
  );
}
