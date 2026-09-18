import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { phoneSearchPrefix } from "@/lib/phone";
import { addDays, addMonths, isIsoDate, todayDhaka } from "@/lib/dates";
import { DUE_SOON_DAYS, NOT_SEEN_MONTHS } from "@/lib/messages/segments";
import type { Patient, Visit } from "@/lib/types";

export interface PatientListRow {
  id: string;
  serial_no: string | null;
  name: string;
  phone: string;
  sex: Patient["sex"];
  date_of_birth: string | null;
  age_years: number | null;
  diabetes_type: Patient["diabetes_type"];
  last_visit_date: string | null;
  next_visit_date: string | null;
}

export const LIST_LIMIT = 200;

/**
 * Follow-up filters on the patient list. The first three match the
 * audiences on the Messages page so "Message these patients" carries the
 * same set across. "period" is the doctor's own window on the follow-up
 * date: e.g. everyone whose follow-up fell between two months and two weeks
 * ago.
 */
export const PATIENT_FILTERS = ["all", "overdue", "due_soon", "not_seen", "period"] as const;
export type PatientFilter = (typeof PATIENT_FILTERS)[number];

export function parsePatientFilter(value: string | undefined): PatientFilter {
  return (PATIENT_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as PatientFilter)
    : "all";
}

/** Inclusive bounds on next_visit_date for the "period" filter. */
export interface PeriodRange {
  from: string;
  to: string;
}

/** Default window when the doctor picks "Custom period" without dates: the last three months of missed follow-ups. */
export function defaultPeriod(): PeriodRange {
  const today = todayDhaka();
  return { from: addMonths(today, -3), to: addDays(today, -1) };
}

/** Read from/to out of the URL; anything invalid falls back to the default window. */
export function parsePeriod(input: { from?: string; to?: string }): PeriodRange {
  const d = defaultPeriod();
  const from = input.from && isIsoDate(input.from) ? input.from : d.from;
  const to = input.to && isIsoDate(input.to) ? input.to : d.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

/**
 * PostgREST's .or() filter uses commas and parentheses as syntax, so a
 * search term must not contain them. Wildcards are stripped too so a user
 * cannot widen the match.
 */
function sanitiseTerm(q: string): string {
  return q.replace(/[,()"'%_\\]/g, " ").replace(/\s+/g, " ").trim();
}

function searchClauses(q: string): string | null {
  const term = sanitiseTerm(q);
  if (!term) return null;
  const clauses = [`name.ilike.%${term}%`, `serial_no.ilike.%${term}%`];
  const prefix = phoneSearchPrefix(term);
  if (prefix) clauses.push(`phone.like.${prefix}%`);
  return clauses.join(",");
}

/**
 * Active patients with their most recent visit, optionally filtered by a
 * search term matched against name, serial and phone (any phone format),
 * and by a follow-up filter.
 */
export async function listPatients(
  q: string,
  filter: PatientFilter = "all",
  period?: PeriodRange,
): Promise<PatientListRow[]> {
  if (filter !== "all") return listByLatestVisit(q, filter, period ?? defaultPeriod());

  const supabase = await createUserClient();

  let query = supabase
    .from("patients")
    .select(
      "id, serial_no, name, phone, sex, date_of_birth, age_years, diabetes_type, visits(visit_date, next_visit_date)",
    )
    .eq("status", "active")
    .order("name", { ascending: true })
    .order("visit_date", { referencedTable: "visits", ascending: false })
    .limit(1, { referencedTable: "visits" })
    .limit(LIST_LIMIT);

  const term = sanitiseTerm(q);
  if (term) {
    const clauses = [`name.ilike.%${term}%`, `serial_no.ilike.%${term}%`];
    const prefix = phoneSearchPrefix(term);
    if (prefix) {
      clauses.push(`phone.like.${prefix}%`, `alt_phone.like.${prefix}%`);
    }
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(`listPatients: ${error.message}`);

  type Raw = Omit<PatientListRow, "last_visit_date" | "next_visit_date"> & {
    visits: { visit_date: string; next_visit_date: string | null }[];
  };

  return ((data ?? []) as unknown as Raw[]).map(({ visits, ...p }) => ({
    ...p,
    last_visit_date: visits[0]?.visit_date ?? null,
    next_visit_date: visits[0]?.next_visit_date ?? null,
  }));
}

/**
 * The follow-up filters read the patient_latest_visits view (migration 006),
 * which carries the patient columns alongside their latest visit, so one
 * query answers "who is overdue" in the order the doctor should call them.
 */
async function listByLatestVisit(
  q: string,
  filter: Exclude<PatientFilter, "all">,
  period: PeriodRange,
): Promise<PatientListRow[]> {
  const supabase = await createUserClient();
  const today = todayDhaka();

  let query = supabase
    .from("patient_latest_visits")
    .select(
      "patient_id, serial_no, name, phone, sex, date_of_birth, age_years, diabetes_type, visit_date, next_visit_date",
    )
    .eq("patient_status", "active")
    .limit(LIST_LIMIT);

  if (filter === "overdue") {
    query = query.lt("next_visit_date", today).order("next_visit_date", { ascending: true });
  } else if (filter === "due_soon") {
    query = query
      .gte("next_visit_date", today)
      .lte("next_visit_date", addDays(today, DUE_SOON_DAYS))
      .order("next_visit_date", { ascending: true });
  } else if (filter === "period") {
    query = query
      .gte("next_visit_date", period.from)
      .lte("next_visit_date", period.to)
      .order("next_visit_date", { ascending: true });
  } else {
    query = query
      .lt("visit_date", addMonths(today, -NOT_SEEN_MONTHS))
      .order("visit_date", { ascending: true });
  }

  const clauses = searchClauses(q);
  if (clauses) query = query.or(clauses);

  const { data, error } = await query;
  if (error) throw new Error(`listPatients(${filter}): ${error.message}`);

  type Raw = Omit<PatientListRow, "id" | "last_visit_date"> & {
    patient_id: string;
    visit_date: string;
  };
  return ((data ?? []) as unknown as Raw[]).map(({ patient_id, visit_date, ...p }) => ({
    ...p,
    id: patient_id,
    last_visit_date: visit_date,
  }));
}

export async function getPatient(id: string): Promise<Patient | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getPatient: ${error.message}`);
  return (data as Patient | null) ?? null;
}

export async function getVisits(patientId: string): Promise<Visit[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getVisits: ${error.message}`);
  return (data as Visit[]) ?? [];
}
