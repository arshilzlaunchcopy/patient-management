"use server";

import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { displayBD, normalizeBD } from "@/lib/phone";
import { analyzeSms } from "@/lib/sms/segments";
import type { SettingKey } from "@/lib/settings";

export interface SettingsFormState {
  errors?: Partial<Record<SettingKey, string>>;
  message?: string;
  savedAt?: number;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function intField(
  formData: FormData,
  key: SettingKey,
  min: number,
  max: number,
  errors: NonNullable<SettingsFormState["errors"]>,
  label: string,
): string | null {
  const raw = text(formData, key);
  const n = Number(raw);
  if (raw === "" || !Number.isInteger(n) || n < min || n > max) {
    errors[key] = `${label} must be a whole number from ${min} to ${max}.`;
    return null;
  }
  return String(n);
}

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const errors: NonNullable<SettingsFormState["errors"]> = {};
  const values: Partial<Record<SettingKey, string>> = {};

  const doctorEn = text(formData, "doctor_name_en");
  const doctorBn = text(formData, "doctor_name_bn");
  const clinicBn = text(formData, "clinic_name_bn");
  if (!doctorEn) errors.doctor_name_en = "Required.";
  if (!doctorBn) errors.doctor_name_bn = "Required.";
  values.doctor_name_en = doctorEn;
  values.doctor_name_bn = doctorBn;
  values.clinic_name_bn = clinicBn;

  const bkash = normalizeBD(text(formData, "bkash_number"));
  if (!bkash) errors.bkash_number = "Enter a valid Bangladeshi mobile number.";
  else values.bkash_number = displayBD(bkash);

  // Optional: the patient pages simply hide the contact line when it is blank.
  const waRaw = text(formData, "whatsapp_number");
  const wa = normalizeBD(waRaw);
  if (waRaw && !wa) errors.whatsapp_number = "Enter a valid Bangladeshi mobile number, or leave it blank.";
  else values.whatsapp_number = wa ?? "";

  values.video_fee = intField(formData, "video_fee", 0, 100000, errors, "Video fee") ?? undefined;
  values.in_person_fee =
    intField(formData, "in_person_fee", 0, 100000, errors, "Chamber fee") ?? undefined;

  const start = text(formData, "default_call_start");
  const end = text(formData, "default_call_end");
  if (!TIME_RE.test(start)) errors.default_call_start = "Enter a time.";
  if (!TIME_RE.test(end)) errors.default_call_end = "Enter a time.";
  if (!errors.default_call_start && !errors.default_call_end && end <= start) {
    errors.default_call_end = "End must be after start.";
  }
  values.default_call_start = start;
  values.default_call_end = end;

  values.default_capacity =
    intField(formData, "default_capacity", 1, 500, errors, "Default capacity") ?? undefined;
  values.hold_minutes =
    intField(formData, "hold_minutes", 5, 180, errors, "Hold minutes") ?? undefined;
  values.reminder_days_before =
    intField(formData, "reminder_days_before", 0, 14, errors, "Reminder days") ?? undefined;
  values.reminder_send_hour =
    intField(formData, "reminder_send_hour", 0, 23, errors, "Reminder hour") ?? undefined;

  values.booking_open = formData.get("booking_open") === "on" ? "true" : "false";

  const price = text(formData, "sms_price_per_segment");
  const priceNum = Number(price);
  if (price === "" || !Number.isFinite(priceNum) || priceNum < 0 || priceNum > 50) {
    errors.sms_price_per_segment = "Enter the price of one SMS segment, from 0 to 50 taka.";
  } else {
    values.sms_price_per_segment = String(priceNum);
  }

  if (Object.keys(errors).length) return { errors };

  const rows = Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value }));

  const supabase = await createUserClient();
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) return { message: `Could not save: ${error.message}` };

  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}

export interface TemplatesFormState {
  errors?: Record<string, string>;
  message?: string;
  savedAt?: number;
}

const MAX_TEMPLATE_SEGMENTS = 3;

/**
 * Save edited bodies for the automatic SMS templates. Each body must still
 * contain every placeholder the code fills in, or a booking SMS would go
 * out without its serial number or link.
 */
export async function saveSmsTemplates(
  _prev: TemplatesFormState,
  formData: FormData,
): Promise<TemplatesFormState> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("sms_templates")
    .select("id, variables")
    .not("key", "like", "custom_%");
  if (error) return { message: `Could not load templates: ${error.message}` };

  const errors: Record<string, string> = {};
  const updates: { id: string; body_bn: string }[] = [];

  for (const row of (data ?? []) as { id: string; variables: string[] }[]) {
    const raw = formData.get(`body_${row.id}`);
    if (raw === null) continue; // not on the form
    const body = String(raw).trim();
    if (!body) {
      errors[row.id] = "The text cannot be empty.";
      continue;
    }
    const missing = (row.variables ?? []).filter(
      (v) => !new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`).test(body),
    );
    if (missing.length) {
      errors[row.id] = `Keep ${missing.map((v) => `{{${v}}}`).join(", ")} in the text.`;
      continue;
    }
    if (analyzeSms(body).segments > MAX_TEMPLATE_SEGMENTS) {
      errors[row.id] = `Keep it to ${MAX_TEMPLATE_SEGMENTS} segments or fewer.`;
      continue;
    }
    updates.push({ id: row.id, body_bn: body });
  }

  if (Object.keys(errors).length) return { errors };

  for (const u of updates) {
    const { error: upErr } = await supabase
      .from("sms_templates")
      .update({ body_bn: u.body_bn })
      .eq("id", u.id);
    if (upErr) return { message: `Could not save: ${upErr.message}` };
  }

  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

export interface ResetState {
  message?: string;
  error?: string;
}

/** Re-runs the demo seed inside the database (migration 005). */
export async function resetDemoData(): Promise<ResetState> {
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("reset_demo_data");
  if (error) {
    return {
      error: error.message.includes("reset_demo_data")
        ? "The reset function is missing. Apply migration 005 in Supabase first."
        : `Reset failed: ${error.message}`,
    };
  }
  revalidatePath("/", "layout");
  return { message: "Demo data reset. Dates are relative to today." };
}
