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
-- ٩) تقدّم التنفيذ — v2 (يحلّ محلّ progress_matrix القديم كليًا، انحذف).
-- مصدر حقيقة واحد: صف = بلوك واحد + شهر واحد + نسبة واحدة. الإجمالي
-- ومتوسط كل مرحلة ما يُخزَّنان إطلاقًا بعد الآن — يُحسبان دائمًا من
-- البلوكات عبر VIEW (progress_matrix_v)، فيستحيل يتناقضا مع بعض
-- (القديم كان يخزّنهم منفصلين، وفعليًا تناقضا في بيانات حقيقية — راجع
-- ملاحظة سبتمبر ٢٠٢٦ بقسم التغييرات). الهدف (target) نفس المنطق
-- السابق: يُحسب آليًا بالكود من التقويم (planTarget)، ما يُخزَّن هنا.
-- آمنة لإعادة التشغيل بالكامل — شغّلها مرة وحدة من SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- جدول مرجعي ثابت: كل بلوك ومرحلته وترتيب عرضه بالجداول والرسوم
create table if not exists public.progress_blocks (
  block_number int primary key,
  phase        text not null check (phase in ('p1','p2','p3','p4')),
  sort_order   int  not null unique
);
alter table public.progress_blocks enable row level security;
drop policy if exists "قراءة عامة - بلوكات التقدم" on public.progress_blocks;
create policy "قراءة عامة - بلوكات التقدم" on public.progress_blocks for select using (true);
drop policy if exists "كتابة - بلوكات التقدم" on public.progress_blocks;
create policy "كتابة - بلوكات التقدم" on public.progress_blocks for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));

-- القراءات: مصدر الحقيقة الوحيد لتقدّم التنفيذ
create table if not exists public.progress_readings (
  block_number int  not null references public.progress_blocks(block_number) on delete restrict,
  month        text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  pct          numeric(5,2) not null check (pct >= 0 and pct <= 100),
  updated_at   timestamptz not null default now(),
  updated_by   text,
  primary key (block_number, month)
);
create index if not exists progress_readings_month_idx on public.progress_readings (month);
alter table public.progress_readings enable row level security;
drop policy if exists "قراءة عامة - قراءات التقدم" on public.progress_readings;
create policy "قراءة عامة - قراءات التقدم" on public.progress_readings for select using (true);
drop policy if exists "كتابة - قراءات التقدم" on public.progress_readings;
create policy "كتابة - قراءات التقدم" on public.progress_readings for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));

-- نسخ احتياطية تلقائية قبل كل رفع (يُحتفظ بآخر ٥ نسخ من واجهة الإدارة نفسها)
create table if not exists public.progress_readings_backups (
  id bigserial primary key,
  label text,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table public.progress_readings_backups enable row level security;
drop policy if exists "قراءة - نسخ قراءات التقدم" on public.progress_readings_backups;
create policy "قراءة - نسخ قراءات التقدم" on public.progress_readings_backups for select
  using (public.is_known_admin());
drop policy if exists "كتابة - نسخ قراءات التقدم" on public.progress_readings_backups;
create policy "كتابة - نسخ قراءات التقدم" on public.progress_readings_backups for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));

-- نسبة مرحلة كما يقرّرها المطوّر مباشرة — أحيانًا تشمل بنودًا مثل "الخدمات
-- الأرضية" ما هي مرصودة كبلوك مستقل، فمو دايمًا مطابقة لمتوسط البلوكات
-- المرصودة. لو موجودة لشهر/مرحلة، تُستخدم بدل المتوسط المحسوب من البلوكات؛
-- لو غير موجودة، يبقى المتوسط المحسوب كما هو. راجع README لصيغة سطر المرحلة.
create table if not exists public.progress_phase_overrides (
  phase      text not null check (phase in ('p1','p2','p3','p4')),
  month      text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  pct        numeric(5,2) not null check (pct >= 0 and pct <= 100),
  updated_at timestamptz not null default now(),
  primary key (phase, month)
);
alter table public.progress_phase_overrides enable row level security;
drop policy if exists "قراءة عامة - نسب المراحل المعتمدة" on public.progress_phase_overrides;
create policy "قراءة عامة - نسب المراحل المعتمدة" on public.progress_phase_overrides for select using (true);
drop policy if exists "كتابة - نسب المراحل المعتمدة" on public.progress_phase_overrides;
create policy "كتابة - نسب المراحل المعتمدة" on public.progress_phase_overrides for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));

-- القيمة الفعلية لكل (شهر، مرحلة): رقم المطوّر المباشر لو موجود، وإلا متوسط
-- بلوكات تلك المرحلة.
create or replace view public.progress_phase_values as
select
  coalesce(bpa.month, ov.month) as month,
  coalesce(bpa.phase, ov.phase) as phase,
  coalesce(ov.pct, bpa.avg_pct) as pct,
  (ov.pct is not null) as overridden,
  bpa.avg_pct as block_avg_pct
