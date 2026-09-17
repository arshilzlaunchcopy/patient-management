-- =====================================================================
-- setup.sql -- every migration in one file, for first-time setup
--
-- Paste the whole file into the Supabase SQL editor and press Run. It is
-- the files in supabase/migrations/ concatenated in order, and every one
-- of them is safe to re-run, so running this again is harmless.
--
-- After it finishes, reload the dashboard. Sample patients can then be
-- loaded from Settings -> Demo data -> Reset demo data.
--
-- When a new migration is added, append it here too so setup stays a
-- single paste.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BEGIN 001_initial.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- 001_initial.sql — full schema for the clinic management system
-- Spec: clinic-spec-v3.md, section 2 (schema), section 7 (SMS templates)
--
-- Paste into the Supabase SQL editor. Safe to re-run: every statement is
-- guarded with IF NOT EXISTS / OR REPLACE / ON CONFLICT DO NOTHING.
-- =====================================================================

begin;

-- =========================
-- PATIENTS
-- =========================
create table if not exists patients (
  id            uuid primary key default gen_random_uuid(),
  serial_no     text unique,                   -- assigned when doctor accepts
  name          text not null,
  phone         text not null unique,          -- canonical 8801XXXXXXXXX
  alt_phone     text,
  sex           text check (sex in ('M','F','Other')),
  date_of_birth date,
  age_years     int,
  address       text,
  diabetes_type text check (diabetes_type in ('Type 1','Type 2','Gestational','Pre-diabetic','Other')),
  diagnosed_on  date,
  comorbidities text,
  allergies     text,
  notes         text,
  status        text not null default 'active'
                  check (status in ('active','pending','inactive')),
  source        text not null default 'walk_in'
                  check (source in ('walk_in','online_booking')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists patients_phone_idx  on patients (phone);
create index if not exists patients_status_idx on patients (status);
create sequence if not exists patient_serial_seq start 1;

-- Keep updated_at honest without relying on app code.
create or replace function set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists patients_set_updated_at on patients;
create trigger patients_set_updated_at
  before update on patients
  for each row execute function set_updated_at();

-- =========================
-- CONSULT DAYS
-- =========================
-- One row per date the doctor runs consultations.
create table if not exists consult_days (
  id               uuid primary key default gen_random_uuid(),
  date             date not null,
  mode             text not null default 'video'
                     check (mode in ('video','in_person')),
  call_start       time not null,               -- "you'll be called between..."
  call_end         time not null,
  capacity         int,                         -- NULL = unlimited
  is_open_for_new  boolean not null default false,  -- can NEW patients book?
  is_cancelled     boolean not null default false,
  note             text,
  created_at       timestamptz not null default now(),
  unique (date, mode)
);

create index if not exists consult_days_date_idx on consult_days (date);

-- =========================
-- APPOINTMENTS
-- =========================
create table if not exists appointments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patients(id) on delete cascade,
  scheduled_date  date not null,
  queue_no        int,                          -- assigned on payment submission
  mode            text not null default 'in_person'
                    check (mode in ('in_person','video')),
  status          text not null default 'scheduled'
                    check (status in (
                      'hold',            -- reserved, payment not yet submitted
                      'pending_review',  -- payment claimed, awaiting verification
                      'scheduled',       -- confirmed
                      'completed','cancelled','no_show','expired'
                    )),
  booking_source  text not null default 'doctor'
                    check (booking_source in ('doctor','open_link','followup_link')),
  fee_amount      numeric(10,2) default 0,
  hold_expires_at timestamptz,
  reminder_sent_at timestamptz,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists appointments_date_status_idx on appointments (scheduled_date, status);
create index if not exists appointments_patient_idx     on appointments (patient_id);

-- Queue numbers are unique within a date+mode
create unique index if not exists uniq_queue
  on appointments (scheduled_date, mode, queue_no)
  where queue_no is not null;

-- One live booking per patient per date
create unique index if not exists uniq_patient_day
  on appointments (patient_id, scheduled_date)
  where status in ('hold','pending_review','scheduled');

-- =========================
-- QUEUE NUMBER ASSIGNMENT
-- =========================
-- Assigned when payment proof is submitted, not when the hold is created,
-- so abandoned bookings do not eat numbers. Race-safe via an advisory lock.
-- A rejected payment leaves a gap in the sequence; that is fine, never renumber.
create or replace function assign_queue_no(p_appt uuid) returns int
language plpgsql
set search_path = public
as $$
declare v_date date; v_mode text; v_no int;
begin
  select scheduled_date, mode into v_date, v_mode
    from appointments where id = p_appt;

  if v_date is null then
    raise exception 'appointment % not found', p_appt;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_date::text || v_mode));

  select coalesce(max(queue_no), 0) + 1 into v_no
    from appointments
   where scheduled_date = v_date and mode = v_mode and queue_no is not null;

  update appointments set queue_no = v_no where id = p_appt;
  return v_no;
end $$;

-- =========================
-- PAYMENT CLAIMS
-- =========================
create table if not exists payment_claims (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  claimed_name   text not null,
  trx_id         text,
  sender_phone   text,
  amount         numeric(10,2),
  status         text not null default 'submitted'
                   check (status in ('submitted','verified','rejected')),
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now(),
  constraint proof_present check (trx_id is not null or sender_phone is not null)
);

create index if not exists payment_claims_status_idx on payment_claims (status, created_at desc);
create unique index if not exists uniq_trx on payment_claims (trx_id)
  where trx_id is not null and status <> 'rejected';

