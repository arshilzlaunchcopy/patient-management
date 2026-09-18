import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createToken } from "@/lib/booking/tokens";
import { renderTemplate } from "@/lib/sms/templates";
import { sendSms } from "@/lib/sms/provider";
import { addDays, todayDhaka } from "@/lib/dates";
import { formatDateLongBn } from "@/lib/i18n/format";
import { appUrl } from "@/lib/urls";

/** How long a rebooking link (for a follow-up that has passed) stays usable. */
export const OVERDUE_LINK_DAYS = 14;

/**
 * Tokens for an upcoming date expire at the end of the day after it, Dhaka
 * time. For a date that has already passed the link is for picking a new
 * day, so it lives for a fixed two weeks instead.
 */
export function followupTokenExpiry(date: string): Date {
  if (date < todayDhaka()) return new Date(Date.now() + OVERDUE_LINK_DAYS * 86_400_000);
  return new Date(`${addDays(date, 1)}T23:59:59+06:00`);
}

/**
 * Create a follow-up token for a patient's next-visit date and queue the
 * SMS carrying the link. An upcoming date gets the reminder ("your
 * follow-up is on …"); a date that has passed gets the rebooking text, and
 * the link opens straight onto the open dates. Used by the /f fallback,
 * the patient-page button, and later the scheduled reminder function.
 */
export async function sendFollowupReminder(
  supabase: SupabaseClient,
  input: { patientId: string; phone: string; date: string },
): Promise<{ token: string; link: string; overdue: boolean }> {
  const overdue = input.date < todayDhaka();
  const token = await createToken(supabase, {
    purpose: "followup",
    patientId: input.patientId,
    targetDate: input.date,
    expiresAt: followupTokenExpiry(input.date),
  });
  const link = appUrl(`/f/${token}`);

  const body = overdue
    ? await renderTemplate("followup_overdue", { link })
    : await renderTemplate("followup_reminder", { date: formatDateLongBn(input.date), link });
  await sendSms({ to: input.phone, body, patientId: input.patientId });

  return { token, link, overdue };
}
