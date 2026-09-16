"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 300;

/**
 * Debounced search box that keeps the term in the URL (?q=) so the page
 * stays server-rendered and the result is shareable and refresh-safe.
 * Other parameters (the follow-up filter) are left as they are.
 */
export function PatientSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const lastPushed = useRef(initialQuery);

  useEffect(() => {
    const term = value.trim();
    if (term === lastPushed.current) return;

    const handle = setTimeout(() => {
      lastPushed.current = term;
      const params = new URLSearchParams(searchParams.toString());
      if (term) params.set("q", term);
      else params.delete("q");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [value, pathname, router, searchParams]);

  return (
    <div className="relative">
      <label htmlFor="patient-search" className="sr-only">
        Search patients
      </label>
      <input
        id="patient-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="Search by name, phone or serial"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 pr-24 text-base text-neutral-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {isPending ? (
        <span
          aria-live="polite"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500"
        >
          Searching…
        </span>
      ) : null}
    </div>
  );
}
