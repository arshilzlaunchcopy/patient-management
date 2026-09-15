"use client";

import { useState } from "react";
import { bigButtonSecondaryClass } from "./shell";

/** Copies a value to the clipboard. Falls back to selecting the text if the API is unavailable. */
export function CopyButton({
  value,
  label,
  doneLabel,
}: {
  value: string;
  label: string;
  doneLabel: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
    } catch {
      const el = document.getElementById("bkash-number");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  }

  return (
    <button type="button" onClick={copy} className={bigButtonSecondaryClass}>
      {done ? doneLabel : label}
    </button>
  );
}
