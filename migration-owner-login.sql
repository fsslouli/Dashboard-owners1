-- ═══════════════════════════════════════════════════════════════════
-- 6.12.0 — تسجيل دخول الملاك (رقم الفيلا + رقم سري من ٦ أرقام)
--
-- شغّله مرة واحدة من Supabase → SQL Editor. آمن لإعادة التشغيل.
-- بعد تشغيله ما يتغيّر شي للزائر: القفل يبدأ «مقفول» (gate_mode = 'off')،
-- ولا يشتغل إلا لما تفعّله من لوحة الإدارة ← تبويب «دخول الملاك».
--
-- وش يسوي:
--   ١) أعمدة بـ site_settings: gate_mode (off | full | partial) و gate_guest_tabs و gate_wm (العلامة المائية)
--   ٢) جدول villa_accounts: رقم الفيلا + الرقم السري + حالة القفل (يقرأه صاحب صلاحية manage_owner_login فقط)
--   ٣) جدول villa_auth: ربط داخلي بحساب الدخول (لا يقرأه أحد غير دالة الخادم)
--   ٤) دالة gate_ok() تُضاف لكل سياسات القراءة العامة — القفل من قاعدة البيانات نفسها، مو شاشة فقط
--   ٥) دوال الإدارة: إنشاء الأرقام دفعة واحدة، إعادة تعيين، تعطيل/تفعيل، فك القفل
-- ═══════════════════════════════════════════════════════════════════

-- ── ١) إعدادات القفل ──────────────────────────────────────────────
alter table public.site_settings
  add column if not exists gate_mode text not null default 'off',
  add column if not exists gate_guest_tabs text[] not null default '{}'::text[],
  add column if not exists gate_wm jsonb;   -- العلامة المائية برقم الفيلا: { on, opacity, size, angle, gap, color, name, sid, time, custom }

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_gate_mode_chk') then
    alter table public.site_settings
      add constraint site_settings_gate_mode_chk check (gate_mode in ('off', 'full', 'partial'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_settings_gate_tabs_chk') then
    alter table public.site_settings
      add constraint site_settings_gate_tabs_chk
      check (gate_guest_tabs <@ array['overview', 'notes', 'progress', 'docs', 'gallery']::text[]);
  end if;
end $$;

-- ── ٢) حسابات الفلل ───────────────────────────────────────────────
create table if not exists public.villa_accounts (
  villa         integer primary key check (villa between 1 and 596),
  pin           text not null check (pin ~ '^[0-9]{6}$'),
  enabled       boolean not null default true,
  fails         integer not null default 0,          -- أخطاء متتالية منذ آخر دخول ناجح
  fails_total   integer not null default 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  login_count   integer not null default 0,
  pin_set_at    timestamptz not null default now(),
  updated_by    uuid
);
alter table public.villa_accounts enable row level security;

-- ربط داخلي بحساب الدخول الفعلي (Supabase Auth). بدون أي سياسة = لا يقرأه إلا مفتاح الخادم.
create table if not exists public.villa_auth (
  villa        integer primary key references public.villa_accounts (villa) on delete cascade,
  auth_user_id uuid,
  auth_email   text,
  auth_secret  text,
  stale_ids    uuid[] not null default '{}'::uuid[]   -- حسابات دخول قديمة تُحذف عند أول دخول تالٍ
);
alter table public.villa_auth enable row level security;
revoke all on public.villa_auth from anon, authenticated;
revoke all on public.villa_accounts from anon;

drop policy if exists "قراءة - حسابات الفلل" on public.villa_accounts;
create policy "قراءة - حسابات الفلل" on public.villa_accounts
  for select to authenticated using (public.has_perm('manage_owner_login'));
-- الكتابة كلها عبر الدوال بالأسفل (security definer) — ما في سياسة تعديل مباشرة

-- ── ٣) هل يحق للطلب الحالي قراءة بيانات الموقع؟ ───────────────────
--   • القفل مقفول  → الكل يقرأ (الوضع الحالي بالضبط)
--   • حساب إدارة   → يقرأ دائمًا
--   • حساب فيلا    → يقرأ طالما حسابه مفعّل ورقمه السري ما تغيّر بعد دخوله
--   • رابط مشاركة  → يقرأ طالما جلسته ما انتهت والرابط ما أُلغي
--   • زائر بلا دخول → يقرأ فقط في الوضع الجزئي، وللأقسام اللي حددتها الإدارة
create or replace function public.gate_ok(variadic p_tabs text[])
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_mode text; v_tabs text[];
  v_uid uuid := auth.uid();
  v_meta jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
