-- ═══════════════════════════════════════════════════════════════════════
-- migration-i18n-pro.sql — نظام الترجمة الاحترافي (6.8.0)
-- شغّله مرة وحدة من Supabase → SQL Editor (آمن لو انعاد تشغيله).
--
-- الجزء ١ (معاملة وحدة: يا ينطبق كله يا ما ينطبق شي):
--   • نسخة احتياطية كاملة للاستفسارات قبل أي تعديل.
--   • تتبع حداثة الترجمة لكل حقل: بصمة النص العربي + مصدر الترجمة (claude / human / machine).
--     أي تعديل بالعربي يخلي الترجمة «قديمة» فتُعاد تلقائيًا — من أي مكان جا التعديل (لوحة، إكسل، جدولة، SQL).
--   • ذاكرة ترجمة للأسماء والمناصب وقيم الفلاتر والإشعارات وملاحظات الأشهر (جدول i18n_memory).
--   • كتابة محرّك الترجمة ما تحرّك «آخر تحديث» ولا «آخر من عدّل» ولا تنسجل كتعديل محتوى.
--   • تصحيح 55 ترجمة إنجليزية موجودة (مراجعة يدوية) + توحيد أسماء النماذج + عناوين الوسائط.
-- الجزء ٢: جدولة كل ٥ دقائق تستدعي محرّك الترجمة (يحتاج امتداد pg_net).
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ١) نسخة احتياطية (تظهر بقائمة النسخ الاحتياطية بلوحة المزامنة)
insert into public.data_backups (label, inquiries, progress)
select 'قبل نظام الترجمة الاحترافي (6.8.0)',
       coalesce((select jsonb_agg(to_jsonb(i)) from public.inquiries i), '[]'::jsonb),
       coalesce((select jsonb_agg(to_jsonb(p)) from public.progress p), '[]'::jsonb)
where not exists (select 1 from public.data_backups where label = 'قبل نظام الترجمة الاحترافي (6.8.0)');

-- ٢) حالة الترجمة لكل استفسار (داخلية: بصمة العربي + المصدر + ملاحظات الجودة)
alter table public.inquiries add column if not exists i18n jsonb not null default '{}'::jsonb;
grant select (i18n) on public.inquiries to anon;

create or replace function public.i18n_hash(t text) returns text
language sql immutable set search_path = pg_catalog as $$
  select left(encode(sha256(convert_to(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g'), 'UTF8')), 'hex'), 16)
$$;

-- ٣) ذاكرة الترجمة: { عربي → إنجليزي } لكل نص قصير/ديناميكي يتكرر بالموقع
create table if not exists public.i18n_memory (
  ar text primary key,
  en text not null default '',
  kind text not null default 'label',
  engine text not null default 'claude',
  flags jsonb not null default '[]'::jsonb,
  fails int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.i18n_memory enable row level security;
drop policy if exists "قراءة عامة - ذاكرة الترجمة" on public.i18n_memory;
create policy "قراءة عامة - ذاكرة الترجمة" on public.i18n_memory for select using (true);
drop policy if exists "كتابة - ذاكرة الترجمة" on public.i18n_memory;
create policy "كتابة - ذاكرة الترجمة" on public.i18n_memory for all to authenticated
  using (public.has_perm('manage_theme') or public.has_perm('edit_inquiry'))
  with check (public.has_perm('manage_theme') or public.has_perm('edit_inquiry'));
grant select on public.i18n_memory to anon, authenticated;
grant insert, update, delete on public.i18n_memory to authenticated;

create or replace function public.i18n_memory_track() returns trigger
language plpgsql set search_path = public as $$
begin
  new.ar := btrim(new.ar);
  new.en := btrim(coalesce(new.en, ''));
  new.updated_at := now();
  if coalesce(current_setting('app.i18n_write', true), '') <> 'on' then
    -- تعديل يدوي من لوحة الإدارة: يُعتمد «مراجَع» ولا يكتب عليه المحرّك (والتفريغ = أعد الترجمة)
    new.engine := case when new.en = '' then 'pending' else 'human' end;
    new.flags := '[]'::jsonb;
    new.fails := 0;
  end if;
  return new;
end $$;
drop trigger if exists trg_i18n_memory_track on public.i18n_memory;
create trigger trg_i18n_memory_track before insert or update on public.i18n_memory
  for each row execute function public.i18n_memory_track();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'i18n_memory') then
    alter publication supabase_realtime add table public.i18n_memory;
  end if;
end $$;

-- ٤) حالة المحرّك (قفل التشغيل + آخر نتيجة + التأجيل عند انتهاء الحصة) — قراءة للمشرفين فقط
create table if not exists public.i18n_state (
  id smallint primary key default 1 check (id = 1),
  lock_until timestamptz,
  last_run_at timestamptz,
  last_engine text,
  has_key boolean,
  model text,
  last_result jsonb,
  last_error text,
  machine_backoff_until timestamptz,
  claude_backoff_until timestamptz
);
insert into public.i18n_state (id) values (1) on conflict (id) do nothing;
alter table public.i18n_state enable row level security;
drop policy if exists "قراءة - حالة الترجمة" on public.i18n_state;
create policy "قراءة - حالة الترجمة" on public.i18n_state for select to authenticated using (true);
revoke all on public.i18n_state from anon;
grant select on public.i18n_state to authenticated;
revoke insert, update, delete on public.i18n_state from authenticated;

-- ٥) التريقرات الحالية: كتابة المحرّك (app.i18n_write) ما تُعدّ تعديل محتوى
create or replace function public.check_inquiry_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  flag_cols text[] := array['urgent','urgent_until','important','important_until','last_modified'];
  skip_cols text[] := array['updated_at','updated_by'];
  col text;
begin
  -- 6.8.0: كتابة محرّك الترجمة (عبر i18n_apply / i18n_fail فقط) تمس الإنجليزي وحالة الترجمة لا غير
  if coalesce(current_setting('app.i18n_write', true), '') = 'on' then return new; end if;
  for col in select jsonb_object_keys(to_jsonb(new)) loop
    if col = any(skip_cols) then continue; end if;
    if (to_jsonb(old) ->> col) is not distinct from (to_jsonb(new) ->> col) then continue; end if;
    if col = any(flag_cols) then
      if not public.has_perm('flag_urgent') then
        raise exception 'لا توجد صلاحية لتعديل وسوم العرض (يجب الاطلاع/مهم/جديد)';
      end if;
    else
      if not (public.has_perm('edit_inquiry') or public.has_perm('import_excel')) then
        raise exception 'لا توجد صلاحية لتعديل محتوى الاستفسار';
      end if;
    end if;
  end loop;
  return new;
end $function$;

create or replace function public.set_inquiry_updated_at()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- 6.8.0: الترجمة الآلية ما تخلّي البند يبان «محدّث»
  if coalesce(current_setting('app.i18n_write', true), '') = 'on' then
    new.updated_at = old.updated_at;
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.stamp_inquiry_author()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare who text;
begin
  -- 6.8.0: الترجمة الآلية ما تغيّر «آخر من عدّل»
  if tg_op = 'UPDATE' and coalesce(current_setting('app.i18n_write', true), '') = 'on' then
    new.updated_by := old.updated_by;
    new.created_by := old.created_by;
    return new;
  end if;
  select coalesce(p.name, u.email) into who
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = auth.uid();
  who := coalesce(who, 'نظام');
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, who);
    new.updated_by := who;
  else
    new.updated_by := who;
    new.created_by := coalesce(old.created_by, new.created_by);
  end if;
  return new;
