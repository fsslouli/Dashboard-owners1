-- ══════════════════════════════════════════════════════════
-- معرض الموقع (الصور والمقاطع) — هجرة إضافية فوق setup-supabase.sql
-- شغّلها مرة وحدة في SQL Editor بمشروع Supabase (codnqkeycfhznzbqlpds)
-- تعتمد على has_perm() والصلاحية manage_media الموجودتين أصلاً.
-- ══════════════════════════════════════════════════════════

-- (١) المواضيع — كل موضوع يجمع عدة صور/مقاطع مع بعض
create table if not exists public.media_topics (
  id          bigserial primary key,
  title_ar    text check (title_ar is null or char_length(title_ar) <= 140),
  title_en    text check (title_en is null or char_length(title_en) <= 140),
  sort_order  integer not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text check (updated_by is null or char_length(updated_by) <= 120)
);

-- (٢) العناصر — صورة مرفوعة، صورة برابط خارجي، أو مقطع يوتيوب
create table if not exists public.media_items (
  id            bigserial primary key,
  topic_id      bigint not null references public.media_topics(id) on delete cascade,
  kind          text not null check (kind in ('image','video')),
  source        text not null default 'upload' check (source in ('upload','link')),
  title_ar      text check (title_ar is null or char_length(title_ar) <= 140),
  title_en      text check (title_en is null or char_length(title_en) <= 140),
  storage_path  text,                                              -- للصور المرفوعة (bucket: gallery)
  external_url  text check (external_url is null or char_length(external_url) <= 1000),  -- لرابط الصورة الخارجي
  youtube_id    text check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  sort_order    integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text check (updated_by is null or char_length(updated_by) <= 120),
  constraint media_items_kind_fields_chk check (
    (kind = 'video' and youtube_id is not null and storage_path is null and external_url is null) or
    (kind = 'image' and source = 'upload' and storage_path is not null and youtube_id is null and external_url is null) or
    (kind = 'image' and source = 'link' and external_url is not null and youtube_id is null and storage_path is null)
  )
);

create index if not exists media_items_topic_idx on public.media_items(topic_id, sort_order);

-- (٣) ختم «من عدّل ومتى» تلقائيًا من قاعدة البيانات نفسها
create or replace function public.stamp_media_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select coalesce(p.name, u.email) into who
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = auth.uid();
  new.updated_by := coalesce(who, 'نظام');
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := now();
  else new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_stamp_media_topics on public.media_topics;
create trigger trg_stamp_media_topics before insert or update on public.media_topics
  for each row execute function public.stamp_media_row();
drop trigger if exists trg_stamp_media_items on public.media_items;
create trigger trg_stamp_media_items before insert or update on public.media_items
  for each row execute function public.stamp_media_row();

-- (٤) نسخة الكاش — نفس أسلوب model_videos_rev، عشان الزوّار يشوفون التحديث لحظيًا
create table if not exists public.media_rev (
  id bigint primary key default 1, rev bigint not null default 0, changed_at timestamptz not null default now()
);
insert into public.media_rev (id) values (1) on conflict (id) do nothing;
create or replace function public.bump_media_rev()
returns trigger language plpgsql as $$
begin
  update public.media_rev set rev = rev + 1, changed_at = now() where id = 1;
  return null;
end;
$$;
drop trigger if exists trg_media_topics_rev on public.media_topics;
create trigger trg_media_topics_rev after insert or update or delete or truncate on public.media_topics
  for each statement execute function public.bump_media_rev();
drop trigger if exists trg_media_items_rev on public.media_items;
create trigger trg_media_items_rev after insert or update or delete or truncate on public.media_items
  for each statement execute function public.bump_media_rev();

-- (٥) طريقة عرض المعرض بالموقع العام: أقسام منفصلة أو كل شي مع بعض
alter table public.site_settings
  add column if not exists gallery_mode text not null default 'sections';
alter table public.site_settings
  drop constraint if exists site_settings_gallery_mode_chk;
alter table public.site_settings
  add constraint site_settings_gallery_mode_chk
  check (gallery_mode in ('sections','merged'));

-- (٦) الصلاحيات — نفس manage_media الموجودة، ما تحتاج صف جديد بـ ADMIN_PERMISSIONS
alter table public.media_topics enable row level security;
alter table public.media_items enable row level security;
alter table public.media_rev enable row level security;

drop policy if exists "قراءة عامة - المواضيع الظاهرة" on public.media_topics;
create policy "قراءة عامة - المواضيع الظاهرة" on public.media_topics
  for select to anon, authenticated using (published = true);
drop policy if exists "قراءة الإدارة - كل المواضيع" on public.media_topics;
create policy "قراءة الإدارة - كل المواضيع" on public.media_topics
  for select to authenticated using (public.has_perm('manage_media'));
drop policy if exists "إضافة - المواضيع" on public.media_topics;
create policy "إضافة - المواضيع" on public.media_topics
  for insert to authenticated with check (public.has_perm('manage_media'));
drop policy if exists "تعديل - المواضيع" on public.media_topics;
create policy "تعديل - المواضيع" on public.media_topics
  for update to authenticated using (public.has_perm('manage_media')) with check (public.has_perm('manage_media'));
drop policy if exists "حذف - المواضيع" on public.media_topics;
create policy "حذف - المواضيع" on public.media_topics
  for delete to authenticated using (public.has_perm('manage_media'));

drop policy if exists "قراءة عامة - العناصر الظاهرة" on public.media_items;
create policy "قراءة عامة - العناصر الظاهرة" on public.media_items
  for select to anon, authenticated using (
    published = true and exists (select 1 from public.media_topics t where t.id = topic_id and t.published = true)
  );
drop policy if exists "قراءة الإدارة - كل العناصر" on public.media_items;
create policy "قراءة الإدارة - كل العناصر" on public.media_items
  for select to authenticated using (public.has_perm('manage_media'));
drop policy if exists "إضافة - العناصر" on public.media_items;
create policy "إضافة - العناصر" on public.media_items
  for insert to authenticated with check (public.has_perm('manage_media'));
drop policy if exists "تعديل - العناصر" on public.media_items;
create policy "تعديل - العناصر" on public.media_items
  for update to authenticated using (public.has_perm('manage_media')) with check (public.has_perm('manage_media'));
drop policy if exists "حذف - العناصر" on public.media_items;
create policy "حذف - العناصر" on public.media_items
  for delete to authenticated using (public.has_perm('manage_media'));

drop policy if exists "قراءة عامة - نسخة الكاش" on public.media_rev;
create policy "قراءة عامة - نسخة الكاش" on public.media_rev for select to anon, authenticated using (true);

-- (٧) حاوية تخزين الصور — عامة للقراءة، الرفع/الحذف بصلاحية manage_media فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "قراءة عامة - صور المعرض" on storage.objects;
create policy "قراءة عامة - صور المعرض" on storage.objects
  for select to anon, authenticated using (bucket_id = 'gallery');
drop policy if exists "رفع - صور المعرض" on storage.objects;
create policy "رفع - صور المعرض" on storage.objects
  for insert to authenticated with check (bucket_id = 'gallery' and public.has_perm('manage_media'));
drop policy if exists "حذف - صور المعرض" on storage.objects;
create policy "حذف - صور المعرض" on storage.objects
  for delete to authenticated using (bucket_id = 'gallery' and public.has_perm('manage_media'));
