-- ═══════════════════════════════════════════════════════════
-- إعداد قاعدة بيانات لوحة إدارة ألبورادا
-- شغّل هذا الملف مرة وحدة من: Supabase Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

-- ١) الاستفسارات
create table if not exists public.inquiries (
  id serial primary key,
  model text, loc text, pri text, cat text, status text, owner text, month text,
  note text, note_en text, reply text, closed text default 'لا',
  urgent boolean default false,
  updated_at timestamptz default now()
);

-- ترقية لقاعدة بيانات موجودة أصلًا: يضيف عمود الفئة بدون ما يمسّ أي بيانات حالية.
-- (آمن تمامًا — لو العمود موجود مسبقًا ما يسوي شي)
alter table public.inquiries add column if not exists cat text;

-- ترقية: عمود "مهم" — وسم يدوي بالكامل (يُفعَّل ويُلغى من لوحة الإدارة فقط، بدون
-- أي مدة انتهاء تلقائية) يظهر كشارة حمراء واضحة وميّاضة على بطاقة الاستفسار بالموقع العام.
-- (آمن تمامًا — لو العمود موجود مسبقًا ما يسوي شي)
alter table public.inquiries add column if not exists important boolean default false;

-- ترقية: مدة تفعيل مؤقتة لوسمَي "يجب الاطلاع" و"مهم" — لو الحقل _until معبّى بتاريخ
-- مستقبلي، يُعتبر الوسم فعّالاً لين ذاك التاريخ فقط؛ لو فاضي والحقل المنطقي (urgent/
-- important) صحيح، فالتفعيل دائم. يختاره الأدمن (٣ أيام / ٧ أيام / دائم) عند التفعيل.
alter table public.inquiries add column if not exists urgent_until timestamptz;
alter table public.inquiries add column if not exists important_until timestamptz;

-- ترقية: عمود "تاريخ الإضافة" منفصل عن "تاريخ آخر تعديل" (updated_at) — يخدم فرز
-- الاستفسارات بلوحة الإدارة حسب الأحدث إضافة أو الأحدث تعديلاً.
-- (آمن تمامًا — لو العمود موجود مسبقًا ما يسوي شي)
alter table public.inquiries add column if not exists created_at timestamptz default now();
-- تعبئة الصفوف القديمة اللي ما لها created_at (قبل هذه الترقية) بأقرب قيمة متاحة
update public.inquiries set created_at = updated_at where created_at is null;

-- ترقية: تحديث تلقائي لـ updated_at عند أي تعديل على صف الاستفسار (كان يتحدّث فقط
-- عند الإضافة). هذا يخلّي فرز "الأحدث تعديلاً" بلوحة الإدارة يعكس آخر تعديل فعلي.
create or replace function public.set_inquiry_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_inquiries_updated_at on public.inquiries;
create trigger trg_inquiries_updated_at
before update on public.inquiries
for each row execute function public.set_inquiry_updated_at();

-- ٢) تقدّم التنفيذ
create table if not exists public.progress (
  month text primary key,
  planned numeric default 0,
  actual numeric default 0
);

-- ٣) فئات الفلترة (كل صف = فئة، وقيمها كمصفوفة نصية)
create table if not exists public.filter_categories (
  key text primary key,
  label text not null,
  locked boolean default false,
  values text[] default '{}'
);

-- ٤) الملفات الشخصية للأدمن — الصلاحيات مرتبطة بحساب الدخول (auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text default 'custom',
  perms text[] default '{}'
);

-- ٥) سجل نشاط الإدارة
create table if not exists public.audit_log (
  id bigserial primary key,
  user_name text,
  action text,
  details text,
  ts timestamptz default now()
);

