# Diabetes Clinic Management System — Build Spec v3

**Practice:** Dr. Khaled Nur Zihad (ডাঃ খালেদ নূর জিহাদ), diabetology, Pabna.
**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + Supabase + **Netlify**.
**Languages:** Dashboard and clinical records in English. All patient-facing pages and SMS in Bangla, with no patient name — always "প্রিয় রোগী".

---

## 0. What changed from v2

**No time picker anywhere.** Patients book a *date*. The doctor sets a call window for that date, and the SMS tells them "you'll receive a call between 8pm and 10pm". This is a much better fit — it matches how the chamber already works, it removes the whole slot-collision problem, and it means a patient who steps out for an hour hasn't missed a fixed appointment.

**Queue numbers replace slots.** Booking order on a given date determines the serial number, exactly like the paper queue in the chamber. First booking that day is সিরিয়াল ১, and the doctor calls down the list.

**Date selection is asymmetric, on purpose:**
- **New patients** pick from a list of dates the doctor has explicitly opened.
- **Returning patients** don't pick at all. Their follow-up date was set during their last visit; the link only lets them confirm and pay for that specific day.

**No calendar widget on the patient side.** A month grid is the wrong control on a 360px screen for a user who just wants the next available day. It's a horizontal row of date chips instead. The full calendar stays on the doctor's dashboard.

**No `{{name}}` in SMS or on patient pages.** Everything addresses "প্রিয় রোগী". Shorter messages (saves an SMS segment in some cases), and a forwarded link leaks nothing.

---

## 1. Netlify notes

Netlify is the better choice here for a reason beyond preference: **its free tier permits commercial use**, which Vercel's Hobby plan does not. That alone settles it for a medical practice.

Free tier gives 100 GB bandwidth, 300 build minutes, and 125,000 function invocations per month — vastly more than this app will touch.

**Cron.** <cite index="12-1">Netlify Scheduled Functions are available on all pricing plans and enabled by default for all accounts.</cite> Unlike Vercel Hobby's once-daily cap, you can run hourly — which is what makes the configurable "send reminders at 10am" setting actually implementable.

**One important build gotcha:** <cite index="13-1">with Netlify's Next.js Runtime v5 (Next.js 13.5+), scheduled functions written as Next.js API routes are deprecated — you must use regular framework-agnostic Netlify Functions instead.</cite> So the reminder job does **not** live in `app/api/`. It goes in `netlify/functions/reminders.mts`:

```ts
// netlify/functions/reminders.mts
import type { Config } from "@netlify/functions";

export default async () => {
  // read settings, find due reminders, send
};

export const config: Config = { schedule: "0 * * * *" };  // hourly
```

<cite index="19-1">Cron expressions run in UTC</cite>, so the function runs every hour and compares the current Asia/Dhaka hour against the `reminder_send_hour` setting, exiting immediately if it doesn't match. Dhaka is UTC+6 with no DST, so this is a simple offset.

Setup: `npm i -D @netlify/plugin-nextjs`, env vars in the Netlify dashboard, connect the repo, done.

---

## 2. Database schema

```sql
-- =========================
-- PATIENTS
-- =========================
create table patients (
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

create index on patients (phone);
create index on patients (status);
create sequence patient_serial_seq start 1;

-- =========================
-- CONSULT DAYS  (replaces slot_rules + slot_blackouts)
-- =========================
-- One row per date the doctor runs consultations.
create table consult_days (
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

create index on consult_days (date);
```

**How `is_open_for_new` works.** A returning patient booking their own follow-up date does not need that date to be open — the doctor set that date himself. So when he saves a `next_visit_date` on a visit, the app **auto-creates a `consult_days` row** for that date if one doesn't exist, with `is_open_for_new = false` and the default call window. That guarantees every bookable date has a call window, while keeping the doctor in full control of which dates strangers can see.

```sql
-- =========================
-- APPOINTMENTS
-- =========================
create table appointments (
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

create index on appointments (scheduled_date, status);
create index on appointments (patient_id);

-- Queue numbers are unique within a date+mode
create unique index uniq_queue
  on appointments (scheduled_date, mode, queue_no)
  where queue_no is not null;

-- One live booking per patient per date
create unique index uniq_patient_day
  on appointments (patient_id, scheduled_date)
  where status in ('hold','pending_review','scheduled');
```

### Queue number assignment

Assigned at the moment payment proof is submitted, not when the hold is created — so abandoned bookings don't eat numbers. Race-safe via an advisory lock:

