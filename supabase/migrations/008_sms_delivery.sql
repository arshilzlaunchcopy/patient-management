-- =====================================================================
-- 008_sms_delivery.sql — delivery status from the SMS gateway
--
-- "sent" in sms_log only means sms.net.bd accepted the message. Their
-- report endpoint says what happened afterwards, per recipient. The Outbox
-- and the patient page ask for it on demand and keep the answer here.
--
--   delivery_status   pending | delivered | failed  (our classification)
--   delivery_detail   the gateway's own wording, e.g. "Sent", "Delivered"
--   delivery_checked_at  when we last asked
--
-- Safe to re-run.
-- =====================================================================

alter table sms_log
  add column if not exists delivery_status text
    check (delivery_status in ('pending', 'delivered', 'failed')),
  add column if not exists delivery_detail text,
  add column if not exists delivery_checked_at timestamptz;

-- The patient page reads one patient's messages newest first.
create index if not exists sms_log_patient_created_idx
  on sms_log (patient_id, created_at desc);
