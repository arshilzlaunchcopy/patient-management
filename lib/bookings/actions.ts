"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { createToken } from "@/lib/booking/tokens";
import { renderTemplate } from "@/lib/sms/templates";
import { sendSms } from "@/lib/sms/provider";
import { formatDateLongBn, formatWindowBn, toBengaliDigits } from "@/lib/i18n/format";
import { appUrl } from "@/lib/urls";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tab = "verify" | "new" | "holds";

function done(tab: Tab, msg: string): never {
  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath("/schedule");
  revalidatePath("/patients");
  revalidatePath("/outbox");
  redirect(`/bookings?tab=${tab}&msg=${msg}`);
}

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Promote a pending patient: active, with a serial from the sequence. */
async function promotePatient(
  supabase: Awaited<ReturnType<typeof createUserClient>>,
  patientId: string,
): Promise<void> {
  const { data: patient } = await supabase
    .from("patients")
    .select("status")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient || patient.status !== "pending") return;

  const { data: serial, error } = await supabase.rpc("next_patient_serial");
  if (error || typeof serial !== "string") {
    throw new Error("Could not allocate a serial number. Has migration 002 been applied?");
  }
  const { error: updateError } = await supabase
    .from("patients")
    .update({ status: "active", serial_no: serial })
    .eq("id", patientId)
    .eq("status", "pending");
  if (updateError) throw new Error(updateError.message);
}

/**
 * Verify: claim → verified, appointment → scheduled, pending patient
 * promoted, confirmation SMS queued.
 */
export async function verifyClaim(formData: FormData) {
  const claimId = field(formData, "claim_id");
  if (!UUID_RE.test(claimId)) done("verify", "error");

  const supabase = await createUserClient();
  const { data: claim } = await supabase
    .from("payment_claims")
    .select("id, status, appointments(id, status, scheduled_date, queue_no, patient_id, patients(id, phone))")
    .eq("id", claimId)
    .maybeSingle();

  type Raw = {
    status: string;
    appointments: {
      id: string;
      status: string;
      scheduled_date: string;
      queue_no: number | null;
      patient_id: string;
      patients: { id: string; phone: string } | null;
    } | null;
  };
  const c = claim as Raw | null;
  const appt = c?.appointments;
  const patient = appt?.patients;
  if (!c || c.status !== "submitted" || !appt || !patient) done("verify", "error");

  const now = new Date().toISOString();
  const { error: claimError } = await supabase
    .from("payment_claims")
    .update({ status: "verified", reviewed_at: now })
    .eq("id", claimId)
    .eq("status", "submitted");
  if (claimError) throw new Error(claimError.message);

  const { error: apptError } = await supabase
    .from("appointments")
    .update({ status: "scheduled", hold_expires_at: null })
    .eq("id", appt.id)
    .in("status", ["pending_review", "hold"]);
  if (apptError) throw new Error(apptError.message);

  await promotePatient(supabase, appt.patient_id);

  const { data: day } = await supabase
    .from("consult_days")
    .select("call_start, call_end")
    .eq("date", appt.scheduled_date)
    .eq("mode", "video")
    .maybeSingle();
  const w = formatWindowBn(day?.call_start ?? "20:00", day?.call_end ?? "22:00");

  const body = await renderTemplate("booking_confirmed", {
    queue: appt.queue_no !== null ? toBengaliDigits(appt.queue_no) : "—",
    date: formatDateLongBn(appt.scheduled_date),
    start: w.start,
    end: w.end,
  });
  await sendSms({ to: patient.phone, body, patientId: appt.patient_id });

  done("verify", "verified");
}

/**
 * Reject: claim → rejected, appointment back to a fresh 24h hold, and a
 * "payment not found" SMS carrying a new payment link.
 */