-- =========================
-- BOOKING TOKENS
-- =========================
create table if not exists booking_tokens (
  token          text primary key,
  purpose        text not null check (purpose in ('followup','payment')),
  patient_id     uuid references patients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete cascade,
  target_date    date,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- =========================
-- VISITS
-- =========================
create table if not exists visits (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references patients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  visit_date     date not null default current_date,
  mode           text not null default 'in_person',
  weight_kg      numeric(5,2),
  height_cm      numeric(5,2),
  bp_systolic    int,
  bp_diastolic   int,
  fbs            numeric(5,2),
  rbs            numeric(5,2),
  hba1c          numeric(4,2),
  creatinine     numeric(5,2),
  complaints     text,
  examination    text,
  diagnosis      text,
  prescription   text,
  advice         text,
  fee_charged    numeric(10,2),
  payment_method text check (payment_method in ('cash','bkash','free')),
  next_visit_date date,
  created_at     timestamptz not null default now()
);

create index if not exists visits_patient_date_idx on visits (patient_id, visit_date desc);
create index if not exists visits_next_visit_idx   on visits (next_visit_date);

-- =========================
-- SMS
-- =========================
create table if not exists sms_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label_en text not null,
  body_bn text not null,
  variables text[] not null default '{}',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists sms_templates_set_updated_at on sms_templates;
create trigger sms_templates_set_updated_at
  before update on sms_templates
  for each row execute function set_updated_at();

create table if not exists sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text,
  body text not null,
  template_key text,
  filter_json jsonb,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sms_log (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references sms_campaigns(id) on delete set null,
  patient_id uuid references patients(id) on delete set null,
  phone text not null,
  body text not null,
  segments int not null default 1,
  status text not null default 'queued'
    check (status in ('queued','sent','failed')),
  provider_request_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================
-- SETTINGS
-- =========================
create table if not exists settings (key text primary key, value text);

insert into settings (key, value) values
  ('doctor_name_en',       'Dr. Khaled Nur Zihad'),
  ('doctor_name_bn',       'ডাঃ খালেদ নূর জিহাদ'),
  ('clinic_name_bn',       'ডায়াবেটিস কেয়ার সেন্টার'),
  ('bkash_number',         '01XXXXXXXXX'),
  ('whatsapp_number',      '8801XXXXXXXXX'),
  ('video_fee',            '500'),
  ('in_person_fee',        '500'),
  ('default_call_start',   '20:00'),
  ('default_call_end',     '22:00'),
  ('default_capacity',     '15'),
  ('hold_minutes',         '30'),
  ('reminder_days_before', '2'),
  ('reminder_send_hour',   '10'),   -- Asia/Dhaka, 24h
  ('booking_open',         'true')
on conflict (key) do nothing;

-- =========================
-- SMS TEMPLATE SEED (spec section 7)
-- =========================
insert into sms_templates (key, label_en, body_bn, variables) values
  ('followup_reminder', 'Follow-up reminder (video link)',
   'প্রিয় রোগী, {{date}} তারিখে ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপ। অনলাইনে করতে চাইলে: {{link}}',
   '{date,link}'),
  ('booking_confirmed', 'Booking confirmed',
   'প্রিয় রোগী, পেমেন্ট নিশ্চিত হয়েছে। সিরিয়াল নং {{queue}}। {{date}} তারিখ {{start}}-{{end}} এর মধ্যে WhatsApp এ কল করা হবে।',
   '{queue,date,start,end}'),
  ('payment_not_found', 'Payment not found',
   'প্রিয় রোগী, আপনার পেমেন্ট খুঁজে পাওয়া যায়নি। আবার তথ্য দিন: {{link}}',
   '{link}'),
  ('chamber_reminder', 'Chamber appointment reminder',
   'প্রিয় রোগী, {{date}} তারিখে ডাঃ খালেদ নূর জিহাদ এর চেম্বারে আপনার অ্যাপয়েন্টমেন্ট রয়েছে।',
   '{date}'),
  ('day_cancelled', 'Consultation day cancelled',
   'প্রিয় রোগী, দুঃখিত, {{date}} তারিখে ডাক্তার বসবেন না। যোগাযোগ: {{contact}}',
   '{date,contact}')
on conflict (key) do nothing;

-- =========================
-- ROW LEVEL SECURITY
-- =========================
-- Every table RLS-enabled with a single policy: the authenticated doctor has
-- full access. The service role key (used by all patient-facing route
-- handlers) bypasses RLS entirely. Anonymous browser access gets nothing.
alter table patients        enable row level security;
alter table consult_days    enable row level security;
alter table appointments    enable row level security;
alter table payment_claims  enable row level security;
alter table booking_tokens  enable row level security;
alter table visits          enable row level security;
alter table sms_templates   enable row level security;
alter table sms_campaigns   enable row level security;
alter table sms_log         enable row level security;
alter table settings        enable row level security;

drop policy if exists authenticated_all on patients;
create policy authenticated_all on patients
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on consult_days;
create policy authenticated_all on consult_days
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on appointments;
create policy authenticated_all on appointments
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on payment_claims;
create policy authenticated_all on payment_claims
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on booking_tokens;
create policy authenticated_all on booking_tokens
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on visits;
create policy authenticated_all on visits
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on sms_templates;
create policy authenticated_all on sms_templates
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on sms_campaigns;
create policy authenticated_all on sms_campaigns
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on sms_log;
create policy authenticated_all on sms_log
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on settings;
create policy authenticated_all on settings
  for all to authenticated using (true) with check (true);

commit;

-- END 001_initial.sql

-- ---------------------------------------------------------------------
-- BEGIN 002_patient_serial.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- 002_patient_serial.sql — serial number allocation
--
-- Doctor-registered patients get a serial immediately. Self-registered
-- (pending) patients get one when the doctor accepts them (Phase 8).
-- Both paths call this function, so the sequence is the single source
-- of truth and two concurrent inserts can never collide.
--
-- Format: P-0001, P-0002, ... (matches supabase/seed.sql).
-- Safe to re-run.
-- =====================================================================

create or replace function next_patient_serial() returns text
language sql
volatile
set search_path = public
as $$
  select 'P-' || lpad(nextval('patient_serial_seq')::text, 4, '0');
$$;

grant execute on function next_patient_serial() to authenticated;

-- END 002_patient_serial.sql

-- ---------------------------------------------------------------------
-- BEGIN 003_patient_latest_visits.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- 003_patient_latest_visits.sql — one row per patient: their latest visit
--
-- Used by the Today dashboard for "last HbA1c" in the queue and the
-- "follow-ups overdue" counter. security_invoker means the caller's RLS
-- applies to the underlying tables, exactly as if they queried them.
-- Safe to re-run.
-- =====================================================================

create or replace view patient_latest_visits
with (security_invoker = true) as
select distinct on (v.patient_id)
  v.patient_id,
  v.id          as visit_id,
  v.visit_date,
  v.next_visit_date,
  v.hba1c,
  v.fbs,
  v.weight_kg,
  p.status      as patient_status
from visits v
join patients p on p.id = v.patient_id
order by v.patient_id, v.visit_date desc, v.created_at desc;

grant select on patient_latest_visits to authenticated;

-- END 003_patient_latest_visits.sql

-- ---------------------------------------------------------------------
-- BEGIN 004_followup_requests.sql
-- ---------------------------------------------------------------------
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

-- END 004_followup_requests.sql

-- ---------------------------------------------------------------------
-- BEGIN 005_reset_demo_data.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- 005_reset_demo_data.sql — the demo seed as a database function
--
-- Called by the "Reset demo data" button on /settings. Generated from the
-- same source as supabase/seed.sql; do not edit by hand, regenerate both.
-- security definer so it runs regardless of RLS; only the signed-in doctor
-- can call it. Safe to re-run.
-- =====================================================================

create or replace function reset_demo_data() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- current_date must mean the Dhaka date, not the server's UTC date.
  perform set_config('timezone', 'Asia/Dhaka', true);

  -- Remove previous seed rows (patients cascade to visits, appointments, claims, tokens).
  delete from sms_log where patient_id::text like '00000000-0000-4000-8000-0000000%';

  delete from patients where id::text like '00000000-0000-4000-8000-0000000%';

  -- Online self-registrations that were never accepted are demo leftovers too.
  delete from patients where source = 'online_booking' and status = 'pending';

  delete from consult_days where id::text like '00000000-0000-4000-8000-0000000%';

  delete from followup_requests where true;  -- Supabase rejects DELETE without WHERE

  -- PATIENTS (25)
  insert into patients (id, serial_no, name, phone, sex, age_years, address, diabetes_type, diagnosed_on, comorbidities, status, source, created_at) values
    ('00000000-0000-4000-8000-000000010001', 'P-0001', 'Md. Abdul Karim', '8801384678716', 'M', 58, 'Radhanagar, Pabna Sadar', 'Type 2', current_date - 2230, 'Hypertension', 'active', 'walk_in', current_date - 523),
    ('00000000-0000-4000-8000-000000010002', 'P-0002', 'Rahima Khatun', '8801381205872', 'F', 62, 'Shalgaria, Pabna', 'Type 2', current_date - 1728, 'Hypertension, Osteoarthritis', 'active', 'walk_in', current_date - 512),
    ('00000000-0000-4000-8000-000000010003', 'P-0003', 'Shahidul Islam', '8801902311218', 'M', 45, 'Ishwardi, Pabna', 'Type 2', current_date - 1460, NULL, 'active', 'walk_in', current_date - 522),
    ('00000000-0000-4000-8000-000000010004', 'P-0004', 'Nasrin Akter', '8801351452401', 'F', 36, 'Gopalpur, Pabna', 'Gestational', current_date - 169, NULL, 'active', 'walk_in', current_date - 165),
    ('00000000-0000-4000-8000-000000010005', 'P-0005', 'Mohammad Ali Hossain', '8801967940733', 'M', 67, 'Santhia, Pabna', 'Type 2', current_date - 2817, 'Hypertension, IHD', 'active', 'walk_in', current_date - 514),
    ('00000000-0000-4000-8000-000000010006', 'P-0006', 'Fatema Begum', '8801607956215', 'F', 55, 'Chatmohor, Pabna', 'Type 2', current_date - 1452, 'Dyslipidaemia', 'active', 'walk_in', current_date - 513),
    ('00000000-0000-4000-8000-000000010007', 'P-0007', 'Abu Taher Mia', '8801914361157', 'M', 70, 'Sujanagar, Pabna', 'Type 2', current_date - 2955, 'Hypertension, CKD stage 2', 'active', 'walk_in', current_date - 482),
    ('00000000-0000-4000-8000-000000010008', 'P-0008', 'Shirin Sultana', '8801800391618', 'F', 41, 'Pabna Sadar', 'Type 1', current_date - 4447, 'Hypothyroidism', 'active', 'walk_in', current_date - 523),
    ('00000000-0000-4000-8000-000000010009', 'P-0009', 'Rafiqul Islam', '8801958265940', 'M', 52, 'Bera, Pabna', 'Type 2', current_date - 4036, 'Hypertension', 'active', 'walk_in', current_date - 481),
    ('00000000-0000-4000-8000-000000010010', 'P-0010', 'Hasina Parvin', '8801514873455', 'F', 48, 'Atgharia, Pabna', 'Type 2', current_date - 4596, 'Obesity', 'active', 'walk_in', current_date - 534),
    ('00000000-0000-4000-8000-000000010011', 'P-0011', 'Anwar Hossain', '8801810172345', 'M', 63, 'Dilalpur, Pabna', 'Type 2', current_date - 2968, 'Hypertension, BPH', 'active', 'walk_in', current_date - 537),
    ('00000000-0000-4000-8000-000000010012', 'P-0012', 'Salma Khatun', '8801707111899', 'F', 59, 'Bhangura, Pabna', 'Type 2', current_date - 4347, 'Hypertension', 'active', 'walk_in', current_date - 524),
    ('00000000-0000-4000-8000-000000010013', 'P-0013', 'Jahangir Alam', '8801985063097', 'M', 38, 'Ishwardi, Pabna', 'Type 1', current_date - 1630, NULL, 'active', 'walk_in', current_date - 497),
    ('00000000-0000-4000-8000-000000010014', 'P-0014', 'Rokeya Begum', '8801977470430', 'F', 66, 'Faridpur, Pabna', 'Type 2', current_date - 4314, 'Hypertension, Diabetic retinopathy', 'active', 'walk_in', current_date - 515),
    ('00000000-0000-4000-8000-000000010015', 'P-0015', 'Nurul Amin', '8801770725281', 'M', 49, 'Sathia Bazar, Pabna', 'Type 2', current_date - 3510, NULL, 'active', 'walk_in', current_date - 522),
    ('00000000-0000-4000-8000-000000010016', 'P-0016', 'Taslima Akter', '8801943715018', 'F', 35, 'Kalachandpara, Pabna', 'Gestational', current_date - 146, NULL, 'active', 'walk_in', current_date - 140),
    ('00000000-0000-4000-8000-000000010017', 'P-0017', 'Mizanur Rahman', '8801343632259', 'M', 57, 'Pabna Sadar', 'Type 2', current_date - 4030, 'Dyslipidaemia, Fatty liver', 'active', 'walk_in', current_date - 483),
    ('00000000-0000-4000-8000-000000010018', 'P-0018', 'Sufia Khatun', '8801968870631', 'F', 69, 'Chatmohor, Pabna', 'Type 2', current_date - 1150, 'Hypertension, Osteoarthritis', 'active', 'walk_in', current_date - 527),
    ('00000000-0000-4000-8000-000000010019', 'P-0019', 'Kamrul Hasan', '8801366388950', 'M', 44, 'Ishwardi, Pabna', 'Type 2', current_date - 2782, 'Obesity, Smoker', 'active', 'walk_in', current_date - 508),
    ('00000000-0000-4000-8000-000000010020', 'P-0020', 'Monowara Begum', '8801547493193', 'F', 53, 'Sujanagar, Pabna', 'Type 2', current_date - 4607, 'Hypertension', 'active', 'walk_in', current_date - 540),
    ('00000000-0000-4000-8000-000000010021', 'P-0021', 'Golam Mostafa', '8801696354471', 'M', 61, 'Santhia, Pabna', 'Type 2', current_date - 2108, 'Hypertension', 'active', 'walk_in', current_date - 525),
    ('00000000-0000-4000-8000-000000010022', 'P-0022', 'Rina Rani Das', '8801536535184', 'F', 47, 'Bera, Pabna', 'Type 2', current_date - 751, 'Hypothyroidism', 'active', 'walk_in', current_date - 515),
    ('00000000-0000-4000-8000-000000010023', 'P-0023', 'Bimal Chandra Sarker', '8801913117392', 'M', 65, 'Pabna Sadar', 'Type 2', current_date - 3148, 'Hypertension, Diabetic neuropathy', 'active', 'walk_in', current_date - 501),
    ('00000000-0000-4000-8000-000000010024', 'P-0024', 'Sharmin Jahan', '8801955468318', 'F', 39, 'Atgharia, Pabna', 'Type 2', current_date - 4039, NULL, 'active', 'walk_in', current_date - 486),
    ('00000000-0000-4000-8000-000000010025', 'P-0025', 'Habibur Rahman', '8801360755873', 'M', 54, 'Ishwardi, Pabna', 'Type 2', current_date - 1397, 'Hypertension', 'active', 'walk_in', current_date - 516);

  -- Serial sequence continues after P-0025 (or wherever it already is).
  perform setval('patient_serial_seq', greatest(25, (select last_value from patient_serial_seq)), true);

  -- VISITS (2-5 per patient over the past 18 months)
  insert into visits (id, patient_id, visit_date, mode, weight_kg, height_cm, bp_systolic, bp_diastolic, fbs, hba1c, creatinine, complaints, diagnosis, prescription, advice, fee_charged, payment_method, next_visit_date) values
    ('00000000-0000-4000-8000-000000020001', '00000000-0000-4000-8000-000000010001', current_date - 523, 'in_person', 83.5, 170, 145, 86, 8.9, 9.4, 0.68, 'Tingling in feet, thirst', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date - 418),
    ('00000000-0000-4000-8000-000000020002', '00000000-0000-4000-8000-000000010001', current_date - 418, 'in_person', 81.0, NULL, 142, 89, 7.6, 8.7, 0.75, 'Tingling in feet', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date - 296),
    ('00000000-0000-4000-8000-000000020003', '00000000-0000-4000-8000-000000010001', current_date - 296, 'video', 81.3, NULL, 142, 86, 7.5, 8.4, 0.73, 'Tingling in feet', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Continue diet, check sugar at home, bring diary', 500, 'bkash', current_date - 188),
    ('00000000-0000-4000-8000-000000020004', '00000000-0000-4000-8000-000000010001', current_date - 188, 'in_person', 79.7, NULL, 139, 79, 7.2, 7.8, 0.72, 'Weight gain', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Diet control, walk 30 min daily', 500, 'bkash', current_date - 81),
    ('00000000-0000-4000-8000-000000020005', '00000000-0000-4000-8000-000000010001', current_date - 81, 'in_person', 77.6, NULL, 131, 77, 5.5, 7.1, 0.69, 'Weight gain', 'Type 2 DM, Hypertension', 'Metformin 1000 mg 1+0+1, Sitagliptin 50 mg 1+0+0', 'Diet control, walk 30 min daily', 500, 'cash', current_date + 3),
    ('00000000-0000-4000-8000-000000020006', '00000000-0000-4000-8000-000000010002', current_date - 512, 'in_person', 68.4, 160, 135, 81, 6.6, 7.4, 0.82, 'Tingling in feet, thirst', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 364),
    ('00000000-0000-4000-8000-000000020007', '00000000-0000-4000-8000-000000010002', current_date - 364, 'in_person', 68.3, NULL, 139, 87, 6.2, 7.6, 0.82, 'Fatigue, weakness', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'bkash', current_date - 223),
    ('00000000-0000-4000-8000-000000020008', '00000000-0000-4000-8000-000000010002', current_date - 223, 'in_person', 68.2, NULL, 135, 78, 7.0, 7.7, 0.88, 'Blurred vision', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 86),
    ('00000000-0000-4000-8000-000000020009', '00000000-0000-4000-8000-000000010002', current_date - 86, 'in_person', 69.3, NULL, 137, 81, 7.0, 7.7, 0.81, 'Routine follow-up', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'cash', current_date + 5),
    ('00000000-0000-4000-8000-000000020010', '00000000-0000-4000-8000-000000010003', current_date - 522, 'in_person', 68.1, 165, 132, 79, 6.1, 7.4, 1.00, 'Referred with high RBS', 'Type 2 DM', 'Metformin 500 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'bkash', current_date - 333),
    ('00000000-0000-4000-8000-000000020011', '00000000-0000-4000-8000-000000010003', current_date - 333, 'in_person', 70.5, NULL, 148, 88, 7.2, 8.7, 0.96, 'No complaints', 'Type 2 DM', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 148),
    ('00000000-0000-4000-8000-000000020012', '00000000-0000-4000-8000-000000010003', current_date - 148, 'in_person', 72.9, NULL, 149, 85, 8.8, 9.6, 0.97, 'Blurred vision', 'Type 2 DM', 'Metformin 1000 mg 1+0+1, Glimepiride 2 mg 1+0+0, Insulin Mixtard 30/70 16U-0-10U', 'Diet control, walk 30 min daily', 500, 'bkash', current_date - 58),
    ('00000000-0000-4000-8000-000000020013', '00000000-0000-4000-8000-000000010004', current_date - 165, 'in_person', 66.6, 156, 120, 72, 4.9, 6.6, 0.92, 'High fasting sugar in pregnancy, 26 weeks', 'GDM', 'Diet control, blood sugar diary', 'Continue diet, check FBS and 2h PP daily, bring diary', 500, 'cash', current_date - 98),
    ('00000000-0000-4000-8000-000000020014', '00000000-0000-4000-8000-000000010004', current_date - 98, 'video', 69.4, NULL, 116, 67, 5.4, 6.2, 0.97, 'Sugar diary reviewed, no hypos', 'GDM', 'Diet control, blood sugar diary', 'Diet control, small frequent meals, walk after meals', 500, 'bkash', current_date - 21),
    ('00000000-0000-4000-8000-000000020015', '00000000-0000-4000-8000-000000010004', current_date - 21, 'in_person', 69.2, NULL, 113, 66, 4.7, 5.9, 0.95, 'Sugar diary reviewed, no hypos', 'GDM', 'Diet control, Insulin Actrapid 6U before meals if FBS > 5.3', 'Continue diet, check FBS and 2h PP daily, bring diary', 500, 'cash', current_date + 7),
    ('00000000-0000-4000-8000-000000020016', '00000000-0000-4000-8000-000000010005', current_date - 514, 'in_person', 68.8, 172, 141, 86, 5.9, 7.2, 0.75, 'Tingling in feet, thirst', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 406),
    ('00000000-0000-4000-8000-000000020017', '00000000-0000-4000-8000-000000010005', current_date - 406, 'video', 69.0, NULL, 138, 87, 5.9, 7.3, 0.75, 'Routine follow-up', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'bkash', current_date - 292),
    ('00000000-0000-4000-8000-000000020018', '00000000-0000-4000-8000-000000010005', current_date - 292, 'in_person', 68.7, NULL, 136, 79, 6.8, 7.5, 0.76, 'Tingling in feet', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 190),
    ('00000000-0000-4000-8000-000000020019', '00000000-0000-4000-8000-000000010005', current_date - 190, 'in_person', 68.4, NULL, 136, 86, 6.5, 7.6, 0.73, 'Blurred vision', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'cash', current_date - 81),
    ('00000000-0000-4000-8000-000000020020', '00000000-0000-4000-8000-000000010005', current_date - 81, 'video', 69.9, NULL, 139, 84, 6.7, 7.8, 0.71, 'Tingling in feet', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Diet control, walk 30 min daily', 500, 'bkash', current_date + 10),
    ('00000000-0000-4000-8000-000000020021', '00000000-0000-4000-8000-000000010006', current_date - 513, 'in_person', 81.6, 151, 151, 95, 7.9, 9.2, 0.90, 'Polyuria, polydipsia, weight loss', 'Type 2 DM, Dyslipidaemia', 'Metformin 850 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 372),
    ('00000000-0000-4000-8000-000000020022', '00000000-0000-4000-8000-000000010006', current_date - 372, 'in_person', 81.1, NULL, 147, 92, 7.3, 8.4, 0.95, 'Polyuria, polydipsia', 'Type 2 DM, Dyslipidaemia', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 221),
    ('00000000-0000-4000-8000-000000020023', '00000000-0000-4000-8000-000000010006', current_date - 221, 'video', 78.4, NULL, 138, 87, 6.9, 8.0, 0.92, 'Tingling in feet', 'Type 2 DM, Dyslipidaemia', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Reduce rice portion, check FBS weekly', 500, 'bkash', current_date - 86),
    ('00000000-0000-4000-8000-000000020024', '00000000-0000-4000-8000-000000010006', current_date - 86, 'in_person', 77.0, NULL, 137, 86, 6.4, 7.1, 0.91, 'Routine follow-up, sugar diary reviewed', 'Type 2 DM, Dyslipidaemia', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'bkash', current_date + 12),
    ('00000000-0000-4000-8000-000000020025', '00000000-0000-4000-8000-000000010007', current_date - 482, 'in_person', 67.9, 171, 130, 78, 6.3, 7.4, 1.43, 'Referred with high RBS', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 378),
    ('00000000-0000-4000-8000-000000020026', '00000000-0000-4000-8000-000000010007', current_date - 378, 'in_person', 68.9, NULL, 137, 85, 7.3, 7.9, 1.43, 'Weight gain', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 288),
    ('00000000-0000-4000-8000-000000020027', '00000000-0000-4000-8000-000000010007', current_date - 288, 'in_person', 69.6, NULL, 140, 86, 7.8, 8.8, 1.42, 'Routine follow-up, sugar diary reviewed', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 178),
    ('00000000-0000-4000-8000-000000020028', '00000000-0000-4000-8000-000000010007', current_date - 178, 'in_person', 70.8, NULL, 144, 89, 8.3, 9.2, 1.43, 'Tingling in feet', 'Type 2 DM, Hypertension', 'Metformin 1000 mg 1+0+1, Sitagliptin 50 mg 1+0+0', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 84),
    ('00000000-0000-4000-8000-000000020029', '00000000-0000-4000-8000-000000010007', current_date - 84, 'in_person', 71.1, NULL, 154, 96, 9.0, 9.7, 1.38, 'Routine follow-up', 'Type 2 DM, Hypertension', 'Metformin 1000 mg 1+0+1, Glimepiride 2 mg 1+0+0, Insulin Mixtard 30/70 16U-0-10U', 'Foot care, avoid barefoot walking', 500, 'cash', current_date + 14),
    ('00000000-0000-4000-8000-000000020030', '00000000-0000-4000-8000-000000010008', current_date - 523, 'in_person', 59.1, 160, 118, 75, 7.3, 7.9, 1.15, 'Referred from medicine OPD, on insulin', 'Type 1 DM', 'Insulin Mixtard 30/70 18U-0-12U', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 366),
    ('00000000-0000-4000-8000-000000020031', '00000000-0000-4000-8000-000000010008', current_date - 366, 'video', 59.0, NULL, 121, 76, 6.8, 7.6, 1.15, 'Routine follow-up', 'Type 1 DM', 'Insulin Mixtard 30/70 18U-0-12U', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'bkash', current_date - 220),
    ('00000000-0000-4000-8000-000000020032', '00000000-0000-4000-8000-000000010008', current_date - 220, 'in_person', 60.6, NULL, 116, 74, 6.9, 8.0, 1.09, 'No complaints', 'Type 1 DM', 'Insulin Mixtard 30/70 20U-0-14U', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 74),
    ('00000000-0000-4000-8000-000000020033', '00000000-0000-4000-8000-000000010008', current_date - 74, 'in_person', 59.7, NULL, 116, 70, 6.5, 8.1, 1.07, 'Fatigue, weakness', 'Type 1 DM', 'Insulin Mixtard 30/70 20U-0-14U', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date + 17),
    ('00000000-0000-4000-8000-000000020034', '00000000-0000-4000-8000-000000010009', current_date - 481, 'in_person', 80.9, 171, 149, 88, 9.0, 9.6, 1.09, 'Tingling in feet, thirst', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'bkash', current_date - 355),
    ('00000000-0000-4000-8000-000000020035', '00000000-0000-4000-8000-000000010009', current_date - 355, 'video', 78.8, NULL, 141, 82, 7.7, 8.7, 1.08, 'Routine follow-up, sugar diary reviewed', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'bkash', current_date - 224),
    ('00000000-0000-4000-8000-000000020036', '00000000-0000-4000-8000-000000010009', current_date - 224, 'in_person', 76.2, NULL, 145, 83, 6.0, 7.7, 1.06, 'No complaints', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 85),
    ('00000000-0000-4000-8000-000000020037', '00000000-0000-4000-8000-000000010009', current_date - 85, 'in_person', 75.0, NULL, 138, 83, 5.4, 6.9, 1.07, 'No complaints', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Foot care, avoid barefoot walking', 500, 'cash', current_date + 5),
    ('00000000-0000-4000-8000-000000020038', '00000000-0000-4000-8000-000000010010', current_date - 534, 'in_person', 73.0, 157, 137, 84, 6.6, 7.5, 0.99, 'Tingling in feet, thirst', 'Type 2 DM, Obesity', 'Metformin 500 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'bkash', current_date - 300),
    ('00000000-0000-4000-8000-000000020039', '00000000-0000-4000-8000-000000010010', current_date - 300, 'video', 73.4, NULL, 144, 83, 7.8, 8.5, 0.96, 'Fatigue, weakness', 'Type 2 DM, Obesity', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Foot care, avoid barefoot walking', 500, 'bkash', current_date - 65),
    ('00000000-0000-4000-8000-000000020040', '00000000-0000-4000-8000-000000010010', current_date - 65, 'in_person', 76.3, NULL, 149, 87, 8.3, 9.7, 0.92, 'Fatigue, weakness', 'Type 2 DM, Obesity', 'Metformin 1000 mg 1+0+1, Glimepiride 2 mg 1+0+0, Insulin Mixtard 30/70 16U-0-10U', 'Reduce rice portion, check FBS weekly', 500, 'bkash', current_date + 19),
    ('00000000-0000-4000-8000-000000020041', '00000000-0000-4000-8000-000000010011', current_date - 537, 'in_person', 66.3, 168, 134, 78, 6.7, 7.4, 0.75, 'Polyuria, polydipsia, weight loss', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'bkash', current_date - 389),
    ('00000000-0000-4000-8000-000000020042', '00000000-0000-4000-8000-000000010011', current_date - 389, 'in_person', 66.5, NULL, 143, 86, 6.3, 7.6, 0.76, 'Polyuria, polydipsia', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'bkash', current_date - 227),
    ('00000000-0000-4000-8000-000000020043', '00000000-0000-4000-8000-000000010011', current_date - 227, 'in_person', 66.7, NULL, 135, 80, 6.6, 7.7, 0.76, 'Blurred vision', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 72),
    ('00000000-0000-4000-8000-000000020044', '00000000-0000-4000-8000-000000010011', current_date - 72, 'video', 66.1, NULL, 140, 81, 6.2, 7.6, 0.76, 'Polyuria, polydipsia', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'bkash', NULL),
    ('00000000-0000-4000-8000-000000020045', '00000000-0000-4000-8000-000000010012', current_date - 524, 'in_person', 80.8, 156, 146, 86, 8.6, 9.4, 1.06, 'Referred with high RBS', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 408),
    ('00000000-0000-4000-8000-000000020046', '00000000-0000-4000-8000-000000010012', current_date - 408, 'in_person', 78.6, NULL, 149, 91, 8.1, 9.0, 0.98, 'Tingling in feet', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'bkash', current_date - 303),
    ('00000000-0000-4000-8000-000000020047', '00000000-0000-4000-8000-000000010012', current_date - 303, 'in_person', 77.4, NULL, 138, 82, 7.0, 8.2, 1.01, 'Polyuria, polydipsia', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 190),
    ('00000000-0000-4000-8000-000000020048', '00000000-0000-4000-8000-000000010012', current_date - 190, 'in_person', 75.7, NULL, 137, 85, 7.0, 7.8, 1.02, 'Polyuria, polydipsia', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 70),
    ('00000000-0000-4000-8000-000000020049', '00000000-0000-4000-8000-000000010012', current_date - 70, 'in_person', 74.8, NULL, 137, 86, 5.6, 7.3, 1.01, 'Fatigue, weakness', 'Type 2 DM, Hypertension', 'Metformin 1000 mg 1+0+1, Sitagliptin 50 mg 1+0+0', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date + 21),
    ('00000000-0000-4000-8000-000000020050', '00000000-0000-4000-8000-000000010013', current_date - 497, 'in_person', 56.7, 166, 119, 71, 8.3, 9.6, 0.89, 'Referred from medicine OPD, on insulin', 'Type 1 DM', 'Insulin Mixtard 30/70 18U-0-12U', 'Foot care, avoid barefoot walking', 0, 'free', current_date - 353),
    ('00000000-0000-4000-8000-000000020051', '00000000-0000-4000-8000-000000010013', current_date - 353, 'in_person', 56.7, NULL, 120, 75, 7.4, 8.9, 0.86, 'Routine follow-up', 'Type 1 DM', 'Insulin Mixtard 30/70 18U-0-12U', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 203),
    ('00000000-0000-4000-8000-000000020052', '00000000-0000-4000-8000-000000010013', current_date - 203, 'in_person', 58.7, NULL, 121, 71, 7.1, 8.1, 0.85, 'Fatigue, weakness', 'Type 1 DM', 'Insulin Mixtard 30/70 20U-0-14U', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 66),
    ('00000000-0000-4000-8000-000000020053', '00000000-0000-4000-8000-000000010013', current_date - 66, 'in_person', 59.0, NULL, 125, 78, 6.0, 7.3, 0.90, 'No complaints', 'Type 1 DM', 'Insulin Mixtard 30/70 20U-0-14U', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'bkash', current_date + 24),
    ('00000000-0000-4000-8000-000000020054', '00000000-0000-4000-8000-000000010014', current_date - 515, 'in_person', 69.6, 155, 138, 82, 6.8, 7.5, 0.89, 'Fatigue, frequent urination', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date - 374),
    ('00000000-0000-4000-8000-000000020055', '00000000-0000-4000-8000-000000010014', current_date - 374, 'in_person', 71.4, NULL, 140, 84, 7.6, 8.5, 0.89, 'Polyuria, polydipsia', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 224),
    ('00000000-0000-4000-8000-000000020056', '00000000-0000-4000-8000-000000010014', current_date - 224, 'video', 71.7, NULL, 143, 82, 8.2, 9.0, 0.88, 'Polyuria, polydipsia', 'Type 2 DM, Hypertension', 'Metformin 1000 mg 1+0+1, Sitagliptin 50 mg 1+0+0', 'Foot care, avoid barefoot walking', 500, 'bkash', current_date - 75),
    ('00000000-0000-4000-8000-000000020057', '00000000-0000-4000-8000-000000010014', current_date - 75, 'in_person', 73.8, NULL, 146, 84, 8.8, 9.8, 0.86, 'Routine follow-up, sugar diary reviewed', 'Type 2 DM, Hypertension', 'Metformin 1000 mg 1+0+1, Glimepiride 2 mg 1+0+0, Insulin Mixtard 30/70 16U-0-10U', 'Foot care, avoid barefoot walking', 500, 'bkash', current_date + 9),
    ('00000000-0000-4000-8000-000000020058', '00000000-0000-4000-8000-000000010015', current_date - 522, 'in_person', 75.0, 164, 138, 79, 7.0, 7.6, 0.94, 'Polyuria, polydipsia, weight loss', 'Type 2 DM', 'Metformin 500 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'cash', current_date - 134),
    ('00000000-0000-4000-8000-000000020059', '00000000-0000-4000-8000-000000010015', current_date - 134, 'in_person', 76.8, NULL, 143, 83, 6.7, 7.7, 0.95, 'Polyuria, polydipsia', 'Type 2 DM', 'Metformin 500 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 44),
    ('00000000-0000-4000-8000-000000020060', '00000000-0000-4000-8000-000000010016', current_date - 140, 'in_person', 70.2, 152, 121, 69, 5.1, 6.8, 0.79, 'Referred by obstetrician, raised OGTT at 24 weeks', 'GDM', 'Diet control, blood sugar diary', 'Continue diet, check FBS and 2h PP daily, bring diary', 500, 'cash', current_date - 8),
    ('00000000-0000-4000-8000-000000020061', '00000000-0000-4000-8000-000000010016', current_date - 8, 'in_person', 74.2, NULL, 112, 63, 4.2, 5.5, 0.75, 'Routine antenatal review, sugar diary reviewed', 'GDM', 'Diet control, blood sugar diary', 'Diet control, small frequent meals, walk after meals', 500, 'cash', current_date + 27),
    ('00000000-0000-4000-8000-000000020062', '00000000-0000-4000-8000-000000010017', current_date - 483, 'in_person', 74.4, 162, 151, 89, 8.4, 9.2, 0.98, 'Fatigue, frequent urination', 'Type 2 DM, Dyslipidaemia', 'Metformin 850 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 377),
    ('00000000-0000-4000-8000-000000020063', '00000000-0000-4000-8000-000000010017', current_date - 377, 'in_person', 72.0, NULL, 146, 89, 7.2, 8.7, 0.98, 'No complaints', 'Type 2 DM, Dyslipidaemia', 'Metformin 850 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 262),
    ('00000000-0000-4000-8000-000000020064', '00000000-0000-4000-8000-000000010017', current_date - 262, 'in_person', 71.8, NULL, 146, 84, 6.8, 8.4, 0.98, 'Blurred vision', 'Type 2 DM, Dyslipidaemia', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Diet control, walk 30 min daily', 500, 'cash', current_date - 162),
    ('00000000-0000-4000-8000-000000020065', '00000000-0000-4000-8000-000000010017', current_date - 162, 'in_person', 69.9, NULL, 135, 81, 6.3, 7.5, 1.03, 'Fatigue, weakness', 'Type 2 DM, Dyslipidaemia', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Diet control, walk 30 min daily', 500, 'cash', current_date - 54),
    ('00000000-0000-4000-8000-000000020066', '00000000-0000-4000-8000-000000010017', current_date - 54, 'in_person', 69.8, NULL, 133, 84, 5.7, 7.2, 1.00, 'Blurred vision', 'Type 2 DM, Dyslipidaemia', 'Metformin 1000 mg 1+0+1, Sitagliptin 50 mg 1+0+0', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date + 30),
    ('00000000-0000-4000-8000-000000020067', '00000000-0000-4000-8000-000000010018', current_date - 527, 'in_person', 74.7, 162, 142, 84, 5.9, 7.6, 1.03, 'Tingling in feet, thirst', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 308),
    ('00000000-0000-4000-8000-000000020068', '00000000-0000-4000-8000-000000010018', current_date - 308, 'in_person', 73.2, NULL, 136, 83, 7.0, 7.7, 1.01, 'Routine follow-up', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date - 89),
    ('00000000-0000-4000-8000-000000020069', '00000000-0000-4000-8000-000000010018', current_date - 89, 'video', 73.4, NULL, 138, 83, 6.4, 7.6, 1.09, 'Routine follow-up', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'bkash', NULL),
    ('00000000-0000-4000-8000-000000020070', '00000000-0000-4000-8000-000000010019', current_date - 508, 'in_person', 67.8, 171, 135, 85, 6.6, 7.4, 0.96, 'Tingling in feet, thirst', 'Type 2 DM, Obesity', 'Metformin 500 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'bkash', current_date - 288),
    ('00000000-0000-4000-8000-000000020071', '00000000-0000-4000-8000-000000010019', current_date - 288, 'in_person', 69.2, NULL, 146, 92, 7.8, 8.8, 0.91, 'No complaints', 'Type 2 DM, Obesity', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 57),
    ('00000000-0000-4000-8000-000000020072', '00000000-0000-4000-8000-000000010019', current_date - 57, 'in_person', 71.5, NULL, 147, 87, 9.2, 10.0, 0.94, 'Weight gain', 'Type 2 DM, Obesity', 'Metformin 1000 mg 1+0+1, Glimepiride 2 mg 1+0+0, Insulin Mixtard 30/70 16U-0-10U', 'Foot care, avoid barefoot walking', 500, 'cash', current_date + 33),
    ('00000000-0000-4000-8000-000000020073', '00000000-0000-4000-8000-000000010020', current_date - 540, 'in_person', 81.6, 151, 155, 90, 8.0, 9.4, 0.69, 'Referred with high RBS', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 381),
    ('00000000-0000-4000-8000-000000020074', '00000000-0000-4000-8000-000000010020', current_date - 381, 'in_person', 78.6, NULL, 143, 86, 7.2, 8.5, 0.75, 'Routine follow-up', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'cash', current_date - 226),
    ('00000000-0000-4000-8000-000000020075', '00000000-0000-4000-8000-000000010020', current_date - 226, 'in_person', 77.3, NULL, 136, 81, 7.3, 7.9, 0.76, 'Weight gain', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 61),
    ('00000000-0000-4000-8000-000000020076', '00000000-0000-4000-8000-000000010020', current_date - 61, 'in_person', 76.4, NULL, 130, 74, 5.6, 7.1, 0.79, 'Routine follow-up', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Diet control, walk 30 min daily', 500, 'cash', current_date + 37),
    ('00000000-0000-4000-8000-000000020077', '00000000-0000-4000-8000-000000010021', current_date - 525, 'in_person', 71.1, 164, 142, 89, 5.7, 7.3, 0.96, 'Tingling in feet, thirst', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 276),
    ('00000000-0000-4000-8000-000000020078', '00000000-0000-4000-8000-000000010021', current_date - 276, 'in_person', 71.2, NULL, 140, 83, 6.8, 7.5, 0.94, 'Routine follow-up', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'cash', current_date - 32),
    ('00000000-0000-4000-8000-000000020079', '00000000-0000-4000-8000-000000010021', current_date - 32, 'in_person', 72.8, NULL, 138, 79, 6.0, 7.5, 1.00, 'No complaints', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'cash', NULL),
    ('00000000-0000-4000-8000-000000020080', '00000000-0000-4000-8000-000000010022', current_date - 515, 'in_person', 71.7, 153, 154, 91, 7.9, 9.4, 0.85, 'Fatigue, frequent urination', 'Type 2 DM, Hypothyroidism', 'Metformin 850 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 362),
    ('00000000-0000-4000-8000-000000020081', '00000000-0000-4000-8000-000000010022', current_date - 362, 'in_person', 70.1, NULL, 149, 89, 7.9, 8.7, 0.90, 'Routine follow-up', 'Type 2 DM, Hypothyroidism', 'Metformin 850 mg 1+0+1', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 194),
    ('00000000-0000-4000-8000-000000020082', '00000000-0000-4000-8000-000000010022', current_date - 194, 'in_person', 68.2, NULL, 140, 80, 6.8, 7.8, 0.85, 'No complaints', 'Type 2 DM, Hypothyroidism', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date - 43),
    ('00000000-0000-4000-8000-000000020083', '00000000-0000-4000-8000-000000010022', current_date - 43, 'in_person', 68.0, NULL, 135, 85, 5.8, 7.0, 0.87, 'Blurred vision', 'Type 2 DM, Hypothyroidism', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Foot care, avoid barefoot walking', 500, 'bkash', current_date + 41),
    ('00000000-0000-4000-8000-000000020084', '00000000-0000-4000-8000-000000010023', current_date - 501, 'in_person', 69.7, 171, 139, 81, 6.3, 7.4, 0.86, 'Fatigue, frequent urination', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Avoid sugar and white rice at night, walk 30 min daily', 500, 'cash', current_date - 406),
    ('00000000-0000-4000-8000-000000020085', '00000000-0000-4000-8000-000000010023', current_date - 406, 'in_person', 71.3, NULL, 134, 84, 7.5, 8.1, 0.86, 'Blurred vision', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date - 310),
    ('00000000-0000-4000-8000-000000020086', '00000000-0000-4000-8000-000000010023', current_date - 310, 'in_person', 72.3, NULL, 144, 82, 7.7, 8.6, 0.84, 'Tingling in feet', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1, Glimepiride 2 mg 1+0+0', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 220),
    ('00000000-0000-4000-8000-000000020087', '00000000-0000-4000-8000-000000010023', current_date - 220, 'in_person', 73.2, NULL, 141, 86, 7.9, 9.3, 0.80, 'Fatigue, weakness', 'Type 2 DM, Hypertension', 'Metformin 1000 mg 1+0+1, Sitagliptin 50 mg 1+0+0', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date - 132),
    ('00000000-0000-4000-8000-000000020088', '00000000-0000-4000-8000-000000010023', current_date - 132, 'in_person', 73.8, NULL, 150, 88, 9.4, 10.0, 0.87, 'Routine follow-up, sugar diary reviewed', 'Type 2 DM, Hypertension', 'Metformin 1000 mg 1+0+1, Glimepiride 2 mg 1+0+0, Insulin Mixtard 30/70 16U-0-10U', 'Foot care, avoid barefoot walking', 500, 'cash', current_date - 42),
    ('00000000-0000-4000-8000-000000020089', '00000000-0000-4000-8000-000000010024', current_date - 486, 'in_person', 68.5, 153, 142, 86, 6.1, 7.4, 0.96, 'Polyuria, polydipsia, weight loss', 'Type 2 DM', 'Metformin 500 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'cash', current_date - 42),
    ('00000000-0000-4000-8000-000000020090', '00000000-0000-4000-8000-000000010024', current_date - 42, 'in_person', 68.7, NULL, 143, 87, 6.7, 7.4, 1.01, 'Weight gain', 'Type 2 DM', 'Metformin 500 mg 1+0+1', 'Continue diet, check sugar at home, bring diary', 500, 'cash', NULL),
    ('00000000-0000-4000-8000-000000020091', '00000000-0000-4000-8000-000000010025', current_date - 516, 'in_person', 74.4, 165, 140, 83, 6.7, 7.4, 1.04, 'Tingling in feet, thirst', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Reduce rice portion, check FBS weekly', 500, 'cash', current_date - 296),
    ('00000000-0000-4000-8000-000000020092', '00000000-0000-4000-8000-000000010025', current_date - 296, 'in_person', 75.9, NULL, 138, 86, 6.2, 7.3, 1.12, 'Fatigue, weakness', 'Type 2 DM, Hypertension', 'Metformin 500 mg 1+0+1', 'Continue diet, check sugar at home, bring diary', 500, 'cash', current_date - 70),
    ('00000000-0000-4000-8000-000000020093', '00000000-0000-4000-8000-000000010025', current_date - 70, 'in_person', 74.3, NULL, 133, 76, 6.3, 7.6, 1.11, 'Polyuria, polydipsia', 'Type 2 DM, Hypertension', 'Metformin 850 mg 1+0+1', 'Diet control, walk 30 min daily', 500, 'cash', NULL);

  -- CONSULT DAYS (6 video days over the next 3 weeks). A real row for the same date wins.
  insert into consult_days (id, date, mode, call_start, call_end, capacity, is_open_for_new, note) values
    ('00000000-0000-4000-8000-000000030001', current_date + 2, 'video', '20:00', '22:00', 15, true, 'Demo day, open to new patients'),
    ('00000000-0000-4000-8000-000000030002', current_date + 5, 'video', '20:00', '22:00', 15, true, 'Demo day, open to new patients'),
    ('00000000-0000-4000-8000-000000030003', current_date + 9, 'video', '20:00', '22:00', 15, false, 'Demo day'),
    ('00000000-0000-4000-8000-000000030004', current_date + 12, 'video', '20:00', '22:00', 15, true, 'Demo day, open to new patients'),
    ('00000000-0000-4000-8000-000000030005', current_date + 16, 'video', '20:00', '22:00', 15, false, 'Demo day'),
    ('00000000-0000-4000-8000-000000030006', current_date + 19, 'video', '20:00', '22:00', 15, false, 'Demo day')
  on conflict (date, mode) do nothing;

  -- APPOINTMENTS awaiting payment verification (3) + matching claims
  insert into appointments (id, patient_id, scheduled_date, queue_no, mode, status, booking_source, fee_amount, hold_expires_at, created_at) values
    ('00000000-0000-4000-8000-000000040001', '00000000-0000-4000-8000-000000010009', current_date + 5, 1, 'video', 'pending_review', 'followup_link', 500, NULL, current_date - 1 + time '19:35'),
    ('00000000-0000-4000-8000-000000040002', '00000000-0000-4000-8000-000000010003', current_date + 2, 1, 'video', 'pending_review', 'open_link', 500, NULL, current_date - 1 + time '19:40'),
    ('00000000-0000-4000-8000-000000040003', '00000000-0000-4000-8000-000000010014', current_date + 9, 1, 'video', 'pending_review', 'open_link', 500, NULL, current_date - 1 + time '19:45');

  insert into payment_claims (id, appointment_id, claimed_name, trx_id, sender_phone, amount, status, created_at) values
    ('00000000-0000-4000-8000-000000050001', '00000000-0000-4000-8000-000000040001', 'Rafiqul Islam', 'BKX7H2M9QA', NULL, 500, 'submitted', current_date - 1 + time '19:37'),
    ('00000000-0000-4000-8000-000000050002', '00000000-0000-4000-8000-000000040002', 'Shahidul Islam', NULL, '8801811223344', 500, 'submitted', current_date - 1 + time '19:42'),
    ('00000000-0000-4000-8000-000000050003', '00000000-0000-4000-8000-000000040003', 'Rokeya Begum', 'CJ4N8P1TZK', '8801933445566', 500, 'submitted', current_date - 1 + time '19:47');

end $$;

revoke all on function reset_demo_data() from public;
grant execute on function reset_demo_data() to authenticated;

-- END 005_reset_demo_data.sql

-- ---------------------------------------------------------------------
-- BEGIN 006_patient_latest_visits_v2.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- 006_patient_latest_visits_v2.sql — latest visit per patient, with the
-- patient's own columns alongside
--
-- The Messages page and the patient list filters (follow-up overdue, due
-- soon, not seen for months) need the patient's name, phone and serial in
-- the same row as their latest visit, so they are one query instead of an
-- id list followed by a second lookup.
--
-- Dropped and re-created rather than replaced, because Postgres will not
-- add columns to an existing view except at the end. Nothing depends on
-- this view. Safe to re-run.
-- =====================================================================

drop view if exists patient_latest_visits;

create view patient_latest_visits
with (security_invoker = true) as
select distinct on (v.patient_id)
  v.patient_id,
  v.id            as visit_id,
  v.visit_date,
  v.next_visit_date,
  v.hba1c,
  v.fbs,
  v.weight_kg,
  p.status        as patient_status,
  p.name,
  p.phone,
  p.serial_no,
  p.sex,
  p.date_of_birth,
  p.age_years,
  p.diabetes_type
from visits v
join patients p on p.id = v.patient_id
order by v.patient_id, v.visit_date desc, v.created_at desc;

grant select on patient_latest_visits to authenticated;

-- END 006_patient_latest_visits_v2.sql

-- =====================================================================
-- 007_followup_link_uses_and_texts.sql — reusable follow-up links and a
-- starter set of saved SMS texts
--
-- A follow-up link used to die the moment a patient tapped "confirm", so
-- anyone who came back to the SMS to finish paying saw "link expired".
-- The link now works up to 7 opens (and still until the day after the
-- follow-up date). The count lives on the token row.
--
-- The saved texts are ordinary custom_* templates: they show up on the
-- Messages page as one-tap texts and the doctor can delete or replace them.
-- Safe to re-run.
-- =====================================================================

alter table booking_tokens
  add column if not exists use_count int not null default 0;

insert into sms_templates (key, label_en, body_bn, variables) values
  ('custom_seed_eid', 'Eid holiday',
   'প্রিয় রোগী, ঈদ উপলক্ষে চেম্বার কয়েকদিন বন্ধ থাকবে। জরুরি প্রয়োজনে যোগাযোগ করুন। ঈদ মোবারক।',
   '{}'),
  ('custom_seed_closed', 'Chamber closed today',
   'প্রিয় রোগী, অনিবার্য কারণে আজ চেম্বার বন্ধ থাকবে। অসুবিধার জন্য দুঃখিত।',
   '{}'),
  ('custom_seed_reports', 'Bring your reports',
   'প্রিয় রোগী, পরবর্তী ভিজিটে আপনার সব পরীক্ষার রিপোর্ট ও ওষুধের তালিকা সাথে আনবেন।',
   '{}'),
  ('custom_seed_hba1c', 'HbA1c test due',
   'প্রিয় রোগী, ৩ মাস পর পর HbA1c পরীক্ষা করা জরুরি। পরীক্ষা করিয়ে রিপোর্ট নিয়ে দেখা করুন।',
   '{}'),
  ('custom_seed_overdue', 'Follow-up overdue',
   'প্রিয় রোগী, আপনার ফলোআপের সময় পার হয়ে গেছে। দ্রুত চেম্বারে আসুন বা অনলাইনে সিরিয়াল নিন।',
   '{}'),
  ('custom_seed_medicine', 'Keep taking medicine',
   'প্রিয় রোগী, ডাক্তারের পরামর্শ ছাড়া ওষুধ বন্ধ করবেন না। নিয়মিত ওষুধ খান ও সুগার মাপুন।',
   '{}'),
  ('custom_seed_fasting', 'Come fasting',
   'প্রিয় রোগী, পরীক্ষার জন্য সকালে খালি পেটে আসবেন। পানি ছাড়া কিছু খাবেন না।',
   '{}'),
  ('custom_seed_late', 'Calls running late',
   'প্রিয় রোগী, আজকের ভিডিও কল কিছুটা দেরিতে শুরু হবে। অনুগ্রহ করে অপেক্ষা করুন, ধন্যবাদ।',
   '{}')
on conflict (key) do nothing;

-- END 007_followup_link_uses_and_texts.sql
