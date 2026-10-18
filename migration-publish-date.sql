-- ═══════════════════════════════════════════════════════════════════
-- migration-publish-date.sql — تاريخ النشر على كل الملفات (٦.٥.٠)
-- published_at = وقت ما صار الملف ظاهرًا للملاك فعليًا (يتعبّى تلقائيًا بتريقر).
-- display_date = تاريخ مخصص اختياري يظهر بدل تاريخ النشر (مثلاً تقرير شهر سابق).
-- إضافية وآمنة لإعادة التشغيل: أعمدة جديدة + تريقر، ما تغيّر سياسات القراءة.
-- ═══════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['media_items','inquiry_attachments','external_links','model_videos'] loop
    execute format('alter table public.%I add column if not exists published_at timestamptz', t);
    execute format('alter table public.%I add column if not exists display_date date', t);
    execute format('update public.%I set published_at = created_at where published and published_at is null', t);
  end loop;
end $$;

create or replace function public.stamp_published_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.published then
    if new.published_at is null then new.published_at := now(); end if;
  else
    new.published_at := null;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['media_items','inquiry_attachments','external_links','model_videos'] loop
    execute format('drop trigger if exists trg_stamp_published_at on public.%I', t);
    execute format('create trigger trg_stamp_published_at before insert or update on public.%I for each row execute function public.stamp_published_at()', t);
  end loop;
end $$;
