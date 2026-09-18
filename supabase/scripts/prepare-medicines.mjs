// Turns the Kaggle/medex "medicine.csv" into a clean CSV whose header row
// matches the `medicines` table (migration 009) column for column, so it can
// be loaded with Supabase's Table Editor → "Import data from CSV" with no
// mapping step. Pure file transform; it never touches the database.
//
//   node supabase/scripts/prepare-medicines.mjs [in.csv] [out.csv]
//
// Defaults: supabase/data/medicine.csv → supabase/data/medicines_import.csv
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath = "supabase/data/medicine.csv", outPath = "supabase/data/medicines_import.csv"] =
  process.argv;

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvField(v) {
  const s = String(v ?? "").trim();
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const text = readFileSync(inPath, "utf8").replace(/^﻿/, "");
const [header, ...records] = parseCsv(text);
const col = (name) => {
  const i = header.findIndex((h) => h.trim().toLowerCase() === name);
  if (i === -1) throw new Error(`column "${name}" not found in ${inPath}; header is: ${header.join(" | ")}`);
  return i;
};
const idx = {
  brand_id: col("brand id"),
  brand_name: col("brand name"),
  type: col("type"),
  dosage_form: col("dosage form"),
  generic: col("generic"),
  strength: col("strength"),
  manufacturer: col("manufacturer"),
  package_container: col("package container"),
  pack_size: col("package size"),
};

const OUT_COLS = Object.keys(idx);
const out = [OUT_COLS.join(",")];
let skipped = 0;
const seen = new Set();
for (const r of records) {
  const brand = (r[idx.brand_name] ?? "").trim();
  if (!brand) {
    skipped++;
    continue;
  }
  const id = (r[idx.brand_id] ?? "").trim();
  if (id && seen.has(id)) {
    skipped++;
    continue;
  }
  if (id) seen.add(id);
  out.push(
    OUT_COLS.map((k) => {
      const v = r[idx[k]] ?? "";
      return csvField(k === "brand_id" ? (v === "" ? "" : Number(v)) : v);
    }).join(","),
  );
}
writeFileSync(outPath, out.join("\n") + "\n", "utf8");
console.log(`${inPath}: ${records.length} records → ${out.length - 1} written, ${skipped} skipped → ${outPath}`);
