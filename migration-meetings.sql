-- ═══════════════════════════════════════════════════════════════════
-- 7.1.0 — وضع الاجتماع: تجهيز جدول الأعمال من البنود المفتوحة، تسجيل ردود المطور، ثم اعتمادها على الاستفسارات دفعة واحدة
-- شغّله مرة واحدة من Supabase → SQL Editor. آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.meetings (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(btrim(title)) between 2 and 80),
  held_on     date,
  status      text not null default 'draft' check (status in ('draft', 'held', 'published')),
  sections    jsonb not null default '[]'::jsonb,   -- [{ "title": "...", "ids": [76, 85] }]
  results     jsonb not null default '{}'::jsonb,   -- { "76": { "reply": "...", "status": "معتمدة", "close": true } }
  notes       text not null default '',
  applied_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_by  uuid
);
alter table public.meetings enable row level security;
revoke all on public.meetings from anon;
grant select, insert, update, delete on public.meetings to authenticated;

drop policy if exists "قراءة - الاجتماعات" on public.meetings;
create policy "قراءة - الاجتماعات" on public.meetings for select to authenticated
  using (public.has_perm('edit_inquiry') or public.has_perm('view_dashboard'));
drop policy if exists "إضافة - الاجتماعات" on public.meetings;
create policy "إضافة - الاجتماعات" on public.meetings for insert to authenticated
  with check (public.has_perm('edit_inquiry'));
drop policy if exists "تعديل - الاجتماعات" on public.meetings;
create policy "تعديل - الاجتماعات" on public.meetings for update to authenticated
  using (public.has_perm('edit_inquiry')) with check (public.has_perm('edit_inquiry'));
drop policy if exists "حذف - الاجتماعات" on public.meetings;
create policy "حذف - الاجتماعات" on public.meetings for delete to authenticated
  using (public.has_perm('edit_inquiry') and status <> 'published');

create or replace function public.meetings_touch()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists trg_meetings_touch on public.meetings;
create trigger trg_meetings_touch before update on public.meetings
  for each row execute function public.meetings_touch();

-- ── اعتماد نتائج الاجتماع على الاستفسارات (عملية واحدة: كلها تنجح أو كلها تتراجع) ──
--   لكل بند مسجَّل له رد: يُضاف الرد بسطر مؤرَّخ باسم الاجتماع، تتغيّر الحالة لو حُددت، يُقفل لو طُلب،
--   ويُضاف اسم الاجتماع لقائمة اجتماعات البند. قبلها تؤخذ نسخة احتياطية كاملة.
create or replace function public.meeting_apply(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  m public.meetings; k text; r jsonb; v_reply text; v_status text; v_close boolean;
  v_line text; v_n int := 0; v_closed int := 0; v_date text; v_inq int;
begin
  if not public.has_perm('edit_inquiry') then raise exception 'لا توجد صلاحية لتعديل الاستفسارات'; end if;
  select * into m from public.meetings where id = p_id for update;
  if not found then raise exception 'الاجتماع غير موجود'; end if;
  if m.status = 'published' then raise exception 'نتائج هذا الاجتماع اعتُمدت من قبل'; end if;
  v_date := to_char(coalesce(m.held_on, current_date), 'DD-MM-YYYY');

  insert into public.data_backups (label, inquiries, progress)
  select 'قبل اعتماد نتائج ' || m.title || ' — ' || v_date,
         (select jsonb_agg(to_jsonb(i) order by i.id) from public.inquiries i),
         (select b.progress from public.data_backups b order by b.id desc limit 1);

  for k, r in select * from jsonb_each(m.results) loop
    v_reply := btrim(coalesce(r ->> 'reply', ''));
    v_status := nullif(btrim(coalesce(r ->> 'status', '')), '');
    v_close := coalesce((r ->> 'close')::boolean, false);
    if v_reply = '' and v_status is null and not v_close then continue; end if;
    if k !~ '^[0-9]+$' then continue; end if;
    v_inq := k::int;
    if v_status is not null and v_status not in ('معتمدة', 'تم الرفض', 'قيد الدراسة', 'تم التصويت') then
      raise exception 'حالة غير معروفة للبند %: %', k, v_status;
    end if;
    v_line := case when v_reply = '' then '' else 'رد المطور — ' || m.title || ' (' || v_date || '): ' || v_reply end;
    update public.inquiries i
       set reply = case when v_line = '' then i.reply
                        when btrim(coalesce(i.reply, '')) = '' then v_line
                        else rtrim(i.reply) || E'\n\n' || v_line end,
           status = coalesce(v_status, i.status),
           closed = case when v_close then 'نعم' else i.closed end,
           answered = case when v_line <> '' then true else i.answered end,
           meetings = case when coalesce(i.meetings, '[]'::jsonb) @> to_jsonb(array[m.title])
                           then coalesce(i.meetings, '[]'::jsonb)
                           else coalesce(i.meetings, '[]'::jsonb) || to_jsonb(array[m.title]) end,
           last_modified = current_date::text
     where i.id = v_inq;
    if found then v_n := v_n + 1; if v_close then v_closed := v_closed + 1; end if; end if;
  end loop;

  -- اسم الاجتماع يدخل قائمة فلتر «الاجتماع» بالموقع (الأحدث أولًا)
  update public.filter_categories
     set "values" = array_prepend(m.title, "values")
   where key = 'meeting' and not (m.title = any("values"));

  update public.meetings set status = 'published', applied_at = now() where id = p_id;
  return jsonb_build_object('updated', v_n, 'closed', v_closed);
end $$;
revoke all on function public.meeting_apply(bigint) from public, anon;
grant execute on function public.meeting_apply(bigint) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetings') then
    alter publication supabase_realtime add table public.meetings;
  end if;
exception when others then null;
end $$;