end $function$;

-- ٦) تتبع حداثة الترجمة عند أي حفظ بشري (لوحة، إكسل، جدولة، SQL)
--    • إنجليزي فاضي ← بلا حالة (المحرّك يترجمه)
--    • إنجليزي كتبه/عدّله إنسان ← «مراجَع» ببصمة العربي الحالية (المحرّك ما يكتب عليه)
--    • عربي تغيّر والإنجليزي ما تغيّر ← البصمة ما تطابق ← «قديمة» (المحرّك يعيد ترجمتها)
create or replace function public.inquiry_i18n_track() returns trigger
language plpgsql set search_path = public as $$
declare f text; ar text; en text; old_en text; m jsonb; old_m jsonb;
begin
  if coalesce(current_setting('app.i18n_write', true), '') = 'on' then return new; end if;
  new.i18n := coalesce(new.i18n, '{}'::jsonb);
  foreach f in array array['note', 'reply'] loop
    if f = 'note' then ar := new.note; en := new.note_en; else ar := new.reply; en := new.reply_en; end if;
    m := new.i18n -> f;
    old_en := null; old_m := null;
    if tg_op = 'UPDATE' then
      if f = 'note' then old_en := old.note_en; else old_en := old.reply_en; end if;
      old_m := coalesce(old.i18n, '{}'::jsonb) -> f;
    end if;
    if coalesce(btrim(en), '') = '' then
      new.i18n := new.i18n - f;
    elsif tg_op = 'INSERT' then
      if m is null or (m ->> 'h') is null then
        new.i18n := jsonb_set(new.i18n, array[f], jsonb_build_object('h', public.i18n_hash(ar), 'e', 'human', 't', now()));
      end if;
    elsif en is distinct from old_en and m is not distinct from old_m then
      new.i18n := jsonb_set(new.i18n, array[f], jsonb_build_object('h', public.i18n_hash(ar), 'e', 'human', 't', now()));
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_i18n_track on public.inquiries;
create trigger trg_i18n_track before insert or update on public.inquiries
  for each row execute function public.inquiry_i18n_track();

-- ٧) دوال المحرّك
-- ما ينتظر ترجمة من نصوص الاستفسارات: ناقص (missing) / قديم (stale) / آلي يُرقّى لـ Claude (upgrade)
create or replace function public.i18n_pending(p_upgrade boolean default false, p_limit int default 80)
returns table(id int, field text, ar text, h text, engine text, reason text)
language sql stable security definer set search_path = public as $$
  with f as (
    select i.id, 'note'::text as field, i.note as ar, i.note_en as en, coalesce(i.i18n, '{}'::jsonb) -> 'note' as m from public.inquiries i
    union all
    select i.id, 'reply'::text, i.reply, i.reply_en, coalesce(i.i18n, '{}'::jsonb) -> 'reply' from public.inquiries i
  ), g as (
    select f.*, public.i18n_hash(f.ar) as hh,
           (coalesce(btrim(f.en), '') = '' or f.en ~* '(MYMEMORY WARNING|QUERY LENGTH LIMIT|WORDS LIMIT EXCEEDED)') as missing
    from f where coalesce(btrim(f.ar), '') <> ''
  )
  select g.id, g.field, g.ar, g.hh, g.m ->> 'e',
         case when g.missing then 'missing' when (g.m ->> 'h') is distinct from g.hh then 'stale' else 'upgrade' end
  from g
  where (g.missing or (g.m ->> 'h') is distinct from g.hh or (p_upgrade and g.m ->> 'e' = 'machine'))
    and not (coalesce((g.m ->> 'fails')::int, 0) >= 3 and (g.m ->> 'fh') = g.hh)
  order by 6, 1 desc
  limit greatest(1, least(coalesce(p_limit, 80), 500))
$$;

-- ما ينتظر ترجمة من الأسماء والمناصب والقيم والإشعارات وملاحظات الأشهر
create or replace function public.i18n_pending_terms(p_upgrade boolean default false, p_limit int default 150)
returns table(ar text, kind text, reason text)
language sql stable security definer set search_path = public as $$
  with src(v, k) as (
    select btrim(owner), 'person' from public.inquiries
    union all select btrim(owner_title), 'title' from public.inquiries
    union all select btrim(loc), 'label' from public.inquiries
    union all select btrim(cat), 'label' from public.inquiries
    union all select btrim(pri), 'label' from public.inquiries
    union all select btrim(status), 'label' from public.inquiries
    union all select btrim(party), 'label' from public.inquiries
    union all select btrim(model), 'label' from public.inquiries
    union all select btrim(mm.v), 'label' from public.inquiries i
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(i.meetings) = 'array' then i.meetings else '[]'::jsonb end) as mm(v)
    union all select btrim(u.v), case fc.key when 'owner' then 'person' when 'owner_title' then 'title' else 'label' end
      from public.filter_categories fc cross join lateral unnest(fc.values) as u(v)
      where fc.key in ('owner', 'owner_title', 'loc', 'cat', 'pri', 'status', 'meeting', 'model')
    union all select btrim(n.title), 'text' from public.notices n
    union all select btrim(n.body), 'text' from public.notices n
    union all select btrim(p.note), 'text' from public.progress_month_notes p
  ), d as (
    select distinct on (v) v, k from src
    where v is not null and v <> '' and v ~ '[ء-ي]'
    order by v, (k = 'text'), k
  )
  select d.v, d.k, case when t.ar is null or coalesce(btrim(t.en), '') = '' then 'missing' else 'upgrade' end
  from d left join public.i18n_memory t on t.ar = d.v
  where t.ar is null
     or (coalesce(btrim(t.en), '') = '' and not (t.engine = 'failed' and t.fails >= 3))
     or (p_upgrade and t.engine = 'machine')
  order by 3, 1
  limit greatest(1, least(coalesce(p_limit, 150), 500))
