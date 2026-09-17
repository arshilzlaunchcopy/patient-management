import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { bumpTokenUse, getToken, hasUsesLeft, isExpired } from "@/lib/booking/tokens";
import { findLiveAppointment, findPaymentToken } from "@/lib/booking/holds";
import { getDayAvailability } from "@/lib/availability";
import { ensureConsultDay } from "@/lib/schedule/ensure";
import { todayDhaka } from "@/lib/dates";
import { bn } from "@/lib/i18n/bn";
import { formatDateLongBn, formatWindowBn } from "@/lib/i18n/format";
import { bigButtonClass, Card, Notice, PageTitle } from "@/components/patient/shell";

export const dynamic = "force-dynamic";

/**
 * Flow B, step 1. The token fixes the patient and the date; there is nothing
 * to choose. No name is shown anywhere.
 *
 * The link stays usable for several opens (see MAX_FOLLOWUP_LINK_USES) and
 * until the day after the follow-up date, so a patient who comes back to
 * the SMS to finish paying is sent to where they left off, not to an
 * "expired" screen.
 */
export default async function FollowupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, { error }] = await Promise.all([params, searchParams]);
  const supabase = createServiceClient();
  const t = await getToken(supabase, token);

  const today = todayDhaka();
  if (
    !t ||
    t.purpose !== "followup" ||
    !t.patient_id ||
    !t.target_date ||
    isExpired(t) ||
    !hasUsesLeft(t) ||
    t.target_date < today
  ) {
    return (
      <>
        <Notice tone="error">{bn.expiredLink}</Notice>
        <p className="mt-4 text-base text-neutral-600">{bn.contactClinic}</p>
      </>
    );
  }

  // If they already booked this date, send them to where they left off.
  const live = await findLiveAppointment(supabase, t.patient_id, t.target_date);
  if (live) {
    const pay = await findPaymentToken(supabase, live.id);
    if (pay) redirect(live.status === "hold" ? `/b/pay/${pay}` : `/b/done?t=${pay}`);
  }

  await bumpTokenUse(supabase, t);
  await ensureConsultDay(supabase, t.target_date);
  const { day, full } = await getDayAvailability(supabase, t.target_date);
  const w = day ? formatWindowBn(day.call_start, day.call_end) : null;

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
            <p className="mt-1 text-base">{bn.contactClinic}</p>
          </Notice>
        </div>
      ) : full || error === "full" ? (
        <div className="mt-5">
          <Notice tone="error">
            <p>{bn.dayFull}</p>
            <p className="mt-1 text-base">{bn.contactClinic}</p>
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
        </form>
      )}
    </>
  );
}
