"use server";

import { createUserClient } from "@/lib/supabase/server";
import type { Medicine } from "@/lib/types";
import { SEARCH_LIMIT } from "./constants";

/** Characters PostgREST's .or() treats as syntax, plus wildcards. */
function sanitise(q: string): string {
  return q.replace(/[,()"'%_\\]/g, " ").replace(/\s+/g, " ").trim();
}

export type MedicineHit = Pick<
  Medicine,
  "id" | "brand_name" | "dosage_form" | "generic" | "strength" | "manufacturer" | "package_container" | "source"
> & {
  /** From the generics table, when the generic name matches a row there. */
  drug_class?: string | null;
  indication?: string | null;
};

const HIT_COLS = "id, brand_name, dosage_form, generic, strength, manufacturer, package_container, source";

interface GenericRow {
  generic_name: string;
  drug_class: string | null;
  indication: string | null;
}

/**
 * Search brands as the doctor types. Four ways in, run together:
 *  - brand name contains the term ("comet")
 *  - generic name contains the term ("metformin")
 *  - manufacturer contains the term ("square", "incepta")
 *  - a generic's indication or drug class contains it ("type 2 dm",
 *    "biguanide"), which pulls in every brand of those generics
 * Brands whose name starts with the term come first, then alphabetical.
 * Each hit carries its drug class when the generics table knows it.
 */
export async function searchMedicinesAction(q: string): Promise<MedicineHit[]> {
  const term = sanitise(String(q ?? ""));
  if (term.length < 2) return [];

  const supabase = await createUserClient();
  // Every word must match somewhere, so "incepta glic" narrows to Incepta's
  // gliclazide brands. Chained .or() filters are ANDed by PostgREST.
  let directQuery = supabase.from("medicines").select(HIT_COLS);
  for (const word of term.split(" ").filter((w) => w.length >= 2)) {
    directQuery = directQuery.or(
      `brand_name.ilike.%${word}%,generic.ilike.%${word}%,manufacturer.ilike.%${word}%`,
    );
  }
  const [direct, byUse] = await Promise.all([
    directQuery.order("brand_name", { ascending: true }).limit(SEARCH_LIMIT * 2),
    supabase
      .from("generics")
      .select("generic_name, drug_class, indication")
      .or(`indication.ilike.%${term}%,drug_class.ilike.%${term}%`)
      .limit(12),
  ]);
  if (direct.error) throw new Error(`searchMedicines: ${direct.error.message}`);
  // A missing generics table (migration 010 not applied) just means no search by use.
  const useGenerics = byUse.error ? [] : ((byUse.data ?? []) as GenericRow[]);

  let rows = (direct.data ?? []) as MedicineHit[];
  if (useGenerics.length && rows.length < SEARCH_LIMIT) {
    const { data, error } = await supabase
      .from("medicines")
      .select(HIT_COLS)
      .in("generic", useGenerics.map((g) => g.generic_name))
      .order("brand_name", { ascending: true })
      .limit(SEARCH_LIMIT * 2);
    if (error) throw new Error(`searchMedicines by use: ${error.message}`);
    const have = new Set(rows.map((r) => r.id));
    rows = rows.concat(((data ?? []) as MedicineHit[]).filter((r) => !have.has(r.id)));
  }

  const lower = term.toLowerCase();
  const starts = rows.filter((r) => r.brand_name.toLowerCase().startsWith(lower));
  const rest = rows.filter((r) => !r.brand_name.toLowerCase().startsWith(lower));
  const hits = [...starts, ...rest].slice(0, SEARCH_LIMIT);

  // Attach drug class / indication for the generics on show.
  const names = Array.from(new Set(hits.map((h) => h.generic).filter((g): g is string => !!g)));
  const classes = new Map(useGenerics.map((g) => [g.generic_name, g]));
  const missing = names.filter((n) => !classes.has(n));
  if (missing.length) {
    const { data } = await supabase
      .from("generics")
      .select("generic_name, drug_class, indication")
      .in("generic_name", missing);
    for (const g of (data ?? []) as GenericRow[]) classes.set(g.generic_name, g);
  }
  return hits.map((h) => {
    const g = h.generic ? classes.get(h.generic) : undefined;
    return { ...h, drug_class: g?.drug_class ?? null, indication: g?.indication ?? null };
  });
}

export interface AddMedicineInput {
  brand_name: string;
  generic: string;
  strength: string;
  dosage_form: string;
  manufacturer: string;
}

export interface AddMedicineResult {
  medicine?: MedicineHit;
  error?: string;
}

/** A brand the index does not have yet. Saved once, searchable from then on. */
export async function addMedicineAction(input: AddMedicineInput): Promise<AddMedicineResult> {
  const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const brand_name = clean(input.brand_name, 120);
  const generic = clean(input.generic, 200);
  const strength = clean(input.strength, 80);
  const dosage_form = clean(input.dosage_form, 80);
  const manufacturer = clean(input.manufacturer, 120);
  if (!brand_name) return { error: "Enter the brand name." };

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("medicines")
    .insert({
      brand_name,
      generic: generic || null,
      strength: strength || null,
      dosage_form: dosage_form || null,
      manufacturer: manufacturer || null,
      type: "allopathic",
      source: "doctor",
    })
    .select(HIT_COLS)
    .single();
  if (error || !data) return { error: `Could not save: ${error?.message ?? "unknown error"}` };
  return { medicine: data as MedicineHit };
}