-- ٦) سجل زيارات وسلوك الموقع العام (نفس الجدول اللي يستخدمه logEvent بالكود الحالي)
create table if not exists public.logs (
  id bigserial primary key,
  event_type text, category text, value text, extra text, session_id text,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════
-- تفعيل الحماية على مستوى الصف (RLS) — هذا هو الجزء الأهم أمنيًا
-- ═══════════════════════════════════════════════════════════
alter table public.inquiries enable row level security;
alter table public.progress enable row level security;
alter table public.filter_categories enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.logs enable row level security;

-- قراءة عامة (الموقع العام لازم يقرأ الاستفسارات/التقدم/الفلاتر بدون تسجيل دخول)
create policy "قراءة عامة - الاستفسارات" on public.inquiries for select using (true);
create policy "قراءة عامة - التقدم" on public.progress for select using (true);
create policy "قراءة عامة - الفلاتر" on public.filter_categories for select using (true);
create policy "إدخال عام - سجل الزيارات" on public.logs for insert with check (true);

-- الكتابة (إضافة/تعديل/حذف) مقصورة على مستخدم مسجّل دخول فقط
create policy "كتابة للمسجّلين - الاستفسارات" on public.inquiries for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "كتابة للمسجّلين - التقدم" on public.progress for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "كتابة للمسجّلين - الفلاتر" on public.filter_categories for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "قراءة للمسجّلين - سجل النشاط" on public.audit_log for select
  using (auth.role() = 'authenticated');
create policy "إدخال للمسجّلين - سجل النشاط" on public.audit_log for insert
  with check (auth.role() = 'authenticated');
create policy "قراءة للمسجّلين - الملفات الشخصية" on public.profiles for select
  using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════
-- بيانات ابتدائية — فئات الفلترة الأساسية
-- ═══════════════════════════════════════════════════════════
insert into public.filter_categories (key, label, locked, values) values
  ('model', 'النموذج', true, array['أمانيثير','ألبا','أورورا']),
  ('loc', 'الموقع', true, array['الطابق الأرضي','السطح','كامل الفيلا']),
  ('pri', 'الأولوية', true, array['عالية جدًا','عالية','متوسطة','عادية']),
  ('cat', 'الفئة (تصنيف نوع البند)', true, array['تصحيح عيب تنفيذي','تصميمي/جمالي','ترقية','استفسار فني توضيحي','تجاري','إداري/نظامي']),
  ('status', 'الحالة', true, array['معتمدة','قيد الدراسة','تم التصويت']),
  ('closed', 'مقفل / مفتوح', true, array['نعم','لا'])
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════
-- ٧) تشديد الأمان — سياسات RLS مبنية فعليًا على صلاحيات profiles.perms
-- بدل "أي حساب مسجّل دخول = تحكم كامل". آمنة لإعادة التشغيل (كلها
-- create or replace / drop if exists). شغّلها مرة وحدة من SQL Editor.
-- ═══════════════════════════════════════════════════════════
create or replace function public.current_perms()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(perms, '{}'::text[]) from public.profiles where id = auth.uid();
$$;

create or replace function public.has_perm(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select p = any(public.current_perms());
$$;

create or replace function public.is_known_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid());
$$;

drop policy if exists "كتابة للمسجّلين - الاستفسارات" on public.inquiries;
create policy "إضافة - الاستفسارات" on public.inquiries for insert
  with check (public.has_perm('add_inquiry') or public.has_perm('import_excel'));
create policy "تعديل - الاستفسارات" on public.inquiries for update
  using (public.is_known_admin()) with check (public.is_known_admin());
create policy "حذف - الاستفسارات" on public.inquiries for delete
  using (public.has_perm('delete_inquiry'));

-- فحص تفصيلي بمستوى العمود: وسوم العرض (يجب الاطلاع/مهم/جديد) تحتاج flag_urgent،
-- ومحتوى الاستفسار يحتاج edit_inquiry أو import_excel — مفروض من قاعدة البيانات
-- نفسها، ما ينكسر حتى لو حد نادى الـ API مباشرة متجاوزًا واجهة الموقع.
create or replace function public.check_inquiry_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  flag_cols text[] := array['urgent','urgent_until','important','important_until','last_modified'];
  content_cols text[] := array['model','loc','pri','cat','status','owner','month','note','note_en','reply','reply_en','closed','answered','meetings'];
  col text;
begin
  foreach col in array flag_cols loop
    if (to_jsonb(old) ->> col) is distinct from (to_jsonb(new) ->> col) then
      if not public.has_perm('flag_urgent') then
        raise exception 'لا توجد صلاحية لتعديل وسوم العرض (يجب الاطلاع/مهم/جديد)';
      end if;
    end if;
  end loop;
  foreach col in array content_cols loop
    if (to_jsonb(old) ->> col) is distinct from (to_jsonb(new) ->> col) then
      if not (public.has_perm('edit_inquiry') or public.has_perm('import_excel')) then
        raise exception 'لا توجد صلاحية لتعديل محتوى الاستفسار';
      end if;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_check_inquiry_update on public.inquiries;
create trigger trg_check_inquiry_update before update on public.inquiries
  for each row execute function public.check_inquiry_update();

drop policy if exists "كتابة للمسجّلين - التقدم" on public.progress;
create policy "كتابة - التقدم" on public.progress for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));

drop policy if exists "كتابة للمسجّلين - الفلاتر" on public.filter_categories;
create policy "كتابة - الفلاتر" on public.filter_categories for all
  using (public.has_perm('manage_filters') or public.has_perm('import_excel'))
  with check (public.has_perm('manage_filters') or public.has_perm('import_excel'));

drop policy if exists "كتابة للمسجلين - الإشعارات" on public.notices;
create policy "كتابة - الإشعارات" on public.notices for all
  using (public.has_perm('manage_notices')) with check (public.has_perm('manage_notices'));

