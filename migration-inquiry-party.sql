-- migration-inquiry-party.sql — عمود «الجهة المختصة» للاستفسارات (6.4.0)
-- القيم: «فريق المشروع» | «المبيعات وما بعد البيع». idempotent، ولا يُطبَّق إلا بموافقة المالك.
-- الموقع يشتغل قبل تطبيقه (يتجاهل العمود) وبعده يظهر الفلتر والجهة تلقائيًا.

alter table public.inquiries add column if not exists party text;

-- تعبئة أولية ذرّية: المبيعات = الاستفسارات 7 و77 و78 و80 و81، والباقي فريق المشروع (بدون تسجيل مراجعات)
do $$
begin
  alter table public.inquiries disable trigger user;
  update public.inquiries set party = 'المبيعات وما بعد البيع' where party is null and id in (7,77,78,80,81);
  update public.inquiries set party = 'فريق المشروع' where party is null;
  alter table public.inquiries enable trigger user;
end $$;

grant select (party) on public.inquiries to anon, authenticated;

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
  tracked text[] := array['model','loc','pri','cat','party','status','owner','month','note','reply',
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
      (id, model, loc, pri, cat, party, status, owner, month, note, note_en, reply, reply_en,
       closed, urgent, answered, meetings, updated_at, last_modified, important,
       created_at, urgent_until, important_until)
    select
      r.id, r.model, r.loc, r.pri, r.cat, r.party, r.status, r.owner, r.month, r.note, r.note_en, r.reply, r.reply_en,
      r.closed, coalesce(r.urgent, false), r.answered, r.meetings, coalesce(r.updated_at, now()), r.last_modified,
      coalesce(r.important, false), coalesce(r.created_at, now()), r.urgent_until, r.important_until
    from jsonb_populate_recordset(null::public.inquiries, p_rows) as r;
  end if;
  insert into public.inquiry_revisions (inquiry_id, op, changed_by, changes)
  values (0, 'bulk', null, jsonb_build_object('rows', jsonb_build_object('from', null, 'to', coalesce(jsonb_array_length(p_rows),0))));
  perform set_config('app.bulk_import', 'off', true);
end;
$function$;
