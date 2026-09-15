import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import type { AppointmentStatus, ConsultDay, VisitMode } from "@/lib/types";

/** Appointment statuses that occupy a place on a day. */
export const COUNTED_STATUSES: AppointmentStatus[] = [
  "hold",
  "pending_review",
  "scheduled",
  "completed",
];

export interface DayCounts {
  video: number;
  in_person: number;
}

export interface MonthOverview {
  days: Record<string, ConsultDay>;
  counts: Record<string, DayCounts>;
}

/**
 * Consult days and per-day booking counts for a date range (inclusive).
 * Expired holds are not counted.
 */
export async function getMonthOverview(
  from: string,
  to: string,
): Promise<MonthOverview> {
  const supabase = await createUserClient();

  const [daysRes, apptsRes] = await Promise.all([
    supabase
      .from("consult_days")
      .select("*")
      .eq("mode", "video")
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("appointments")
      .select("scheduled_date, mode, status, hold_expires_at")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .in("status", COUNTED_STATUSES),
  ]);

  if (daysRes.error) throw new Error(`getMonthOverview: ${daysRes.error.message}`);
  if (apptsRes.error) throw new Error(`getMonthOverview: ${apptsRes.error.message}`);

  const days: Record<string, ConsultDay> = {};
  for (const d of (daysRes.data ?? []) as ConsultDay[]) days[d.date] = d;

  const now = Date.now();
  const counts: Record<string, DayCounts> = {};
  for (const a of (apptsRes.data ?? []) as {
    scheduled_date: string;
    mode: VisitMode;
    status: AppointmentStatus;
    hold_expires_at: string | null;
  }[]) {
    if (
      a.status === "hold" &&
      a.hold_expires_at &&
      new Date(a.hold_expires_at).getTime() < now
    ) {
      continue;
    }
    const c = (counts[a.scheduled_date] ??= { video: 0, in_person: 0 });
    c[a.mode] += 1;
  }

  return { days, counts };
}

export interface DayBooking {
  id: string;
  queue_no: number | null;
  mode: VisitMode;
  status: AppointmentStatus;
  hold_expires_at: string | null;
  booking_source: string;
  patient: { id: string; name: string; phone: string; serial_no: string | null };
  claim_status: "submitted" | "verified" | "rejected" | null;
}

export interface DayDetail {
  day: ConsultDay | null;
  bookings: DayBooking[];
}

/** The consult day row (video) and every booking on that date. */
export async function getDayDetail(date: string): Promise<DayDetail> {
  const supabase = await createUserClient();

  const [dayRes, bookingsRes] = await Promise.all([
    supabase
      .from("consult_days")
      .select("*")
      .eq("date", date)
      .eq("mode", "video")
      .maybeSingle(),
    supabase
      .from("appointments")
      .select(
        "id, queue_no, mode, status, hold_expires_at, booking_source, patients(id, name, phone, serial_no), payment_claims(status)",
      )
      .eq("scheduled_date", date)
      .neq("status", "expired")
      .order("mode", { ascending: false })
      .order("queue_no", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .order("created_at", { referencedTable: "payment_claims", ascending: false })
      .limit(1, { referencedTable: "payment_claims" }),
  ]);

  if (dayRes.error) throw new Error(`getDayDetail: ${dayRes.error.message}`);
  if (bookingsRes.error) throw new Error(`getDayDetail: ${bookingsRes.error.message}`);

  type Raw = Omit<DayBooking, "patient" | "claim_status"> & {
    patients: DayBooking["patient"] | null;
    payment_claims: { status: DayBooking["claim_status"] }[];
  };

  const bookings = ((bookingsRes.data ?? []) as unknown as Raw[])
    .filter((r) => r.patients)
    .map(({ patients, payment_claims, ...rest }) => ({
      ...rest,
      patient: patients as DayBooking["patient"],
      claim_status: payment_claims[0]?.status ?? null,
    }));

  return { day: (dayRes.data as ConsultDay | null) ?? null, bookings };
}