export async function rejectClaim(formData: FormData) {
  const claimId = field(formData, "claim_id");
  const note = field(formData, "note") || null;
  if (!UUID_RE.test(claimId)) done("verify", "error");

  const supabase = await createUserClient();
  const { data: claim } = await supabase
    .from("payment_claims")
    .select("id, status, appointments(id, status, scheduled_date, patient_id, patients(id, phone))")
    .eq("id", claimId)
    .maybeSingle();

  type Raw = {
    status: string;
    appointments: {
      id: string;
      status: string;
      scheduled_date: string;
      patient_id: string;
      patients: { id: string; phone: string } | null;
    } | null;
  };
  const c = claim as Raw | null;
  const appt = c?.appointments;
  const patient = appt?.patients;
  if (!c || c.status !== "submitted" || !appt || !patient) done("verify", "error");

  const now = Date.now();
  const holdUntil = new Date(now + 24 * 3_600_000);

  const { error: claimError } = await supabase
    .from("payment_claims")
    .update({ status: "rejected", reviewed_at: new Date(now).toISOString(), review_note: note })
    .eq("id", claimId)
    .eq("status", "submitted");
  if (claimError) throw new Error(claimError.message);

  const { error: apptError } = await supabase
    .from("appointments")
    .update({ status: "hold", hold_expires_at: holdUntil.toISOString() })
    .eq("id", appt.id)
    .eq("status", "pending_review");
  if (apptError) throw new Error(apptError.message);

  const token = await createToken(supabase, {
    purpose: "payment",
    patientId: appt.patient_id,
    appointmentId: appt.id,
    targetDate: appt.scheduled_date,
    expiresAt: holdUntil,
  });

  const body = await renderTemplate("payment_not_found", {
    link: appUrl(`/b/pay/${token}`),
  });
  await sendSms({ to: patient.phone, body, patientId: appt.patient_id });

  done("verify", "rejected");
}

/** Accept a pending patient: active with a serial. */
export async function acceptPatient(formData: FormData) {
  const patientId = field(formData, "patient_id");
  if (!UUID_RE.test(patientId)) done("new", "error");
  const supabase = await createUserClient();
  await promotePatient(supabase, patientId);
  done("new", "accepted");
}

/**
 * Merge a pending (duplicate) patient into an existing one: every
 * appointment, visit, token and message moves across, then the duplicate
 * is deleted. Refuses if both have a live booking on the same date.
 */
export async function mergePatients(formData: FormData) {
  const sourceId = field(formData, "source_id");
  const targetId = field(formData, "target_id");
  const tab = (field(formData, "tab") === "verify" ? "verify" : "new") as Tab;
  if (!UUID_RE.test(sourceId) || !UUID_RE.test(targetId) || sourceId === targetId) {
    done(tab, "error");
  }

  const supabase = await createUserClient();

  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("patients").select("id, status").eq("id", sourceId).maybeSingle(),
    supabase.from("patients").select("id, status").eq("id", targetId).maybeSingle(),
  ]);
  if (!source || source.status !== "pending" || !target) done(tab, "error");

  const LIVE = ["hold", "pending_review", "scheduled"];
  const [{ data: sourceAppts }, { data: targetAppts }] = await Promise.all([
    supabase.from("appointments").select("scheduled_date").eq("patient_id", sourceId).in("status", LIVE),
    supabase.from("appointments").select("scheduled_date").eq("patient_id", targetId).in("status", LIVE),
  ]);
  const targetDates = new Set((targetAppts ?? []).map((a) => a.scheduled_date as string));
  if ((sourceAppts ?? []).some((a) => targetDates.has(a.scheduled_date as string))) {
    done(tab, "conflict");
  }

  for (const table of ["appointments", "visits", "booking_tokens", "sms_log"]) {
    const { error } = await supabase
      .from(table)
      .update({ patient_id: targetId })
      .eq("patient_id", sourceId);
    if (error) throw new Error(`merge ${table}: ${error.message}`);
  }

  const { error: deleteError } = await supabase
    .from("patients")
    .delete()
    .eq("id", sourceId)
    .eq("status", "pending");
  if (deleteError) throw new Error(deleteError.message);

  done(tab, "merged");
}

/** Release a hold by hand: the place becomes free immediately. */
export async function releaseHold(formData: FormData) {
  const appointmentId = field(formData, "appointment_id");
  if (!UUID_RE.test(appointmentId)) done("holds", "error");
  const supabase = await createUserClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "expired" })
    .eq("id", appointmentId)
    .eq("status", "hold");
  if (error) throw new Error(error.message);
  done("holds", "released");
}
