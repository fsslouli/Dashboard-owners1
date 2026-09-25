/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-core */
import { supabase } from "./app-bootstrap.jsx";
import { AR_DIGITS, THEMES, norm } from "./site-data.jsx";
import { useEffect, useState } from "react";
import { BarChart3, Clapperboard, Download, Eye, FileSpreadsheet, FileText, Filter, History, Layers, Lock, LogIn, MousePointerClick, Pencil, PlusCircle, Share2, ShieldCheck, Sparkles, Star, ThumbsUp, Trash2, UserPlus } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   ١٥. لوحة الإدارة الحقيقية — متصلة بـ Supabase فعليًا (Auth + قراءة/كتابة).
   تعمل بعد تشغيل setup-supabase.sql وإنشاء أول حساب أدمن (راجع الملف).
   مرتبطة بنفس عميل supabase المُعرَّف بالأعلى بالسطر ٢٦.
   ═══════════════════════════════════════════════════════════ */

/* ── يتبع وضع الجهاز (فاتح/داكن) تلقائيًا بدون أي زر تبديل ── */
export let CURRENT_ADMIN_THEME = THEMES.light;
export function useSystemTheme() {
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const h = (e) => setDark(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  const T = dark ? THEMES.dark : THEMES.light;
  CURRENT_ADMIN_THEME = T;
  return T;
}

export const ADMIN_PERMISSIONS = [
  { key: "view_dashboard", label: "عرض لوحة القرار (التحليلات الداخلية الشاملة)", icon: BarChart3 },
  { key: "view_analytics", label: "عرض تبويب الزيارات والتحليلات", icon: Eye },
  { key: "export_data", label: "تصدير التقارير كإكسل", icon: Download },
  { key: "import_excel", label: "رفع ومزامنة بيانات من إكسل", icon: FileSpreadsheet },
  { key: "add_inquiry", label: "إضافة استفسار جديد يدويًا", icon: PlusCircle },
  { key: "edit_inquiry", label: "تعديل استفسار موجود", icon: Pencil },
  { key: "delete_inquiry", label: "حذف استفسار", icon: Trash2 },
  { key: "flag_urgent", label: "تعديل وسم \"عاجل\"", icon: Star },
  { key: "manage_filters", label: "إدارة الفلاتر المخصصة بالموقع العام", icon: Filter },
  { key: "manage_notices", label: "نشر إشعارات وتنبيهات على الموقع العام", icon: Sparkles },
  { key: "manage_media", label: "إدارة مقاطع النماذج (يوتيوب)", icon: Clapperboard },
  { key: "view_audit_log", label: "عرض سجل نشاط الإدارة", icon: History },
  { key: "edit_permissions", label: "تعديل صلاحيات أعضاء موجودين", icon: ShieldCheck },
  { key: "create_users", label: "إنشاء حسابات دخول جديدة", icon: UserPlus },
];
export const INQ_FIELDS_ADMIN = ["model", "loc", "pri", "cat", "status", "owner", "month", "note", "note_en", "reply", "closed", "answered"];
export const ADMIN_FIELD_LABEL = { model: "النموذج", loc: "الموقع", pri: "الأولوية", cat: "الفئة (تصنيف نوع البند)", status: "الحالة", owner: "المهندس", month: "الشهر", note: "الملاحظة", note_en: "Note (EN)", reply: "الرد", closed: "مغلقة (نعم/لا)", answered: "حالة الرد (تم الرد؟)" };
export const ADMIN_BLANK_INQ = { model: "", loc: "", pri: "متوسطة", cat: "", status: "قيد الدراسة", owner: "", month: "", note: "", note_en: "", reply: "", closed: "لا", answered: "لا" };
/* answered عمود boolean حقيقي بقاعدة البيانات (بخلاف closed اللي نص) — نحوّلها بالحدين:
   نص "نعم/لا" أثناء العرض والمقارنة بالإدارة (اتساقًا مع closed)، وBoolean فعلي عند الكتابة الفعلية لقاعدة البيانات */
export const REAL_BOOL_FIELDS = ["answered"];
export const toYesNo = (v) => (v === true ? "نعم" : v === false ? "لا" : v);
export const toDbBool = (v) => (v === "نعم" ? true : v === "لا" ? false : typeof v === "boolean" ? v : !!v);
/* ── مقارنة القيم بين الملف المرفوع والسجل الحالي ──
   المقارنة النصية الحرفية كانت تُبلّغ عن "تعديل" على صفوف ما تغيّرت فعليًا:
   مسافة زائدة، همزة مختلفة، تشكيل، أرقام عربية-هندية، أو تاريخ منسّق بدل YYYY-MM.
   هذي الدوال توحّد الطرفين قبل المقارنة، فما يُعرض إلا التغيير الحقيقي. */
export const isBlankCell = (v) => v == null || String(v).trim() === "";
export const toMonthKey = (v) => {
  if (isBlankCell(v)) return "";
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`;
  const t = String(v).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).trim();
  let m = t.match(/^(\d{4})[-/](\d{1,2})/);                 // 2026-09 / 2026/9
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);     // 9/2/26 — يوم/شهر/سنة بصيغة الملف
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return `${y}-${String(+m[2]).padStart(2, "0")}`; }
  const d = new Date(t);
  return isNaN(d) ? t : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const cmpVal = (field, v) => {
  if (isBlankCell(v)) return "";
  if (field === "month") return toMonthKey(v);
  if (field === "closed" || field === "answered") {
    const t = norm(toYesNo(v));
    return ["نعم", "مقفل", "مغلق", "تم الرد", "true", "1"].some((k) => norm(k) === t) ? "نعم"
      : ["لا", "مفتوح", "بانتظار الرد", "false", "0"].some((k) => norm(k) === t) ? "لا" : t;
  }
  return norm(String(v).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))));
};
export const ADMIN_TARGETS = [
  { key: "inquiries", label: "الاستفسارات", fields: INQ_FIELDS_ADMIN, keyField: "id" },
  { key: "progress", label: "تقدّم التنفيذ", fields: ["planned", "actual"], keyField: "month" },
  { key: "ignore", label: "تجاهل هذا الشيت", fields: [], keyField: null },
];
export const ADMIN_EVENT_TYPES = [
  { key: "visit", label: "زيارات", icon: Eye },
  { key: "tab", label: "تنقّل بين التبويبات", icon: Layers },
  { key: "filter", label: "استخدام الفلاتر", icon: Filter },
  { key: "inquiry_open", label: "فتح استفسار", icon: FileText },
  { key: "share", label: "مشاركة", icon: Share2 },
  { key: "feedback", label: "إعجاب / عدم إعجاب", icon: ThumbsUp },
  { key: "doc_open", label: "فتح مستند/مخطط", icon: FileText },
  { key: "click", label: "نقرات عامة", icon: MousePointerClick },
];

export function fmtAdminDate(v) { const d = typeof v === "string" ? new Date(v) : v; return d.toLocaleString("ar-SA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
export function isoAdminDate(d) { return d.toISOString().slice(0, 10); }

/* جلسة الدخول الحقيقية */
export function useSupaAuth() {
  const [session, setSession] = useState(undefined); // undefined=يتحقق، null=غير مسجّل
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

export function AdminLogin() {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const T = useSystemTheme();
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setBusy(false);
    if (error) setErr("بيانات الدخول غير صحيحة، أو الحساب غير مفعّل بعد.");
  };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif" }} dir="rtl">
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 360, background: T.surface, borderRadius: 20, border: `1px solid ${T.line}`, padding: "36px 28px", boxShadow: T.shadowUp }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: T.brass + "16", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}><ShieldCheck size={24} color={T.brass} /></div>
        <h1 style={{ textAlign: "center", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>دخول لوحة الإدارة</h1>
        <p style={{ textAlign: "center", fontSize: 12.5, color: T.muted, margin: "0 0 26px" }}>مخصص لفريق تمثيل الملاك فقط</p>
        <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>البريد الإلكتروني</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@example.com" style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 11, border: `1px solid ${T.line}`, marginBottom: 14, fontSize: 14, outline: "none", background: T.sunken }} />
        <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>كلمة المرور</label>
        <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="••••••••" style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 11, border: `1px solid ${T.line}`, marginBottom: 6, fontSize: 14, outline: "none", background: T.sunken }} />
        {err && <div style={{ fontSize: 12, color: "#C0392B", marginBottom: 10 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 12, border: "none", background: T.brass, color: "#fff", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: busy ? "wait" : "pointer", opacity: busy ? .7 : 1 }}><LogIn size={16} /> {busy ? "جارٍ الدخول..." : "دخول"}</button>
        <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "center", marginTop: 18, fontSize: 11, color: T.faint }}><Lock size={11} /> الحسابات تُنشأ من لوحة Supabase فقط</div>
      </form>
    </div>
  );
}
