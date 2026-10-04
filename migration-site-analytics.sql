-- ════════════════════════════════════════════════════════════
-- التحليلات الشاملة للموقع (5.0.0) — هجرة إضافية، لا تلمس جدول logs القديم.
-- شغّلها مرة وحدة في SQL Editor بمشروع Supabase. آمنة لإعادة التشغيل.
-- الكتابة تتم فقط عبر الدالة site-track بمفتاح الخدمة؛ القراءة لمن عنده صلاحية view_analytics.
-- ════════════════════════════════════════════════════════════

create table if not exists public.site_sessions (
  id           uuid primary key default gen_random_uuid(),
  visitor_id   text check (visitor_id is null or visitor_id ~ '^[0-9a-f]{16,32}$'),  -- معرّف عشوائي مجهول بالمتصفح (لتمييز العائد)
  is_returning boolean not null default false,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at     timestamptz,
  active_ms    bigint not null default 0,
  events       integer not null default 0,
  max_scroll   smallint not null default 0,
  device       text, browser text, os text, country text, lang text, screen text, tz text,
  referrer     text,   -- اسم النطاق فقط
  theme        text,
  ip_hash      text    -- بصمة HMAC مقتطعة، ليست عنوان IP
);
create index if not exists site_sessions_started_idx on public.site_sessions (started_at desc);
create index if not exists site_sessions_visitor_idx on public.site_sessions (visitor_id);

create table if not exists public.site_events (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.site_sessions(id) on delete cascade,
  at         timestamptz not null default now(),
  type       text not null check (type ~ '^[a-z_]{2,24}$'),
  category   text,
  value      text,
  extra      text,
  tab        text,
  target     text,
  label      text
);
create index if not exists site_events_at_idx on public.site_events (at desc);
create index if not exists site_events_sess_idx on public.site_events (session_id, at);
create index if not exists site_events_type_idx on public.site_events (type, at desc);

alter table public.site_sessions enable row level security;
alter table public.site_events   enable row level security;
-- لا توجد سياسة للزائر (anon): مقفلة عليه كليًا.
drop policy if exists "تحليلات - جلسات (قراءة)" on public.site_sessions;
drop policy if exists "تحليلات - جلسات (حذف)" on public.site_sessions;
drop policy if exists "تحليلات - أحداث (قراءة)" on public.site_events;
drop policy if exists "تحليلات - أحداث (حذف)" on public.site_events;
create policy "تحليلات - جلسات (قراءة)" on public.site_sessions for select to authenticated using (public.has_perm('view_analytics'));
create policy "تحليلات - جلسات (حذف)"   on public.site_sessions for delete to authenticated using (public.has_perm('edit_permissions'));
create policy "تحليلات - أحداث (قراءة)"  on public.site_events   for select to authenticated using (public.has_perm('view_analytics'));
create policy "تحليلات - أحداث (حذف)"    on public.site_events   for delete to authenticated using (public.has_perm('edit_permissions'));

