import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getToken, isExpired, markTokenUsed } from "@/lib/booking/tokens";
import { createHold, findLiveAppointment, findPaymentToken } from "@/lib/booking/holds";
import { getDayAvailability, sweepExpiredHolds } from "@/lib/availability";
import { ensureConsultDay } from "@/lib/schedule/ensure";
import { getSettings, settingInt } from "@/lib/settings";
import { todayDhaka } from "@/lib/dates";

/**
 * Flow B, step 1 → payment. The follow-up token is single-use: it is
 * consumed here, and the patient continues on a fresh payment token.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  const back = (error: string) =>
    NextResponse.redirect(new URL(`/f/${encodeURIComponent(token)}?error=${error}`, request.url), 303);

  try {
    const supabase = createServiceClient();
    const t = await getToken(supabase, token);
    if (
      !t ||
      t.purpose !== "followup" ||
      !t.patient_id ||
      !t.target_date ||
      isExpired(t) ||
      t.used_at ||
      t.target_date < todayDhaka()
    ) {
      // The page renders the expired-link state for any of these.
      return NextResponse.redirect(new URL(`/f/${encodeURIComponent(token)}`, request.url), 303);
    }

    const live = await findLiveAppointment(supabase, t.patient_id, t.target_date);
    if (live) {
      const pay = await findPaymentToken(supabase, live.id);
      if (pay) {
        return NextResponse.redirect(
          new URL(live.status === "hold" ? `/b/pay/${pay}` : `/b/done?t=${pay}`, request.url),
          303,
        );
      }
    }

    await ensureConsultDay(supabase, t.target_date);
    await sweepExpiredHolds(supabase, t.target_date);
    const { day, full } = await getDayAvailability(supabase, t.target_date);
    if (!day || day.is_cancelled) return back("cancelled");
    if (full) return back("full");

    const settings = await getSettings(["hold_minutes", "video_fee"] as const, supabase);
    const { paymentToken } = await createHold(supabase, {
      patientId: t.patient_id,
      date: t.target_date,
      source: "followup_link",
      feeAmount: settingInt(settings.video_fee, 500),
      holdMinutes: settingInt(settings.hold_minutes, 30),
    });
    await markTokenUsed(supabase, token);

    return NextResponse.redirect(new URL(`/b/pay/${paymentToken}`, request.url), 303);
  } catch (err) {
    console.error("followup/confirm:", err);
    return back("generic");
  }
}
