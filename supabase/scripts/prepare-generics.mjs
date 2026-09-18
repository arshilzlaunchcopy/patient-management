// Turns the Kaggle/medex "generic.csv" into a clean CSV whose header row
// matches the `generics` table (migration 010), keeping only the columns
// the prescription picker uses: name, drug class, indications. The long
// monograph paragraphs are left out. Pure file transform; no database.
//
//   node supabase/scripts/prepare-generics.mjs [in.csv] [out.csv]
//
// Defaults: supabase/data/generic.csv → supabase/data/generics_import.csv
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath = "supabase/data/generic.csv", outPath = "supabase/data/generics_import.csv"] =
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
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
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
  generic_id: col("generic id"),
  generic_name: col("generic name"),
  drug_class: col("drug class"),
  indication: col("indication"),
};

const OUT_COLS = Object.keys(idx);
const out = [OUT_COLS.join(",")];
let skipped = 0;
const seen = new Set();
for (const r of records) {
  const name = (r[idx.generic_name] ?? "").trim();
  const id = (r[idx.generic_id] ?? "").trim();
  if (!name || (id && seen.has(id))) {
    skipped++;
    continue;
  }
  if (id) seen.add(id);
  out.push(
    OUT_COLS.map((k) => {
      const v = r[idx[k]] ?? "";
      // Indications arrive as one long comma-separated string; keep it as is.
      return csvField(k === "generic_id" ? (v === "" ? "" : Number(v)) : v);
    }).join(","),
  );
}
writeFileSync(outPath, out.join("\n") + "\n", "utf8");
console.log(`${inPath}: ${records.length} records → ${out.length - 1} written, ${skipped} skipped → ${outPath}`);
