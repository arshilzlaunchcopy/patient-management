-- =====================================================================
-- 009_medicines.sql — brand-name medicine index for the prescription
--
-- One row per brand as sold in Bangladesh (source: medex.com.bd via the
-- Kaggle "Assorted Medicine Dataset of Bangladesh", ~21,700 rows). The
-- visit form searches this by brand or generic name as the doctor types
-- and pastes the chosen line into the prescription. The doctor can add a
-- brand that is missing; those rows carry source = 'doctor'.
--
-- Loading the data: run `node supabase/scripts/prepare-medicines.mjs` to
-- turn medicine.csv into medicines_import.csv (same column names as this
-- table), then Supabase → Table Editor → medicines → Insert → Import data
-- from CSV. The id and created_at columns fill themselves.
--
-- Safe to re-run.
-- =====================================================================

create extension if not exists pg_trgm;

create table if not exists medicines (
  id                bigserial primary key,
  brand_id          int,                        -- medex id, null for doctor-added rows
  brand_name        text not null,
  type              text,                       -- allopathic | herbal
  dosage_form       text,                       -- Tablet, Capsule, Syrup, IM/IV Injection …
  generic           text,                       -- generic name(s), "+"-joined for combinations
  strength          text,                       -- "500 mg", "(10 mg+30 mg)/5 ml"
  manufacturer      text,
  package_container text,                       -- "100 ml bottle: ৳ 40.12"
  pack_size         text,
  source            text not null default 'medex'
                      check (source in ('medex', 'doctor')),
  created_at        timestamptz not null default now()
);

create unique index if not exists medicines_brand_id_key
  on medicines (brand_id) where brand_id is not null;

-- Trigram indexes make "ilike '%metf%'" fast on both search columns.
create index if not exists medicines_brand_trgm_idx
  on medicines using gin (brand_name gin_trgm_ops);
create index if not exists medicines_generic_trgm_idx
  on medicines using gin (generic gin_trgm_ops);

alter table medicines enable row level security;

drop policy if exists authenticated_all on medicines;
create policy authenticated_all on medicines
  for all to authenticated using (true) with check (true);
