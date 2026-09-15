import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Appointment } from "@/lib/types";
import { createToken } from "./tokens";

export const PAYMENT_TOKEN_HOURS = 24;

/** A booking that still occupies this patient's place on a date, if any. */
export async function findLiveAppointment(
  supabase: SupabaseClient,
  patientId: string,
  date: string,
): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .eq("scheduled_date", date)
    .in("status", ["hold", "pending_review", "scheduled"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findLiveAppointment: ${error.message}`);
  const a = (data as Appointment | null) ?? null;
  if (a?.status === "hold" && a.hold_expires_at && new Date(a.hold_expires_at).getTime() < Date.now()) {
    return null; // expired hold does not count
  }
  return a;
}

/** The newest unused, unexpired payment token for an appointment, if one exists. */
export async function findPaymentToken(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("booking_tokens")
    .select("token")
    .eq("appointment_id", appointmentId)
    .eq("purpose", "payment")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findPaymentToken: ${error.message}`);
  return (data?.token as string | undefined) ?? null;
}

/**
 * Create a video hold for a patient on a date and a payment token for it.
 * Returns the token to redirect to. Caller has already checked capacity.
 */
export async function createHold(
  supabase: SupabaseClient,
  input: {
    patientId: string;
    date: string;
    source: "open_link" | "followup_link";
    feeAmount: number;
    holdMinutes: number;
  },
): Promise<{ appointmentId: string; paymentToken: string }> {
  const holdExpiresAt = new Date(Date.now() + input.holdMinutes * 60_000);

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: input.patientId,
      scheduled_date: input.date,
      mode: "video",
      status: "hold",
      booking_source: input.source,
      fee_amount: input.feeAmount,
      hold_expires_at: holdExpiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`createHold: ${error.message}`);

  const paymentToken = await createToken(supabase, {
    purpose: "payment",
    patientId: input.patientId,
    appointmentId: data.id as string,
    targetDate: input.date,
    expiresAt: new Date(Date.now() + PAYMENT_TOKEN_HOURS * 3_600_000),
  });

  return { appointmentId: data.id as string, paymentToken };
}
