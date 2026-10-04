-- ════════════════════════════════════════════════════════════
-- روابط المشاركة الخاصة + التتبع (4.0.0) — هجرة إضافية فوق setup-supabase.sql
-- شغّلها مرة وحدة في SQL Editor بمشروع Supabase. لا تلمس أي جدول موجود.
-- تعتمد على has_perm() والصلاحية manage_notices الموجودتين أصلًا.
-- آمنة لإعادة التشغيل (idempotent).
-- ════════════════════════════════════════════════════════════

create table if not exists public.share_links (
  id              uuid primary key default gen_random_uuid(),
  token_hash      text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),   -- مفتاح البحث المشتق HKDF (مو الرمز نفسه)
  label           text not null check (char_length(label) between 1 and 120),
  note            text check (note is null or char_length(note) <= 500),
  scope           jsonb not null default '{}'::jsonb,
  expires_at      timestamptz not null,
  max_opens       integer not null default 1 check (max_opens between 1 and 100),
  opens           integer not null default 0,
  session_minutes integer not null default 30 check (session_minutes between 5 and 240),
  created_by      text check (created_by is null or char_length(created_by) <= 120),
  created_at      timestamptz not null default now(),
  first_opened_at timestamptz,
  last_opened_at  timestamptz,
  revoked_at      timestamptz
);
-- أعمدة 4.0.0 (رمز PIN اختياري + قفل المحاولات الخاطئة)
alter table public.share_links add column if not exists pin_salt text;
alter table public.share_links add column if not exists pin_hash text;
alter table public.share_links add column if not exists pin_fails integer not null default 0;
alter table public.share_links add column if not exists pin_fails_total integer not null default 0;
alter table public.share_links add column if not exists locked_until timestamptz;
alter table public.share_links add column if not exists has_pin boolean generated always as (pin_hash is not null) stored;

create table if not exists public.share_sessions (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid not null references public.share_links(id) on delete cascade,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at     timestamptz,
  active_ms    bigint not null default 0,
  events       integer not null default 0,
  ip_hash      text,          -- بصمة HMAC مقتطعة — ليست عنوان IP
  country      text,
  device       text,
  browser      text,
  os           text,
  lang         text,
  screen       text,
  tz           text
);
create index if not exists share_sessions_link_idx on public.share_sessions (link_id, started_at desc);

create table if not exists public.share_events (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.share_sessions(id) on delete cascade,
  link_id    uuid not null references public.share_links(id) on delete cascade,
  at         timestamptz not null default now(),
  type       text not null check (type in ('open','click','tab','link','download','hide','show','end','denied')),
  tab        text,
  target     text,          -- نوع العنصر (button/a/img…)
  label      text,          -- نص العنصر المضغوط (مقتطع)
  meta       jsonb
);
create index if not exists share_events_link_idx on public.share_events (link_id, at);
create index if not exists share_events_sess_idx on public.share_events (session_id, at);

alter table public.share_links    enable row level security;
alter table public.share_sessions enable row level security;
alter table public.share_events   enable row level security;
-- لا توجد أي سياسة للزائر (anon): الجداول مقفلة عليه كليًا. الدالة share-view تكتب/تقرأ بمفتاح الخدمة.
drop policy if exists "إدارة - روابط المشاركة (قراءة)" on public.share_links;
drop policy if exists "إدارة - روابط المشاركة (إضافة)" on public.share_links;
drop policy if exists "إدارة - روابط المشاركة (تعديل)" on public.share_links;
drop policy if exists "إدارة - روابط المشاركة (حذف)" on public.share_links;
create policy "إدارة - روابط المشاركة (قراءة)" on public.share_links for select to authenticated using (public.has_perm('manage_notices'));
create policy "إدارة - روابط المشاركة (إضافة)" on public.share_links for insert to authenticated with check (public.has_perm('manage_notices'));
create policy "إدارة - روابط المشاركة (تعديل)" on public.share_links for update to authenticated using (public.has_perm('manage_notices')) with check (public.has_perm('manage_notices'));
create policy "إدارة - روابط المشاركة (حذف)" on public.share_links for delete to authenticated using (public.has_perm('manage_notices'));
drop policy if exists "إدارة - جلسات المشاركة (قراءة)" on public.share_sessions;
drop policy if exists "إدارة - جلسات المشاركة (حذف)" on public.share_sessions;
create policy "إدارة - جلسات المشاركة (قراءة)" on public.share_sessions for select to authenticated using (public.has_perm('manage_notices'));
create policy "إدارة - جلسات المشاركة (حذف)" on public.share_sessions for delete to authenticated using (public.has_perm('manage_notices'));
drop policy if exists "إدارة - أحداث المشاركة (قراءة)" on public.share_events;
drop policy if exists "إدارة - أحداث المشاركة (حذف)" on public.share_events;
create policy "إدارة - أحداث المشاركة (قراءة)" on public.share_events for select to authenticated using (public.has_perm('manage_notices'));
create policy "إدارة - أحداث المشاركة (حذف)" on public.share_events for delete to authenticated using (public.has_perm('manage_notices'));

-- استهلاك فتحة بشكل ذرّي (قفل الصف) — يُستدعى من الدالة فقط بمفتاح الخدمة
create or replace function public.share_consume(p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.share_links;
begin
  select * into r from public.share_links where token_hash = p_hash for update;
  if not found then return jsonb_build_object('state', 'unknown'); end if;
  if r.revoked_at is not null then return jsonb_build_object('state', 'revoked'); end if;
  if r.expires_at <= now() then return jsonb_build_object('state', 'expired'); end if;
  if r.locked_until is not null and r.locked_until > now() then return jsonb_build_object('state', 'locked', 'until', r.locked_until); end if;
  if r.opens >= r.max_opens then return jsonb_build_object('state', 'exhausted'); end if;
  update public.share_links
     set opens = opens + 1, pin_fails = 0, first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now()
   where id = r.id;
  return jsonb_build_object('state', 'ok', 'id', r.id, 'scope', r.scope, 'note', r.note,
                            'expires_at', r.expires_at, 'session_minutes', r.session_minutes);
end $$;

-- فشل إدخال PIN: ٥ محاولات خاطئة = قفل ١٥ دقيقة، و١٥ خطأ إجمالًا = إلغاء الرابط تلقائيًا
create or replace function public.share_pin_fail(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.share_links;
begin
  update public.share_links set pin_fails = pin_fails + 1, pin_fails_total = pin_fails_total + 1 where id = p_id returning * into r;
  if not found then return jsonb_build_object('left', 0); end if;
  if r.pin_fails_total >= 15 then
    update public.share_links set revoked_at = coalesce(revoked_at, now()) where id = p_id;
    return jsonb_build_object('left', 0, 'revoked', true);
  end if;
  if r.pin_fails >= 5 then
    update public.share_links set pin_fails = 0, locked_until = now() + interval '15 minutes' where id = p_id;
    return jsonb_build_object('left', 0, 'locked', true);
  end if;
  return jsonb_build_object('left', 5 - r.pin_fails);
end $$;

revoke execute on function public.share_consume(text) from public, anon, authenticated;
revoke execute on function public.share_pin_fail(uuid) from public, anon, authenticated;
grant execute on function public.share_consume(text) to service_role;
grant execute on function public.share_pin_fail(uuid) to service_role;
