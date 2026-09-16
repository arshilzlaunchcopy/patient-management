import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeBD } from "@/lib/phone";
import { countSegments } from "./segments";

/**
 * The only file that knows how messages leave the system.
 *
 * Today there is no gateway: every message is written to sms_log with
 * status 'queued' and echoed to the console. To go live with sms.bd,
 * implement `deliver()` below and nothing else changes.
 */

export interface SendSmsInput {
  to: string;
  body: string;
  patientId?: string | null;
  campaignId?: string | null;
}

export interface SendSmsResult {
  id: string | null;
  status: "queued" | "sent" | "failed";
  error?: string;
}

interface DeliveryResult {
  status: "sent" | "failed" | "queued";
  providerRequestId?: string;
  error?: string;
}

/**
 * Hand a message to the gateway. Stub: leaves it queued.
 *
 * sms.bd later:
 *   const res = await fetch("https://api.sms.net.bd/sendsms", { ... });
 *   return res.ok ? { status: "sent", providerRequestId } : { status: "failed", error };
 */
async function deliver(to: string, body: string): Promise<DeliveryResult> {
  console.log(`[sms] queued → ${to}: ${body}`);
  return { status: "queued" };
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const to = normalizeBD(input.to);
  if (!to) {
    return { id: null, status: "failed", error: `invalid phone: ${input.to}` };
  }

  const supabase = createServiceClient();
  const segments = countSegments(input.body);

  const { data, error } = await supabase
    .from("sms_log")
    .insert({
      phone: to,
      body: input.body,
      segments,
      status: "queued",
      patient_id: input.patientId ?? null,
      campaign_id: input.campaignId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[sms] could not log message", error?.message);
    return { id: null, status: "failed", error: error?.message };
  }

  const result = await deliver(to, input.body);

  if (result.status !== "queued") {
    await supabase
      .from("sms_log")
      .update({
        status: result.status,
        provider_request_id: result.providerRequestId ?? null,
        error_message: result.error ?? null,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
  }

  return { id: data.id as string, status: result.status, error: result.error };
}

export interface BulkSmsResult {
  queued: number;
  sent: number;
  failed: number;
}

const INSERT_CHUNK = 500;

/**
 * Queue the same message to many patients (the Messages page). Rows are
 * written to sms_log in chunks so a campaign to a thousand patients is a
 * couple of requests, not a thousand. Delivery goes through the same
 * `deliver()` as single messages.
 */
export async function sendBulkSms(
  messages: SendSmsInput[],
  campaignId: string | null,
): Promise<BulkSmsResult> {
  const result: BulkSmsResult = { queued: 0, sent: 0, failed: 0 };
  const rows: {
    phone: string;
    body: string;
    segments: number;
    status: "queued";
    patient_id: string | null;
    campaign_id: string | null;
  }[] = [];

  for (const m of messages) {
    const to = normalizeBD(m.to);
    if (!to) {
      result.failed += 1;
      continue;
    }
    rows.push({
      phone: to,
      body: m.body,
      segments: countSegments(m.body),
      status: "queued",
      patient_id: m.patientId ?? null,
      campaign_id: campaignId,
    });
  }

  const supabase = createServiceClient();

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { data, error } = await supabase.from("sms_log").insert(chunk).select("id, phone, body");
    if (error || !data) {
      console.error("[sms] bulk insert failed", error?.message);
      result.failed += chunk.length;
      continue;
    }

    for (const row of data as { id: string; phone: string; body: string }[]) {
      const d = await deliver(row.phone, row.body);
      if (d.status === "queued") {
        result.queued += 1;
        continue;
      }
      result[d.status] += 1;
      await supabase
        .from("sms_log")
        .update({
          status: d.status,
          provider_request_id: d.providerRequestId ?? null,
          error_message: d.error ?? null,
          sent_at: d.status === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", row.id);
    }
  }

  return result;
}
