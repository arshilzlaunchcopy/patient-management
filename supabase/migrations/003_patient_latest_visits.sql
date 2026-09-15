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