begin
  select gate_mode, gate_guest_tabs into v_mode, v_tabs from public.site_settings where id = 1;
  if coalesce(v_mode, 'off') = 'off' then return true; end if;

  if v_uid is not null then
    if v_meta ? 'villa_login' then
      if exists (
        select 1 from public.villa_auth a join public.villa_accounts v on v.villa = a.villa
        where a.auth_user_id = v_uid and v.enabled) then return true; end if;
    elsif v_meta ? 'share_link' then
      if coalesce((v_meta ->> 'share_exp')::bigint, 0) > (extract(epoch from now()) * 1000)::bigint
        and exists (
          select 1 from public.share_links l
          where l.id = (v_meta ->> 'share_link')::uuid and l.revoked_at is null and l.expires_at > now()) then return true; end if;
    -- 6.13.0: حساب الإدارة لازم يكون له ملف بجدول profiles — حساب مسجَّل من برّا بلا ملف ما يتجاوز القفل
    elsif exists (select 1 from public.profiles p where p.id = v_uid) then
      return true;
    end if;
  end if;
  if v_mode = 'partial' then
    return (p_tabs = array['*']::text[] and cardinality(v_tabs) > 0) or (v_tabs && p_tabs);
  end if;
  return false;
end $$;
revoke all on function public.gate_ok(text[]) from public;
grant execute on function public.gate_ok(text[]) to anon, authenticated;

-- ── ٤) ربط سياسات القراءة العامة بالقفل ───────────────────────────
-- (select gate_ok(..)) بين قوسين = تُحسب مرة واحدة لكل استعلام لا لكل صف.
alter policy "قراءة عامة - الاستفسارات" on public.inquiries
  using ((select public.gate_ok('overview', 'notes')));
alter policy "قراءة عامة - الفلاتر" on public.filter_categories
  using ((select public.gate_ok('overview', 'notes')));
alter policy "قراءة عامة - المرفقات الظاهرة" on public.inquiry_attachments
  using (published and (select public.gate_ok('overview', 'notes', 'gallery')));
alter policy "قراءة عامة - إشارة تحديث المرفقات" on public.inquiry_attachments_rev
  using ((select public.gate_ok('*')));

alter policy "قراءة عامة - التقدم" on public.progress
  using ((select public.gate_ok('overview', 'progress')));
alter policy "قراءة عامة - بلوكات التقدم" on public.progress_blocks
  using ((select public.gate_ok('overview', 'progress')));
alter policy "قراءة عامة - ملاحظات أشهر التقدم" on public.progress_month_notes
  using ((select public.gate_ok('overview', 'progress')));
alter policy "قراءة عامة - نسب المراحل المعتمدة" on public.progress_phase_overrides
  using ((select public.gate_ok('overview', 'progress')));
alter policy "قراءة عامة - قراءات التقدم" on public.progress_readings
  using ((select public.gate_ok('overview', 'progress')));
-- العرضان المحسوبان كانا يتجاوزان RLS (يشتغلان بصلاحية المالك) — الآن يتبعان صلاحية السائل
alter view public.progress_phase_values set (security_invoker = true);
alter view public.progress_matrix_v set (security_invoker = true);

alter policy "قراءة عامة - المقاطع الظاهرة" on public.model_videos
  using (published and (select public.gate_ok('docs')));
alter policy "قراءة عامة - إشارة تحديث المقاطع" on public.model_videos_rev
  using ((select public.gate_ok('*')));

alter policy "قراءة عامة - المواضيع الظاهرة" on public.media_topics
  using ((published = true) and (select public.gate_ok('gallery')));
alter policy "قراءة عامة - العناصر الظاهرة" on public.media_items
  using ((published = true)
    and (exists (select 1 from public.media_topics t where t.id = media_items.topic_id and t.published = true))
    and (select public.gate_ok('gallery')));
alter policy "قراءة عامة - نسخة الكاش" on public.media_rev
  using ((select public.gate_ok('*')));
alter policy "قراءة الروابط المنشورة" on public.external_links
  using ((published = true) and (select public.gate_ok('gallery')));

alter policy "قراءة عامة - الإشعارات النشطة" on public.notices
  using (((expires_at is null) or (expires_at > now())) and (select public.gate_ok('*')));
alter policy "قراءة عامة - ذاكرة الترجمة" on public.i18n_memory
  using ((select public.gate_ok('*')));
