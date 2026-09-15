import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createToken } from "@/lib/booking/tokens";
import { renderTemplate } from "@/lib/sms/templates";
import { sendSms } from "@/lib/sms/provider";
import { addDays } from "@/lib/dates";
import { formatDateLongBn } from "@/lib/i18n/format";
import { appUrl } from "@/lib/urls";

/** Tokens expire at the end of the day after the follow-up date, Dhaka time. */
export function followupTokenExpiry(date: string): Date {
  return new Date(`${addDays(date, 1)}T23:59:59+06:00`);
}

/**
 * Create a follow-up token for a patient's upcoming date and queue the
 * reminder SMS carrying the link. Used by the /f fallback, the dashboard
 * demo button, and later the scheduled reminder function.
 */
export async function sendFollowupReminder(
  supabase: SupabaseClient,
  input: { patientId: string; phone: string; date: string },
): Promise<{ token: string; link: string }> {
  const token = await createToken(supabase, {
    purpose: "followup",
    patientId: input.patientId,
    targetDate: input.date,
    expiresAt: followupTokenExpiry(input.date),
  });
  const link = appUrl(`/f/${token}`);

  const body = await renderTemplate("followup_reminder", {
    date: formatDateLongBn(input.date),
    link,
  });
  await sendSms({ to: input.phone, body, patientId: input.patientId });

  return { token, link };
}
