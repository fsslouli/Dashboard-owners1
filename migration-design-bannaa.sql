-- ══════════════════════════════════════════════════════════
-- v2.10.0 — تصميم «بنّاء»
-- شغّله مرة وحدة بـ SQL Editor بمشروع Supabase (آمن لو تكرر).
-- يوسّع قيد عمود التصميم عشان لوحة الإدارة تقدر تعتمد «بنّاء».
-- ما يغيّر التصميم المعتمد حاليًا ولا يلمس أي بيانات.
-- ══════════════════════════════════════════════════════════
begin;

alter table public.site_settings
  drop constraint if exists site_settings_active_design_chk;

alter table public.site_settings
  add constraint site_settings_active_design_chk
  check (active_design in ('classic','nova','bannaa'));

commit;
