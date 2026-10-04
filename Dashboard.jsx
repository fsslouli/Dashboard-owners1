/* ═══════════════════════════════════════════════════════════
   فهرس ملفات المشروع — كل قسم صار ملف مستقل بنفس المجلد.
   عند طلب تحديث مستقبلي: اذكر اسم القسم/الملف مباشرة (مثلاً
   "عدّل admin-sync-tab.jsx") بدل رفع أو طلب الملف الكامل — يوفّر
   توكنز كثيرة لأن كل ملف يتعامل معه لوحده بدون البقية.

   app-bootstrap.jsx        تتبع الزيارات + عميل Supabase
   site-data.jsx            بيانات ثابتة، ترجمة، ثيمات، سياقات، بيانات KPI
   site-hooks.jsx           خطافات عامة (تفضيلات، ظهور بالشاشة، إغلاق بالرجوع)
   ui-atoms.jsx              عناصر واجهة صغيرة قابلة لإعادة الاستخدام
   attach-kit.jsx           المرفقات: قارئ الروابط، رفع الملفات، عارض PDF/فيديو، لوحة المرفقات
   gallery-kit.jsx          معرض الموقع (صور، مقاطع، PDF) — العام ولوحة الإدارة
   changelog-legal-data.jsx سجل الإصدارات + الإقرار القانوني
   public-sheets.jsx        لوحات التفاصيل المنبثقة (فلاتر، فيديو، مستندات..)
   progress-tab.jsx         تبويب تقدّم التنفيذ (عرض عام)
   public-site.jsx          الموقع العام الكامل (PublicSite)
   admin-core.jsx           أساسيات لوحة الإدارة (تسجيل الدخول، صلاحيات)
   admin-excel-utils.jsx    أدوات قراءة/تطبيع ملفات الإكسل
   admin-sync-tab.jsx       مزامنة تقدّم التنفيذ من الإكسل
   admin-trail-sync.jsx     سجل التغييرات + مزامنة الاستفسارات
   admin-tabs-1.jsx         تبويبات: التحليلات، الفلاتر، سجل التدقيق، المستخدمون، التنبيهات
   admin-media-tab.jsx      تبويب الوسائط (يوتيوب)
   admin-tabs-2.jsx         تبويبات: لوحة البيانات، الثيمات
   admin-audit-tab.jsx      مدقّق ملف الاستفسارات
   admin-home.jsx           الصفحة الرئيسية للوحة الإدارة (تجميع التبويبات)
   Dashboard.jsx (هذا الملف) نقطة الدخول النهائية فقط
   ═══════════════════════════════════════════════════════════ */
import { AdminApp } from "./admin-home.jsx";
import { PublicSite } from "./public-site.jsx";
import { hideBoot } from "./site-data.jsx";
import { SHARE_HOST, onShareHost, shareTokenFromHash } from "./share-kit.jsx";
import { ShareApp } from "./share-viewer.jsx";
import { useEffect, useLayoutEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════
   ١٦. نقطة الدخول النهائية — يوجّه بين الموقع العام ولوحة الإدارة
   حسب الرابط: أضف #admin بآخر رابط الموقع لفتح لوحة الإدارة، مثال:
   https://your-site.vercel.app/#admin
   ═══════════════════════════════════════════════════════════ */
/* المسار: دومين المشاركة المنفصل يعرض صفحة المشاركة فقط (لا موقع عام ولا إدارة أبدًا).
   رابط مشاركة وصل للدومين الرئيسي يُحوَّل لدومين المشاركة إن كان مضبوطًا. */
function readRoute() {
  if (onShareHost()) return "share";
  if (shareTokenFromHash()) return SHARE_HOST ? "redirect" : "share";
  return window.location.hash === "#admin" ? "admin" : "site";
}
function App() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (route === "redirect") window.location.replace(`https://${SHARE_HOST}/${window.location.hash}`);
  }, [route]);
  /* لوحة الإدارة طقمها ثابت وما تنتظر إعدادات الموقع — نرفع شاشة الإقلاع فورًا */
  useLayoutEffect(() => { if (route === "admin") hideBoot(true); }, [route]);
  if (route === "redirect") return null;
  if (route === "share") return <ShareApp />;
  return route === "admin" ? <AdminApp /> : <PublicSite />;
}

export default App;
