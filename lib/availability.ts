import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayDhaka } from "@/lib/dates";
import type { ConsultDay } from "@/lib/types";

/** Spec section 3. All functions take the service client: patient pages never use the anon key. */

export const BOOKING_HORIZON_DAYS = 30;

export interface OpenDate {
  date: string;
  call_start: string;
  call_end: string;
  /** null when capacity is unlimited */
  remaining: number | null;
}

/**
 * Number of live video bookings per date. Expired holds are not counted.
 */
async function liveCounts(
  supabase: SupabaseClient,
  dates: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (dates.length === 0) return counts;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .select("scheduled_date")
    .in("scheduled_date", dates)
    .eq("mode", "video")
    .in("status", ["hold", "pending_review", "scheduled"])
    .or(`status.neq.hold,hold_expires_at.gt.${nowIso}`);
  if (error) throw new Error(`liveCounts: ${error.message}`);

  for (const r of (data ?? []) as { scheduled_date: string }[]) {
    counts.set(r.scheduled_date, (counts.get(r.scheduled_date) ?? 0) + 1);
  }
  return counts;
}

/** Dates a NEW patient may choose: open, video, not cancelled, not full, within the horizon. */
export async function getOpenDates(supabase: SupabaseClient): Promise<OpenDate[]> {
  const today = todayDhaka();
  const { data, error } = await supabase
    .from("consult_days")
    .select("*")
    .eq("mode", "video")
    .eq("is_open_for_new", true)
    .eq("is_cancelled", false)
    .gte("date", today)
    .lte("date", addDays(today, BOOKING_HORIZON_DAYS))
    .order("date", { ascending: true });
  if (error) throw new Error(`getOpenDates: ${error.message}`);

  const days = (data ?? []) as ConsultDay[];
  const counts = await liveCounts(
    supabase,
    days.map((d) => d.date),
  );

  return days
    .map((d) => ({
      date: d.date,
      call_start: d.call_start,
      call_end: d.call_end,
      remaining: d.capacity === null ? null : d.capacity - (counts.get(d.date) ?? 0),
    }))
    .filter((d) => d.remaining === null || d.remaining > 0);
}

export interface DayAvailability {
  day: ConsultDay | null;
  live: number;
  full: boolean;
}

/** Capacity state for one date's video day. `day` is null if there is no row. */
export async function getDayAvailability(
  supabase: SupabaseClient,
  date: string,
): Promise<DayAvailability> {
  const { data, error } = await supabase
    .from("consult_days")
    .select("*")
    .eq("date", date)
    .eq("mode", "video")
    .maybeSingle();
  if (error) throw new Error(`getDayAvailability: ${error.message}`);

  const day = (data as ConsultDay | null) ?? null;
  const counts = await liveCounts(supabase, [date]);
  const live = counts.get(date) ?? 0;
  const full = day?.capacity !== null && day?.capacity !== undefined && live >= day.capacity;
  return { day, live, full };
}

/** Lazy hold cleanup: flip expired holds on a date to 'expired'. */
export async function sweepExpiredHolds(supabase: SupabaseClient, date: string): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ status: "expired" })
    .eq("scheduled_date", date)
    .eq("status", "hold")
    .lt("hold_expires_at", new Date().toISOString());
  if (error) console.error("sweepExpiredHolds:", error.message);
}