```sql
create or replace function assign_queue_no(p_appt uuid) returns int as $$
declare v_date date; v_mode text; v_no int;
begin
  select scheduled_date, mode into v_date, v_mode
    from appointments where id = p_appt;

  perform pg_advisory_xact_lock(hashtext(v_date::text || v_mode));

  select coalesce(max(queue_no), 0) + 1 into v_no
    from appointments
   where scheduled_date = v_date and mode = v_mode and queue_no is not null;

  update appointments set queue_no = v_no where id = p_appt;
  return v_no;
end $$ language plpgsql;
```

A rejected payment leaves a gap in the sequence. That's fine — he calls down the list in order and gaps are invisible. Don't try to renumber.

```sql
-- =========================
-- PAYMENT CLAIMS
-- =========================
create table payment_claims (
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

create index on payment_claims (status, created_at desc);
create unique index uniq_trx on payment_claims (trx_id)
  where trx_id is not null and status <> 'rejected';

-- =========================
-- BOOKING TOKENS
-- =========================
create table booking_tokens (
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
create table visits (
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

create index on visits (patient_id, visit_date desc);
create index on visits (next_visit_date);

-- =========================
-- SMS
-- =========================
create table sms_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label_en text not null,
  body_bn text not null,
  variables text[] not null default '{}',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table sms_campaigns (
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

create table sms_log (
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
create table settings (key text primary key, value text);

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
  ('booking_open',         'true');
```

### RLS

Every table RLS-enabled, single policy `auth.role() = 'authenticated'`. Patient-facing pages never query Supabase from the browser — all public actions route through Next.js server handlers using the service role key.

---

## 3. Availability logic

Much simpler than v2. No slot expansion, no per-time collision.

```ts
// lib/availability.ts

// Dates a NEW patient may choose
export async function getOpenDates(): Promise<OpenDate[]> {
  // consult_days where:
  //   mode = 'video'
  //   date >= today (Asia/Dhaka)
  //   date <= today + 30
  //   is_open_for_new = true
  //   is_cancelled = false
  //   and NOT full
  // returns [{ date, callStart, callEnd, remaining }]
}

export async function isDayFull(date: string): Promise<boolean> {
  // capacity IS NULL -> never full
  // else count appointments on that date, mode='video',
  //   status in ('hold','pending_review','scheduled'),
  //   treating 'hold' with hold_expires_at < now() as free
  // >= capacity -> full
}
```

**Lazy hold cleanup** happens inside `isDayFull` — expired holds are simply not counted. Optionally sweep them to `status='expired'` in the same request. No dedicated cron needed.

**Capacity race.** Two people taking the last place simultaneously is possible but harmless at this volume — worst case he has 16 calls instead of 15. If you want it airtight, wrap the hold creation in the same advisory-lock pattern as `assign_queue_no`.

---

## 4. Flow A — New patient, open link

Route group `/b`. Entirely Bangla. Doctor shares one URL.

```
Step 1  /b
        Header: ডাঃ খালেদ নূর জিহাদ — অনলাইন কনসালটেশন
        A horizontal scrolling row of date chips (NOT a calendar).
        Each chip: weekday, date, and the call window beneath it.
          e.g.  শনিবার
                ১৮ জানু
                রাত ৮টা - ১০টা
        Full or closed dates simply don't appear.
        → tap a date → step 2

Step 2  /b/details
        নাম            (text)
        হোয়াটসঅ্যাপ নম্বর  (tel, inputmode="numeric")
        → POST /api/book/create
          - normalise phone
          - SELECT patients WHERE phone = canonical
              found     → use that patient_id
              not found → INSERT patient (status='pending',
                          source='online_booking')
          - check capacity for the date
          - INSERT appointment (mode='video', status='hold',
              hold_expires_at = now() + hold_minutes,
              booking_source='open_link')
          - INSERT booking_token (purpose='payment', 24h expiry)
          → redirect /b/pay/<token>

Step 3  /b/pay/<token>
        Amount, bKash number with a big copy button,
        "বিকাশে Send Money করুন",
        countdown showing time left.
        → "আমি পেমেন্ট করেছি" → step 4

Step 4  /b/pay/<token>/proof
        নাম (prefilled, editable)
        Radio: TrxID  |  যে নম্বর থেকে টাকা পাঠিয়েছেন
        One field required.
        → POST /api/book/claim
          - INSERT payment_claim
          - appointments.status = 'pending_review'
          - hold_expires_at = NULL
          - SELECT assign_queue_no(appointment_id)
          → redirect /b/done?t=<token>

Step 5  /b/done
        "আপনার বুকিং গৃহীত হয়েছে।
         সিরিয়াল নং {{queue}}
         {{date}} তারিখ {{start}} - {{end}} এর মধ্যে কল করা হবে।
         পেমেন্ট যাচাইয়ের পর এসএমএস পাঠানো হবে।"
```

