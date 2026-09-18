import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import type { DeliveryStatus } from "./delivery";

export interface SmsLogRow {
  id: string;
  phone: string;
  body: string;
  segments: number;
  status: "queued" | "sent" | "failed";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  delivery_status: DeliveryStatus | null;
  delivery_detail: string | null;
  delivery_checked_at: string | null;
  patient: { id: string; name: string } | null;
}

export const OUTBOX_LIMIT = 100;
export const PATIENT_SMS_LIMIT = 50;

const COLS =
  "id, phone, body, segments, status, error_message, sent_at, created_at, delivery_status, delivery_detail, delivery_checked_at";

/** Messages not yet handed to the gateway. */
export async function countQueued(): Promise<number> {
  const supabase = await createUserClient();
  const { count, error } = await supabase
    .from("sms_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");
  if (error) throw new Error(`countQueued: ${error.message}`);
  return count ?? 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Raw = Omit<SmsLogRow, "patient"> & { patients: SmsLogRow["patient"] };

/** Newest first. With a campaign id, only that bulk send's messages. */
export async function listSmsLog(campaignId?: string): Promise<SmsLogRow[]> {
  const supabase = await createUserClient();
  let query = supabase
    .from("sms_log")
    .select(`${COLS}, patients(id, name)`)
    .order("created_at", { ascending: false })
    .limit(OUTBOX_LIMIT);
  if (campaignId && UUID_RE.test(campaignId)) query = query.eq("campaign_id", campaignId);

  const { data, error } = await query;
  if (error) throw new Error(`listSmsLog: ${error.message}`);
  return ((data ?? []) as unknown as Raw[]).map(({ patients, ...r }) => ({
    ...r,
    patient: patients,
  }));
}

/** Every message sent to one patient, newest first: the SMS thread on their page. */
export async function listSmsForPatient(patientId: string): Promise<SmsLogRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("sms_log")
    .select(`${COLS}, patients(id, name)`)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(PATIENT_SMS_LIMIT);
  if (error) throw new Error(`listSmsForPatient: ${error.message}`);
  return ((data ?? []) as unknown as Raw[]).map(({ patients, ...r }) => ({
    ...r,
    patient: patients,
  }));
}
