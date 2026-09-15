import "server-only";
import { createUserClient } from "@/lib/supabase/server";

/**
 * Read a set of keys from the settings table. Missing keys come back null;
 * callers supply their own fallbacks so a half-seeded table never crashes
 * a page.
 */
export async function getSettings<K extends string>(
  keys: readonly K[],
): Promise<Record<K, string | null>> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", keys as unknown as string[]);
  if (error) throw new Error(`getSettings: ${error.message}`);

  const out = {} as Record<K, string | null>;
  for (const k of keys) out[k] = null;
  for (const row of (data ?? []) as { key: K; value: string | null }[]) {
    out[row.key] = row.value;
  }
  return out;
}

/** Parse a settings value as a non-negative integer, else fall back. Blank counts as unset. */
export function settingInt(value: string | null, fallback: number): number {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Every settings key the app reads, in the order the settings page shows them. */
export const SETTING_KEYS = [
  "doctor_name_en",
  "doctor_name_bn",
  "clinic_name_bn",
  "bkash_number",
  "whatsapp_number",
  "video_fee",
  "in_person_fee",
  "default_call_start",
  "default_call_end",
  "default_capacity",
  "hold_minutes",
  "reminder_days_before",
  "reminder_send_hour",
  "booking_open",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** Parse a settings value as 'HH:MM', else fall back. */
export function settingTime(value: string | null, fallback: string): string {
  return value && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}
