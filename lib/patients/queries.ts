import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { phoneSearchPrefix } from "@/lib/phone";
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

const LIST_LIMIT = 200;

/**
 * PostgREST's .or() filter uses commas and parentheses as syntax, so a
 * search term must not contain them. Wildcards are stripped too so a user
 * cannot widen the match.
 */
function sanitiseTerm(q: string): string {
  return q.replace(/[,()"'%_\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Active patients with their most recent visit, optionally filtered by a
 * search term matched against name, serial and phone (any phone format).
 */
export async function listPatients(q: string): Promise<PatientListRow[]> {
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
