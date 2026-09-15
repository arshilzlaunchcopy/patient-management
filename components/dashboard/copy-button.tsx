"use client";

import { useState } from "react";

/** Dashboard copy-to-clipboard button. Shows "Copied" for two seconds. */
export function CopyButton({ value, className }: { value: string; className: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", value);
    }
  }

  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
