-- =====================================================================
-- 013_go_live.sql — real bKash number, 7–9 PM online hours, SMS signature
--
-- * bKash number patients send the booking fee to.
-- * Online consult window 19:00–21:00 Asia/Dhaka. Upcoming consult days
--   get the new window, and the next eight weeks are opened to new
--   patients on every day except Friday.
-- * Every SMS template ends with the doctor's name in Bangla. Templates
--   that already end with it are left alone.
-- * The "Reset demo data" function is removed so a stray click can never
--   put dummy patients back among real ones.
--
-- Safe to re-run.
-- =====================================================================

insert into settings (key, value) values
  ('bkash_number',       '01716731203'),
  ('default_call_start', '19:00'),
  ('default_call_end',   '21:00')
on conflict (key) do update set value = excluded.value;

-- Upcoming days keep their other details; only the call window changes.
update consult_days
set call_start = '19:00', call_end = '21:00'
where mode = 'video'
  and date >= (now() at time zone 'Asia/Dhaka')::date;

-- Next eight weeks, every day except Friday (dow 5), open to new patients.
insert into consult_days (date, mode, call_start, call_end, capacity, is_open_for_new)
select d::date, 'video', '19:00', '21:00',
       coalesce((select nullif(value, '')::int from settings where key = 'default_capacity'), 15),
       true
from generate_series(
       (now() at time zone 'Asia/Dhaka')::date,
       (now() at time zone 'Asia/Dhaka')::date + 55,
       interval '1 day'
     ) as d
where extract(dow from d) <> 5
on conflict (date, mode) do update
  set is_open_for_new = true
  where not consult_days.is_cancelled;

update sms_templates
set body_bn = body_bn || E'\n- ডাঃ খালেদ নূর জিহাদ'
where body_bn not like '%' || E'\n- ডাঃ খালেদ নূর জিহাদ';

drop function if exists reset_demo_data();
