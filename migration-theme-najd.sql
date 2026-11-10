-- 6.13.0 — طقما «نجد» و«أندلس»: يضيف القيمتين لقيد الطقم المعتمد. شغّله مرة واحدة (آمن لإعادة التشغيل).
alter table public.site_settings drop constraint if exists site_settings_active_theme_check;
alter table public.site_settings add constraint site_settings_active_theme_check
  check (active_theme = any (array['classic', 'ufuq', 'mahdar', 'mukhattat', 'masar', 'najd', 'andalus']));