Note the queue number appears immediately, which is the thing patients actually care about. It's provisional until the doctor verifies, and the confirmation SMS restates it.

---

## 5. Flow B — Returning patient, follow-up link

The reminder SMS goes out `reminder_days_before` days ahead, at `reminder_send_hour` Dhaka time, containing a tokenised link.

```
Step 1  /f/<token>
        Token resolves to patient + their follow-up date.
        NO date picker. NO time picker. NO name shown.

        "প্রিয় রোগী,
         {{date}} তারিখে আপনার ফলোআপ।
         অনলাইনে করতে চাইলে নিচের বাটনে চাপ দিন।
         কল করা হবে {{start}} - {{end}} এর মধ্যে।"

        [ অনলাইনে কনসালটেশন করব ]

        → creates appointment (patient known, date fixed,
          status='hold', booking_source='followup_link')
        → redirect /b/pay/<payment_token>

Steps 2-4   Identical routes and components to Flow A.
            Build the payment pages once, use from both flows.
```

**Fallback for a lost SMS — `/f`:** phone number entry, normalised, looked up server-side. Whether or not the number matches, the response is identical: *"যদি এই নম্বরটি নিবন্ধিত থাকে, আমরা একটি লিংক পাঠিয়েছি।"* A real patient with an upcoming follow-up gets a fresh tokenised link by SMS; anyone else gets nothing. No existence leak, and this path cannot create a patient — which is exactly the no-duplicates guarantee you wanted.

Rate-limit to 3 attempts per number per hour.

**Token rules:** single-use (`used_at` stamped), expires the day after the follow-up date, 32 bytes via `crypto.randomBytes(24).toString('base64url')`.

---

## 6. Payment proof

Unchanged from v2, both methods accepted:

- **TrxID** — `^[A-Z0-9]{10}$`, auto-uppercase, rejected if already claimed on a non-rejected claim.
- **Sender phone** — normalised with the same BD function. Labelled *"যে নম্বর থেকে টাকা পাঠিয়েছেন"* because it's frequently a family member's number. Never matched against the patients table.

Radio toggle, one required, both stored if both given.

---

## 7. Bangla strings

All in `lib/i18n/bn.ts`. No patient names anywhere.

| Context | Bangla |
|---|---|
| Header | ডাঃ খালেদ নূর জিহাদ — অনলাইন কনসালটেশন |
| Pick date | তারিখ নির্বাচন করুন |
| No dates open | এখন কোনো তারিখ খালি নেই |
| Your details | আপনার তথ্য |
| Name | নাম |
| WhatsApp number | হোয়াটসঅ্যাপ নম্বর (এই নম্বরে কল করা হবে) |
| Next | পরবর্তী |
| Payment heading | পেমেন্ট করুন |
| Instruction | নিচের নম্বরে **{{amount}}** টাকা বিকাশে **Send Money** করুন |
| bKash number | বিকাশ নম্বর |
| Copy | কপি করুন |
| Countdown | বাকি সময়: {{mm:ss}} |
| Paid button | আমি পেমেন্ট করেছি |
| Proof heading | পেমেন্টের তথ্য দিন |
| TrxID | ট্রানজেকশন আইডি (TrxID) |
| Or | অথবা |
| Sender number | যে নম্বর থেকে টাকা পাঠিয়েছেন |
| Submit | জমা দিন |
| Serial | সিরিয়াল নং |
| Call window | কল করা হবে {{start}} - {{end}} এর মধ্যে |
| Day full | দুঃখিত, এই দিনের সব সিরিয়াল পূর্ণ হয়ে গেছে |
| Done | আপনার বুকিং গৃহীত হয়েছে। পেমেন্ট যাচাইয়ের পর এসএমএস পাঠানো হবে। |
| Expired link | এই লিংকের মেয়াদ শেষ হয়েছে। |

### SMS templates

| key | body_bn |
|---|---|
| `followup_reminder` | `প্রিয় রোগী, {{date}} তারিখে ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপ। অনলাইনে করতে চাইলে: {{link}}` |
| `booking_confirmed` | `প্রিয় রোগী, পেমেন্ট নিশ্চিত হয়েছে। সিরিয়াল নং {{queue}}। {{date}} তারিখ {{start}}-{{end}} এর মধ্যে WhatsApp এ কল করা হবে।` |
| `payment_not_found` | `প্রিয় রোগী, আপনার পেমেন্ট খুঁজে পাওয়া যায়নি। আবার তথ্য দিন: {{link}}` |
| `chamber_reminder` | `প্রিয় রোগী, {{date}} তারিখে ডাঃ খালেদ নূর জিহাদ এর চেম্বারে আপনার অ্যাপয়েন্টমেন্ট রয়েছে।` |
| `day_cancelled` | `প্রিয় রোগী, দুঃখিত, {{date}} তারিখে ডাক্তার বসবেন না। যোগাযোগ: {{contact}}` |

