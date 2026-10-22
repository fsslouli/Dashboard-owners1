-- migration-owner-title.sql — عمود «منصب صاحب الرد» للاستفسارات (6.7.0)
-- الاسم يبقى في owner، والمنصب في عمود مستقل owner_title (نص حر، والقيم المعتمدة بجدول الفلاتر).
-- idempotent: تشغيله أكثر من مرة آمن. الموقع يشتغل قبل تطبيقه (يتجاهل العمود) وبعده يظهر المنصب والفلتر تلقائيًا.

alter table public.inquiries add column if not exists owner_title text;
grant select (owner_title) on public.inquiries to anon, authenticated;

-- تعبئة أولية ذرّية بدون تسجيل مراجعات وبدون تحريك updated_at (تنظيف شكلي، مو تعديل محتوى):
--   «الاسم (المنصب)» ← الاسم في owner والمنصب في owner_title (مثل «أبو سلطان (مالك)»)،
--   ثم المنصب حسب الاسم للمسؤولين المعروفين.
do $$
begin
  alter table public.inquiries disable trigger user;
  update public.inquiries
     set owner_title = coalesce(owner_title, (regexp_match(owner, '^\s*(.*\S)\s*\(([^()]+)\)\s*$'))[2]),
         owner       = (regexp_match(owner, '^\s*(.*\S)\s*\(([^()]+)\)\s*$'))[1]
   where owner ~ '^\s*.*\S\s*\([^()]+\)\s*$';
  update public.inquiries set owner_title = 'مدير المشروع'         where owner_title is null and owner = 'م/محمد عبدالمعطي';
  update public.inquiries set owner_title = 'مدير العمليات'        where owner_title is null and owner = 'م/أحمد ملحم';
  update public.inquiries set owner_title = 'مدير المبيعات السابق' where owner_title is null and owner = 'م/رواحه';
  update public.inquiries set owner_title = 'مديرة المبيعات الأولى' where owner_title is null and owner = 'وديان';
  update public.inquiries set owner_title = 'الرئيس التنفيذي'      where owner_title is null and owner = 'أدولفو';
  alter table public.inquiries enable trigger user;
end $$;

-- قيم الفلتر: قائمة المناصب المعتمدة، وأسماء «الجهة المجيبة» بعد فصل المنصب عنها
insert into public.filter_categories (key, label, locked, values)
values ('owner_title', 'منصب صاحب الرد', true,
        array['مدير المشروع','مدير العمليات','مديرة المبيعات الأولى','مدير المبيعات السابق','الرئيس التنفيذي','مالك'])
on conflict (key) do nothing;
update public.filter_categories
   set values = (
     select coalesce(array_agg(v order by o), '{}')
       from (select distinct on (v) v, o
               from (select coalesce((regexp_match(x, '^\s*(.*\S)\s*\(([^()]+)\)\s*$'))[1], x) v, o
                       from unnest(values) with ordinality t(x, o)) s
              order by v, o) d)
 where key = 'owner';
update public.filter_categories set values = array_append(values, 'وديان')
 where key = 'owner' and not ('وديان' = any(values));

-- تتبع تعديلات العمود في سجل المراجعات
create or replace function public.log_inquiry_revision()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  ch jsonb := '{}'::jsonb;
  f text;
  ov text; nv text;
  tracked text[] := array['model','loc','pri','cat','party','status','owner','owner_title','month','note','reply',
                          'closed','answered','urgent','important','meetings'];
