-- 7.1.0 — إعداد بوت تليجرام من لوحة الإدارة: مفتاح البوت ورقم القروب يُحفظان هنا بدل أسرار Supabase.
-- الجدول بلا أي سياسة قراءة: ما يقرأه إلا مفتاح الخادم داخل الدالة telegram-notify. آمن لإعادة التشغيل.
create table if not exists public.bot_config (
  id            integer primary key check (id = 1),
  tg_token      text,
  tg_chat_id    text,
  tg_chat_title text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
alter table public.bot_config enable row level security;
revoke all on public.bot_config from anon, authenticated;
grant select, insert, update on public.bot_config to service_role;
