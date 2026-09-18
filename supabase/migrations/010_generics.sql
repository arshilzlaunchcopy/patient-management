-- =====================================================================
-- 010_generics.sql — generic drugs with their class and indications
--
-- One row per generic (source: medex.com.bd via the Kaggle dataset, ~1,700
-- rows). Joined to `medicines` by name (medicines.generic = generic_name),
-- so a brand's result in the prescription picker can show its drug class,
-- and the doctor can search by what a drug is for ("hypertension") and get
-- the brands. Combination products ("A + B") have no matching generic row
-- and simply show without a class.
--
-- Loading the data: `node supabase/scripts/prepare-generics.mjs` writes
-- generics_import.csv from generic.csv; then Supabase → Table Editor →
-- generics → Insert → Import data from CSV.
--
-- Safe to re-run.
-- =====================================================================

create table if not exists generics (
  id           bigserial primary key,
  generic_id   int,                          -- medex id
  generic_name text not null,
  drug_class   text,                         -- "Biguanides", "Sulfonylureas" …
  indication   text,                         -- "Type 2 DM", "Hypertension" …
  created_at   timestamptz not null default now()
);

create unique index if not exists generics_generic_id_key
  on generics (generic_id) where generic_id is not null;
create index if not exists generics_name_idx on generics (generic_name);
create index if not exists generics_name_trgm_idx
  on generics using gin (generic_name gin_trgm_ops);
create index if not exists generics_indication_trgm_idx
  on generics using gin (indication gin_trgm_ops);
create index if not exists generics_class_trgm_idx
  on generics using gin (drug_class gin_trgm_ops);

alter table generics enable row level security;

drop policy if exists authenticated_all on generics;
create policy authenticated_all on generics
  for all to authenticated using (true) with check (true);
