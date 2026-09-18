"use server";

import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { deliverQueued, refreshDeliveryStatuses, sendSms } from "./provider";
import { analyzeSms, MAX_CAMPAIGN_SEGMENTS } from "./segments";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedIn(): Promise<boolean> {
  const supabase = await createUserClient();
  const { data: session } = await supabase.auth.getClaims();
  return !!session;
}

export interface SendQueuedState {
  message?: string;
  error?: string;
}

/** Outbox button: push queued messages through the gateway. Doctor only. */
export async function sendQueuedAction(): Promise<SendQueuedState> {
  if (!(await signedIn())) return { error: "Sign in again." };

  try {
    const r = await deliverQueued();
    revalidatePath("/outbox");
    if (r.sent === 0 && r.failed === 0) {
      return { message: "Nothing was sent. Is SMS_API_KEY set on the site?" };
    }
    return {
      message: `Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}${
        r.remaining ? `, ${r.remaining} still queued (press again)` : ""
      }.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send." };
  }
}

export interface RefreshDeliveryState {
  message?: string;
  error?: string;
}

/**
 * Ask the gateway what happened to recently sent messages. From the Outbox
 * it covers everything recent; from a patient page, that patient only.
 */
export async function refreshDeliveryAction(
  _prev: RefreshDeliveryState,
  formData: FormData,
): Promise<RefreshDeliveryState> {
  if (!(await signedIn())) return { error: "Sign in again." };
  const patientId = String(formData.get("patient_id") ?? "");

  try {
    const r = await refreshDeliveryStatuses({
      patientId: UUID_RE.test(patientId) ? patientId : undefined,
    });
    revalidatePath("/outbox");
    if (patientId) revalidatePath(`/patients/${patientId}`);
    if (r.checked === 0) {
      return { message: "Nothing to check: no recently sent messages are waiting for a report." };
    }
    const parts = [
      r.delivered ? `${r.delivered} delivered` : null,
      r.failed ? `${r.failed} not delivered` : null,
      r.pending ? `${r.pending} still in transit` : null,
    ].filter(Boolean);
    return {
      message: `Checked ${r.checked}: ${parts.join(", ")}${
        r.remaining > r.pending ? `. ${r.remaining - r.pending} more to check, press again` : ""
      }.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reach the gateway." };
  }
}

export interface PatientSmsState {
  ok?: boolean;
  status?: "sent" | "queued" | "failed";
  error?: string;
  /** Changes on every successful send so the form can reset itself. */
  sentAt?: number;
}

/**
 * One message to one patient, from their profile page. Goes through the
 * same sendSms() as everything else, so it lands in the Outbox and in the
 * patient's thread, but creates no campaign row.
 */
export async function sendPatientSmsAction(
  _prev: PatientSmsState,
  formData: FormData,
): Promise<PatientSmsState> {
  const patientId = String(formData.get("patient_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!UUID_RE.test(patientId)) return { error: "Unknown patient." };
  if (!body) return { error: "Write the message first." };
  if (/\{\{\s*\w+\s*\}\}/.test(body)) {
    return { error: "Replace the {{…}} parts with real text before sending." };
  }
  const analysis = analyzeSms(body);
  if (analysis.segments > MAX_CAMPAIGN_SEGMENTS) {
    return {
      error: `That is ${analysis.segments} SMS segments. Keep it to ${MAX_CAMPAIGN_SEGMENTS} or fewer.`,
    };
  }

  // The signed-in doctor must be able to see this patient (RLS).
  const supabase = await createUserClient();
  const { data: patient, error } = await supabase
    .from("patients")
    .select("id, phone")
    .eq("id", patientId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!patient) return { error: "Patient not found." };

  const r = await sendSms({ to: patient.phone as string, body, patientId });
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/outbox");
  if (r.status === "failed") return { error: r.error ?? "The gateway rejected the message." };
  return { ok: true, status: r.status, sentAt: Date.now() };
}