$$;

-- حفظ نتائج المحرّك (للاستفسارات: بس لو العربي ما تغيّر أثناء الترجمة — مطابقة البصمة)
create or replace function public.i18n_apply(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; k int; f text; meta jsonb;
begin
  perform set_config('app.i18n_write', 'on', true);
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if it ->> 'type' = 'inq' and it ->> 'field' in ('note', 'reply') and coalesce(btrim(it ->> 'en'), '') <> '' then
      f := it ->> 'field';
      meta := jsonb_build_object('h', it ->> 'h', 'e', coalesce(it ->> 'e', 'machine'), 'f', coalesce(it -> 'f', '[]'::jsonb), 't', now());
      if f = 'note' then
        update public.inquiries set note_en = btrim(it ->> 'en'), i18n = jsonb_set(coalesce(i18n, '{}'::jsonb), '{note}', meta)
         where id = (it ->> 'id')::int and public.i18n_hash(note) = it ->> 'h';
      else
        update public.inquiries set reply_en = btrim(it ->> 'en'), i18n = jsonb_set(coalesce(i18n, '{}'::jsonb), '{reply}', meta)
         where id = (it ->> 'id')::int and public.i18n_hash(reply) = it ->> 'h';
      end if;
      get diagnostics k = row_count; n := n + k;
    elsif it ->> 'type' = 'term' and coalesce(btrim(it ->> 'ar'), '') <> '' and coalesce(btrim(it ->> 'en'), '') <> '' then
      insert into public.i18n_memory as t (ar, en, kind, engine, flags, fails)
      values (btrim(it ->> 'ar'), btrim(it ->> 'en'), coalesce(it ->> 'kind', 'label'), coalesce(it ->> 'e', 'machine'), coalesce(it -> 'f', '[]'::jsonb), 0)
      on conflict (ar) do update set en = excluded.en, kind = excluded.kind, engine = excluded.engine, flags = excluded.flags, fails = 0
       where t.engine <> 'human' or coalesce(btrim(t.en), '') = '';
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  perform set_config('app.i18n_write', 'off', true);
  return n;
end $$;

-- تسجيل محاولة فاشلة (بعد ٣ محاولات لنفس النص يتوقف التكرار حتى يتغيّر النص)
create or replace function public.i18n_fail(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; k int; f text;
begin
  perform set_config('app.i18n_write', 'on', true);
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if it ->> 'type' = 'inq' and it ->> 'field' in ('note', 'reply') then
      f := it ->> 'field';
      update public.inquiries
         set i18n = jsonb_set(coalesce(i18n, '{}'::jsonb), array[f],
               coalesce(coalesce(i18n, '{}'::jsonb) -> f, '{}'::jsonb) || jsonb_build_object('fh', it ->> 'h',
                 'fails', case when (coalesce(i18n, '{}'::jsonb) -> f ->> 'fh') = it ->> 'h'
                               then coalesce((coalesce(i18n, '{}'::jsonb) -> f ->> 'fails')::int, 0) + 1 else 1 end))
       where id = (it ->> 'id')::int;
      get diagnostics k = row_count; n := n + k;
    elsif it ->> 'type' = 'term' and coalesce(btrim(it ->> 'ar'), '') <> '' then
      insert into public.i18n_memory as t (ar, en, kind, engine, fails)
      values (btrim(it ->> 'ar'), '', coalesce(it ->> 'kind', 'label'), 'failed', 1)
      on conflict (ar) do update set fails = t.fails + 1,
        engine = case when coalesce(btrim(t.en), '') = '' then 'failed' else t.engine end;
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  perform set_config('app.i18n_write', 'off', true);
  return n;
end $$;

-- قفل تشغيل واحد بنفس الوقت (ينفك تلقائيًا لو تعطّل التشغيل)
create or replace function public.i18n_claim(p_seconds int default 150) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update public.i18n_state set lock_until = now() + make_interval(secs => greatest(30, least(coalesce(p_seconds, 150), 600)))
   where id = 1 and (lock_until is null or lock_until < now())
  returning true into ok;
  return coalesce(ok, false);
end $$;

create or replace function public.i18n_release(p_engine text, p_has_key boolean, p_model text, p_result jsonb, p_error text,
  p_machine_backoff_min int default 0, p_claude_backoff_min int default 0) returns void
language sql security definer set search_path = public as $$
  update public.i18n_state set
    lock_until = null, last_run_at = now(), last_engine = p_engine, has_key = p_has_key, model = p_model,
    last_result = p_result, last_error = left(p_error, 400),
    machine_backoff_until = case when coalesce(p_machine_backoff_min, 0) > 0 then now() + make_interval(mins => p_machine_backoff_min) else machine_backoff_until end,
    claude_backoff_until = case when coalesce(p_claude_backoff_min, 0) > 0 then now() + make_interval(mins => p_claude_backoff_min)
                                when p_engine like 'claude%' and p_error is null then null else claude_backoff_until end
  where id = 1
$$;

-- الصلاحيات: الكتابة للمحرّك فقط (service_role)، والقراءة للمشرفين
revoke all on function public.i18n_apply(jsonb) from public, anon, authenticated;
revoke all on function public.i18n_fail(jsonb) from public, anon, authenticated;
revoke all on function public.i18n_claim(int) from public, anon, authenticated;
revoke all on function public.i18n_release(text, boolean, text, jsonb, text, int, int) from public, anon, authenticated;
grant execute on function public.i18n_apply(jsonb) to service_role;
grant execute on function public.i18n_fail(jsonb) to service_role;
grant execute on function public.i18n_claim(int) to service_role;
grant execute on function public.i18n_release(text, boolean, text, jsonb, text, int, int) to service_role;
revoke all on function public.i18n_pending(boolean, int) from public, anon;
revoke all on function public.i18n_pending_terms(boolean, int) from public, anon;
grant execute on function public.i18n_pending(boolean, int) to authenticated, service_role;
grant execute on function public.i18n_pending_terms(boolean, int) to authenticated, service_role;

-- ٨) الاستبدال الكامل من إكسل يحفظ حالة الترجمة (كان يضيّعها)
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
       created_at, urgent_until, important_until, i18n)
    select
      r.id, r.model, r.loc, r.pri, r.cat, r.party, r.status, r.owner, r.owner_title, r.month, r.note, r.note_en, r.reply, r.reply_en,
      r.closed, coalesce(r.urgent, false), r.answered, r.meetings, coalesce(r.updated_at, now()), r.last_modified,
      coalesce(r.important, false), coalesce(r.created_at, now()), r.urgent_until, r.important_until, coalesce(r.i18n, '{}'::jsonb)
    from jsonb_populate_recordset(null::public.inquiries, p_rows) as r;
  end if;
  insert into public.inquiry_revisions (inquiry_id, op, changed_by, changes)
  values (0, 'bulk', null, jsonb_build_object('rows', jsonb_build_object('from', null, 'to', coalesce(jsonb_array_length(p_rows),0))));
  perform set_config('app.bulk_import', 'off', true);
