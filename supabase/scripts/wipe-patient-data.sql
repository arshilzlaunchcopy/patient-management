-- =====================================================================
-- wipe-patient-data.sql — one-off: delete every patient record
--
-- Run ONCE in the Supabase SQL editor before going live, when everything
-- in the database is dummy data. Paste this first, then migration 013.
--
-- Deletes all patients, visits, appointments, payment claims, booking
-- links, SMS history, consultation days and lost-link requests, and
-- restarts patient serials at P-0001. Settings, SMS templates and the
-- medicine index are kept.
--
-- NOT a migration and NOT part of setup.sql: running it on a live
-- database would delete real patients. There is no undo.
-- =====================================================================

begin;

delete from sms_log           where true;
delete from sms_campaigns     where true;
delete from payment_claims    where true;
delete from booking_tokens    where true;
delete from visits            where true;
delete from appointments      where true;
delete from patients          where true;
delete from consult_days      where true;
delete from followup_requests where true;

alter sequence patient_serial_seq restart with 1;

commit;
