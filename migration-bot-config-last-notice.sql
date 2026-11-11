-- 7.2.0 — وقت آخر إشعار «تم تحديث الموقع»، لحساب عدد البنود المحدّثة منذ ذلك الوقت. آمن لإعادة التشغيل.
alter table public.bot_config add column if not exists tg_last_notice_at timestamptz;
