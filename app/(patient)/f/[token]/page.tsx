import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { bumpTokenUse, getToken, hasUsesLeft, isExpired } from "@/lib/booking/tokens";
import { findPaymentToken, findUpcomingLiveAppointment } from "@/lib/booking/holds";
import { getDayAvailability, getOpenDates } from "@/lib/availability";
import { ensureConsultDay } from "@/lib/schedule/ensure";
import { todayDhaka } from "@/lib/dates";
import { bn } from "@/lib/i18n/bn";
import {
  formatDateBn,
  formatDateLongBn,
  formatWindowBn,
  toBengaliDigits,
  weekdayBn,
} from "@/lib/i18n/format";
import {
  bigButtonClass,
  bigButtonSecondaryClass,
  Card,
  Notice,
  PageTitle,
} from "@/components/patient/shell";

export const dynamic = "force-dynamic";

/**
 * Flow B, step 1. The token fixes the patient; the date is the one the
 * doctor set, or, if the patient prefers (or that date has passed), any
 * day the doctor has opened to bookings. No name is shown anywhere.
 *
 * The link stays usable for several opens (see MAX_FOLLOWUP_LINK_USES) so
 * a patient who comes back to the SMS is sent to where they left off, not
 * to an "expired" screen.
 */
export default async function FollowupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; pick?: string }>;
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const { error } = sp;
  const supabase = createServiceClient();
  const t = await getToken(supabase, token);

  const today = todayDhaka();
  if (
    !t ||
    t.purpose !== "followup" ||
    !t.patient_id ||
    !t.target_date ||
    isExpired(t) ||
    !hasUsesLeft(t)
  ) {
    return (
      <>
        <Notice tone="error">{bn.expiredLink}</Notice>
        <p className="mt-4 text-base text-neutral-600">{bn.contactClinic}</p>
      </>
    );
  }

  // Already holding or booked for an upcoming day? Send them where they left off.
  const live = await findUpcomingLiveAppointment(supabase, t.patient_id, today);
  if (live) {
    const pay = await findPaymentToken(supabase, live.id);
    if (pay) redirect(live.status === "hold" ? `/b/pay/${pay}` : `/b/done?t=${pay}`);
  }

  await bumpTokenUse(supabase, t);

  const overdue = t.target_date < today;
  const choosing = overdue || sp.pick === "1";

  if (choosing) {
    const dates = (await getOpenDates(supabase)).filter((d) => d.date !== t.target_date || overdue);
    return (
      <>
        <PageTitle help={bn.followup.changeHelp}>{bn.followup.pickHeading}</PageTitle>

        <div className="mt-4 space-y-4">
          {overdue ? (
            <Card tone="accent">
              <p className="text-lg">{bn.greeting}</p>
              <p className="mt-2 text-xl font-semibold">
                {bn.followup.overdue(formatDateLongBn(t.target_date))}
              </p>
            </Card>
          ) : null}

          {error === "closed" ? <Notice tone="error">{bn.errors.closed}</Notice> : null}
          {error === "full" ? <Notice tone="error">{bn.errors.full}</Notice> : null}
          {error === "generic" ? <Notice tone="error">{bn.errors.generic}</Notice> : null}

          {dates.length === 0 ? (
            <Notice>
              <p className="font-medium">{bn.noDates}</p>
              <p className="mt-1 text-base">{bn.noDatesHelp}</p>
              <p className="mt-1 text-base">{bn.contactClinic}</p>
            </Notice>
          ) : (
            <ul className="space-y-3" aria-label={bn.followup.pickHeading}>
              {dates.map((d) => {
                const w = formatWindowBn(d.call_start, d.call_end);
                const few = d.remaining !== null && d.remaining <= 5;
                return (
                  <li key={d.date}>
                    <form action="/api/followup/confirm" method="post">
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="date" value={d.date} />
                      <button
                        type="submit"
                        className="flex min-h-20 w-full items-center gap-4 rounded-xl border-2 border-neutral-300 bg-white px-4 py-3 text-left active:border-accent active:bg-accent-soft"
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
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          {!overdue ? (
            <Link href={`/f/${token}`} className={bigButtonSecondaryClass}>
              {bn.followup.keepDate}
            </Link>
          ) : null}
        </div>
      </>
    );
  }

  await ensureConsultDay(supabase, t.target_date);
  const { day, full } = await getDayAvailability(supabase, t.target_date);
  const w = day ? formatWindowBn(day.call_start, day.call_end) : null;
  const blocked = day?.is_cancelled || error === "cancelled" || full || error === "full";

  return (
    <>
      <PageTitle>{bn.followup.heading}</PageTitle>

      <div className="mt-5">
        <Card tone="accent">
          <p className="text-lg">{bn.greeting}</p>
          <p className="mt-2 text-2xl font-semibold">
            {bn.followup.line(formatDateLongBn(t.target_date))}
          </p>
          {w ? <p className="mt-2 text-lg">{bn.callWindow(w.start, w.end)}</p> : null}
        </Card>
      </div>

      {day?.is_cancelled || error === "cancelled" ? (
        <div className="mt-5">
          <Notice tone="error">
            <p>{bn.dayCancelled}</p>
          </Notice>
        </div>
      ) : full || error === "full" ? (
        <div className="mt-5">
          <Notice tone="error">
            <p>{bn.dayFull}</p>
          </Notice>
        </div>
      ) : (
        <form action="/api/followup/confirm" method="post" className="mt-5 space-y-4">
          <input type="hidden" name="token" value={token} />
          {error === "generic" ? <Notice tone="error">{bn.errors.generic}</Notice> : null}
          <p className="text-lg">{bn.followup.invite}</p>
          <button type="submit" className={bigButtonClass}>
            {bn.followup.button}
          </button>
          <p className="text-base text-neutral-600">{bn.followup.chamberNote}</p>
        </form>
      )}

      {/* Another day is always on offer; when this one is off, it is the way forward. */}
      <div className="mt-4">
        <Link href={`/f/${token}?pick=1`} className={blocked ? bigButtonClass : bigButtonSecondaryClass}>
          {bn.followup.otherDay}
        </Link>
        {blocked ? <p className="mt-3 text-base text-neutral-600">{bn.contactClinic}</p> : null}
      </div>
    </>
  );
}
