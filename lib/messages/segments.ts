import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, formatDate, isIsoDate, todayDhaka } from "@/lib/dates";
import { DIABETES_TYPES, type DiabetesType } from "@/lib/types";

/**
 * Audiences for the Messages page. A segment is a named filter over
 * patients; the same keys drive the patient list filters so "Message these
 * patients" on /patients lands on /messages with the identical audience.
 */

export const SEGMENT_KEYS = [
  "all",
  "overdue",
  "due_soon",
  "not_seen",
  "booked_on",
  "type",
  "patient",
] as const;
export type SegmentKey = (typeof SEGMENT_KEYS)[number];

export const DUE_SOON_DAYS = 7;
export const NOT_SEEN_MONTHS = 6;

export const SEGMENTS: Record<SegmentKey, { label: string; help: string }> = {
  all: { label: "All active patients", help: "Everyone with an active record." },
  overdue: {
    label: "Follow-up overdue",
    help: "Their next visit date has passed and they have not come back.",
  },
  due_soon: {
    label: `Follow-up due in the next ${DUE_SOON_DAYS} days`,
    help: "A nudge before the reminder SMS goes out automatically.",
  },
  not_seen: {
    label: `Not seen for ${NOT_SEEN_MONTHS}+ months`,
    help: "Last visit more than six months ago. Patients with no visit recorded are not included.",
  },
  booked_on: {
    label: "Booked on a date",
    help: "Everyone with a live booking on that day, video and chamber. Useful when the call window changes.",
  },
  type: { label: "By diabetes type", help: "Active patients with the chosen type." },
  patient: { label: "One patient", help: "A single message to one person." },
};

