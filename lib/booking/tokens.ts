import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Appointment, Patient } from "@/lib/types";

export type TokenPurpose = "followup" | "payment";

export interface BookingToken {
  token: string;
  purpose: TokenPurpose;
  patient_id: string | null;
  appointment_id: string | null;
  target_date: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

/** 24 random bytes, base64url: 32 characters, safe in a URL. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createToken(
  supabase: SupabaseClient,
  input: {
    purpose: TokenPurpose;
    patientId: string;
    appointmentId?: string | null;
    targetDate?: string | null;
    expiresAt: Date;
  },
): Promise<string> {
  const token = newToken();
  const { error } = await supabase.from("booking_tokens").insert({
    token,
    purpose: input.purpose,
    patient_id: input.patientId,
    appointment_id: input.appointmentId ?? null,
    target_date: input.targetDate ?? null,
    expires_at: input.expiresAt.toISOString(),
  });
  if (error) throw new Error(`createToken: ${error.message}`);
  return token;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/** Fetch a token row by value. Null if malformed or unknown. Does not check expiry or use. */
export async function getToken(
  supabase: SupabaseClient,
  token: string,
): Promise<BookingToken | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { data, error } = await supabase
    .from("booking_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(`getToken: ${error.message}`);
  return (data as BookingToken | null) ?? null;
}

export function isExpired(t: BookingToken): boolean {
  return new Date(t.expires_at).getTime() < Date.now();
}

export async function markTokenUsed(supabase: SupabaseClient, token: string): Promise<void> {
  const { error } = await supabase
    .from("booking_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null);
  if (error) throw new Error(`markTokenUsed: ${error.message}`);
}

export interface PaymentContext {
  token: BookingToken;
  appointment: Appointment;
  patient: Pick<Patient, "id" | "name" | "phone">;
}

/**
 * Resolve a payment token to its appointment and patient. Null if the token
 * is unknown, expired, or not a payment token. Used tokens still resolve
 * so the done page can be reloaded; callers check appointment.status.
 */
export async function resolvePaymentToken(
  supabase: SupabaseClient,
  token: string,
): Promise<PaymentContext | null> {
  const t = await getToken(supabase, token);
  if (!t || t.purpose !== "payment" || !t.appointment_id || isExpired(t)) return null;

  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, name, phone)")
    .eq("id", t.appointment_id)
    .maybeSingle();
  if (error) throw new Error(`resolvePaymentToken: ${error.message}`);
  if (!data) return null;

  const { patients, ...appointment } = data as Appointment & {
    patients: PaymentContext["patient"] | null;
  };
  if (!patients) return null;
  return { token: t, appointment, patient: patients };
}
