-- 7.11.0 — تصميم «فجر»: يوسّع قيد عمود التصميم عشان لوحة الإدارة تقدر تعتمده.
-- ما يغيّر التصميم المعتمد حاليًا ولا يلمس أي بيانات. آمن لإعادة التشغيل.
begin;
alter table public.site_settings drop constraint if exists site_settings_active_design_chk;
alter table public.site_settings add constraint site_settings_active_design_chk
  check (active_design in ('classic','nova','bannaa','fajr'));
commit;
