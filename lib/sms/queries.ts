import "server-only";
import { createUserClient } from "@/lib/supabase/server";

export interface SmsLogRow {
  id: string;
  phone: string;
  body: string;
  segments: number;
  status: "queued" | "sent" | "failed";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  patient: { id: string; name: string } | null;
}

export const OUTBOX_LIMIT = 100;

export async function listSmsLog(): Promise<SmsLogRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("sms_log")
    .select("id, phone, body, segments, status, error_message, sent_at, created_at, patients(id, name)")
    .order("created_at", { ascending: false })
    .limit(OUTBOX_LIMIT);
  if (error) throw new Error(`listSmsLog: ${error.message}`);

  type Raw = Omit<SmsLogRow, "patient"> & { patients: SmsLogRow["patient"] };
  return ((data ?? []) as unknown as Raw[]).map(({ patients, ...r }) => ({
    ...r,
    patient: patients,
  }));
}
