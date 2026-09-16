"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DIABETES_TYPES } from "@/lib/types";
import { inputClass, labelClass } from "@/components/ui/styles";

/**
 * Audience controls. Every change goes into the URL so the recipient list
 * is server-rendered, refresh-safe and linkable from other pages.
 */
export interface AudienceOption {
  key: string;
  label: string;
}

export function AudiencePicker({
  options,
  segment,
  date,
  type,
  help,
}: {
  options: AudienceOption[];
  segment: string;
  date: string;
  type: string;
  help: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(next: { segment?: string; date?: string; type?: string }) {
    const seg = next.segment ?? segment;
    const p = new URLSearchParams({ segment: seg });
    if (seg === "booked_on") p.set("date", next.date ?? date);
    if (seg === "type") p.set("type", next.type ?? type);
    startTransition(() => router.replace(`/messages?${p.toString()}`, { scroll: false }));
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="segment" className={labelClass}>
          Send to
        </label>
        <select
          id="segment"
          value={segment}
          onChange={(e) => go({ segment: e.target.value })}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-neutral-500">{help}</p>
      </div>

      {segment === "booked_on" ? (
        <div>
          <label htmlFor="date" className={labelClass}>
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            className={inputClass}
          />
        </div>
      ) : null}

      {segment === "type" ? (
        <div>
          <label htmlFor="type" className={labelClass}>
            Diabetes type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => go({ type: e.target.value })}
            className={inputClass}
          >
            {DIABETES_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {pending ? (
        <p className="text-sm text-neutral-500" aria-live="polite">
          Updating list…
        </p>
      ) : null}
    </div>
  );
}
