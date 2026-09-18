import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getToken, hasUsesLeft, isExpired, markTokenUsed } from "@/lib/booking/tokens";
import {
  createHold,
  findPaymentToken,
  findUpcomingLiveAppointment,
} from "@/lib/booking/holds";
import { BOOKING_HORIZON_DAYS, getDayAvailability, sweepExpiredHolds } from "@/lib/availability";
import { ensureConsultDay } from "@/lib/schedule/ensure";
import { getSettings, settingInt } from "@/lib/settings";
import { addDays, isIsoDate, todayDhaka } from "@/lib/dates";

/**
 * Flow B, step 1 → payment. The patient either confirms the date the
 * doctor set (no `date` field) or picks another open day (`date` field).
 * The follow-up token stays valid for a limited number of opens so a
 * patient whose hold expired unpaid can come back through the same SMS.
 * The patient continues on a fresh payment token either way.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const picked = String(form.get("date") ?? "");
  const today = todayDhaka();

  const base = `/f/${encodeURIComponent(token)}`;
  const back = (error: string, pick: boolean) =>
    NextResponse.redirect(new URL(`${base}?${pick ? "pick=1&" : ""}error=${error}`, request.url), 303);

  try {
    const supabase = createServiceClient();
    const t = await getToken(supabase, token);
    if (
      !t ||
      t.purpose !== "followup" ||
      !t.patient_id ||
      !t.target_date ||
      isExpired(t) ||
      !hasUsesLeft(t)
    ) {
      // The page renders the expired-link state for any of these.
      return NextResponse.redirect(new URL(base, request.url), 303);
    }

    // Which day: the doctor's date, or one the patient picked from the open list.
    const choosing = isIsoDate(picked) && picked !== t.target_date;
    const date = choosing ? picked : t.target_date;
    if (date < today) {
      // The set date has passed and nothing else was chosen: show the chooser.
      return NextResponse.redirect(new URL(`${base}?pick=1`, request.url), 303);
    }

    // One live booking at a time: send them back to it rather than double-book.
    const live = await findUpcomingLiveAppointment(supabase, t.patient_id, today);
    if (live) {
      const pay = await findPaymentToken(supabase, live.id);
      if (pay) {
        return NextResponse.redirect(
          new URL(live.status === "hold" ? `/b/pay/${pay}` : `/b/done?t=${pay}`, request.url),
          303,
        );
      }
    }

    if (choosing) {
      // A picked day must be one the doctor opened to bookings, like Flow A.
      if (date > addDays(today, BOOKING_HORIZON_DAYS)) return back("closed", true);
      await sweepExpiredHolds(supabase, date);
      const { day, full } = await getDayAvailability(supabase, date);
      if (!day || !day.is_open_for_new || day.is_cancelled) return back("closed", true);
      if (full) return back("full", true);
    } else {
      await ensureConsultDay(supabase, date);
      await sweepExpiredHolds(supabase, date);
      const { day, full } = await getDayAvailability(supabase, date);
      if (!day || day.is_cancelled) return back("cancelled", false);
      if (full) return back("full", false);
    }

    const settings = await getSettings(["hold_minutes", "video_fee"] as const, supabase);
    const { paymentToken } = await createHold(supabase, {
      patientId: t.patient_id,
      date,
      source: "followup_link",
      feeAmount: settingInt(settings.video_fee, 500),
      holdMinutes: settingInt(settings.hold_minutes, 30),
    });
    // Records the first time the link led to a hold; it does not lock the link.
    await markTokenUsed(supabase, token);

    return NextResponse.redirect(new URL(`/b/pay/${paymentToken}`, request.url), 303);
  } catch (err) {
    console.error("followup/confirm:", err);
    return back("generic", isIsoDate(picked));
  }
}