begin
  if coalesce(current_setting('app.bulk_import', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    insert into public.inquiry_revisions (inquiry_id, op, changed_by, changes)
    values (new.id, 'insert', new.updated_by,
            jsonb_build_object('note', jsonb_build_object('from', null, 'to', new.note)));
    return new;
  end if;
  if tg_op = 'DELETE' then
    insert into public.inquiry_revisions (inquiry_id, op, changed_by, changes)
    values (old.id, 'delete', null,
            jsonb_build_object('note', jsonb_build_object('from', old.note, 'to', null)));
    return old;
  end if;
  foreach f in array tracked loop
    execute format('select ($1).%I::text, ($2).%I::text', f, f) into ov, nv using old, new;
    if ov is distinct from nv then
      ch := ch || jsonb_build_object(f, jsonb_build_object('from', ov, 'to', nv));
    end if;
  end loop;
  if ch <> '{}'::jsonb then
    insert into public.inquiry_revisions (inquiry_id, op, changed_by, changes)
    values (new.id, 'update', new.updated_by, ch);
  end if;
  return new;
end $function$;

-- استبدال كامل من إكسل يحفظ العمود
create or replace function public.replace_inquiries_full(p_rows jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_perm('import_excel') then
    raise exception 'لا توجد صلاحية لاستبدال بيانات الاستفسارات';
  end if;
  perform set_config('app.bulk_import', 'on', true);
  delete from public.inquiries;
  if p_rows is not null and jsonb_array_length(p_rows) > 0 then
    insert into public.inquiries
      (id, model, loc, pri, cat, party, status, owner, owner_title, month, note, note_en, reply, reply_en,
       closed, urgent, answered, meetings, updated_at, last_modified, important,
       created_at, urgent_until, important_until)
    select
      r.id, r.model, r.loc, r.pri, r.cat, r.party, r.status, r.owner, r.owner_title, r.month, r.note, r.note_en, r.reply, r.reply_en,
      r.closed, coalesce(r.urgent, false), r.answered, r.meetings, coalesce(r.updated_at, now()), r.last_modified,
      coalesce(r.important, false), coalesce(r.created_at, now()), r.urgent_until, r.important_until
    from jsonb_populate_recordset(null::public.inquiries, p_rows) as r;
  end if;
  insert into public.inquiry_revisions (inquiry_id, op, changed_by, changes)
  values (0, 'bulk', null, jsonb_build_object('rows', jsonb_build_object('from', null, 'to', coalesce(jsonb_array_length(p_rows),0))));
  perform set_config('app.bulk_import', 'off', true);
end;
$function$;

-- إعادة تسمية/حذف قيمة من لوحة «الفلاتر» تشمل المنصب
create or replace function public.rename_filter_value(p_key text, p_old text, p_new text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_target_exists boolean;
begin
  if not coalesce(public.has_perm('manage_filters'), false) then
    raise exception 'ليست لديك صلاحية إدارة الفلاتر';
  end if;
  if p_old is null or btrim(p_old) = '' or p_new is null or btrim(p_new) = '' then
    raise exception 'القيمة القديمة أو الجديدة فارغة';
  end if;
  if p_old = p_new then
    return;
  end if;

  if p_key = 'pri' then
    update public.inquiries set pri = p_new where pri = p_old;
  elsif p_key = 'cat' then
    update public.inquiries set cat = p_new where cat = p_old;
  elsif p_key = 'status' then
    update public.inquiries set status = p_new where status = p_old;
  elsif p_key = 'owner' then
    update public.inquiries set owner = p_new where owner = p_old;
  elsif p_key = 'owner_title' then
    update public.inquiries set owner_title = p_new where owner_title = p_old;
  elsif p_key = 'meeting' then
    update public.inquiries
      set meetings = (
        select coalesce(jsonb_agg(case when e = p_old then to_jsonb(p_new) else to_jsonb(e) end), '[]'::jsonb)
        from jsonb_array_elements_text(meetings) as e
      )
      where meetings @> jsonb_build_array(p_old);
  else
    raise exception 'فئة غير مدعومة لإعادة التسمية: %', p_key;
  end if;

  select exists(
    select 1 from public.filter_categories, jsonb_array_elements_text(to_jsonb(values)) v
    where key = p_key and v = p_new
  ) into v_target_exists;

  if v_target_exists then
    update public.filter_categories
      set values = (select coalesce(array_agg(v), '{}') from unnest(values) v where v <> p_old)
      where key = p_key;
  else
    update public.filter_categories
      set values = (select coalesce(array_agg(case when v = p_old then p_new else v end), '{}') from unnest(values) v)
      where key = p_key;
  end if;
end;
$function$;

create or replace function public.delete_filter_value(p_key text, p_val text, p_force boolean default false)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count integer := 0;
begin
  if not coalesce(public.has_perm('manage_filters'), false) then
    raise exception 'ليست لديك صلاحية إدارة الفلاتر';
  end if;

  if p_key = 'pri' then
    select count(*) into v_count from public.inquiries where pri = p_val;
    if v_count > 0 then
      if not p_force then return v_count; end if;
      update public.inquiries set pri = null where pri = p_val;
    end if;
  elsif p_key = 'cat' then
    select count(*) into v_count from public.inquiries where cat = p_val;
    if v_count > 0 then
      if not p_force then return v_count; end if;
      update public.inquiries set cat = null where cat = p_val;
    end if;
  elsif p_key = 'status' then
    select count(*) into v_count from public.inquiries where status = p_val;
    if v_count > 0 then
      if not p_force then return v_count; end if;
      update public.inquiries set status = null where status = p_val;
    end if;
  elsif p_key = 'owner' then
    select count(*) into v_count from public.inquiries where owner = p_val;
    if v_count > 0 then
      if not p_force then return v_count; end if;
      update public.inquiries set owner = null where owner = p_val;
    end if;
  elsif p_key = 'owner_title' then
    select count(*) into v_count from public.inquiries where owner_title = p_val;
    if v_count > 0 then
      if not p_force then return v_count; end if;
      update public.inquiries set owner_title = null where owner_title = p_val;
    end if;
  elsif p_key = 'meeting' then
    select count(*) into v_count from public.inquiries where meetings @> jsonb_build_array(p_val);
    if v_count > 0 then
      if not p_force then return v_count; end if;
      update public.inquiries
        set meetings = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(meetings) e where e <> to_jsonb(p_val))
        where meetings @> jsonb_build_array(p_val);
    end if;
  else
    raise exception 'فئة غير مدعومة للحذف: %', p_key;
  end if;

  update public.filter_categories
    set values = (select coalesce(array_agg(v), '{}') from unnest(values) v where v <> p_val)
    where key = p_key;
  return 0;
end;
$function$;
