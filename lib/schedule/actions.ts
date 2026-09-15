"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { getSettings, settingInt, settingTime } from "@/lib/settings";
import { addDays, isIsoDate, todayDhaka, weekdayOf } from "@/lib/dates";

export interface ConsultDayFormState {
  errors?: Partial<
    Record<"call_start" | "call_end" | "capacity" | "note", string>
  >;
  message?: string;
  savedAt?: number;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function scheduleUrl(date: string) {
  return `/schedule?month=${date.slice(0, 7)}&day=${date}`;
}

/** Create or update the video consult day for `date`. */
export async function saveConsultDay(
  date: string,
  _prev: ConsultDayFormState,
  formData: FormData,
): Promise<ConsultDayFormState> {
  if (!isIsoDate(date)) return { message: "Invalid date." };

  const errors: ConsultDayFormState["errors"] = {};
  const call_start = String(formData.get("call_start") ?? "").trim();
  const call_end = String(formData.get("call_end") ?? "").trim();
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const is_open_for_new = formData.get("is_open_for_new") === "on";

  if (!TIME_RE.test(call_start)) errors.call_start = "Enter a start time.";
  if (!TIME_RE.test(call_end)) errors.call_end = "Enter an end time.";
  if (!errors.call_start && !errors.call_end && call_end <= call_start) {
    errors.call_end = "End must be after start.";
  }

  let capacity: number | null = null;
  if (capacityRaw !== "") {
    const n = Number(capacityRaw);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      errors.capacity = "Enter a whole number of 1 or more, or leave blank for unlimited.";
    } else {
      capacity = n;
    }
  }
  if (note && note.length > 200) errors.note = "Keep the note under 200 characters.";

  if (Object.keys(errors).length) return { errors };

  const supabase = await createUserClient();
  const { error } = await supabase.from("consult_days").upsert(
    { date, mode: "video", call_start, call_end, capacity, is_open_for_new, note },
    { onConflict: "date,mode" },
  );
  if (error) return { message: `Could not save: ${error.message}` };

  revalidatePath("/schedule");
  revalidatePath("/");
  return { savedAt: Date.now() };
}

/** Cancel or un-cancel a day. Plain form action with hidden fields. */
export async function setDayCancelled(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const cancelled = formData.get("cancelled") === "true";
  if (!isIsoDate(date)) redirect("/schedule");

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("consult_days")
    .update({ is_cancelled: cancelled })
    .eq("date", date)
    .eq("mode", "video");
  if (error) throw new Error(`setDayCancelled: ${error.message}`);

  revalidatePath("/schedule");
  revalidatePath("/");
  redirect(scheduleUrl(date));
}

export interface BulkOpenState {
  message?: string;
  error?: string;
}

/**
 * Open the next N occurrences of a weekday (starting today) with the
 * default call window and capacity. Existing rows are left untouched.
 */
export async function bulkOpenDays(
  _prev: BulkOpenState,
  formData: FormData,
): Promise<BulkOpenState> {
  const weekday = Number(formData.get("weekday"));
  const count = Number(formData.get("count"));
  const openToNew = formData.get("open_to_new") === "on";

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { error: "Choose a weekday." };
  }
  if (!Number.isInteger(count) || count < 1 || count > 12) {
    return { error: "Choose how many days to open (1 to 12)." };
  }

  const today = todayDhaka();
  const first = addDays(today, (weekday - weekdayOf(today) + 7) % 7);
  const dates = Array.from({ length: count }, (_, i) => addDays(first, i * 7));

  const supabase = await createUserClient();
  const s = await getSettings([
    "default_call_start",
    "default_call_end",
    "default_capacity",
  ] as const);

  const { data: existing, error: existingError } = await supabase
    .from("consult_days")
    .select("date")
    .eq("mode", "video")
    .in("date", dates);
  if (existingError) return { error: existingError.message };
  const have = new Set((existing ?? []).map((r) => r.date as string));

  const rows = dates
    .filter((d) => !have.has(d))
    .map((date) => ({
      date,
      mode: "video",
      call_start: settingTime(s.default_call_start, "20:00"),
      call_end: settingTime(s.default_call_end, "22:00"),
      capacity: settingInt(s.default_capacity, 15),
      is_open_for_new: openToNew,
    }));

  if (rows.length) {
    const { error } = await supabase
      .from("consult_days")
      .upsert(rows, { onConflict: "date,mode", ignoreDuplicates: true });
    if (error) return { error: `Could not open days: ${error.message}` };
  }

  revalidatePath("/schedule");
  revalidatePath("/");

  const skipped = dates.length - rows.length;
  return {
    message:
      `Opened ${rows.length} ${rows.length === 1 ? "day" : "days"}` +
      (skipped ? `, ${skipped} already existed.` : "."),
  };
}
