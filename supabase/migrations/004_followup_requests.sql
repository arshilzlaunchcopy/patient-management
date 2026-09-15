-- =====================================================================
-- 004_followup_requests.sql — rate limiting for the lost-link form (/f)
--
-- One row per attempt. The route handler counts rows for a phone in the
-- last hour and silently ignores the request beyond three. Serverless has
-- no memory between requests, so this lives in the database.
-- Safe to re-run.
-- =====================================================================

create table if not exists followup_requests (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,                     -- canonical 8801XXXXXXXXX
  created_at timestamptz not null default now()
);

create index if not exists followup_requests_phone_idx
  on followup_requests (phone, created_at desc);

alter table followup_requests enable row level security;

drop policy if exists authenticated_all on followup_requests;
create policy authenticated_all on followup_requests
  for all to authenticated using (true) with check (true);
