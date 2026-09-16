import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getDayAvailability, sweepExpiredHolds } from "@/lib/availability";
import { createHold, findLiveAppointment, findPaymentToken } from "@/lib/booking/holds";
import { createToken } from "@/lib/booking/tokens";
import { getSettings, settingInt } from "@/lib/settings";
import { isIsoDate, todayDhaka } from "@/lib/dates";
import { normalizeBD } from "@/lib/phone";

/**
 * Flow A, step 2 → 3. Plain form POST from /b/details.
 * Redirects (303) to the payment page, or back with ?error=<key>.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const date = String(form.get("date") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const phone = normalizeBD(String(form.get("phone") ?? ""));

  const back = (error: string) =>
    NextResponse.redirect(
      new URL(`/b/details?date=${encodeURIComponent(date)}&error=${error}`, request.url),
      303,
    );

  if (!isIsoDate(date) || date < todayDhaka()) {
    return NextResponse.redirect(new URL("/b", request.url), 303);
  }
  if (!name || name.length > 100) return back("name");
  if (!phone) return back("phone");

  try {
    const supabase = createServiceClient();
    const settings = await getSettings(["booking_open", "hold_minutes", "video_fee"] as const, supabase);
    if (settings.booking_open === "false") return back("closed");

    await sweepExpiredHolds(supabase, date);
    const { day, full } = await getDayAvailability(supabase, date);
    if (!day || !day.is_open_for_new || day.is_cancelled) return back("closed");
    if (full) return back("full");

    // Silent phone matching: reuse the record if the number is known.
    const { data: existing, error: lookupError } = await supabase
      .from("patients")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);

    let patientId = existing?.id as string | undefined;
    if (!patientId) {
      const { data: created, error: createError } = await supabase
        .from("patients")
        .insert({ name, phone, status: "pending", source: "online_booking" })
        .select("id")
        .single();
      if (createError) throw new Error(createError.message);
      patientId = created.id as string;
    }

    // Already holding or booked for this date? Send them where they left off.
    const live = await findLiveAppointment(supabase, patientId, date);
    if (live) {
      const token =
        (await findPaymentToken(supabase, live.id)) ??
        (await createToken(supabase, {
          purpose: "payment",
          patientId,
          appointmentId: live.id,
          targetDate: date,
          expiresAt: new Date(Date.now() + 24 * 3_600_000),
        }));
      const target = live.status === "hold" ? `/b/pay/${token}` : `/b/done?t=${token}`;
      return NextResponse.redirect(new URL(target, request.url), 303);
    }

    const { paymentToken } = await createHold(supabase, {
      patientId,
      date,
      source: "open_link",
      feeAmount: settingInt(settings.video_fee, 500),
      holdMinutes: settingInt(settings.hold_minutes, 30),
    });

    return NextResponse.redirect(new URL(`/b/pay/${paymentToken}`, request.url), 303);
  } catch (err) {
    console.error("book/create:", err);
    return back("generic");
  }
}
