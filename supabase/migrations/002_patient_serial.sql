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