drop policy if exists "قراءة للمسجّلين - سجل النشاط" on public.audit_log;
create policy "قراءة - سجل النشاط" on public.audit_log for select
  using (public.has_perm('view_audit_log'));
drop policy if exists "إدخال للمسجّلين - سجل النشاط" on public.audit_log;
create policy "إدخال - سجل النشاط" on public.audit_log for insert
  with check (public.is_known_admin());

drop policy if exists "قراءة للمسجلين - النسخ الاحتياطية" on public.data_backups;
create policy "قراءة - النسخ الاحتياطية" on public.data_backups for select
  using (public.is_known_admin());
drop policy if exists "كتابة للمسجلين - النسخ الاحتياطية" on public.data_backups;
create policy "كتابة - النسخ الاحتياطية" on public.data_backups for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));

-- الملفات الشخصية: القراءة لأي أدمن معروف؛ التعديل لصاحب الحساب نفسه أو من
-- عنده edit_permissions؛ وتريغر يمنع أي حساب من ترقية صلاحياته/دوره بنفسه
-- حتى لو كان يعدّل صف حسابه هو — هذا يقفل ثغرة ترقية الصلاحيات الذاتية.
drop policy if exists "قراءة للمسجّلين - الملفات الشخصية" on public.profiles;
create policy "قراءة - الملفات الشخصية" on public.profiles for select
  using (public.is_known_admin());
drop policy if exists "تحديث للمسجّلين - الملفات الشخصية" on public.profiles;
create policy "تحديث - الملفات الشخصية" on public.profiles for update
  using (id = auth.uid() or public.has_perm('edit_permissions'))
  with check (id = auth.uid() or public.has_perm('edit_permissions'));

create or replace function public.check_profile_perm_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.perms is distinct from old.perms or new.role is distinct from old.role) then
    if not public.has_perm('edit_permissions') then
      raise exception 'لا توجد صلاحية لتعديل الصلاحيات أو الدور';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_check_profile_perm_change on public.profiles;
create trigger trg_check_profile_perm_change before update on public.profiles
  for each row execute function public.check_profile_perm_change();

-- سجل الزيارات: القراءة لمن عنده view_analytics؛ الإدخال يبقى عامًا (تتبع
-- زوّار مجهولين مقصود) لكن بشكل بيانات مقيّد يمنع الإغراق بقيم عشوائية ضخمة.
drop policy if exists "قراءة للمسجلين - سجل الزيارات" on public.logs;
create policy "قراءة - سجل الزيارات" on public.logs for select
  using (public.has_perm('view_analytics'));
drop policy if exists "Allow anonymous insert" on public.logs;
alter table public.logs drop constraint if exists logs_event_type_check;
alter table public.logs add constraint logs_event_type_check
  check (event_type in ('visit','tab','filter','inquiry_open','share','feedback','nav','click','doc_open'));
alter table public.logs drop constraint if exists logs_value_length_check;
alter table public.logs add constraint logs_value_length_check check (char_length(coalesce(value,'')) <= 200);
alter table public.logs drop constraint if exists logs_category_length_check;
alter table public.logs add constraint logs_category_length_check check (char_length(coalesce(category,'')) <= 200);
alter table public.logs drop constraint if exists logs_extra_length_check;
alter table public.logs add constraint logs_extra_length_check check (char_length(coalesce(extra,'')) <= 300);
alter table public.logs drop constraint if exists logs_session_length_check;
alter table public.logs add constraint logs_session_length_check check (char_length(coalesce(session_id,'')) <= 100);

alter table public.notice_votes drop constraint if exists notice_votes_device_id_length;
alter table public.notice_votes add constraint notice_votes_device_id_length check (char_length(coalesce(device_id,'')) <= 100);

