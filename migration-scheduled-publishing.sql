-- ═══════════════════════════════════════════════════════════════════
-- migration-scheduled-publishing.sql — جدولة النشر (٦.١.٠)
-- تعديل تسويه الحين ويظهر للملاك لاحقًا (بعد ساعة، ساعتين، أو وقت محدد)،
-- للاستفسارات (تعديل/إضافة) وللمكتبة (مواضيع، صور ومقاطع، مقاطع النماذج،
-- مرفقات الاستفسارات، الروابط الخارجية).
--
-- إضافية بالكامل: جدول جديد + دوال جديدة + مهمة pg_cron. ما تلمس أي جدول أو بيانات
-- موجودة، ولا تغيّر سياسات القراءة العامة. آمنة لإعادة التشغيل.
--
-- كيف تشتغل: التعديل المجدول يُحفظ كطلب بجدول scheduled_changes (ما يظهر للملاك).
-- مهمة pg_cron كل دقيقة تنفّذ الطلبات اللي حان وقتها بصلاحيات من جدولها،
-- فتشتغل التريقرات الموجودة (سجل التعديلات، «من عدّل»، تحديث المكتبة اللحظي) مثل التعديل اليدوي.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

create table if not exists public.scheduled_changes (
  id                bigint generated always as identity primary key,
  target_table      text not null,
  target_id         bigint,
  op                text not null default 'update' check (op in ('update','insert')),
  patch             jsonb not null default '{}'::jsonb check (jsonb_typeof(patch) = 'object'),
  label             text not null default '' check (char_length(label) <= 300),
  publish_at        timestamptz not null,
  status            text not null default 'pending' check (status in ('pending','failed')),
  error             text,
  scheduled_by      uuid not null,
  scheduled_by_name text,
  created_at        timestamptz not null default now(),
  check (op = 'insert' or target_id is not null)
);

-- طلب واحد معلّق لكل صف (جدولة جديدة لنفس الصف تحلّ محل القديمة)
create unique index if not exists scheduled_changes_one_update_per_row
  on public.scheduled_changes (target_table, target_id) where op = 'update';
create index if not exists scheduled_changes_due
  on public.scheduled_changes (publish_at) where status = 'pending';

alter table public.scheduled_changes enable row level security;
revoke all on public.scheduled_changes from anon, authenticated;
grant select on public.scheduled_changes to authenticated;

-- ── الصلاحية المطلوبة لكل جدول (نفس صلاحيات التعديل اليدوي) ──
-- ── سجل الأنواع القابلة للجدولة ──
-- لإضافة نوع جديد مستقبلًا: سطر واحد هنا (بدون تعديل أي دالة):
--   insert into public.scheduled_targets values ('جدول_جديد','الاسم بالعربي','صلاحية_التعديل','صلاحية_الإضافة أو null');
create table if not exists public.scheduled_targets (
  target_table text primary key,
  label_ar     text not null,
  perm_update  text not null,
  perm_insert  text            -- null = الإضافة المجدولة غير مدعومة لهذا النوع
);
alter table public.scheduled_targets enable row level security;
revoke all on public.scheduled_targets from anon, authenticated;
grant select on public.scheduled_targets to authenticated;
drop policy if exists "قراءة - أنواع الجدولة" on public.scheduled_targets;
create policy "قراءة - أنواع الجدولة" on public.scheduled_targets for select to authenticated using (true);
insert into public.scheduled_targets (target_table, label_ar, perm_update, perm_insert) values
  ('inquiries','استفسار','edit_inquiry','add_inquiry'),
  ('media_items','عنصر معرض','manage_gallery',null),
  ('media_topics','موضوع معرض','manage_gallery',null),
  ('model_videos','مقطع نموذج','manage_media',null),
  ('inquiry_attachments','مرفق','edit_inquiry',null),
  ('external_links','رابط خارجي','manage_links',null)
on conflict (target_table) do nothing;

create or replace function public.sched_can(p_table text, p_op text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select public.has_perm(case when p_op = 'insert' then t.perm_insert else t.perm_update end)
    from public.scheduled_targets t
    where t.target_table = p_table
      and (p_op <> 'insert' or t.perm_insert is not null)
  ), false);
$$;

