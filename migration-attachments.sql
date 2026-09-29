-- ══════════════════════════════════════════════════════════
-- المرفقات (٣.٠.٠) — مرفقات الاستفسارات + ملفات PDF وفيديو بمعرض الموقع
-- ✅ مطبّقة فعليًا على المشروع codnqkeycfhznzbqlpds بتاريخ 29 سبتمبر 2026 — لا تحتاج تشغيلها مرة ثانية على هذا المشروع.
-- (للمشاريع الجديدة: شغّلها مرة وحدة في SQL Editor.)
-- إضافية بالكامل: ما تحذف ولا تعدّل أي بيانات موجودة، وكلها داخل معاملة وحدة
-- (لو فشل أي سطر ما يتطبّق شي). آمنة لإعادة التشغيل.
-- تفترض أن migration-gallery.sql اشتغل قبلها (جداول media_topics / media_items موجودة).
-- قبل تشغيلها الموقع يشتغل كامل بدون مرفقات، ولوحة الإدارة تعرض تنبيهًا بدل قسم المرفقات.
-- ══════════════════════════════════════════════════════════
begin;

-- (١) ختم «من عدّل ومتى» — نفس دالة المعرض (نعيد تعريفها هنا عشان الملف يكون مستقل)
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

-- (٢) جدول مرفقات الاستفسارات
--     ⚠ بدون مفتاح أجنبي على inquiries عن قصد: مزامنة الإكسل الكاملة (replace_inquiries_full)
--     تحذف كل الاستفسارات وتعيد إدخالها بنفس الأرقام. مفتاح أجنبي «cascade» كان بيمسح كل
--     المرفقات مع كل رفع إكسل، وبدون cascade كان بيوقف الرفع نفسه. الربط برقم الاستفسار.
create table if not exists public.inquiry_attachments (
  id            bigserial primary key,
  inquiry_id    integer not null,
  kind          text not null check (kind in ('pdf','video','image','office','file','web')),
  source        text not null check (source in ('upload','link')),
  provider      text check (provider is null or provider in ('youtube','drive','gdocs','vimeo','dropbox','onedrive','direct','web')),
  title_ar      text check (title_ar is null or char_length(title_ar) <= 140),
  title_en      text check (title_en is null or char_length(title_en) <= 140),
  storage_path  text check (storage_path is null or char_length(storage_path) <= 300),
  thumb_path    text check (thumb_path is null or char_length(thumb_path) <= 300),
  external_url  text check (external_url is null or (char_length(external_url) <= 2000 and external_url ~ '^https://')),
  embed_url     text check (embed_url is null or (char_length(embed_url) <= 2000 and embed_url ~ '^https://')),
  youtube_id    text check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  file_name     text check (file_name is null or char_length(file_name) <= 255),
  mime          text check (mime is null or char_length(mime) <= 120),
  ext           text check (ext is null or ext ~ '^[a-z0-9]{1,8}$'),
  size_bytes    bigint check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 52428800)),
  pages         integer check (pages is null or (pages > 0 and pages < 10000)),
  duration_s    integer check (duration_s is null or (duration_s >= 0 and duration_s < 86400)),
  vertical      boolean not null default false,
  sort_order    integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text check (updated_by is null or char_length(updated_by) <= 120),
  constraint inquiry_attachments_source_chk check (
    (source = 'upload' and storage_path is not null and external_url is null) or
    (source = 'link' and external_url is not null and storage_path is null)
  ),
  constraint inquiry_attachments_yt_chk check (youtube_id is null or (kind = 'video' and source = 'link'))
);
create index if not exists inquiry_attachments_inq_idx on public.inquiry_attachments(inquiry_id, sort_order);

drop trigger if exists trg_stamp_inquiry_attachments on public.inquiry_attachments;
create trigger trg_stamp_inquiry_attachments before insert or update on public.inquiry_attachments
  for each row execute function public.stamp_media_row();

