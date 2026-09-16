import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { addDays, addMonths, formatDate, todayDhaka } from "@/lib/dates";

/**
 * Numbers for the Reports page. Everything is aggregated here in one pass
 * over the rows in the period, which for a single-doctor practice is a few
 * thousand rows a year at most.
 */

export const PERIODS = ["month", "last_month", "90d", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  month: "This month",
  last_month: "Last month",
  "90d": "Last 90 days",
  year: "This year",
  all: "All time",
};

export function parsePeriod(value: string | undefined): Period {
  return (PERIODS as readonly string[]).includes(value ?? "") ? (value as Period) : "month";
}

/** Inclusive 'YYYY-MM-DD' range for a period, in Dhaka dates. */
export function periodRange(p: Period): { from: string; to: string } {
  const today = todayDhaka();
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  switch (p) {
    case "month":
      return { from: firstOfMonth, to: today };
    case "last_month": {
      const from = addMonths(firstOfMonth, -1);
      return { from, to: addDays(firstOfMonth, -1) };
    }
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all":
      return { from: "2000-01-01", to: today };
  }
}

export interface MonthRow {
  month: string; // 'YYYY-MM'
  label: string; // 'Sep 2026'
  revenue: number;
  visits: number;
  video: number;
  chamber: number;
}

export interface Report {
  from: string;
  to: string;
  revenue: number;
  visits: number;
  uniquePatients: number;
  video: number;
  chamber: number;
  byPayment: { cash: number; bkash: number; free: number };
  revenueByPayment: { cash: number; bkash: number; free: number };
  newPatients: { walk_in: number; online_booking: number };
  bookingsBySource: { doctor: number; open_link: number; followup_link: number };
  onlineBookingsPending: number;
  months: MonthRow[];
  topDiagnoses: { label: string; count: number }[];
}

const PAGE = 1000;
const MAX_ROWS = 20000;

type Row = Record<string, unknown>;
type PageResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function paged(name: string, build: (from: number, to: number) => PageResult): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`${name}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function monthLabel(ym: string): string {
  return formatDate(`${ym}-01`).slice(2); // '1 Sep 2026' -> 'Sep 2026'
}

export async function getReport(from: string, to: string): Promise<Report> {
  const supabase = await createUserClient();
  // created_at is a timestamptz; bound it by Dhaka midnight either side.
  const fromTs = `${from}T00:00:00+06:00`;
  const toTs = `${addDays(to, 1)}T00:00:00+06:00`;

  const [visits, patients, appointments] = await Promise.all([
    paged("report visits", (a, b) =>
      supabase
        .from("visits")
        .select("visit_date, mode, fee_charged, payment_method, patient_id, diagnosis")
        .gte("visit_date", from)
        .lte("visit_date", to)
        .order("visit_date", { ascending: true })
        .range(a, b),
    ),
    paged("report patients", (a, b) =>
      supabase
        .from("patients")
        .select("source, status")
        .gte("created_at", fromTs)
        .lt("created_at", toTs)
        .range(a, b),
    ),
    paged("report appointments", (a, b) =>
      supabase
        .from("appointments")
        .select("booking_source, status, mode")
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .in("status", ["scheduled", "completed", "pending_review"])
        .range(a, b),
    ),
  ]);

  const r: Report = {
    from,
    to,
    revenue: 0,
    visits: 0,
    uniquePatients: 0,
    video: 0,
    chamber: 0,
    byPayment: { cash: 0, bkash: 0, free: 0 },
    revenueByPayment: { cash: 0, bkash: 0, free: 0 },
    newPatients: { walk_in: 0, online_booking: 0 },
    bookingsBySource: { doctor: 0, open_link: 0, followup_link: 0 },
    onlineBookingsPending: 0,
    months: [],
    topDiagnoses: [],
  };

  const patientsSeen = new Set<string>();
  const months = new Map<string, MonthRow>();
  const diagnoses = new Map<string, number>();

  for (const v of visits) {
    const fee = Number(v.fee_charged ?? 0) || 0;
    const date = String(v.visit_date);
    const ym = date.slice(0, 7);
    const m =
      months.get(ym) ??
      months.set(ym, { month: ym, label: monthLabel(ym), revenue: 0, visits: 0, video: 0, chamber: 0 }).get(ym)!;

    r.visits += 1;
    r.revenue += fee;
    m.visits += 1;
    m.revenue += fee;
    patientsSeen.add(String(v.patient_id));

    if (v.mode === "video") {
      r.video += 1;
      m.video += 1;
    } else {
      r.chamber += 1;
      m.chamber += 1;
    }

    const pm = v.payment_method as keyof Report["byPayment"] | null;
    if (pm && pm in r.byPayment) {
      r.byPayment[pm] += 1;
      r.revenueByPayment[pm] += fee;
    }

    // Diagnoses are free text like "Type 2 DM, Hypertension": count each part.
    for (const part of String(v.diagnosis ?? "").split(/[,;]/)) {
      const d = part.trim();
      if (d) diagnoses.set(d, (diagnoses.get(d) ?? 0) + 1);
    }
  }
  r.uniquePatients = patientsSeen.size;
  r.months = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
  r.topDiagnoses = Array.from(diagnoses.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  for (const p of patients) {
    const s = p.source as keyof Report["newPatients"];
    if (s in r.newPatients) r.newPatients[s] += 1;
  }

  for (const a of appointments) {
    if (a.status === "pending_review") {
      r.onlineBookingsPending += 1;
      continue;
    }
    const s = a.booking_source as keyof Report["bookingsBySource"];
    if (s in r.bookingsBySource) r.bookingsBySource[s] += 1;
  }

  return r;
}