end;
$function$;

-- ٩) البيانات: تصحيح الترجمات الحالية (مراجعة يدوية) — بدون تحريك «آخر تحديث» ولا «آخر من عدّل»
select set_config('app.i18n_write', 'on', true);

update public.inquiries set note_en = $q$The current design of the interior doors is aesthetically unsuitable — proposed solution: change the interior door design to a more suitable model.$q$ where id = 1;
update public.inquiries set reply_en = $q$The interior doors for all models will be redesigned in another color (most likely off-white).$q$ where id = 1;
update public.inquiries set note_en = $q$Lack of transparency about the waterproofing method and the type of waterproofing that will be used in the kitchen and bathrooms — proposed solution: ensure good waterproofing for the kitchen and all bathrooms, with the waterproofing raised 20 cm up the walls to avoid dampness.$q$ where id = 2;
update public.inquiries set reply_en = $q$The waterproofing used is bituminous membrane rolls in kitchens and bathrooms, raised 20 cm on all walls.$q$ where id = 2;
update public.inquiries set note_en = $q$The way the sill flashings are executed on the existing window may cause water to pool and dampness to appear on the façade — proposed solution: redo the sill flashings in a way that prevents water pooling and moisture seepage.$q$ where id = 3;
update public.inquiries set reply_en = $q$The sill flashings will be installed outside the aluminum frame, sloping outward, which ensures water will not collect in the future.$q$ where id = 3;
update public.inquiries set note_en = $q$Ceramic is of lower quality than porcelain and is less durable for long-term use — proposed solution: upgrade the finish to porcelain.$q$ where id = 4;
update public.inquiries set reply_en = $q$The finishes were upgraded from ceramic to porcelain.$q$ where id = 4;
update public.inquiries set note_en = $q$There is no gypsum board on the first and second floors — proposed solution: upgrade all floors to gypsum board except the roof.$q$ where id = 5;
update public.inquiries set reply_en = $q$Upgraded to gypsum board in all bedrooms, excluding the corridors.$q$ where id = 5;
update public.inquiries set note_en = $q$There is no advance rough-in for surveillance cameras in any of the models — proposed solution: approve the execution and wiring of external surveillance camera points for all models.$q$ where id = 6;
update public.inquiries set reply_en = $q$Rough-in of surveillance camera points has been approved in all models.$q$ where id = 6;
update public.inquiries set note_en = $q$Eligible owners have not been told how to obtain the offer — proposed solution: inform owners how to benefit from the discount.$q$ where id = 7;
update public.inquiries set reply_en = $q$Owners will be told how to benefit from the offer after the units are handed over.$q$ where id = 7;
update public.inquiries set note_en = $q$It has not been clarified which waterproofing material will be used in the external planters — proposed solution: clarify the type of waterproofing used in the external planters.$q$ where id = 8;
update public.inquiries set reply_en = $q$The external planters will be fully waterproofed to avoid dampness and later damage to the structure.$q$ where id = 8;
update public.inquiries set note_en = $q$Number of electrical outlets in all models — proposed solution: increase the number of outlets in all models.$q$ where id = 9;
update public.inquiries set reply_en = $q$The outlets have already been re-roughed-in and their number increased, matching the show villa.$q$ where id = 9;
update public.inquiries set note_en = $q$The tank is located beneath the car parking — proposed solution: move the ground tank to beneath the garden to avoid future problems of settlement, cracking of the water tank and water leakage.$q$ where id = 10;
update public.inquiries set reply_en = $q$The ground tank will be reinforced with beams and tie beams, and the floor slab will be reinforced to withstand heavy loads such as cars.$q$ where id = 10;
update public.inquiries set note_en = $q$It is not clear whether CAT6 cables will be installed within the project — proposed solution: run and install CAT6 cables so the home can easily be converted into a smart home and fiber-optic internet installed in the future.$q$ where id = 11;
update public.inquiries set reply_en = $q$Cables will be run, installed and supplied on all floors, and a server location will be provided in the storeroom (without installing cameras or servers).$q$ where id = 11;
update public.inquiries set note_en = $q$The light well floor has no drain or pipe at all for draining rainwater or wash-down water in the future — proposed solution: install a drainage system or clarify the proposed engineering measure to resolve this issue.$q$ where id = 12;
update public.inquiries set reply_en = $q$No drain opening is needed, since it is executed in a way that prevents liquids from entering the light well, and it will be closed with a mesh to keep insects out in the future.$q$ where id = 12;
update public.inquiries set note_en = $q$Tiling over leftover wood and nails in the project, which may cause termites and floor settlement — proposed solution: require contractors to clean the floor before starting tiling work in the project.$q$ where id = 13;
update public.inquiries set reply_en = $q$Contractors will be notified of this.$q$ where id = 13;
update public.inquiries set note_en = $q$The 4-inch internal sewage pipe size is insufficient — proposed solution: install a 6-inch sewage pipe to avoid future drain blockage.$q$ where id = 14;
update public.inquiries set reply_en = $q$This will be modified in the Albada model only (the largest model).$q$ where id = 14;
update public.inquiries set note_en = $q$The bathroom walls are tiled only up to mid-height, which may cause water and moisture to collect inside the wall — proposed solution: complete the construction and tiling of the full bathroom walls to avoid moisture inside the wall in the future.$q$ where id = 15;
update public.inquiries set reply_en = $q$It will be approved as it is in the show villa.$q$ where id = 15;
update public.inquiries set note_en = $q$The tank capacity of only 5,000 liters does not match the expected usage — proposed solution: enlarge the ground tank to more than 7,000 liters.$q$ where id = 16;
update public.inquiries set reply_en = $q$5 cubic meters approved for all models.$q$ where id = 16;
update public.inquiries set note_en = $q$Not providing a hot water line (bidet spray) is inconsistent with the normal use of bathrooms — proposed solution: run a hot bidet-spray line to all bathrooms.$q$ where id = 17;
update public.inquiries set reply_en = $q$Cold water only was approved.$q$ where id = 17;
update public.inquiries set note_en = $q$Having a single basin in the majlis washrooms does not match the approved structural drawing — proposed solution: change the majlis washbasin to two basins as in the structural drawing.$q$ where id = 18;
update public.inquiries set reply_en = $q$Only one basin was approved.$q$ where id = 18;
update public.inquiries set note_en = $q$The external fence height is inconsistent with the external décor height in all models — proposed solution: adjust the fence and external décor heights.$q$ where id = 19;
update public.inquiries set reply_en = $q$The external fence height for all villas in the project will be set at 2.7 meters, with the fence made level with the external décor height.$q$ where id = 19;
update public.inquiries set note_en = $q$The current design of the exterior doors is aesthetically unsuitable — proposed solution: change the exterior door design to a model better suited to the project's architectural character.$q$ where id = 20;
update public.inquiries set reply_en = $q$The exterior doors will be redesigned for all models.$q$ where id = 20;
update public.inquiries set note_en = $q$Floor-standing Western toilets in all bathrooms — proposed solution: install wall-hung Western toilets in the majlis bathroom and the master bedroom.$q$ where id = 21;
update public.inquiries set reply_en = $q$Installing wall-hung toilets in the majlis bathroom and the master bedroom has been approved.$q$ where id = 21;
update public.inquiries set note_en = $q$The type of sanitary ware used in the project has not been clarified — proposed solution: provide owners with the type of sanitary ware that will be used in the project.$q$ where id = 22;
update public.inquiries set reply_en = $q$The sanitary ware used will be local, from Saudi Ceramics Company.$q$ where id = 22;
update public.inquiries set note_en = $q$There is no check valve on the pipe between the villa and the external sewer, which may cause insects and odors — proposed solution: install a check valve on the main drain line leaving the villa to prevent backflow of odors and insects and ensure smooth flow.$q$ where id = 23;
update public.inquiries set reply_en = $q$An external check valve will be installed between the villa and the main sewer.$q$ where id = 23;
update public.inquiries set note_en = $q$The water supply lines to the upper tank number three, but there is only one main valve on them — proposed solution: add branch valves on each supply line to ensure easy maintenance and future control.$q$ where id = 24;
update public.inquiries set reply_en = $q$There are branch valves for each floor, and they have already been installed.$q$ where id = 24;
update public.inquiries set note_en = $q$Neighborhood lighting point in front of the garage door for some models — proposed solution: redo the neighborhood lighting rough-in because of a problem relating to the lighting locations (Al-Saedi Company).$q$ where id = 25;
update public.inquiries set reply_en = $q$The infrastructure (ground services) team was contacted, and the response is that the modification will be made at the time the streets are paved.$q$ where id = 25;
update public.inquiries set note_en = $q$The current internal handrail design does not match the villa's architectural character and is unsafe for children — proposed solution: modify the design and color of the internal stair railing to match the villa's overall design.$q$ where id = 26;
update public.inquiries set reply_en = $q$The gaps are 9 cm, within the safe limit, and pose no danger; the railing will be modified slightly with wooden additions on top.$q$ where id = 26;
update public.inquiries set note_en = $q$Ground water tanks in most of the project's villas are left uncovered, which may cause workers to fall in, or dust and the like to enter — proposed solution: notify contractors of the need to cover the tanks to prevent animals falling in or dust entering the tanks.$q$ where id = 27;
update public.inquiries set reply_en = $q$Contractors will be notified to cover the ground tanks.$q$ where id = 27;
update public.inquiries set note_en = $q$The water heater location above the washbasins hinders maintenance and cleaning, and dirties the basin area and damages the décor — proposed solution: relocate the heater inside the bathroom for easier servicing and to keep the basin décor clean and safe.$q$ where id = 28;
update public.inquiries set reply_en = $q$It will be relocated in the stages that are still at the third and fourth rough-in phases.$q$ where id = 28;
update public.inquiries set note_en = $q$The current garage door track is executed protruding above floor (tile) level with sharp edges — proposed solution: redo the garage door track in a recessed (flush) manner so it sits level with the yard tiles.$q$ where id = 29;
update public.inquiries set reply_en = $q$It will be redesigned in a recessed manner with slopes to ensure water does not collect.$q$ where id = 29;
update public.inquiries set note_en = $q$The majlis window shape does not suit the architectural character — proposed solution: change the aluminum design to a sliding door for future use.$q$ where id = 30;
update public.inquiries set note_en = $q$The AC unit location above the door may affect air distribution and appearance — proposed solution: relocate the AC to the back of the majlis wall.$q$ where id = 31;
update public.inquiries set reply_en = $q$The AC location will be changed for the Albada, Aurora and Alba models only.$q$ where id = 31;
update public.inquiries set note_en = $q$The interior stair edges are sharp and pose a danger to people using the stairs — proposed solution: change the stair edges to rounded to reduce the danger during use.$q$ where id = 32;
update public.inquiries set reply_en = $q$The edges are not sharp and will be approved as they are in the show villa.$q$ where id = 32;
update public.inquiries set note_en = $q$The annex roof is not tiled and only gravel was spread — proposed solution: require the contractor to complete the tiling of the entire annex roof.$q$ where id = 33;
update public.inquiries set reply_en = $q$The gravel will be approved because the AC units are located on the annex roof.$q$ where id = 33;
update public.inquiries set note_en = $q$The ceramic skirting profile does not suit modern designs — proposed solution: change the traditional skirting to concealed (recessed) ceramic skirting.$q$ where id = 34;
update public.inquiries set reply_en = $q$Concealed skirting cannot be installed because it requires a structural correction and that stage has already passed.$q$ where id = 34;
update public.inquiries set note_en = $q$There is no dedicated curtain pocket for hanging curtains within the gypsum board design in all first-floor bedrooms — proposed solution: modify the gypsum board design on the window side to allow a curtain pocket to be installed properly.$q$ where id = 35;
update public.inquiries set reply_en = $q$A curtain pocket will not be installed because the window is small and it would cause a visual distortion.$q$ where id = 35;
update public.inquiries set reply_en = $q$The proposal was rejected, since the location is classified as a balcony, and this classification carries specific code requirements and modifications that cannot be bypassed.$q$ where id = 53;
update public.inquiries set note_en = $q$A request to increase the backyard drainage pipe size to 4 inches, given there is no inspection chamber or check valve in the current execution.$q$ where id = 76;
update public.inquiries set reply_en = $q$Approved: installing an additional 2-inch drain pipe alongside the existing one (2-inch), bringing the total drainage cross-section to 4 inches, with each pipe keeping its own drain (two drains in total). Drainage continues toward the front yard, and the two pipes are merged at the discharge point into a single visible opening for aesthetic purposes only.$q$ where id = 76;
update public.inquiries set reply_en = $q$The responsible engineer stated that the sales department will be contacted to coordinate the matter on their side, and the owners will be informed of the result.
Developer's official reply — Minutes of Meeting 7 (17-10-2026): The developer stated that the inquiry concerns the marketing and sales department and asked us to contact it directly. This means the developer will not reply itself, and the inquiry will be raised with the sales department directly.
Sales department reply (Sales Manager Wedyan Althumairi — emails of 18 and 21-10-2026): She stated that the discount in the Cityscape 2024 offer is tied to purchasing additional fit-outs for the villa, such as the kitchen or air conditioners, and including them in the contract addendum before contracting; that it is not a cash amount paid out after contracting or handover, and does not apply to anyone who did not add these fit-outs at the time of contracting; and she asked for proof of purchase and its documentation in the contracts so that each case can be reviewed. In her first reply she explained that a discount of SAR 50,000 was applied to the unit price for contracts signed during the exhibition. None of the owners reported having these fit-outs in his contract, so it was decided to close the matter for now and inform the owners of the sales department's clarification, with follow-up until the villas are handed over and without waiving any of the owners' rights (closing letter dated 22-10-2026).$q$ where id = 77;
update public.inquiries set reply_en = $q$The project's fiber-optic rough-in conduits (microducts) were inspected on site today and found to be ready and laid within the infrastructure, so that internet (fiber-optic) cables can later be pulled through them without any additional excavation or breaking-out work.$q$ where id = 79;
update public.inquiries set reply_en = $q$Approved: the unclosed voids will be treated by applying complete waterproofing in the bathroom and drainage areas, and waterproofing tests were carried out to verify the soundness of the execution and prevent any future leaks.$q$ where id = 82;
update public.inquiries set reply_en = $q$According to the Saudi Building Code SBC 1101/1102 (mechanical provisions section), a mechanical exhaust fan outlet is not prohibited from facing the front yard. The only requirement is that it be at least 900 mm from the property line and from any adjacent usable opening (window or AC intake), to prevent odors from returning. Recirculating bathroom exhaust air inside the dwelling is also prohibited under the code, and it must be discharged directly to the outdoors.$q$ where id = 83;
update public.inquiries set note_en = $q$It was observed on site that the gypsum board ceiling level in the bathroom is lower than the level of the villa's other ceilings, because the density of the supporting metal frame exceeds what the area requires. It is requested to redesign the frame and raise the ceiling level to match the other ceilings of the unit.$q$ where id = 84;
update public.inquiries set reply_en = $q$After the site review, it turned out that there was no shared penetration or breaking through both walls; rather, each party ran the drain pipe within the thickness of its own unit's wall (10 cm) only, without going into the neighboring unit's wall. However, the two routes aligned at the same location in the two facing walls (with the separating 5 cm insulation layer absent at this point), and this is what created an opening allowing direct sight between the two villas. It was decided to cancel this pipe (cut it off) and treat the resulting opening in both walls with concrete casting, which is the approved method for treating such cases in the shared wall between attached villas in all models.$q$ where id = 85;
update public.inquiries set note_en = $q$Inquiry about the type of distribution board (the main electrical distribution panel) used in all models in the project, with its technical specifications and manufacturer, and confirmation that it complies with the requirements of the Saudi Building Code and the Saudi Electricity Company.$q$ where id = 86;
update public.inquiries set reply_en = $q$Use of an electrical distribution board from Al Fanar Saudi Company has been approved for all models. It has 24 ways (circuits), including RCBO breakers (residual-current breakers combining overload and earth-leakage protection), which is the more expensive type compared with the ordinary MCB breaker.$q$ where id = 86;
update public.inquiries set note_en = $q$Inquiry about whether there is a drain dedicated to draining rainwater or yard wash-down water in the front yard in all models.$q$ where id = 87;
update public.inquiries set reply_en = $q$There is no drain dedicated to draining rainwater or yard wash-down water in the front yard.$q$ where id = 87;
update public.inquiries set note_en = $q$Inquiry about whether the size/number of the drain installed on the annex roof is adequate for its actual area. Required: provide us with the drainage-rate calculation against the roof area to confirm compliance, and adjust the size or add a second drain if it is found to be insufficient.$q$ where id = 88;
update public.inquiries set reply_en = $q$The existing 3-inch drain is sufficient on its own to drain the annex roof, because the roof area is small and the drainage system is longitudinal (not central), so water drains from the roof toward the front yard. Therefore, there is no need to change the size or add a second drain.$q$ where id = 88;
update public.inquiries set note_en = $q$It was observed on site that there are wood remnants (formwork) inside the yard fence wall, which were not removed before the wall was closed and the construction and finishing works completed. Proposed solution: ensure all wood remnants are removed from inside the fence wall in all models before it is permanently closed, since leaving them may weaken the wall's structural cohesion, create voids and future cracking, or attract insects (such as termites) and rot over time.$q$ where id = 89;
update public.inquiries set reply_en = $q$What was observed is not wood remnants but Filler Board (a separation/structural insulation board), which is deliberately used as a structural separation joint between the two adjoining walls to ensure each wall's independence from the other, and also at concrete pours to prevent the two adjacent pours from sticking or overlapping (cold joint). This is sound and compliant with structural practice.$q$ where id = 89;
update public.inquiries set note_en = $q$Movement/vibration was observed in the wall-hung Western toilet (the suspended seat) in the master and guest bathrooms; it is supposed to be completely fixed with no movement during use. Proposed solution: explain the cause of the movement and the type of structural fault associated with it (carrier frame fixing/rear support), and state the approved remediation to ensure the wall-hung toilet is completely stable in all models.$q$ where id = 90;
update public.inquiries set reply_en = $q$If movement in the wall-hung toilet is confirmed, it is considered a structural error in fixing the carrier frame and requires remediation. This remark has been noted and escalated to the consulting office, and the necessary remediation will be approved and carried out to ensure the installation is stable.$q$ where id = 90;
update public.inquiries set note_en = $q$It was observed on site that wood remnants were not removed before installing the gypsum board frame (runners) and its supporting bases; the runners and the gypsum board base were installed over/around this wood without removing it. Proposed solution: ensure all wood remnants are completely removed before installing the gypsum board frame and bases, to avoid any future effect on the stability of the installation or attracting insects (such as termites).$q$ where id = 91;
update public.inquiries set reply_en = $q$The responsible engineer stated that the wood remnants referred to will be removed, and confirmed that phases will not be accepted from the contractors until the site is confirmed clean and all existing wood remnants are completely dealt with, as a fixed procedure applied to all phases and models.$q$ where id = 91;
update public.inquiries set note_en = $q$It was observed that the ceiling level of the hall and the majlis is lower than the rest of the ground-floor ceilings. The reason is that the rainwater drainage pipes run beneath the tiles within the backfill layer, and the extra backfill thickness this requires to achieve the necessary slopes for drainage lowers the ceiling beneath it and reduces the clear height of the hall and the majlis, the two most important spaces in the villa. Since the gypsum board works are currently executed and can still be modified, we request raising the ceiling level of the hall and the majlis to match the other ceilings, while re-studying the pipe route, backfill thickness and slopes so that this is possible without compromising drainage efficiency, providing us with the clear height after the modification, and applying this to all models before the finishing works are completed.$q$ where id = 92;
update public.inquiries set note_en = $q$Inquiry about the status of Block 22, and whether an external contractor will be appointed for it or it will be handed over to the contractor of the other blocks, with the project plan for the block and the schedule for starting execution, to avoid any delay in the block's works.$q$ where id = 93;
update public.inquiries set note_en = $q$Inquiry about the set date for delivering the first blocks, and whether a timetable has been adopted for delivering the remaining blocks, with the expected delivery date for each block provided to the owners so that they can prepare in advance to receive their units.$q$ where id = 94;
update public.inquiries set note_en = $q$Inquiry about the sliding door of the men's majlis: it appears as approved across all models in the villas' engineering drawings but does not appear in the show villa. Has there been a modification or change to the approved design, or will it be executed in the villas in line with the approved engineering drawings? Please provide official confirmation.$q$ where id = 95;
update public.inquiries set note_en = $q$It was observed on site that the front and back yards have not been fully finished with the external tiles and also need slope adjustment; the owners have not been told whether the tiling works fall within the handover scope, nor when they will be carried out. Inquiry: will the front and back yards be tiled with the same approved external tile (Emerald 44×44 cm) used in the rest of the external floors? Will the slopes be corrected before tiling so that rain and wash-down water flows toward the drain points and away from the villa walls? What is the approved schedule for execution? Proposed solution: carry out the tiling with the same approved tile after re-adjusting the slopes, ensuring water does not pool or run toward the villa, with the level and appearance unified between the two yards and the rest of the external floors.$q$ where id = 97;
update public.inquiries set note_en = $q$Current situation: a 7 cm thermal and waterproofing insulation layer has been adopted directly above the concrete roof slab and below the slope and tiling layers, without stating its technical details or the sequence of layers above it. Inquiry: we kindly ask to be informed of the following: (1) the type of material used and its approved technical data, including the executed density and compressive strength, (2) the sequence of layers from the concrete roof up to the final finish with the thickness of each layer, and whether there is a separation layer and a reinforced protection layer above the insulation, (3) how AC unit and equipment loads on the roof are handled, and whether the owner can later tile the roof without damaging the insulation. Proposed solution: provide us with the material's technical datasheet and the layer details, adopt a reinforced protection layer above the insulation, and distribute equipment loads onto independent bases.$q$ where id = 98;
update public.inquiries set note_en = replace(note_en, 'Meeting 7 minutes', 'Minutes of Meeting 7') where note_en like '%Meeting 7 minutes%';
update public.inquiries set reply_en = replace(reply_en, 'Meeting 7 minutes', 'Minutes of Meeting 7') where reply_en like '%Meeting 7 minutes%';
update public.inquiries set note_en = replace(note_en, 'Amanither', 'Amanecer') where note_en like '%Amanither%';
update public.inquiries set reply_en = replace(reply_en, 'Amanither', 'Amanecer') where reply_en like '%Amanither%';
update public.inquiries set note_en = regexp_replace(note_en, '\mBada\M', 'Albada', 'g') where note_en ~ '\mBada\M';
update public.inquiries set reply_en = regexp_replace(reply_en, '\mBada\M', 'Albada', 'g') where reply_en ~ '\mBada\M';
update public.inquiries set note_en = replace(note_en, 'Restacks', 'Restatex') where note_en like '%Restacks%';
update public.inquiries set reply_en = replace(replace(reply_en, 'two Clean Out openings', 'two clean-out openings'), 'in the back yard on the external drain line', 'in the yard on the external drain line') where id = 96;
update public.inquiries set note_en = replace(note_en, 'two holes (Clean Out)', 'two clean-out openings') where id = 96;