drop policy if exists "قراءة - التعديلات المجدولة" on public.scheduled_changes;
create policy "قراءة - التعديلات المجدولة" on public.scheduled_changes
  for select to authenticated using (public.sched_can(target_table, op));

-- ── فحص الحقول: لازم أعمدة حقيقية بالجدول، وممنوع المعرّف وبيانات الإنشاء ──
create or replace function public.sched_check_patch(p_table text, p_patch jsonb)
returns void
language plpgsql stable set search_path = public
as $$
declare k text;
begin
  for k in select jsonb_object_keys(p_patch) loop
    if k in ('id','created_at','created_by') then
      raise exception 'الحقل % غير مسموح بالجدولة', k;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = p_table and column_name = k) then
      raise exception 'الحقل % غير موجود بجدول %', k, p_table;
    end if;
  end loop;
end $$;

-- ── التنفيذ: يطبّق طلبًا واحدًا بصلاحيات p_actor (من جدولته أو من ضغط «انشر الآن») ──
create or replace function public.apply_scheduled_change(p_id bigint, p_actor uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  c public.scheduled_changes;
  sets text; cols text; vals text; n int; nid bigint;
begin
  select * into c from public.scheduled_changes where id = p_id for update;
  if not found then return false; end if;

  -- التريقرات الحالية تقرأ المستخدم من auth.uid()، فنشتغل بهويّة صاحب الجدولة
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);

  begin
    if not public.sched_can(c.target_table, c.op) then
      raise exception 'ليست لديك صلاحية تنفيذ هذا التعديل';
    end if;
    perform public.sched_check_patch(c.target_table, c.patch);

    if c.op = 'update' then
      select string_agg(format('%I = s.%I', k, k), ', ') into sets from jsonb_object_keys(c.patch) as k;
      if sets is not null then
        execute format(
          'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) s where t.id = $2',
          c.target_table, sets, c.target_table) using c.patch, c.target_id;
        get diagnostics n = row_count;
        if n = 0 then raise exception 'السجل لم يعد موجودًا (ربما حُذف)'; end if;
      end if;
    else
      select string_agg(format('%I', k), ', '), string_agg(format('s.%I', k), ', ')
        into cols, vals from jsonb_object_keys(c.patch) as k;
      if cols is null then raise exception 'لا توجد بيانات للإضافة'; end if;
      if c.target_table = 'inquiries' and not (c.patch ? 'id') then
        select coalesce(max(id), 0) + 1 into nid from public.inquiries;
        cols := 'id, ' || cols;
        vals := nid::text || ', ' || vals;
      end if;
      execute format(
        'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) s',
        c.target_table, cols, vals, c.target_table) using c.patch;
    end if;

    delete from public.scheduled_changes where id = p_id;
    insert into public.audit_log (user_name, action, details)
      values (coalesce(c.scheduled_by_name, 'نظام'), 'نشر مجدول', c.label);
    return true;
  exception when others then
    update public.scheduled_changes set status = 'failed', error = left(sqlerrm, 300) where id = p_id;
    return false;
  end;
end $$;

-- ── المهمة الدورية: تنفّذ كل ما حان وقته ──
create or replace function public.publish_due_changes()
returns integer
language plpgsql security definer set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in select id, scheduled_by from public.scheduled_changes
           where status = 'pending' and publish_at <= now() order by publish_at, id loop
    if public.apply_scheduled_change(r.id, r.scheduled_by) then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ── واجهة لوحة الإدارة (RPC) ──
create or replace function public.schedule_change(
  p_table text, p_id bigint, p_op text, p_patch jsonb, p_at timestamptz, p_label text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); who text; new_id bigint; patch jsonb := coalesce(p_patch, '{}'::jsonb);
