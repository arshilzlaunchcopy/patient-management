-- =====================================================================
-- 012_online_optional_wording.sql — online follow-up is an option, not
-- the expectation
--
-- Most patients simply come to the chamber. The texts that carry a
-- follow-up link now say so first, and offer the online (video) consult
-- as "if you would like". Only rows still holding the original wording
-- are touched, so anything the doctor has already edited on Settings
-- stays as written. Safe to re-run.
-- =====================================================================

update sms_templates
set body_bn = 'প্রিয় রোগী, {{date}} তারিখে ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপ। চেম্বারে আসুন, অথবা অনলাইনে (ভিডিও) করতে চাইলে: {{link}}'
where key = 'followup_reminder'
  and body_bn = 'প্রিয় রোগী, {{date}} তারিখে ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপ। অনলাইনে করতে চাইলে: {{link}}';

update sms_templates
set body_bn = 'প্রিয় রোগী, ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপের সময় পার হয়ে গেছে। চেম্বারে আসুন, অথবা অনলাইনে (ভিডিও) করতে চাইলে দিন বেছে নিন: {{link}}'
where key = 'followup_overdue'
  and body_bn = 'প্রিয় রোগী, ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপের তারিখ পার হয়ে গেছে। নতুন দিন বেছে নিতে: {{link}}';

update sms_templates
set body_bn = 'প্রিয় রোগী, আপনার ফলোআপের সময় পার হয়ে গেছে। সুবিধামতো চেম্বারে আসুন। অনলাইনে (ভিডিও) করতে চাইলে জানাবেন, লিংক পাঠানো হবে।'
where key = 'custom_seed_overdue'
  and body_bn = 'প্রিয় রোগী, আপনার ফলোআপের সময় পার হয়ে গেছে। দ্রুত চেম্বারে আসুন বা অনলাইনে সিরিয়াল নিন।';
