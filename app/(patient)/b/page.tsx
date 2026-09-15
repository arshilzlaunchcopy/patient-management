import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenDates } from "@/lib/availability";
import { getSettings } from "@/lib/settings";
import { bn } from "@/lib/i18n/bn";
import {
  formatDateBn,
  formatWindowBn,
  toBengaliDigits,
  weekdayBn,
} from "@/lib/i18n/format";
import { Notice } from "@/components/patient/shell";

export const dynamic = "force-dynamic";

export default async function PickDatePage() {
  const supabase = createServiceClient();
  const [settings, dates] = await Promise.all([
    getSettings(["booking_open"] as const),
    getOpenDates(supabase),
  ]);

  if (settings.booking_open === "false") {
    return <Notice>{bn.bookingClosed}</Notice>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{bn.pickDate}</h1>
      <p className="mt-1 text-base text-neutral-600">{bn.pickDateHelp}</p>

      {dates.length === 0 ? (
        <div className="mt-6">
          <Notice>
            <p className="font-medium">{bn.noDates}</p>
            <p className="mt-1 text-base">{bn.noDatesHelp}</p>
          </Notice>
        </div>
      ) : (
        <ul
          className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-3"
          aria-label={bn.pickDate}
        >
          {dates.map((d) => {
            const w = formatWindowBn(d.call_start, d.call_end);
            return (
              <li key={d.date} className="snap-start">
                <Link
                  href={`/b/details?date=${d.date}`}
                  className="flex min-h-36 w-36 flex-col justify-between rounded-lg border-2 border-neutral-300 bg-white p-4 active:border-accent active:bg-accent-soft"
                >
                  <span className="text-base text-neutral-600">{weekdayBn(d.date)}</span>
                  <span className="text-2xl font-semibold">{formatDateBn(d.date)}</span>
                  <span className="text-base leading-snug text-neutral-800">
                    {bn.chipWindow(w.start, w.end)}
                  </span>
                  {d.remaining !== null && d.remaining <= 5 ? (
                    <span className="text-sm text-accent-strong">
                      {bn.remaining(toBengaliDigits(d.remaining))}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