-- ١٠) كل الترجمات الحالية (بعد التصحيح) تُعتمد كترجمة سليمة ببصمة نصها العربي — فما يعيد المحرّك ترجمتها
update public.inquiries set i18n = coalesce(i18n, '{}'::jsonb)
  || case when coalesce(btrim(note_en), '') <> '' and coalesce(btrim(note), '') <> '' and (coalesce(i18n, '{}'::jsonb) -> 'note') is null
          and note_en !~* '(MYMEMORY WARNING|QUERY LENGTH LIMIT)'
          then jsonb_build_object('note', jsonb_build_object('h', public.i18n_hash(note), 'e', 'claude', 't', now())) else '{}'::jsonb end
  || case when coalesce(btrim(reply_en), '') <> '' and coalesce(btrim(reply), '') <> '' and (coalesce(i18n, '{}'::jsonb) -> 'reply') is null
          and reply_en !~* '(MYMEMORY WARNING|QUERY LENGTH LIMIT)'
          then jsonb_build_object('reply', jsonb_build_object('h', public.i18n_hash(reply), 'e', 'claude', 't', now())) else '{}'::jsonb end;

-- ١١) ذاكرة الترجمة: القيم الحالية (مطابقة للترجمات الثابتة بالموقع) + ملاحظة شهر 2026-07

