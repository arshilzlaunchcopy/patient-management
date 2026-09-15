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
