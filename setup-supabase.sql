-- ═══════════════════════════════════════════════════════════
-- إعداد قاعدة بيانات لوحة إدارة ألبورادا
-- شغّل هذا الملف مرة وحدة من: Supabase Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

-- ١) الاستفسارات
create table if not exists public.inquiries (
  id serial primary key,
  model text, loc text, pri text, status text, owner text, month text,
  note text, note_en text, reply text, closed text default 'لا',
  urgent boolean default false,
  updated_at timestamptz default now()
);

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
  ('status', 'الحالة', true, array['معتمدة','قيد الدراسة','تم التصويت']),
  ('closed', 'مقفل / مفتوح', true, array['نعم','لا'])
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════
-- ملاحظة مهمة: إنشاء أول حساب أدمن
-- ═══════════════════════════════════════════════════════════
-- سوّي هذا يدويًا من: Supabase Dashboard → Authentication → Users → Add user
-- (يوزر وباسورد تحددهم انت) — ثم شغّل السطر التالي (بدّل الـ UUID
-- باللي يطلع لك بجدول Users بعد إنشاء الحساب، وبدّل الاسم):
--
-- insert into public.profiles (id, name, role, perms) values
--   ('ضع-الـ-UUID-هنا', 'اسمك', 'owner',
--    array['sync_data','flag_urgent','manage_filters','view_analytics','export_data','view_audit_log','manage_users']);
