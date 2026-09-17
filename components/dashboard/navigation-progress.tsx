"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Thin progress bar at the top of the dashboard while a page is loading.
 *
 * Next.js keeps the old page on screen until the new one is ready, so a
 * click on a slow connection otherwise looks like nothing happened. Any
 * click on a same-site link starts the bar; the URL changing ends it.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const location = `${pathname}?${search.toString()}`;
  const [active, setActive] = useState(false);

  // The navigation landed.
  useEffect(() => {
    setActive(false);
  }, [location]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      setActive(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Never leave the bar stuck if a navigation is cancelled.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 20_000);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-1 bg-accent transition-opacity duration-300 ${
        active ? "nav-progress-active opacity-100" : "w-full opacity-0"
      }`}
    />
  );
}