insert into public.i18n_memory (ar, en, kind, engine) values ($q$أبو سلطان$q$, $q$Abu Sultan$q$, $q$person$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$أبو علي$q$, $q$Abu Ali$q$, $q$person$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$غير محدد$q$, $q$Unspecified$q$, $q$person$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$م/أحمد ملحم$q$, $q$Eng. Ahmed Malham$q$, $q$person$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$م/إبراهيم$q$, $q$Eng. Ibrahim$q$, $q$person$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$م/رواحه$q$, $q$Eng. Rawaha$q$, $q$person$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$م/محمد عبدالمعطي$q$, $q$Eng. Mohammed Abdulmuti$q$, $q$person$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$وديان$q$, $q$Wedyan$q$, $q$person$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الرئيس التنفيذي$q$, $q$CEO$q$, $q$title$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$مالك$q$, $q$Owner$q$, $q$title$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$مدير العمليات$q$, $q$Operations Manager$q$, $q$title$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$مدير المبيعات السابق$q$, $q$Former Sales Manager$q$, $q$title$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$مدير المشروع$q$, $q$Project Manager$q$, $q$title$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$مديرة المبيعات الأولى$q$, $q$Senior Sales Manager$q$, $q$title$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الأرضي والأول$q$, $q$Ground + First Floor$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الحوش (الأرضي)$q$, $q$Yard (Ground Floor)$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الحوش الخلفي (الأرضي)$q$, $q$Backyard (Ground Floor)$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الدرج$q$, $q$Staircase$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الدور الأرضي$q$, $q$Ground Floor$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الدور الأول$q$, $q$First Floor$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$السطح$q$, $q$Roof$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الشارع$q$, $q$Street$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$المطبخ ودورات المياه$q$, $q$Kitchen & Bathrooms$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$جدار الفلل المتلاصقة$q$, $q$Party Wall Between Adjoining Villas$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$كامل الفيلا$q$, $q$Whole Villa$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$موقع الخزان$q$, $q$Tank Location$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$إداري/نظامي$q$, $q$Administrative / Regulatory$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$استفسار فني توضيحي$q$, $q$Technical Clarification$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$تجاري$q$, $q$Commercial$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$ترقية$q$, $q$Upgrade$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$تصحيح عيب تنفيذي$q$, $q$Execution Correction$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$تصميمي/جمالي$q$, $q$Design / Aesthetic$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$عادية$q$, $q$Low$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$عالية$q$, $q$High$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$عالية جدًا$q$, $q$Very High$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$متوسطة$q$, $q$Medium$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$تم التصويت$q$, $q$Voted$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$تم الرفض$q$, $q$Not approved$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$قيد الدراسة$q$, $q$Under Review$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$معتمدة$q$, $q$Approved$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$المبيعات وما بعد البيع$q$, $q$Sales & after-sales$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$فريق المشروع$q$, $q$Project team$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$أمانيثير وألبا$q$, $q$Amanecer & Alba$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$أورورا$q$, $q$Aurora$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$جميع النماذج$q$, $q$All models$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$جميع النماذج عدا أمانيثير$q$, $q$All models except Amanecer$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الاجتماع الثالث$q$, $q$3rd Meeting$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الاجتماع الخامس$q$, $q$5th Meeting$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الاجتماع الرابع$q$, $q$4th Meeting$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الاجتماع السابع$q$, $q$7th Meeting$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$الاجتماع السادس (ميداني)$q$, $q$6th Meeting (Site Visit)$q$, $q$label$q$, 'claude') on conflict (ar) do nothing;
insert into public.i18n_memory (ar, en, kind, engine) values ($q$المطوّر لم يُصدر تقرير تقدّم لهذا الشهر — تم سحبه$q$, $q$The developer did not issue a progress report for this month — it was withdrawn.$q$, $q$text$q$, 'claude') on conflict (ar) do nothing;

