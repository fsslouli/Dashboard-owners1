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
   admin-brief.js           الملخّص التنفيذي (منطق خالص)
   admin-meeting-sheet.js   ورقة إكسل للاجتماع القادم (كاتب xlsx صغير بلا مكتبات)
   admin-telegram.jsx       نشر تحديث في قروب الملاك على تليجرام (يحتاج إعداد البوت)
   Dashboard.jsx (هذا الملف) نقطة الدخول النهائية فقط — ولوحة الإدارة تُحمَّل منه عند الطلب
   ═══════════════════════════════════════════════════════════ */
import { PublicSite } from "./public-site.jsx";
import { hideBoot } from "./site-data.jsx";
import { SHARE_HOST, onShareHost, shareTokenFromHash } from "./share-kit.jsx";
import { ShareApp } from "./share-viewer.jsx";
import { Component, Suspense, lazy, useEffect, useLayoutEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════
   ٥.٣.٠ — لوحة الإدارة حزمة منفصلة تُحمَّل فقط عند فتح #admin.
   قبلها كانت اللوحة كاملة (ومعها مكتبة قراءة الإكسل) داخل ملف الموقع
   الوحيد، فكل زائر للموقع العام ينزّلها وهو ما يحتاجها.
   ═══════════════════════════════════════════════════════════ */
const ADMIN_RETRY_KEY = "admin-chunk-retry";
const AdminApp = lazy(() =>
  import("./admin-home.jsx").then(
    (m) => {
      try { sessionStorage.removeItem(ADMIN_RETRY_KEY); } catch (e) { /* تخزين ممنوع — عادي */ }
      return { default: m.AdminApp };
    },
    (err) => {
      /* بعد نشر إصدار جديد، صفحة مفتوحة من قبل تطلب ملفات الإصدار السابق اللي ما عادت موجودة —
         إعادة تحميل وحدة تجيب الجديد. مرة وحدة فقط بالجلسة، فما تصير حلقة لو الشبكة نفسها مقطوعة. */
      try {
        if (!sessionStorage.getItem(ADMIN_RETRY_KEY)) {
          sessionStorage.setItem(ADMIN_RETRY_KEY, "1");
          window.location.reload();
          return new Promise(() => {});
        }
      } catch (e) { /* تخزين ممنوع — نعرض رسالة الخطأ تحت */ }
      throw err;
    }
  )
);

const adminScreen = {
  minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
  background: "var(--boot-bg, #141C22)", color: "var(--boot-fg, #8FA0AB)", fontFamily: "system-ui, sans-serif", fontSize: 13, padding: 20,
};
/* يظهر فقط لو فتحت #admin من صفحة الموقع نفسها (شاشة الإقلاع راحت) والحزمة لسا تتحمّل */
const AdminLoading = () => <div dir="rtl" style={adminScreen}>جارٍ تحميل لوحة الإدارة…</div>;
/* اللوحة جهزت فعلًا — الحين نرفع شاشة الإقلاع، مو قبل (عشان ما يشوف الزائر صفحة فاضية) */
function AdminReady({ children }) {
  useLayoutEffect(() => { hideBoot(true); }, []);
  return children;
}
function AdminFailed() {
  useLayoutEffect(() => { hideBoot(true); }, []);
  return (
    <div dir="rtl" style={adminScreen}>
      <div>تعذّر تحميل لوحة الإدارة — تأكد من الاتصال ثم أعد المحاولة.</div>
      <button onClick={() => window.location.reload()}
        style={{ border: "1px solid currentColor", background: "none", color: "inherit", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
        إعادة المحاولة
      </button>
    </div>
  );
}
class AdminBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <AdminFailed /> : this.props.children; }
}

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
  if (route === "redirect") return null;
  if (route === "share") return <ShareApp />;
  /* لوحة الإدارة طقمها ثابت وما تنتظر إعدادات الموقع — شاشة الإقلاع تنرفع أول ما تجهز الحزمة (AdminReady) */
  if (route === "admin") {
    return (
      <AdminBoundary>
        <Suspense fallback={<AdminLoading />}>
          <AdminReady><AdminApp /></AdminReady>
        </Suspense>
      </AdminBoundary>
    );
  }
  return <PublicSite />;
}

export default App;