-- تجميع شامل بدالة واحدة (توقيت الرياض) — يتحقق من الصلاحية داخليًا
create or replace function public.site_insights(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.has_perm('view_analytics') then raise exception 'forbidden'; end if;
  with s as (select * from site_sessions where started_at >= p_from and started_at < p_to),
       e as (select * from site_events where at >= p_from and at < p_to),
       m as (select s.id, count(e.id) filter (where e.type not in ('hide','show','end','scroll','visit')) n from s left join e on e.session_id = s.id group by s.id)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'sessions', (select count(*) from s),
      'visitors', (select count(distinct visitor_id) from s),
      'returning', (select count(*) from s where is_returning),
      'events', (select count(*) from e),
      'clicks', (select count(*) from e where type in ('click','link','download')),
      'avg_active_ms', coalesce((select round(avg(active_ms)) from s where active_ms > 0), 0),
      'bounce', (select count(*) from m where n = 0),
      'live', (select count(*) from site_sessions where last_seen_at > now() - interval '5 minutes'),
      'shares', (select count(*) from e where type = 'share'),
      'likes', (select count(*) from e where type = 'feedback' and value = 'up'),
      'dislikes', (select count(*) from e where type = 'feedback' and value = 'down')
    ),
    'daily', coalesce((select jsonb_agg(to_jsonb(x) order by x.d) from (
        select (started_at at time zone 'Asia/Riyadh')::date d, count(*) sessions, count(distinct visitor_id) visitors, sum(events) events
        from s group by 1) x), '[]'),
    'hourly', coalesce((select jsonb_agg(to_jsonb(x) order by x.h) from (
        select extract(hour from started_at at time zone 'Asia/Riyadh')::int h, count(*) sessions from s group by 1) x), '[]'),
    'tabs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select category k, count(*) views, count(distinct session_id) sessions from e where type = 'tab' and category is not null group by 1 order by 2 desc limit 12) x), '[]'),
    'inquiries', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select category k, count(*) opens, count(distinct session_id) sessions, max(extra) info from e where type = 'inquiry_open' and category is not null group by 1 order by 2 desc limit 25) x), '[]'),
    'filters', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select category || ' = ' || coalesce(value, '') k, count(*) n from e where type = 'filter' and category is not null group by 1 order by 2 desc limit 25) x), '[]'),
    'searches', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select lower(value) k, count(*) n, count(distinct session_id) sessions from e where type = 'search' and value is not null group by 1 order by 2 desc limit 25) x), '[]'),
    'clicks', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select coalesce(nullif(label, ''), category) k, count(*) n, count(distinct session_id) sessions from e
        where type = 'click' and coalesce(nullif(label, ''), category) is not null group by 1 order by 2 desc limit 30) x), '[]'),
    'nav', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select category || coalesce(' · ' || nullif(value, ''), '') k, count(*) n from e where type = 'nav' and category is not null group by 1 order by 2 desc limit 25) x), '[]'),
    'links', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select coalesce(nullif(label, ''), nullif(value, ''), category) k, type, count(*) n from e where type in ('link', 'download') group by 1, 2 order by 3 desc limit 20) x), '[]'),
    'errors', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select left(value, 140) k, count(*) n from e where type = 'error' and value is not null group by 1 order by 2 desc limit 10) x), '[]'),
    'devices',   coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(device, '—') k, count(*) n from s group by 1 order by 2 desc) x), '[]'),
    'browsers',  coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(browser, '—') k, count(*) n from s group by 1 order by 2 desc limit 8) x), '[]'),
    'oses',      coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(os, '—') k, count(*) n from s group by 1 order by 2 desc limit 8) x), '[]'),
    'countries', coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(country, '—') k, count(*) n from s group by 1 order by 2 desc limit 12) x), '[]'),
    'langs',     coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(lang, '—') k, count(*) n from s group by 1 order by 2 desc limit 8) x), '[]'),
    'screens',   coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(screen, '—') k, count(*) n from s group by 1 order by 2 desc limit 8) x), '[]'),
    'referrers', coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(nullif(referrer, ''), 'مباشر / تطبيق مراسلة') k, count(*) n from s group by 1 order by 2 desc limit 10) x), '[]'),
    'themes',    coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(theme, '—') k, count(*) n from s group by 1 order by 2 desc) x), '[]'),
    'scroll', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select case when max_scroll < 25 then '0–25%' when max_scroll < 50 then '25–50%' when max_scroll < 75 then '50–75%' else '75–100%' end k, count(*) n
        from s group by 1 order by 1) x), '[]'),
    'durations', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select case when active_ms < 10000 then '1· أقل من 10 ث' when active_ms < 30000 then '2· 10–30 ث' when active_ms < 60000 then '3· 30–60 ث'
                    when active_ms < 180000 then '4· 1–3 د' when active_ms < 600000 then '5· 3–10 د' else '6· أكثر من 10 د' end k, count(*) n
        from s group by 1 order by 1) x), '[]')
  ) into r;
  return r;
end $$;
revoke execute on function public.site_insights(timestamptz, timestamptz) from public, anon;
grant execute on function public.site_insights(timestamptz, timestamptz) to authenticated;
