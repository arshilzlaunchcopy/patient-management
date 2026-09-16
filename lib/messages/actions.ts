"use server";

import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { sendBulkSms } from "@/lib/sms/provider";
import { analyzeSms, MAX_CAMPAIGN_SEGMENTS } from "@/lib/sms/segments";
import { describeSegment, parseSegment, resolveRecipients } from "./segments";

export interface SendState {
  error?: string;
  sent?: number;
  failed?: number;
  campaignId?: string;
}

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Queue one SMS to every patient in the chosen audience. The audience is
 * resolved again here rather than trusted from the form, and the count the
 * doctor saw must still match, so nobody sends to a list that changed
 * underneath them.
 */
export async function sendCampaign(_prev: SendState, formData: FormData): Promise<SendState> {
  const filter = parseSegment({
    segment: field(formData, "segment"),
    date: field(formData, "date"),
    type: field(formData, "type"),
    patient: field(formData, "patient"),
  });
  const body = field(formData, "body");
  const expected = Number(field(formData, "confirm_count"));

  if (!body) return { error: "Write the message first." };
  const analysis = analyzeSms(body);
  if (analysis.segments > MAX_CAMPAIGN_SEGMENTS) {
    return {
      error: `That is ${analysis.segments} SMS segments per patient. Keep it to ${MAX_CAMPAIGN_SEGMENTS} or fewer.`,
    };
  }

  const supabase = await createUserClient();
  const recipients = await resolveRecipients(supabase, filter);
  if (recipients.length === 0) return { error: "Nobody matches this audience." };
  if (recipients.length !== expected) {
    return {
      error: `The audience is now ${recipients.length} patients, not ${expected || 0}. Check the list and send again.`,
    };
  }

  const name = describeSegment(filter, filter.segment === "patient" ? recipients[0].name : undefined);
  const { data: campaign, error: campaignError } = await supabase
    .from("sms_campaigns")
    .insert({ name, body, filter_json: filter, recipient_count: recipients.length })
    .select("id")
    .single();
  if (campaignError || !campaign) {
    return { error: `Could not start the send: ${campaignError?.message ?? "unknown error"}` };
  }

  const result = await sendBulkSms(
    recipients.map((r) => ({ to: r.phone, body, patientId: r.id })),
    campaign.id as string,
  );

  await supabase
    .from("sms_campaigns")
    .update({ sent_count: result.queued + result.sent, failed_count: result.failed })
    .eq("id", campaign.id);

  revalidatePath("/messages");
  revalidatePath("/outbox");
  return {
    sent: result.queued + result.sent,
    failed: result.failed,
    campaignId: campaign.id as string,
  };
}