export interface SegmentFilter {
  segment: SegmentKey;
  date?: string;
  type?: DiabetesType;
  patient?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read a filter from URL search params or form fields. Anything invalid falls back to a safe value. */
export function parseSegment(
  input: Record<string, string | undefined | null>,
): SegmentFilter {
  const raw = input.segment ?? "";
  const segment = (SEGMENT_KEYS as readonly string[]).includes(raw) ? (raw as SegmentKey) : "all";
  const out: SegmentFilter = { segment };

  if (segment === "booked_on") {
    out.date = input.date && isIsoDate(input.date) ? input.date : todayDhaka();
  }
  if (segment === "type") {
    const t = input.type ?? "";
    out.type = (DIABETES_TYPES as readonly string[]).includes(t) ? (t as DiabetesType) : "Type 2";
  }
  if (segment === "patient") {
    if (input.patient && UUID_RE.test(input.patient)) out.patient = input.patient;
    else out.segment = "all";
  }
  return out;
}

/** Query string for a filter, always starting with '?'. */
export function segmentQuery(f: SegmentFilter): string {
  const p = new URLSearchParams({ segment: f.segment });
  if (f.date) p.set("date", f.date);
  if (f.type) p.set("type", f.type);
  if (f.patient) p.set("patient", f.patient);
  return `?${p.toString()}`;
}

/** Human label for a filter, used as the campaign name and in the history table. */
export function describeSegment(f: SegmentFilter, patientName?: string): string {
  switch (f.segment) {
    case "booked_on":
      return `Booked on ${formatDate(f.date)}`;
    case "type":
      return `${f.type} patients`;
    case "patient":
      return patientName ? `One patient: ${patientName}` : "One patient";
    default:
      return SEGMENTS[f.segment].label;
  }
}

export interface Recipient {
  id: string;
  name: string;
  phone: string;
  serial_no: string | null;
  /** Why they are in this audience, e.g. "Due 12 Mar 2026". */
  detail: string | null;
}

/** Hard ceiling on one campaign; PostgREST pages at 1000, so we page up to this. */
export const MAX_RECIPIENTS = 5000;
const PAGE = 1000;

type Row = Record<string, unknown>;
type PageResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * Pull every page of a query. `build` returns a fresh query for each range
 * because a PostgREST builder is single-use once awaited.
 */
async function paged(name: string, build: (from: number, to: number) => PageResult): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; from < MAX_RECIPIENTS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`${name}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

const PATIENT_COLS = "id, name, phone, serial_no";
const VIEW_COLS = "patient_id, name, phone, serial_no, visit_date, next_visit_date";

function fromPatients(rows: Row[], detail?: (r: Row) => string | null): Recipient[] {
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    serial_no: (r.serial_no as string | null) ?? null,
    detail: detail ? detail(r) : null,
  }));
}

function fromView(rows: Row[], detail: (r: Row) => string | null): Recipient[] {
  return rows.map((r) => ({
    id: String(r.patient_id),
    name: String(r.name),
    phone: String(r.phone),
    serial_no: (r.serial_no as string | null) ?? null,
    detail: detail(r),
  }));
}

/** Everyone the filter matches, ordered the way the doctor would read the list. */
export async function resolveRecipients(
  supabase: SupabaseClient,
  f: SegmentFilter,
): Promise<Recipient[]> {
  const today = todayDhaka();

  switch (f.segment) {
    case "all": {
      const rows = await paged("segment all", (a, b) =>
        supabase.from("patients").select(PATIENT_COLS).eq("status", "active").order("name").range(a, b),
      );
      return fromPatients(rows);
    }
    case "type": {
      const rows = await paged("segment type", (a, b) =>
        supabase
          .from("patients")
          .select(PATIENT_COLS)
          .eq("status", "active")
          .eq("diabetes_type", f.type!)
          .order("name")
          .range(a, b),
      );
      return fromPatients(rows);
    }
    case "patient": {
      const { data, error } = await supabase
        .from("patients")
        .select(PATIENT_COLS)
        .eq("id", f.patient!)
        .maybeSingle();
      if (error) throw new Error(`segment patient: ${error.message}`);
      return data ? fromPatients([data as Row]) : [];
    }
    case "overdue": {
      const rows = await paged("segment overdue", (a, b) =>
        supabase
          .from("patient_latest_visits")
          .select(VIEW_COLS)
          .eq("patient_status", "active")
          .lt("next_visit_date", today)
          .order("next_visit_date", { ascending: true })
          .range(a, b),
      );
      return fromView(rows, (r) => `Was due ${formatDate(r.next_visit_date as string)}`);
    }
    case "due_soon": {
      const rows = await paged("segment due_soon", (a, b) =>
        supabase
          .from("patient_latest_visits")
          .select(VIEW_COLS)
          .eq("patient_status", "active")
          .gte("next_visit_date", today)
          .lte("next_visit_date", addDays(today, DUE_SOON_DAYS))
          .order("next_visit_date", { ascending: true })
          .range(a, b),
      );
      return fromView(rows, (r) => `Due ${formatDate(r.next_visit_date as string)}`);
    }
    case "not_seen": {
      const rows = await paged("segment not_seen", (a, b) =>
        supabase
          .from("patient_latest_visits")
          .select(VIEW_COLS)
          .eq("patient_status", "active")
          .lt("visit_date", addMonths(today, -NOT_SEEN_MONTHS))
          .order("visit_date", { ascending: true })
          .range(a, b),
      );
      return fromView(rows, (r) => `Last seen ${formatDate(r.visit_date as string)}`);
    }
    case "booked_on": {
      const rows = await paged("segment booked_on", (a, b) =>
        supabase
          .from("appointments")
          .select(`queue_no, mode, patients(${PATIENT_COLS})`)
          .eq("scheduled_date", f.date!)
          .in("status", ["scheduled", "pending_review"])
          .order("mode", { ascending: false })
          .order("queue_no", { ascending: true, nullsFirst: false })
          .range(a, b),
      );
      const seen = new Set<string>();
      const out: Recipient[] = [];
      for (const r of rows) {
        const p = r.patients as Row | null;
        if (!p || seen.has(String(p.id))) continue;
        seen.add(String(p.id));
        const mode = r.mode === "video" ? "Video" : "Chamber";
        out.push({
          id: String(p.id),
          name: String(p.name),
          phone: String(p.phone),
          serial_no: (p.serial_no as string | null) ?? null,
          detail: r.queue_no != null ? `${mode} · serial ${r.queue_no}` : mode,
        });
      }
      return out;
    }
  }
}
