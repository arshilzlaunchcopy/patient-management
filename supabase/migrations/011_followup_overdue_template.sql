-- =====================================================================
-- 011_followup_overdue_template.sql — SMS for a follow-up that has passed
--
-- A follow-up link used to be worthless once the date had gone by. Now an
-- overdue patient gets a link that opens straight onto the open dates so
-- they can pick a new day and pay. This is the text that carries it;
-- editable on Settings like the other automatic texts. Safe to re-run.
-- =====================================================================

insert into sms_templates (key, label_en, body_bn, variables) values
  ('followup_overdue', 'Follow-up overdue (rebooking link)',
   'প্রিয় রোগী, ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপের তারিখ পার হয়ে গেছে। নতুন দিন বেছে নিতে: {{link}}',
   '{link}')
on conflict (key) do nothing;