-- ═══════════════════════════════════════════════════════════
-- ٨) عمليات استبدال/استرجاع كاملة للبيانات — دوال ذرّية (atomic)
-- بدل حذف-ثم-إضافة من جهة العميل. لو انقطع الاتصال أو فشل جزء
-- منتصف حذف-ثم-إضافة من المتصفح، تنتهي ببيانات فاضية أو مكرّرة.
-- هذي الدوال تنفّذ الحذف والإضافة بمعاملة واحدة داخل قاعدة
-- البيانات نفسها — إما تنجح كلها، أو ما يتغيّر شي إطلاقًا.
-- كل دالة تتحقق من صلاحية import_excel بنفسها كخط دفاع مستقل
-- عن أي تحقق بواجهة الموقع.
-- ═══════════════════════════════════════════════════════════
create or replace function public.replace_inquiries_full(p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('import_excel') then
    raise exception 'لا توجد صلاحية لاستبدال بيانات الاستفسارات';
  end if;
  delete from public.inquiries;
  if p_rows is not null and jsonb_array_length(p_rows) > 0 then
    insert into public.inquiries
      (id, model, loc, pri, cat, status, owner, month, note, note_en, reply, reply_en,
       closed, urgent, answered, meetings, updated_at, last_modified, important,
       created_at, urgent_until, important_until)
    select
      r.id, r.model, r.loc, r.pri, r.cat, r.status, r.owner, r.month, r.note, r.note_en, r.reply, r.reply_en,
      r.closed, coalesce(r.urgent, false), r.answered, r.meetings, coalesce(r.updated_at, now()), r.last_modified,
      coalesce(r.important, false), coalesce(r.created_at, now()), r.urgent_until, r.important_until
    from jsonb_populate_recordset(null::public.inquiries, p_rows) as r;
  end if;
end;
$$;

create or replace function public.replace_progress_full(p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('import_excel') then
    raise exception 'لا توجد صلاحية لاستبدال بيانات التقدم';
  end if;
  delete from public.progress;
  if p_rows is not null and jsonb_array_length(p_rows) > 0 then
    insert into public.progress select * from jsonb_populate_recordset(null::public.progress, p_rows);
  end if;
end;
$$;

create or replace function public.restore_inquiries_backup(p_backup_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  b record;
begin
  if not public.has_perm('import_excel') then
    raise exception 'لا توجد صلاحية لاسترجاع نسخة احتياطية';
  end if;
  select * into b from public.data_backups where id = p_backup_id;
  if not found then
    raise exception 'النسخة الاحتياطية غير موجودة';
  end if;
  delete from public.inquiries;
  if b.inquiries is not null and jsonb_array_length(b.inquiries) > 0 then
    insert into public.inquiries
      select * from jsonb_populate_recordset(null::public.inquiries, b.inquiries);
  end if;
  delete from public.progress;
  if b.progress is not null and jsonb_array_length(b.progress) > 0 then
    insert into public.progress
      select * from jsonb_populate_recordset(null::public.progress, b.progress);
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- ٩) تقدّم الوحدة والمراحل (KPIs) — رفع تلقائي من لوحة الإدارة بدل التعديل
-- اليدوي بالكود. كل شهر = صف واحد بجدول progress_matrix: نسبة كل مرحلة
-- (إجمالي/مرحلة١-٤) ونسبة كل بلوك، كـ jsonb. الهدف (target) ما يُخزَّن هنا
-- إطلاقًا — يُحسب دائمًا آليًا بالكود من التقويم (planTarget)، فما يحتاج رفعه.
-- آمنة لإعادة التشغيل بالكامل — شغّلها مرة وحدة من SQL Editor.
-- ═══════════════════════════════════════════════════════════
create table if not exists public.progress_matrix (
  month text primary key,                    -- 'YYYY-MM'
  phases jsonb not null default '{}'::jsonb, -- {"total":46.97,"p1":55.79,...}
  blocks jsonb not null default '{}'::jsonb, -- {"1":58.03,"2":56.13,...}
  updated_at timestamptz default now()
);
alter table public.progress_matrix enable row level security;

drop policy if exists "قراءة عامة - تقدم الوحدة" on public.progress_matrix;
create policy "قراءة عامة - تقدم الوحدة" on public.progress_matrix for select using (true);
drop policy if exists "كتابة - تقدم الوحدة" on public.progress_matrix;
create policy "كتابة - تقدم الوحدة" on public.progress_matrix for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));

-- نسخ احتياطية تلقائية قبل كل رفع (يُحتفظ بآخر ٥ نسخ من واجهة الإدارة نفسها)
create table if not exists public.progress_matrix_backups (
  id bigserial primary key,
  label text,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table public.progress_matrix_backups enable row level security;

drop policy if exists "قراءة - نسخ تقدم الوحدة" on public.progress_matrix_backups;
create policy "قراءة - نسخ تقدم الوحدة" on public.progress_matrix_backups for select
  using (public.is_known_admin());
drop policy if exists "كتابة - نسخ تقدم الوحدة" on public.progress_matrix_backups;
create policy "كتابة - نسخ تقدم الوحدة" on public.progress_matrix_backups for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));


-- ═══════════════════════════════════════════════════════════
-- سوّي هذا يدويًا من: Supabase Dashboard → Authentication → Users → Add user
-- (يوزر وباسورد تحددهم انت) — ثم شغّل السطر التالي (بدّل الـ UUID
-- باللي يطلع لك بجدول Users بعد إنشاء الحساب، وبدّل الاسم):
--
-- insert into public.profiles (id, name, role, perms) values
--   ('ضع-الـ-UUID-هنا', 'اسمك', 'owner',
--    array['sync_data','flag_urgent','manage_filters','view_analytics','export_data','view_audit_log','manage_users']);