from (
  select r.month, b.phase, avg(r.pct) as avg_pct
  from public.progress_readings r
  join public.progress_blocks b on b.block_number = r.block_number
  group by r.month, b.phase
) bpa
full outer join public.progress_phase_overrides ov
  on ov.month = bpa.month and ov.phase = bpa.phase;

-- عرض متوافق شكليًا مع progress_matrix القديم (نفس الأعمدة: month/phases/blocks/
-- updated_at) لكن phases محسوبة آليًا من progress_phase_values (تراعي أي رقم
-- مباشر من المطوّر)، والإجمالي = متوسط قيم المراحل الأربع الفعلية (مو متوسط كل
-- البلوكات مباشرة) — الواجهة تقرأ منه مباشرة، ما يحتاج أي تعديل على كود الرسوم.
create or replace view public.progress_matrix_v as
select
  pv.month,
  jsonb_strip_nulls(jsonb_build_object(
    'total', round(avg(pv.pct)::numeric, 2),
    'p1',    round(max(pv.pct) filter (where pv.phase = 'p1')::numeric, 2),
    'p2',    round(max(pv.pct) filter (where pv.phase = 'p2')::numeric, 2),
    'p3',    round(max(pv.pct) filter (where pv.phase = 'p3')::numeric, 2),
    'p4',    round(max(pv.pct) filter (where pv.phase = 'p4')::numeric, 2)
  )) as phases,
  (select jsonb_object_agg(r.block_number::text, r.pct) from public.progress_readings r where r.month = pv.month) as blocks,
  greatest(
    (select max(updated_at) from public.progress_readings r2 where r2.month = pv.month),
    (select max(updated_at) from public.progress_phase_overrides o2 where o2.month = pv.month)
  ) as updated_at
from public.progress_phase_values pv
group by pv.month
order by pv.month;

-- شهر بلا قراءة من المطوّر — حالة تتكرر فعليًا. بدل ما تبقى غيابًا صامتًا (فما تقدر
-- تفرّق "المطوّر ما زوّد قراءة" عن "نسيت أرفع الملف")، تُسجَّل صراحة بسطر بالملف،
-- ويعرضها الموقع للزائر بنص واضح بدل تخمين صامت. راجع README لصيغة سطر "لا قراءة".
create table if not exists public.progress_month_notes (
  month      text primary key check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.progress_month_notes enable row level security;
drop policy if exists "قراءة عامة - ملاحظات أشهر التقدم" on public.progress_month_notes;
create policy "قراءة عامة - ملاحظات أشهر التقدم" on public.progress_month_notes for select using (true);
drop policy if exists "كتابة - ملاحظات أشهر التقدم" on public.progress_month_notes;
create policy "كتابة - ملاحظات أشهر التقدم" on public.progress_month_notes for all
  using (public.has_perm('import_excel')) with check (public.has_perm('import_excel'));

-- تعبئة أولية للجدول المرجعي (البلوكات الـ١٦ المعروفة حاليًا بالمشروع) —
-- آمنة للتكرار؛ بلوك جديد يُضاف مستقبلًا من لوحة الإدارة نفسها عند الحاجة.
insert into public.progress_blocks (block_number, phase, sort_order) values
  (1,'p1',1),(2,'p1',2),(3,'p1',3),(5,'p1',4),(4,'p1',5),
  (7,'p2',6),(6,'p2',7),(8,'p2',8),
  (9,'p3',9),(10,'p3',10),(14,'p3',11),(13,'p3',12),
  (22,'p4',13),(12,'p3',14),(15,'p3',15),(23,'p4',16)
on conflict (block_number) do nothing;

-- تسجيل الفجوة التاريخية المعروفة (يوليو ٢٠٢٦ — سحب المطوّر تقريره) بدل فجوة صامتة
insert into public.progress_month_notes (month, note) values
  ('2026-07', 'المطوّر لم يُصدر تقرير تقدّم لهذا الشهر — تم سحبه')
on conflict (month) do nothing;


-- ═══════════════════════════════════════════════════════════
-- سوّي هذا يدويًا من: Supabase Dashboard → Authentication → Users → Add user
-- (يوزر وباسورد تحددهم انت) — ثم شغّل السطر التالي (بدّل الـ UUID
-- باللي يطلع لك بجدول Users بعد إنشاء الحساب، وبدّل الاسم):
--
-- insert into public.profiles (id, name, role, perms) values
--   ('ضع-الـ-UUID-هنا', 'اسمك', 'owner',
--    array['sync_data','flag_urgent','manage_filters','view_analytics','export_data','view_audit_log','manage_users']);

-- ══════════════════════════════════════════════════════════
-- v2.0.0 — مفتاح التصميم (الكلاسيكي / نوفا)
-- يُقرأ من الموقع العام لحظيًا عبر Realtime، ويُكتب من لوحة الإدارة.
-- ══════════════════════════════════════════════════════════
alter table public.site_settings
  add column if not exists active_design text not null default 'classic';

alter table public.site_settings
  drop constraint if exists site_settings_active_design_chk;

alter table public.site_settings
  add constraint site_settings_active_design_chk
  check (active_design in ('classic','nova'));

-- ══════════════════════════════════════════════════════════
-- v2.2.0 — تحصين أمني + تتبّع مصدر الإدخال
-- كل ما تحت مطبَّق فعلاً على المشروع. النص هنا للتوثيق ولإعادة البناء
-- على أي نسخة ثانية من قاعدة البيانات.
-- ══════════════════════════════════════════════════════════

-- (١) سدّ تصعيد الصلاحيات: سياسة تحديث الملف الشخصي كانت تسمح للمستخدم
--     يعدّل صف نفسه بالكامل — ومنه عمود perms. يعني يمنح نفسه أي صلاحية.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.perms is distinct from old.perms or new.role is distinct from old.role)
     and not public.has_perm('edit_permissions') then
    raise exception 'تعديل الصلاحيات أو الدور يحتاج صلاحية إدارة المستخدمين';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile_privileges on public.profiles;