-- ١٢) عناوين الوسائط: توحيد صيغة التاريخ وتصحيح ترجمات غير دقيقة (فقط لو ما تعدّلت يدويًا من بعد)
update public.media_items set title_en = $q$09-2026$q$ where id = 15 and title_en = $q$09/2026$q$;
update public.media_items set title_en = $q$05-2026$q$ where id = 17 and title_en = $q$05/2026$q$;
update public.media_items set title_en = $q$02-2026$q$ where id = 18 and title_en = $q$02/2026$q$;
update public.media_items set title_en = $q$03-2026$q$ where id = 20 and title_en = $q$03/2026$q$;
update public.media_items set title_en = $q$09-2026$q$ where id = 21 and title_en = $q$09/2026$q$;
update public.media_items set title_en = $q$09-2026$q$ where id = 22 and title_en = $q$09/2026$q$;
update public.media_items set title_en = $q$Bathroom Ceramic Specifications$q$ where id = 24 and title_en = $q$Toilet Ceramics Specifications$q$;
update public.media_items set title_en = $q$Wall-Hung Toilet (Ceramic)$q$ where id = 25 and title_en = $q$Suspended Siphon ( Porcelain)$q$;
update public.media_items set title_en = $q$External Drain Check Valve (Insect Barrier)$q$ where id = 28 and title_en = $q$External Drain Insect Check Valve$q$;
update public.media_items set title_en = $q$Residential Buildings (Villas) — SBC 1101-1102 Guidance Manual$q$ where id = 29 and title_en = $q$Residential Buildings (Villas) — Guide SBC 1101-1102$q$;
update public.media_items set title_en = $q$Roof Insulation Water Test Video$q$ where id = 35 and title_en = $q$Roof Insulation Water Test Clip$q$;
update public.media_topics set title_en = $q$Al Fursan Front Progress Archive$q$ where id = 5 and title_en = $q$Al Forsan Front Progress Archive$q$;
update public.media_topics set title_en = $q$Materials Used in Finishes$q$ where id = 6 and title_en = $q$Materials used in finishes$q$;

