-- ═══════════════════════════════════════════════════════════════════
-- 6.14.0 — تذاكر الملاك: المالك يرسل استفساره أو مقترحه برقم فيلته ويستلم رقم تذكرة
--
-- شغّله مرة واحدة من Supabase → SQL Editor. آمن لإعادة التشغيل.
--   • owner_tickets: التذاكر (لا يقرأها إلا صاحب صلاحية manage_tickets)
--   • ticket_submit(): الإرسال من الموقع العام — يتحقق، يحدّ المعدّل، ويرجّع رقم التذكرة
--   • ticket_status(): المتابعة برقم التذكرة + رقم الفيلا معًا
--   • site_settings.tickets_mode: off (مقفول) | owners (للمسجّلين بحساب فيلا فقط) | all (أي زائر برقم فيلته)
-- ═══════════════════════════════════════════════════════════════════

alter table public.site_settings
  add column if not exists tickets_mode text not null default 'all';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_tickets_mode_chk') then
    alter table public.site_settings
      add constraint site_settings_tickets_mode_chk check (tickets_mode in ('off', 'owners', 'all'));
  end if;
end $$;

create table if not exists public.owner_tickets (
  id           bigint generated always as identity primary key,
  ticket_no    text not null unique,
  villa        integer not null check (villa between 1 and 596),
  verified     boolean not null default false,       -- أُرسلت من حساب فيلا مسجّل دخول (رقم الفيلا مؤكد)
  kind         text not null check (kind in ('inquiry', 'suggestion')),
  body         text not null check (char_length(body) between 10 and 2000),
  status       text not null default 'new' check (status in ('new', 'review', 'converted', 'closed')),
  admin_reply  text not null default '',
  inquiry_id   integer,                               -- رقم الاستفسار لو تحوّلت التذكرة إلى استفسار بالجدول
  device       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
create index if not exists owner_tickets_created_idx on public.owner_tickets (created_at desc);
create index if not exists owner_tickets_villa_idx on public.owner_tickets (villa);
alter table public.owner_tickets enable row level security;
revoke all on public.owner_tickets from anon, authenticated;
grant select, update, delete on public.owner_tickets to authenticated;

drop policy if exists "قراءة - تذاكر الملاك" on public.owner_tickets;
create policy "قراءة - تذاكر الملاك" on public.owner_tickets
  for select to authenticated using (public.has_perm('manage_tickets'));
drop policy if exists "تعديل - تذاكر الملاك" on public.owner_tickets;
create policy "تعديل - تذاكر الملاك" on public.owner_tickets
  for update to authenticated using (public.has_perm('manage_tickets')) with check (public.has_perm('manage_tickets'));
drop policy if exists "حذف - تذاكر الملاك" on public.owner_tickets;
create policy "حذف - تذاكر الملاك" on public.owner_tickets
  for delete to authenticated using (public.has_perm('manage_tickets'));

create or replace function public.owner_tickets_touch()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists trg_owner_tickets_touch on public.owner_tickets;
create trigger trg_owner_tickets_touch before update on public.owner_tickets
  for each row execute function public.owner_tickets_touch();

-- ── الإرسال من الموقع العام ───────────────────────────────────────
create or replace function public.ticket_submit(p_villa integer, p_kind text, p_body text, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_mode text; v_no text; v_body text := btrim(coalesce(p_body, ''));
  v_meta jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
  v_villa integer := p_villa; v_verified boolean := false;
  v_dev text := left(coalesce(p_device, ''), 64);
begin
  select tickets_mode into v_mode from public.site_settings where id = 1;
  if coalesce(v_mode, 'all') = 'off' then return jsonb_build_object('state', 'closed'); end if;

  -- حساب فيلا مسجّل دخول: رقم الفيلا يُؤخذ من الحساب نفسه لا من النموذج
  if auth.uid() is not null and v_meta ? 'villa_login' and exists (
       select 1 from public.villa_auth a join public.villa_accounts v on v.villa = a.villa
       where a.auth_user_id = auth.uid() and v.enabled) then
    v_villa := (v_meta ->> 'villa_login')::integer; v_verified := true;
  elsif v_mode = 'owners' then
    return jsonb_build_object('state', 'login_required');
  end if;

  if v_villa is null or v_villa < 1 or v_villa > 596 then return jsonb_build_object('state', 'bad_villa'); end if;
  if p_kind not in ('inquiry', 'suggestion') then return jsonb_build_object('state', 'bad_kind'); end if;
  if char_length(v_body) < 10 or char_length(v_body) > 2000 then return jsonb_build_object('state', 'bad_body'); end if;

  -- حدّ المعدّل: ٣ بالساعة لكل جهاز، ٦ باليوم لكل فيلا، ٦٠ بالساعة للموقع كله
  if v_dev <> '' and (select count(*) from public.owner_tickets where device = v_dev and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.owner_tickets where villa = v_villa and created_at > now() - interval '1 day') >= 6
     or (select count(*) from public.owner_tickets where created_at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('state', 'rate');
  end if;

  loop
    v_no := 'T-' || lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.owner_tickets where ticket_no = v_no);
  end loop;
  insert into public.owner_tickets (ticket_no, villa, verified, kind, body, device)
  values (v_no, v_villa, v_verified, p_kind, v_body, nullif(v_dev, ''));
  return jsonb_build_object('state', 'ok', 'ticket', v_no, 'villa', v_villa);
end $$;

-- ── المتابعة: رقم التذكرة + رقم الفيلا معًا ───────────────────────
create or replace function public.ticket_status(p_ticket text, p_villa integer)
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce((
    select jsonb_build_object('state', 'ok', 'ticket', t.ticket_no, 'kind', t.kind, 'status', t.status,
                              'reply', t.admin_reply, 'inquiry_id', t.inquiry_id, 'created_at', t.created_at, 'updated_at', t.updated_at)
    from public.owner_tickets t
    where t.ticket_no = upper(btrim(p_ticket)) and t.villa = p_villa
  ), jsonb_build_object('state', 'not_found'));
$$;

revoke all on function public.ticket_submit(integer, text, text, text) from public;
revoke all on function public.ticket_status(text, integer) from public;
grant execute on function public.ticket_submit(integer, text, text, text) to anon, authenticated;
grant execute on function public.ticket_status(text, integer) to anon, authenticated;

-- ── صلاحية إعداد التذاكر ──────────────────────────────────────────
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
    elsif col = 'tickets_mode' then
      if not public.has_perm('manage_tickets') then raise exception 'لا توجد صلاحية لتعديل إعدادات تذاكر الملاك'; end if;
    elsif col in ('gallery_mode','gallery_layout') then
      if not public.has_perm('manage_gallery') then raise exception 'لا توجد صلاحية لتعديل إعدادات المعرض'; end if;
    else
      if not public.has_perm('manage_theme') then raise exception 'لا توجد صلاحية لتعديل مظهر الموقع وتسمية الأقسام'; end if;
    end if;
  end loop;
  return new;
end $$;

alter policy "تعديل - إعدادات الموقع" on public.site_settings
  using (public.has_perm('manage_theme') or public.has_perm('manage_gallery') or public.has_perm('manage_owner_login') or public.has_perm('manage_tickets'))
  with check (public.has_perm('manage_theme') or public.has_perm('manage_gallery') or public.has_perm('manage_owner_login') or public.has_perm('manage_tickets'));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'owner_tickets') then
    alter publication supabase_realtime add table public.owner_tickets;
  end if;
exception when others then null;
end $$;

-- الصلاحية الجديدة لصاحب الحساب الرئيسي؛ يمنحها لغيره من تبويب «المستخدمون»
alter table public.profiles disable trigger trg_check_profile_perm_change;
update public.profiles
   set perms = array_append(coalesce(perms, '{}'::text[]), 'manage_tickets')
 where id = '9e3c05a6-16c4-4e75-90e5-fb6c086328f3'
   and not ('manage_tickets' = any(coalesce(perms, '{}'::text[])));
alter table public.profiles enable trigger trg_check_profile_perm_change;