-- (٣) إشارة تحديث لحظية — نفس فكرة model_videos_rev: الزائر يسمعها ويعيد القراءة،
--     فحتى «الإخفاء» يوصل فورًا بدون كشف أي مرفق مخفي
create table if not exists public.inquiry_attachments_rev (
  id          smallint primary key default 1 check (id = 1),
  rev         bigint not null default 0,
  changed_at  timestamptz not null default now()
);
insert into public.inquiry_attachments_rev (id) values (1) on conflict (id) do nothing;
create or replace function public.bump_inquiry_attachments_rev()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.inquiry_attachments_rev set rev = rev + 1, changed_at = now() where id = 1;
  return null;
end $$;
drop trigger if exists trg_inquiry_attachments_rev on public.inquiry_attachments;
create trigger trg_inquiry_attachments_rev after insert or update or delete or truncate on public.inquiry_attachments
  for each statement execute function public.bump_inquiry_attachments_rev();

-- (٤) صلاحيات الصفوف: الزائر يقرأ الظاهر فقط، والتعديل بصلاحية «تعديل استفسار موجود»
alter table public.inquiry_attachments enable row level security;
alter table public.inquiry_attachments_rev enable row level security;

drop policy if exists "قراءة عامة - المرفقات الظاهرة" on public.inquiry_attachments;
create policy "قراءة عامة - المرفقات الظاهرة" on public.inquiry_attachments
  for select to anon, authenticated using (published);
drop policy if exists "قراءة الإدارة - كل المرفقات" on public.inquiry_attachments;
create policy "قراءة الإدارة - كل المرفقات" on public.inquiry_attachments
  for select to authenticated using (public.is_known_admin());
drop policy if exists "إضافة - المرفقات" on public.inquiry_attachments;
create policy "إضافة - المرفقات" on public.inquiry_attachments
  for insert to authenticated with check (public.has_perm('edit_inquiry'));
drop policy if exists "تعديل - المرفقات" on public.inquiry_attachments;
create policy "تعديل - المرفقات" on public.inquiry_attachments
  for update to authenticated using (public.has_perm('edit_inquiry')) with check (public.has_perm('edit_inquiry'));
drop policy if exists "حذف - المرفقات" on public.inquiry_attachments;
create policy "حذف - المرفقات" on public.inquiry_attachments
  for delete to authenticated using (public.has_perm('edit_inquiry'));
drop policy if exists "قراءة عامة - إشارة تحديث المرفقات" on public.inquiry_attachments_rev;
create policy "قراءة عامة - إشارة تحديث المرفقات" on public.inquiry_attachments_rev
  for select to anon, authenticated using (true);

-- (٥) صلاحيات الأعمدة: الزائر يقرأ أعمدة العرض فقط — «من عدّل» داخلي ما ينزل له
revoke all on public.inquiry_attachments from anon;
grant select (id, inquiry_id, kind, source, provider, title_ar, title_en, storage_path, thumb_path,
  external_url, embed_url, youtube_id, file_name, mime, ext, size_bytes, pages, duration_s, vertical,
  sort_order, published, updated_at) on public.inquiry_attachments to anon;
revoke all on public.inquiry_attachments_rev from anon, authenticated;
grant select on public.inquiry_attachments_rev to anon, authenticated;
revoke execute on function public.bump_inquiry_attachments_rev() from public, anon, authenticated;
revoke execute on function public.stamp_media_row() from public, anon, authenticated;

-- (٦) المعرض: يقبل PDF وفيديو مرفوع وروابط Drive/Vimeo، مع الإبقاء على الصور ويوتيوب كما هي
alter table public.media_items add column if not exists provider text
  check (provider is null or provider in ('youtube','drive','gdocs','vimeo','dropbox','onedrive','direct','web'));
alter table public.media_items add column if not exists bucket text not null default 'gallery'
  check (bucket in ('gallery','attachments'));
alter table public.media_items add column if not exists thumb_path text check (thumb_path is null or char_length(thumb_path) <= 300);
alter table public.media_items add column if not exists embed_url text
  check (embed_url is null or (char_length(embed_url) <= 2000 and embed_url ~ '^https://'));
