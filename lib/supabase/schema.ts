import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Detecting a database that has not had the migrations applied yet.
 *
 * Production builds hide server-component error messages from the browser,
 * so a page that throws "Could not find the table ..." shows the doctor
 * nothing useful. The dashboard layout calls checkSchema() instead and
 * renders setup instructions when a table is missing.
 */

/** Every migration file, in the order they must be pasted into the SQL editor. */
export const MIGRATIONS = [
  { file: "001_initial.sql", what: "All tables, row-level security, default settings and SMS templates" },
  { file: "002_patient_serial.sql", what: "Serial number generator for accepted patients" },
  { file: "003_patient_latest_visits.sql", what: "Latest-visit view used by the Today page" },
  { file: "004_followup_requests.sql", what: "Rate limiting for the lost-link form" },
  { file: "005_reset_demo_data.sql", what: "The “Reset demo data” button on Settings" },
  { file: "006_patient_latest_visits_v2.sql", what: "Patient columns on the latest-visit view, for Messages and the patient filters" },
] as const;

export type MigrationFile = (typeof MIGRATIONS)[number]["file"];

/**
 * PostgREST reports a table or view that does not exist as PGRST205
 * ("Could not find the table ... in the schema cache"); Postgres itself
 * uses 42P01 (undefined_table). Either means the migrations are not applied.
 */
export function isSchemaMissing(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  // 42703 is undefined_column: the table exists but a later migration added a column.
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") return true;
  return /schema cache|does not exist/i.test(error.message ?? "");
}

export type SchemaStatus =
  | { ok: true }
  | { ok: false; missingTable: string; migration: MigrationFile };

/**
 * Three one-row selects, run in parallel: `settings` exists once 001 has
 * run, `followup_requests` once 004 has, and the view's `name` column once
 * 006 has. Reports the first thing that is missing. Any other error
 * (network, RLS) is not a setup problem and is ignored here; the page's own
 * query will surface it.
 *
 * Not HEAD requests on purpose: a HEAD response carries no body, so the
 * PostgREST error code and message never reach the client and a missing
 * table looks like an empty one.
 */
export async function checkSchema(supabase: SupabaseClient): Promise<SchemaStatus> {
  const probes: { table: string; column: string; migration: MigrationFile }[] = [
    { table: "settings", column: "key", migration: "001_initial.sql" },
    { table: "followup_requests", column: "id", migration: "004_followup_requests.sql" },
    { table: "patient_latest_visits", column: "name", migration: "006_patient_latest_visits_v2.sql" },
  ];

  const results = await Promise.all(
    probes.map((p) => supabase.from(p.table).select(p.column).limit(1)),
  );

  for (let i = 0; i < probes.length; i++) {
    if (isSchemaMissing(results[i].error)) {
      return { ok: false, missingTable: probes[i].table, migration: probes[i].migration };
    }
  }
  return { ok: true };
}
