-- ══════════════════════════════════════════════════════════
-- تسمية الأقسام (تبويبات الموقع العام + لوحة الإدارة) — هجرة إضافية
-- شغّلها مرة وحدة بـ SQL Editor. تعتمد على جدول site_settings الموجود.
-- ══════════════════════════════════════════════════════════

alter table public.site_settings
  add column if not exists nav_labels jsonb not null default '{}'::jsonb;

-- تفعيل التحديثات اللحظية على الجدول (لو ما كان مفعّل أصلاً)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_settings'
  ) then
    alter publication supabase_realtime add table public.site_settings;
  end if;
end $$;
