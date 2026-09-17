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