begin
  if uid is null or not public.is_known_admin() then raise exception 'غير مصرّح'; end if;
  if p_op not in ('update','insert') then raise exception 'نوع العملية غير صحيح'; end if;
  if not public.sched_can(p_table, p_op) then raise exception 'ليست لديك صلاحية جدولة هذا النوع'; end if;
  if p_at is null or p_at <= now() then raise exception 'وقت النشر لازم يكون بالمستقبل'; end if;
  if p_op = 'update' and p_id is null then raise exception 'رقم السجل مطلوب'; end if;
  if patch = '{}'::jsonb then raise exception 'ما فيه تعديل للجدولة'; end if;
  perform public.sched_check_patch(p_table, patch);

  select coalesce(p.name, u.email) into who
    from auth.users u left join public.profiles p on p.id = u.id where u.id = uid;

  if p_op = 'update' then
    delete from public.scheduled_changes where target_table = p_table and target_id = p_id and op = 'update';
  end if;
  insert into public.scheduled_changes (target_table, target_id, op, patch, label, publish_at, scheduled_by, scheduled_by_name)
    values (p_table, case when p_op = 'update' then p_id end, p_op, patch, left(coalesce(p_label, ''), 300), p_at, uid, who)
    returning id into new_id;
  insert into public.audit_log (user_name, action, details)
    values (coalesce(who, 'نظام'), 'جدولة نشر',
            coalesce(p_label, '') || ' — ' || to_char(p_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI'));
  return new_id;
end $$;

create or replace function public.reschedule_changes(p_ids bigint[], p_at timestamptz)
returns integer
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); who text; n int;
begin
  if uid is null or not public.is_known_admin() then raise exception 'غير مصرّح'; end if;
  if p_at is null or p_at <= now() then raise exception 'وقت النشر لازم يكون بالمستقبل'; end if;
  update public.scheduled_changes set publish_at = p_at, status = 'pending', error = null
    where id = any(p_ids) and public.sched_can(target_table, op);
  get diagnostics n = row_count;
  if n > 0 then
    select coalesce(p.name, u.email) into who from auth.users u left join public.profiles p on p.id = u.id where u.id = uid;
    insert into public.audit_log (user_name, action, details)
      values (coalesce(who, 'نظام'), 'تغيير وقت نشر مجدول',
              n || ' عنصر — ' || to_char(p_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI'));
  end if;
  return n;
end $$;

create or replace function public.cancel_changes(p_ids bigint[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); who text; n int;
begin
  if uid is null or not public.is_known_admin() then raise exception 'غير مصرّح'; end if;
  delete from public.scheduled_changes where id = any(p_ids) and public.sched_can(target_table, op);
  get diagnostics n = row_count;
  if n > 0 then
    select coalesce(p.name, u.email) into who from auth.users u left join public.profiles p on p.id = u.id where u.id = uid;
    insert into public.audit_log (user_name, action, details)
      values (coalesce(who, 'نظام'), 'إلغاء نشر مجدول', n || ' عنصر');
  end if;
  return n;
end $$;

create or replace function public.publish_changes_now(p_ids bigint[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); r record; n int := 0;
begin
  if uid is null or not public.is_known_admin() then raise exception 'غير مصرّح'; end if;
  for r in select id from public.scheduled_changes where id = any(p_ids) order by publish_at, id loop
    if public.apply_scheduled_change(r.id, uid) then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ── الصلاحيات: الدوال الداخلية ما تُستدعى من المتصفح ──
revoke all on function public.apply_scheduled_change(bigint, uuid) from public, anon, authenticated;
revoke all on function public.publish_due_changes() from public, anon, authenticated;
revoke all on function public.sched_check_patch(text, jsonb) from public, anon, authenticated;
revoke all on function public.sched_can(text, text) from public, anon;
revoke all on function public.schedule_change(text, bigint, text, jsonb, timestamptz, text) from public, anon;
revoke all on function public.reschedule_changes(bigint[], timestamptz) from public, anon;
revoke all on function public.cancel_changes(bigint[]) from public, anon;
revoke all on function public.publish_changes_now(bigint[]) from public, anon;
grant execute on function public.sched_can(text, text) to authenticated;
grant execute on function public.schedule_change(text, bigint, text, jsonb, timestamptz, text) to authenticated;
grant execute on function public.reschedule_changes(bigint[], timestamptz) to authenticated;
grant execute on function public.cancel_changes(bigint[]) to authenticated;
grant execute on function public.publish_changes_now(bigint[]) to authenticated;

-- ── الفحص الدوري كل دقيقة ──
do $$
begin
  if exists (select 1 from cron.job where jobname = 'publish-scheduled-changes') then
    perform cron.unschedule('publish-scheduled-changes');
  end if;
  perform cron.schedule('publish-scheduled-changes', '* * * * *', 'select public.publish_due_changes();');
end $$;
