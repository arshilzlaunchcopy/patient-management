import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ageFromDob, formatDate } from "@/lib/dates";
import { displayBD } from "@/lib/phone";
import { parsePatientFilter, parsePeriod, listPatients, type PatientFilter } from "./queries";

/**
 * Patient list as a spreadsheet. CSV with a UTF-8 byte-order mark, which is
 * what makes Excel open Bangla names correctly on double-click without an
 * import wizard. Phone numbers are written as a formula returning text so
 * Excel keeps the leading zero instead of turning 01716… into 1.7E+9.
 */

const PAGE = 1000;
const MAX = 20000;

type Row = Record<string, unknown>;

async function allPatients(supabase: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await supabase
      .from("patients")
      .select(
        "id, serial_no, name, phone, alt_phone, sex, date_of_birth, age_years, address, diabetes_type, diagnosed_on, comorbidities, allergies, notes, status, source, created_at",
      )
      .order("serial_no", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`export patients: ${error.message}`);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function latestVisits(supabase: SupabaseClient): Promise<Map<string, Row>> {
  const map = new Map<string, Row>();
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await supabase
      .from("patient_latest_visits")
      .select("patient_id, visit_date, next_visit_date, hba1c, fbs, weight_kg")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`export visits: ${error.message}`);
    const rows = (data ?? []) as Row[];
    for (const r of rows) map.set(String(r.patient_id), r);
    if (rows.length < PAGE) break;
  }
  return map;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A phone as text in Excel: the CSV field ="01716731203" survives as typed. */
function phoneCell(v: unknown): string {
  const d = displayBD(v as string | null);
  return d ? `"=""${d}"""` : "";
}

const HEADERS = [
  "Serial",
  "Name",
  "Phone",
  "Alt phone",
  "Sex",
  "Age",
  "Date of birth",
  "Address",
  "Diabetes type",
  "Diagnosed on",
  "Comorbidities",
  "Allergies",
  "Notes",
  "Status",
  "Registered via",
  "Registered on",
  "Last visit",
  "Next visit",
  "Last HbA1c",
  "Last FBS",
  "Last weight (kg)",
];

export interface ExportOptions {
  filter?: string;
  q?: string;
  /** Bounds for the "period" filter, as on the list page. */
  from?: string;
  to?: string;
}

/** Build the CSV. With a filter or search, exports exactly what the list page shows. */
export async function buildPatientsCsv(
  supabase: SupabaseClient,
  opts: ExportOptions = {},
): Promise<{ csv: string; rows: number }> {
  const filter: PatientFilter = parsePatientFilter(opts.filter);
  const q = (opts.q ?? "").trim();

  const [patients, latest] = await Promise.all([allPatients(supabase), latestVisits(supabase)]);

  // Narrow to the current list view when one is active.
  let selected = patients;
  if (filter !== "all" || q) {
    const shown = await listPatients(
      q,
      filter,
      filter === "period" ? parsePeriod({ from: opts.from, to: opts.to }) : undefined,
    );
    const ids = new Set(shown.map((p) => p.id));
    selected = patients.filter((p) => ids.has(String(p.id)));
  }

  const lines = [HEADERS.map(cell).join(",")];
  for (const p of selected) {
    const l = latest.get(String(p.id));
    const dob = (p.date_of_birth as string | null) ?? null;
    const age = ageFromDob(dob) ?? (p.age_years as number | null) ?? "";
    lines.push(
      [
        cell(p.serial_no),
        cell(p.name),
        phoneCell(p.phone),
        phoneCell(p.alt_phone),
        cell(p.sex),
        cell(age),
        cell(formatDate(dob)),
        cell(p.address),
        cell(p.diabetes_type),
        cell(formatDate(p.diagnosed_on as string | null)),
        cell(p.comorbidities),
        cell(p.allergies),
        cell(p.notes),
        cell(p.status),
        cell(p.source === "online_booking" ? "online" : "chamber"),
        cell(formatDate(String(p.created_at ?? "").slice(0, 10))),
        cell(l ? formatDate(l.visit_date as string) : ""),
        cell(l ? formatDate(l.next_visit_date as string | null) : ""),
        cell(l?.hba1c ?? ""),
        cell(l?.fbs ?? ""),
        cell(l?.weight_kg ?? ""),
      ].join(","),
    );
  }
  return { csv: `﻿${lines.join("\r\n")}\r\n`, rows: selected.length };
}
