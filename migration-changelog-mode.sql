-- 7.16.0 — ظهور سجل التحديثات بالموقع العام. آمن لإعادة التشغيل.
--   hidden = رقم الإصدار فقط بدون زر · versions (الافتراضي) = أرقام الإصدارات وتواريخها بدون تفاصيل · all = التفاصيل للجميع
alter table public.site_settings
  add column if not exists changelog_mode text not null default 'versions';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_changelog_mode_chk') then
    alter table public.site_settings
      add constraint site_settings_changelog_mode_chk check (changelog_mode in ('hidden', 'versions', 'all'));
  end if;
end $$;