create trigger trg_guard_profile_privileges before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- (٢) صلاحيات تنفيذ الدوال.
--     ⚠ الفخ: revoke ... from anon وحده ما ينفع، لأن EXECUTE ممنوح ضمنيًا
--     لـ PUBLIC. لازم السحب من PUBLIC ثم المنح صراحة لمن يحتاج.
revoke execute on function public.guard_profile_privileges() from public, anon, authenticated;
revoke execute on function public.stamp_inquiry_author() from public, anon, authenticated;
revoke execute on function public.log_inquiry_revision() from public, anon, authenticated;
revoke execute on function public.current_perms() from public, anon;
revoke execute on function public.has_perm(text) from public, anon;
revoke execute on function public.is_known_admin() from public, anon;
revoke execute on function public.replace_inquiries_full(jsonb) from public, anon;
revoke execute on function public.replace_progress_full(jsonb) from public, anon;
revoke execute on function public.restore_inquiries_backup(bigint) from public, anon;
grant execute on function public.current_perms() to authenticated;
grant execute on function public.has_perm(text) to authenticated;
grant execute on function public.is_known_admin() to authenticated;
grant execute on function public.replace_inquiries_full(jsonb) to authenticated;
grant execute on function public.replace_progress_full(jsonb) to authenticated;
grant execute on function public.restore_inquiries_backup(bigint) to authenticated;

-- (٣) أصوات الإشعارات: كانت مقروءة للجميع. صارت للإدارة، والزائر يقرأ
--     أصوات جهازه هو فقط عبر دالة مخصّصة.
drop policy if exists "قراءة عامة - الأصوات" on public.notice_votes;
create policy "قراءة - الأصوات (إدارة)" on public.notice_votes
  for select using (public.is_known_admin());
create or replace function public.my_notice_votes(p_device text)
returns setof bigint language sql stable security definer set search_path = public as $$
  select notice_id from public.notice_votes where device_id = p_device;
$$;
revoke execute on function public.my_notice_votes(text) from public;
grant execute on function public.my_notice_votes(text) to anon, authenticated;

-- (٤) كبح العبث بسجل الزيارات المفتوح للزوار
alter table public.logs drop constraint if exists logs_sane_payload_chk;
alter table public.logs add constraint logs_sane_payload_chk check (
  coalesce(length(event_type),0) <= 40 and coalesce(length(category),0) <= 80
  and coalesce(length(value),0) <= 200 and coalesce(length(extra),0) <= 500
  and coalesce(length(session_id),0) <= 80);

-- (٥) تتبّع مصدر الإدخال والتعديل + سجل تعديلات حقلًا بحقل
alter table public.inquiries add column if not exists created_by text;
alter table public.inquiries add column if not exists updated_by text;

create table if not exists public.inquiry_revisions (
  id bigserial primary key,
  inquiry_id integer not null,
  op text not null,
  changed_by text,
  changed_at timestamptz not null default now(),
  changes jsonb not null default '{}'::jsonb);
create index if not exists inquiry_revisions_inq_idx on public.inquiry_revisions (inquiry_id, changed_at desc);
alter table public.inquiry_revisions enable row level security;
drop policy if exists "قراءة - سجل تعديلات الاستفسارات" on public.inquiry_revisions;
create policy "قراءة - سجل تعديلات الاستفسارات" on public.inquiry_revisions
  for select using (public.is_known_admin());

-- (٦) هذي الأعمدة داخلية: يُمنع الزائر منها على مستوى العمود نفسه، مو على
--     ثقة الواجهة. لو رجع أي كود مستقبلًا لـ select('*') كزائر، بيفشل بدل ما يسرّب.
revoke select on public.inquiries from anon;
grant select (id, model, loc, pri, cat, status, owner, month, note, note_en, reply, reply_en,
              closed, urgent, answered, meetings, updated_at, last_modified, important,
              created_at, urgent_until, important_until)
  on public.inquiries to anon;

-- ملاحظة تبقى بيدك: «حماية كلمات المرور المسرّبة» معطّلة بإعدادات المصادقة.
-- تُفعَّل من Authentication ← Policies بلوحة Supabase (ما تنضبط بـ SQL).
