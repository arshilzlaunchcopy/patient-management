import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeBD } from "@/lib/phone";
import { countSegments } from "./segments";

/**
 * The only file that knows how messages leave the system.
 *
 * Every message is written to sms_log first. If SMS_API_KEY is set, it is
 * then handed to sms.net.bd and marked sent or failed; if not, it stays
 * 'queued' and can be sent later from the Outbox once the key is added.
 * Nothing outside this file knows which gateway is in use.
 */

const GATEWAY_URL = "https://api.sms.net.bd/sendsms";
const GATEWAY_TIMEOUT_MS = 15_000;

/** True when a gateway key is configured, so messages really go out. Read lazily. */
export function smsGatewayConfigured(): boolean {
  return !!process.env.SMS_API_KEY;
}

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
 * Hand one message to sms.net.bd. Their API takes a form POST with
 * api_key, to (8801XXXXXXXXX) and msg, plus an optional approved sender_id,
 * and answers JSON: { error: 0, msg, data: { request_id } } on success or a
 * non-zero error with a message. Bangla is sent as-is; the gateway counts
 * the segments the same way lib/sms/segments does.
 */
async function deliver(to: string, body: string): Promise<DeliveryResult> {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) {
    console.log(`[sms] queued (no SMS_API_KEY) → ${to}: ${body}`);
    return { status: "queued" };
  }

  const params = new URLSearchParams({ api_key: apiKey, to, msg: body });
  const senderId = process.env.SMS_SENDER_ID;
  if (senderId) params.set("sender_id", senderId);

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as {
      error?: number | string;
      msg?: string;
      data?: { request_id?: number | string };
    } | null;

    if (res.ok && json && Number(json.error) === 0) {
      const id = json.data?.request_id;
      return { status: "sent", providerRequestId: id != null ? String(id) : undefined };
    }
    return { status: "failed", error: json?.msg ?? `Gateway returned HTTP ${res.status}` };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Push messages that are still 'queued' through the gateway, oldest first.
 * Used by the Outbox button after SMS_API_KEY is added, or after an outage.
 * Does nothing without a key, so the button can be shown safely.
 */
export async function deliverQueued(limit = 100): Promise<BulkSmsResult & { remaining: number }> {
  const result = { queued: 0, sent: 0, failed: 0, remaining: 0 };
  if (!smsGatewayConfigured()) return result;

  const supabase = createServiceClient();
  const { data, error, count } = await supabase
    .from("sms_log")
    .select("id, phone, body", { count: "exact" })
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`deliverQueued: ${error.message}`);

  const rows = (data ?? []) as { id: string; phone: string; body: string }[];
  for (const row of rows) {
    const d = await deliver(row.phone, row.body);
    result[d.status] += 1;
    if (d.status === "queued") continue;
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
  result.remaining = Math.max(0, (count ?? rows.length) - rows.length);
  return result;
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
