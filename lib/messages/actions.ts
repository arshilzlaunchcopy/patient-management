"use server";

import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { listPatients } from "@/lib/patients/queries";
import { PICKER_LIMIT } from "./constants";
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

export interface PickerPatient {
  id: string;
  name: string;
  phone: string;
  serial_no: string | null;
}

export interface TemplateActionResult {
  error?: string;
  ok?: boolean;
}

/** Save the text in the compose box as a reusable template for the Messages page. */
export async function saveTemplateAction(input: {
  name: string;
  body: string;
}): Promise<TemplateActionResult> {
  const name = String(input.name ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!name) return { error: "Give the text a short name." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };
  if (!body) return { error: "There is nothing to save yet." };
  if (analyzeSms(body).segments > MAX_CAMPAIGN_SEGMENTS) {
    return { error: `Keep saved texts to ${MAX_CAMPAIGN_SEGMENTS} segments or fewer.` };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.from("sms_templates").insert({
    key: `custom_${Date.now().toString(36)}`,
    label_en: name,
    body_bn: body,
    variables: [],
    is_active: true,
  });
  if (error) return { error: `Could not save: ${error.message}` };
  revalidatePath("/messages");
  return { ok: true };
}

/** Remove a saved text. Only the doctor's own texts can go; automatic templates stay. */
export async function deleteTemplateAction(id: string): Promise<TemplateActionResult> {
  const supabase = await createUserClient();
  const { error } = await supabase
    .from("sms_templates")
    .delete()
    .eq("id", id)
    .like("key", "custom_%");
  if (error) return { error: `Could not delete: ${error.message}` };
  revalidatePath("/messages");
  return { ok: true };
}

/**
 * Search for the "choose patients myself" audience. Same matching as the
 * Patients page (name, serial, phone in any format), active patients only,
 * capped so the list stays scannable.
 */
export async function searchPatientsAction(q: string): Promise<PickerPatient[]> {
  const term = String(q ?? "").trim();
  if (!term) return [];
  const rows = await listPatients(term);
  return rows
    .slice(0, PICKER_LIMIT)
    .map((r) => ({ id: r.id, name: r.name, phone: r.phone, serial_no: r.serial_no }));
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
    ids: field(formData, "ids"),
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
