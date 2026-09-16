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