-- site_settings تبقى مقروءة للكل: شاشة الدخول نفسها تحتاج الطقم ووضع القفل.

-- ── ٥) صلاحية تعديل إعدادات القفل ─────────────────────────────────
create or replace function public.check_site_settings_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare col text;
begin
  for col in select jsonb_object_keys(to_jsonb(new)) loop
    if (to_jsonb(old) ->> col) is not distinct from (to_jsonb(new) ->> col) then continue; end if;
    if col in ('updated_at','updated_by') then continue; end if;
    if col in ('gate_mode','gate_guest_tabs','gate_wm') then
      if not public.has_perm('manage_owner_login') then raise exception 'لا توجد صلاحية لتعديل إعدادات دخول الملاك'; end if;
    elsif col in ('gallery_mode','gallery_layout') then
      if not public.has_perm('manage_gallery') then raise exception 'لا توجد صلاحية لتعديل إعدادات المعرض'; end if;
    else
      if not public.has_perm('manage_theme') then raise exception 'لا توجد صلاحية لتعديل مظهر الموقع وتسمية الأقسام'; end if;
    end if;
  end loop;
  return new;
end $$;

alter policy "تعديل - إعدادات الموقع" on public.site_settings
  using (public.has_perm('manage_theme') or public.has_perm('manage_gallery') or public.has_perm('manage_owner_login'))
  with check (public.has_perm('manage_theme') or public.has_perm('manage_gallery') or public.has_perm('manage_owner_login'));

-- ── ٦) دوال الإدارة ───────────────────────────────────────────────
-- رقم سري عشوائي من ٦ أرقام (مصدر عشوائية تشفيري)، يستبعد الأرقام السهلة جدًا
create or replace function public.villa_new_pin()
returns text language plpgsql volatile set search_path = public, extensions
as $$
declare p text;
begin
  loop
    p := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when p !~ '^(\d)\1{5}$'
      and p not in ('123456', '654321', '012345', '123123', '112233', '121212', '101010', '102030');
  end loop;
  return p;
end $$;
revoke all on function public.villa_new_pin() from public, anon, authenticated;

-- إبطال جلسات الفيلا الحالية: حساب الدخول القديم يُفصل فورًا ويُحذف عند أول دخول تالٍ
create or replace function public.villa_drop_sessions(p_villa integer)
returns void language sql security definer set search_path = public
as $$
  update public.villa_auth
     set stale_ids = case when auth_user_id is null then stale_ids else stale_ids || auth_user_id end,
         auth_user_id = null, auth_email = null, auth_secret = null
   where villa = p_villa;
$$;
revoke all on function public.villa_drop_sessions(integer) from public, anon, authenticated;

-- إنشاء حسابات كل الفلل دفعة واحدة. p_reset_all = true يغيّر أرقام الحسابات الموجودة أيضًا.
create or replace function public.villa_accounts_generate(p_reset_all boolean default false)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_new int := 0; v_reset int := 0; i int;
begin
  if not public.has_perm('manage_owner_login') then raise exception 'لا توجد صلاحية لإدارة دخول الملاك'; end if;
  for i in 1..596 loop
    if not exists (select 1 from public.villa_accounts where villa = i) then
      insert into public.villa_accounts (villa, pin, updated_by) values (i, public.villa_new_pin(), auth.uid());
      v_new := v_new + 1;
    elsif p_reset_all then
      update public.villa_accounts
         set pin = public.villa_new_pin(), pin_set_at = now(), fails = 0, locked_until = null, updated_by = auth.uid()
       where villa = i;
      perform public.villa_drop_sessions(i);
      v_reset := v_reset + 1;
    end if;
  end loop;
  return jsonb_build_object('created', v_new, 'reset', v_reset);
end $$;

-- إعادة تعيين رقم فيلا واحدة (عشوائي، أو رقم تحدده الإدارة). يخرّج كل أجهزة الفيلا فورًا.
create or replace function public.villa_account_reset(p_villa integer, p_pin text default null)
returns text language plpgsql security definer set search_path = public
as $$
declare v_pin text := coalesce(nullif(btrim(p_pin), ''), public.villa_new_pin());
begin
  if not public.has_perm('manage_owner_login') then raise exception 'لا توجد صلاحية لإدارة دخول الملاك'; end if;
  if p_villa is null or p_villa < 1 or p_villa > 596 then raise exception 'رقم الفيلا خارج النطاق (1–596)'; end if;
  if v_pin !~ '^[0-9]{6}$' then raise exception 'الرقم السري لازم يكون 6 أرقام'; end if;
  insert into public.villa_accounts (villa, pin, updated_by) values (p_villa, v_pin, auth.uid())
  on conflict (villa) do update
    set pin = excluded.pin, pin_set_at = now(), fails = 0, locked_until = null, updated_by = auth.uid();
  perform public.villa_drop_sessions(p_villa);
  return v_pin;
