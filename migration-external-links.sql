-- ══════════════════════════════════════════════════════════
-- v5.4.0 — الروابط الخارجية («مساهمات الملاك») — هجرة إضافية
-- شغّلها مرة وحدة في SQL Editor بمشروع Supabase (codnqkeycfhznzbqlpds)
-- • جدول external_links: رابط خارجي بعنوان ووصف وصاحب الجهد وتنبيه، يُعرض بأي مكان من الأماكن الأربعة
--   (مجلد بالمعرض / بطاقة بالنظرة العامة / نافذة الإشعارات / شريط الترويسة)
-- • القراءة العامة للمنشور فقط. الإضافة والتعديل والحذف بصلاحية جديدة manage_links.
-- • الصلاحية تُمنح تلقائيًا لكل من عنده manage_gallery (فلا يفقد أحد وصولًا).
-- ══════════════════════════════════════════════════════════

create table if not exists public.external_links (
  id            bigserial primary key,
  title_ar      text not null check (char_length(title_ar) between 1 and 140),
  title_en      text check (title_en is null or char_length(title_en) <= 140),
  desc_ar       text check (desc_ar is null or char_length(desc_ar) <= 400),
  desc_en       text check (desc_en is null or char_length(desc_en) <= 400),
  author_ar     text check (author_ar is null or char_length(author_ar) <= 120),   -- مثل «إعداد أحد الملاك»
  author_en     text check (author_en is null or char_length(author_en) <= 120),
  disclaimer_ar text check (disclaimer_ar is null or char_length(disclaimer_ar) <= 500),  -- فاضي = النص الافتراضي بالموقع
  disclaimer_en text check (disclaimer_en is null or char_length(disclaimer_en) <= 500),
  url           text not null check (url ~* '^https://[^[:space:]]+$' and char_length(url) <= 1000),
  placements    text[] not null default '{gallery}'
                check (placements <@ array['gallery','overview','notices','header']::text[]),
  folder_ar     text not null default 'مساهمات الملاك' check (char_length(folder_ar) between 1 and 80),
  folder_en     text not null default 'Owner Contributions' check (char_length(folder_en) between 1 and 80),
  sort_order    integer not null default 0,
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text check (updated_by is null or char_length(updated_by) <= 120)
);
create index if not exists external_links_order_idx on public.external_links(sort_order, id);

-- ختم «من عدّل ومتى» (نفس دالة المعرض)
drop trigger if exists trg_stamp_external_links on public.external_links;
create trigger trg_stamp_external_links before insert or update on public.external_links
  for each row execute function public.stamp_media_row();

-- RLS
alter table public.external_links enable row level security;
drop policy if exists "قراءة الروابط المنشورة" on public.external_links;
create policy "قراءة الروابط المنشورة" on public.external_links
  for select to anon, authenticated using (published = true);
drop policy if exists "قراءة كل الروابط للإدارة" on public.external_links;
create policy "قراءة كل الروابط للإدارة" on public.external_links
  for select to authenticated using (public.has_perm('manage_links'));
drop policy if exists "إضافة روابط" on public.external_links;
create policy "إضافة روابط" on public.external_links
  for insert to authenticated with check (public.has_perm('manage_links'));
drop policy if exists "تعديل روابط" on public.external_links;
create policy "تعديل روابط" on public.external_links
  for update to authenticated using (public.has_perm('manage_links')) with check (public.has_perm('manage_links'));
drop policy if exists "حذف روابط" on public.external_links;
create policy "حذف روابط" on public.external_links
  for delete to authenticated using (public.has_perm('manage_links'));

revoke all on public.external_links from anon;
grant select on public.external_links to anon;
grant select, insert, update, delete on public.external_links to authenticated;
grant usage, select on sequence public.external_links_id_seq to authenticated;

-- التحديث اللحظي للزوّار
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'external_links') then
    alter publication supabase_realtime add table public.external_links;
  end if;
end $$;

-- منح الصلاحية الجديدة لمن عنده manage_gallery
update public.profiles
   set perms = array_append(coalesce(perms, '{}'::text[]), 'manage_links')
 where 'manage_gallery' = any (coalesce(perms, '{}'::text[]))
   and not ('manage_links' = any (coalesce(perms, '{}'::text[])));

-- الرابط الأول: موقع أحد الملاك — يُضاف «غير منشور» لتراجعه من لوحة الإدارة ثم تنشره بضغطة
insert into public.external_links
  (title_ar, title_en, desc_ar, desc_en, author_ar, author_en, url, placements, sort_order, published)
select 'ملخص التقارير الشهرية', 'Monthly Reports Summary',
       'موقع مستقل أعده أحد الملاك، يلخّص تقارير المطور الشهرية في صفحة واحدة.',
       'An independent website prepared by one of the owners, summarising the developer''s monthly reports on one page.',
       'إعداد أحد الملاك', 'Prepared by one of the owners',
       'https://raljohani.github.io/alborada-villas-tracker/', array['gallery'], 0, false
where not exists (select 1 from public.external_links);
