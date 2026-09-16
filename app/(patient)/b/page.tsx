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
import { Notice, PageTitle, Steps } from "@/components/patient/shell";

export const dynamic = "force-dynamic";

export default async function PickDatePage() {
  const supabase = createServiceClient();
  const [settings, dates] = await Promise.all([
    getSettings(["booking_open"] as const, supabase),
    getOpenDates(supabase),
  ]);

  if (settings.booking_open === "false") {
    return <Notice>{bn.bookingClosed}</Notice>;
  }

  return (
    <>
      <Steps current={1} />
      <PageTitle help={bn.pickDateHelp}>{bn.pickDate}</PageTitle>

      {dates.length === 0 ? (
        <div className="mt-6">
          <Notice>
            <p className="font-medium">{bn.noDates}</p>
            <p className="mt-1 text-base">{bn.noDatesHelp}</p>
          </Notice>
        </div>
      ) : (
        <ul className="mt-5 space-y-3" aria-label={bn.pickDate}>
          {dates.map((d) => {
            const w = formatWindowBn(d.call_start, d.call_end);
            const few = d.remaining !== null && d.remaining <= 5;
            return (
              <li key={d.date}>
                <Link
                  href={`/b/details?date=${d.date}`}
                  className="flex min-h-20 items-center gap-4 rounded-xl border-2 border-neutral-300 bg-white px-4 py-3 active:border-accent active:bg-accent-soft"
                >
                  <span className="flex w-20 shrink-0 flex-col items-center rounded-lg bg-accent-soft py-2 text-accent-strong">
                    <span className="text-2xl font-bold leading-none">{formatDateBn(d.date)}</span>
                    <span className="mt-1 text-sm">{weekdayBn(d.date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-medium leading-snug text-neutral-900">
                      {bn.callWindow(w.start, w.end)}
                    </span>
                    <span className={`block text-base ${few ? "text-accent-strong" : "text-neutral-500"}`}>
                      {few ? bn.remaining(toBengaliDigits(d.remaining!)) : bn.tapToBook}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-3xl leading-none text-neutral-400">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
