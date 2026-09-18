"use client";

import { useEffect } from "react";

/**
 * On screens too narrow for the day panel to sit beside the calendar, the
 * panel renders below it, off screen. Bring it into view once when the
 * selected day changes so tapping a date visibly does something.
 */
export function ScrollIntoView({ targetId, watch }: { targetId: string; watch: string }) {
  useEffect(() => {
    // Matches Tailwind's `xl` breakpoint, where the two-column layout starts.
    if (window.matchMedia("(min-width: 1280px)").matches) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [targetId, watch]);
  return null;
}