Bangla is Unicode SMS — 70 characters per segment. Show the live segment count in the template editor so he can see when an edit tips a message into an extra segment.

---

## 8. Doctor dashboard

### `/` — Today
- **Video queue** — ordered by `queue_no`, each row: serial, name, phone, payment status, one-tap `wa.me` button. He works top to bottom.
- **Walk-in queue** — in-person patients for today.
- **Needs verification** badge.
- Quick search.

### `/bookings` — inbox
Three tabs: **Needs verification** (claims to check against bKash — Verify / Reject / Merge), **New patients** (pending self-registrations to accept, which assigns a serial), **Holds** (live holds with countdowns).

On Verify: claim → `verified`, appointment → `scheduled`, pending patient → `active` with serial assigned, confirmation SMS fires automatically.

### `/schedule` — the doctor's calendar
This is where the month grid lives, since it's gone from the patient side. Each day shows video count / walk-in count. Click a day to open the `consult_days` editor:
- Call window start and end
- Capacity
- **Open to new patients** toggle
- **Cancel this day** — which also offers to SMS everyone booked

Plus a bulk action: "open the next 4 Saturdays with default settings", because clicking day by day gets old.

### `/patients`, `/patients/[id]`, visit form
As v1/v2. The visit form's **next visit date** quick buttons (`+1m`, `+3m`, `+6m`) must also auto-create the `consult_days` row for that date if missing.

### `/messages`, `/templates`, `/settings`
As v2. Settings gains `reminder_send_hour`, `reminder_days_before`, `default_call_start`, `default_call_end`, `default_capacity`.

---

## 9. The reminder function

`netlify/functions/reminders.mts`, scheduled `0 * * * *`.

```
1. Compute current Asia/Dhaka hour. If ≠ reminder_send_hour, return immediately.
2. target = today(Dhaka) + reminder_days_before
3. Find visits where next_visit_date = target
   AND the patient has no live appointment on that date
   AND no reminder already sent
   → create booking_token (purpose='followup')
   → send followup_reminder with the link
4. Find appointments where scheduled_date = target
   AND mode='in_person' AND status='scheduled'
   AND reminder_sent_at IS NULL
   → send chamber_reminder
5. Stamp reminder_sent_at / log everything to sms_log
```

Guard the function body with a `CRON_SECRET` check if you also expose a manual-trigger route for testing.

---

## 10. Build order

**Phase 1** — Next.js 15 + Tailwind + Supabase auth (single user), schema applied, `lib/phone.ts`, `lib/i18n/bn.ts`, protected dashboard layout, Netlify deploy working end to end. Get deployment green before writing features.

**Phase 2** — Patients list with live search, new/edit form, patient detail with visit history, visit entry form with next-visit quick buttons.

**Phase 3** — `/schedule` month grid, `consult_days` editor, bulk open action, auto-create on next-visit-date save.

**Phase 4** — Today page: video queue by serial, walk-in queue, `wa.me` buttons, counters.

**Phase 5** — sms.bd wrapper, templates editor with segment counting, `/messages` filter-and-compose with recipient preview and cost estimate, full logging.

**Phase 6** — Flow A: `/b` date chips, details form with silent phone matching, payment pages, proof form, `assign_queue_no`. All server-side with the service role key.

**Phase 7** — Flow B: `/f/<token>` confirm page reusing Flow A payment pages, `/f` phone fallback that replies by SMS.

**Phase 8** — `/bookings` inbox with Verify / Reject / Merge and automatic confirmation SMS.

**Phase 9** — Netlify scheduled function for reminders, rate limiting, Recharts trend charts, mobile pass on every Bangla page at 360px.

---

## 11. Environment

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only
SMS_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
```

---

## 12. Questions for Dr. Zihad

1. Which weekdays does he want to run video consults, and what call window? (Default assumed 8–10pm.)
2. How many video patients can he realistically call in that window? That's the capacity number.
3. How far ahead should new patients be able to book — 30 days?
4. Should the open booking link be genuinely public, or only given to people he's already spoken to?
5. Bengali numerals (১৮) or Western (18) in SMS and on patient pages?
6. If he cancels a day, refund by bKash manually or carry the credit to the next date?
7. Reminder at 10am two days before — right, or does he prefer a different hour?
