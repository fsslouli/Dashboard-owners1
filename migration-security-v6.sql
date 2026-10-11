-- migration-security-v6.sql  — تقوية الأمان (لا يُطبَّق تلقائيًا؛ راجعه ثم شغّله يدويًا)
-- القسم 1 و2 آمنان ولا يكسران شيئًا. القسم 3 يُشغَّل فقط بعد ما يفعّل كل المشرفين التحقق بخطوتين.

-- 1) الـ views تعمل بصلاحيات المستعلِم (تحترم RLS) بدل صلاحيات المالك
alter view if exists public.progress_matrix_v set (security_invoker = true);
alter view if exists public.progress_phase_values set (security_invoker = true);

-- 2) منع استدعاء دوال الـ triggers مباشرة عبر API (تبقى تعمل كـ trigger)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- 3) (مؤجَّل) فرض aal2 على الكتابة الإدارية: يضاف شرط لـ has_perm.
-- لا تطبّقه قبل أن يسجّل كل مشرف عامل TOTP، وإلا ينقفل عنهم التعديل.
-- مثال التعديل داخل has_perm(perm) — أضف للشرط:
--   and coalesce((auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
-- (اطلب مني أجهّز الصيغة الكاملة بعد قراءة تعريف الدالة الحالي وقت التطبيق.)
