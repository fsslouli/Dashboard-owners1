-- 7.1.0 — صفحة «فحص الاستلام»: عمود يتحكم بظهورها في الموقع. مخفية افتراضيًا. آمن لإعادة التشغيل.
--   hidden = للإدارة فقط (معاينة) · owners = للملاك المسجّلين بحساب الفيلا · all = لكل الزوّار
alter table public.site_settings
  add column if not exists handover_mode text not null default 'hidden';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_handover_mode_chk') then
    alter table public.site_settings
      add constraint site_settings_handover_mode_chk check (handover_mode in ('hidden', 'owners', 'all'));
  end if;
end $$;
