import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import type { AppointmentStatus, ConsultDay, VisitMode } from "@/lib/types";

/** Statuses shown in today's queues. Holds are not yet paid, so excluded. */
const QUEUE_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "pending_review",
  "completed",
];

export interface QueueRow {
  id: string;
  queue_no: number | null;
  mode: VisitMode;
  status: AppointmentStatus;
  patient: { id: string; name: string; phone: string; serial_no: string | null };
  last_hba1c: number | null;
  last_visit_date: string | null;
}

export interface TodayData {
  day: ConsultDay | null;
  video: QueueRow[];
  walkIn: QueueRow[];
  counters: {
    seen: number;
    booked: number;
    awaiting: number;
    /** null when the patient_latest_visits view is missing */
    overdue: number | null;
  };
  viewMissing: boolean;
}

/**
 * Everything the Today page shows. This is the first page after sign-in and
 * the one a cold function hits hardest, so a transient failure is retried
 * once before it becomes an error screen.
 */
export function getTodayData(today: string): Promise<TodayData> {
  return withRetry(() => loadTodayData(today));
}

async function loadTodayData(today: string): Promise<TodayData> {
  const supabase = await createUserClient();

  const [dayRes, apptsRes, seenRes, awaitingRes, overdueRes] = await Promise.all([
    supabase
      .from("consult_days")
      .select("*")
      .eq("date", today)
      .eq("mode", "video")
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("id, queue_no, mode, status, created_at, patients(id, name, phone, serial_no)")
      .eq("scheduled_date", today)
      .in("status", QUEUE_STATUSES)
      .order("queue_no", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("visit_date", today),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("patient_latest_visits")
      .select("patient_id", { count: "exact", head: true })
      .eq("patient_status", "active")
      .lt("next_visit_date", today),
  ]);

  if (dayRes.error) throw new Error(`getTodayData: ${dayRes.error.message}`);
  if (apptsRes.error) throw new Error(`getTodayData: ${apptsRes.error.message}`);
  if (seenRes.error) throw new Error(`getTodayData: ${seenRes.error.message}`);
  if (awaitingRes.error) throw new Error(`getTodayData: ${awaitingRes.error.message}`);

  // The view arrives with migration 003; degrade gracefully without it.
  const viewMissing = !!overdueRes.error;

  type Raw = {
    id: string;
    queue_no: number | null;
    mode: VisitMode;
    status: AppointmentStatus;
    patients: QueueRow["patient"] | null;
  };
  const raw = ((apptsRes.data ?? []) as unknown as Raw[]).filter((r) => r.patients);

  // Latest visit per patient in one query, for the "last HbA1c" column.
  const latest = new Map<string, { hba1c: number | null; visit_date: string }>();
  const ids = Array.from(new Set(raw.map((r) => r.patients!.id)));
  if (ids.length && !viewMissing) {
    const { data } = await supabase
      .from("patient_latest_visits")
      .select("patient_id, hba1c, visit_date")
      .in("patient_id", ids);
    for (const row of (data ?? []) as {
      patient_id: string;
      hba1c: number | null;
      visit_date: string;
    }[]) {
      latest.set(row.patient_id, { hba1c: row.hba1c, visit_date: row.visit_date });
    }
  }

  const rows: QueueRow[] = raw.map((r) => {
    const l = latest.get(r.patients!.id);
    return {
      id: r.id,
      queue_no: r.queue_no,
      mode: r.mode,
      status: r.status,
      patient: r.patients!,
      last_hba1c: l?.hba1c ?? null,
      last_visit_date: l?.visit_date ?? null,
    };
  });

  return {
    day: (dayRes.data as ConsultDay | null) ?? null,
    video: rows.filter((r) => r.mode === "video"),
    walkIn: rows.filter((r) => r.mode === "in_person"),
    counters: {
      seen: seenRes.count ?? 0,
      booked: rows.length,
      awaiting: awaitingRes.count ?? 0,
      overdue: viewMissing ? null : (overdueRes.count ?? 0),
    },
    viewMissing,
  };
}
