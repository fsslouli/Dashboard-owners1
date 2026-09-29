-- ══════════════════════════════════════════════════════════
-- شكل عرض المكتبة المرئية (٢.١٢.٠) — هجرة إضافية، آمنة، تُشغَّل مرة وحدة.
--   docs      = زي المستندات: صف لكل ملف (الافتراضي)
--   adaptive  = حسب نوع الملف: صفوف للتقارير، شبكة للصور، بطاقات عريضة للفيديو
--   folders   = مجلدات: كل موضوع ينفتح وينقفل
-- لا تلمس أي بيانات موجودة. لو ما شغّلتها: الموقع يعرض «زي المستندات» ولوحة الإدارة تنبّهك.
-- ══════════════════════════════════════════════════════════
alter table public.site_settings
  add column if not exists gallery_layout text not null default 'docs';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_gallery_layout_chk') then
    alter table public.site_settings
      add constraint site_settings_gallery_layout_chk
      check (gallery_layout in ('docs', 'adaptive', 'folders'));
  end if;
end $$;