select set_config('app.i18n_write', 'off', true);
commit;

-- ═══════════════════════════════════════════════════════════════════════
-- الجزء ٢: الجدولة التلقائية — كل ٥ دقائق، وتستدعي المحرّك فقط لو فيه شي ينتظر
-- (المفتاح المذكور هو المفتاح العام للموقع نفسه — موجود أصلًا بكود الموقع، مو سري)
-- (لو ظهر خطأ هنا: فعّل امتداد pg_net من Database → Extensions ثم شغّل هذا الجزء وحده.
--  الجزء ١ انحفظ بالفعل، والترجمة تشتغل أيضًا بعد كل حفظ من لوحة الإدارة)
-- ═══════════════════════════════════════════════════════════════════════
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'i18n-sweep';
select cron.schedule('i18n-sweep', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://codnqkeycfhznzbqlpds.supabase.co/functions/v1/i18n-translate',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_L1yElSU0fd6a6BNQS6Qgsw_0Ale7aNu", "apikey": "sb_publishable_L1yElSU0fd6a6BNQS6Qgsw_0Ale7aNu"}'::jsonb,
    body := '{"mode": "sweep", "source": "cron"}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.i18n_pending(coalesce((select has_key and coalesce(claude_backoff_until, 'epoch'::timestamptz) < now() from public.i18n_state where id = 1), false), 1))
     or exists (select 1 from public.i18n_pending_terms(coalesce((select has_key and coalesce(claude_backoff_until, 'epoch'::timestamptz) < now() from public.i18n_state where id = 1), false), 1))
     or coalesce((select last_run_at from public.i18n_state where id = 1), 'epoch'::timestamptz) < now() - interval '6 hours'
$cron$);

-- تحقق سريع بعد التشغيل (اختياري):
-- select count(*) filter (where i18n ? 'note') as notes_tracked, count(*) filter (where i18n ? 'reply') as replies_tracked from public.inquiries;
-- select * from public.i18n_pending(false, 20);
-- select jobname, schedule, active from cron.job where jobname = 'i18n-sweep';