alter table public.media_items add column if not exists file_name text check (file_name is null or char_length(file_name) <= 255);
alter table public.media_items add column if not exists mime text check (mime is null or char_length(mime) <= 120);
alter table public.media_items add column if not exists ext text check (ext is null or ext ~ '^[a-z0-9]{1,8}$');
alter table public.media_items add column if not exists size_bytes bigint
  check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 52428800));
alter table public.media_items add column if not exists pages integer check (pages is null or (pages > 0 and pages < 10000));
alter table public.media_items add column if not exists duration_s integer
  check (duration_s is null or (duration_s >= 0 and duration_s < 86400));
alter table public.media_items add column if not exists vertical boolean not null default false;

alter table public.media_items drop constraint if exists media_items_kind_check;
alter table public.media_items add constraint media_items_kind_check
  check (kind in ('image','video','pdf','office'));
alter table public.media_items drop constraint if exists media_items_kind_fields_chk;
alter table public.media_items add constraint media_items_kind_fields_chk check (
  (source = 'link' and kind = 'video' and youtube_id is not null and storage_path is null and external_url is null) or  -- يوتيوب
  (source = 'link' and youtube_id is null and external_url is not null and storage_path is null) or    -- أي رابط ثاني
  (source = 'upload' and storage_path is not null and youtube_id is null and external_url is null)      -- أي ملف مرفوع
);

-- أعمدة العرض فقط للزائر بالمعرض كذلك (كانت كل الأعمدة مكشوفة بما فيها «من عدّل»)
revoke all on public.media_items from anon;
grant select (id, topic_id, kind, source, provider, bucket, title_ar, title_en, storage_path, thumb_path,
  external_url, embed_url, youtube_id, file_name, mime, ext, size_bytes, pages, duration_s, vertical,
  sort_order, published, updated_at) on public.media_items to anon;
revoke all on public.media_topics from anon;
grant select (id, title_ar, title_en, sort_order, published, updated_at) on public.media_topics to anon;
revoke all on public.media_rev from anon;
grant select on public.media_rev to anon;

-- (٧) البث اللحظي لإشارتي التحديث (المرفقات + المعرض)
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inquiry_attachments_rev') then
    alter publication supabase_realtime add table public.inquiry_attachments_rev;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'media_rev') then
    alter publication supabase_realtime add table public.media_rev;
  end if;
end $$;

-- (٨) حاوية التخزين «attachments»: قراءة عامة، والرفع/الحذف بالصلاحية حسب المجلد
--     inq/…  مرفقات الاستفسارات  ← «تعديل استفسار موجود»
--     gal/…  ملفات المعرض (PDF/فيديو) ← «إدارة الوسائط»
--     الحد 50MB للملف (سقف الخطة المجانية). الصور تنضغط بالمتصفح قبل الرفع.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', true, 52428800, array[
  'application/pdf',
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','video/quicktime',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip','application/octet-stream'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "رفع - المرفقات" on storage.objects;
create policy "رفع - المرفقات" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'attachments' and (
      ((storage.foldername(name))[1] = 'inq' and public.has_perm('edit_inquiry')) or
      ((storage.foldername(name))[1] = 'gal' and public.has_perm('manage_media'))
    ));
drop policy if exists "حذف - المرفقات" on storage.objects;
create policy "حذف - المرفقات" on storage.objects
  for delete to authenticated using (
    bucket_id = 'attachments' and (
      ((storage.foldername(name))[1] = 'inq' and public.has_perm('edit_inquiry')) or
      ((storage.foldername(name))[1] = 'gal' and public.has_perm('manage_media'))
    ));

-- (٩) عدّاد المساحة بلوحة الإدارة: رقم واحد فقط (مجموع أحجام الملفات)، للمسجّلين فقط
create or replace function public.storage_usage_bytes()
returns bigint language sql stable security definer set search_path = public, storage as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects;
$$;
revoke execute on function public.storage_usage_bytes() from public, anon;
grant execute on function public.storage_usage_bytes() to authenticated;

commit;
