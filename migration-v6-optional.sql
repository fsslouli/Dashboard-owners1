-- ═══════════════════════════════════════════════════════════
-- migration-v6-optional.sql — الإصدار ٦.٠.٠ — اختياري و«لم يُطبَّق» على القاعدة
-- الموقع ٦.٠.٠ يشتغل كامل بدونه. تطبيقه يضيف:
--   ١) سجل نسخ للتخصيصات بالقاعدة (بدل السجل المحلي بمتصفح المشرف) — لوحة التخصيص تقرأ منه تلقائيًا
--   ٢) رفع صور الكتل لمن عنده manage_theme حتى لو ما عنده manage_gallery
--   ٣) تقوية أمان: views بصلاحيات المستعلِم + منع استدعاء دوال التريقر مباشرة
--      (تم التحقق قبل الكتابة: الجداول تحت الـ views قراءتها عامة، والتريقرات تشتغل بدون EXECUTE)
-- كله إضافي: ما يحذف ولا يعدّل بيانات. شغّله من SQL Editor بـ Supabase متى ما حبيت.
-- ═══════════════════════════════════════════════════════════

-- ١) سجل نسخ تخصيصات الموقع: قبل كل تعديل على nav_labels تنحفظ النسخة السابقة (آخر 300)
create table if not exists public.site_settings_history (
  id          bigint generated always as identity primary key,
  changed_at  timestamptz not null default now(),
  changed_by  uuid default auth.uid(),
  actor       text,
  nav_labels  jsonb
);
alter table public.site_settings_history enable row level security;
drop policy if exists "قراءة - سجل نسخ التخصيصات" on public.site_settings_history;
create policy "قراءة - سجل نسخ التخصيصات" on public.site_settings_history
  for select to authenticated using (public.has_perm('manage_theme'));
-- لا سياسات كتابة: العميل ما يقدر يضيف/يعدّل/يحذف — التريقر وحده يكتب
revoke all on public.site_settings_history from anon;
revoke insert, update, delete, truncate on public.site_settings_history from authenticated;
grant select on public.site_settings_history to authenticated;

create or replace function public.snapshot_site_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.nav_labels is distinct from new.nav_labels then
    insert into public.site_settings_history (nav_labels, actor)
    values (old.nav_labels, coalesce(auth.jwt() ->> 'email', current_user));
    delete from public.site_settings_history
     where id in (select id from public.site_settings_history order by id desc offset 300);
  end if;
  return new;
end $$;
drop trigger if exists trg_snapshot_site_settings on public.site_settings;
create trigger trg_snapshot_site_settings
  after update on public.site_settings
  for each row execute function public.snapshot_site_settings();

-- ٢) رفع صور الكتل: حاوية gallery تحت مجلد site/ بصلاحية manage_theme (القراءة العامة موجودة أصلًا)
drop policy if exists "رفع - صور كتل الموقع" on storage.objects;
create policy "رفع - صور كتل الموقع" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = 'site' and public.has_perm('manage_theme'));
drop policy if exists "حذف - صور كتل الموقع" on storage.objects;
create policy "حذف - صور كتل الموقع" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and (storage.foldername(name))[1] = 'site' and public.has_perm('manage_theme'));

-- ٣) تقوية أمان (تم التحقق قبل التطبيق أنها ما تكسر شي):
-- الـ views تعمل بصلاحيات المستعلِم (الجداول تحتها قراءتها عامة أصلًا بـ RLS، فالنتيجة نفسها)
alter view public.progress_matrix_v set (security_invoker = true);
alter view public.progress_phase_values set (security_invoker = true);
-- دوال التريقر ما تنستدعى مباشرة عبر الـ API (اختُبر: التريقر يشتغل بدون صلاحية EXECUTE)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;


-- ٤) (مؤجَّل — لا تشغّله الآن) فرض التحقق بخطوتين (aal2) على الكتابة الإدارية من جهة القاعدة.
-- طبّقه فقط بعد ما يفعّل كل مشرف التحقق بخطوتين من تبويب «الأمان»، وإلا ينقفل عنهم التعديل.
-- الفكرة: إضافة الشرط التالي لدالة has_perm:
--   and coalesce((auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