end $$;

-- تعطيل/تفعيل حساب فيلا. التعطيل يقطع القراءة فورًا (gate_ok يفحص enabled مع كل طلب).
create or replace function public.villa_account_set_enabled(p_villa integer, p_enabled boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_perm('manage_owner_login') then raise exception 'لا توجد صلاحية لإدارة دخول الملاك'; end if;
  update public.villa_accounts set enabled = p_enabled, updated_by = auth.uid() where villa = p_villa;
  if not p_enabled then perform public.villa_drop_sessions(p_villa); end if;
end $$;

-- فك القفل المؤقت بعد المحاولات الخاطئة
create or replace function public.villa_account_unlock(p_villa integer)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_perm('manage_owner_login') then raise exception 'لا توجد صلاحية لإدارة دخول الملاك'; end if;
  update public.villa_accounts set fails = 0, locked_until = null, updated_by = auth.uid() where villa = p_villa;
end $$;

revoke all on function public.villa_accounts_generate(boolean) from public, anon;
revoke all on function public.villa_account_reset(integer, text) from public, anon;
revoke all on function public.villa_account_set_enabled(integer, boolean) from public, anon;
revoke all on function public.villa_account_unlock(integer) from public, anon;
grant execute on function public.villa_accounts_generate(boolean) to authenticated;
grant execute on function public.villa_account_reset(integer, text) to authenticated;
grant execute on function public.villa_account_set_enabled(integer, boolean) to authenticated;
grant execute on function public.villa_account_unlock(integer) to authenticated;

-- تسجيل محاولة خاطئة (تستدعيها دالة الخادم فقط): قفل ١٥ دقيقة بعد ٥ أخطاء متتالية
create or replace function public.villa_pin_fail(p_villa integer)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare r public.villa_accounts;
begin
  update public.villa_accounts
     set fails = fails + 1, fails_total = fails_total + 1,
         locked_until = case when fails + 1 >= 5 then now() + interval '15 minutes' else locked_until end
   where villa = p_villa
   returning * into r;
  if not found then return jsonb_build_object('locked', false, 'left', 0); end if;
  if r.fails >= 5 then
    update public.villa_accounts set fails = 0 where villa = p_villa;
    return jsonb_build_object('locked', true, 'left', 0);
  end if;
  return jsonb_build_object('locked', false, 'left', 5 - r.fails);
end $$;
revoke all on function public.villa_pin_fail(integer) from public, anon, authenticated;
grant execute on function public.villa_pin_fail(integer) to service_role;
grant execute on function public.villa_drop_sessions(integer) to service_role;
grant select, insert, update, delete on public.villa_accounts, public.villa_auth to service_role;
grant select on public.villa_accounts to authenticated;

-- ── ٧) تحديث لحظي لتبويب الإدارة (اختياري) ────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'villa_accounts') then
    alter publication supabase_realtime add table public.villa_accounts;
  end if;
exception when others then null;
end $$;

-- ── ٨) تنظيف حسابات جلسات المشاركة المنتهية (مرة كل يوم) ──────────
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'gate-share-users-cleanup';
    perform cron.schedule('gate-share-users-cleanup', '17 3 * * *',
      $job$ delete from auth.users
             where raw_app_meta_data ? 'share_link'
               and coalesce((raw_app_meta_data ->> 'share_exp')::bigint, 0) < (extract(epoch from now() - interval '1 day') * 1000)::bigint $job$);
  end if;
exception when others then null;
end $$;

-- ── ٩) الصلاحية الجديدة لصاحب الحساب الرئيسي فقط ──────────────────
-- (كشف الأرقام السرية يظهر لصاحب هذه الصلاحية وحده؛ يقدر يمنحها لغيره لاحقًا من تبويب «المستخدمون».)
alter table public.profiles disable trigger trg_check_profile_perm_change;
update public.profiles
   set perms = array_append(coalesce(perms, '{}'::text[]), 'manage_owner_login')
 where id = '9e3c05a6-16c4-4e75-90e5-fb6c086328f3'
   and not ('manage_owner_login' = any(coalesce(perms, '{}'::text[])));
alter table public.profiles enable trigger trg_check_profile_perm_change;
