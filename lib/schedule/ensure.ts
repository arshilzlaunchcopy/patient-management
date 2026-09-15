import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSettings, settingInt, settingTime } from "@/lib/settings";

/**
 * Guarantee a video consult day exists for `date`, closed to new patients,
 * with the default call window and capacity. An existing row is untouched.
 * Used when a follow-up date is set and when a follow-up link is opened.
 */
export async function ensureConsultDay(
  supabase: SupabaseClient,
  date: string,
): Promise<void> {
  const s = await getSettings([
    "default_call_start",
    "default_call_end",
    "default_capacity",
  ] as const);

  const { error } = await supabase.from("consult_days").upsert(
    {
      date,
      mode: "video",
      call_start: settingTime(s.default_call_start, "20:00"),
      call_end: settingTime(s.default_call_end, "22:00"),
      capacity: settingInt(s.default_capacity, 15),
      is_open_for_new: false,
    },
    { onConflict: "date,mode", ignoreDuplicates: true },
  );
  if (error) console.error("ensureConsultDay:", error.message);
}
