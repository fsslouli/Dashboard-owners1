import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, createContext, useContext } from "react";
import INQUIRIES_DATA from "./inquiries.json";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

/* ═══════════════════════════════════════════════════════════
   فهرس الملف — لتسهيل القراءة والتعديل المستقبلي.
   ابحث عن العنوان بين ═══ للقفز مباشرة للقسم.

   ١. التتبع الصامت (Supabase)                    — السطر التالي
   ٢. البيانات الثابتة (نماذج، مواقع، سجل الملاحظات RAW)
   ٣. الترجمة (عربي/إنجليزي) لكل المفردات الثابتة
   ٤. نظام الألوان (فاتح/داكن) والسياقات (Theme/Lang)
   ٥. أدوات نص عربي، تحليل النماذج، ومناطق المخطط
   ٦. تقدّم التنفيذ — بيانات KPI والخطة الخطّية
   ٧. الترتيب المنطقي والتخزين المشترك (window.storage)
   ٨. الخطافات المخصّصة (Hooks): ثيم، لغة، عرض، سطح مكتب...
   ٩. عناصر صغيرة قابلة لإعادة الاستخدام (عدّادات، رقاقات، أيقونات)
   ١٠. سجل الإصدارات (CHANGELOG)
   ١١. الإقرار القانوني ولوحة سجل التحديثات
   ١٢. لوحة تفاصيل الاستفسار (Sheet)
   ١٣. تبويب تقدّم التنفيذ (ProgressTab)
   ١٤. المكوّن الرئيسي (Dashboard) — التجميع والعرض النهائي
   ═══════════════════════════════════════════════════════════ */

/* ── ١. تتبع صامت للزيارات وسلوك الملاك (Supabase) ── */
const SUPABASE_URL = "https://codnqkeycfhznzbqlpds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_L1yElSU0fd6a6BNQS6Qgsw_0Ale7aNu";
const TELEGRAM_URL = "https://t.me/+thhB4M36VkFkYjZk";
/* عميل Supabase الحقيقي — يُستخدم بلوحة الإدارة (تسجيل الدخول + قراءة/كتابة البيانات).
   نفس الرابط والمفتاح العام أعلاه، آمنين للنشر بالمتصفح طالما RLS مفعّلة (راجع setup-supabase.sql) */
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
/* رقم جلسة عشوائي مؤقت يتولّد مرة وحدة لكل تحميل صفحة — بدون أي معنى شخصي،
   هدفه فقط تجميع أحداث نفس الزيارة ببعض لتقدير الوقت المقضي (تحليل كلي وليس فردي) */
const SESSION_ID =
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
function logEvent(event_type, category, value, extra) {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/logs`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type,
        category: category != null ? String(category) : null,
        value: value != null ? String(value) : null,
        extra: extra != null ? String(extra) : null,
        session_id: SESSION_ID,
      }),
    }).catch(() => {});
  } catch (e) {}
}
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  Search, X, ChevronDown, CheckCircle2, XCircle, Clock, Users, Layers, ShieldAlert,
  RotateCcw, User, Calendar, Hash, Ruler, Droplet, ArrowLeft, Home,
  RefreshCw, Copy, Check, Sparkles, Sun, Moon, Monitor, History,
  LayoutGrid, Table, Laptop, Smartphone, Share2, ThumbsUp, ThumbsDown,
  ChevronLeft, ChevronRight, ArrowUp, SlidersHorizontal, FileText, ExternalLink, AlertTriangle,
} from "lucide-react";
/* أيقونات إضافية للوحة الإدارة فقط */
import {
  LogIn, LogOut, Upload, Download, Star, ShieldCheck, FileSpreadsheet,
  PlusCircle, Pencil, MinusCircle, Lock, BarChart3, Eye, Filter,
  MousePointerClick, Tag, Trash2, UserPlus, ListPlus, TrendingUp,
} from "lucide-react";

/* أيقونة تليجرام الرسمية (غير متوفرة في lucide-react) */
const TelegramIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="120" r="120" fill="#27A7E7" />
    <path d="M54 118.5l125-48.2c5.8-2.2 10.9 1.4 9 10l-21.3 100.4c-1.6 7.4-6 9.2-12.1 5.7l-33.5-24.7-16.2 15.6c-1.8 1.8-3.3 3.3-6.7 3.3l2.4-34.2 62.3-56.3c2.7-2.4-.6-3.7-4.2-1.3l-77 48.5-33.2-10.4c-7.2-2.3-7.4-7.2 1.5-10.4z" fill="#fff" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════
   نسخة أساسية مدمجة — تعمل فورًا بدون رفع أي ملف.
   يستبدلها التحديث المنشور عند وجوده.
   ═══════════════════════════════════════════════════════════ */
/* ── ٢. البيانات الثابتة: قوائم مرجعية، ثم سجل الملاحظات RAW ── */
const PRI_ORDER = ["عالية جدًا", "عالية", "متوسطة", "عادية"];
const STA_ORDER = ["معتمدة", "تم الرفض", "قيد الدراسة", "تم التصويت"];
/* ── فئة البند (عمود «تصنيف نوع البند» بملف الإكسل) ──
   يوصف طبيعة البند نفسه: هل هو تصحيح عيب، أو تحسين تصميمي، أو ترقية، أو مجرد استفسار…
   الترتيب هنا هو ترتيب العرض بالفلاتر (الأهم أولًا)، وأي قيمة جديدة تجي من الإكسل
   تنضاف تلقائيًا بعدها عبر نفس محرك المطابقة الذكي المستخدم مع باقي الأعمدة. */
const CAT_ORDER = ["تصحيح عيب تنفيذي", "تصميمي/جمالي", "ترقية", "استفسار فني توضيحي", "تجاري", "إداري/نظامي"];

/* ── مستندات المخططات (تبويب "المخططات والمستندات") ── */
/* ── مصدر المخططات: صور WebP مقصوصة لكل دور/واجهة على حدة (تجربة جوال أفضل من PDF) ── */
const DOC_BASE = "https://codnqkeycfhznzbqlpds.supabase.co/storage/v1/object/public/Owners%20docs/";
const P = (f, ar, en) => ({ f, ar, en });

const DOCS = [
  {
    id: "master",
    nameAr: "المخطط الرئيسي", nameEn: "Master Plan",
    subAr: "توزيع البلوكات وأرقام القطع", subEn: "Block layout and plot numbers",
    color: null,
    cover: "cover-master.webp",
    pdf: "Abd.pdf",
    pages: [P("master-01-siteplan.webp", "المخطط الرئيسي", "Site Plan")],
  },
  {
    id: "amanecer",
    nameAr: "آمانيثير", nameEn: "Amanecer",
    subAr: "تاون هاوس · 259.77 م²", subEn: "Townhouse · 259.77 sqm",
    color: "red",
    cover: "cover-amanecer.webp",
    pdf: "Amanithir.pdf",
    pages: [
      P("amanecer-01-exterior.webp", "الواجهة الخارجية", "Exterior"),
      P("amanecer-02-ground.webp", "الطابق الأرضي", "Ground Floor"),
      P("amanecer-03-first.webp", "الطابق الأول", "First Floor"),
      P("amanecer-04-second.webp", "الطابق الثاني", "Second Floor"),
      P("amanecer-05-gf-dwg.webp", "الأرضي — تنفيذي", "Ground — Drawing"),
      P("amanecer-06-ff-dwg.webp", "الأول — تنفيذي", "First — Drawing"),
      P("amanecer-07-penthouse-dwg.webp", "الملحق — تنفيذي", "Penthouse — Drawing"),
      P("amanecer-08-roof-dwg.webp", "السطح — تنفيذي", "Roof — Drawing"),
      P("amanecer-09-elevations.webp", "الواجهات", "Elevations"),
      P("amanecer-10-sections.webp", "القطاعات", "Sections"),
    ],
  },
  {
    id: "alba",
    nameAr: "ألبا", nameEn: "Alba",
    subAr: "فيلا شبه متصلة · 275.71 م²", subEn: "Semi-detached · 275.71 sqm",
    color: "yellow",
    cover: "cover-alba.webp",
    pdf: "Alaba.pdf",
    pages: [
      P("alba-01-exterior.webp", "الواجهة الخارجية", "Exterior"),
      P("alba-02-ground.webp", "الطابق الأرضي", "Ground Floor"),
      P("alba-03-first.webp", "الطابق الأول", "First Floor"),
      P("alba-04-second.webp", "الطابق الثاني", "Second Floor"),
      P("alba-05-gf-dwg.webp", "الأرضي — تنفيذي", "Ground — Drawing"),
      P("alba-06-ff-dwg.webp", "الأول — تنفيذي", "First — Drawing"),
      P("alba-07-penthouse-dwg.webp", "الملحق — تنفيذي", "Penthouse — Drawing"),
      P("alba-08-roof-dwg.webp", "السطح — تنفيذي", "Roof — Drawing"),
      P("alba-09-elevations.webp", "الواجهات", "Elevations"),
      P("alba-10-sections.webp", "القطاعات", "Sections"),
    ],
  },
  {
    id: "aurora",
    nameAr: "أورورا", nameEn: "Aurora",
    subAr: "فيلا مستقلة · 290.85 م²", subEn: "Detached villa · 290.85 sqm",
    color: "green",
    cover: "cover-aurora.webp",
    pdf: "Aourora.pdf",
    pages: [
      P("aurora-01-exterior.webp", "الواجهة الخارجية", "Exterior"),
      P("aurora-02-ground.webp", "الطابق الأرضي", "Ground Floor"),
      P("aurora-03-first.webp", "الطابق الأول", "First Floor"),
      P("aurora-04-second.webp", "الطابق الثاني", "Second Floor"),
      P("aurora-05-gf-dwg.webp", "الأرضي — تنفيذي", "Ground — Drawing"),
      P("aurora-06-ff-dwg.webp", "الأول — تنفيذي", "First — Drawing"),
      P("aurora-07-penthouse-dwg.webp", "الملحق — تنفيذي", "Penthouse — Drawing"),
      P("aurora-08-roof-dwg.webp", "السطح — تنفيذي", "Roof — Drawing"),
      P("aurora-09-elevations.webp", "الواجهات", "Elevations"),
      P("aurora-10-sections.webp", "القطاعات", "Sections"),
    ],
  },
  {
    id: "albada",
    nameAr: "البدا", nameEn: "Albada",
    subAr: "فيلا مستقلة · 323.72 م²", subEn: "Detached villa · 323.72 sqm",
    color: "blue",
    cover: "cover-albada.webp",
    pdf: "Albada.pdf",
    pages: [
      P("albada-01-exterior.webp", "الواجهة الخارجية", "Exterior"),
      P("albada-02-ground.webp", "الطابق الأرضي", "Ground Floor"),
      P("albada-03-first.webp", "الطابق الأول", "First Floor"),
      P("albada-04-second.webp", "الطابق الثاني", "Second Floor"),
      P("albada-05-gf-dwg.webp", "الأرضي — تنفيذي", "Ground — Drawing"),
      P("albada-06-ff-dwg.webp", "الأول — تنفيذي", "First — Drawing"),
      P("albada-07-penthouse-dwg.webp", "الملحق — تنفيذي", "Penthouse — Drawing"),
      P("albada-08-roof-dwg.webp", "السطح — تنفيذي", "Roof — Drawing"),
      P("albada-09-elevations.webp", "الواجهات", "Elevations"),
      P("albada-10-sections.webp", "القطاعات", "Sections"),
    ],
  },
];
const DOC_COLORS = {
  light: { red: "#A8443C", yellow: "#8A6318", green: "#1F7A5C", blue: "#2E6C86" },
  dark: { red: "#D48D87", yellow: "#D8B274", green: "#74B698", blue: "#8AB0C2" },
};

/* البيانات مستوردة من inquiries.json — راجع README لمنطق التحديث الأسبوعي */
const CHANGE_WINDOW_DAYS = 7;
function isRecentlyChanged(d) {
  if (!d) return false;
  const days = (Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000;
  return days >= 0 && days <= CHANGE_WINDOW_DAYS;
}

/* ═══ وسوم "يجب الاطلاع" و"مهم" — تفعيل مؤقت (٣ أو ٧ أيام) أو دائم من لوحة الإدارة ═══
   الحقل المنطقي (urgent / important) = "دائم" وما له تاريخ انتهاء.
   حقل الـ_until (urgent_until / important_until) = وقت انتهاء التفعيل المؤقت.
   الوسم يُعتبر فعّالاً لو كان دائمًا، أو لو تاريخ الانتهاء لسه ما وصل. */
function isFlagLive(permanentFlag, untilVal) {
  if (permanentFlag) return true;
  if (!untilVal) return false;
  return new Date(untilVal).getTime() > Date.now();
}
const FLAG_META = {
  urgent: { boolField: "urgent", untilField: "urgent_until", labelAr: "يجب الاطلاع", labelEn: "Needs review" },
  important: { boolField: "important", untilField: "important_until", labelAr: "مهم", labelEn: "Important" },
};

/* ── ٣. ترجمة المفردات الثابتة (المنطق الداخلي يبقى بالعربي دائمًا) ── */
const PRI_EN = { "عالية جدًا": "Very High", "عالية": "High", "متوسطة": "Medium", "عادية": "Low" };
const STA_EN = { "معتمدة": "Approved", "تم الرفض": "Rejected", "قيد الدراسة": "Under Review", "تم التصويت": "Voted" };
const MODEL_EN = { "امانيثير": "Amanither", "اورورا": "Aurora", "البادا": "Bada", "البا": "Alba" };
const SCOPE_EN = {
  "جميع النماذج": "All models", "جميع النماذج عدا امانيثير": "All models except Amanither",
  "أورورا": "Aurora", "امانيثير و آلبا": "Amanither & Alba", "البا و امانيثير": "Alba & Amanither",
};
const trScope = (lang, v) => (lang === "en" ? SCOPE_EN[v] || v : v);
const ZONE_EN = {
  roof: "Roof", first: "First Floor", slab: "Ground + First", ground: "Ground Floor",
  wet: "Kitchen & Bathrooms", stairs: "Staircase", whole: "Whole Villa",
  party: "Party Wall", tank: "Tank Location", street: "Street", na: "Unspecified / Other",
};
const LOC_EN = {
  "كامل الفيلا": "Whole Villa", "الدور الأول": "First Floor", "الدور الأرضي": "Ground Floor",
  "دورات المياه": "Bathrooms", "السطح": "Roof", "الشارع": "Street", "الدرج": "Staircase",
  "غير محدد": "Unspecified", "المطبخ": "Kitchen", "المطبخ ودورات المياه": "Kitchen & Bathrooms",
  "كامل الفيلا (بين الفلل المتلاصقة)": "Whole Villa (Party Wall)", "الدور الأرضي والأول": "Ground + First Floor",
  "موقع الخزان": "Tank Location", "الحوش الخلفي (الدور الأرضي)": "Backyard (Ground Floor)",
  "الحوش الخلفي (الدور الأرضي) والسطح": "Backyard (Ground Floor) & Roof",
};
const CAT_EN = {
  "تصحيح عيب تنفيذي": "Execution Defect Fix", "تصميمي/جمالي": "Design / Aesthetic",
  "ترقية": "Upgrade", "استفسار فني توضيحي": "Technical Clarification",
  "تجاري": "Commercial", "إداري/نظامي": "Administrative / Regulatory",
};
const OWN_EN = { "م/محمد عبدالمعطي": "Eng. Mohammed Abdulmuti", "م/رواحه": "Eng. Rawaha", "غير محدد": "Unspecified", "أبو سلطان": "Abu Sultan", "م/إبراهيم (مالك)": "Eng. Ibrahim (Owner)" };
const MEETING_ORDER = ["الاجتماع الخامس", "الاجتماع الرابع", "الاجتماع الثالث"];
const MEETING_EN = { "الاجتماع الثالث": "3rd Meeting", "الاجتماع الرابع": "4th Meeting", "الاجتماع الخامس": "5th Meeting" };
const MONTH_EN_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const trPri = (lang, v) => (lang === "en" ? PRI_EN[v] || v : v);
const trSta = (lang, v) => (lang === "en" ? STA_EN[v] || v : v);
const trModel = (lang, v) => (lang === "en" ? MODEL_EN[v] || v : v);
const trZone = (lang, k) => (lang === "en" ? ZONE_EN[k] || k : (ZONES.find((z) => z.key === k) || {}).label || k);
const trLoc = (lang, v) => (lang === "en" ? LOC_EN[v] || v : v);
const trOwn = (lang, v) => (lang === "en" ? OWN_EN[v] || v : v);
const trCat = (lang, v) => (lang === "en" ? CAT_EN[v] || v : v);
const trMeeting = (lang, v) => (lang === "en" ? MEETING_EN[v] || v : v);
const trMonth = (lang, m) => {
  if (!/^\d{4}-\d{2}$/.test(m || "")) return lang === "en" ? "—" : "—";
  const i = +m.slice(5, 7) - 1;
  return lang === "en" ? `${MONTH_EN_LABEL[i]} ${m.slice(0, 4)}` : `${MONTH_AR[i]} ${m.slice(0, 4)}`;
};
const trNote = (lang, r) => (lang === "en" ? (r.note_en || r.note) : r.note);
const trReply = (lang, r) => (lang === "en" ? (r.reply_en || r.reply) : r.reply);

/* ═══════════════════════════════════════════════════════════
   ٤. نظام الألوان (Theme) — فاتح للنهار وداكن لليل.
   الفلسفة: فصل بالمسافات والارتفاع، لا بالخطوط.
   ═══════════════════════════════════════════════════════════ */
const THEMES = {
  light: {
    bg: "#F7F9FB", surface: "#FFFFFF", sunken: "#F1F5F8",
    paper: "#1F2C35", muted: "#5F7280", faint: "#7E8F9A",
    brass: "#1B7F8E", line: "rgba(20,45,60,.08)", lineSoft: "rgba(20,45,60,.05)",
    shadow: "0 1px 2px rgba(20,45,60,.04), 0 8px 22px -16px rgba(20,45,60,.16)",
    shadowUp: "0 2px 5px rgba(20,45,60,.06), 0 18px 38px -18px rgba(20,45,60,.22)",
    zone: "#7FA0B2", zoneOn: "#1B7F8E",
    sta: { "معتمدة": "#1F7A5C", "تم الرفض": "#A8443C", "قيد الدراسة": "#8A6318", "تم التصويت": "#4E6474" },
    pri: { "عالية جدًا": "#A8443C", "عالية": "#8F5A1E", "متوسطة": "#2E6C86", "عادية": "#5F7280" },
    cat: {
      "تصحيح عيب تنفيذي": "#A8443C", "تصميمي/جمالي": "#5E5488", "ترقية": "#1F7368",
      "استفسار فني توضيحي": "#2E6C86", "تجاري": "#8A6318", "إداري/نظامي": "#4E6474",
    },
    extra: ["#5E5488", "#1F7368", "#84544A", "#4E6474"],
    onAccent: "#FFFFFF",
  },
  dark: {
    bg: "#141C22", surface: "#1C262D", sunken: "#111920",
    paper: "#DBE3E8", muted: "#8FA0AB", faint: "#6E808C",
    brass: "#5FBCCB", line: "rgba(255,255,255,.07)", lineSoft: "rgba(255,255,255,.045)",
    shadow: "0 1px 2px rgba(0,0,0,.3), 0 12px 28px -20px rgba(0,0,0,.7)",
    shadowUp: "0 2px 6px rgba(0,0,0,.4), 0 22px 46px -22px rgba(0,0,0,.85)",
    zone: "#7C9CAD", zoneOn: "#5FBCCB",
    sta: { "معتمدة": "#74B698", "تم الرفض": "#D48D87", "قيد الدراسة": "#D8B274", "تم التصويت": "#93A7B8" },
    pri: { "عالية جدًا": "#D48D87", "عالية": "#D6A578", "متوسطة": "#8AB0C2", "عادية": "#93A4AE" },
    cat: {
      "تصحيح عيب تنفيذي": "#D48D87", "تصميمي/جمالي": "#AC9EC2", "ترقية": "#8CBEB0",
      "استفسار فني توضيحي": "#8AB0C2", "تجاري": "#D8B274", "إداري/نظامي": "#93A7B8",
    },
    extra: ["#AC9EC2", "#8CBEB0", "#C2A399", "#93A7B8"],
    onAccent: "#101820",
  },
};

const ThemeCtx = createContext({ T: THEMES.light, mode: "light", setMode: () => {}, resolved: "light" });
const useT = () => useContext(ThemeCtx);

const LangCtx = createContext({ lang: "ar", setLang: () => {} });
const useLang = () => useContext(LangCtx);

/* ── ٥. أدوات نص عربي، تحليل النماذج، ومناطق المخطط ── */
const hashPick = (s, arr) => arr[Math.abs([...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0)) % arr.length];

/* لون فئة البند — لو جت فئة جديدة من الإكسل بلا لون معرَّف، ناخذ لها لونًا ثابتًا من قائمة
   الألوان الإضافية بحسب نص الفئة نفسها (نفس أسلوب حالات الاعتماد)، فتبقى الألوان ثابتة
   بين الجلسات بدون ما نحتاج نضيف اللون يدويًا لكل فئة جديدة */
const catColor = (T, v) => (v ? (T.cat && T.cat[v]) || hashPick(v, T.extra) : T.faint);

/* ── نص عربي: توحيد للبحث والمطابقة ── */
const norm = (s = "") =>
  String(s).replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/\s+/g, " ").trim().toLowerCase();

/* ── نماذج المشروع الأربعة الفعلية ──
   عمود «نوع النموذج» في الملف يصف نطاق الملاحظة لا اسم نموذج واحد
   (مثل «جميع النماذج» أو «جميع النماذج عدا امانيثير»)، فنحلّله إلى النماذج المشمولة. */
const MODEL_LIST = ["امانيثير", "اورورا", "البادا", "البا"];
const MODEL_ALIAS = {
  "امانيثير": "امانيثير", "اورورا": "اورورا",
  "البادا": "البادا", "بادا": "البادا", "البا": "البا",
};

function modelTokens(scope) {
  return norm(scope).split(/[\s،,/+()]+/).filter(Boolean).flatMap((w) => {
    if (w === "و") return [];
    if (w.startsWith("و") && w.length > 2 && MODEL_ALIAS[w.slice(1)]) return [w.slice(1)];
    return [w];
  });
}

/* يرجّع قائمة النماذج التي تنطبق عليها الملاحظة.
   ملاحظة: «البادا» و«البا» نموذجان مختلفان، فالمطابقة بالكلمة كاملة لا بجزء منها. */
function modelsOf(scope) {
  const tk = modelTokens(scope);
  const isAll = tk.some((w) => w === "جميع" || w === "كل" || w === "الكل" || w === "كافه");
  if (isAll) {
    const i = tk.findIndex((w) => w === "عدا" || w === "ماعدا");
    if (i >= 0) {
      const excl = tk.slice(i + 1).map((w) => MODEL_ALIAS[w]).filter(Boolean);
      return MODEL_LIST.filter((m) => !excl.includes(m));
    }
    return [...MODEL_LIST];
  }
  const named = tk.map((w) => MODEL_ALIAS[w]).filter(Boolean);
  return named.length ? [...new Set(named)] : [];
}

/* ── مناطق المخطط ── */
const ZONES = [
  { key: "roof", label: "السطح" }, { key: "first", label: "الدور الأول" },
  { key: "slab", label: "الأرضي والأول" }, { key: "ground", label: "الدور الأرضي" },
  { key: "wet", label: "المطبخ ودورات المياه" }, { key: "stairs", label: "الدرج" },
  { key: "whole", label: "كامل الفيلا" }, { key: "party", label: "جدار الفلل المتلاصقة" },
  { key: "tank", label: "موقع الخزان" }, { key: "street", label: "الشارع" },
  { key: "na", label: "غير محدد / أخرى" },
];
function zoneOf(loc) {
  const s = norm(loc);
  if (!s || s === "غير محدد") return "na";
  if (s.includes("متلاصق")) return "party";
  if (s.includes("خزان")) return "tank";
  if (s.includes("شارع")) return "street";
  if (s.includes("درج")) return "stairs";
  if (s.includes("مطبخ") || s.includes("دورات") || s.includes("حمام")) return "wet";
  if (s.includes("سطح")) return "roof";
  if (s.includes("ارضي") && s.includes("اول")) return "slab";
  if (s.includes("كامل")) return "whole";
  if (s.includes("ارضي")) return "ground";
  if (s.includes("اول")) return "first";
  return "na";
}

/* ── التاريخ ── */
const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const fmtDate = (iso) => {
  try { const d = new Date(iso); return `${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`; }
  catch { return ""; }
};

/* ── النسخة الأساسية كسجلات نصية ── مستوردة من inquiries.json */
const BASE = INQUIRIES_DATA.map((r) => ({
  id: r.id, model: r.model, loc: r.loc, pri: r.pri, cat: r.cat || "", sta: r.status,
  answered: !!r.answered, owner: r.owner, month: r.month, closed: !!r.closed,
  meeting: r.meetings && r.meetings.length ? r.meetings[0] : null,
  meetings: Array.isArray(r.meetings) ? r.meetings : [],
  note: r.note, reply: r.reply, note_en: r.note_en, reply_en: r.reply_en,
  last_modified: r.last_modified,
  urgent: !!r.urgent, important: !!r.important, urgent_until: r.urgent_until || null, important_until: r.important_until || null,
}));

/* ═══════════════════════════════════════════════════════════
   ٦. تقدم التنفيذ — من ورقة KPIs في ملف «تقدم الوحدة والمراحل»
   جدولان: متوسط تقدم المراحل مقابل الهدف، وتقدم كل بلوك.
   ═══════════════════════════════════════════════════════════ */
const PG_MONTHS = ["فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس"];
const PG_TARGET = [31.25, 34.38, 37.5, 40.62, 43.75, 46.88, 50];
const PG_PHASES = [
  { key: "total", label: "إجمالي المشروع", note: "كل البلوكات", v: [37.1, 39.05, 40.91, 41.73, 43.43, null, 46.97] },
  { key: "p1", label: "المرحلة الأولى", note: "بلوكات ١-٥", v: [44.21, 46.15, 48.7, 49.94, 51.84, null, 55.79] },
  { key: "p2", label: "المرحلة الثانية", note: "بلوكات ٦-٨", v: [40.1, 42.41, 43.86, 44.39, 47.47, null, 52.7] },
  { key: "p3", label: "المرحلة الثالثة", note: "بلوكات ٩-١٥", v: [34.49, 35.87, 37.41, 38.01, 38.5, null, 41.72] },
  { key: "p4", label: "المرحلة الرابعة", note: "بلوكات ٢٢ و٢٣", v: [22.63, 25.77, 27.52, 28.37, 31.14, null, 32.03] },
];
const PG_BLOCKS = [
  { b: 1, ph: "p1", v: [47.64, 50.02, 51.88, 53.56, 54.44, null, 58.03] },
  { b: 2, ph: "p1", v: [45.28, 46.26, 48.93, 50.29, 52.63, null, 56.13] },
  { b: 3, ph: "p1", v: [43.75, 46.52, 49.3, 50.22, 51.93, null, 54.95] },
  { b: 5, ph: "p1", v: [41.5, 43.58, 48.52, 49.92, 51.71, null, 55.06] },
  { b: 4, ph: "p1", v: [42.89, 44.37, 44.87, 45.71, 48.5, null, 54.8] },
  { b: 7, ph: "p2", v: [41.2, 42.7, 44.78, 45.03, 48.05, null, 55.35] },
  { b: 6, ph: "p2", v: [39.41, 43.04, 43.56, 44.34, 47.89, null, 52.28] },
  { b: 8, ph: "p2", v: [39.68, 41.48, 43.25, 43.8, 46.46, null, 50.48] },
  { b: 9, ph: "p3", v: [33.08, 39.38, 42.45, 43.8, 43.95, null, 50.4] },
  { b: 10, ph: "p3", v: [34.46, 38.2, 41.27, 42.23, 43.95, null, 45.96] },
  { b: 14, ph: "p3", v: [43.45, 44.2, 44.45, 44.45, 44.45, null, 48.56] },
  { b: 13, ph: "p3", v: [40.7, 42.25, 43.95, 44.2, 44.2, null, 49.6] },
  { b: 22, ph: "p4", v: [26.16, 32.04, 35.53, 37.23, 42.78, null, 44.17] },
  { b: 12, ph: "p3", v: [34.01, 28.38, 29.51, 30.42, 31.51, null, 32.53] },
  { b: 15, ph: "p3", v: [21.26, 22.81, 22.85, 22.94, 22.94, null, 23.28] },
  { b: 23, ph: "p4", v: [19.1, 19.5, 19.5, 19.5, 19.5, null, 19.88] },
];
const PG_NOTE = "بلوك ٢٣: لا توجد بيانات جديدة لمايو ويونيو، فتم ترحيل آخر نسبة مسجَّلة (١٩٫٥٠٪ في أبريل) بدل تجاهله.";
/* نسخة بدون أرقام شهرية (v) من PG_PHASES — تُستخدم لبناء بيانات أي شهور تجي من قاعدة
   البيانات مستقبلًا (تحافظ على نفس التسميات والترتيب الثابت بغض النظر عن مصدر الأرقام) */
const PG_PHASES_META = PG_PHASES.map(({ key, label, note }) => ({ key, label, note }));
const PG_PHASE_NAME = { p1: "المرحلة الأولى", p2: "المرحلة الثانية", p3: "المرحلة الثالثة", p4: "المرحلة الرابعة", p_unassigned: "غير مصنّف" };
const PG_BASE = { months: PG_MONTHS, target: PG_TARGET, phases: PG_PHASES, blocks: PG_BLOCKS, note: PG_NOTE, updatedAt: null, label: "", start: { y: 2026, m: 2 } };

/* ── هدف التنفيذ: خطة خطّية تُحسب من التقويم ──
   الخطوة ٣٫١٢٥ نقطة شهريًا = ١٠٠٪ خلال ٣٢ شهرًا، من مايو ٢٠٢٥ حتى ديسمبر ٢٠٢٧.
   محقَّقة بمطابقتها للأهداف الخمسة المسجَّلة (فبراير–يونيو ٢٠٢٦) قبل الاعتماد.
   الفائدة: هدف الشهر يتقدّم وحده مع التقويم بلا أي تعديل على هذا الملف،
   بينما يبقى الإنجاز الفعلي فارغًا حتى تصل قراءة المطور الشهرية.
   الأهداف التاريخية المسجَّلة تبقى كما هي حرفيًا؛ الحساب يخصّ الأشهر الجديدة فقط. */
const PLAN_STEP = 3.125;
const PLAN_ANCHOR_Y = 2025, PLAN_ANCHOR_M = 4;   /* أبريل ٢٠٢٥ = الخطوة صفر */
const PLAN_END_Y = 2027, PLAN_END_M = 12;        /* نهاية الخطة عند ١٠٠٪ */
const planTarget = (y, m) =>
  Math.max(0, Math.min(100, +(PLAN_STEP * ((y - PLAN_ANCHOR_Y) * 12 + (m - PLAN_ANCHOR_M))).toFixed(2)));

/* ═══════════════════════════════════════════════════════════
   ٦ب. تقدّم التنفيذ من قاعدة البيانات (progress_matrix) — يحلّ محلّ
   الاعتماد الكامل على PG_BASE الثابت بالكود. كل شهر مخزَّن كصف واحد
   بجدول progress_matrix: {month:'YYYY-MM', phases:{...}, blocks:{...}}.
   الهدف (target) ما يُخزَّن إطلاقًا — يُحسب دائمًا آليًا بصيغة planTarget()
   لأي شهر موجود، تمامًا متل فلسفة الخطة الخطية أعلاه.
   ═══════════════════════════════════════════════════════════ */
/* البلوكات الأصلية بترتيب عرضها الحالي + تصنيف كل بلوك لمرحلته — يبقى ثابتًا
   بالكود لأن ملف الإكسل نفسه ما يذكر أي بلوك تابع لأي مرحلة، فقط رقمه. */
const PG_BLOCK_PHASE = {
  1: "p1", 2: "p1", 3: "p1", 4: "p1", 5: "p1",
  6: "p2", 7: "p2", 8: "p2",
  9: "p3", 10: "p3", 12: "p3", 13: "p3", 14: "p3", 15: "p3",
  22: "p4", 23: "p4",
};
const PG_BLOCK_DISPLAY_ORDER = [1, 2, 3, 5, 4, 7, 6, 8, 9, 10, 14, 13, 22, 12, 15, 23];
/* أي بلوك جديد ما هو موجود بالخريطة أعلاه (توسّع مستقبلي بالمشروع) يُصنَّف تلقائيًا
   حسب نطاقات أرقام البلوكات المعروفة بدل ما يُفقد من العرض؛ ولو خارج كل النطاقات
   يوضع تحت "غير مصنّف" ويظهر تحذير بمعاينة الرفع يطلب مراجعته يدويًا بالكود. */
function guessBlockPhase(b) {
  if (PG_BLOCK_PHASE[b]) return PG_BLOCK_PHASE[b];
  if (b >= 1 && b <= 5) return "p1";
  if (b >= 6 && b <= 8) return "p2";
  if (b >= 9 && b <= 21) return "p3";
  if (b >= 22 && b <= 23) return "p4";
  return "p_unassigned";
}
const monthKeyOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const monthKeyParts = (key) => { const [y, m] = String(key).split("-").map(Number); return { y, m }; };
function nextMonthKey(key) {
  const { y, m } = monthKeyParts(key);
  const t = y * 12 + (m - 1) + 1;
  return monthKeyOf(Math.floor(t / 12), (t % 12) + 1);
}
/* يبني نفس شكل بيانات PG_BASE (months/target/phases/blocks/start) من صفوف جدول
   progress_matrix — يملأ أي شهر مفقود بين أقدم وأحدث شهر موجود بقيمة فارغة (null)
   عشان يبقى تسلسل الأشهر متصلًا (مطلوب لحساب الهدف تلقائيًا ولتمديد الخطة مستقبلًا)
   حتى لو رفع الأدمن ملفًا فيه فجوة (مثلاً شهر سحبه المطوّر بالكامل ولا صار له صف أصلاً). */
function buildPgFromRows(rows) {
  if (!rows || !rows.length) return null;
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const sortedKeys = [...byMonth.keys()].sort();
  const first = sortedKeys[0], last = sortedKeys[sortedKeys.length - 1];
  const monthKeys = []; const months = [];
  for (let k = first; ; k = nextMonthKey(k)) {
    monthKeys.push(k);
    months.push(MONTH_AR[monthKeyParts(k).m - 1]);
    if (k === last) break;
    if (monthKeys.length > 240) break; /* حزام أمان: يمنع حلقة لا نهائية لو تاريخ تالف */
  }
  const { y: startY, m: startM } = monthKeyParts(first);
  const target = monthKeys.map((k) => { const { y, m } = monthKeyParts(k); return planTarget(y, m); });

  const phases = PG_PHASES_META.map((meta) => ({
    ...meta,
    v: monthKeys.map((k) => { const val = byMonth.get(k)?.phases?.[meta.key]; return val == null ? null : +val; }),
  }));

  const blockNums = new Set(PG_BLOCK_DISPLAY_ORDER);
  rows.forEach((r) => Object.keys(r.blocks || {}).forEach((b) => blockNums.add(+b)));
  const extra = [...blockNums].filter((b) => !PG_BLOCK_DISPLAY_ORDER.includes(b)).sort((a, b) => a - b);
  const blockOrder = [...PG_BLOCK_DISPLAY_ORDER, ...extra];
  const blocks = blockOrder.map((b) => ({
    b, ph: guessBlockPhase(b),
    v: monthKeys.map((k) => { const val = byMonth.get(k)?.blocks?.[String(b)]; return val == null ? null : +val; }),
  }));

  const updatedAt = rows.reduce((a, r) => (r.updated_at && r.updated_at > (a || "") ? r.updated_at : a), null);
  return { months, target, phases, blocks, note: PG_NOTE, updatedAt, label: "", start: { y: startY, m: startM } };
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arNum = (n) => String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
const trYear = (lang, y) => (y == null ? "" : lang === "en" ? String(y) : arNum(y));

/* توسعة السلسلة حتى الشهر الحالي: أشهر جديدة بأهداف محسوبة وإنجاز فارغ (null) */
function extendPlan(data, now) {
  const st = data && data.start;
  const months = data && Array.isArray(data.months) ? data.months : null;
  if (!st || !months || !months.length || !Array.isArray(data.target)) return { ...data, years: null, added: 0 };

  const n = months.length;
  const years = [];
  for (let i = 0; i < n; i++) years.push(st.y + Math.floor((st.m - 1 + i) / 12));
  const lastIdx = st.m - 1 + (n - 1);
  const lastY = st.y + Math.floor(lastIdx / 12);
  const lastM = (lastIdx % 12) + 1;

  const maxAdd = (PLAN_END_Y - lastY) * 12 + (PLAN_END_M - lastM);
  let add = (now.getFullYear() - lastY) * 12 + (now.getMonth() + 1 - lastM);
  add = Math.max(0, Math.min(add, Math.max(0, maxAdd)));
  if (!add) return { ...data, years, added: 0 };

  const outM = [...months], outT = [...data.target];
  for (let k = 1; k <= add; k++) {
    const t = (lastM - 1) + k;
    const y = lastY + Math.floor(t / 12);
    const m = (t % 12) + 1;
    outM.push(MONTH_AR[m - 1]);
    years.push(y);
    outT.push(planTarget(y, m));
  }
  const pad = (v) => [...(Array.isArray(v) ? v : []), ...Array(add).fill(null)];
  return {
    ...data,
    months: outM, target: outT, years, added: add,
    phases: (data.phases || []).map((p) => ({ ...p, v: pad(p.v) })),
    blocks: (data.blocks || []).map((b) => ({ ...b, v: pad(b.v) })),
  };
}

/* ── ترجمة محتوى تقدم التنفيذ (النسخة الأساسية المدمجة فقط؛ التحديثات الحيّة تبقى كما رُفعت) ── */
const PG_PHASE_NAME_EN = { p1: "Phase 1", p2: "Phase 2", p3: "Phase 3", p4: "Phase 4", p_unassigned: "Unclassified" };
const PG_LABEL_EN = { "إجمالي المشروع": "Total Project", "المرحلة الأولى": "Phase 1", "المرحلة الثانية": "Phase 2", "المرحلة الثالثة": "Phase 3", "المرحلة الرابعة": "Phase 4" };
const PG_PNOTE_EN = { "كل البلوكات": "All Blocks", "بلوكات ١-٥": "Blocks 1–5", "بلوكات ٦-٨": "Blocks 6–8", "بلوكات ٩-١٥": "Blocks 9–15", "بلوكات ٢٢ و٢٣": "Blocks 22 & 23" };
const PG_NOTE_EN = "Block 23: no new data for May or June, so the last recorded reading (19.50% in April) was carried forward for the average rather than ignored.";
const trPGMonth = (lang, m) => { const i = MONTH_AR.indexOf(m); return lang === "en" && i >= 0 ? MONTH_EN_LABEL[i] : m; };
const trPGLabel = (lang, v) => (lang === "en" ? PG_LABEL_EN[v] || v : v);
const trPGPNote = (lang, v) => (lang === "en" ? PG_PNOTE_EN[v] || v : v);

/* ── الترتيب المنطقي ── */
/* ── ٧. الترتيب المنطقي والتخزين المشترك (window.storage) ── */
const rank = (order) => (v) => { const i = order.indexOf(v); return i === -1 ? order.length + 1 : i; };
const uniqSorted = (arr, order) => [...new Set(arr)].filter(Boolean).sort((a, b) => rank(order)(a) - rank(order)(b) || a.localeCompare(b, "ar"));

/* ── تخزين ── */
const SKEY = "owners-inquiries-v1";
const PGKEY = "owners-progress-v1";
const TKEY = "owners-inquiries-theme";
const hasStore = () => typeof window !== "undefined" && !!window.storage;
async function loadShared(key = SKEY) {
  if (!hasStore()) return null;
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
/* ── ٨. الخطافات المخصّصة (Hooks) ── */
function usePrefersReduced() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const h = (e) => setR(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return r;
}

/* ── يكشف دخول/خروج عنصر من نطاق الشاشة أثناء التمرير — يُستخدم لإعادة تشغيل تعبئة الأشرطة ── */
function useInView(threshold = 0.3) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ── زر رجوع الجهاز يقفل اللوحة المفتوحة بدل مغادرة الصفحة كاملة ──
   عند فتح اللوحة نضيف محطة تاريخ وهمية؛ زر الرجوع يستهلكها ويغلق اللوحة فقط.
   إغلاق اللوحة بالطرق العادية (زر X، النقر خارجها) يستهلك نفس المحطة تلقائيًا
   حتى لا تتراكم محطات فارغة في السجل. */
function useBackClose(isOpen, onClose) {
  const pushedRef = useRef(false);
  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      window.history.pushState({ ...(window.history.state || {}), __sheet: true }, "");
      pushedRef.current = true;
    } else if (!isOpen && pushedRef.current) {
      pushedRef.current = false;
      if (window.history.state && window.history.state.__sheet) window.history.back();
    }
  }, [isOpen]);
  useEffect(() => {
    const onPop = () => {
      if (pushedRef.current) { pushedRef.current = false; onClose(); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);
}

/* ── الوضع التلقائي: يتبع إعداد الجهاز ويتغيّر معه فورًا ── */
function useThemeMode() {
  const [mode, setMode] = useState("auto"); /* افتراضيًا يتبع وضع جهاز الزائر مباشرة */
  const [sysDark, setSysDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSysDark(mq.matches);
    const h = (e) => setSysDark(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  useEffect(() => {
    if (!hasStore()) return;
    let alive = true;
    window.storage.get(TKEY, false)
      .then((r) => { if (alive && r && ["auto", "light", "dark"].includes(r.value)) setMode(r.value); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const pick = (m) => {
    setMode(m);
    if (hasStore()) { try { window.storage.set(TKEY, m, false); } catch { /* تجاهل */ } }
  };

  const resolved = mode === "auto" ? (sysDark ? "dark" : "light") : mode;
  return { mode, setMode: pick, resolved };
}

/* لغة العرض — تُحفظ للمستخدم نفسه فقط، افتراضيًا عربي */
const LKEY = "owners-inquiries-lang";
function useLangMode() {
  const [lang, setLang] = useState("ar");
  useEffect(() => {
    if (!hasStore()) return;
    let alive = true;
    window.storage.get(LKEY, false)
      .then((r) => { if (alive && r && ["ar", "en"].includes(r.value)) setLang(r.value); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const pick = (l) => {
    setLang(l);
    if (hasStore()) { try { window.storage.set(LKEY, l, false); } catch { /* تجاهل */ } }
  };
  return { lang, setLang: pick };
}

/* ── شكل عرض النتائج: بطاقات أو جدول ──
   الافتراضي "تلقائي": بطاقات على الجوال، وجدول على الشاشات 1024px فأعلى.
   الزر متاح على كل الأجهزة — أول ضغطة تثبّت اختيار المستخدم ويتجاوز الافتراضي،
   فمن يبغى "وضع سطح المكتب" على جواله يقدر يختاره بنفسه. */
const VKEY = "owners-inquiries-view";
const WIDE_Q = "(min-width: 1024px)";
function useViewMode() {
  const [pref, setPref] = useState("auto");
  /* تُقرأ فورًا عند أول رسم حتى لا تومض البطاقات ثم يظهر الجدول على الحاسب */
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_Q).matches : false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_Q);
    setWide(mq.matches);
    const h = (e) => setWide(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  useEffect(() => {
    if (!hasStore()) return;
    let alive = true;
    window.storage.get(VKEY, false)
      .then((r) => { if (alive && r && ["auto", "cards", "table"].includes(r.value)) setPref(r.value); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /* التسجيل هنا فقط — عند ضغط المستخدم على الزر، وليس عند تغيّر حجم الشاشة */
  const pick = (v) => {
    setPref(v);
    logEvent("filter", "view", v, null);
    if (hasStore()) { try { window.storage.set(VKEY, v, false); } catch { /* تجاهل */ } }
  };

  /* الافتراضي يتبع حجم الشاشة، والاختيار اليدوي يتجاوزه على أي جهاز */
  const view = pref === "auto" ? (wide ? "table" : "cards") : pref;
  return { view, setView: pick };
}

/* ── وضع متصفح سطح المكتب ──
   يبدّل وسم viewport في الصفحة، فيرسم المتصفح الصفحة كاملة بعرض حاسب (1180px)
   ويصغّرها لتناسب الشاشة — نفس مبدأ "طلب موقع الكمبيوتر" في سفاري.
   كل استعلامات CSS تعمل كأنها على حاسب، والمستخدم يقدر يقرّب بأصبعيه.
   لا يُعرض الزر أصلًا على جهاز عرضه الفعلي 1024px فأكثر لأنه بلا فائدة هناك. */
const DESK_W = "width=1180";
const MOBILE_VP = "width=device-width, initial-scale=1";
function applyViewport(content) {
  if (typeof document === "undefined") return;
  let m = document.querySelector('meta[name="viewport"]');
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute("name", "viewport");
    document.head.appendChild(m);
  }
  m.setAttribute("content", content);
}
function useDesktopView() {
  const [on, setOn] = useState(false);
  const originalRef = useRef(null);

  /* عرض الجهاز الفعلي — يُقرأ مرة واحدة قبل أي تغيير على viewport فلا يتأثر به */
  const [smallDevice] = useState(() => {
    if (typeof window === "undefined") return false;
    const sw = window.screen && window.screen.width ? window.screen.width : 9999;
    const iw = window.innerWidth || 9999;
    return Math.min(sw, iw) < 1024;
  });

  useEffect(() => {
    const m = document.querySelector('meta[name="viewport"]');
    originalRef.current = (m && m.getAttribute("content")) || MOBILE_VP;
    /* إرجاع الوضع الأصلي عند مغادرة اللوحة */
    return () => applyViewport(originalRef.current || MOBILE_VP);
  }, []);

  useEffect(() => {
    if (originalRef.current === null) return;
    applyViewport(on ? DESK_W : originalRef.current);
  }, [on]);

  const toggle = () => {
    const next = !on;
    setOn(next);
    logEvent("filter", "desktop_view", next ? "on" : "off", null);
  };

  return { deskOn: on, toggleDesk: toggle, smallDevice };
}

/* ── ٩. عناصر صغيرة قابلة لإعادة الاستخدام ── */
function CountUp({ value, dur = 850, suffix = "", onScroll = false }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.35);
  const [n, setN] = useState(onScroll && !reduced ? 0 : value);
  const prev = useRef(onScroll && !reduced ? 0 : value);
  useEffect(() => {
    if (reduced) { setN(value); prev.current = value; return; }
    /* وضع السكرول: يبدأ من صفر عند كل ظهور، ويعود لصفر عند الخروج من الشاشة */
    if (onScroll && !inView) { setN(0); prev.current = 0; return; }
    const from = onScroll ? 0 : prev.current, to = value, t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur, reduced, onScroll, inView]);
  return <span className="mono" ref={onScroll ? ref : undefined}>{n}{suffix}</span>;
}

/* ── رقم يقفز قفزة صغيرة عند تغيّر قيمته — لتوضيح تغيّر عدد النتائج بعد الفلترة ── */
function TickNum({ value }) {
  const reduced = usePrefersReduced();
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;
    if (reduced) { setShown(value); return; }
    setBump(true);
    const t1 = setTimeout(() => setShown(value), 150);
    const t2 = setTimeout(() => setBump(false), 460);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [value, reduced]);
  return <span className={`mono tick-n${bump ? " bump" : ""}`}>{shown}</span>;
}

/* ═══ مخطط الفيلا — كتل مصمتة بلا خطوط أو نقوش ═══ */
function VillaPlan({ counts, active, onPick, built }) {
  const { T } = useT();
  const { lang } = useLang();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...Object.values(counts));

  const on = (k) => active === k || hover === k;
  const zone = (k, delay) => ({
    onClick: () => onPick(active === k ? null : k),
    onMouseEnter: () => setHover(k),
    onMouseLeave: () => setHover(null),
    fill: on(k) ? T.zoneOn : T.zone,
    fillOpacity: on(k) ? 0.3 : (counts[k] || 0) === 0 ? 0.06 : 0.1 + ((counts[k] || 0) / max) * 0.26,
    stroke: on(k) ? T.zoneOn : "transparent",
    strokeWidth: on(k) ? 1.6 : 0,
    style: {
      cursor: "pointer",
      opacity: built ? (active && active !== k ? 0.3 : 1) : 0,
      transition: `opacity .45s ease ${delay}ms, fill-opacity .2s ease, stroke .2s ease`,
    },
  });

  const pos = (x, y) => ({
    position: "absolute", left: `${(x / 560) * 100}%`, top: `${(y / 430) * 100}%`,
    transform: "translate(-50%,-50%)", whiteSpace: "nowrap", textAlign: "center",
  });
  const lbl = (k, delay) => ({
    opacity: built ? (active && active !== k ? 0.3 : 1) : 0,
    transition: `opacity .45s ease ${delay}ms`,
  });

  const Tag = ({ x, y, name, k, delay, big }) => (
    <div style={{ ...pos(x, y), ...lbl(k, delay) }}>
      <div style={{ fontSize: big ? 12.5 : 11, color: on(k) ? T.zoneOn : T.paper, fontFamily: big ? "'Reem Kufi',sans-serif" : "inherit" }}>{name}</div>
      <div className="mono" style={{ fontSize: big ? 19 : 14, fontWeight: 600, color: on(k) ? T.zoneOn : T.brass, marginTop: 2 }}>{counts[k] || 0}</div>
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="0 0 560 430" className="w-full" style={{ height: "auto", display: "block" }}
        role="group" aria-label={lang === "en" ? "Interactive villa plan" : "مخطط الفيلا التفاعلي"}>
        {/* جسم الفيلا = كامل الفيلا */}
        <rect x="140" y="58" width="292" height="292" rx="10" {...zone("whole", 560)} />

        {/* جدار الفلل المتلاصقة */}
        <rect x="124" y="58" width="10" height="292" rx="4" {...zone("party", 520)} />

        {/* السطح */}
        <rect x="150" y="66" width="272" height="38" rx="7" {...zone("roof", 420)} />

        {/* الدور الأول */}
        <rect x="150" y="112" width="272" height="96" rx="7" {...zone("first", 340)} />

        {/* بلاطة الفصل */}
        <rect x="150" y="214" width="272" height="10" rx="4" {...zone("slab", 300)} />

        {/* الدور الأرضي */}
        <rect x="150" y="230" width="272" height="112" rx="7" {...zone("ground", 160)} />

        {/* المطبخ ودورات المياه — كتلة داخل الدورين */}
        <rect x="158" y="120" width="76" height="80" rx="6" {...zone("wet", 240)} />
        <rect x="158" y="240" width="76" height="94" rx="6" {...zone("wet", 240)} />

        {/* الدرج */}
        <rect x="352" y="120" width="62" height="214" rx="6" {...zone("stairs", 260)} />

        {/* منسوب الأرض */}
        <rect x="112" y="350" width="336" height="2" rx="1" fill={T.muted}
          opacity={built ? 0.28 : 0} style={{ transition: "opacity .5s ease" }} />

        {/* الخزان الأرضي */}
        <rect x="176" y="360" width="120" height="32" rx="7" {...zone("tank", 100)} />

        {/* الشارع */}
        <rect x="446" y="352" width="96" height="26" rx="7" {...zone("street", 60)} />

        {/* غير محدد */}
        <rect x="470" y="72" width="76" height="30" rx="8" {...zone("na", 600)} />
      </svg>

      {/* النصوص العربية كطبقة HTML — عنصر SVG text لا يُشكّل العربية بشكل موثوق */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <Tag x={330} y={278} name={trZone(lang, "ground")} k="ground" delay={160} big />
        <Tag x={330} y={152} name={trZone(lang, "first")} k="first" delay={340} big />
        <Tag x={286} y={84} name={trZone(lang, "roof")} k="roof" delay={420} />
        <Tag x={196} y={288} name={trZone(lang, "wet")} k="wet" delay={240} />
        <Tag x={383} y={220} name={trZone(lang, "stairs")} k="stairs" delay={260} />
        <Tag x={236} y={376} name={trZone(lang, "tank")} k="tank" delay={100} />
        <Tag x={494} y={365} name={trZone(lang, "street")} k="street" delay={60} />
        <Tag x={508} y={87} name={trZone(lang, "na")} k="na" delay={600} />

        <div style={{ ...pos(129, 204), ...lbl("party", 520), transform: "translate(-50%,-50%) rotate(180deg)", writingMode: "vertical-rl" }}>
          <span style={{ fontSize: 10, color: on("party") ? T.zoneOn : T.muted }}>{lang === "en" ? "Party Wall" : "جدار الفلل"}</span>
          <span className="mono" style={{ fontSize: 12, color: on("party") ? T.zoneOn : T.brass, marginTop: 4 }}>{counts.party || 0}</span>
        </div>

        <div style={{ ...pos(286, 219), ...lbl("slab", 300), fontSize: 9.5, color: on("slab") ? T.zoneOn : T.muted }}>
          {lang === "en" ? "Ground + First" : "الأرضي + الأول"} <span className="mono" style={{ color: on("slab") ? T.zoneOn : T.brass }}>{counts.slab || 0}</span>
        </div>

        <div style={{ ...pos(286, 46), ...lbl("whole", 560), fontSize: 10.5, color: on("whole") ? T.zoneOn : T.muted }}>
          {lang === "en" ? "Whole Villa" : "كامل الفيلا"} <span className="mono" style={{ color: on("whole") ? T.zoneOn : T.brass }}>{counts.whole || 0}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ عناصر ═══ */
function Chip({ on, onClick, children, color, count }) {
  const { T } = useT();
  return (
    <button onClick={onClick} className="chip" data-on={on ? "1" : "0"}
      style={on ? { borderColor: (color || T.brass) + "00", color: T.onAccent, background: color || T.brass } : undefined}>
      {children}{count != null && <span className="mono chip-n">{count}</span>}
    </button>
  );
}

function Select({ value, onChange, options, placeholder, icon: Icon }) {
  return (
    <div className="sel-wrap">
      {Icon && <Icon size={13} className="sel-ic" />}
      <select className="sel" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronDown size={13} className="sel-ch" />
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div className="tip-h">{label}</div>
      {payload.filter((p) => p.value > 0).map((p) => (
        <div key={p.dataKey} className="tip-r">
          <span className="tip-d" style={{ background: p.color }} />
          <span className="tip-l">{p.name}</span><span className="mono tip-v">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function StaIcon({ s, size = 13 }) {
  const { T } = useT();
  const p = { size, style: { color: T.sta[s] || hashPick(s, T.extra) }, strokeWidth: 2.1 };
  if (s === "معتمدة") return <CheckCircle2 {...p} />;
  if (s === "تم الرفض") return <XCircle {...p} />;
  if (s === "قيد الدراسة") return <Clock {...p} />;
  return <Users {...p} />;
}

function ThemeToggle() {
  const { mode, setMode, T } = useT();
  const { lang } = useLang();
  const opts = lang === "en"
    ? [["auto", Monitor, "Auto"], ["light", Sun, "Light"], ["dark", Moon, "Dark"]]
    : [["auto", Monitor, "تلقائي"], ["light", Sun, "فاتح"], ["dark", Moon, "داكن"]];
  return (
    <div className="seg" role="group" aria-label={lang === "en" ? "Dashboard appearance" : "مظهر اللوحة"}>
      {opts.map(([m, Ic, title]) => (
        <button key={m} onClick={() => { if (m !== mode) logEvent("filter", "theme", m, null); setMode(m); }} title={title} aria-label={title}
          className="seg-b" data-on={mode === m ? "1" : "0"}
          style={mode === m ? { background: T.brass, color: T.onAccent } : undefined}>
          <Ic size={13} />
        </button>
      ))}
    </div>
  );
}

function LangToggle() {
  const { T } = useT();
  const { lang, setLang } = useLang();
  return (
    <div className="seg" role="group" aria-label="Language / اللغة">
      {[["ar", "ع"], ["en", "EN"]].map(([l, label]) => (
        <button key={l} onClick={() => { if (l !== lang) logEvent("filter", "lang", l, null); setLang(l); }} title={l === "ar" ? "العربية" : "English"}
          className="seg-b seg-b-txt" data-on={lang === l ? "1" : "0"}
          style={lang === l ? { background: T.brass, color: T.onAccent } : undefined}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ViewToggle({ view, setView }) {
  const { T } = useT();
  const { lang } = useLang();
  const opts = lang === "en"
    ? [["cards", LayoutGrid, "Card view"], ["table", Table, "Table view"]]
    : [["cards", LayoutGrid, "عرض بطاقات"], ["table", Table, "عرض جدول"]];
  return (
    <div className="seg view-seg no-print" role="group" aria-label={lang === "en" ? "Results layout" : "شكل عرض النتائج"}>
      {opts.map(([v, Ic, title]) => (
        <button key={v} onClick={() => setView(v)} title={title} aria-label={title}
          className="seg-b" data-on={view === v ? "1" : "0"}
          style={view === v ? { background: T.brass, color: T.onAccent } : undefined}>
          <Ic size={13} />
        </button>
      ))}
    </div>
  );
}

/* شارة فئة البند — عنصر واحد مشترك بين البطاقة والجدول ولوحة التفاصيل،
   عشان أي تعديل مستقبلي على شكل الشارة يصير بمكان واحد فقط */
function CatPill({ cat }) {
  const { T } = useT();
  const { lang } = useLang();
  if (!cat) return null;
  const cc = catColor(T, cat);
  return (
    <span className="cat-pill" style={{ color: cc, background: `${cc}16`, borderColor: `${cc}33` }}>
      {trCat(lang, cat)}
    </span>
  );
}

function Row({ r, onOpen }) {
  const { T } = useT();
  const { lang } = useLang();
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);
  const pc = T.pri[r.pri] || T.muted;
  const open = () => onOpen(r);
  return (
    <tr className="trow" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <td className="mono td-id">{String(r.id).padStart(2, "0")}</td>
      <td className="td-nw">
        <span className="td-sta" style={{ color: sc }}><StaIcon s={r.sta} />{trSta(lang, r.sta)}</span>
      </td>
      <td className="td-nw" style={{ color: pc }}>{trPri(lang, r.pri)}</td>
      <td className="td-note">
        <span className="td-note-t">{trNote(lang, r)}</span>
        {(r.isImportantActive || r.isNew || !r.closed) && (
          <span className="td-tags">
            {r.isImportantActive && <span className="tag tag-important"><AlertTriangle size={9} /> {lang === "en" ? "Important" : "مهم"}</span>}
            {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {lang === "en" ? "New" : "جديد"}</span>}
            {!r.closed && <span className="tag tag-open">{lang === "en" ? "Open" : "مفتوح"}</span>}
          </span>
        )}
      </td>
      <td className="td-cat">{r.cat ? <CatPill cat={r.cat} /> : <span className="td-m">—</span>}</td>
      <td className="td-m">{trLoc(lang, r.loc)}</td>
      <td className="td-m">{trScope(lang, r.model)}</td>
      <td className="td-m">{trMonth(lang, r.month)}</td>
    </tr>
  );
}

/* ── شريط توزيع الحالات — ينمو من صفر عند دخوله الشاشة ── */
function StatusBar({ cats, overview, staC, trSta, lang, openBoard, L }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.4);
  const grow = reduced || inView;
  return (
    <div className="bar" ref={ref} role="img" aria-label={L("توزيع القرارات", "Decision breakdown")}>
      {cats.sta.map((s) => {
        const n = overview.byS[s] || 0;
        if (!n) return null;
        return <div key={s} className="bar-s" title={`${trSta(lang, s)} — ${n}`} onClick={() => openBoard({ sta: s })}
          style={{ flex: grow ? n : 0, background: staC(s) }} />;
      })}
    </div>
  );
}

function Card({ r, i, onOpen, reduced }) {
  const { T } = useT();
  const { lang } = useLang();
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);
  const pc = T.pri[r.pri] || T.muted;
  const [pulsed, setPulsed] = useState(false);
  const open = () => {
    if (!reduced) { setPulsed(false); requestAnimationFrame(() => setPulsed(true)); }
    onOpen(r);
  };
  return (
    <div role="button" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      onAnimationEnd={(e) => { if (e.animationName === "pulseFlash") setPulsed(false); }}
      className={`card pulse-host${pulsed ? " pulsed" : ""}`} style={{
        animation: reduced ? "none" : `rise .4s cubic-bezier(.2,.7,.3,1) ${Math.min(i, 12) * 45}ms both`,
        borderRightColor: pc,
      }}>
      <span className="card-wm mono" aria-hidden="true">{r.id}</span>
      {r.isUrgentActive && (
        <span className="card-wm-urgent" aria-hidden="true">{lang === "en" ? "Needs review" : "يلزم الاطلاع"}</span>
      )}
      <div className="card-top">
        <span className="mono card-id">{String(r.id).padStart(2, "0")}</span>
        <span className="tag" style={{ color: pc }}>{trPri(lang, r.pri)}</span>
        <CatPill cat={r.cat} />
        {r.isImportantActive && <span className="tag tag-important"><AlertTriangle size={9} /> {lang === "en" ? "Important" : "مهم"}</span>}
        {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {lang === "en" ? "New" : "جديد"}</span>}
        {!r.closed && <span className="tag tag-open">{lang === "en" ? "Open" : "مفتوح"}</span>}
        <span className="card-sta" style={{ color: sc }}>
          <StaIcon s={r.sta} />{trSta(lang, r.sta)}
        </span>
      </div>
      <div className="card-note">{trNote(lang, r)}</div>
      <div className="card-foot">
        <span className="fm">{trLoc(lang, r.loc)}</span>
        <span className="dot" />
        <span className="fm">{trScope(lang, r.model)}</span>
        <span className="dot" />
        <span className="fm">{trMonth(lang, r.month)}</span>
        {r.meeting && <><span className="dot" /><span className="fm">{trMeeting(lang, r.meeting)}</span></>}
      </div>
    </div>
  );
}

/* ── ١٠. سجل إصدارات الموقع (CHANGELOG) ──
   ترقيم الإصدارات بنظام "رئيسي.فرعي.تصحيحي" (Major.Minor.Patch)، مثل مواقع البرمجيات المعتادة:
     • يرتفع الرقم التصحيحي (مثل 1.1.1 → 1.1.2) مع أي تعديل صغير: إصلاح مشكلة،
       حذف/تعديل عنصر بسيط، تحسين نص أو تصميم — وهذا الغالب، يشمل أغلب الطلبات اليومية.
     • يرتفع الرقم الفرعي ويُصفَّر التصحيحي (مثل 1.1.4 → 1.2.0) عند إضافة ميزة جديدة
       فعلية (مثل لوحة أو خانة جديدة داخل تبويب موجود).
     • يرتفع الرقم الرئيسي ويُصفَّر البقية (مثل 1.x.x → 2.0.0) فقط عند تغيير جوهري
       كبير: إعادة تصميم شاملة، أو إضافة قسم/تبويب رئيسي جديد للوحة.
   عند كل تحديث كود مستقبلي على هذا الملف — مهما كان صغيرًا — يُضاف عنصر جديد
   بالأعلى برقم إصدار تالٍ حسب القاعدة أعلاه. لا تُعاد كتابة أو حذف الإصدارات السابقة. */
const CHANGELOG = [
  {
    version: "1.13.0",
    dateAr: "2 سبتمبر 2026",
    dateEn: "September 2, 2026",
    ar: [
      "فلتر جديد: \"الاجتماع الخامس\" — يعرض البنود التي صدر بشأنها رد في اجتماع 2 سبتمبر 2026 (٩ بنود)",
      "فلاتر الاجتماعات صارت تطابق كل اجتماع مرتبط بالبند، مو أول اجتماع فقط — قبل كذا كان البند المرتبط بأكثر من اجتماع يختفي من فلاتر الاجتماعات السابقة",
      "إضافة عدّاد بجانب اسم كل اجتماع يوضح عدد بنوده",
      "تحديث ردود وحالات ٩ بنود (٣٠، ٥٣، ٦٦، ٧٦، ٨٠، ٨١، ٨٢، ٨٤، ٨٥) — أُقفلت منها ٥ بنود",
    ],
    en: [
      "New filter: \"5th Meeting\" — shows the items answered in the September 2, 2026 meeting (9 items)",
      "Meeting filters now match every meeting an item is linked to, not just the first one — previously an item linked to several meetings disappeared from the earlier meetings' filters",
      "Added a per-meeting item count next to each meeting name",
      "Updated replies and statuses for 9 items (30, 53, 66, 76, 80, 81, 82, 84, 85) — 5 of them were closed",
    ],
  },
  {
    version: "1.12.3",
    dateAr: "30 أغسطس 2026",
    dateEn: "August 30, 2026",
    ar: ["تعويض تلقائي لخلية \"الإجمالي\" الفاضية بجدول المراحل: لو المراحل الأربعة معبّاة لشهر معيّن لكن خليته \"الإجمالي\" فاضية (يصير هذا لما تتعدَّل خلايا المراحل يدويًا وتنكسر الصيغة المرتبطة بالإجمالي)، يُحسب الإجمالي تلقائيًا كمتوسط المراحل الأربعة — نفس الأسلوب الموثّق فعليًا بملاحظات الملف. اكتُشفت هذي الحالة الحقيقية بعد فحص ملف معدَّل فعليًا أرسله المستخدم"],
    en: ["Automatic fallback for a blank \"Total\" cell in the phases table: if all four phases have values for a given month but the Total cell is blank (this happens when the phase cells are edited by hand and the formula feeding Total breaks), the total is now computed automatically as the average of the four phases — matching the methodology already documented in the file's own notes. This real scenario was discovered after reviewing an actually-edited file the user sent"],
  },
  {
    version: "1.12.2",
    dateAr: "30 أغسطس 2026",
    dateEn: "August 30, 2026",
    ar: ["إصلاح جذري لقراءة جدول المراحل بملف تقدّم الوحدة: صار كل صف (الإجمالي، والمراحل ١-٤) يُكتشف بمطابقة نصّه هو نفسه، بدل الاعتماد على عدّ عدد صفوف ثابت من عنوان الجدول — هذا هو سبب رجوع أرقام غلط لبعض المراحل ومسح شهور فبراير-يونيو بالرفعة الأولى الفعلية. جدول البلوكات ما تأثر لأنه أصلًا مبني على نفس مبدأ المطابقة بالمحتوى"],
    en: ["Root-cause fix for reading the phases table in the unit-progress file: every row (Total, and Phases 1-4) is now located by matching its own text, instead of counting a fixed number of rows down from the table title — this was the actual cause of the wrong phase numbers and the wiped February-June months on the real first upload. The blocks table was unaffected since it already worked on content-matching"],
  },
  {
    version: "1.12.1",
    dateAr: "30 أغسطس 2026",
    dateEn: "August 30, 2026",
    ar: ["إضافة حماية من فقدان البيانات برفع ملف تقدّم الوحدة: أي شهر يرجع بقيم أقل بكثير مما هو مسجَّل له فعلًا يُستبعد تلقائيًا من التحديث بدل الكتابة فوقه، ويحتاج تأكيدًا صريحًا لكل شهر منه لو كان مقصودًا. كذلك صار تعذّر التعرّف على صف \"إجمالي المشروع\" بشيت KPIs يوقف القراءة بخطأ واضح بدل المتابعة بأرقام قد تكون غلط"],
    en: ["Added data-loss protection to the unit-progress upload: any month whose parsed values are far fewer than what's already recorded is now automatically excluded from the update instead of overwriting it, and needs explicit per-month confirmation if truly intended. Also, failing to locate the \"Total Project\" row in the KPIs sheet now stops the read with a clear error instead of continuing with potentially wrong numbers"],
  },
  {
    version: "1.12.0",
    dateAr: "30 أغسطس 2026",
    dateEn: "August 30, 2026",
    ar: ["إضافة رفع تلقائي لملف \"تقدّم الوحدة والمراحل\" من لوحة الإدارة — يقرأ شيت KPIs بدون أي إعداد يدوي للأعمدة ويحدّث تبويب «تقدّم التنفيذ» بالموقع العام مباشرة لكل الزوّار عبر قاعدة البيانات، بدل الاعتماد على تعديل الكود وإعادة النشر كل شهر"],
    en: ["Added automatic upload for the \"Unit & Phases Progress\" file from the admin panel — reads the KPIs sheet with zero manual column setup and updates the public \"Execution Progress\" tab live for all visitors via the database, instead of relying on a code edit and redeploy each month"],
  },
  {
    version: "1.11.2",
    dateAr: "30 أغسطس 2026",
    dateEn: "August 30, 2026",
    ar: ["تحديث بيانات تقدّم التنفيذ حتى أغسطس 2026 — لا قراءة جديدة لشهر يوليو (يظهر باهتًا بهدف محسوب وإنجاز فارغ)، مطابقةً لملف «تقدّم الوحدة والمراحل» المحدَّث"],
    en: ["Updated execution-progress data through August 2026 — no new reading for July (shown faded with a computed target and empty actual progress), matching the updated \"Unit & Phases Progress\" file"],
  },
  {
    version: "1.11.1",
    dateAr: "29 أغسطس 2026",
    dateEn: "August 29, 2026",
    ar: ["إصلاحات"],
    en: ["Fixes"],
  },
  {
    version: "1.11.0",
    dateAr: "29 أغسطس 2026",
    dateEn: "August 29, 2026",
    ar: ["إصلاحات"],
    en: ["Fixes"],
  },
  {
    version: "1.10.3",
    dateAr: "29 أغسطس 2026",
    dateEn: "August 29, 2026",
    ar: ["إصلاحات"],
    en: ["Fixes"],
  },
  {
    version: "1.10.2",
    dateAr: "29 أغسطس 2026",
    dateEn: "August 29, 2026",
    ar: [
      "تصحيح خطأ حقيقي: علامتا \"يلزم الاطلاع\" و\"مهم\" ما كانتا تظهران على الموقع العام رغم تفعيلهما من لوحة الإدارة — السبب أن دالة قراءة البيانات الحيّة كانت تتجاهل هذين الحقلين تحديدًا قبل ما توصل للبطاقات. تم تصحيحها.",
    ],
    en: [
      "Fixed a real bug: the \"Needs review\" and \"Important\" marks never appeared on the public site even when enabled from the admin panel — the live-data mapping function was silently dropping exactly those two fields before they reached the cards. Corrected.",
    ],
  },
  {
    version: "1.10.0",
    dateAr: "29 أغسطس 2026",
    dateEn: "August 29, 2026",
    ar: [
      "علامة جديدة \"مهم\" — إطار أحمر واضح مع وميض لافت، أقوى من تأثير شارة \"جديد\"",
      "تظهر بالبطاقة والجدول ولوحة التفاصيل، وتُفعَّل/تُلغى يدويًا بالكامل من لوحة الإدارة بدون أي مدة انتهاء تلقائية (بخلاف \"جديد\" اللي ينتهي بعد ٧ أيام)",
      "فلتر مخصص \"مهم\" بلوحة المتابعة — يظهر فقط لو فيه استفسار واحد مفعّل عليه الوسم، ويختفي تلقائيًا لو ما فيه شي",
    ],
    en: [
      "New \"Important\" tag — a clear red border with an attention-grabbing blink, stronger than the existing \"New\" badge effect",
      "Shown on the card, table, and detail sheet; toggled fully manually from the admin panel with no auto-expiry (unlike \"New\", which expires after 7 days)",
      "Dedicated \"Important\" filter in the notes board — only appears when at least one inquiry is flagged, and disappears automatically when none are",
    ],
  },
  {
    version: "1.9.0",
    dateAr: "29 أغسطس 2026",
    dateEn: "August 29, 2026",
    ar: [
      "علامة مائية جديدة وواضحة \"يلزم الاطلاع\" تظهر على بطاقة أي استفسار تفعّله الإدارة — بلون تحذيري وشفافية أعلى بكثير من رقم الاستفسار الخافت",
      "تُفعَّل وتُلغى من لوحة الإدارة (زر النجمة بقائمة الاستفسارات) بنفس صلاحية وسم \"عاجل\" الحالية",
      "خيار فرز جديد بقائمة الاستفسارات بلوحة الإدارة: الأحدث تعديلاً، الأحدث إضافة، أو رقم الاستفسار — لتسهيل الوصول لآخر التعديلات",
      "كل استفسار بالقائمة يعرض الآن تاريخ آخر تعديل أو الإضافة بجانبه حسب الفرز المختار",
    ],
    en: [
      "New, clearly visible \"Needs review\" watermark on any inquiry card the admin flags — a warning color and far higher opacity than the faint inquiry-number mark",
      "Toggled on and off from the admin panel (the star button in the inquiries list), using the existing \"urgent\" permission",
      "New sort option in the admin inquiries list: most recently modified, most recently added, or inquiry number — to quickly reach the latest updates",
      "Each inquiry row now shows its last-modified or added date next to it, matching the chosen sort",
    ],
  },
  {
    version: "1.8.0",
    dateAr: "26 أغسطس 2026",
    dateEn: "August 26, 2026",
    ar: [
      "إضافة «فئة البند» لكل استفسار — تصحيح عيب تنفيذي، تصميمي/جمالي، ترقية، استفسار فني، تجاري، إداري",
      "الفئة تظهر كشارة ملوّنة عند كل استفسار بالبطاقات والجدول ولوحة التفاصيل",
      "فلتر جديد بالفئة مع عدّاد لكل فئة، وصار البحث النصي يشملها",
      "لوحة «طبيعة البنود» بالنظرة العامة — توزيع الاستفسارات على الفئات بضغطة واحدة",
    ],
    en: [
      "Added an item category to every inquiry — defect fix, design/aesthetic, upgrade, technical, commercial, administrative",
      "The category now shows as a colored badge on every inquiry in cards, table, and detail view",
      "New category filter with per-category counts; free-text search now covers it too",
      "New \"Item Categories\" panel in the overview showing how inquiries break down",
    ],
  },
  {
    version: "1.7.9",
    dateAr: "11 أغسطس 2026",
    dateEn: "August 11, 2026",
    ar: ["تحديث بيانات موقع لبندين", "تحديث بيانات مسؤول وشهر لبند"],
    en: ["Updated location data for two items", "Updated owner and month data for one item"],
  },
  {
    version: "1.7.8",
    dateAr: "11 أغسطس 2026",
    dateEn: "August 11, 2026",
    ar: ["ربط بنود بالاجتماع الرابع"],
    en: ["Linked items to the fourth meeting"],
  },
  {
    version: "1.7.7",
    dateAr: "11 أغسطس 2026",
    dateEn: "August 11, 2026",
    ar: ["إعادة هيكلة داخلية لتخزين بيانات الاستفسارات (بدون تغيير مرئي)"],
    en: ["Internal restructuring of inquiry data storage (no visual change)"],
  },
  {
    version: "1.7.6",
    dateAr: "10 أغسطس 2026",
    dateEn: "August 10, 2026",
    ar: [
      "عارض مخططات جديد بملء الشاشة مع تكبير بالإصبعين أو بنقرتين",
      "تقسيم كل مخطط إلى لوحات مسمّاة: الأدوار، الواجهات، القطاعات",
      "بطاقات المخططات صارت بصور مصغّرة ومساحة كل نموذج",
    ],
    en: [
      "New full-screen plan viewer with pinch or double-tap zoom",
      "Each plan split into named sheets: floors, elevations, sections",
      "Plan cards now show a thumbnail and each model's area",
    ],
  },
  {
    version: "1.7.5",
    dateAr: "9 أغسطس 2026",
    dateEn: "August 9, 2026",
    ar: [
      "تحسين شكل شريط الخانات على الجوال — صف منظّم بدل التفاف عشوائي",
    ],
    en: [
      "Improved the mobile tabs layout — a clean grid instead of a messy wrap",
    ],
  },
  {
    version: "1.7.4",
    dateAr: "9 أغسطس 2026",
    dateEn: "August 9, 2026",
    ar: [
      "إضافة تبويب \"المخططات والمستندات\" لعرض مخططات الفيلا",
    ],
    en: [
      "Added a \"Plans & Documents\" tab for villa plans",
    ],
  },
  {
    version: "1.7.3",
    dateAr: "9 أغسطس 2026",
    dateEn: "August 9, 2026",
    ar: [
      "تصحيح حالة إغلاق استفسار رقم ٣٦",
    ],
    en: [
      "Corrected the closure status of inquiry #36",
    ],
  },
  {
    version: "1.7.2",
    dateAr: "8 أغسطس 2026",
    dateEn: "August 8, 2026",
    ar: [
      "حذف كود غير مستخدم إطلاقًا من الواجهة",
      "إعادة تنظيم الملف بفهرس وعناوين أقسام أوضح لتسهيل التعديل مستقبلاً",
    ],
    en: [
      "Removed code with zero references from the live UI",
      "Reorganized the file with a table of contents and clearer section headers",
    ],
  },
  {
    version: "1.7.1",
    dateAr: "8 أغسطس 2026",
    dateEn: "August 8, 2026",
    ar: [
      "تحسينات تقنية داخلية على رصد الأداء",
    ],
    en: [
      "Internal technical improvements to performance monitoring",
    ],
  },
  {
    version: "1.7.0",
    dateAr: "8 أغسطس 2026",
    dateEn: "August 8, 2026",
    ar: [
      "تصغير خفيف للبطاقة عند الضغط عليها",
      "رقم الاستفسار كعلامة مائية باهتة داخل كل بطاقة",
      "خط تقدّم تمرير رفيع أعلى الصفحة",
      "زجاجية تدريجية على شريط الخانات الملتصق عند التمرير",
      "تصحيح عنوان تبويب المتصفح",
    ],
    en: [
      "Subtle scale-down effect on card tap",
      "Faint watermark of the inquiry number inside each card",
      "Thin scroll-progress line at the top of the page",
      "Progressive glass effect on the sticky tab bar while scrolling",
      "Fixed the browser tab title",
    ],
  },
  {
    version: "1.6.0",
    dateAr: "8 أغسطس 2026",
    dateEn: "August 8, 2026",
    ar: [
      "مشاركة الاستفسار عبر نافذة المشاركة الأصلية بالجهاز (واتساب، تليجرام، رسائل...)",
      "زر رجوع الجهاز يقفل لوحة التفاصيل أو سجل الإصدارات بدل الخروج من الصفحة",
      "تنقّل سابق/تالي بين الاستفسارات داخل اللوحة، بالأزرار أو بسحب الإصبع",
      "البحث يقبل رقم الاستفسار مباشرة",
      "شريط فلاتر مصغّر يلتصق أعلى الشاشة عند التمرير بلوحة المتابعة",
      "زر \u200f\"رجوع للأعلى\"\u200f عائم",
      "تحميل الملاحظات الإضافية تلقائي عند التمرير، بدل زر \u200f\"عرض المزيد\"\u200f",
    ],
    en: [
      "Share Inquiry now opens the device's native share sheet (WhatsApp, Telegram, Messages...)",
      "Device back button closes the detail sheet or update log instead of leaving the page",
      "Previous/next navigation between inquiries inside the sheet, via buttons or swipe",
      "Search now accepts an inquiry number directly",
      "Compact filter bar sticks to the top while scrolling the Notes Board",
      "Floating \"Back to top\" button",
      "Loading more notes is now automatic on scroll, replacing the \"Show more\" button",
    ],
  },
  {
    version: "1.5.2",
    dateAr: "8 أغسطس 2026",
    dateEn: "August 8, 2026",
    ar: [
      "زر \u200f\"مشاركة الاستفسار\"\u200f جديد داخل لوحة تفاصيل كل استفسار — ينسخ رابطًا مباشرًا لهذا الاستفسار تحديدًا مع تأكيد بصري (شريط أخضر ينزلق) بنفس أسلوب زر \u200f\"ملخص\"\u200f",
      "الرابط المنسوخ يفتح اللوحة على نفس الاستفسار مباشرة عند لصقه ومشاركته لأي شخص",
      "زرّا \u200f\"لايك\"\u200f و\u200f\"ديسلايك\"\u200f جديدان بجانب زر \u200f\"مشاركة\"\u200f داخل نفس اللوحة — أيقونتا يد واضحتان بدون أي عدّاد ظاهر بالواجهة",
    ],
    en: [
      "New \"Share Inquiry\" button inside each inquiry's detail sheet — copies a direct link to that specific inquiry with a visual confirmation (sliding green bar), matching the existing \"Summary\" button style",
      "The copied link opens the dashboard directly on that same inquiry when pasted and shared with anyone",
      "New \"Like\" and \"Dislike\" buttons next to the \"Share\" button in the same sheet — clear thumb icons with no visible counter on screen",
    ],
  },
  {
    version: "1.5.1",
    dateAr: "8 أغسطس 2026",
    dateEn: "August 8, 2026",
    ar: [
      "زر \u200f\"مجتمع الملاك\"\u200f جديد بأعلى اللوحة (بأيقونة تليجرام) يفتح رابط مجموعة الملاك مباشرة في تبويب جديد",
    ],
    en: [
      "New \"Owners Community\" button at the top of the dashboard (with Telegram icon) opens the owners group link directly in a new tab",
    ],
  },
  {
    version: "1.5.0",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "الأرقام الرئيسية (إجمالي الملاحظات، توزيع الحالات، المفتوحة والمقفلة، نسبة الاعتماد) صارت تعدّ تصاعديًا من صفر كل مرة تدخل الشاشة أثناء التمرير",
      "شريط توزيع الحالات ينمو من صفر عند ظهوره، بنفس روح أشرطة تقدّم التنفيذ",
      "صف حلقات جديد أعلى المراحل بخانة تقدم التنفيذ: ملخص بصري سريع يرتسم تدريجيًا، بنفس ألوان المتقدّم والمتأخّر — والأشرطة التفصيلية تحته كما هي بلا تغيير",
      "وميض خفيف يمر على بطاقة الاستفسار لحظة الضغط عليها، ولوحة التفاصيل تنزلق من أسفل الشاشة بالكامل بدل الظهور المفاجئ",
      "توهج هادئ ينبض حول شارة \u200f\"الجديد\"\u200f، ونبضة صغيرة تكبّر الفلتر المختار عند اختياره",
      "عدد النتائج يقفز قفزة صغيرة عند تغيّره بعد الفلترة، وانتقال ناعم عند التبديل بين عرض البطاقات والجدول",
      "زر \u200f\"ملخص\"\u200f صار يعرض شريطًا أخضر ينزلق داخله عند نجاح النسخ بدل تغيير الأيقونة فقط",
      "أثناء تحميل أحدث نسخة، يظهر هيكل رمادي متحرك بدل النص — مع بقاء كل البيانات ظاهرة ولا تُخفى",
      "تنظيف إضافي: حذف بقايا تنسيقات CSS غير مستخدمة تبقّت من تنظيف الإصدار السابق",
    ],
    en: [
      "Key figures (total notes, status breakdown, open and closed counts, approval rate) now count up from zero each time they enter the screen while scrolling",
      "The status breakdown bar grows from zero when it appears, matching the execution progress bars",
      "A new ring row above the phases in the Progress tab: a quick visual summary that draws in gradually, using the same ahead/behind colors — the detailed bars below remain unchanged",
      "A soft flash sweeps across an inquiry card the moment it's tapped, and the detail sheet now slides up fully from the bottom of the screen instead of appearing abruptly",
      "A gentle glow pulses around the \"New\" badge, and a small bounce scales up the selected filter chip",
      "The results count bounces slightly when it changes after filtering, and switching between card and table views now transitions smoothly",
      "The \"Summary\" button now shows a green bar sliding up inside it on a successful copy, instead of only swapping the icon",
      "While loading the latest version, an animated gray placeholder replaces the text — all data stays visible and is never hidden",
      "Additional cleanup: removed leftover unused CSS rules remaining from the previous version's cleanup",
    ],
  },
  {
    version: "1.4.4",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "تنظيف داخلي فقط: حذف كود غير مستخدم إطلاقًا من الواجهة (~480 سطر، ١٧٪ من حجم الملف) — لوحتا رفع تحديث كانتا معطّلتين تمامًا مع محرك قراءة ملفات Excel/CSV المرتبط بهما، ودوال مساعدة صارت بلا استخدام بعد إزالتهما",
      "شمل الحذف أيضًا استيراد مكتبة خارجية (xlsx) لم تعد مستخدمة أبدًا في أي مكان بالتطبيق",
      "لا يوجد أي تغيير في الشكل أو السلوك أو البيانات الظاهرة للمستخدم — الملف الناتج مطابق حرفيًا للسابق فيما يخص كل الأجزاء الحية، تم التحقق بمقارنة سطر بسطر",
    ],
    en: [
      "Internal cleanup only: removed ~480 lines (17% of the file) of code with zero references from the live UI — two update-upload panels that were fully disconnected, along with the Excel/CSV parsing engine that only fed them, and helper functions left unused once those were removed",
      "Also removed an external library import (xlsx) that was no longer used anywhere in the app",
      "No change to appearance, behavior, or data shown to users — the resulting file is byte-identical to the previous one for every live code path, verified with a line-by-line diff",
    ],
  },
  {
    version: "1.4.3",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "إصلاح تشوّه شكل الحروف بخط العنوان الزخرفي \u200f\"Reem Kufi\"\u200f عند فتح الصفحة لأول مرة — كان المتصفح يرسم النص بخط بديل مؤقت قبل اكتمال تحميل الخط الأصلي مما يشوّه الحروف العربية للحظة",
      "الآن ينتظر المتصفح تحميل الخط كاملًا قبل رسم العنوان، فيظهر بشكله الصحيح من أول لحظة بدون أي تشوّه أو حاجة لتحديث الصفحة",
    ],
    en: [
      "Fixed distorted lettering in the decorative \"Reem Kufi\" heading font on first page load — the browser was painting the text with a temporary fallback font before the real font finished loading, briefly garbling the Arabic shaping",
      "The browser now waits for the font to fully load before painting the heading, so it renders correctly from the first frame without needing a page refresh",
    ],
  },
  {
    version: "1.4.2",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "شريط التبويبات الرئيسي (نظرة عامة / متابعة الملاحظات / تقدم التنفيذ) صار له انتقال ناعم: تلاشي خفيف لمحتوى التبويب الجديد، ومؤشر رفيع بلون الهوية ينزلق تحت التبويب النشط",
      "المؤشر يحسب موضعه تلقائيًا حسب اتجاه اللغة (عربي/إنجليزي) وحجم الشاشة، بما في ذلك وضع سطح المكتب",
    ],
    en: [
      "The main tab bar (Overview / Notes Board / Progress) now has a smooth transition: a soft fade for the new tab's content, and a thin accent-colored indicator that slides under the active tab",
      "The indicator auto-calculates its position based on language direction (Arabic/English) and screen size, including desktop mode",
    ],
  },
  {
    version: "1.4.1",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "خانة \u200f\"تقدم التنفيذ\"\u200f فقط: أشرطة التقدّم (الإجمالي، المراحل، والبلوكات) صارت تفضى وتتعبى من جديد كل مرة تدخل نطاق الشاشة أثناء التمرير، مع لمعة ناعمة تمر عليها بعد اكتمال التعبئة",
      "لون الشريط لم يتغيّر: أخضر للمتقدّم، أحمر للمتأخّر، رمادي بلا بيانات — نفس المنطق السابق تمامًا",
      "إعداد \u200f\"تقليل الحركة\"\u200f بالجهاز مُحترَم بالكامل: الأشرطة تظهر فورًا بدون انتظار سكرول لمن يفعّله",
    ],
    en: [
      "\"Progress\" tab only: progress bars (total, phases, and blocks) now empty out and re-fill each time they enter the screen while scrolling, with a soft shimmer sweep once the fill completes",
      "Bar color is unchanged: green for ahead, red for behind, gray for no data — identical to the previous logic",
      "The device's \"reduce motion\" setting is fully respected: bars appear instantly with no scroll wait for those who enable it",
    ],
  },
  {
    version: "1.4.0",
    dateAr: "5 أغسطس 2026",
    dateEn: "August 5, 2026",
    ar: [
      "هدف التنفيذ صار يُحسب من التقويم مباشرة ويتقدّم شهريًا بنفسه — للمشروع كاملًا ولكل مرحلة وكل بلوك — سواء وصلت قراءة المطور الشهرية أو لا",
      "الخطة المعتمدة: ٣٫١٢٥ نقطة شهريًا، أي ١٠٠٪ خلال ٣٢ شهرًا حتى ديسمبر ٢٠٢٧، وهي مطابقة تمامًا للأهداف المسجَّلة سابقًا",
      "إضافة لوحة \u200f\"هدف هذا الشهر\"\u200f تعرض هدف الشهر الجاري وآخر قراءة وصلت من المطور والفارق بينهما",
      "الأشهر التي لم تصل قراءتها تظهر باهتة في شريط الأشهر، بهدف محسوب وإنجاز فارغ بدل ترحيل أرقام قديمة",
      "عناوين الفترات والسنوات صارت تُحسب تلقائيًا بدل كتابتها يدويًا، والرسم الزمني يعرض آخر ١٢ شهرًا كحد أقصى",
    ],
    en: [
      "The execution target is now derived from the calendar and advances monthly on its own — for the whole project, each phase and each block — whether or not the developer's monthly reading has arrived",
      "Approved plan: 3.125 points per month, i.e. 100% over 32 months through December 2027, matching the previously recorded targets exactly",
      "Added a \"This month's target\" panel showing the current month's target, the latest reading received from the developer, and the difference between them",
      "Months with no reading yet appear faded in the month bar, with a computed target and empty progress instead of carrying old figures forward",
      "Period and year labels are now computed automatically instead of being written by hand, and the timeline chart shows at most the last 12 months",
    ],
  },
  {
    version: "1.3.0",
    dateAr: "5 أغسطس 2026",
    dateEn: "August 5, 2026",
    ar: [
      "إضافة زر \u200f\"سطح المكتب\"\u200f في رأس الصفحة يحوّل الصفحة كاملة إلى عرض متصفح مكتبي — نفس مبدأ \u200f\"طلب موقع الكمبيوتر\"\u200f في المتصفح",
      "عند تفعيله تُرسم الصفحة بعرض 1180 بكسل وتُصغَّر لتناسب الشاشة، ويمكن التقريب بالأصبعين، وتتحوّل النتائج تلقائيًا إلى عرض الجدول",
      "الزر يتحوّل إلى \u200f\"عرض الجوال\"\u200f للرجوع، ولا يظهر إطلاقًا على الأجهزة التي عرضها الفعلي 1024 بكسل فأكثر لعدم الحاجة له",
    ],
    en: [
      "Added a \"Desktop\" button in the page header that switches the whole page to a desktop browser layout — the same idea as \"Request Desktop Website\" in a browser",
      "When active the page is laid out at 1180px and scaled to fit the screen, pinch-to-zoom works, and results switch to table view automatically",
      "The button becomes \"Mobile view\" to switch back, and never appears on devices whose actual screen is 1024px or wider, where it serves no purpose",
    ],
  },
  {
    version: "1.2.0",
    dateAr: "5 أغسطس 2026",
    dateEn: "August 5, 2026",
    ar: [
      "إضافة زر تبديل شكل عرض النتائج (بطاقات / جدول) في نهاية سطر \u200f\"النتائج\"\u200f داخل خانة متابعة الملاحظات",
      "الزر متاح على كل الأجهزة: الافتراضي بطاقات على الجوال وجدول على الشاشات 1024 بكسل فأكثر، ومن يريد وضع سطح المكتب على جواله يختاره بنفسه ويبقى مثبتًا",
      "في عرض الجدول على الشاشات الصغيرة يتم التمرير أفقيًا داخل إطار الجدول وحده دون تصغير الصفحة",
    ],
    en: [
      "Added a results layout toggle (cards / table) at the end of the \"Results\" line inside the Notes Board tab",
      "Available on every device: cards by default on phones and table on screens 1024px and wider, and anyone who wants the desktop layout on their phone can select it and it stays selected",
      "On small screens the table scrolls horizontally inside its own frame without shrinking the page",
    ],
  },
  {
    version: "1.1.2",
    dateAr: "29 يوليو 2026",
    dateEn: "July 29, 2026",
    ar: ["حذف عدّاد \u200f\"ملاحظة\"\u200f وعدّاد \u200f\"مهندسين\"\u200f من شريط المعلومات أعلى الصفحة، واستبدال عدّاد النماذج بذكر أسماء النماذج نفسها"],
    en: ["Removed the \"notes\" and \"engineers\" counts from the top info bar, and replaced the models count with the actual model names"],
  },
  {
    version: "1.1.1",
    dateAr: "29 يوليو 2026",
    dateEn: "July 29, 2026",
    ar: ["حذف زر الطباعة من رأس الصفحة لعدم وجود فائدة منه"],
    en: ["Removed the Print button from the header as it served no purpose"],
  },
  {
    version: "1.1.0",
    dateAr: "29 يوليو 2026",
    dateEn: "July 29, 2026",
    ar: [
      "إضافة زر تبديل اللغة (ع/EN) داخل نافذة الإقرار القانوني",
      "حذف ملاحظة \u200f\"لم يُنشر تحديث بعد\"\u200f غير المفيدة من الصفحة الرئيسية وخانة تقدم التنفيذ",
      "تصحيح عرض السنة والأرقام عند التبديل للغة الإنجليزية في خانة تقدم التنفيذ",
      "تصحيح موقع خط الهدف داخل أشرطة تقدم التنفيذ ليطابق اتجاه الصفحة بالإنجليزية",
      "تبسيط رأس الصفحة وتذييلها بحذف نصوص لا تضيف فائدة",
      "إضافة رقم إصدار اللوحة وسجل التحديثات (هذه النافذة)",
    ],
    en: [
      "Added a language toggle (ع/EN) inside the legal disclaimer window",
      "Removed the unhelpful \"no update published yet\" notice from the main page and the Progress tab",
      "Fixed year and number rendering when switching to English on the Progress tab",
      "Fixed the target-line position inside progress bars to match page direction in English",
      "Simplified the page header and footer by removing text that added no value",
      "Added a dashboard version number and update log (this window)",
    ],
  },
  {
    version: "1.0.0",
    dateAr: "—",
    dateEn: "—",
    ar: [
      "الإصدار الأساسي للوحة: النظرة العامة، متابعة الملاحظات، تقدم التنفيذ، المخطط التفاعلي للفيلا، الوضع الفاتح/الداكن، ثنائية اللغة الكاملة",
    ],
    en: [
      "Baseline release: Overview, Notes Board, Progress, the interactive villa plan, light/dark mode, and full bilingual support",
    ],
  },
];
const CURRENT_VERSION = CHANGELOG[0].version;

/* ── إقرار قانوني — يظهر في كل زيارة، بدون تذكّر الموافقة ── */
const LEGAL_COPY = {
  ar: {
    eyebrow: "قبل ما تكمل",
    title: "تنويه وإخلاء مسؤولية قانونية",
    points: [
      ["طبيعة المنصة", "هذه اللوحة هي مبادرة واجتهاد شخصي وودّي من ممثلي الملاك، ولا تُعد منصة رسمية أو متحدثًا رسميًا باسم أي جهة حكومية، خريطة طريق، أو الشركة المطوّرة."],
      ["طبيعة البيانات", "كافة المعلومات والإحصائيات الواردة هي بيانات استرشادية منقولة كما هي من المطوّر العقاري أو من استبيانات الملاك، دون أدنى مسؤولية عن دقتها أو صحتها أو أي تغييرات قد تطرأ عليها مستقبلًا من قِبل المطوّر."],
      ["نفي الصفة والمسؤولية", "لا يتحمّل ممثلو الملاك أي مسؤولية قانونية أو مالية أو إدارية ناتجة عن استخدام هذه البيانات، أو بناء أي قرارات عليها، أو عن أي ردود فعل أو إجراءات قد تتخذها أي جهة أو مطوّر تجاه ما يُنقل من مطالب أو استفسارات."],
    ],
    consent: "بالضغط على «أوافق»، فأنت تقرّ بعلمك التام بجميع ما ورد أعلاه وتوافق على إخلاء مسؤولية القائمين على اللوحة تمامًا.",
    agree: "أوافق",
  },
  en: {
    eyebrow: "Before you continue",
    title: "Legal Notice & Disclaimer",
    points: [
      ["Nature of the Platform", "This dashboard is a personal, voluntary initiative by owner representatives. It is not an official platform or spokesperson on behalf of any government entity, project roadmap, or the developer company."],
      ["Nature of the Data", "All information and statistics shown are indicative data, transferred as-is from the real estate developer or from owner surveys, with no responsibility for their accuracy, correctness, or any future changes made by the developer."],
      ["Disclaimer of Role & Liability", "Owner representatives bear no legal, financial, or administrative liability arising from use of this data, decisions made based on it, or any response or action taken by any party or developer regarding demands or inquiries conveyed."],
    ],
    consent: "By clicking \u201cI Agree,\u201d you acknowledge full awareness of the above and agree to fully release the dashboard administrators from liability.",
    agree: "I Agree",
  },
};

/* ── ١١. الإقرار القانوني ولوحة سجل التحديثات ── */
function LegalDisclaimer({ onAgree: onAgreeParent }) {
  const { T } = useT();
  const { lang } = useLang();
  const [agreed, setAgreed] = useState(false);
  if (agreed) return null;
  const c = LEGAL_COPY[lang];
  const onAgree = () => { setAgreed(true); onAgreeParent?.(); };
  return (
    <div className="ovl" style={{ zIndex: 90 }}>
      <div className="sheet" style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <div className="sheet-top" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-2">
            <span style={{
              width: 36, height: 36, borderRadius: 11, background: T.brass + "14",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            }}>
              <ShieldAlert size={17} color={T.brass} />
            </span>
            <div>
              <div className="eyebrow">{c.eyebrow}</div>
              <div className="sec-t" style={{ marginTop: 2 }}>{c.title}</div>
            </div>
          </div>
          <LangToggle />
        </div>
        <div className="sheet-body">
          {c.points.map(([label, body], i) => (
            <div key={i} style={{ marginBottom: i < c.points.length - 1 ? 18 : 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.paper, marginBottom: 5 }}>{label}</div>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: T.muted, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: "18px 19px 22px", borderTop: `1px solid ${T.line}`, background: T.sunken }}>
          <p style={{ fontSize: 11.5, lineHeight: 1.8, color: T.faint, margin: "0 0 14px" }}>{c.consent}</p>
          <button onClick={onAgree} className="big-btn" style={{ marginTop: 0 }}>{c.agree}</button>
        </div>
      </div>
    </div>
  );
}

function ChangelogSheet({ open, onClose }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  useBackClose(open, onClose);
  if (!open) return null;
  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <div className="sheet-top">
          <div className="flex items-center gap-2">
            <span style={{
              width: 36, height: 36, borderRadius: 11, background: T.brass + "14",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            }}>
              <History size={17} color={T.brass} />
            </span>
            <div className="sec-t">{L("سجل إصدارات الموقع", "Site Update Log")}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={L("إغلاق", "Close")}><X size={16} /></button>
        </div>
        <div className="sheet-body">
          {CHANGELOG.map((entry, i) => (
            <div key={i} style={{ marginBottom: i < CHANGELOG.length - 1 ? 22 : 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: T.brass }}>v{entry.version}</span>
                <span className="mono" style={{ fontSize: 12, color: T.muted }}>
                  {lang === "en" ? entry.dateEn : entry.dateAr}
                </span>
              </div>
              <ul style={{
                margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.9, color: T.paper,
              }}>
                {(lang === "en" ? entry.en : entry.ar).map((line, j) => (<li key={j}>{line}</li>))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── عارض المخططات — ملء الشاشة، تكبير بالإصبعين/نقرتين، تنقّل بين الصفحات ── */
function DocViewerSheet({ doc, onClose }) {
  const { resolved } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const stageRef = useRef(null);
  const chipsRef = useRef(null);
  const natRef = useRef({ w: 4, h: 3 });
  const ptrs = useRef(new Map());
  const ges = useRef(null);
  const lastTap = useRef(0);
  useBackClose(!!doc, onClose);

  useEffect(() => {
    if (!doc) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [doc]);

  const docId = doc ? doc.id : null;
  const pages = doc ? doc.pages : [];
  const page = pages[idx] || null;

  useEffect(() => { setIdx(0); }, [docId]);
  useEffect(() => { setZ({ s: 1, x: 0, y: 0 }); setLoaded(false); }, [docId, idx]);

  useEffect(() => {
    if (!docId || !pages[idx]) return;
    logEvent("nav", "doc_page", `${docId}:${idx + 1}`, null);
    [idx - 1, idx + 1].forEach((i) => {
      if (i >= 0 && i < pages.length) { const im = new window.Image(); im.src = DOC_BASE + pages[i].f; }
    });
    const el = chipsRef.current && chipsRef.current.querySelector(".dvw-chip.on");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [docId, idx]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(pages.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    if (doc) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, pages.length]);

  if (!doc || !page) return null;

  const box = () => {
    const el = stageRef.current;
    const cw = el ? el.clientWidth : 1, ch = el ? el.clientHeight : 1;
    const n = natRef.current;
    const k = Math.min(cw / n.w, ch / n.h);
    return { w: n.w * k, h: n.h * k, cw, ch };
  };
  const clamp = (st) => {
    const b = box();
    const mx = Math.max(0, (b.w * st.s - b.cw) / 2);
    const my = Math.max(0, (b.h * st.s - b.ch) / 2);
    return { s: st.s, x: Math.min(mx, Math.max(-mx, st.x)), y: Math.min(my, Math.max(-my, st.y)) };
  };
  const rel = (e) => {
    const el = stageRef.current; if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };
  const zoomAt = (p, target) => {
    if (target <= 1) return setZ({ s: 1, x: 0, y: 0 });
    const u = { x: (p.x - z.x) / z.s, y: (p.y - z.y) / z.s };
    setZ(clamp({ s: target, x: p.x - target * u.x, y: p.y - target * u.y }));
  };
  const go = (d) => setIdx((i) => Math.max(0, Math.min(pages.length - 1, i + d)));

  const onDown = (e) => {
    if (stageRef.current && stageRef.current.setPointerCapture) {
      try { stageRef.current.setPointerCapture(e.pointerId); } catch (_) {}
    }
    ptrs.current.set(e.pointerId, rel(e));
    if (ptrs.current.size === 1) {
      const p = rel(e);
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0; ges.current = null;
        zoomAt(p, z.s > 1.2 ? 1 : 2.6);
        return;
      }
      lastTap.current = now;
      ges.current = { mode: "pan", p0: p, t0: { ...z }, swipe: 0 };
    } else if (ptrs.current.size === 2) {
      const v = [...ptrs.current.values()];
      ges.current = {
        mode: "pinch",
        d0: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1,
        m0: { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 },
        t0: { ...z },
      };
    }
  };
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, rel(e));
    const g = ges.current; if (!g) return;
    if (g.mode === "pinch" && ptrs.current.size >= 2) {
      const v = [...ptrs.current.values()];
      const d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1;
      const m = { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 };
      const s = Math.min(6, Math.max(1, g.t0.s * (d / g.d0)));
      const k = s / g.t0.s;
      setZ(clamp({ s, x: m.x - k * (g.m0.x - g.t0.x), y: m.y - k * (g.m0.y - g.t0.y) }));
    } else if (g.mode === "pan") {
      const p = rel(e);
      const dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      if (g.t0.s > 1.01) setZ(clamp({ s: g.t0.s, x: g.t0.x + dx, y: g.t0.y + dy }));
      else g.swipe = dx;
    }
  };
  const onUp = (e) => {
    ptrs.current.delete(e.pointerId);
    const g = ges.current;
    if (g && g.mode === "pan" && ptrs.current.size === 0 && g.t0.s <= 1.01 && Math.abs(g.swipe) > 55) {
      go(g.swipe < 0 ? 1 : -1);
    }
    if (ptrs.current.size === 0) ges.current = null;
    else if (ptrs.current.size === 1) {
      const v = [...ptrs.current.values()];
      ges.current = { mode: "pan", p0: v[0], t0: { ...z }, swipe: 0 };
    }
  };
  const onWheel = (e) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 4) return;
    if (e.cancelable) e.preventDefault();
    zoomAt(rel(e), Math.min(6, Math.max(1, z.s * (e.deltaY < 0 ? 1.15 : 0.87))));
  };

  const zoomed = z.s > 1.01;
  const Prev = lang === "en" ? ChevronLeft : ChevronRight;
  const Next = lang === "en" ? ChevronRight : ChevronLeft;

  return (
    <div className="dvw" role="dialog" aria-modal="true">
      <div className="dvw-top">
        <button onClick={onClose} className="dvw-ico" aria-label={L("إغلاق", "Close")}><X size={17} /></button>
        <div className="dvw-title">
          <div className="dvw-name">{L(doc.nameAr, doc.nameEn)}</div>
          <div className="dvw-page">{L(page.ar, page.en)} · {idx + 1}/{pages.length}</div>
        </div>
        {zoomed && (
          <button onClick={() => setZ({ s: 1, x: 0, y: 0 })} className="dvw-ico" aria-label={L("إعادة الضبط", "Reset")}>
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      <div
        className="dvw-stage" ref={stageRef}
        onPointerDown={onDown} onPointerMove={onMove}
        onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
      >
        {!loaded && <span className="dvw-spin" />}
        <img
          key={page.f}
          className="dvw-img"
          src={DOC_BASE + page.f}
          alt={L(page.ar, page.en)}
          draggable={false}
          onLoad={(e) => {
            natRef.current = { w: e.target.naturalWidth || 4, h: e.target.naturalHeight || 3 };
            setLoaded(true);
          }}
          style={{
            transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`,
            transition: ges.current ? "none" : "transform .2s ease-out",
            opacity: loaded ? 1 : 0,
          }}
        />
      </div>

      <div className="dvw-bot">
        {pages.length > 1 && (
          <div className="dvw-nav">
            <button className="dvw-ico" onClick={() => go(-1)} disabled={idx === 0} aria-label={L("السابق", "Previous")}>
              <Prev size={16} />
            </button>
            <div className="dvw-chips" ref={chipsRef}>
              {pages.map((p, i) => (
                <button key={p.f} className={`dvw-chip${i === idx ? " on" : ""}`} onClick={() => setIdx(i)}>
                  {L(p.ar, p.en)}
                </button>
              ))}
            </div>
            <button className="dvw-ico" onClick={() => go(1)} disabled={idx === pages.length - 1} aria-label={L("التالي", "Next")}>
              <Next size={16} />
            </button>
          </div>
        )}
        <div className="dvw-foot">
          <span>{L("قرّب بإصبعين أو انقر مرتين للتكبير", "Pinch or double-tap to zoom")}</span>
          <a
            href={DOC_BASE + doc.pdf} target="_blank" rel="noopener noreferrer"
            onClick={() => logEvent("nav", "doc_open_external", doc.id, null)}
          >
            <ExternalLink size={12} /> {L("الملف الأصلي PDF", "Original PDF")}
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── ١٢. لوحة تفاصيل الاستفسار (Sheet) ── */
function Sheet({ r, navList, onJump, onClose }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const [shareCopied, setShareCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // "up" | "down" | null — محلي فقط للعرض، لا يُقرأ من القاعدة
  useBackClose(!!r, onClose);

  /* يقفل تمرير الصفحة الخلفية أثناء فتح اللوحة — يمنع تمرير الصفحة الأصلية بالتوازي مع
     تمرير محتوى اللوحة، وهو سبب ظهور شريط الأزرار العلوي (X، التنقّل) بموضع غير متزامن
     ويصعّب الوصول له على الجوال (خصوصًا سفاري) */
  useEffect(() => {
    if (!r) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [!!r]);

  const idx = r && navList ? navList.findIndex((x) => x.id === r.id) : -1;
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < (navList ? navList.length - 1 : -1);
  /* تتبع صامت: التنقّل سابق/تالي بين الاستفسارات (بالزر أو بالسحب أو بالسهم) */
  const goPrev = () => {
    if (!hasPrev) return;
    logEvent("nav", r.id, "prev", navList[idx - 1]?.id ?? null);
    onJump(navList[idx - 1]);
  };
  const goNext = () => {
    if (!hasNext) return;
    logEvent("nav", r.id, "next", navList[idx + 1]?.id ?? null);
    onJump(navList[idx + 1]);
  };

  useEffect(() => {
    if (!r) return;
    const h = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowUp") goPrev();
      else if (e.key === "ArrowDown") goNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [r, onClose, idx, navList]);
  useEffect(() => { setShareCopied(false); setFeedback(null); }, [r]);

  /* سحب أفقي فوق اللوحة للتنقّل للاستفسار السابق/التالي بنفس ترتيب القائمة المفتوحة منها */
  const touchRef = useRef(null);
  const onTouchStart = (e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0) goNext(); else goPrev();
  };

  if (!r) return null;
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?note=${r.id}`;
    const shareData = { title: L("استفسارات الملاك", "Owner Inquiries"), text: trNote(lang, r), url };
    if (navigator.share) {
      try {
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          logEvent("share", r.id, r.pri, `${r.model || ""} / ${r.zone || r.loc || ""}`);
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return; // المستخدم أغلق نافذة المشاركة — لا حاجة لأي إجراء إضافي
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      /* بيئات بدون Clipboard API (نادر) — نتجاهل بصمت، النسخ اليدوي يبقى ممكنًا من شريط العنوان */
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1650);
    logEvent("share", r.id, r.pri, `${r.model || ""} / ${r.zone || r.loc || ""}`);
  };

  /* لايك/ديسلايك — تُسجَّل بصمت في Supabase (event_type = "feedback")، بدون عرض أي عدّاد
     بالواجهة؛ تُستخرج لاحقًا عند الحاجة عبر استعلام على جدول public.logs */
  const handleFeedback = (dir) => {
    const next = feedback === dir ? null : dir; // ضغطة ثانية على نفس الاختيار تلغيه محليًا فقط
    setFeedback(next);
    if (next) logEvent("feedback", r.id, dir, `${r.model || ""} / ${r.zone || r.loc || ""}`);
  };

  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} role="dialog" aria-modal="true">
        <div className="sheet-top">
          <div className="flex items-center gap-2">
            <span className="mono sheet-id">{L("ملاحظة", "Note")} {String(r.id).padStart(2, "0")}</span>
            <span className="tag" style={{ color: T.pri[r.pri] || T.muted }}>{trPri(lang, r.pri)}</span>
            <CatPill cat={r.cat} />
            {r.isImportantActive && <span className="tag tag-important"><AlertTriangle size={9} /> {L("مهم", "Important")}</span>}
            {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {L("جديد", "New")}</span>}
          </div>
          <div className="flex items-center gap-2">
            {navList && (
              <div className="sheet-nav">
                <button onClick={goPrev} disabled={!hasPrev} className="icon-btn sheet-nav-b" aria-label={L("السابق", "Previous")}>
                  {lang === "ar" ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                </button>
                <button onClick={goNext} disabled={!hasNext} className="icon-btn sheet-nav-b" aria-label={L("التالي", "Next")}>
                  {lang === "ar" ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
                </button>
              </div>
            )}
            <button onClick={onClose} className="icon-btn" aria-label={L("إغلاق", "Close")}><X size={16} /></button>
          </div>
        </div>
        <div className="sheet-body">
          <div className="sec-lbl">{L("الملاحظة والحل المقترح", "Note & Proposed Solution")}</div>
          <p className="sheet-note">{trNote(lang, r)}</p>

          <div className="sec-lbl" style={{ marginTop: 24 }}>
            {L("الرد", "Reply")} <span style={{ color: sc }}>· {trSta(lang, r.sta)}</span>
          </div>
          <div className="reply-box" style={{ borderRightColor: sc }}>
            <p className="sheet-reply">{trReply(lang, r) || L("لا يوجد رد مسجّل.", "No reply recorded yet.")}</p>
          </div>

          <div className="meta-list">
            {[[Tag, L("الفئة", "Category"), r.cat ? trCat(lang, r.cat) : L("غير مصنّف", "Uncategorized")],
              [Layers, L("الموقع", "Location"), trLoc(lang, r.loc)], [Home, L("النموذج", "Model"), trScope(lang, r.model)], [User, L("صاحب الرد", "Engineer"), trOwn(lang, r.owner)],
              [Calendar, L("شهر الرد", "Reply Month"), trMonth(lang, r.month)], [Ruler, L("حالة الإغلاق", "Closure Status"), r.closed ? L("مقفل", "Closed") : L("مفتوح", "Open")],
              [Droplet, L("حالة الرد", "Reply Status"), r.answered ? L("تم الرد", "Replied") : L("بانتظار الرد", "Awaiting reply")]].map(([Ic, k, v]) => (
              <div key={k} className="meta-row">
                <span className="meta-k"><Ic size={12} /> {k}</span>
                <span className="meta-v">{v}</span>
              </div>
            ))}
          </div>

          <div className="sheet-fb-row">
            <button
              className="fb-btn fb-up"
              data-on={feedback === "up" ? "1" : "0"}
              onClick={() => handleFeedback("up")}
              aria-pressed={feedback === "up"}
              aria-label={L("مفيد", "Helpful")}
            >
              <ThumbsUp size={19} strokeWidth={2.3} />
            </button>
            <button
              className="fb-btn fb-down"
              data-on={feedback === "down" ? "1" : "0"}
              onClick={() => handleFeedback("down")}
              aria-pressed={feedback === "down"}
              aria-label={L("غير مفيد", "Not helpful")}
            >
              <ThumbsDown size={19} strokeWidth={2.3} />
            </button>

            <button className="wide-btn share-host" style={{ margin: 0, flex: 1 }} onClick={handleShare}>
              <Share2 size={14} /> {L("مشاركة الاستفسار", "Share Inquiry")}
              {shareCopied && (
                <span className="copy-ok show">
                  <Check size={13} /> {L("تم نسخ الرابط", "Link copied")}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ١٣. تبويب تقدّم التنفيذ (ProgressTab) ── */
/* ── حلقات المراحل — ملخص بصري سريع، ترتسم تدريجيًا عند دخولها الشاشة ── */
function PhaseRings({ phases, mi, tgt, ahead, behind, muted, sunken, lang }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.3);
  const draw = reduced || inView;
  const R = 26, C = 2 * Math.PI * R;
  return (
    <div className="rings" ref={ref}>
      {phases.map((p) => {
        const v = p.v[mi];
        const g = v == null || tgt == null ? null : v - tgt;
        const col = g == null ? muted : g >= 0 ? ahead : behind;
        const pct = v == null ? 0 : Math.max(0, Math.min(100, v));
        return (
          <div key={p.key} className="ring-i">
            <svg width="62" height="62" viewBox="0 0 62 62" className="ring-s">
              <circle cx="31" cy="31" r={R} fill="none" strokeWidth="6" stroke={sunken} />
              <circle cx="31" cy="31" r={R} fill="none" strokeWidth="6" stroke={col} strokeLinecap="round"
                className="ring-fg" strokeDasharray={C}
                strokeDashoffset={draw ? C * (1 - pct / 100) : C} />
              <text x="31" y="31" textAnchor="middle" dominantBaseline="central"
                fontSize="12.5" fill={col} className="mono" transform="rotate(90 31 31)">
                {v == null ? "—" : Math.round(v)}
              </text>
            </svg>
            <div className="ring-l">{trPGLabel(lang, p.label)}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressTab({ reduced, data, loading }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const D = useMemo(() => extendPlan(data, new Date()), [data]);
  const MONTHS = D.months, TARGET = D.target, PHASES = D.phases, BLOCKS = D.blocks, NOTE = D.note;
  const YEARS = D.years, ADDED = D.added || 0;
  const PHASE_NAME = data.phaseName || (lang === "en" ? PG_PHASE_NAME_EN : PG_PHASE_NAME);
  const last = MONTHS.length - 1;

  const ahead = T.sta["معتمدة"], behind = T.sta["تم الرفض"];
  const total = PHASES.find((p) => p.key === "total") || { v: MONTHS.map(() => null) };

  /* آخر شهر وصلت فيه قراءة فعلية من المطور */
  const lastData = useMemo(() => {
    for (let i = total.v.length - 1; i >= 0; i--) if (total.v[i] != null) return i;
    return -1;
  }, [total]);

  const [mi, setMi] = useState(lastData >= 0 ? lastData : last);
  useEffect(() => { setMi(lastData >= 0 ? lastData : MONTHS.length - 1); }, [lastData, MONTHS.length]);

  const yearOf = (i) => (YEARS ? YEARS[i] : null);
  const multiYear = YEARS ? new Set(YEARS).size > 1 : false;
  const mLabel = (i) => trPGMonth(lang, MONTHS[i]) + (multiYear ? ` ${trYear(lang, yearOf(i))}` : "");
  const mFull = (i) => `${trPGMonth(lang, MONTHS[i])} ${trYear(lang, yearOf(i))}`.trim();

  const cur = total.v[mi], tgt = TARGET[mi];
  const hasCur = cur != null && tgt != null;
  const gap = hasCur ? +(cur - tgt).toFixed(2) : null;
  const gapColor = gap == null ? T.muted : gap >= 0 ? ahead : behind;
  const scale = 60; /* أقصى نسبة على مقياس الأشرطة — يمنح الأشرطة مدى مقروءًا */

  /* هدف الشهر الحالي مقابل آخر قراءة وصلت */
  const nowGap = (ADDED > 0 && lastData >= 0 && TARGET[last] != null)
    ? +(total.v[lastData] - TARGET[last]).toFixed(2) : null;

  /* الرسم يعرض آخر ١٢ شهرًا كحد أقصى حتى لا تتراكم التسميات مع مرور الوقت */
  const chartFrom = Math.max(0, MONTHS.length - 12);
  const trend = useMemo(() => MONTHS.slice(chartFrom).map((m, k) => {
    const i = chartFrom + k;
    return {
      m: mLabel(i), "الإنجاز": total.v[i], "الهدف": TARGET[i],
      "الفجوة": total.v[i] == null || TARGET[i] == null ? null : +(total.v[i] - TARGET[i]).toFixed(2),
    };
  }), [total, MONTHS, TARGET, YEARS, lang, chartFrom]);

  const delta = (v, i) => (i === 0 || v[i] == null || v[i - 1] == null ? null : +(v[i] - v[i - 1]).toFixed(2));
  const dColor = (d) => (d === null ? T.muted : d > 0.05 ? ahead : d < -0.05 ? behind : T.muted);
  const dText = (d) => (d === null ? "—" : d > 0.05 ? `+${d.toFixed(2)}` : d < -0.05 ? d.toFixed(2) : L("متوقف", "Stalled"));

  const blocks = useMemo(() =>
    [...BLOCKS].sort((a, b) => (b.v[mi] == null ? -1 : b.v[mi]) - (a.v[mi] == null ? -1 : a.v[mi])), [mi, BLOCKS]);

  const stalled = blocks.filter((r) => mi > 0 && r.v[mi] != null && r.v[mi - 1] != null && Math.abs(r.v[mi] - r.v[mi - 1]) < 0.2);
  const grouped = ["p1", "p2", "p3", "p4", "p_unassigned"].map((k) => ({ k, rows: blocks.filter((r) => r.ph === k) }));

  const Bar = ({ val, color, target }) => {
    const [ref, inView] = useInView(0.35);
    const show = reduced || inView; /* بدون حركة النظام: يظهر مباشرة بدون انتظار السكرول */
    const w = val != null ? `${Math.min(100, (val / scale) * 100)}%` : "0%";
    return (
      <div className="gbar" ref={ref}>
        {val != null && (
          <div className={`gbar-f${!reduced && inView ? " in-view" : ""}`}
            style={{ width: show ? w : "0%", background: color }} />
        )}
        {target != null && (
          <span className="gbar-t" style={{
            [lang === "en" ? "left" : "right"]: `${Math.min(100, (target / scale) * 100)}%`,
            background: T.paper,
          }} />
        )}
      </div>
    );
  };

  return (
    <>
      {loading ? (
        <div className="skel skel-line" style={{ width: 210, height: 14, marginBottom: 16 }} />
      ) : data.updatedAt ? (
        <div className="stamp" style={{ marginBottom: 14 }}>
          <RefreshCw size={13} />
          {L("آخر تحديث:", "Last updated:")} <span className="mono">{fmtDate(data.updatedAt)}</span>{data.label ? ` — ${data.label}` : ""}
        </div>
      ) : null}

      {/* الحالة العامة مقابل الهدف */}
      <section className="surf" style={{ padding: "22px 20px", marginBottom: 14 }}>
        <div className="stats-top">
          <div>
            <div className="sec-t">{L("تقدم المشروع مقابل الهدف", "Project Progress vs. Target")}</div>
            <div className="eyebrow" style={{ marginTop: 4 }}>{L("متوسط الإنجاز لكل البلوكات", "Average completion across all blocks")} · {mFull(mi)}</div>
          </div>
          <div className="hero">
            <span className="hero-n mono">{hasCur ? `${cur.toFixed(2)}٪` : "—"}</span>
          </div>
        </div>

        <Bar val={cur} color={gapColor} target={tgt} />

        <div className="gmeta">
          <span className="gm"><span className="gm-k">{L("الهدف", "Target")}</span> <span className="mono">{tgt != null ? `${tgt.toFixed(2)}٪` : "—"}</span></span>
          {hasCur ? (
            <>
              <span className="dot" />
              <span className="gm" style={{ color: gapColor }}>
                {gap >= 0 ? L("متقدّم", "Ahead") : L("متأخّر", "Behind")} <span className="mono">{Math.abs(gap).toFixed(2)}</span> {L("نقطة", "pts")}
              </span>
              <span className="dot" />
              <span className="gm"><span className="gm-k">{L("التغيّر عن الشهر السابق", "Change vs. previous month")}</span>{" "}
                <span className="mono" style={{ color: dColor(delta(total.v, mi)) }}>{dText(delta(total.v, mi))}</span>
              </span>
            </>
          ) : (
            <>
              <span className="dot" />
              <span className="gm" style={{ color: T.muted }}>{L("بانتظار قراءة المطور لهذا الشهر", "Awaiting the developer's reading for this month")}</span>
            </>
          )}
        </div>

        {ADDED > 0 && lastData >= 0 && TARGET[last] != null && (
          <div className="note-box plan-now" style={{ marginTop: 14 }}>
            <div style={{ color: T.paper }}>
              {L("هدف هذا الشهر", "This month's target")} — {mFull(last)}: <span className="mono" style={{ color: T.brass }}>{TARGET[last].toFixed(2)}٪</span>
            </div>
            <div style={{ marginTop: 6 }}>
              {L("آخر قراءة وصلت من المطور:", "Latest reading received from the developer:")} {mFull(lastData)}{" "}
              <span className="mono">{total.v[lastData].toFixed(2)}٪</span>
              {nowGap != null && (
                <> — {L("الفارق عن هدف هذا الشهر", "difference from this month's target")}{" "}
                  <span className="mono" style={{ color: nowGap >= 0 ? ahead : behind }}>
                    {nowGap >= 0 ? `+${nowGap.toFixed(2)}` : nowGap.toFixed(2)}
                  </span> {L("نقطة", "pts")}</>
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              {L("الهدف خطة خطّية ثابتة ٣٫١٢٥ نقطة شهريًا (١٠٠٪ خلال ٣٢ شهرًا حتى ديسمبر ٢٠٢٧)، ويتقدّم تلقائيًا مع التقويم سواء وصلت قراءة المطور أو لا. الإنجاز الفعلي يبقى فارغًا حتى تصل القراءة.",
                 "The target is a fixed linear plan of 3.125 points per month (100% over 32 months, through December 2027) and advances automatically with the calendar whether or not the developer's reading has arrived. Actual progress stays empty until the reading arrives.")}
            </div>
          </div>
        )}

        {(() => {
          const idx = MONTHS.map((_, i) => i).filter((i) => total.v[i] != null && TARGET[i] != null);
          if (idx.length < 2) return null;
          const i0 = idx[0], i1 = idx[idx.length - 1], span = idx.length - 1;
          const g0 = +(total.v[i0] - TARGET[i0]).toFixed(2);
          const g1 = +(total.v[i1] - TARGET[i1]).toFixed(2);
          const targetStep = (TARGET[i1] - TARGET[i0]) / span;
          const actualStep = (total.v[i1] - total.v[i0]) / span;
          const crossAt = idx.find((i) => total.v[i] - TARGET[i] < 0);
          return (
            <div className="note-box" style={{ marginTop: 16 }}>
              {L("الفجوة عن الهدف", "The gap to target")} {g1 <= g0 ? L("تتقلّص", "is narrowing") : L("تتّسع", "is widening")} {span > 0 ? L("شهرًا بعد شهر", "month over month") : ""}{L(": من", ": from")}{" "}
              <span className="mono" style={{ color: g0 >= 0 ? ahead : behind }}>{g0 >= 0 ? `+${g0.toFixed(2)}` : g0.toFixed(2)}</span>{" "}
              {L("في", "in")} {mFull(i0)} {L("إلى", "to")} <span className="mono" style={{ color: g1 >= 0 ? ahead : behind }}>{g1 >= 0 ? `+${g1.toFixed(2)}` : g1.toFixed(2)}</span>{" "}
              {L("في", "in")} {mFull(i1)}
              {crossAt != null && crossAt > i0 ? L(` — أول شهر يقع فيه المشروع خلف الهدف هو ${mFull(crossAt)}.`, ` — the first month the project fell behind target was ${mFull(crossAt)}.`) : "."}{" "}
              {L("الهدف يتطلّب تقدّمًا بنحو", "The target requires progress of about")} <span className="mono">{targetStep.toFixed(2)}</span> {L("نقطة شهريًا،", "points/month,")}
              {" "}{L("والمتحقّق فعليًا نحو", "while actual progress is about")} <span className="mono">{actualStep.toFixed(2)}</span>.
            </div>
          );
        })()}
      </section>

      {/* المسار الزمني */}
      <section className="surf" style={{ padding: "20px 16px 14px", marginBottom: 14 }}>
        <div style={{ paddingRight: 4 }}>
          <div className="sec-t">{L("المسار الزمني", "Timeline")}</div>
          <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>
            {L("الإنجاز مقابل الهدف", "Progress vs. target")} · {mFull(chartFrom)} — {mFull(last)}
          </div>
        </div>
        <div style={{ height: 230, width: "100%" }}>
          <ResponsiveContainer>
            <ComposedChart data={trend} margin={{ top: 6, right: 4, left: -20, bottom: 4 }}>
              <CartesianGrid stroke={T.lineSoft} vertical={false} />
              <XAxis dataKey="m" reversed={lang === "ar"} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false}
                interval="preserveStartEnd" minTickGap={12} />
              <YAxis orientation="right" domain={[20, 60]} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={36}
                tickFormatter={(v) => `${v}٪`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: T.brass + "12" }} />
              <Line type="monotone" dataKey="الهدف" name={L("الهدف", "Target")} stroke={T.muted} strokeWidth={2} strokeDasharray="5 4"
                dot={{ r: 2.5, fill: T.surface, stroke: T.muted, strokeWidth: 2 }} isAnimationActive={!reduced} />
              <Line type="monotone" dataKey="الإنجاز" name={L("الإنجاز", "Progress")} stroke={T.brass} strokeWidth={2.6}
                dot={{ r: 3.5, fill: T.surface, stroke: T.brass, strokeWidth: 2 }} isAnimationActive={!reduced} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 16, padding: "4px 4px 0" }}>
          <span className="flex items-center" style={{ gap: 7, fontSize: 11.5, color: T.muted }}>
            <span style={{ width: 14, height: 2.6, background: T.brass, display: "inline-block", borderRadius: 2 }} /> {L("الإنجاز الفعلي", "Actual progress")}
          </span>
          <span className="flex items-center" style={{ gap: 7, fontSize: 11.5, color: T.muted }}>
            <span style={{ width: 14, height: 0, borderTop: `2px dashed ${T.muted}`, display: "inline-block" }} /> {L("الهدف المخطَّط", "Planned target")}
          </span>
        </div>
      </section>

      {/* المراحل */}
      <section className="surf" style={{ padding: "20px 18px", marginBottom: 14 }}>
        <div className="sec-t">{L("المراحل", "Phases")}</div>
        <div className="eyebrow" style={{ marginTop: 4, marginBottom: 16 }}>
          {L("مقابل هدف", "Against")} {mFull(mi)} {L("", "target")} <span className="mono">{tgt != null ? `${tgt.toFixed(2)}٪` : "—"}</span> — {L("الخط الرأسي يمثّل الهدف", "the vertical line marks the target")}
        </div>
        <PhaseRings phases={PHASES.filter((p) => p.key !== "total")} mi={mi} tgt={tgt}
          ahead={ahead} behind={behind} muted={T.muted} sunken={T.sunken} lang={lang} />
        {PHASES.filter((p) => p.key !== "total").map((p) => {
          const v = p.v[mi];
          const g = v == null || tgt == null ? null : +(v - tgt).toFixed(2);
          const d = delta(p.v, mi);
          const col = g == null ? T.muted : g >= 0 ? ahead : behind;
          return (
            <div key={p.key} className="grow">
              <div className="grow-top">
                <span className="grow-l">{trPGLabel(lang, p.label)} <span className="grow-note">{trPGPNote(lang, p.note)}</span></span>
                <span className="grow-r">
                  <span className="mono grow-v">{v == null ? "—" : `${v.toFixed(2)}٪`}</span>
                  <span className="mono grow-g" style={{ color: col }}>{g == null ? "—" : g >= 0 ? `+${g.toFixed(2)}` : g.toFixed(2)}</span>
                </span>
              </div>
              <Bar val={v} color={col} target={tgt} />
              <div className="grow-d">{L("التغيّر عن الشهر السابق", "Change vs. previous month")} <span className="mono" style={{ color: dColor(d) }}>{dText(d)}</span></div>
            </div>
          );
        })}
      </section>

      {/* البلوكات */}
      <section className="surf" style={{ padding: "20px 18px" }}>
        <div className="gb-head">
          <div>
            <div className="sec-t">{L("البلوكات", "Blocks")}</div>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              <span className="mono">{BLOCKS.length}</span> {L("بلوك · مرتّبة من الأعلى إنجازًا", "blocks · sorted by highest progress")}
            </div>
          </div>
          <div className="mseg no-print">
            {MONTHS.map((m, i) => {
              const empty = total.v[i] == null;
              return (
                <button key={`${m}-${i}`} className="mseg-b" data-on={mi === i ? "1" : "0"} onClick={() => setMi(i)}
                  title={empty ? L("بانتظار بيانات المطور", "Awaiting developer data") : undefined}
                  style={{
                    ...(mi === i ? { background: T.brass, color: T.onAccent } : null),
                    ...(empty && mi !== i ? { opacity: 0.5 } : null),
                  }}>{mLabel(i)}</button>
              );
            })}
          </div>
        </div>

        {ADDED > 0 && (
          <div className="eyebrow" style={{ marginTop: 10 }}>
            {L("الأشهر الباهتة لم تصل قراءتها بعد — الهدف فيها محسوب من الخطة والإنجاز بانتظار المطور.",
               "Faded months have no reading yet — their target comes from the plan and actual progress awaits the developer.")}
          </div>
        )}

        {mi > 0 && stalled.length > 0 && (
          <div className="note-box" style={{ marginTop: 14, marginBottom: 4 }}>
            {L("لم تتحرّك في", "No movement in")} {mFull(mi)}:{" "}
            <span style={{ color: T.paper }}>{stalled.map((r) => `${L("بلوك", "Block")} ${r.b}`).join(" · ")}</span>
          </div>
        )}

        {grouped.map(({ k, rows }) => rows.length > 0 && (
          <div key={k} className="gb-group">
            <div className="gb-gt">{PHASE_NAME[k] || k}</div>
            {rows.map((r) => {
              const v = r.v[mi], d = delta(r.v, mi);
              const g = v == null || tgt == null ? null : v - tgt;
              return (
                <div key={r.b} className="brow">
                  <span className="brow-b mono">{r.b}</span>
                  <div className="brow-bar">
                    <Bar val={v} color={g == null ? T.muted : g >= 0 ? ahead : behind} target={tgt} />
                  </div>
                  <span className="brow-v mono">{v == null ? "—" : `${v.toFixed(2)}٪`}</span>
                  <span className="brow-d mono" style={{ color: dColor(d) }}>{dText(d)}</span>
                </div>
              );
            })}
          </div>
        ))}

        {NOTE && <div className="note-box" style={{ marginTop: 16 }}>{lang === "en" && NOTE === PG_NOTE ? PG_NOTE_EN : NOTE}</div>}
        {(() => {
          const drops = BLOCKS.map((r) => {
            let worst = null;
            for (let i = 1; i < r.v.length; i++) {
              if (r.v[i] == null || r.v[i - 1] == null) continue;
              const d = r.v[i] - r.v[i - 1];
              if (d < -1 && (!worst || d < worst.d)) worst = { i, d };
            }
            return worst ? { b: r.b, from: r.v[worst.i - 1], to: r.v[worst.i], m0: worst.i - 1, m1: worst.i, d: worst.d } : null;
          }).filter(Boolean);
          if (!drops.length) return null;
          return (
            <div className="note-box" style={{ marginTop: 8 }}>
              {drops.map((r) => (
                <div key={r.b}>
                  {L("بلوك", "Block")} {r.b} {L("سجّل تراجعًا من", "recorded a drop from")} <span className="mono">{r.from.toFixed(2)}٪</span> {L("في", "in")} {mFull(r.m0)}{" "}
                  {L("إلى", "to")} <span className="mono">{r.to.toFixed(2)}٪</span> {L("في", "in")} {mFull(r.m1)} — {L("يُرجَّح أنه تصحيح لقياس سابق، وليس تراجعًا فعليًا في التنفيذ.", "likely a correction of an earlier reading, not an actual execution setback.")}
                </div>
              ))}
            </div>
          );
        })()}
      </section>
    </>
  );
}

/* ── ١٤. المكوّن الرئيسي (Dashboard) — التجميع والعرض النهائي ── */
const EMPTY_F = { q: "", zone: null, pri: null, cat: null, sta: null, model: null, own: null, mon: null, meeting: null, open: false, fresh: false, important: false, urgent: false };

/* ── معرّف جهاز ثابت — لمنع التصويت المتكرر على نفس الإشعار ── */
function getDeviceId() {
  try {
    let id = localStorage.getItem("alborada_device_id");
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem("alborada_device_id", id); }
    return id;
  } catch { return "anon"; }
}

/* ── نافذة الإشعارات المنبثقة — تظهر مرة عند دخول الموقع (بعد الإقرار القانوني)
   بدل الشريط الثابت أعلى الصفحة، بنفس أسلوب نافذة "الإقرار القانوني". يبقى فيها
   خروج عادي وواضح: زر X بالأعلى، زر "إغلاق" بالأسفل، أو النقر خارج النافذة ── */
function NoticesModal({ enabled }) {
  const { T } = useT();
  const { lang } = useLang();
  const [notices, setNotices] = useState([]);
  const [voted, setVoted] = useState({});
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    supabase.from("notices").select("*").order("created_at", { ascending: false }).then(({ data }) => setNotices(data || []));
  }, []);
  useEffect(() => {
    if (!notices.length) return;
    supabase.from("notice_votes").select("notice_id").eq("device_id", getDeviceId()).then(({ data }) => {
      const v = {}; (data || []).forEach((r) => { v[r.notice_id] = true; }); setVoted(v);
    });
  }, [notices]);

  const vote = async (n) => {
    const { error } = await supabase.from("notice_votes").insert({ notice_id: n.id, device_id: getDeviceId() });
    if (!error) setVoted((v) => ({ ...v, [n.id]: true }));
    else if (String(error.code) === "23505") setVoted((v) => ({ ...v, [n.id]: true })); // صوّت من قبل بنفس الجهاز
  };

  const onClose = () => setClosed(true);
  useBackClose(enabled && !closed && notices.length > 0, onClose);

  if (!enabled || closed || !notices.length) return null;
  return (
    <div className="ovl no-print" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <div className="sheet-top">
          <div className="flex items-center gap-2">
            <span style={{ width: 36, height: 36, borderRadius: 11, background: T.brass + "14", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Sparkles size={17} color={T.brass} />
            </span>
            <div className="sec-t">{lang === "en" ? "Notices" : "الإشعارات"}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={lang === "en" ? "Close" : "إغلاق"}><X size={16} /></button>
        </div>
        <div className="sheet-body">
          {notices.map((n, i) => (
            <div key={n.id} style={{ marginBottom: i < notices.length - 1 ? 18 : 0, paddingBottom: i < notices.length - 1 ? 18 : 0, borderBottom: i < notices.length - 1 ? `1px solid ${T.lineSoft}` : "none" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Sparkles size={15} color={n.kind === "important" ? "#C0392B" : T.brass} style={{ flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.paper }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{n.body}</div>
                  {n.votes_enabled && (
                    <button onClick={() => vote(n)} disabled={voted[n.id]} style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 6, background: voted[n.id] ? T.brass + "18" : T.brass, color: voted[n.id] ? T.brass : "#fff", border: "none", borderRadius: 9, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: voted[n.id] ? "default" : "pointer" }}>
                      <ThumbsUp size={12} /> {voted[n.id] ? (lang === "ar" ? "تم التأييد، شكرًا" : "Voted, thanks") : (lang === "ar" ? "أؤيد" : "Support")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 19px 20px", borderTop: `1px solid ${T.line}`, background: T.sunken }}>
          <button onClick={onClose} className="big-btn" style={{ marginTop: 0 }}>{lang === "en" ? "Close" : "إغلاق"}</button>
        </div>
      </div>
    </div>
  );
}

function PublicSite() {
  const reduced = usePrefersReduced();
  const { mode, setMode, resolved } = useThemeMode();
  const { lang, setLang } = useLangMode();
  const { view, setView } = useViewMode();
  const { deskOn, toggleDesk, smallDevice } = useDesktopView();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const T = THEMES[resolved];

  const [tab, setTab] = useState("overview");
  const [docView, setDocView] = useState(null);
  const [built, setBuilt] = useState(false);
  const [data, setData] = useState({ records: BASE, newKeys: [], updatedAt: null, label: "" });

  /* تحديث لحظي: يجيب البيانات الحية من قاعدة البيانات، ويشترك بالتغييرات الفورية
     (Supabase Realtime) — أي تعديل يسويه الأدمن (مزامنة إكسل أو يدوي) ينعكس هنا
     تلقائيًا بدون ما يحتاج الزائر يحدّث الصفحة. لو فشل الاتصال أو الجدول فاضي،
     يبقى الموقع شغّال بالنسخة الأساسية (BASE) بدون أي انقطاع. */
  useEffect(() => {
    const mapRow = (r) => ({
      id: r.id, model: r.model, loc: r.loc, pri: r.pri, cat: r.cat || "", sta: r.status,
      answered: !!r.answered, owner: r.owner, month: r.month,
      closed: r.closed === "نعم" || r.closed === true,
      meeting: Array.isArray(r.meetings) && r.meetings.length ? r.meetings[0] : null,
      meetings: Array.isArray(r.meetings) ? r.meetings : [],
      note: r.note, reply: r.reply, note_en: r.note_en, reply_en: r.reply_en,
      last_modified: r.last_modified,
      urgent: !!r.urgent, important: !!r.important, urgent_until: r.urgent_until || null, important_until: r.important_until || null,
    });
    const fetchLive = async () => {
      try {
        const { data: rows, error } = await supabase.from("inquiries").select("*").order("id");
        if (error || !rows || !rows.length) return;
        setData((d) => ({ ...d, records: rows.map(mapRow) }));
      } catch {}
    };
    fetchLive();
    const channel = supabase
      .channel("public-inquiries-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, fetchLive)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const [loading, setLoading] = useState(true);
  const [pg, setPg] = useState(PG_BASE);
  const [pgLoading, setPgLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [f, setF] = useState(EMPTY_F);
  const [sort, setSort] = useState("id");
  const [sel, setSel] = useState(null);
  const [navList, setNavList] = useState(null);
  const openRecord = (r, list) => { setSel(r); setNavList(list || null); };
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [limit, setLimit] = useState(12);
  const tabsRef = useRef(null);
  const indicatorRef = useRef(null);
  const [scrollPending, setScrollPending] = useState(false);
  const [tabsH, setTabsH] = useState(0);
  const filtersRef = useRef(null);
  const [stickyBar, setStickyBar] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const loadMoreRef = useRef(null);
  const progressRef = useRef(null);

  /* موضع مؤشر التبويب النشط المتحرك — يُحدَّث عند تبديل التبويب أو اللغة أو تغيّر حجم الشاشة */
  useLayoutEffect(() => {
    const position = () => {
      const nav = tabsRef.current, ind = indicatorRef.current;
      if (!nav || !ind) return;
      setTabsH(nav.offsetHeight);
      const active = nav.querySelector('.tab[data-on="1"]');
      if (!active) return;
      ind.style.width = `${active.offsetWidth}px`;
      ind.style.left = `${active.offsetLeft}px`;
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [tab, lang]);

  /* شريط الفلاتر المصغّر: يظهر بعد تجاوز صندوق الفلاتر الكامل أثناء التمرير لأسفل في لوحة المتابعة */
  useEffect(() => {
    if (tab !== "notes") { setStickyBar(false); return; }
    const el = filtersRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      setStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab]);

  /* زر "رجوع للأعلى" العائم، خط تقدّم التمرير، وزجاجية شريط الخانات — كلها من نفس مستمع التمرير لتفادي إعادة رسم زائدة */
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setShowTop(y > 520);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (progressRef.current) progressRef.current.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
        if (tabsRef.current) tabsRef.current.classList.toggle("tabs-glass", y > 8);
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => { const t = setTimeout(() => setBuilt(true), reduced ? 0 : 100); return () => clearTimeout(t); }, [reduced]);

  /* تتبع صامت: زيارة عند التحميل */
  useEffect(() => { logEvent("visit", null, null, null); }, []);

  /* عنوان تبويب المتصفح — يتبع اللغة المختارة بدل الاسم الافتراضي للمشروع */
  useEffect(() => {
    if (typeof document !== "undefined") document.title = L("استفسارات الملاك", "Owner Inquiries");
  }, [lang]);

  /* تتبع صامت: تبديل التبويب (يتجاهل التبويب الأول عند التحميل) */
  const firstTabRef = useRef(true);
  useEffect(() => {
    if (firstTabRef.current) { firstTabRef.current = false; return; }
    logEvent("tab", tab, null, null);
  }, [tab]);

  /* تتبع صامت: استخدام الفلاتر (يسجّل فقط الحقل الذي تغيّر فعليًا إلى قيمة) */
  const prevFRef = useRef(EMPTY_F);
  useEffect(() => {
    Object.keys(f).forEach((k) => {
      if (k === "q" || k === "fresh") return;
      const v = f[k];
      if (v !== prevFRef.current[k] && v !== null && v !== false && v !== "") {
        logEvent("filter", k, v, null);
      }
    });
    prevFRef.current = f;
  }, [f]);

  /* تتبع صامت: فتح تفاصيل استفسار */
  useEffect(() => {
    if (sel) logEvent("inquiry_open", sel.id, sel.pri, `${sel.model || ""} / ${sel.zone || sel.loc || ""}`);
  }, [sel]);

  useEffect(() => {
    if (tab !== "notes" || !scrollPending) return;
    tabsRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setScrollPending(false);
  }, [tab, scrollPending, reduced]);

  useEffect(() => {
    let alive = true;
    loadShared().then((s) => {
      if (!alive) return;
      if (s?.records?.length) setData({ records: s.records, newKeys: s.newKeys || [], updatedAt: s.updatedAt, label: s.label || "" });
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchPg = async () => {
      try {
        const { data: rows, error } = await supabase.from("progress_matrix").select("*").order("month");
        if (!alive) return;
        if (!error && rows && rows.length) {
          const built = buildPgFromRows(rows);
          if (built) setPg(built);
        }
      } catch {}
      if (alive) setPgLoading(false);
    };
    fetchPg();
    const channel = supabase
      .channel("public-progress-matrix-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "progress_matrix" }, fetchPg)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  const ALL = useMemo(() => {
    return data.records.map((r) => ({ ...r, zone: zoneOf(r.loc), models: modelsOf(r.model), isNew: isRecentlyChanged(r.last_modified),
      isUrgentActive: isFlagLive(r.urgent, r.urgent_until), isImportantActive: isFlagLive(r.important, r.important_until) }));
  }, [data]);

  /* فتح استفسار محدد تلقائيًا عند الوصول عبر رابط مشاركة (?note=ID) — مرة واحدة فقط بعد اكتمال تحميل البيانات */
  const deepLinkRef = useRef(false);
  useEffect(() => {
    if (deepLinkRef.current || loading || !ALL.length) return;
    const noteId = new URLSearchParams(window.location.search).get("note");
    if (!noteId) return;
    deepLinkRef.current = true;
    const found = ALL.find((r) => String(r.id) === String(noteId));
    if (found) setSel(found);
  }, [ALL, loading]);

  const cats = useMemo(() => ({
    pri: uniqSorted(ALL.map((r) => r.pri), PRI_ORDER),
    cat: uniqSorted(ALL.map((r) => r.cat), CAT_ORDER),
    sta: uniqSorted(ALL.map((r) => r.sta), STA_ORDER),
    models: MODEL_LIST.filter((m) => ALL.some((r) => r.models.includes(m))),
    owners: [...new Set(ALL.map((r) => r.owner))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ar")),
    months: [...new Set(ALL.map((r) => r.month))].filter(Boolean).sort(),
    meetings: uniqSorted(ALL.flatMap((r) => (r.meetings && r.meetings.length ? r.meetings : [r.meeting])), MEETING_ORDER),
  }), [ALL]);

  const newCount = ALL.filter((r) => r.isNew).length;
  const openCount = ALL.filter((r) => !r.closed).length;
  const importantCount = ALL.filter((r) => r.isImportantActive).length;
  const urgentCount = ALL.filter((r) => r.isUrgentActive).length;
  const staC = (s) => T.sta[s] || hashPick(s, T.extra);
  const monthValue = (r) => (/^\d{4}-\d{2}$/.test(r.month || "") ? r.month : "9999-99");

  /* الانتقال من النظرة العامة إلى لوحة المتابعة مع تطبيق تصفية */
  const openBoard = (patch = {}) => {
    const { __sort, ...filters } = patch;
    setF({ ...EMPTY_F, ...filters });
    setSort(__sort || "id");
    setLimit(12);
    setTab("notes");
    setScrollPending(true);
  };
  const set = (k, v) => { setF((p) => ({ ...p, [k]: p[k] === v ? (typeof v === "boolean" ? !v : null) : v })); setLimit(12); };
  const reset = () => { setF(EMPTY_F); setLimit(12); };
  const nq = useMemo(() => norm(f.q.trim()), [f.q]);
  /* رقم الاستفسار: يقبل أرقامًا عربية أو إنجليزية، مع أو بدون # — يبحث بالتطابق التام على المعرّف */
  const nqId = useMemo(() => {
    const raw = f.q.trim().replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/^#/, "");
    return /^\d+$/.test(raw) ? Number(raw) : null;
  }, [f.q]);

  const match = useMemo(() => (r, skip = {}) => {
    if (!skip.zone && f.zone && r.zone !== f.zone) return false;
    if (!skip.pri && f.pri && r.pri !== f.pri) return false;
    if (!skip.cat && f.cat && r.cat !== f.cat) return false;
    if (!skip.sta && f.sta && r.sta !== f.sta) return false;
    if (f.model && !r.models.includes(f.model)) return false;
    if (f.own && r.owner !== f.own) return false;
    if (f.mon && r.month !== f.mon) return false;
    if (f.meeting && !((r.meetings && r.meetings.length ? r.meetings : [r.meeting]).includes(f.meeting))) return false;
    if (f.open && r.closed) return false;
    if (f.fresh && !r.isNew) return false;
    if (f.important && !r.isImportantActive) return false;
    if (f.urgent && !r.isUrgentActive) return false;
    if (nq && !(nqId != null && r.id === nqId) && !norm(`${r.note} ${r.reply} ${r.loc} ${r.model} ${r.owner} ${r.pri} ${r.cat} ${r.sta}`).includes(nq)) return false;
    return true;
  }, [f, nq, nqId]);

  const rows = useMemo(() => ALL.filter((r) => match(r)), [ALL, match]);

  const sorted = useMemo(() => {
    const a = [...rows];
    if (sort === "pri") a.sort((x, y) => rank(PRI_ORDER)(x.pri) - rank(PRI_ORDER)(y.pri) || x.id - y.id);
    else if (sort === "date") a.sort((x, y) => monthValue(y).localeCompare(monthValue(x)) || y.id - x.id);
    else if (sort === "open") a.sort((x, y) => x.closed - y.closed || rank(PRI_ORDER)(x.pri) - rank(PRI_ORDER)(y.pri));
    else if (sort === "new") a.sort((x, y) => (y.isNew ? 1 : 0) - (x.isNew ? 1 : 0) || x.id - y.id);
    else a.sort((x, y) => y.id - x.id);
    return a;
  }, [rows, sort]);

  /* تحميل تلقائي: يزيد الحد المعروض عند اقتراب نهاية القائمة من الشاشة أثناء التمرير */
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || tab !== "notes") return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setLimit((l) => (l < sorted.length ? l + 16 : l));
    }, { rootMargin: "700px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, sorted.length, limit]);

  /* النظرة العامة تعرض السجل كامل دائمًا — بلا تأثير من فلاتر لوحة المتابعة */
  const overview = useMemo(() => {
    const tot = ALL.length;
    const byS = {}; cats.sta.forEach((s) => (byS[s] = ALL.filter((r) => r.sta === s).length));
    const byP = {}; cats.pri.forEach((p) => (byP[p] = ALL.filter((r) => r.pri === p).length));
    const byC = {}; cats.cat.forEach((c) => (byC[c] = ALL.filter((r) => r.cat === c).length));
    const noCat = ALL.filter((r) => !r.cat).length;
    const zc = {}; ZONES.forEach((z) => (zc[z.key] = 0));
    ALL.forEach((r) => (zc[r.zone] = (zc[r.zone] || 0) + 1));
    const ok = byS["معتمدة"] || 0, no = byS["تم الرفض"] || 0;
    let cum = 0;
    const tl = cats.months.map((m) => {
      const inM = ALL.filter((r) => r.month === m);
      cum += inM.length;
      const o = { m: trMonth(lang, m), "تراكمي": cum };
      cats.sta.forEach((s) => (o[s] = inM.filter((r) => r.sta === s).length));
      return o;
    });
    return { tot, byS, byP, byC, noCat, zc, rate: ok + no ? Math.round((ok / (ok + no)) * 100) : 0, tl };
  }, [ALL, cats, lang]);

  const latest = useMemo(() =>
    [...ALL].sort((a, b) => monthValue(b).localeCompare(monthValue(a)) || b.id - a.id).slice(0, 3), [ALL]);

  const activeChips = useMemo(() => {
    const out = [];
    if (f.q) out.push({ k: "q", l: `${L("بحث:", "Search:")} ${f.q}` });
    if (f.zone) out.push({ k: "zone", l: trZone(lang, f.zone) });
    if (f.sta) out.push({ k: "sta", l: trSta(lang, f.sta) });
    if (f.pri) out.push({ k: "pri", l: trPri(lang, f.pri) });
    if (f.cat) out.push({ k: "cat", l: trCat(lang, f.cat) });
    if (f.model) out.push({ k: "model", l: trModel(lang, f.model) });
    if (f.own) out.push({ k: "own", l: trOwn(lang, f.own) });
    if (f.mon) out.push({ k: "mon", l: trMonth(lang, f.mon) });
    if (f.meeting) out.push({ k: "meeting", l: trMeeting(lang, f.meeting) });
    if (f.open) out.push({ k: "open", l: L("مفتوحة فقط", "Open only") });
    if (f.fresh) out.push({ k: "fresh", l: L("الجديد فقط", "New only") });
    if (f.important) out.push({ k: "important", l: L("مهم فقط", "Important only") });
    if (f.urgent) out.push({ k: "urgent", l: L("يجب الاطلاع فقط", "Needs review only") });
    return out;
  }, [f, lang]);

  const copySummary = async () => {
    const lines = [
      L("سجل استفسارات الملاك", "Owner Inquiries Log"),
      data.updatedAt ? `${L("آخر تحديث:", "Last updated:")} ${fmtDate(data.updatedAt)}${data.label ? " — " + data.label : ""}` : "",
      "",
      `${L("الإجمالي:", "Total:")} ${ALL.length}`,
      `${L("معتمدة:", "Approved:")} ${overview.byS["معتمدة"] || 0}`,
      `${L("مرفوضة:", "Rejected:")} ${overview.byS["تم الرفض"] || 0}`,
      `${L("ما زالت مفتوحة:", "Still open:")} ${openCount}`,
      "",
    ];
    if (newCount) {
      lines.push(`${L("الجديد هذا التحديث", "New in this update")} (${newCount}):`);
      ALL.filter((r) => r.isNew).forEach((r) => lines.push(`• [${trSta(lang, r.sta)}] ${trNote(lang, r).slice(0, 110)}`));
      lines.push("");
    }
    const openItems = ALL.filter((r) => !r.closed);
    if (openItems.length) {
      lines.push(`${L("بنود ما زالت مفتوحة", "Items still open")} (${openItems.length}):`);
      openItems.forEach((r) => lines.push(`• ${trNote(lang, r).slice(0, 110)}`));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true); setTimeout(() => setCopied(false), 1650);
      logEvent("click", "copy_summary", null, null);
    } catch { /* المتصفح منع النسخ */ }
  };

  return (
    <ThemeCtx.Provider value={{ T, mode, setMode, resolved }}>
      <LangCtx.Provider value={{ lang, setLang }}>
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="dash" style={{ minHeight: "100%" }}>
        <style>{`
@import url('https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400..600&display=block');
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.dash{font-family:'IBM Plex Sans Arabic',system-ui,'Segoe UI',Tahoma,sans-serif;-webkit-font-smoothing:antialiased;
  background:${T.bg};color:${T.paper};transition:background .3s ease,color .3s ease;}
.dash ::selection{background:${T.brass}33;}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;direction:ltr;display:inline-block;}
.disp{font-family:'Reem Kufi','IBM Plex Sans Arabic',sans-serif;}
.wrap{max-width:1120px;margin:0 auto;padding:18px 16px 40px;}
@media(min-width:768px){.wrap{padding:30px 28px 56px;}}

.surf{background:${T.surface};border-radius:18px;box-shadow:${T.shadow};}
.eyebrow{font-size:11.5px;color:${T.muted};}
.sec-t{font-family:'Reem Kufi',sans-serif;font-size:16.5px;color:${T.paper};}
.sec-lbl{font-size:11.5px;color:${T.muted};margin-bottom:9px;}

.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.h1{font-size:clamp(23px,5.2vw,33px);line-height:1.3;margin:6px 0 0;word-spacing:.22em;}
.meta-line{display:flex;flex-wrap:wrap;align-items:center;gap:9px;font-size:12px;color:${T.muted};margin-top:14px;}
.dot{width:3px;height:3px;border-radius:50%;background:${T.faint};display:inline-block;flex:none;}
.acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

.seg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:${T.sunken};}
.seg-b{display:inline-flex;align-items:center;justify-content:center;width:30px;height:26px;border:none;border-radius:8px;
  background:transparent;color:${T.muted};cursor:pointer;transition:.18s;}
.seg-b:hover{color:${T.paper};}
.seg-b-txt{width:auto;padding:0 10px;font-size:11.5px;font-weight:600;font-family:inherit;}

/* خانات التنقّل */
.tabs{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;margin:18px -16px 16px;
  background:${T.bg};transition:background .25s ease,backdrop-filter .25s ease,box-shadow .25s ease;}
.tabs.tabs-glass{background:${T.bg}CC;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:${T.shadow};}
@media(min-width:768px){.tabs{padding:10px 28px;margin:18px -28px 16px;flex-wrap:nowrap;}}
.scroll-progress{position:fixed;top:0;right:0;left:0;height:3px;width:0%;background:${T.brass};z-index:70;pointer-events:none;}
.tab{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:13px;border:1px solid ${T.line};
  background:${T.surface};color:${T.muted};font-family:inherit;font-size:14px;cursor:pointer;transition:.18s;
  flex:1 1 calc(50% - 3px);text-align:center;}
@media(min-width:768px){.tab{flex:none;}}
.tab:hover{color:${T.paper};}
.tab[data-on="1"]{background:${T.brass};border-color:${T.brass};color:${T.onAccent};box-shadow:${T.shadow};}
.tab-n{font-size:11.5px;padding:2px 8px;border-radius:999px;background:${T.sunken};color:${T.muted};}
.tab[data-on="1"] .tab-n{background:rgba(255,255,255,.22);color:${T.onAccent};}
.tab-indicator{display:none;position:absolute;bottom:4px;height:3px;border-radius:3px;background:${T.brass};
  transition:left .32s cubic-bezier(.22,.9,.34,1),width .32s cubic-bezier(.22,.9,.34,1);pointer-events:none;}
@media(min-width:768px){.tab-indicator{display:block;}}

/* تلاشي هادئ عند تبديل محتوى التبويب */
.tab-panel{animation:tabFadeIn .3s ease both;}
@keyframes tabFadeIn{from{opacity:0;}to{opacity:1;}}

/* ═══ إيفكتات v1.5.0 ═══ */

/* نبضة عند فتح استفسار — وميض لوني خفيف يمر على البطاقة */
.pulse-host{position:relative;overflow:hidden;}
.pulse-host::after{content:"";position:absolute;inset:0;background:${T.brass};opacity:0;
  pointer-events:none;border-radius:inherit;}
.pulse-host.pulsed::after{animation:pulseFlash .55s ease-out;}
@keyframes pulseFlash{0%{opacity:.16;}100%{opacity:0;}}

/* توهج شارة "الجديد" */
.chip-glow{animation:badgeGlow 2.6s ease-in-out infinite;}
@keyframes badgeGlow{
  0%,100%{box-shadow:0 0 0 0 transparent;}
  50%{box-shadow:0 0 0 4px ${T.brass}26;}
}
/* توهج شارة "مهم" — أحمر وأسرع من توهج "الجديد" حتى يُلاحظ فورًا */
.chip-important{color:#C0392B;border-color:#C0392B99;background:#C0392B14;}
.chip-important.chip-glow{animation:badgeGlowImportant 1.5s ease-in-out infinite;}
@keyframes badgeGlowImportant{
  0%,100%{box-shadow:0 0 0 0 transparent;}
  50%{box-shadow:0 0 0 5px #C0392B40;}
}
/* توهج شارة "يجب الاطلاع" — كهرماني/ذهبي حتى يتميّز عن "مهم" الأحمر */
.chip-urgent{color:#B8790F;border-color:#B8790F99;background:#B8790F14;}
.chip-urgent.chip-glow{animation:badgeGlowUrgent 1.5s ease-in-out infinite;}
@keyframes badgeGlowUrgent{
  0%,100%{box-shadow:0 0 0 0 transparent;}
  50%{box-shadow:0 0 0 5px #B8790F40;}
}

/* انتقال بطاقات ↔ جدول */
.view-swap{animation:viewIn .3s cubic-bezier(.22,.9,.34,1) both;}
@keyframes viewIn{from{opacity:0;transform:scale(.985);}to{opacity:1;transform:scale(1);}}

/* هيكل تحميل (Skeleton) */
.skel{background:linear-gradient(90deg,${T.sunken} 25%,${T.surface} 50%,${T.sunken} 75%);
  background-size:200% 100%;animation:skelSlide 1.3s infinite;border-radius:8px;}
@keyframes skelSlide{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.skel-line{height:12px;margin-bottom:9px;}

/* رسم الحلقات تدريجيًا (الدائرة + حلقات المراحل) */
.ring-fg{transition:stroke-dashoffset 1.25s cubic-bezier(.22,.9,.34,1);}
.rings{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:20px;
  padding-bottom:18px;border-bottom:1px solid ${T.lineSoft};}
.ring-i{text-align:center;flex:0 0 auto;width:74px;}
.ring-s{transform:rotate(-90deg);}
.ring-l{font-size:10.5px;color:${T.muted};margin-top:2px;line-height:1.4;}

/* تأكيد النسخ — شريط ينزلق داخل الزر */
.copy-host{position:relative;overflow:hidden;}
.share-host{position:relative;overflow:hidden;}

/* صف لايك/ديسلايك + مشاركة أسفل تفاصيل الاستفسار */
.sheet-fb-row{display:flex;align-items:stretch;gap:8px;margin-top:16px;}
.fb-btn{flex:none;width:46px;display:flex;align-items:center;justify-content:center;
  border-radius:11px;border:1px solid ${T.line};background:${T.sunken};color:${T.muted};
  cursor:pointer;transition:.18s;}
.fb-btn:hover{color:${T.paper};border-color:${T.faint};}
.fb-up[data-on="1"]{background:${T.sta["معتمدة"]}29;border-color:${T.sta["معتمدة"]};color:${T.sta["معتمدة"]};}
.fb-down[data-on="1"]{background:${T.sta["تم الرفض"]}29;border-color:${T.sta["تم الرفض"]};color:${T.sta["تم الرفض"]};}
.copy-ok{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;
  background:${T.sta["معتمدة"]};color:#fff;font-size:12.5px;transform:translateY(100%);pointer-events:none;}
.copy-ok.show{animation:copyUp 1.6s cubic-bezier(.22,.9,.34,1) both;}
@keyframes copyUp{
  0%{transform:translateY(100%);}
  14%,78%{transform:translateY(0);}
  100%{transform:translateY(-100%);}
}

/* نبض الفلتر المختار */
.chip{transition:all .22s cubic-bezier(.22,.9,.34,1);}
.chip[data-on="1"]{transform:scale(1.04);}

/* قفزة الرقم عند تغيّره */
.tick-n{display:inline-block;}
.tick-n.bump{animation:tickBump .45s cubic-bezier(.22,.9,.34,1);}
@keyframes tickBump{0%{transform:translateY(0);}35%{transform:translateY(-6px);opacity:.5;}100%{transform:translateY(0);}}

/* حالة السجل */
.stats{padding:22px 20px;margin-bottom:14px;}
.stats-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px;}
.hero{display:flex;align-items:baseline;gap:8px;}
.hero-n{font-size:44px;font-weight:600;line-height:1;color:${T.paper};}
.hero-k{font-size:13px;color:${T.muted};}
.bar{display:flex;height:12px;border-radius:999px;overflow:hidden;gap:2px;background:${T.sunken};}
.bar-s{cursor:pointer;transition:opacity .2s ease,flex 1.1s cubic-bezier(.22,.9,.34,1);}
.legend{display:grid;grid-template-columns:1fr;gap:2px;margin-top:16px;}
@media(min-width:620px){.legend{grid-template-columns:repeat(2,1fr);gap:2px 20px;}}
.lg{display:flex;align-items:center;gap:10px;padding:9px 10px;border:none;background:transparent;border-radius:10px;
  cursor:pointer;font-family:inherit;text-align:start;transition:background .16s;}
.lg:hover{background:${T.sunken};}
.lg-d{width:9px;height:9px;border-radius:3px;flex:none;}
.lg-l{flex:1;font-size:13px;color:${T.paper};}
.lg-n{font-size:14px;font-weight:600;color:${T.paper};}
.lg-p{font-size:11.5px;color:${T.faint};min-width:34px;text-align:left;}
.stats-foot{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:18px;padding-top:16px;
  border-top:1px solid ${T.lineSoft};font-size:12px;color:${T.muted};}
.ff{background:none;border:none;font-family:inherit;font-size:12px;color:${T.muted};cursor:pointer;padding:0;}
.ff:hover{color:${T.brass};}
.ff-static{color:${T.muted};}

.prow{display:block;width:100%;text-align:start;padding:10px 11px;border:none;background:transparent;border-radius:11px;
  cursor:pointer;font-family:inherit;transition:background .16s;}
.prow:hover{background:${T.sunken};}
.prow-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
.prow-l{font-size:13px;}
.prow-n{font-size:14px;font-weight:600;}
.pbar{height:6px;border-radius:999px;background:${T.sunken};overflow:hidden;}
.pbar>div{height:100%;border-radius:999px;transition:width .55s cubic-bezier(.2,.7,.3,1),opacity .2s;}

/* أحدث الملاحظات في النظرة العامة */
.latest{display:grid;grid-template-columns:1fr;gap:2px;}
.lrow{display:flex;align-items:flex-start;gap:11px;padding:13px 11px;border:none;background:transparent;
  border-radius:12px;cursor:pointer;font-family:inherit;text-align:start;transition:background .16s;}
.lrow:hover{background:${T.sunken};}
.lrow+.lrow{border-top:1px solid ${T.lineSoft};}
.lrow-d{width:8px;height:8px;border-radius:3px;margin-top:6px;flex:none;}
.lrow-t{flex:1;min-width:0;}
.lrow-n{font-size:13.5px;line-height:1.75;color:${T.paper};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.lrow-m{font-size:11.5px;color:${T.muted};margin-top:5px;}

.chip{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;font-size:12px;
  border:1px solid ${T.line};background:${T.surface};color:${T.muted};transition:all .18s ease;cursor:pointer;font-family:inherit;}
.chip:hover{color:${T.paper};border-color:${T.faint};}
.chip-n{font-size:10.5px;opacity:.9;}
.fchip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;font-size:12px;
  background:${T.brass}1A;color:${T.brass};border:none;font-family:inherit;cursor:pointer;}
.fchip:hover{background:${T.brass}2E;}

.sel-wrap{position:relative;display:inline-flex;align-items:center;}
.sel{appearance:none;background:${T.surface};border:1px solid ${T.line};color:${T.paper};font-size:12px;
  padding:8px 30px 8px 26px;border-radius:11px;font-family:inherit;cursor:pointer;max-width:210px;}
.sel:focus{outline:2px solid ${T.brass}66;outline-offset:1px;}
.sel option{background:${T.surface};color:${T.paper};}
.sel-ic{position:absolute;right:10px;color:${T.muted};pointer-events:none;}
.sel-ch{position:absolute;left:8px;color:${T.muted};pointer-events:none;}

.srch{width:100%;background:${T.surface};border:1px solid ${T.line};border-radius:13px;
  padding:13px 40px 13px 36px;color:${T.paper};font-size:14.5px;font-family:inherit;}
.srch::placeholder{color:${T.faint};}
.srch:focus{outline:none;border-color:${T.brass}88;box-shadow:0 0 0 3px ${T.brass}1A;}

.icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;border-radius:11px;
  border:1px solid ${T.line};background:${T.surface};color:${T.muted};font-size:12px;cursor:pointer;transition:.18s;font-family:inherit;}
.icon-btn:hover{color:${T.paper};border-color:${T.faint};}
.icon-btn[data-primary="1"]{color:${T.onAccent};background:${T.brass};border-color:${T.brass};}
.icon-btn[data-primary="1"]:hover{color:${T.onAccent};filter:brightness(1.07);}
.big-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:16px;padding:14px;
  border-radius:13px;border:none;background:${T.brass};color:${T.onAccent};font-size:14px;font-family:inherit;cursor:pointer;transition:.18s;}
.big-btn:hover{filter:brightness(1.07);}
.wide-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;padding:13px;
  border-radius:13px;border:1px solid ${T.line};background:${T.surface};color:${T.brass};font-size:13.5px;font-family:inherit;cursor:pointer;transition:.18s;}
.wide-btn:hover{border-color:${T.brass};background:${T.brass}0F;}

.note-box{margin-top:14px;padding:12px 14px;border-radius:12px;background:${T.sunken};color:${T.muted};font-size:12px;line-height:1.85;}

.stamp{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;color:${T.muted};
  background:${T.sunken};border-radius:13px;padding:11px 15px;margin-top:16px;}

.cards{display:grid;grid-template-columns:1fr;gap:11px;}
@media(min-width:900px){.cards{grid-template-columns:repeat(2,1fr);}}
.card{position:relative;overflow:hidden;text-align:start;padding:17px 18px;border-radius:16px;background:${T.surface};box-shadow:${T.shadow};
  border-right:3px solid transparent;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;}
.card:hover{transform:translateY(-2px);box-shadow:${T.shadowUp};}
.card:active{transform:scale(.97);box-shadow:${T.shadowUp};}
.card:focus-visible{outline:2px solid ${T.brass};outline-offset:2px;}
.card-wm{position:absolute;bottom:-16px;inset-inline-start:10px;font-size:64px;font-weight:700;line-height:1;
  color:${T.paper};opacity:${resolved === "dark" ? 0.05 : 0.045};pointer-events:none;z-index:0;}
/* علامة مائية إضافية وواضحة لعلامة "يلزم الاطلاع" — نفس أسلوب العلامة المائية أعلاه
   (موضع مطلق، بلا تفاعل، خلف محتوى البطاقة) لكن بشفافية أعلى بكثير عشان تكون لافتة،
   وبلون الأولوية "عالية جدًا" حتى تدل بصريًا على الاستعجال. تُفعَّل من لوحة الإدارة. */
.card-wm-urgent{position:absolute;bottom:-8px;inset-inline-end:14px;max-width:62%;font-size:19px;font-weight:800;
  line-height:1.15;text-align:end;letter-spacing:.2px;color:${T.pri["عالية جدًا"]};
  opacity:${resolved === "dark" ? 0.55 : 0.46};pointer-events:none;z-index:0;}
.card-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:11px;position:relative;z-index:1;}
.card-id{font-size:11.5px;color:${T.faint};}
.card-sta{display:inline-flex;align-items:center;gap:5px;font-size:12px;margin-right:auto;}
.tag{font-size:11px;color:${T.muted};}
.tag-new{display:inline-flex;align-items:center;gap:3px;color:${T.sta["معتمدة"]};animation:${reduced ? "none" : "tagPulse 2.4s ease-in-out infinite"};}
@keyframes tagPulse{0%,100%{opacity:1;}50%{opacity:.45;}}
/* شارة "مهم" — إطار أحمر واضح مع وميض أقوى وأبطأ من "جديد" حتى تُميَّز فورًا بالعين،
   تُفعَّل وتُلغى يدويًا من لوحة الإدارة بدون أي مدة انتهاء تلقائية */
.tag-important{display:inline-flex;align-items:center;gap:4px;font-weight:700;color:#C0392B;
  border:1.4px solid #C0392B;background:#C0392B14;border-radius:999px;padding:2px 9px 2px 7px;
  animation:${reduced ? "none" : "importantBlink 1.3s ease-in-out infinite"};}
@keyframes importantBlink{0%,100%{opacity:1;box-shadow:0 0 0 0 #C0392B4D;}50%{opacity:.55;box-shadow:0 0 7px 1px #C0392B4D;}}
.tag-open{color:${T.brass};}
/* شارة فئة البند — تظهر عند كل استفسار بالبطاقة والجدول ولوحة التفاصيل، بلون خاص لكل فئة */
.cat-pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;line-height:1;
  padding:4px 9px;border-radius:999px;white-space:nowrap;border:1px solid transparent;}
.cat-pill::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;flex:none;}
.tbl td.td-cat{white-space:nowrap;}
.card-note{position:relative;z-index:1;font-size:14.5px;line-height:1.95;color:${T.paper};margin-bottom:12px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.card-foot{position:relative;z-index:1;display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
.fm{font-size:11.5px;color:${T.muted};}

/* لوحة هدف الشهر الحالي — تتقدّم مع التقويم */
.plan-now{border-inline-start:3px solid ${T.brass};}

/* زر وضع سطح المكتب — يبقى واضحًا وسهل الوصول والصفحة مصغّرة */
.desk-btn{white-space:nowrap;flex:none;}
.desk-btn[data-primary="1"]{box-shadow:${T.shadowUp};}

/* عرض الجدول — الزر يجلس في نهاية سطر النتائج على كل الأجهزة */
.res-row{min-height:34px;}
.view-seg{margin-inline-start:auto;align-self:center;flex:none;}
.tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.tbl-wrap::-webkit-scrollbar{height:8px;}
.tbl-wrap::-webkit-scrollbar-track{background:transparent;}
.tbl-wrap::-webkit-scrollbar-thumb{background:${T.faint}55;border-radius:4px;}
.tbl{width:100%;min-width:880px;border-collapse:collapse;font-family:inherit;}
.tbl th{text-align:start;font-weight:500;font-size:11.5px;color:${T.muted};
  padding:14px 14px;border-bottom:1px solid ${T.line};white-space:nowrap;}
.trow{cursor:pointer;transition:background .16s;}
.trow:hover{background:${T.sunken};}
.trow:focus-visible{outline:2px solid ${T.brass};outline-offset:-2px;}
.trow td{padding:13px 14px;border-bottom:1px solid ${T.lineSoft};vertical-align:top;font-size:13px;}
.tbl tbody tr:last-child td{border-bottom:none;}
.td-id{width:46px;}
.tbl td.td-id{font-size:11.5px;color:${T.faint};}
.td-nw{white-space:nowrap;}
.td-sta{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;}
.tbl td.td-note{min-width:300px;color:${T.paper};line-height:1.85;}
.td-note-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.td-tags{display:flex;align-items:center;gap:8px;margin-top:7px;}
.tbl td.td-m{font-size:11.5px;color:${T.muted};white-space:nowrap;}

.zrow{display:block;width:100%;text-align:start;padding:9px 11px;border-radius:11px;cursor:pointer;
  font-family:inherit;background:transparent;border:none;transition:background .16s;}
.zrow:hover{background:${T.sunken};}
.zbar{height:3px;border-radius:2px;background:${T.sunken};overflow:hidden;margin-top:7px;}
.cat-grid{display:grid;grid-template-columns:1fr;gap:2px;}
@media(min-width:760px){.cat-grid{grid-template-columns:repeat(2,1fr);gap:2px 18px;}}

.tip{background:${T.surface};border-radius:12px;padding:10px 13px;font-size:12px;box-shadow:${T.shadowUp};}
.tip-h{color:${T.muted};margin-bottom:6px;font-size:11.5px;}
.tip-r{display:flex;align-items:center;gap:8px;padding:2px 0;}
.tip-d{width:8px;height:8px;border-radius:3px;}
.tip-l{color:${T.muted};flex:1;}
.tip-v{color:${T.paper};}

.ovl{position:fixed;inset:0;background:${resolved === "dark" ? "rgba(4,10,14,.7)" : "rgba(30,45,58,.34)"};
  backdrop-filter:blur(6px);z-index:60;display:flex;align-items:flex-end;justify-content:center;animation:fade .2s ease;}
@media(min-width:640px){.ovl{align-items:center;padding:24px;}}
.sheet{background:${T.surface};border-radius:22px 22px 0 0;width:100%;max-width:680px;max-height:88vh;
  display:flex;flex-direction:column;box-shadow:${T.shadowUp};animation:up .3s cubic-bezier(.2,.7,.3,1);}
@media(min-width:640px){.sheet{border-radius:20px;}}
.sheet-top{display:flex;align-items:center;justify-content:space-between;padding:17px 19px 15px;}
.sheet-id{font-size:12.5px;color:${T.muted};}
.sheet-body{padding:4px 19px 24px;overflow-y:auto;}
.sheet-body::-webkit-scrollbar{width:8px;}
.sheet-body::-webkit-scrollbar-track{background:transparent;}
.sheet-body::-webkit-scrollbar-thumb{background:${T.faint}66;border-radius:4px;}
.sheet-note{font-size:15.5px;line-height:2.1;margin:0;color:${T.paper};}
.reply-box{background:${T.sunken};border-radius:13px;border-right:3px solid transparent;padding:14px 16px;}
.sheet-reply{font-size:14.5px;line-height:2.1;margin:0;color:${T.paper};}
.meta-list{margin-top:24px;}
.meta-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 2px;}
.meta-row+.meta-row{border-top:1px solid ${T.lineSoft};}
.meta-k{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:${T.muted};}
.meta-v{font-size:13px;color:${T.paper};text-align:left;}

/* تقدم التنفيذ */
.gbar{position:relative;height:10px;border-radius:999px;background:${T.sunken};overflow:hidden;}
.gbar-f{height:100%;border-radius:999px;transition:width 1.1s cubic-bezier(.22,.9,.34,1);position:relative;overflow:hidden;}
.gbar-f::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:40%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);opacity:0;}
.gbar-f.in-view::after{animation:gbarShimmer 1.1s ease-in-out .35s 1;}
@keyframes gbarShimmer{0%{left:-40%;opacity:1;}90%{opacity:1;}100%{left:110%;opacity:0;}}
.gbar-t{position:absolute;top:-3px;width:2px;height:16px;border-radius:1px;opacity:.55;}
.gmeta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px;font-size:12.5px;color:${T.muted};}
.gm{display:inline-flex;align-items:baseline;gap:5px;}
.gm-k{color:${T.faint};}
.grow{padding:13px 0;}
.grow+.grow{border-top:1px solid ${T.lineSoft};}
.grow-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px;}
.grow-l{font-size:13.5px;color:${T.paper};}
.grow-note{font-size:11px;color:${T.faint};margin-right:6px;}
.grow-r{display:inline-flex;align-items:baseline;gap:10px;}
.grow-v{font-size:14.5px;font-weight:600;color:${T.paper};}
.grow-g{font-size:12px;}
.grow-d{font-size:11px;color:${T.faint};margin-top:8px;}
.gb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.mseg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:${T.sunken};flex-wrap:wrap;}
.mseg-b{padding:6px 11px;border:none;border-radius:8px;background:transparent;color:${T.muted};
  font-family:inherit;font-size:11.5px;cursor:pointer;transition:.18s;}
.mseg-b:hover{color:${T.paper};}
.gb-group{margin-top:18px;}
.gb-gt{font-size:11.5px;color:${T.faint};margin-bottom:8px;}
.brow{display:flex;align-items:center;gap:12px;padding:9px 2px;}
.brow+.brow{border-top:1px solid ${T.lineSoft};}
.brow-b{width:26px;flex:none;text-align:center;font-size:12px;color:${T.muted};}
.brow-bar{flex:1;min-width:60px;}
.brow-v{width:58px;flex:none;text-align:left;font-size:13px;font-weight:600;color:${T.paper};}
.brow-d{width:56px;flex:none;text-align:left;font-size:11.5px;}

/* ═══ إيفكتات v1.6.0 ═══ */

/* تنقّل سابق/تالي أعلى لوحة تفاصيل الاستفسار */
.sheet-nav{display:inline-flex;align-items:center;gap:4px;padding:2px;border-radius:11px;background:${T.sunken};}
.sheet-nav-b{border:none;background:transparent;padding:7px;}
.sheet-nav-b:disabled{opacity:.32;cursor:default;}
.sheet-nav-b:disabled:hover{color:${T.muted};}

/* شريط الفلاتر المصغّر — يلتصق أسفل شريط الخانات عند تجاوز صندوق الفلاتر الكامل */
.mini-bar{position:sticky;z-index:19;display:flex;align-items:center;gap:10px;padding:10px 16px;margin:0 -16px 16px;
  background:${T.bg};border-bottom:1px solid ${T.lineSoft};animation:stickIn .22s cubic-bezier(.22,.9,.34,1) both;}
@media(min-width:768px){.mini-bar{padding:10px 28px;margin:0 -28px 16px;}}
.mini-bar-jump{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;border:1px solid ${T.line};
  background:${T.surface};color:${T.paper};font-size:12px;font-family:inherit;cursor:pointer;flex:none;}
.mini-bar-jump:hover{border-color:${T.brass};}
.mini-bar-n{background:${T.brass};color:${T.onAccent};font-size:10px;padding:1px 6px;border-radius:999px;}
.mini-bar-res{font-size:12px;color:${T.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mini-bar-clear{display:inline-flex;align-items:center;gap:5px;margin-inline-start:auto;padding:7px 12px;border-radius:999px;
  border:none;background:${T.brass}1A;color:${T.brass};font-size:12px;font-family:inherit;cursor:pointer;flex:none;}
.mini-bar-clear:hover{background:${T.brass}2E;}
@keyframes stickIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}

/* تحميل تلقائي عند نهاية القائمة */
.load-sentinel{height:1px;}
.all-shown{text-align:center;margin-top:20px;font-size:12px;color:${T.faint};}

/* زر "رجوع للأعلى" العائم */
.top-fab{position:fixed;bottom:22px;inset-inline-end:18px;width:44px;height:44px;border-radius:50%;border:1px solid ${T.line};
  background:${T.surface};color:${T.brass};box-shadow:${T.shadowUp};display:flex;align-items:center;justify-content:center;
  cursor:pointer;z-index:40;animation:fade .2s ease both;}
.top-fab:hover{filter:brightness(1.05);}
@media(min-width:640px){.top-fab{bottom:28px;}}

/* ═══ إيفكتات v1.7.4 — تبويب المخططات والمستندات ═══ */
.doc-intro{padding:18px;margin-bottom:14px;}
.doc-disclaimer{display:flex;gap:9px;align-items:flex-start;background:${T.brass}0F;border:1px solid ${T.brass}33;
  border-radius:13px;padding:11px 13px;margin-bottom:16px;font-size:12px;color:${T.muted};line-height:1.8;}
.doc-disclaimer svg{flex-shrink:0;margin-top:1px;color:${T.brass};}
.doc-list{display:grid;grid-template-columns:1fr;gap:11px;}
.doc-card{display:flex;align-items:center;gap:13px;width:100%;text-align:start;background:${T.surface};
  border:1px solid ${T.line};border-inline-start:4px solid ${T.brass};border-radius:16px;padding:11px 13px;
  box-shadow:${T.shadow};font-family:inherit;cursor:pointer;transition:transform .15s ease, box-shadow .15s ease;}
.doc-card:active{transform:scale(.985);}
.doc-thumb{width:62px;height:62px;border-radius:13px;overflow:hidden;flex:none;background:${T.sunken};
  border:1px solid ${T.line};}
.doc-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
.doc-info{flex:1;min-width:0;display:block;}
.doc-name{display:block;font-size:14.5px;font-weight:600;color:${T.paper};}
.doc-sub{display:block;font-size:11.5px;color:${T.muted};margin-top:3px;}
.doc-meta{font-size:11px;color:${T.faint};margin-top:5px;display:flex;align-items:center;gap:5px;}
.doc-go{flex:none;color:${T.faint};display:flex;align-items:center;}

.dvw{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;
  background:${resolved === "dark" ? "#050C10" : "#0C1519"};animation:fade .18s ease;}
.dvw-top{display:flex;align-items:center;gap:11px;padding:calc(9px + env(safe-area-inset-top)) 12px 9px;
  background:rgba(0,0,0,.34);flex:none;}
.dvw-title{flex:1;min-width:0;}
.dvw-name{font-size:14px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dvw-page{font-size:11.5px;color:rgba(255,255,255,.6);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dvw-ico{border:none;background:rgba(255,255,255,.13);color:#fff;width:35px;height:35px;border-radius:11px;
  display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;font-family:inherit;}
.dvw-ico:disabled{opacity:.28;cursor:default;}
.dvw-stage{flex:1;min-height:0;position:relative;overflow:hidden;touch-action:none;
  display:flex;align-items:center;justify-content:center;}
.dvw-img{width:100%;height:100%;object-fit:contain;display:block;transform-origin:center center;
  user-select:none;-webkit-user-select:none;-webkit-user-drag:none;}
.dvw-spin{position:absolute;width:26px;height:26px;border-radius:50%;border:2.5px solid rgba(255,255,255,.22);
  border-top-color:#fff;animation:dvwspin .8s linear infinite;}
@keyframes dvwspin{to{transform:rotate(360deg);}}
.dvw-bot{background:rgba(0,0,0,.34);padding:9px 10px calc(9px + env(safe-area-inset-bottom));flex:none;}
.dvw-nav{display:flex;align-items:center;gap:8px;}
.dvw-chips{flex:1;min-width:0;display:flex;gap:6px;overflow-x:auto;padding:2px 0;scrollbar-width:none;}
.dvw-chips::-webkit-scrollbar{display:none;}
.dvw-chip{flex:none;border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.07);
  color:rgba(255,255,255,.72);font-family:inherit;font-size:11.5px;padding:7px 12px;border-radius:999px;
  cursor:pointer;white-space:nowrap;}
.dvw-chip.on{background:#fff;color:#0C1519;border-color:#fff;font-weight:600;}
.dvw-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px;
  font-size:11px;color:rgba(255,255,255,.5);}
.dvw-foot a{display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,.72);text-decoration:none;
  border:1px solid rgba(255,255,255,.17);border-radius:999px;padding:5px 11px;flex:none;}

@keyframes rise{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes fade{from{opacity:0;}to{opacity:1;}}
@keyframes up{from{opacity:0;transform:translateY(100%);}to{opacity:1;transform:translateY(0);}}
@media(min-width:640px){@keyframes up{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
@media print{.no-print{display:none!important;}.dash{background:#fff;color:#000;}.card,.surf,.stats{box-shadow:none!important;}.tabs{position:static;}
  .tbl{min-width:0!important;}.tbl-wrap{overflow:visible!important;}.cat-pill{border-color:currentColor!important;background:none!important;}}
        `}</style>

        <div ref={progressRef} className="scroll-progress no-print" aria-hidden="true" />

        <LegalDisclaimer onAgree={() => setLegalAgreed(true)} />
        <NoticesModal enabled={legalAgreed} />

        <div className="wrap">
          <header>
            <div className="head">
              <div className="min-w-0">
                <h1 className="disp h1">{L("استفسارات الملاك", "Owner Inquiries")}</h1>
              </div>
              <div className="acts no-print">
                <LangToggle />
                <ThemeToggle />
                {smallDevice && (
                  <button className="icon-btn desk-btn" onClick={toggleDesk}
                    data-primary={deskOn ? "1" : undefined}
                    aria-pressed={deskOn ? "true" : "false"}>
                    {deskOn ? <Smartphone size={13} /> : <Laptop size={13} />}
                    {deskOn ? L("عرض الجوال", "Mobile view") : L("سطح المكتب", "Desktop")}
                  </button>
                )}
                <button className="icon-btn" onClick={() => { logEvent("click", "changelog", null, null); setChangelogOpen(true); }}><History size={13} /> <span className="mono">{`v${CURRENT_VERSION}`}</span></button>
                <button className="icon-btn copy-host" onClick={copySummary}>
                  <Copy size={13} /> {L("ملخص", "Summary")}
                  {copied && <span className="copy-ok show"><Check size={13} /> {L("تم النسخ", "Copied")}</span>}
                </button>
              </div>
            </div>

            <div className="meta-line">
              <span>{cats.months.length ? `${trMonth(lang, cats.months[0])} — ${trMonth(lang, cats.months[cats.months.length - 1])}` : "—"}</span>
              <span className="dot" />
              <span>{cats.models.map((m) => trModel(lang, m)).join(L("، ", ", "))}</span>
            </div>

            <div className="stamp">
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="chip" style={{ textDecoration: "none" }} onClick={() => logEvent("click", "telegram", null, null)}>
                <TelegramIcon size={13} /> {L("مجتمع الملاك", "Owners Community")}
              </a>
              {loading ? (
                <span className="skel skel-line" style={{ width: 190, height: 13, margin: 0, display: "inline-block" }} />
              ) : data.updatedAt ? (
                <>
                  <RefreshCw size={13} />
                  {L("آخر تحديث:", "Last updated:")} <span className="mono">{fmtDate(data.updatedAt)}</span>{data.label ? ` — ${data.label}` : ""}
                </>
              ) : null}
              {(urgentCount > 0 || importantCount > 0 || newCount > 0) && (
                <div style={{ display: "flex", gap: 9, marginRight: "auto" }}>
                  {urgentCount > 0 && (
                    <button className="chip chip-glow chip-urgent" onClick={() => openBoard({ urgent: true })}>
                      <ShieldAlert size={11} /> {L("يجب الاطلاع", "Needs review")} <span className="mono chip-n">{urgentCount}</span>
                    </button>
                  )}
                  {importantCount > 0 && (
                    <button className="chip chip-glow chip-important" onClick={() => openBoard({ important: true })}>
                      <AlertTriangle size={11} /> {L("مهم", "Important")} <span className="mono chip-n">{importantCount}</span>
                    </button>
                  )}
                  {newCount > 0 && (
                    <button className="chip chip-glow" onClick={() => openBoard({ fresh: true, __sort: "new" })}>
                      <Sparkles size={11} /> {L("الجديد", "New")} <span className="mono chip-n">{newCount}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* الخانات */}
          <nav className="tabs no-print" role="tablist" ref={tabsRef}>
            <button className="tab" role="tab" aria-selected={tab === "overview"} data-on={tab === "overview" ? "1" : "0"}
              onClick={() => setTab("overview")}>
              {L("نظرة عامة", "Overview")}
            </button>
            <button className="tab" role="tab" aria-selected={tab === "notes"} data-on={tab === "notes" ? "1" : "0"}
              onClick={() => setTab("notes")}>
              {L("متابعة الملاحظات", "Notes Board")}
              <span className="tab-n mono">{ALL.length}</span>
            </button>
            <button className="tab" role="tab" aria-selected={tab === "progress"} data-on={tab === "progress" ? "1" : "0"}
              onClick={() => setTab("progress")}>
              {L("تقدم التنفيذ", "Progress")}
            </button>
            <button className="tab" role="tab" aria-selected={tab === "docs"} data-on={tab === "docs" ? "1" : "0"}
              onClick={() => setTab("docs")}>
              <FileText size={13} /> {L("المخططات والمستندات", "Plans & Documents")}
            </button>
            <span className="tab-indicator" ref={indicatorRef} />
          </nav>

          {tab === "notes" && stickyBar && (
            <div className="mini-bar no-print" style={{ top: tabsH }}>
              <button className="mini-bar-jump" onClick={() => filtersRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" })}>
                <SlidersHorizontal size={13} />
                <span>{L("الفلاتر", "Filters")}</span>
                {activeChips.length > 0 && <span className="mono mini-bar-n">{activeChips.length}</span>}
              </button>
              <span className="mini-bar-res">
                <TickNum value={rows.length} /> {rows.length !== ALL.length ? L(`من ${ALL.length}`, `of ${ALL.length}`) : L("نتيجة", "results")}
              </span>
              {activeChips.length > 0 && (
                <button className="mini-bar-clear" onClick={reset}><RotateCcw size={12} /> {L("مسح", "Clear")}</button>
              )}
            </div>
          )}

          {tab === "overview" && (
            <div className="tab-panel">
              {/* حالة السجل */}
              <section className="surf stats">
                <div className="stats-top">
                  <div>
                    <div className="sec-t">{L("حالة السجل", "Record Status")}</div>
                    <div className="eyebrow" style={{ marginTop: 4 }}>{L("توزيع القرارات على كامل السجل", "Decision breakdown across the full record")}</div>
                  </div>
                  <div className="hero">
                    <span className="hero-n mono"><CountUp value={overview.tot} onScroll /></span>
                    <span className="hero-k">{L("ملاحظة", "notes")}</span>
                  </div>
                </div>

                <StatusBar cats={cats} overview={overview} staC={staC} trSta={trSta} lang={lang} openBoard={openBoard} L={L} />

                <div className="legend">
                  {cats.sta.map((s) => {
                    const n = overview.byS[s] || 0;
                    const pct = overview.tot ? Math.round((n / overview.tot) * 100) : 0;
                    return (
                      <button key={s} className="lg" onClick={() => openBoard({ sta: s })}>
                        <span className="lg-d" style={{ background: staC(s) }} />
                        <span className="lg-l">{trSta(lang, s)}</span>
                        <span className="lg-n mono"><CountUp value={n} onScroll dur={900} /></span>
                        <span className="lg-p mono"><CountUp value={pct} onScroll dur={900} suffix="٪" /></span>
                      </button>
                    );
                  })}
                </div>

                <div className="stats-foot">
                  <button className="ff" onClick={() => openBoard({ open: true })}>
                    <CountUp value={openCount} onScroll dur={900} /> {L("ما زالت مفتوحة", "still open")}
                  </button>
                  <span className="dot" />
                  <span className="ff-static"><CountUp value={overview.tot - openCount} onScroll dur={900} /> {L("مقفلة", "closed")}</span>
                  <span className="dot" />
                  <span className="ff-static">{L("نسبة الاعتماد من المحسوم", "Approval rate of decided items")} <CountUp value={overview.rate} onScroll dur={900} suffix="٪" /></span>
                </div>
              </section>

              {/* أحدث الملاحظات */}
              <section className="surf" style={{ padding: "20px 18px", marginBottom: 14 }}>
                <div className="sec-t">{L("أحدث الملاحظات", "Latest Notes")}</div>
                <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>{L("آخر ما أُضيف أو جرى عليه رد", "Most recently added or replied to")}</div>
                <div className="latest">
                  {latest.map((r) => (
                    <button key={r.id} className="lrow" onClick={() => openRecord(r, latest)}>
                      <span className="lrow-d" style={{ background: staC(r.sta) }} />
                      <span className="lrow-t">
                        <span className="lrow-n">{trNote(lang, r)}</span>
                        <span className="lrow-m">
                          {trSta(lang, r.sta)} · {trLoc(lang, r.loc)} · {trMonth(lang, r.month)}
                          {r.isNew ? ` · ${L("جديد", "New")}` : ""}{!r.closed ? ` · ${L("مفتوح", "Open")}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <button className="wide-btn" onClick={() => openBoard()}>
                  {L("فتح لوحة المتابعة — كل الملاحظات", "Open Notes Board — All Notes")} <ArrowLeft size={14} />
                </button>
              </section>

              {/* المخطط + المواقع */}
              <section className="surf" style={{ padding: "20px 18px", marginBottom: 14 }}>
                <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 18 }}>
                  <div className="lg:col-span-2">
                    <div className="sec-t">{L("أين ظهرت الملاحظات؟", "Where did the notes come from?")}</div>
                    <div className="eyebrow" style={{ marginTop: 4 }}>{L("اضغط أي منطقة لعرض ملاحظاتها", "Tap any area to view its notes")}</div>
                    <VillaPlan counts={overview.zc} active={null} onPick={(z) => z && openBoard({ zone: z })} built={built} />
                  </div>
                  <div>
                    <div className="sec-lbl" style={{ marginTop: 4 }}>{L("كل المواقع", "All Locations")}</div>
                    {[...ZONES].sort((a, b) => (overview.zc[b.key] || 0) - (overview.zc[a.key] || 0)).map((z) => {
                      const n = overview.zc[z.key] || 0;
                      const pct = Math.round((n / Math.max(1, overview.tot)) * 100);
                      return (
                        <div key={z.key} role="button" tabIndex={0} className="zrow"
                          onClick={() => n && openBoard({ zone: z.key })}
                          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && n) { e.preventDefault(); openBoard({ zone: z.key }); } }}
                          style={{ opacity: n === 0 ? 0.45 : 1, cursor: n === 0 ? "default" : "pointer" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ fontSize: 12.5 }}>{trZone(lang, z.key)}</span>
                            <span className="mono" style={{ fontSize: 12.5, color: T.muted }}>{n}</span>
                          </div>
                          <div className="zbar">
                            <div style={{ width: `${pct}%`, height: "100%", background: T.zone, opacity: .55, transition: "width .5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* فئات البنود — طبيعة كل استفسار: عيب تنفيذي، تحسين تصميمي، ترقية، استفسار… */}
              {cats.cat.length > 0 && (
                <section className="surf" style={{ padding: "20px 18px", marginBottom: 14 }}>
                  <div className="sec-t">{L("طبيعة البنود", "Item Categories")}</div>
                  <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>
                    {L("اضغط أي فئة لعرض بنودها", "Tap any category to view its items")}
                  </div>
                  <div className="cat-grid">
                    {cats.cat.map((c) => {
                      const n = overview.byC[c] || 0;
                      const pct = Math.round((n / Math.max(1, overview.tot)) * 100);
                      const cc = catColor(T, c);
                      return (
                        <div key={c} role="button" tabIndex={0} className="zrow"
                          onClick={() => n && openBoard({ cat: c })}
                          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && n) { e.preventDefault(); openBoard({ cat: c }); } }}
                          style={{ opacity: n === 0 ? 0.45 : 1, cursor: n === 0 ? "default" : "pointer" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 7 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 3, background: cc, flex: "none" }} />
                              {trCat(lang, c)}
                            </span>
                            <span className="mono" style={{ fontSize: 12.5, color: T.muted }}>{n} · {pct}٪</span>
                          </div>
                          <div className="zbar">
                            <div style={{ width: `${pct}%`, height: "100%", background: cc, opacity: .6, transition: "width .5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {overview.noCat > 0 && (
                    <div className="eyebrow" style={{ marginTop: 12 }}>
                      {L(`${overview.noCat} بند بلا فئة محددة بعد`, `${overview.noCat} item(s) not categorized yet`)}
                    </div>
                  )}
                </section>
              )}

              {/* الزمن + الأولوية */}
              <section className="grid grid-cols-1 lg:grid-cols-5" style={{ gap: 14 }}>
                <div className="surf lg:col-span-3" style={{ padding: "20px 16px 12px" }}>
                  <div style={{ paddingRight: 4 }}>
                    <div className="sec-t">{L("مسار الردود والتراكم", "Reply Trend & Cumulative")}</div>
                    <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>{L("حسب شهر الرد", "By reply month")}</div>
                  </div>
                  <div style={{ height: 250, width: "100%" }}>
                    <ResponsiveContainer>
                      <ComposedChart data={overview.tl} margin={{ top: 6, right: 4, left: -20, bottom: 4 }}>
                        <defs>
                          {cats.sta.map((s, i) => (
                            <linearGradient key={s} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={staC(s)} stopOpacity={0.95} />
                              <stop offset="100%" stopColor={staC(s)} stopOpacity={0.62} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid stroke={T.lineSoft} vertical={false} />
                        <XAxis dataKey="m" reversed={lang === "ar"} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis orientation="right" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: T.brass + "12" }} />
                        {cats.sta.map((s, i) => (
                          <Bar key={s} dataKey={s} name={trSta(lang, s)} stackId="a" fill={`url(#bg${i})`} maxBarSize={44} isAnimationActive={!reduced} />
                        ))}
                        <Line type="monotone" dataKey="تراكمي" name={L("تراكمي", "Cumulative")} stroke={T.brass} strokeWidth={2.2}
                          dot={{ r: 3, fill: T.surface, stroke: T.brass, strokeWidth: 2 }} isAnimationActive={!reduced} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center" style={{ gap: 14, padding: "6px 4px 4px" }}>
                    {cats.sta.map((s) => (
                      <span key={s} className="flex items-center" style={{ gap: 6, fontSize: 11.5, color: T.muted }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: staC(s), display: "inline-block" }} /> {trSta(lang, s)}
                      </span>
                    ))}
                    <span className="flex items-center" style={{ gap: 6, fontSize: 11.5, color: T.muted }}>
                      <span style={{ width: 13, height: 2, background: T.brass, display: "inline-block" }} /> {L("تراكمي", "Cumulative")}
                    </span>
                  </div>
                </div>

                <div className="surf lg:col-span-2" style={{ padding: 20 }}>
                  <div className="sec-t">{L("حسب الأولوية", "By Priority")}</div>
                  <div className="eyebrow" style={{ marginTop: 4, marginBottom: 18 }}>{L("اضغط أي أولوية لعرض ملاحظاتها", "Tap any priority to view its notes")}</div>
                  {cats.pri.map((p) => {
                    const n = overview.byP[p] || 0;
                    const pct = Math.round((n / Math.max(1, overview.tot)) * 100);
                    const col = T.pri[p] || T.muted;
                    return (
                      <button key={p} className="prow" onClick={() => openBoard({ pri: p })}>
                        <div className="prow-top">
                          <span className="prow-l">{trPri(lang, p)}</span>
                          <span className="prow-n mono" style={{ color: T.muted }}>{n}</span>
                        </div>
                        <div className="pbar"><div style={{ width: `${pct}%`, background: col, opacity: .7 }} /></div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {tab === "notes" && (
            <div className="tab-panel">
              {/* أدوات لوحة المتابعة */}
              <section ref={filtersRef} className="surf no-print" style={{ padding: 18, marginBottom: 16 }}>
                <div className="relative" style={{ marginBottom: 14 }}>
                  <Search size={17} style={{ position: "absolute", right: lang === "ar" ? 14 : "auto", left: lang === "ar" ? "auto" : 14, top: 14, color: T.faint }} />
                  <input className="srch" value={f.q} placeholder={L("ابحث في نص الملاحظة أو الرد…", "Search note or reply text…")}
                    onChange={(e) => { setF((p) => ({ ...p, q: e.target.value })); setLimit(12); }} />
                  {f.q && (
                    <button onClick={() => setF((p) => ({ ...p, q: "" }))} aria-label={L("مسح البحث", "Clear search")}
                      style={{ position: "absolute", left: lang === "ar" ? 12 : "auto", right: lang === "ar" ? "auto" : 12, top: 13, color: T.muted, background: "none", border: "none", cursor: "pointer" }}><X size={16} /></button>
                  )}
                </div>

                <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                  {urgentCount > 0 && (
                    <Chip on={f.urgent} onClick={() => set("urgent", true)} color="#B8790F" count={urgentCount}>{L("يجب الاطلاع", "Needs review")}</Chip>
                  )}
                  {importantCount > 0 && (
                    <Chip on={f.important} onClick={() => set("important", true)} color="#C0392B" count={importantCount}>{L("مهم", "Important")}</Chip>
                  )}
                  <Chip on={f.fresh} onClick={() => set("fresh", true)} color={T.sta["معتمدة"]} count={newCount}>{L("الجديد", "New")}</Chip>
                  <Chip on={f.open} onClick={() => set("open", true)} color={T.brass} count={openCount}>{L("مفتوحة", "Open")}</Chip>
                  {cats.sta.map((s) => (
                    <Chip key={s} on={f.sta === s} onClick={() => set("sta", s)} color={staC(s)}
                      count={ALL.filter((r) => r.sta === s).length}>{trSta(lang, s)}</Chip>
                  ))}
                </div>

                <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 12 }}>
                  <Select value={sort} onChange={(v) => setSort(v || "id")} placeholder={L("ترتيب", "Sort")} icon={Hash}
                    options={[{ v: "id", l: L("الأرقام: الأحدث أولاً", "Number: newest first") }, { v: "date", l: L("الأحدث أولاً (بالتاريخ)", "Newest first (by date)") }, { v: "new", l: L("الجديد أولاً", "New first") }, { v: "pri", l: L("الأولوية أولاً", "Priority first") }, { v: "open", l: L("المفتوحة أولاً", "Open first") }]} />
                  <Select value={f.pri} onChange={(v) => { setF((p) => ({ ...p, pri: v })); setLimit(12); }} placeholder={L("كل الأولويات", "All priorities")} icon={Layers} options={cats.pri.map((p) => ({ v: p, l: trPri(lang, p) }))} />
                  <Select value={f.cat} onChange={(v) => { setF((p) => ({ ...p, cat: v })); setLimit(12); }} placeholder={L("كل الفئات", "All categories")} icon={Tag}
                    options={cats.cat.map((c) => ({ v: c, l: `${trCat(lang, c)} (${ALL.filter((r) => r.cat === c).length})` }))} />
                  <Select value={f.model} onChange={(v) => { setF((p) => ({ ...p, model: v })); setLimit(12); }} placeholder={L("كل النماذج", "All models")} icon={Home}
                    options={cats.models.map((m) => ({ v: m, l: `${trModel(lang, m)} (${ALL.filter((r) => r.models.includes(m)).length})` }))} />
                  <Select value={f.zone} onChange={(v) => { setF((p) => ({ ...p, zone: v })); setLimit(12); }} placeholder={L("كل المواقع", "All locations")} icon={Layers}
                    options={ZONES.filter((z) => ALL.some((r) => r.zone === z.key)).map((z) => ({ v: z.key, l: trZone(lang, z.key) }))} />
                  <Select value={f.own} onChange={(v) => { setF((p) => ({ ...p, own: v })); setLimit(12); }} placeholder={L("كل المجيبين", "All engineers")} icon={User} options={cats.owners.map((m) => ({ v: m, l: trOwn(lang, m) }))} />
                  <Select value={f.mon} onChange={(v) => { setF((p) => ({ ...p, mon: v })); setLimit(12); }} placeholder={L("كل الأشهر", "All months")} icon={Calendar} options={cats.months.map((m) => ({ v: m, l: trMonth(lang, m) }))} />
                  {cats.meetings.map((m) => (
                    <Chip key={m} on={f.meeting === m} onClick={() => set("meeting", m)} color={T.zone}>{`${trMeeting(lang, m)} (${ALL.filter((r) => (r.meetings && r.meetings.length ? r.meetings : [r.meeting]).includes(m)).length})`}</Chip>
                  ))}
                </div>

                {activeChips.length > 0 && (
                  <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 14 }}>
                    <span style={{ fontSize: 11.5, color: T.muted }}>{L("مُصفّى على:", "Filtered by:")}</span>
                    {activeChips.map((c) => (
                      <button key={c.k} className="fchip"
                        onClick={() => { setF((p) => ({ ...p, [c.k]: c.k === "open" || c.k === "fresh" || c.k === "important" || c.k === "urgent" ? false : c.k === "q" ? "" : null })); setLimit(12); }}>
                        {c.l} <X size={12} />
                      </button>
                    ))}
                    <button className="icon-btn" onClick={reset}><RotateCcw size={12} /> {L("مسح الكل", "Clear all")}</button>
                  </div>
                )}
              </section>

              <div className="flex items-baseline res-row" style={{ gap: 8, marginBottom: 14 }}>
                <span className="sec-t">{L("النتائج", "Results")}</span>
                <span style={{ color: T.brass, fontSize: 15 }}><TickNum value={rows.length} /></span>
                {rows.length !== ALL.length && <span style={{ fontSize: 12, color: T.muted }}>{L(`من ${ALL.length}`, `of ${ALL.length}`)}</span>}
                <ViewToggle view={view} setView={setView} />
              </div>

              {rows.length === 0 ? (
                <div className="surf" style={{ padding: "48px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: 14.5, margin: "0 0 6px" }}>{L("لا توجد ملاحظات مطابقة", "No matching notes")}</p>
                  <p style={{ fontSize: 12.5, color: T.muted, margin: "0 0 18px" }}>{L("أزل أحد الفلاتر لتوسيع النتائج.", "Remove a filter to widen the results.")}</p>
                  <button className="icon-btn" onClick={reset}><RotateCcw size={13} /> {L("مسح كل الفلاتر", "Clear all filters")}</button>
                </div>
              ) : (
                <>
                  {view === "table" ? (
                    <div className="surf tbl-wrap view-swap" key="v-table">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th className="td-id">#</th>
                            <th>{L("الحالة", "Status")}</th>
                            <th>{L("الأولوية", "Priority")}</th>
                            <th>{L("الملاحظة", "Note")}</th>
                            <th>{L("الفئة", "Category")}</th>
                            <th>{L("الموقع", "Location")}</th>
                            <th>{L("النموذج", "Model")}</th>
                            <th>{L("الشهر", "Month")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.slice(0, limit).map((r, i) => <Row key={`${r.id}-${i}`} r={r} onOpen={(rec) => openRecord(rec, sorted)} />)}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="cards view-swap" key="v-cards">
                      {sorted.slice(0, limit).map((r, i) => <Card key={`${r.id}-${i}`} r={r} i={i} onOpen={(rec) => openRecord(rec, sorted)} reduced={reduced} />)}
                    </div>
                  )}
                  {limit < sorted.length ? (
                    <div ref={loadMoreRef} className="no-print load-sentinel" aria-hidden="true" />
                  ) : sorted.length > 12 ? (
                    <div className="no-print all-shown">{L("تم عرض كل النتائج", "All results shown")}</div>
                  ) : null}
                </>
              )}
            </div>
          )}

          {tab === "progress" && (
            <div className="tab-panel">
              <ProgressTab reduced={reduced} data={pg} loading={pgLoading} />
            </div>
          )}

          {tab === "docs" && (
            <div className="tab-panel">
              <section className="surf doc-intro">
                <div className="sec-t">{L("المخططات والمستندات", "Plans & Documents")}</div>
                <p className="eyebrow" style={{ marginTop: 8, lineHeight: 1.8 }}>
                  {L(
                    "هنا تجد المخطط الرئيسي لتوزيع البلوكات، بالإضافة إلى مخطط كل نموذج فيلا على حدة. اضغط \"فتح\" لعرض الملف أو تنزيله.",
                    "Here you'll find the master block-layout plan, along with each villa model's plan. Tap \"Open\" to view or download the file."
                  )}
                </p>
              </section>

              <div className="doc-disclaimer">
                <ShieldAlert size={15} />
                <span>
                  {L(
                    "الملفات مرجعية للاطّلاع فقط وقد تخضع لتعديلات من المطوّر. للتأكد من أي تفصيل نهائي يخص وحدتك تواصل عبر قناة الاستفسارات.",
                    "Files are for reference only and may be revised by the developer. For any unit-specific final detail, please reach out via the inquiries channel."
                  )}
                </span>
              </div>

              <div className="doc-list">
                {DOCS.map((doc) => {
                  const accent = doc.color ? DOC_COLORS[resolved][doc.color] : T.brass;
                  const Go = lang === "en" ? ChevronRight : ChevronLeft;
                  return (
                    <button
                      key={doc.id}
                      className="doc-card"
                      style={{ borderInlineStartColor: accent }}
                      onClick={() => { logEvent("nav", "doc_open", doc.id, null); setDocView(doc); }}
                    >
                      <span className="doc-thumb" style={{ borderColor: accent + "55" }}>
                        <img src={DOC_BASE + doc.cover} alt="" loading="lazy" />
                      </span>
                      <span className="doc-info">
                        <span className="doc-name">{L(doc.nameAr, doc.nameEn)}</span>
                        <span className="doc-sub">{L(doc.subAr, doc.subEn)}</span>
                        <span className="doc-meta" style={{ color: accent }}>
                          <FileText size={11} />
                          {doc.pages.length} {L(doc.pages.length === 1 ? "لوحة" : "لوحات", doc.pages.length === 1 ? "sheet" : "sheets")}
                        </span>
                      </span>
                      <span className="doc-go"><Go size={17} /></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="no-print" style={{ textAlign: "center", marginTop: 28, display: "flex", gap: 14, justifyContent: "center", alignItems: "center" }}>
            <button className="mono" onClick={() => { logEvent("click", "changelog", null, null); setChangelogOpen(true); }} style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: T.faint, padding: 4,
            }}>
              v{CURRENT_VERSION}
            </button>
            <button className="mono" onClick={() => { logEvent("click", "admin_login", null, null); window.location.hash = "admin"; }} style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: T.faint, padding: 4, display: "flex", alignItems: "center", gap: 4,
            }}>
              <ShieldCheck size={12} /> {L("دخول الإدارة", "Admin login")}
            </button>
          </div>
        </div>

        <Sheet r={sel} navList={navList} onJump={setSel} onClose={() => { setSel(null); setNavList(null); }} />
        <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
        <DocViewerSheet doc={docView} onClose={() => setDocView(null)} />

        {showTop && (
          <button
            className="top-fab no-print"
            onClick={() => { logEvent("click", "back_to_top", null, null); window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); }}
            aria-label={L("رجوع للأعلى", "Back to top")}
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════
   ١٥. لوحة الإدارة الحقيقية — متصلة بـ Supabase فعليًا (Auth + قراءة/كتابة).
   تعمل بعد تشغيل setup-supabase.sql وإنشاء أول حساب أدمن (راجع الملف).
   مرتبطة بنفس عميل supabase المُعرَّف بالأعلى بالسطر ٢٦.
   ═══════════════════════════════════════════════════════════ */

/* ── يتبع وضع الجهاز (فاتح/داكن) تلقائيًا بدون أي زر تبديل ── */
let CURRENT_ADMIN_THEME = THEMES.light;
function useSystemTheme() {
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

const ADMIN_PERMISSIONS = [
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
  { key: "view_audit_log", label: "عرض سجل نشاط الإدارة", icon: History },
  { key: "edit_permissions", label: "تعديل صلاحيات أعضاء موجودين", icon: ShieldCheck },
  { key: "create_users", label: "إنشاء حسابات دخول جديدة", icon: UserPlus },
];
const INQ_FIELDS_ADMIN = ["model", "loc", "pri", "cat", "status", "owner", "month", "note", "note_en", "reply", "closed", "answered"];
const ADMIN_FIELD_LABEL = { model: "النموذج", loc: "الموقع", pri: "الأولوية", cat: "الفئة (تصنيف نوع البند)", status: "الحالة", owner: "المهندس", month: "الشهر", note: "الملاحظة", note_en: "Note (EN)", reply: "الرد", closed: "مغلقة (نعم/لا)", answered: "حالة الرد (تم الرد؟)" };
const ADMIN_BLANK_INQ = { model: "", loc: "", pri: "متوسطة", cat: "", status: "قيد الدراسة", owner: "", month: "", note: "", note_en: "", reply: "", closed: "لا", answered: "لا" };
/* answered عمود boolean حقيقي بقاعدة البيانات (بخلاف closed اللي نص) — نحوّلها بالحدين:
   نص "نعم/لا" أثناء العرض والمقارنة بالإدارة (اتساقًا مع closed)، وBoolean فعلي عند الكتابة الفعلية لقاعدة البيانات */
const REAL_BOOL_FIELDS = ["answered"];
const toYesNo = (v) => (v === true ? "نعم" : v === false ? "لا" : v);
const toDbBool = (v) => (v === "نعم" ? true : v === "لا" ? false : typeof v === "boolean" ? v : !!v);
const ADMIN_TARGETS = [
  { key: "inquiries", label: "الاستفسارات", fields: INQ_FIELDS_ADMIN, keyField: "id" },
  { key: "progress", label: "تقدّم التنفيذ", fields: ["planned", "actual"], keyField: "month" },
  { key: "ignore", label: "تجاهل هذا الشيت", fields: [], keyField: null },
];
const ADMIN_EVENT_TYPES = [
  { key: "visit", label: "زيارات", icon: Eye },
  { key: "tab", label: "تنقّل بين التبويبات", icon: Layers },
  { key: "filter", label: "استخدام الفلاتر", icon: Filter },
  { key: "inquiry_open", label: "فتح استفسار", icon: FileText },
  { key: "share", label: "مشاركة", icon: Share2 },
  { key: "feedback", label: "إعجاب / عدم إعجاب", icon: ThumbsUp },
  { key: "doc_open", label: "فتح مستند/مخطط", icon: FileText },
  { key: "click", label: "نقرات عامة", icon: MousePointerClick },
];

function fmtAdminDate(v) { const d = typeof v === "string" ? new Date(v) : v; return d.toLocaleString("ar-SA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function isoAdminDate(d) { return d.toISOString().slice(0, 10); }

/* جلسة الدخول الحقيقية */
function useSupaAuth() {
  const [session, setSession] = useState(undefined); // undefined=يتحقق، null=غير مسجّل
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

function AdminLogin() {
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

/* أدوات مساعدة عامة لواجهة الإدارة */
function ABadge({ kind, children }) {
  const T = useSystemTheme();
  const map = { add: { bg: "#1E8E5A14", fg: "#1E8E5A", icon: PlusCircle }, change: { bg: "#B8790F14", fg: "#B8790F", icon: Pencil }, missing: { bg: "#C0392B14", fg: "#C0392B", icon: MinusCircle } };
  const { bg, fg, icon: Icon } = map[kind];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color: fg, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999 }}><Icon size={12} /> {children}</span>;
}
/* ملخص مختصر لكل صف تغيّر — أي حقول بالضبط اختلفت (الرد، الحالة..) بدل رقم عام بس،
   عشان تعرف بلمحة وش تغيّر قبل ما تعتمد */
function DiffChangeList({ changed, T }) {
  if (!changed || !changed.length) return null;
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
      {changed.slice(0, 6).map((c) => (
        <div key={c.key} style={{ fontSize: 11, color: T.muted }}>
          <b style={{ color: T.brass }}>#{c.key}</b> — تغيّر: {c.fieldDiffs.map((f) => ADMIN_FIELD_LABEL[f] || f).join("، ")}
        </div>
      ))}
      {changed.length > 6 && <div style={{ fontSize: 11, color: T.faint }}>+{changed.length - 6} تغييرات أخرى</div>}
    </div>
  );
}
function ASegmented({ options, value, onChange }) {
  const T = useSystemTheme();
  return <div style={{ display: "flex", background: T.sunken, borderRadius: 10, padding: 3, gap: 2 }}>{options.map((o) => (<button key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 8px", fontSize: 12, cursor: "pointer", fontWeight: 600, background: value === o.value ? T.brass : "transparent", color: value === o.value ? "#fff" : T.muted }}>{o.label}</button>))}</div>;
}
function ALocked({ text }) {
  const T = useSystemTheme();
  return <div style={{ background: T.surface, border: `1px dashed ${T.line}`, borderRadius: 16, padding: 30, textAlign: "center" }}><ShieldAlert size={22} color={T.faint} style={{ marginBottom: 8 }} /><div style={{ fontSize: 13, color: T.muted }}>{text}</div></div>;
}
function afieldInput(label, value, onChange, opts) {
  const T = CURRENT_ADMIN_THEME;
  return (
    <div key={label}>
      <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>{label}</label>
      {opts ? (<select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5, background: T.sunken }}>{opts.map((o) => <option key={o} value={o}>{o === "" ? "— بدون —" : o}</option>)}</select>)
        : (<input value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5, background: T.sunken }} />)}
    </div>
  );
}
/* أسماء أعمدة بديلة شائعة — يقبل ملفات إكسل حقيقية بعناوين عربية، مو بس القالب الجاهز */
const HEADER_ALIASES = {
  id: ["id", "رقم", "الرقم", "م", "رقم الاستفسار", "no", "no.", "#"],
  model: ["model", "النموذج", "الموديل", "نوع النموذج", "موديل الفيلا"],
  loc: ["loc", "الموقع", "موقع الملاحظة", "مكان الملاحظة", "الموقع بالفيلا"],
  pri: ["pri", "الأولوية", "الاولوية", "درجة الأولوية", "الاهمية", "الأهمية"],
  /* عمود الفئة — العنوان الرسمي بالملف "تصنيف نوع البند"، والباقي صياغات بديلة محتملة.
     كلها بعيدة نصيًا عن عناوين الأعمدة الأخرى، فما تتعارض مع المطابقة التقريبية القائمة. */
  cat: ["cat", "category", "الفئة", "الفئه", "التصنيف", "تصنيف", "تصنيف نوع البند", "نوع البند", "تصنيف البند", "فئة البند", "نوع الاستفسار", "تصنيف الاستفسار"],
  status: ["status", "الحالة", "حالة المقترح", "حالة الاعتماد"],
  owner: ["owner", "المهندس", "المسؤول", "صاحب الرد", "المهندس المسؤول", "الجهة المعنية"],
  month: ["month", "الشهر", "شهر الرد", "شهر الرد (نص)", "تاريخ الطلب", "تاريخ الرد", "التاريخ"],
  note: ["note", "الملاحظة", "ملاحظة", "الاستفسار", "الملاحظة / الحل المقترح", "الملاحظة/الحل المقترح", "تفاصيل الطلب", "نص الاستفسار", "وصف الاستفسار"],
  note_en: ["note_en", "note (en)", "الملاحظة بالانجليزي", "note en"],
  reply: ["reply", "الرد", "رد", "الرد على المقترح", "رد المهندس", "التوضيح"],
  closed: ["closed", "مغلقة", "مقفل", "مقفل/مفتوح", "مقفل / مفتوح", "حالة الإغلاق", "حالة الطلب", "الإغلاق", "هل تم الإغلاق"],
  answered: ["answered", "حالة الرد", "هل تم الرد"],
};
/* مفاتيح مطبَّعة (بدون تشكيل/مسافات/فوارق أ-إ-آ) لكل بديل — أساس محرك المطابقة الذكي للعناوين */
const HEADER_LOOKUP = (() => {
  const map = {};
  Object.entries(HEADER_ALIASES).forEach(([canon, aliases]) => aliases.forEach((a) => { map[normalizeArabic(a)] = canon; }));
  return map;
})();
/* يطابق عنوان عمود حتى لو مختلف شوي بالصياغة عن القوالب المعروفة (مسافات زائدة، تشكيل، همزات، أقواس..)
   أولًا مطابقة تامة بعد التطبيع، ولو ما لقى، مطابقة تقريبية (Levenshtein) بحد أدنى للتشابه */
function resolveHeaderKey(rawKey) {
  const norm = normalizeArabic(rawKey);
  if (!norm) return null;
  if (HEADER_LOOKUP[norm]) return HEADER_LOOKUP[norm];
  let best = null, bestScore = 0;
  Object.entries(HEADER_LOOKUP).forEach(([alias, canon]) => {
    const longer = Math.max(alias.length, norm.length), shorter = Math.min(alias.length, norm.length);
    if (longer - shorter > Math.max(4, longer * 0.35)) return; // فرق طول كبير = مستبعد مبكرًا (يمنع تطابق عناوين قصيرة كجزء من عناوين طويلة غير مرتبطة)
    if (shorter / longer < 0.7) return; // نفس الغرض: يمنع اعتبار عنوان قصير جزءًا من عنوان أطول بلا علاقة فعلية
    const dist = levenshtein(norm, alias);
    const s = 1 - dist / longer;
    if (s > bestScore) { bestScore = s; best = canon; }
  });
  return bestScore >= 0.82 ? best : null;
}
function normalizeRow(row) {
  const out = {};
  Object.entries(row).forEach(([key, val]) => {
    const canon = resolveHeaderKey(String(key));
    out[canon || key] = val;
  });

  return out;
}

/* ═══ تطبيع القيم الثنائية (نعم/لا) — يحل مشكلة أعمدة مثل "حالة الإغلاق" و"حالة الرد" اللي تجي
   بصياغات مختلفة تمامًا عن القيم المعتمدة (مثلاً "مقفل"/"مفتوح" أو "تم الرد"/"بانتظار الرد" بدل
   "نعم"/"لا"). المطابقة التقريبية بالتشابه النصي ما تكفي هنا لأنها كلمات مختلفة كليًا وليست أخطاء
   إملائية، فنستخدم قوائم مرادفات صريحة لكل حقل على حدة بدلًا من الاعتماد على Levenshtein وحده ═══ */
const BOOLEAN_FIELD_WORDS = {
  closed: {
    true: ["نعم", "مقفل", "مغلق", "مغلقة", "تم الإغلاق", "تم اغلاقه", "منتهي", "closed", "yes", "true", "done", "1"],
    false: ["لا", "مفتوح", "غير مغلق", "قائم", "لم يغلق", "لايزال مفتوح", "لا يزال مفتوحا", "open", "no", "false", "pending", "0"],
  },
  answered: {
    true: ["تم الرد", "تم الرد عليه", "رد عليه", "نعم", "answered", "replied", "yes", "true", "done", "1"],
    false: ["لم يتم الرد", "بانتظار الرد", "لم يرد بعد", "لم يرد", "لا", "not answered", "awaiting", "pending", "no", "false", "0"],
  },
};
function normalizeBooleanish(value, field) {
  if (value == null || value === "") return value;
  const norm = normalizeArabic(value);
  if (!norm) return value;
  const words = BOOLEAN_FIELD_WORDS[field]; if (!words) return value;
  const hit = (list) => list.some((w) => { const nw = normalizeArabic(w); return norm === nw || norm.includes(nw); });
  if (hit(words.true)) return "نعم";
  if (hit(words.false)) return "لا";
  return value; // قيمة غير معروفة — تُترك كما هي لتمر بعدها على المطابقة التقريبية العامة (canonicalizeRow)
}
/* الحقول اللي قيمتها منطقية بطبيعتها (نعم/لا) وتحتاج هذا التطبيع الصريح قبل أي تطبيع عام آخر */
const BOOLEAN_FIELDS = ["closed", "answered"];
function normalizeBooleanFields(row) {
  const out = { ...row };
  BOOLEAN_FIELDS.forEach((f) => { if (out[f] != null && out[f] !== "") out[f] = normalizeBooleanish(out[f], f); });
  return out;
}

/* ═══ محرك مطابقة ذكي — يقرأ نص الخلية ويقرّبه لأقرب قيمة فلتر موجودة، مو مطابقة حرفية بس ═══ */
function normalizeArabic(s) {
  return String(s || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/^ال/, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  }
  return dp[m][n];
}
function textSimilarity(a, b) {
  const na = normalizeArabic(a), nb = normalizeArabic(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.93;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}
function findClosestMatch(value, existingValues, threshold = 0.72) {
  let best = null, bestScore = 0;
  (existingValues || []).forEach((ev) => {
    const s = textSimilarity(value, ev);
    if (s > bestScore) { bestScore = s; best = ev; }
  });
  return bestScore >= threshold ? { match: best, score: bestScore } : null;
}
/* يقرّب قيم الفئات الأساسية (النموذج/الموقع/الأولوية/الحالة/الإغلاق) لأقرب قيمة معتمدة —
   يخلي البيانات موحّدة تلقائيًا حتى لو اختلفت الصياغة قليلًا بالملف عن القائمة المعتمدة */
function canonicalizeRow(row, categories) {
  const out = { ...row };
  (categories || []).forEach((cat) => {
    if (!cat.locked) return;
    const val = out[cat.key];
    if (val == null || val === "") return;
    if (cat.values.includes(val)) return;
    const found = findClosestMatch(val, cat.values);
    if (found) out[cat.key] = found.match;
  });
  return out;
}

/* يكتشف صف العناوين الحقيقي تلقائيًا حتى لو فيه صف عنوان تجميعي فوقه (خلايا مدمجة) —
   يستخدم نفس محرك المطابقة التقريبية للعناوين، مو بس تطابق حرفي، عشان يلقط صف العناوين
   الصحيح حتى لو صياغته مختلفة شوي عن القوالب المعروفة */
function smartSheetToJson(sheet, categories) {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  let bestIdx = 0, bestScore = -1;
  for (let i = 0; i < Math.min(6, raw.length); i++) {
    const score = (raw[i] || []).filter((cell) => resolveHeaderKey(String(cell))).length;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { range: bestIdx, defval: "", raw: false });
  return rows.map(normalizeRow).map(normalizeBooleanFields).map((r) => {
    if (typeof r.month === "string" && /^\d{4}-\d{2}/.test(r.month)) r.month = r.month.slice(0, 7);
    return r;
  }).map((r) => canonicalizeRow(r, categories));
}

function findNewValuesAdmin(rows, categories) {
  const found = []; const seen = new Set();
  categories.forEach((cat) => {
    const columnKey = cat.locked ? cat.key : cat.label;
    rows.forEach((row) => {
      const raw = row[columnKey]; if (raw == null || raw === "") return;
      String(raw).split(",").map((s) => s.trim()).filter(Boolean).forEach((val) => {
        if (!(cat.values || []).includes(val)) { const sig = cat.key + "::" + val; if (!seen.has(sig)) { seen.add(sig); found.push({ categoryKey: cat.key, categoryLabel: cat.label, value: val }); } }
      });
    });
  });
  return found;
}
function findNewColumnsAdmin(rows, categories) {
  const known = new Set(["id", ...INQ_FIELDS_ADMIN]);
  categories.forEach((c) => known.add(c.locked ? c.key : c.label));
  const colValues = {};
  rows.forEach((row) => Object.keys(row).forEach((col) => {
    if (known.has(col)) return;
    const val = row[col]; if (val == null || val === "") return;
    (colValues[col] = colValues[col] || new Set()).add(String(val).trim());
  }));
  return Object.entries(colValues).map(([column, set]) => ({ column, values: [...set] }));
}

/* ═══════════════════════════════════════════════════════════
   محرك قراءة ملف «تقدّم الوحدة والمراحل» (شيت KPIs) — رفع تلقائي بالكامل:
   يكتشف جدول متوسط تقدّم المراحل وجدول تقدّم البلوكات، وأعمدة الأشهر تحتهما،
   بدون أي تعيين يدوي لعمود. الاستثناء الوحيد: الشيت يذكر اسم الشهر بدون سنة،
   فيحتاج تأكيد سنة أول عمود من الأدمن (مع تخمين تلقائي من اسم الملف).
   ═══════════════════════════════════════════════════════════ */
function monthIndexOf(text) {
  if (typeof text !== "string" || !text.trim()) return -1;
  const t = text.trim();
  let i = MONTH_EN_LABEL.findIndex((m) => m.toLowerCase() === t.toLowerCase());
  if (i >= 0) return i;
  i = MONTH_AR.findIndex((m) => normalizeArabic(m) === normalizeArabic(t));
  return i;
}
/* يلقط سلسلة أعمدة متتالية تمثّل أسماء أشهر بادئة من عمود معيّن بصف — يوقف عند
   أول خلية مو اسم شهر بعد ما يبدأ الالتقاط (يتجاوز الفراغات قبل أول اسم شهر) */
function scanMonthRow(row) {
  const out = []; let started = false;
  for (let c = 0; c < (row ? row.length : 0); c++) {
    const mi = monthIndexOf(row[c]);
    if (mi < 0) { if (started) break; else continue; }
    started = true;
    out.push({ col: c, monthIdx: mi });
  }
  return out;
}
function toNumOrNull(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string" && v.trim().toUpperCase() === "#N/A") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/* يحوّل كسر (0.4696..) لنسبة مئوية بمنزلتين عشريتين (46.97) — نفس صيغة عرض
   الموقع الحالية بكل مكان (PG_PHASES/PG_BLOCKS القديمة كانت مكتوبة بنفس الصيغة) */
function toPct(v) { const n = toNumOrNull(v); return n == null ? null : Math.round(n * 10000) / 100; }
function findRowIndexContaining(raw, needleNorm) {
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] || [];
    if (row.some((c) => typeof c === "string" && normalizeArabic(c).includes(needleNorm))) return i;
  }
  return -1;
}
function findColIndexInRow(row, needleNorm) {
  for (let c = 0; c < (row ? row.length : 0); c++) {
    if (typeof row[c] === "string" && normalizeArabic(row[c]).includes(needleNorm)) return c;
  }
  return -1;
}
/* يحوّل قائمة أعمدة أشهر مكتشفة (بأي اتجاه ظهرت بالشيت) لمفاتيح تقويمية فعلية
   (YYYY-MM) اعتمادًا على سنة العمود الأول فقط — يتحقق إن كل عمود تالٍ يمثّل فعلًا
   الشهر السابق أو اللاحق مباشرة (تسلسل متصل بلا فجوة ولا قفزة)، وإلا يتوقف
   ويرجع null بدل ما يخمّن سنة غلط. */
function assignMonthKeys(monthCols, firstColYear) {
  if (!monthCols.length) return null;
  if (monthCols.length === 1) {
    return [{ ...monthCols[0], year: firstColYear, key: monthKeyOf(firstColYear, monthCols[0].monthIdx + 1) }];
  }
  const d = ((monthCols[1].monthIdx - monthCols[0].monthIdx) % 12 + 12) % 12;
  const step = d === 1 ? 1 : d === 11 ? -1 : null;
  if (step == null) return null;
  let y = firstColYear, m = monthCols[0].monthIdx;
  const out = [{ ...monthCols[0], year: y, key: monthKeyOf(y, m + 1) }];
  for (let i = 1; i < monthCols.length; i++) {
    const expected = ((m + step) % 12 + 12) % 12;
    if (monthCols[i].monthIdx !== expected) return null;
    if (step === 1 && expected === 0) y += 1;
    if (step === -1 && expected === 11) y -= 1;
    m = expected;
    out.push({ ...monthCols[i], year: y, key: monthKeyOf(y, m + 1) });
  }
  return out;
}
/* يفتش عن أول صف ضمن مدى معيّن يحتوي أسماء أشهر متتالية (٢ على الأقل) — بدل
   افتراض إنه دائمًا الصف اللي بعد العنوان مباشرة، عشان يتحمّل صف فاضي إضافي أو
   أي اختلاف بسيط بشكل الملف. */
function findMonthHeaderRow(raw, startIdx, endIdx) {
  for (let i = startIdx; i <= endIdx && i < raw.length; i++) {
    const cols = scanMonthRow(raw[i]);
    if (cols.length >= 2) return { idx: i, cols };
  }
  return null;
}
/* يفتش عن أول صف ضمن مدى معيّن فيه خلية نصّها يطابق أحد النصوص المطلوبة (بعد
   التطبيع) — نفس محرك findRowIndexContaining بس محدود بمدى صفوف معيّن. */
function findRowMatchingIn(raw, startIdx, endIdx, needles) {
  for (let i = startIdx; i <= endIdx && i < raw.length; i++) {
    const row = raw[i] || [];
    if (row.some((c) => typeof c === "string" && needles.some((n) => normalizeArabic(c).includes(n)))) return i;
  }
  return -1;
}
/* المحرّك الرئيسي: ياخذ ملف إكسل مقروء (XLSX.read) وسنة أول عمود، ويرجع
   {sheetName, monthRows, warnings, monthLabels} أو {error} لو تعذّرت القراءة —
   بدون رمي استثناء، عشان واجهة الرفع تقدر تعرض رسالة عربية واضحة دائمًا.
   كل صف بيانات (المراحل الخمسة، وأرقام البلوكات) يُلقَط بمطابقة محتواه هو نفسه
   لا بعدّ صفوف ثابت من العنوان — عشان ما ينكسر لو انزاح صف واحد لأي سبب. */
function parseKpiWorkbook(wb, firstColYear) {
  const sheetName = wb.SheetNames.find((n) => /kpi/i.test(n))
    || wb.SheetNames.find((n) => {
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
      return raw.some((row) => (row || []).some((c) => typeof c === "string" && normalizeArabic(c).includes(normalizeArabic("متوسط تقدم المشروع"))));
    });
  if (!sheetName) return { error: "ما لقيت شيت يحتوي جدول \"متوسط تقدم المشروع والمراحل\" بهذا الملف. تأكد إنه نفس ملف «تقدم الوحدة والمراحل» المعتاد." };
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
  const warnings = [];

  const phaseTitleIdx = findRowIndexContaining(raw, normalizeArabic("متوسط تقدم المشروع والمراحل"));
  if (phaseTitleIdx < 0) return { error: "ما لقيت عنوان جدول \"متوسط تقدم المشروع والمراحل\" بشيت KPIs." };
  const phaseHeader = findMonthHeaderRow(raw, phaseTitleIdx + 1, phaseTitleIdx + 6);
  if (!phaseHeader) return { error: "ما لقيت صف عناوين الأشهر تحت جدول المراحل خلال أول ٦ صفوف بعد العنوان — تأكد إن الشيت ما تغيّر شكله." };
  const phaseMonths = assignMonthKeys(phaseHeader.cols, firstColYear);
  if (!phaseMonths) return { error: "أعمدة الأشهر بجدول المراحل مو متتالية بشكل منتظم (شهر بعد شهر) — راجع الشيت أو صحّح السنة." };

  /* كل صف يُلقَط بمطابقة نصّه هو (مو بعدّ صفوف من العنوان) — ضمن نطاق واسع
     (١٥ صف) بعد صف عناوين الأشهر، يكفي أي صفوف فاضية أو ملاحظات إضافية بينهم. */
  const PHASE_ROW_DEFS = [
    { key: "total", needles: [normalizeArabic("اجمالي")] },
    { key: "p1", needles: [normalizeArabic("الأولى"), normalizeArabic("الاولى")] },
    { key: "p2", needles: [normalizeArabic("الثانية")] },
    { key: "p3", needles: [normalizeArabic("الثالثة")] },
    { key: "p4", needles: [normalizeArabic("الرابعة")] },
  ];
  const phaseValues = {}; const missingPhaseRows = []; const phaseRowIdx = {};
  PHASE_ROW_DEFS.forEach(({ key, needles }) => {
    const idx = findRowMatchingIn(raw, phaseHeader.idx + 1, phaseHeader.idx + 15, needles);
    phaseValues[key] = {};
    if (idx < 0) { missingPhaseRows.push(key); return; }
    phaseRowIdx[key] = idx;
    const row = raw[idx] || [];
    phaseMonths.forEach(({ col, key: mk }) => { phaseValues[key][mk] = toPct(row[col]); });
  });
  /* حماية صارمة: لو أي صف من الأربعة (p1-p4) ما انلقى بمطابقة محتواه، نوقف بخطأ
     صريح — بس صف "الإجمالي" نفسه معاملته مختلفة تحت (بعض التحديثات اليدوية على
     الملف تسيب خلية الإجمالي فاضية بعد ما تتعدَّل خلايا المراحل الأربعة يدويًا،
     لأنها كانت مرتبطة بصيغة حسابية انكسرت). */
  const missingRequired = missingPhaseRows.filter((k) => k !== "total");
  if (missingRequired.length) {
    return { error: `ما لقيت صف بيانات مطابق لـ: ${missingRequired.join("، ")} تحت جدول المراحل — توقّفت القراءة حماية من كتابة أرقام غلط. راجع شكل شيت KPIs.` };
  }
  /* تعويض تلقائي: لو خلية "الإجمالي" فاضية لشهر معيّن لكن كل المراحل الأربعة له
     معبّاة، نحسب الإجمالي كمتوسط المراحل الأربعة — نفس الأسلوب المعتمد فعليًا
     بملف تقدّم الوحدة (راجع عمود "ملاحظات" بشيت بيانات التقدم: "إجمالي المشروع =
     متوسط نسب المراحل الأربعة"). هذا يغطّي حالة تعديل خلايا المراحل يدويًا بدون
     ما ينكسر الإجمالي التابع لها. */
  const recoveredTotalMonths = [];
  phaseMonths.forEach(({ key: mk }) => {
    if (phaseValues.total[mk] == null) {
      const vals = ["p1", "p2", "p3", "p4"].map((k) => phaseValues[k][mk]);
      if (vals.every((v) => v != null)) {
        phaseValues.total[mk] = Math.round((vals.reduce((a, v) => a + v, 0) / 4) * 100) / 100;
        recoveredTotalMonths.push(mk);
      }
    }
  });
  if (recoveredTotalMonths.length) {
    warnings.push(`خلية "الإجمالي" كانت فاضية لأشهر (${recoveredTotalMonths.map((mk) => { const { y, m } = monthKeyParts(mk); return `${MONTH_AR[m - 1]} ${y}`; }).join("، ")})، فاتحسبت تلقائيًا كمتوسط المراحل الأربعة لذاك الشهر.`);
  }
  if (!Object.values(phaseValues.total).some((v) => v != null)) {
    return { error: "صف \"إجمالي المشروع\" موجود لكن كل قيمه فاضية حتى بعد محاولة حسابه من متوسط المراحل — يبدو إن الأعمدة انزاحت. توقّفت القراءة حماية من كتابة أرقام غلط." };
  }

  const blockTitleIdx = findRowIndexContaining(raw, normalizeArabic("حسب البلوك"));
  if (blockTitleIdx < 0) return { error: "ما لقيت عنوان جدول \"تقدم نسب الإنجاز - حسب البلوك\" بشيت KPIs." };
  let blockNumColIdx = -1;
  for (let i = blockTitleIdx; i <= blockTitleIdx + 3 && i < raw.length; i++) {
    const c = findColIndexInRow(raw[i] || [], normalizeArabic("رقم البلوك"));
    if (c >= 0) { blockNumColIdx = c; break; }
  }
  if (blockNumColIdx < 0) return { error: "ما لقيت عمود \"رقم البلوك\" بجدول البلوكات." };
  const blockHeader = findMonthHeaderRow(raw, blockTitleIdx + 1, blockTitleIdx + 6);
  if (!blockHeader) return { error: "ما لقيت صف عناوين الأشهر تحت جدول البلوكات." };
  const blockMonths = assignMonthKeys(blockHeader.cols, firstColYear);
  if (!blockMonths) return { error: "أعمدة الأشهر بجدول البلوكات مو متتالية بشكل منتظم — راجع الشيت أو صحّح السنة." };

  const blockValues = {};
  for (let i = blockHeader.idx + 1; i < raw.length; i++) {
    const row = raw[i] || [];
    const bnum = toNumOrNull(row[blockNumColIdx]);
    if (bnum == null) { if (Object.keys(blockValues).length) break; else continue; }
    blockValues[bnum] = {};
    blockMonths.forEach(({ col, key: mk }) => { blockValues[bnum][mk] = toPct(row[col]); });
  }
  if (!Object.keys(blockValues).length) return { error: "ما لقيت أي صف بلوك تحت جدول البلوكات." };

  const unknownBlocks = Object.keys(blockValues).map(Number).filter((b) => !(b in PG_BLOCK_PHASE));
  if (unknownBlocks.length) {
    warnings.push(`بلوكات جديدة ما إلها مرحلة معروفة بكود الموقع: ${unknownBlocks.join("، ")} — راح تظهر تحت "غير مصنّف" لين ما تُضاف لخريطة البلوكات بالكود.`);
  }

  const allMonthKeys = [...new Set([...phaseMonths.map((m) => m.key), ...blockMonths.map((m) => m.key)])].sort();
  const monthRows = allMonthKeys.map((mk) => ({
    month: mk,
    phases: Object.fromEntries(PHASE_ROW_KEYS.map((k) => [k, phaseValues[k]?.[mk] ?? null]).filter(([, v]) => v != null)),
    blocks: Object.fromEntries(Object.entries(blockValues).map(([b, vals]) => [b, vals[mk] ?? null]).filter(([, v]) => v != null)),
  }));
  const monthLabels = allMonthKeys.map((mk) => { const { y, m } = monthKeyParts(mk); return `${MONTH_AR[m - 1]} ${y}`; });

  return { sheetName, monthRows, warnings, monthLabels };
}

/* ── لوحة رفع ملف «تقدّم الوحدة والمراحل» — تكتب بجدول progress_matrix، ومنه
   يقرأ تبويب «تقدّم التنفيذ» بالموقع العام مباشرة (مباشرة عبر Supabase Realtime،
   بدون أي تعديل كود ولا إعادة نشر). خطوتين فقط: رفع الملف، ثم تأكيد التحديث. ── */
function ProgressMatrixSync({ flashToast, canImport, log }) {
  const T = useSystemTheme();
  const fileRef = useRef(null);
  const wbRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [firstYear, setFirstYear] = useState(new Date().getFullYear());
  const [current, setCurrent] = useState([]);
  const [applying, setApplying] = useState(false);

  const loadCurrent = () => supabase.from("progress_matrix").select("*").order("month").then(({ data }) => setCurrent(data || []));
  useEffect(() => { loadCurrent(); }, []);

  const runParse = (yr) => { setFirstYear(yr); if (wbRef.current) setParsed(parseKpiWorkbook(wbRef.current, yr)); };

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const ym = file.name.match(/20\d{2}/);
    const guessYear = ym ? Number(ym[0]) : new Date().getFullYear();
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: false });
        wbRef.current = wb;
        setFirstYear(guessYear);
        setParsed(parseKpiWorkbook(wb, guessYear));
      } catch { wbRef.current = null; setParsed({ error: "تعذّرت قراءة الملف — تأكد إنه ملف إكسل صالح (.xlsx)." }); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const currentByMonth = useMemo(() => new Map(current.map((r) => [r.month, r])), [current]);
  /* حماية من فقدان البيانات: لو الملف المرفوع أعطى عدد قيم أقل بكثير مما هو مسجّل
     فعليًا لشهر معيّن (يدل على خطأ بقراءة الملف، لا على تحديث حقيقي)، نستثني هذا
     الشهر تلقائيًا من التحديث بدل الكتابة فوق بيانات صحيحة ببيانات فاضية أو ناقصة —
     ويحتاج المدير تأكيد صريح لكل شهر منها لو كان فعلًا يقصد ذلك. */
  const diffSummary = useMemo(() => {
    if (!parsed || parsed.error) return null;
    return parsed.monthRows.map((row) => {
      const cur = currentByMonth.get(row.month);
      const isNew = !cur;
      const changed = !isNew && (JSON.stringify(cur.phases || {}) !== JSON.stringify(row.phases) || JSON.stringify(cur.blocks || {}) !== JSON.stringify(row.blocks));
      const curCount = isNew ? 0 : Object.keys(cur.phases || {}).length + Object.keys(cur.blocks || {}).length;
      const newCount = Object.keys(row.phases || {}).length + Object.keys(row.blocks || {}).length;
      const dataLoss = !isNew && curCount >= 4 && newCount < curCount / 2;
      return { ...row, isNew, changed, dataLoss };
    });
  }, [parsed, currentByMonth]);
  const [forceMonths, setForceMonths] = useState(new Set());
  const toggleForce = (mk) => setForceMonths((s) => { const n = new Set(s); n.has(mk) ? n.delete(mk) : n.add(mk); return n; });

  const writeMonth = async (r) => {
    const { error } = await supabase.from("progress_matrix").upsert(
      { month: r.month, phases: r.phases, blocks: r.blocks, updated_at: new Date().toISOString() },
      { onConflict: "month" }
    );
    return !error;
  };

  const apply = async () => {
    if (!canImport) { flashToast("ما عندك صلاحية \"رفع ومزامنة بيانات من إكسل\" اللازمة"); return; }
    if (!diffSummary || !diffSummary.length) return;
    const toWrite = diffSummary.filter((r) => !r.dataLoss || forceMonths.has(r.month));
    if (!toWrite.length) { flashToast("كل الأشهر مستثناة بسبب حماية فقدان البيانات — راجع التحذيرات."); return; }
    setApplying(true);
    try {
      const { data: backupRows } = await supabase.from("progress_matrix").select("*");
      await supabase.from("progress_matrix_backups").insert({
        label: `قبل رفع تقدّم الوحدة بتاريخ ${fmtAdminDate(new Date())}`,
        rows: backupRows || [],
      });
      const { data: oldBackups } = await supabase.from("progress_matrix_backups").select("id").order("created_at", { ascending: false });
      if (oldBackups && oldBackups.length > 5) {
        await supabase.from("progress_matrix_backups").delete().in("id", oldBackups.slice(5).map((b) => b.id));
      }
      const rows = toWrite.map((r) => ({ month: r.month, phases: r.phases, blocks: r.blocks, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("progress_matrix").upsert(rows, { onConflict: "month" });
      if (error) throw error;
      log("رفع بيانات تقدّم الوحدة (KPIs)", `${rows.length} شهر — ${fileName}`);
      const skipped = diffSummary.length - toWrite.length;
      flashToast(skipped > 0 ? `تم التحديث — استُثني ${skipped} شهر بسبب حماية فقدان البيانات` : "تم تحديث تقدّم التنفيذ بالموقع");
      setParsed(null); wbRef.current = null; setFileName(""); setForceMonths(new Set());
      loadCurrent();
    } catch {
      flashToast("تعذّر تحديث تقدّم التنفيذ — لم يتغيّر شي بالبيانات الحالية");
    }
    setApplying(false);
  };

  if (!canImport) return null;

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <TrendingUp size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>تحديث تقدّم الوحدة والمراحل (KPIs)</span>
      </div>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "4px 0 14px", lineHeight: 1.7 }}>
        ارفع نفس ملف «تقدم الوحدة والمراحل» كل شهر — يُقرأ شيت KPIs تلقائيًا (المراحل والبلوكات) ويحدّث تبويب «تقدّم التنفيذ» بالموقع العام مباشرة لكل الزوّار، بدون أي تعديل يدوي على الكود أو إعادة نشر.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, background: T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          <Upload size={15} /> رفع ملف تقدّم الوحدة
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
        {fileName && <span style={{ fontSize: 12, color: T.muted }}>{fileName}</span>}
      </div>

      {parsed?.error && (
        <div className="note-box" style={{ marginTop: 14, color: "#c0392b" }}>{parsed.error}</div>
      )}

      {parsed && !parsed.error && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, color: T.muted }}>سنة أول شهر بالملف ({parsed.monthLabels?.[0]?.split(" ")[0]}):</label>
            <input type="number" value={firstYear} onChange={(e) => runParse(Number(e.target.value))}
              style={{ width: 90, padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, fontSize: 13 }} />
            <span style={{ fontSize: 11.5, color: T.muted }}>عدّلها لو التخمين غلط — المعاينة تحت تتحدّث فورًا</span>
          </div>

          {parsed.warnings?.length > 0 && (
            <div className="note-box" style={{ marginBottom: 12, color: "#b8860b" }}>
              {parsed.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}

          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 8 }}>
            الأشهر المكتشفة: {parsed.monthLabels.join(" · ")}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {diffSummary.map((r) => (
              <div key={r.month} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: r.dataLoss ? "#c0392b22" : T.sunken, border: r.dataLoss ? "1px solid #c0392b" : "none", borderRadius: 9, padding: "8px 12px" }}>
                <span style={{ fontSize: 12.5 }}>{MONTH_AR[monthKeyParts(r.month).m - 1]} {monthKeyParts(r.month).y}</span>
                {r.dataLoss ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c0392b", cursor: "pointer" }}>
                    <input type="checkbox" checked={forceMonths.has(r.month)} onChange={() => toggleForce(r.month)} />
                    ⚠ الملف فيه بيانات أقل بكثير من المسجَّل — استُبعد تلقائيًا، أكّد هنا لو تقصد هذا فعلًا
                  </label>
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: r.isNew ? T.brass : r.changed ? "#b8860b" : T.muted }}>
                    {r.isNew ? "جديد" : r.changed ? "تغيّر" : "بدون تغيير"}
                  </span>
                )}
              </div>
            ))}
          </div>

          {diffSummary.some((r) => r.dataLoss) && (
            <div className="note-box" style={{ marginBottom: 12, color: "#c0392b" }}>
              ⚠ فيه أشهر مستبعدة تلقائيًا من هذا التحديث لأن الملف أعطى بيانات أقل بكثير مما هو مسجَّل حاليًا لها (يدل غالبًا على خطأ بقراءة الملف لا تحديث حقيقي). راجعها أعلاه، ولا تؤكّدها إلا لو متأكد إن الشهر فعلًا لازم يصير فاضي.
            </div>
          )}

          <button onClick={apply} disabled={applying} style={{ display: "flex", alignItems: "center", gap: 7, background: applying ? T.muted : T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: applying ? "wait" : "pointer" }}>
            <RefreshCw size={15} /> {applying ? "جارٍ التحديث..." : "تحديث الموقع الآن"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── تبويب المزامنة والتحرير اليدوي — يكتب فعليًا على جدول inquiries ── */
function ASyncTab({ inquiries, refreshInquiries, progress, refreshProgress, categories, refreshCategories, flashToast, canFlag, canImport, canAdd, canEdit, canDelete, log }) {
  const T = useSystemTheme();
  const fileRef = useRef(null);
  const [sheets, setSheets] = useState(null);
  const [mapping, setMapping] = useState({});
  const [stage, setStage] = useState(null); // null | "select" (اختيار الشيتات) | "results" (نتيجة المقارنة)
  const [diffResults, setDiffResults] = useState(null);
  const [newValues, setNewValues] = useState([]);
  const [newColumns, setNewColumns] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [applying, setApplying] = useState(false);
  /* ═══ أمان الرفع: نتحقق أول شي إذا عمود "cat" (الفئة) موجود فعلًا بجدول inquiries ═══
     لو قاعدة البيانات ما انحدّثت بعد بملف setup-supabase.sql، نشيل الحقل من كل عمليات
     الكتابة والمقارنة تلقائيًا — فتبقى مزامنة الإكسل شغّالة تمامًا زي قبل بدون أي خطأ،
     وتشتغل الفئة وحدها أول ما ينضاف العمود، بدون أي تعديل ثاني على الكود. */
  const [hasCatCol, setHasCatCol] = useState(true);
  useEffect(() => {
    supabase.from("inquiries").select("cat").limit(1).then(({ error }) => { if (error) setHasCatCol(false); });
  }, []);
  const INQ_FIELDS = useMemo(() => (hasCatCol ? INQ_FIELDS_ADMIN : INQ_FIELDS_ADMIN.filter((f) => f !== "cat")), [hasCatCol]);
  const stripCat = (obj) => { if (hasCatCol) return obj; const { cat, ...rest } = obj; return rest; };
  /* ═══ أمان الفرز: نتحقق إذا عمود "created_at" (تاريخ الإضافة) موجود فعلًا — لو قاعدة
     البيانات ما انحدّثت بعد بملف setup-supabase.sql، فرز "الأحدث إضافة" يرجع تلقائيًا
     لترتيب رقم الاستفسار بدل ما يسبب خطأ. ═══ */
  const [hasCreatedAtCol, setHasCreatedAtCol] = useState(true);
  useEffect(() => {
    supabase.from("inquiries").select("created_at").limit(1).then(({ error }) => { if (error) setHasCreatedAtCol(false); });
  }, []);
  const [sortBy, setSortBy] = useState("updated_desc");
  const SORT_OPTIONS = [
    { value: "updated_desc", label: "آخر تعديل" },
    { value: "created_desc", label: "أحدث إضافة" },
    { value: "id_asc", label: "الرقم" },
  ];
  const sortedInquiries = useMemo(() => {
    const arr = [...inquiries];
    if (sortBy === "updated_desc") return arr.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    if (sortBy === "created_desc" && hasCreatedAtCol) return arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) || b.id - a.id);
    return arr.sort((a, b) => a.id - b.id);
  }, [inquiries, sortBy, hasCreatedAtCol]);
  const rowDateLabel = (r) => {
    if (sortBy === "created_desc" && hasCreatedAtCol) return r.created_at ? `أُضيف: ${fmtAdminDate(r.created_at)}` : null;
    if (sortBy === "updated_desc") return r.updated_at ? `آخر تعديل: ${fmtAdminDate(r.updated_at)}` : null;
    return null;
  };
  const [backups, setBackups] = useState([]);
  const [restoring, setRestoring] = useState(null);
  const loadBackups = () => supabase.from("data_backups").select("*").order("created_at", { ascending: false }).then(({ data }) => setBackups(data || []));
  useEffect(() => { loadBackups(); }, []);
  const restoreBackup = async (b) => {
    if (!canImport) { flashToast("ما عندك صلاحية \"رفع ومزامنة بيانات من إكسل\" اللازمة للاسترجاع"); return; }
    setRestoring(b.id);
    const { error } = await supabase.rpc("restore_inquiries_backup", { p_backup_id: b.id });
    if (error) {
      flashToast("تعذّر الاسترجاع — لم يتغيّر شي بالبيانات الحالية");
    } else {
      log("استرجاع نسخة احتياطية", b.label);
      flashToast("تم الاسترجاع بنجاح");
    }
    setRestoring(null);
    refreshInquiries(); refreshProgress();
  };

  const guessTarget = (name) => { const n = name.toLowerCase(); if (n.includes("تقدم") || n.includes("progress")) return "progress"; return "inquiries"; };
  const guessMode = (name) => (/اجتماع|طلبات|ملاحظات/.test(name) ? "append" : "merge");
  /* يقارن قيمة حقل قادم من الملف (نص "نعم/لا" دائمًا بعد التطبيع) بقيمة الحقل بالسجل الحالي —
     يحوّل حقول boolean الحقيقية (زي answered) لنفس صيغة "نعم/لا" قبل المقارنة، وإلا أي مقارنة
     نصية بينها وبين true/false الفعلي بقاعدة البيانات كانت راح تفشل دائمًا وتُحسب "تغيّر" زورًا */
  const fieldsThatDiffer = (fields, row, cur) => fields.filter((f) => {
    const curVal = REAL_BOOL_FIELDS.includes(f) ? toYesNo(cur[f]) : cur[f];
    return String(row[f] ?? "") !== String(curVal ?? "");
  });
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inquiries.map(({ urgent, updated_at, ...r }) => r)), "الاستفسارات");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(progress), "تقدم_التنفيذ");
    XLSX.writeFile(wb, "قالب-البيانات.xlsx");
  };
  const runCompareWith = (parsedSheets, mapObj) => {
    const results = []; let scanRows = [];
    Object.entries(mapObj).forEach(([sheetName, cfg]) => {
      if (cfg.target === "ignore" || cfg.selected === false) return; // شيت غير مُختار بخطوة "اختيار الشيتات" أو مُستبعد يدويًا
      const rows = parsedSheets[sheetName]; const cfgTarget = ADMIN_TARGETS.find((t) => t.key === cfg.target);
      /* حقول المقارنة: للاستفسارات ناخذها من INQ_FIELDS (اللي يحذف "cat" لو العمود مو موجود بعد) */
      const cmpFields = cfg.target === "inquiries" ? INQ_FIELDS : cfgTarget.fields;
      const current = cfg.target === "inquiries" ? inquiries : progress; const keyField = cfgTarget.keyField;
      if (cfg.mode === "replace") { results.push({ sheetName, target: cfg.target, mode: "replace", newRows: rows, removedCount: current.length }); if (cfg.target === "inquiries") scanRows = scanRows.concat(rows); return; }
      if (cfg.mode === "append") {
        const tag = (cfg.tag ?? sheetName).trim();
        if (cfg.target !== "inquiries") { results.push({ sheetName, target: cfg.target, mode: "append", newRows: rows, tag }); return; }
        /* ═══ مطابقة محتوى ذكية بدل الإلحاق الأعمى — تقارن كل صف بالاستفسارات الموجودة أصلاً
           تحت نفس وسم الشيت (meetings) عن طريق تشابه نص الملاحظة، مو رقم تسلسلي (لأن كل شيت
           اجتماع يبدأ ترقيمه من ١ فيتعارض مع باقي الشيتات). هذا يمنع تكرار نفس الصفوف كل مرة
           يُرفع نفس الملف، ويكتشف التعديلات (رد جديد، تغيّر حالة..) على صف اتّفق مضمونه سابقًا ═══ */
        const existingTagged = current.filter((r) => Array.isArray(r.meetings) && r.meetings.includes(tag));
        const usedIds = new Set(); const added = []; const changed = [];
        rows.forEach((row) => {
          let bestRow = null, bestScore = 0;
          existingTagged.forEach((cur) => {
            if (usedIds.has(cur.id)) return;
            const s = textSimilarity(row.note || "", cur.note || "");
            if (s > bestScore) { bestScore = s; bestRow = cur; }
          });
          if (bestRow && bestScore >= 0.85) {
            usedIds.add(bestRow.id);
            const fdiffs = fieldsThatDiffer(cmpFields, row, bestRow);
            if (fdiffs.length) changed.push({ key: String(bestRow.id), row, cur: bestRow, fieldDiffs: fdiffs });
          } else {
            added.push(row);
          }
        });
        results.push({ sheetName, target: cfg.target, mode: "append", added, changed, tag });
        scanRows = scanRows.concat(added, changed.map((c) => c.row));
        return;
      }
      const currentByKey = new Map(current.map((r) => [String(r[keyField]), r]));
      const incomingKeys = new Set(); const added = []; const changed = [];
      rows.forEach((row) => {
        const k = String(row[keyField] ?? "").trim(); if (!k) return; incomingKeys.add(k);
        const cur = currentByKey.get(k);
        if (!cur) { added.push(row); return; }
        const fdiffs = fieldsThatDiffer(cmpFields, row, cur);
        if (fdiffs.length) changed.push({ key: k, row, cur, fieldDiffs: fdiffs });
      });
      const missing = current.filter((r) => !incomingKeys.has(String(r[keyField])));
      results.push({ sheetName, target: cfg.target, mode: "merge", added, changed, missing, keyField });
      if (cfg.target === "inquiries") scanRows = scanRows.concat(added, changed.map((c) => c.row));
    });
    setDiffResults(results);
    setStage("results");
    /* ذكي بالكامل: أي قيمة أو عمود جديد يُعتمد تلقائيًا كفلتر افتراضيًا — بدون ما تحتاج تراجعها وحدة وحدة،
       تقدر بس تلغي أي وحدة محددة لو ما تبيها قبل الاعتماد النهائي */
    setNewValues(findNewValuesAdmin(scanRows, categories).map((f) => ({ ...f, decision: "add" })));
    setNewColumns(findNewColumnsAdmin(scanRows, categories).map((f) => ({ ...f, decision: "add" })));
  };
  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
        const parsed = {}; wb.SheetNames.forEach((name) => { parsed[name] = smartSheetToJson(wb.Sheets[name], categories); });
        const initMap = {}; wb.SheetNames.forEach((name) => { initMap[name] = { target: guessTarget(name), mode: guessMode(name), selected: parsed[name].length > 0 }; });
        setSheets(parsed); setMapping(initMap); setDiffResults(null);
        setStage("select"); /* الخطوة الأولى: اختيار الشيتات ومراجعة طريقة التعامل معها قبل أي مقارنة */
      } catch { flashToast("تعذّرت قراءة الملف"); }
    };
    reader.readAsArrayBuffer(file); e.target.value = "";
  };
  const runCompare = () => runCompareWith(sheets, mapping);
  const toggleSheetSelected = (name) => setMapping((m) => ({ ...m, [name]: { ...m[name], selected: m[name]?.selected === false } }));
  const decideAllValues = (decision) => setNewValues((prev) => prev.map((v) => ({ ...v, decision })));
  const setColDecision = (col, decision) => setNewColumns((prev) => prev.map((c) => (c.column === col ? { ...c, decision } : c)));
  const decideAllCols = (decision) => setNewColumns((prev) => prev.map((c) => ({ ...c, decision })));

  const autoTranslate = async (obj) => {
    const out = { ...obj };
    try {
      if (out.note && !out.note_en) {
        const { data } = await supabase.functions.invoke("translate-text", { body: { text: out.note } });
        if (data?.translated) out.note_en = data.translated;
      }
      if (out.reply && !out.reply_en) {
        const { data } = await supabase.functions.invoke("translate-text", { body: { text: out.reply } });
        if (data?.translated) out.reply_en = data.translated;
      }
    } catch { /* لو فشلت الترجمة نكمل بدونها — ما توقف المزامنة */ }
    return out;
  };
  /* ترجمة خلفية غير معطّلة — تشتغل بعد اعتماد المزامنة بدون ما توقف الواجهة، وحدة وحدة بفاصل بسيط
     عشان ما نضغط على خدمة الترجمة المجانية دفعة وحدة */
  const backgroundTranslate = async (ids) => {
    for (const id of ids) {
      try {
        const { data: row } = await supabase.from("inquiries").select("note,note_en,reply,reply_en").eq("id", id).single();
        if (!row) continue;
        const patch = {};
        if (row.note && !row.note_en) {
          const { data } = await supabase.functions.invoke("translate-text", { body: { text: row.note } });
          if (data?.translated) patch.note_en = data.translated;
        }
        if (row.reply && !row.reply_en) {
          const { data } = await supabase.functions.invoke("translate-text", { body: { text: row.reply } });
          if (data?.translated) patch.reply_en = data.translated;
        }
        if (Object.keys(patch).length) await supabase.from("inquiries").update(patch).eq("id", id);
      } catch { /* نتجاوز أي صف فشلت ترجمته ونكمل الباقي */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    refreshInquiries();
  };
  /* يبني كائن الحقول الجاهز للكتابة الفعلية بقاعدة البيانات — يحوّل حقول boolean الحقيقية
     (answered) من نص "نعم/لا" إلى true/false فعلي، ويترك closed كنص زي ما هو (عمود نصي) */
  const buildInsertPayload = (r) => Object.fromEntries(INQ_FIELDS.map((f) =>
    REAL_BOOL_FIELDS.includes(f) ? [f, toDbBool(r[f] ?? "لا")] : [f, r[f] ?? ""]
  ));
  const buildPatchPayload = (r) => Object.fromEntries(
    INQ_FIELDS.map((f) => [f, r[f]]).filter(([, v]) => v !== undefined)
      .map(([f, v]) => (REAL_BOOL_FIELDS.includes(f) ? [f, toDbBool(v)] : [f, v]))
  );
  const applyAll = async () => {
    setApplying(true);
    let count = 0;
    try {
      // نسخة احتياطية تلقائية قبل أي تعديل — نحتفظ بآخر نسختين فقط غير النسخة الجديدة
      const { data: backupInq } = await supabase.from("inquiries").select("*");
      const { data: backupProg } = await supabase.from("progress").select("*");
      await supabase.from("data_backups").insert({
        label: `قبل مزامنة بتاريخ ${fmtAdminDate(new Date())}`,
        inquiries: backupInq || [], progress: backupProg || [],
      });
      const { data: allBackups } = await supabase.from("data_backups").select("id").order("created_at", { ascending: false });
      if (allBackups && allBackups.length > 2) {
        const idsToDelete = allBackups.slice(2).map((b) => b.id);
        await supabase.from("data_backups").delete().in("id", idsToDelete);
      }

      let nextAppendId = inquiries.length ? Math.max(...inquiries.map((r) => r.id)) + 1 : 1;
      const todayISOOuter = new Date().toISOString().slice(0, 10);
      const pendingTranslateIds = [];
      for (const res of diffResults) {
        if (res.target === "inquiries") {
          if (res.mode === "replace") {
            const rows = res.newRows.map((r) => ({ ...buildInsertPayload(r), id: Number(r.id), urgent: false }));
            const { error } = await supabase.rpc("replace_inquiries_full", { p_rows: rows });
            if (error) throw error;
            rows.forEach((r) => { if (r.note && !r.note_en) pendingTranslateIds.push(r.id); });
            count += rows.length;
          } else if (res.mode === "append") {
            const newRows = res.added.map((r) => ({ ...buildInsertPayload(r), id: nextAppendId++, urgent: false, last_modified: todayISOOuter, meetings: res.tag ? [res.tag] : [] }));
            if (newRows.length) await supabase.from("inquiries").insert(newRows);
            newRows.forEach((r) => { if (r.note && !r.note_en) pendingTranslateIds.push(r.id); });
            for (const { key, row } of res.changed || []) {
              const patch = buildPatchPayload(row);
              await supabase.from("inquiries").update(patch).eq("id", Number(key));
              if (patch.note && !patch.note_en) pendingTranslateIds.push(Number(key));
            }
            count += newRows.length + (res.changed ? res.changed.length : 0);
          } else {
            for (const { key, row } of res.changed) {
              const patch = buildPatchPayload(row);
              await supabase.from("inquiries").update(patch).eq("id", Number(key));
              if (patch.note && !patch.note_en) pendingTranslateIds.push(Number(key));
            }
            // العناصر المضافة فعليًا (مو المعدّلة) توسم "جديد" تلقائيًا لمدة ٧ أيام
            const todayISO = new Date().toISOString().slice(0, 10);
            const newRows = res.added.map((row) => ({ ...buildInsertPayload(row), id: Number(row.id), urgent: false, last_modified: todayISO }));
            if (newRows.length) await supabase.from("inquiries").insert(newRows);
            newRows.forEach((r) => { if (r.note && !r.note_en) pendingTranslateIds.push(r.id); });
            count += res.added.length + res.changed.length;
          }
        } else if (res.target === "progress") {
          if (res.mode === "replace") {
            const { error } = await supabase.rpc("replace_progress_full", { p_rows: res.newRows });
            if (error) throw error;
            count += res.newRows.length;
          } else {
            for (const { key, row } of res.changed) await supabase.from("progress").update({ planned: row.planned, actual: row.actual }).eq("month", key);
            if (res.added.length) await supabase.from("progress").insert(res.added);
            count += res.added.length + res.changed.length;
          }
        }
      }
      const addVals = newValues.filter((v) => v.decision === "add");
      const addCols = newColumns.filter((c) => c.decision === "add");
      for (const v of addVals) {
        const cat = categories.find((c) => c.key === v.categoryKey);
        if (cat) await supabase.from("filter_categories").update({ values: [...(cat.values || []), v.value] }).eq("key", cat.key);
      }
      for (const c of addCols) {
        await supabase.from("filter_categories").insert({ key: `custom-col-${Date.now()}-${c.column}`, label: c.column, locked: false, values: c.values });
      }
      if (addVals.length || addCols.length) await refreshCategories();
      if (addVals.length) log("إضافة قيم فلترة تلقائيًا", addVals.map((v) => `${v.value} → ${v.categoryLabel}`).join("، "));
      addCols.forEach((c) => log("إنشاء فئة فلترة من عمود جديد", `"${c.column}" بقيم: ${c.values.join("، ")}`));
      log("مزامنة بيانات", `تم اعتماد ${count} عنصر عبر ${diffResults.length} شيت`);
      await refreshInquiries(); await refreshProgress();
      flashToast(`تم تحديث الموقع بالكامل — ${count} عنصر`);
      loadBackups();
      setSheets(null); setDiffResults(null); setNewValues([]); setNewColumns([]); setStage(null);
      /* الترجمة تصير بالخلفية بدون ما توقّف الحفظ — عشان ما تعلّق الاعتماد لو فيها عدد كبير من الصفوف */
      if (pendingTranslateIds.length) backgroundTranslate(pendingTranslateIds);
    } catch (err) {
      flashToast("صار خطأ أثناء الحفظ — تأكد إن جداول Supabase مجهّزة (setup-supabase.sql)");
    }
    setApplying(false);
  };

  /* ═══ وسوم "يجب الاطلاع" و"مهم" — عند التفعيل تُختار مدة: ٣ أيام، ٧ أيام، أو دائم.
     التفعيل الدائم يستخدم الحقل المنطقي (urgent/important)، والمؤقت يستخدم حقل
     الـ_until (تاريخ انتهاء) — العرض العام يحسب الحالة الفعلية من الاثنين معًا. ═══ */
  const [flagPicker, setFlagPicker] = useState(null); // { id, key: "urgent" | "important" }
  const isFlagActive = (r, key) => isFlagLive(r[FLAG_META[key].boolField], r[FLAG_META[key].untilField]);
  const applyFlag = async (r, key, choice) => {
    const meta = FLAG_META[key];
    const patch = choice === "clear" ? { [meta.boolField]: false, [meta.untilField]: null }
      : choice === "forever" ? { [meta.boolField]: true, [meta.untilField]: null }
      : { [meta.boolField]: false, [meta.untilField]: new Date(Date.now() + choice * 86400000).toISOString() };
    await supabase.from("inquiries").update(patch).eq("id", r.id);
    const actionLabel = choice === "clear" ? "إلغاء" : choice === "forever" ? "تفعيل دائم" : `تفعيل لمدة ${choice} أيام`;
    log(`تعديل وسم "${meta.labelAr}"`, `${actionLabel} على الاستفسار #${r.id}`);
    setFlagPicker(null);
    refreshInquiries();
  };
  const flagButtonClick = (r, key) => {
    if (isFlagActive(r, key)) { applyFlag(r, key, "clear"); return; }
    setFlagPicker((p) => (p && p.id === r.id && p.key === key) ? null : { id: r.id, key });
  };
  const isMarkedNew = (r) => { if (!r.last_modified) return false; const days = (Date.now() - new Date(r.last_modified + "T00:00:00").getTime()) / 86400000; return days >= 0 && days <= 7; };
  const toggleNew = async (r) => {
    const newVal = isMarkedNew(r) ? null : new Date().toISOString().slice(0, 10);
    await supabase.from("inquiries").update({ last_modified: newVal }).eq("id", r.id);
    log("تعديل وسم جديد", `${newVal ? "تفعيل" : "إلغاء"} علامة "جديد" على الاستفسار #${r.id}`);
    refreshInquiries();
  };
  const startAdd = () => { setEditing("new"); setForm({ ...ADMIN_BLANK_INQ }); };
  const startEdit = (r) => { setEditing(r.id); setForm({ ...r, closed: r.closed, answered: toYesNo(r.answered) }); };
  const saveForm = async () => {
    if (!form.note?.trim()) { flashToast("لازم نص الملاحظة على الأقل"); return; }
    const translatedForm = await autoTranslate(canonicalizeRow(form, categories));
    const payload = stripCat({ ...translatedForm, answered: toDbBool(translatedForm.answered) });
    if (editing === "new") {
      const nextId = inquiries.length ? Math.max(...inquiries.map((r) => r.id)) + 1 : 1;
      await supabase.from("inquiries").insert({ ...payload, id: nextId, urgent: false });
      log("إضافة استفسار يدويًا", `#${nextId} — ${form.note.slice(0, 40)}`); flashToast("تمت الإضافة");
    } else {
      await supabase.from("inquiries").update(payload).eq("id", editing);
      log("تعديل استفسار يدويًا", `#${editing} — ${form.note.slice(0, 40)}`); flashToast("تم الحفظ");
    }
    setEditing(null); setForm(null); refreshInquiries();
  };
  const confirmDelete = async (r) => {
    await supabase.from("inquiries").delete().eq("id", r.id);
    log("حذف استفسار يدويًا", `#${r.id} — ${(r.note || "").slice(0, 40)}`);
    flashToast("تم الحذف"); setConfirmDeleteId(null); refreshInquiries();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {canImport && (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><FileSpreadsheet size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>مزامنة من ملف إكسل</span></div>
        <p style={{ fontSize: 12.5, color: T.muted, margin: "4px 0 14px", lineHeight: 1.7 }}>حدد لكل شيت وش يمثّل، وراجع الفروقات قبل الاعتماد — التغييرات تُكتب مباشرة بقاعدة البيانات.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, background: T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Upload size={15} /> رفع ملف إكسل</button>
          <button onClick={downloadTemplate} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", color: T.brass, border: `1px solid ${T.brass}55`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Download size={15} /> تنزيل قالب</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
        </div>
      </div>
      )}

      {canImport && <ProgressMatrixSync flashToast={flashToast} canImport={canImport} log={log} />}

      {canImport && backups.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><History size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>نسخ احتياطية</span></div>
          <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 12px", lineHeight: 1.7 }}>تُؤخذ تلقائيًا قبل كل مزامنة إكسل — يُحتفظ بآخر نسختين فقط. لو صار خطأ بمزامنة، ترجع بضغطة وحدة.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {backups.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 10, padding: "10px 12px" }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{(b.inquiries || []).length} استفسار · {(b.progress || []).length} صف تقدّم</div>
                </div>
                <button onClick={() => restoreBackup(b)} disabled={restoring === b.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${T.brass}55`, color: T.brass, borderRadius: 9, padding: "7px 12px", fontSize: 11.5, fontWeight: 600, cursor: restoring === b.id ? "wait" : "pointer" }}>
                  <RefreshCw size={12} /> {restoring === b.id ? "جارٍ الاسترجاع..." : "استرجاع هذي النسخة"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sheets && stage === "select" && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>الخطوة ١ — اختر الشيتات اللي تبي تقارنها</div>
          <p style={{ fontSize: 12, color: T.muted, margin: "0 0 14px" }}>ألغِ تحديد أي شيت ما تبي يدخل بالمقارنة (مثل شيتات مرجعية بلا بيانات فعلية). النظام حدد الباقي تلقائيًا — عدّل بس لو تبي تغيّر شي.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.keys(sheets).map((name) => {
              const on = mapping[name]?.selected !== false;
              return (
                <div key={name} style={{ background: T.sunken, borderRadius: 12, padding: 14, opacity: on ? 1 : 0.55 }}>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: on ? 10 : 0, cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <input type="checkbox" checked={on} onChange={() => toggleSheetSelected(name)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
                    </span>
                    <span style={{ fontSize: 11, color: T.faint }}>{sheets[name].length} صف</span>
                  </label>
                  {on && (<>
                    <ASegmented value={mapping[name]?.target} onChange={(v) => setMapping((m) => ({ ...m, [name]: { ...m[name], target: v } }))} options={ADMIN_TARGETS.map((t) => ({ value: t.key, label: t.label }))} />
                    {mapping[name]?.target !== "ignore" && <div style={{ marginTop: 8 }}><ASegmented value={mapping[name]?.mode} onChange={(v) => setMapping((m) => ({ ...m, [name]: { ...m[name], mode: v } }))} options={[{ value: "merge", label: "مقارنة وتحديث" }, { value: "append", label: "➕ إلحاق ذكي" }, { value: "replace", label: "⚠️ استبدال كامل" }]} /></div>}
                    {mapping[name]?.mode === "append" && mapping[name]?.target === "inquiries" && (
                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>تسمية الفلتر (يظهر بالموقع العام — تقدر تعدله)</label>
                        <input value={mapping[name]?.tag ?? name} onChange={(e) => setMapping((m) => ({ ...m, [name]: { ...m[name], tag: e.target.value } }))} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5, background: T.sunken }} />
                      </div>
                    )}
                  </>)}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={runCompare} style={{ display: "flex", alignItems: "center", gap: 7, background: T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><RefreshCw size={14} /> قارن الآن</button>
            <button onClick={() => { setSheets(null); setMapping({}); setStage(null); }} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}

      {diffResults && stage === "results" && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>الخطوة ٢ — نتيجة المقارنة</span>
            <button onClick={() => setStage("select")} style={{ background: "none", border: "none", color: T.brass, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>تعديل اختيار الشيتات</button>
          </div>
          {(() => {
            const totals = diffResults.reduce((acc, res) => {
              if (res.mode === "replace") { acc.added += res.newRows.length; acc.removed += res.removedCount; }
              else if (res.mode === "append") { acc.added += (res.added ? res.added.length : res.newRows.length); acc.changed += (res.changed ? res.changed.length : 0); }
              else { acc.added += res.added.length; acc.changed += res.changed.length; acc.missing += res.missing.length; }
              return acc;
            }, { added: 0, changed: 0, missing: 0, removed: 0 });
            const parts = [];
            if (totals.added) parts.push(`${totals.added} استفسار جديد`);
            if (totals.changed) parts.push(`${totals.changed} تحديث على استفسارات موجودة`);
            if (totals.missing) parts.push(`${totals.missing} موجودة بالقاعدة وغير موجودة بالملف`);
            if (totals.removed) parts.push(`${totals.removed} سيُحذف بالاستبدال الكامل`);
            const summary = parts.length ? `قارنت ${diffResults.length} شيت بكل الاستفسارات الحالية: ${parts.join("، ")}.` : `قارنت ${diffResults.length} شيت بكل الاستفسارات الحالية — ما فيه أي فرق، البيانات مطابقة تمامًا.`;
            return <p style={{ fontSize: 12.5, color: T.paper, margin: "0 0 14px", lineHeight: 1.8, background: T.sunken, borderRadius: 10, padding: "10px 12px" }}>{summary}</p>;
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {diffResults.map((res) => (
              <div key={res.sheetName}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: T.muted }}>شيت "{res.sheetName}" ← {ADMIN_TARGETS.find((t) => t.key === res.target).label}</div>
                {res.mode === "replace" ? (
                  <div style={{ background: "#C0392B14", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, color: "#C0392B" }}>⚠️ سيُحذف {res.removedCount} ويُستبدل بـ {res.newRows.length} جديد.</div>
                ) : res.mode === "append" ? (
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {res.added.length === 0 && (!res.changed || res.changed.length === 0) ? <span style={{ fontSize: 12.5, color: T.muted }}>لا فرق — كل الصفوف موجودة أصلًا بنفس المحتوى.</span> : <>
                        {res.added.length > 0 && <ABadge kind="add">{res.added.length} جديد فعليًا</ABadge>}
                        {res.changed && res.changed.length > 0 && <ABadge kind="change">{res.changed.length} تحديث على صفوف مطابقة سابقًا</ABadge>}
                      </>}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>الجديد سيُوسم بفلتر: <b style={{ color: T.brass }}>{res.tag}</b> — النظام اكتشف الصفوف المكررة بمطابقة نص الملاحظة، فما راح تتكرر لو رفعت نفس الملف مرة ثانية.</div>
                    <DiffChangeList changed={res.changed} T={T} />
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {res.added.length === 0 && res.changed.length === 0 && res.missing.length === 0 ? <span style={{ fontSize: 12.5, color: T.muted }}>لا فرق.</span> : <>
                        {res.added.length > 0 && <ABadge kind="add">{res.added.length} جديد</ABadge>}
                        {res.changed.length > 0 && <ABadge kind="change">{res.changed.length} تغيّر</ABadge>}
                        {res.missing.length > 0 && <ABadge kind="missing">{res.missing.length} ناقص</ABadge>}
                      </>}
                    </div>
                    <DiffChangeList changed={res.changed} T={T} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {newValues.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px dashed ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><Sparkles size={15} color={T.brass} /><span style={{ fontSize: 13, fontWeight: 700 }}>قيم جديدة داخل فلاتر موجودة — راح تُضاف تلقائيًا</span></div>
              <p style={{ fontSize: 11.5, color: T.muted, margin: "0 0 10px" }}>معتمدة كلها افتراضيًا. لغِ أي واحدة لو ما تبيها.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => decideAllValues("add")} style={{ fontSize: 11.5, background: "#1E8E5A14", color: "#1E8E5A", border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}>تحديد الكل: إضافة</button>
                <button onClick={() => decideAllValues("skip")} style={{ fontSize: 11.5, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}>تحديد الكل: تجاهل</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {newValues.map((v) => { const sig = v.categoryKey + "::" + v.value; return (
                  <div key={sig} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 10, padding: "8px 12px" }}>
                    <span style={{ fontSize: 12.5 }}><b>{v.value}</b> <span style={{ color: T.faint }}>← {v.categoryLabel}</span></span>
                    <ASegmented value={v.decision} onChange={(d) => setValueDecision(sig, d)} options={[{ value: "add", label: "إضافة كفلتر" }, { value: "skip", label: "تجاهل" }]} />
                  </div>
                );})}
              </div>
            </div>
          )}

          {newColumns.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px dashed ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><ListPlus size={15} color={T.brass} /><span style={{ fontSize: 13, fontWeight: 700 }}>أعمدة جديدة كليًا بالملف — راح تُنشأ كفلاتر تلقائيًا</span></div>
              <p style={{ fontSize: 11.5, color: T.muted, margin: "0 0 10px" }}>معتمدة كلها افتراضيًا. لغِ أي واحدة لو ما تبيها.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => decideAllCols("add")} style={{ fontSize: 11.5, background: "#1E8E5A14", color: "#1E8E5A", border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}>تحديد الكل: إنشاء فئة</button>
                <button onClick={() => decideAllCols("skip")} style={{ fontSize: 11.5, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}>تحديد الكل: تجاهل</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {newColumns.map((c) => (
                  <div key={c.column} style={{ background: T.sunken, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{c.column} <span style={{ color: T.faint, fontWeight: 500 }}>({c.values.length} قيمة)</span></span>
                      <ASegmented value={c.decision} onChange={(d) => setColDecision(c.column, d)} options={[{ value: "add", label: "إنشاء فئة" }, { value: "skip", label: "تجاهل" }]} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{c.values.slice(0, 8).map((v) => <span key={v} style={{ fontSize: 11, background: T.surface, borderRadius: 999, padding: "2px 8px", border: `1px solid ${T.line}` }}>{v}</span>)}{c.values.length > 8 && <span style={{ fontSize: 11, color: T.faint }}>+{c.values.length - 8}</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={applyAll} disabled={applying} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: applying ? "wait" : "pointer", opacity: applying ? .7 : 1 }}><Check size={15} /> {applying ? "جارٍ الحفظ..." : "اعتماد كل شي"}</button>
            <button onClick={() => { setSheets(null); setMapping({}); setDiffResults(null); setNewValues([]); setNewColumns([]); setStage(null); }} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}><X size={15} /> تجاهل الكل</button>
          </div>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>الاستفسارات الحالية ({inquiries.length})</span>
          <button onClick={startAdd} disabled={!canAdd} style={{ display: "flex", alignItems: "center", gap: 6, background: canAdd ? T.brass : T.line, color: "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: canAdd ? "pointer" : "not-allowed", opacity: canAdd ? 1 : .6 }}><PlusCircle size={13} /> إضافة يدويًا</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, color: T.muted, flexShrink: 0 }}>الفرز:</span>
          <ASegmented value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sortedInquiries.map((r) => (
            <div key={r.id} style={{ background: T.sunken, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button disabled={!canFlag} onClick={() => flagButtonClick(r, "urgent")} title={isFlagActive(r, "urgent") ? "إلغاء علامة \"يجب الاطلاع\" عن هذا الاستفسار بالموقع العام" : "إظهار علامة \"يجب الاطلاع\" واختيار مدتها"} style={{ flexShrink: 0, background: isFlagActive(r, "urgent") ? "#B8790F" : T.line, border: "none", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: canFlag ? "pointer" : "not-allowed", opacity: canFlag ? 1 : .5 }}>
                  <ShieldAlert size={14} color={isFlagActive(r, "urgent") ? "#fff" : T.faint} />
                </button>
                <button disabled={!canFlag} onClick={() => toggleNew(r)} title={isMarkedNew(r) ? "إلغاء وسم جديد" : "وسم كـ جديد (٧ أيام)"} style={{ flexShrink: 0, background: isMarkedNew(r) ? T.brass : T.line, border: "none", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: canFlag ? "pointer" : "not-allowed", opacity: canFlag ? 1 : .5 }}>
                  <Sparkles size={14} color={isMarkedNew(r) ? "#fff" : T.faint} />
                </button>
                <button disabled={!canFlag} onClick={() => flagButtonClick(r, "important")} title={isFlagActive(r, "important") ? "إلغاء علامة \"مهم\" عن هذا الاستفسار بالموقع العام" : "إظهار علامة \"مهم\" واختيار مدتها"} style={{ flexShrink: 0, background: isFlagActive(r, "important") ? "#C0392B" : T.line, border: "none", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: canFlag ? "pointer" : "not-allowed", opacity: canFlag ? 1 : .5 }}>
                  <AlertTriangle size={14} color={isFlagActive(r, "important") ? "#fff" : T.faint} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, display: "flex", gap: 8, minWidth: 0 }}>
                    <span style={{ color: T.faint, fontWeight: 700, flexShrink: 0 }}>#{r.id}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{r.note}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{r.model} · {r.loc} · {r.status}{r.cat ? ` · ${r.cat}` : ""}{rowDateLabel(r) ? ` · ${rowDateLabel(r)}` : ""}</div>
                </div>
                {canEdit && <button onClick={() => startEdit(r)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted, flexShrink: 0 }}><Pencil size={12} /></button>}
                {canDelete && (confirmDeleteId === r.id ? (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => confirmDelete(r)} style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "0 8px", fontSize: 11, cursor: "pointer" }}>تأكيد</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "0 8px", fontSize: 11, cursor: "pointer", color: T.muted }}>لا</button>
                  </div>
                ) : (<button onClick={() => setConfirmDeleteId(r.id)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C0392B", flexShrink: 0 }}><Trash2 size={12} /></button>))}
              </div>
              {flagPicker && flagPicker.id === r.id && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "7px 9px", borderRadius: 10, background: T.surface, border: `1px solid ${T.line}` }}>
                  <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>مدة "{FLAG_META[flagPicker.key].labelAr}":</span>
                  <button onClick={() => applyFlag(r, flagPicker.key, 3)} style={{ fontSize: 11.5, background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer", color: T.paper }}>٣ أيام</button>
                  <button onClick={() => applyFlag(r, flagPicker.key, 7)} style={{ fontSize: 11.5, background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer", color: T.paper }}>٧ أيام</button>
                  <button onClick={() => applyFlag(r, flagPicker.key, "forever")} style={{ fontSize: 11.5, background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer", color: T.paper }}>دائم</button>
                  <button onClick={() => setFlagPicker(null)} style={{ marginRight: "auto", background: "none", border: "none", color: T.faint, cursor: "pointer", display: "flex" }}><X size={13} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {form && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{editing === "new" ? "إضافة استفسار يدويًا" : `تعديل الاستفسار #${editing}`}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {afieldInput(ADMIN_FIELD_LABEL.model, form.model, (v) => setForm((f) => ({ ...f, model: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.loc, form.loc, (v) => setForm((f) => ({ ...f, loc: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.pri, form.pri, (v) => setForm((f) => ({ ...f, pri: v })), ["عالية جدًا", "عالية", "متوسطة", "عادية"])}
            {afieldInput(ADMIN_FIELD_LABEL.cat, form.cat ?? "", (v) => setForm((f) => ({ ...f, cat: v })), ["", ...CAT_ORDER])}
            {afieldInput(ADMIN_FIELD_LABEL.status, form.status, (v) => setForm((f) => ({ ...f, status: v })), ["معتمدة", "قيد الدراسة", "تم التصويت", "تم الرفض"])}
            {afieldInput(ADMIN_FIELD_LABEL.owner, form.owner, (v) => setForm((f) => ({ ...f, owner: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.month, form.month, (v) => setForm((f) => ({ ...f, month: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.closed, form.closed, (v) => setForm((f) => ({ ...f, closed: v })), ["نعم", "لا"])}
            {afieldInput(ADMIN_FIELD_LABEL.answered, form.answered, (v) => setForm((f) => ({ ...f, answered: v })), ["نعم", "لا"])}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {afieldInput(ADMIN_FIELD_LABEL.note, form.note, (v) => setForm((f) => ({ ...f, note: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.note_en, form.note_en, (v) => setForm((f) => ({ ...f, note_en: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.reply, form.reply, (v) => setForm((f) => ({ ...f, reply: v })))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveForm} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Check size={15} /> حفظ</button>
            <button onClick={() => { setEditing(null); setForm(null); }} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── الزيارات والتحليلات — يقرأ من جدول logs الحقيقي ── */
function AAnalyticsTab({ flashToast, canExport }) {
  const T = useSystemTheme();
  const today = new Date();
  const [from, setFrom] = useState(isoAdminDate(new Date(today - 6 * 86400000)));
  const [to, setTo] = useState(isoAdminDate(today));
  const [rangeReady, setRangeReady] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState(new Set(ADMIN_EVENT_TYPES.map((t) => t.key)));
  const [events, setEvents] = useState([]); const [loading, setLoading] = useState(true);
  const [todaysVisits, setTodaysVisits] = useState(0);
  const [typeCounts, setTypeCounts] = useState({});
  const [refreshTick, setRefreshTick] = useState(0);

  /* افتراضيًا نعرض كل السجل من أول يوم — نجيب أقدم تاريخ فعلي بدل ما نفترض مدة ثابتة */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("logs").select("created_at").order("created_at", { ascending: true }).limit(1);
      if (data && data.length) setFrom(isoAdminDate(new Date(data[0].created_at)));
      setRangeReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!rangeReady) return;
    setLoading(true);
    (async () => {
      const gte = from + "T00:00:00", lte = to + "T23:59:59";

      /* الأرقام بالبطاقة الشاملة: عدّ حقيقي مباشر من قاعدة البيانات لكل نوع — بدون سقف الـ 1000 صف
         (استعلام count فقط، ما يجيب صفوف، فيرجع الرقم الحقيقي الكامل دايمًا) */
      const counts = {};
      await Promise.all(ADMIN_EVENT_TYPES.map(async (t) => {
        const { count } = await supabase.from("logs").select("id", { count: "exact", head: true })
          .eq("event_type", t.key).gte("created_at", gte).lte("created_at", lte);
        counts[t.key] = count || 0;
      }));
      setTypeCounts(counts);

      /* الصفوف التفصيلية (للمعاينة والتصدير) — نجيبها بالكامل عبر ترقيم صفحات يتجاوز سقف الـ 1000 صف الافتراضي */
      let all = []; let from_i = 0; const page = 1000;
      while (true) {
        const { data, error } = await supabase.from("logs").select("*")
          .gte("created_at", gte).lte("created_at", lte)
          .order("created_at", { ascending: false }).range(from_i, from_i + page - 1);
        if (error || !data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < page) break;
        from_i += page;
        if (all.length > 50000) break; // سقف أمان
      }
      setEvents(all); setLoading(false);

      const { count: tv } = await supabase.from("logs").select("id", { count: "exact", head: true })
        .eq("event_type", "visit").gte("created_at", isoAdminDate(today) + "T00:00:00");
      setTodaysVisits(tv || 0);
    })();
  }, [from, to, rangeReady, refreshTick]);

  const toggleType = (key) => setSelectedTypes((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const filtered = events.filter((e) => selectedTypes.has(e.event_type));
  const inquiryOpensInRange = filtered.filter((e) => e.event_type === "inquiry_open").length;
  const uniqueSessions = new Set(filtered.map((e) => e.session_id)).size;
  const setPreset = (days) => { setFrom(isoAdminDate(new Date(today - days * 86400000))); setTo(isoAdminDate(today)); };
  const setAllTime = async () => {
    const { data } = await supabase.from("logs").select("created_at").order("created_at", { ascending: true }).limit(1);
    if (data && data.length) setFrom(isoAdminDate(new Date(data[0].created_at)));
    setTo(isoAdminDate(today));
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // ورقة الملخص الشامل — أول ورقة تفتح، نظرة سريعة على كل شي
    const uniqueSessionsAll = new Set(filtered.map((e) => e.session_id)).size;
    const summaryRows = [
      { "البند": "الفترة", "القيمة": `${from} إلى ${to}` },
      { "البند": "إجمالي الأحداث", "القيمة": filtered.length },
      { "البند": "زوّار مميّزون بالفترة", "القيمة": uniqueSessionsAll },
      { "البند": "تاريخ إصدار التقرير", "القيمة": fmtAdminDate(new Date()) },
      {},
      { "البند": "نوع الحدث", "القيمة": "العدد" },
      ...ADMIN_EVENT_TYPES.map((t) => ({ "البند": t.label, "القيمة": filtered.filter((e) => e.event_type === t.key).length })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true }), "ملخص شامل");

    // ورقة مستقلة لكل نوع حدث فيه بيانات
    ADMIN_EVENT_TYPES.forEach((t) => {
      const rows = filtered.filter((e) => e.event_type === t.key);
      if (!rows.length) return;
      const sheetRows = rows.map((e) => ({ "تصنيف": e.category ?? "", "قيمة": e.value ?? "", "الجلسة": e.session_id, "التاريخ والوقت": fmtAdminDate(e.created_at) }));
      const safeName = t.label.replace(/[\\/*?:"\[\]]/g, "").slice(0, 28); // حد أقصى لاسم الورقة بإكسل
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), safeName);
    });

    XLSX.writeFile(wb, `تقرير-الزيارات-${from}_${to}.xlsx`);
    flashToast("تم تصدير التقرير — كل نوع بورقة مستقلة + ملخص شامل");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[["زيارات اليوم", todaysVisits], ["استفسارات فُتحت بالفترة", inquiryOpensInRange], ["زوّار مميّزون بالفترة", uniqueSessions]].map(([label, val]) => (<div key={label} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: T.brass }}>{val}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{label}</div></div>))}
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><BarChart3 size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>ملخص شامل — {from} إلى {to}</span></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setRefreshTick((n) => n + 1)} title="تحديث الأرقام الآن" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: T.sunken, border: "none", borderRadius: 999, cursor: "pointer", color: T.brass }}><RefreshCw size={12} /></button>
            <button onClick={setAllTime} style={{ fontSize: 11, background: T.brass + "16", color: T.brass, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer", fontWeight: 700 }}>الكل</button>
            <button onClick={() => setPreset(6)} style={{ fontSize: 11, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>أسبوع</button>
            <button onClick={() => setPreset(29)} style={{ fontSize: 11, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>شهر</button>
            <button onClick={() => setPreset(59)} style={{ fontSize: 11, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>شهرين</button>
          </div>
        </div>
        {loading ? (
          <div style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: 14 }}>جارٍ حساب الأرقام...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {ADMIN_EVENT_TYPES.map((t) => { const Icon = t.icon; const c = typeCounts[t.key] || 0; return (
              <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 10, padding: "9px 12px" }}>
                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} color={T.brass} /> {t.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.brass }}>{c}</span>
              </div>
            );})}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.brass + "12", borderRadius: 10, padding: "9px 12px", gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>الإجمالي الكلي</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.brass }}>{Object.values(typeCounts).reduce((s, v) => s + v, 0)}</span>
            </div>
          </div>
        )}
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><BarChart3 size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>استخراج تقرير مخصص</span></div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>من تاريخ</label><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>إلى تاريخ</label><input type="date" value={to} min={from} max={isoAdminDate(today)} onChange={(e) => setTo(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} /></div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>{ADMIN_EVENT_TYPES.map((t) => { const on = selectedTypes.has(t.key); const Icon = t.icon; return (<button key={t.key} onClick={() => toggleType(t.key)} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "7px 12px", fontSize: 12, cursor: "pointer", border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "16" : "transparent", color: on ? T.brass : T.muted, fontWeight: on ? 700 : 500 }}><Icon size={13} /> {t.label}</button>); })}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: T.muted }}>{loading ? "جارٍ التحميل..." : `${filtered.length} حدث مطابق`}</span>
          {canExport ? (<button onClick={exportExcel} disabled={filtered.length === 0} style={{ display: "flex", alignItems: "center", gap: 7, background: filtered.length ? T.brass : T.line, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: filtered.length ? "pointer" : "not-allowed" }}><Download size={15} /> تصدير إكسل</button>) : (<span style={{ fontSize: 11.5, color: T.faint, display: "flex", alignItems: "center", gap: 5 }}><Lock size={12} /> بدون صلاحية تصدير</span>)}
        </div>
      </div>
    </div>
  );
}

/* ── الفلاتر المخصصة ── */
function AFiltersTab({ categories, refreshCategories, flashToast, log }) {
  const T = useSystemTheme();
  const [newCatName, setNewCatName] = useState(""); const [newVal, setNewVal] = useState(""); const [draftValues, setDraftValues] = useState([]);
  const addValueToDraft = () => { if (!newVal.trim()) return; setDraftValues((v) => [...v, newVal.trim()]); setNewVal(""); };
  const createCategory = async () => {
    if (!newCatName.trim() || draftValues.length === 0) { flashToast("لازم اسم الفئة وقيمة وحدة على الأقل"); return; }
    await supabase.from("filter_categories").insert({ key: `custom-${Date.now()}`, label: newCatName.trim(), locked: false, values: draftValues });
    log("إنشاء فئة فلترة", `"${newCatName.trim()}" بقيم: ${draftValues.join("، ")}`);
    setNewCatName(""); setDraftValues([]); flashToast("تمت إضافة فئة الفلترة"); refreshCategories();
  };
  const deleteCategory = async (c) => { await supabase.from("filter_categories").delete().eq("key", c.key); log("حذف فئة فلترة", c.label); refreshCategories(); };
  const deleteValue = async (c, val) => { await supabase.from("filter_categories").update({ values: c.values.filter((v) => v !== val) }).eq("key", c.key); log("حذف قيمة فلتر", `${val} من ${c.label}`); refreshCategories(); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Tag size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>إضافة فئة فلترة جديدة يدويًا</span></div>
        <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>اسم الفئة</label>
        <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="مثال: رقم الاجتماع" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 12, fontSize: 13, background: T.sunken }} />
        <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>القيم</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addValueToDraft())} placeholder="مثال: الاجتماع الخامس — ثم Enter" style={{ flex: 1, boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} />
          <button onClick={addValueToDraft} style={{ background: T.brass + "16", color: T.brass, border: "none", borderRadius: 10, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إضافة</button>
        </div>
        {draftValues.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>{draftValues.map((v) => (<span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.sunken, borderRadius: 999, padding: "5px 10px", fontSize: 12 }}>{v} <X size={12} style={{ cursor: "pointer" }} onClick={() => setDraftValues((d) => d.filter((x) => x !== v))} /></span>))}</div>}
        <button onClick={createCategory} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><PlusCircle size={15} /> إنشاء فئة الفلترة</button>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>كل الفئات (أساسية تلقائية + مخصصة)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {categories.map((c) => (
            <div key={c.key} style={{ background: T.sunken, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{c.label} {c.locked && <Lock size={11} color={T.faint} />}</span>
                {!c.locked && <button onClick={() => deleteCategory(c)} style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11.5 }}><Trash2 size={13} /> حذف الفئة</button>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(c.values || []).map((v) => (<span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.brass + "14", color: T.brass, borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 600 }}>{v} {!c.locked && <X size={11} style={{ cursor: "pointer" }} onClick={() => deleteValue(c, v)} />}</span>))}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── سجل نشاط الإدارة ── */
function AAuditLogTab() {
  const T = useSystemTheme();
  const [entries, setEntries] = useState([]);
  useEffect(() => { supabase.from("audit_log").select("*").order("ts", { ascending: false }).limit(200).then(({ data }) => setEntries(data || [])); }, []);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><History size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>سجل نشاط الإدارة</span></div>
      {entries.length === 0 ? (<div style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: 20 }}>ما فيه أي نشاط مسجّل بعد.</div>) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ background: T.sunken, borderRadius: 11, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>{e.action}</span><span style={{ fontSize: 11, color: T.faint }}>{fmtAdminDate(e.ts)}</span></div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{e.details}</div>
              <div style={{ fontSize: 11, color: T.brass, marginTop: 4, fontWeight: 600 }}>بواسطة: {e.user_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── تعديل صلاحيات أعضاء موجودين (إنشاء الحساب نفسه يتم من لوحة Supabase) ── */
function AUsersTab({ profile, flashToast, log, canCreate, canEditPerms }) {
  const T = useSystemTheme();
  const [members, setMembers] = useState([]); const [editingId, setEditingId] = useState(null); const [form, setForm] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState(null); // { name, email, password, perms }
  const load = () => supabase.from("profiles").select("*").then(({ data }) => setMembers(data || []));
  useEffect(() => { load(); }, []);
  const startEdit = (m) => { setEditingId(m.id); setForm({ ...m }); };
  const togglePerm = (key) => setForm((f) => ({ ...f, perms: f.perms.includes(key) ? f.perms.filter((p) => p !== key) : [...f.perms, key] }));
  const save = async () => {
    await supabase.from("profiles").update({ name: form.name, role: form.role, perms: form.perms }).eq("id", form.id);
    log("تعديل صلاحيات عضو", `${form.name} — ${form.perms.length} صلاحية`);
    flashToast("تم حفظ الصلاحيات"); setEditingId(null); setForm(null); load();
  };
  const startCreate = () => setNewUser({ name: "", email: "", password: "", perms: [] });
  const toggleNewPerm = (key) => setNewUser((f) => ({ ...f, perms: f.perms.includes(key) ? f.perms.filter((p) => p !== key) : [...f.perms, key] }));
  const createUser = async () => {
    if (!newUser.email.trim() || newUser.password.length < 6) { flashToast("لازم بريد صحيح وكلمة مرور ٦ أحرف فأكثر"); return; }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-invite-user", {
      body: { email: newUser.email.trim(), password: newUser.password, name: newUser.name.trim() || newUser.email.trim(), perms: newUser.perms },
    });
    setCreating(false);
    if (error || data?.error) { flashToast(data?.error || "تعذّر إنشاء الحساب"); return; }
    log("إضافة عضو جديد", `${newUser.name || newUser.email} — ${newUser.perms.length} صلاحية`);
    flashToast("تم إنشاء الحساب — يقدر يدخل فورًا بنفس البريد وكلمة المرور");
    setNewUser(null); load();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Users size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>أعضاء لوحة الإدارة</span></div>
          {canCreate && <button onClick={startCreate} style={{ display: "flex", alignItems: "center", gap: 6, background: T.brass, color: "#fff", border: "none", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><UserPlus size={14} /> إضافة عضو جديد</button>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {members.map((u) => (
            <div key={u.id} style={{ background: T.sunken, borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{u.name || "(بدون اسم)"}</div><div style={{ fontSize: 11, color: T.muted }}>{u.role}</div></div>
                {canEditPerms && <button onClick={() => startEdit(u)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 9, padding: "6px 10px", fontSize: 11.5, color: T.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Pencil size={12} /> تعديل</button>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>{(u.perms || []).map((p) => <span key={p} style={{ fontSize: 10.5, background: T.brass + "14", color: T.brass, borderRadius: 999, padding: "2px 8px" }}>{ADMIN_PERMISSIONS.find((x) => x.key === p)?.label}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
      {form && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>تعديل صلاحيات: {form.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {ADMIN_PERMISSIONS.map((p) => { const on = form.perms.includes(p.key); const Icon = p.icon; return (
              <button key={p.key} onClick={() => togglePerm(p.key)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "start", border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "0D" : T.sunken, borderRadius: 11, padding: "10px 12px", cursor: "pointer" }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${on ? T.brass : T.faint}`, background: on ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={13} color="#fff" />}</span>
                <Icon size={14} color={on ? T.brass : T.faint} /><span style={{ fontSize: 12.5, color: on ? T.paper : T.muted }}>{p.label}</span>
              </button>
            );})}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Check size={15} /> حفظ</button>
            <button onClick={() => { setEditingId(null); setForm(null); }} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}
      {newUser && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>إضافة عضو جديد بالكامل</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>الاسم</label><input value={newUser.name} onChange={(e) => setNewUser((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>البريد الإلكتروني</label><input type="email" value={newUser.email} onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} /></div>
          </div>
          <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>كلمة مرور مبدئية (يقدر يغيّرها بعدين)</label>
          <input type="text" value={newUser.password} onChange={(e) => setNewUser((f) => ({ ...f, password: e.target.value }))} placeholder="٦ أحرف على الأقل" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 14, fontSize: 13, background: T.sunken }} />
          <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 8 }}>الصلاحيات</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {ADMIN_PERMISSIONS.map((p) => { const on = newUser.perms.includes(p.key); const Icon = p.icon; return (
              <button key={p.key} onClick={() => toggleNewPerm(p.key)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "start", border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "0D" : T.sunken, borderRadius: 11, padding: "10px 12px", cursor: "pointer" }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${on ? T.brass : T.faint}`, background: on ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={13} color="#fff" />}</span>
                <Icon size={14} color={on ? T.brass : T.faint} /><span style={{ fontSize: 12.5, color: on ? T.paper : T.muted }}>{p.label}</span>
              </button>
            );})}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={createUser} disabled={creating} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: creating ? "wait" : "pointer", opacity: creating ? .7 : 1 }}><UserPlus size={15} /> {creating ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button>
            <button onClick={() => setNewUser(null)} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── الإشعارات المؤقتة (تنبيه/مهم) مع تصويت اختياري محمي من التكرار ── */
function ANoticesTab({ flashToast, log }) {
  const T = useSystemTheme();
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState(null);
  const load = () => supabase.from("notices").select("*").order("created_at", { ascending: false }).then(({ data }) => setNotices(data || []));
  useEffect(() => { load(); }, []);
  const startAdd = () => setForm({ title: "", body: "", kind: "info", durationDays: "7", votesEnabled: false });
  const create = async () => {
    if (!form.title.trim() || !form.body.trim()) { flashToast("لازم عنوان ونص"); return; }
    const expires_at = form.durationDays === "0" ? null : new Date(Date.now() + Number(form.durationDays) * 86400000).toISOString();
    await supabase.from("notices").insert({ title: form.title.trim(), body: form.body.trim(), kind: form.kind, votes_enabled: form.votesEnabled, expires_at });
    log("نشر إشعار جديد", `"${form.title.trim()}" (${form.kind}) — ${form.durationDays === "0" ? "بدون انتهاء" : `${form.durationDays} يوم`}`);
    flashToast("تم نشر الإشعار على الموقع"); setForm(null); load();
  };
  const remove = async (n) => { await supabase.from("notices").delete().eq("id", n.id); log("حذف إشعار", n.title); flashToast("تم الحذف"); load(); };
  const [voteCounts, setVoteCounts] = useState({});
  useEffect(() => {
    if (!notices.length) return;
    supabase.from("notice_votes").select("notice_id").then(({ data }) => {
      const counts = {};
      (data || []).forEach((v) => { counts[v.notice_id] = (counts[v.notice_id] || 0) + 1; });
      setVoteCounts(counts);
    });
  }, [notices]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>إشعارات الموقع العام</span></div>
          <button onClick={startAdd} style={{ display: "flex", alignItems: "center", gap: 6, background: T.brass, color: "#fff", border: "none", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><PlusCircle size={14} /> إشعار جديد</button>
        </div>
        <p style={{ fontSize: 12, color: T.muted, margin: "6px 0 0", lineHeight: 1.7 }}>يظهر بأعلى الموقع العام لكل الزوّار، ويختفي تلقائيًا بعد المدة اللي تحددها.</p>
      </div>

      {form && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>إشعار جديد</div>
          <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>الموضوع (العنوان)</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="مثال: اجتماع الملاك القادم" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 12, fontSize: 13, background: T.sunken }} />
          <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>النص</label>
          <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={4} placeholder="اكتب تفاصيل الإشعار هنا..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 12, fontSize: 13, background: T.sunken, fontFamily: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>النوع</label>
              <ASegmented value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} options={[{ value: "info", label: "تنبيه" }, { value: "important", label: "مهم" }]} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>يبقى ظاهر لمدة</label>
              <select value={form.durationDays} onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }}>
                <option value="1">يوم واحد</option><option value="3">3 أيام</option><option value="7">أسبوع</option>
                <option value="14">أسبوعين</option><option value="30">شهر</option><option value="0">بدون انتهاء (يدوي فقط)</option>
              </select>
            </div>
          </div>
          <button onClick={() => setForm((f) => ({ ...f, votesEnabled: !f.votesEnabled }))} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "start", border: `1px solid ${form.votesEnabled ? T.brass : T.line}`, background: form.votesEnabled ? T.brass + "0D" : T.sunken, borderRadius: 11, padding: "10px 12px", cursor: "pointer", width: "100%", marginBottom: 16 }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${form.votesEnabled ? T.brass : T.faint}`, background: form.votesEnabled ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{form.votesEnabled && <Check size={13} color="#fff" />}</span>
            <span style={{ fontSize: 12.5 }}>تفعيل التصويت (تأييد/عدم تأييد) — صوت واحد لكل جهاز، محمي من التكرار</span>
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={create} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Check size={15} /> نشر الإشعار</button>
            <button onClick={() => setForm(null)} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>الإشعارات الحالية</div>
        {notices.length === 0 ? (<div style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: 20 }}>ما فيه إشعارات منشورة حاليًا.</div>) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notices.map((n) => {
              const expired = n.expires_at && new Date(n.expires_at) < new Date();
              return (
                <div key={n.id} style={{ background: T.sunken, borderRadius: 12, padding: 12, opacity: expired ? .5 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {n.kind === "important" ? <ABadge kind="missing">مهم</ABadge> : <ABadge kind="change">تنبيه</ABadge>} {n.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>{n.body}</div>
                      <div style={{ fontSize: 11, color: T.faint, marginTop: 4 }}>
                        {expired ? "انتهى" : n.expires_at ? `ينتهي ${fmtAdminDate(n.expires_at)}` : "بدون انتهاء"}
                        {n.votes_enabled && ` · ${voteCounts[n.id] || 0} صوت`}
                      </div>
                    </div>
                    <button onClick={() => remove(n)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C0392B", flexShrink: 0 }}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── لوحة القرار الداخلية — نظرة شاملة تساعد الإدارة تتخذ قرار بسرعة ── */
function ADashboardTab({ inquiries }) {
  const T = useSystemTheme();
  const [dailyVisits, setDailyVisits] = useState([]);
  const [monthlyActivity, setMonthlyActivity] = useState([]);
  const [topInquiries, setTopInquiries] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [eventBreakdown, setEventBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 6 * 86400000);
      const { data: logs } = await supabase.from("logs").select("event_type,created_at").eq("event_type", "visit").gte("created_at", since.toISOString());
      const byDay = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        byDay[isoAdminDate(d)] = 0;
      }
      (logs || []).forEach((l) => { const k = isoAdminDate(new Date(l.created_at)); if (byDay[k] !== undefined) byDay[k]++; });
      const WD = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
      setDailyVisits(Object.entries(byDay).map(([k, v]) => ({ day: WD[new Date(k + "T12:00:00").getDay()], visits: v })));

      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data: acts } = await supabase.from("audit_log").select("user_name").gte("ts", monthStart.toISOString());
      const counts = {};
      (acts || []).forEach((a) => { counts[a.user_name] = (counts[a.user_name] || 0) + 1; });
      setMonthlyActivity(Object.entries(counts).map(([user, count]) => ({ user, count })).sort((a, b) => b.count - a.count));

      /* نشاط شامل لآخر ٣٠ يوم — لحساب الأكثر فتحًا وأوقات الذروة وتوزيع كل نوع حدث */
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: allEvents } = await supabase.from("logs").select("event_type,category,created_at").gte("created_at", since30).limit(8000);

      const opens = {};
      (allEvents || []).filter((e) => e.event_type === "inquiry_open" && e.category).forEach((e) => { opens[e.category] = (opens[e.category] || 0) + 1; });
      const inqById = new Map(inquiries.map((r) => [String(r.id), r]));
      setTopInquiries(
        Object.entries(opens).map(([id, count]) => ({ id, count, note: inqById.get(id)?.note || "—", model: inqById.get(id)?.model || "" }))
          .sort((a, b) => b.count - a.count).slice(0, 8)
      );

      const hourCounts = Array(24).fill(0);
      (allEvents || []).forEach((e) => { const h = (new Date(e.created_at).getUTCHours() + 3) % 24; hourCounts[h]++; }); // بتوقيت السعودية (UTC+3)
      setPeakHours(hourCounts.map((c, h) => ({ hour: `${h}`, count: c })));

      const evCounts = {};
      (allEvents || []).forEach((e) => { evCounts[e.event_type] = (evCounts[e.event_type] || 0) + 1; });
      setEventBreakdown(ADMIN_EVENT_TYPES.map((t) => ({ type: t.label, count: evCounts[t.key] || 0 })).filter((x) => x.count > 0));

      setLoading(false);
    })();
  }, []);

  const statusCounts = useMemo(() => {
    const m = {}; inquiries.forEach((r) => { m[r.status || "—"] = (m[r.status || "—"] || 0) + 1; });
    return Object.entries(m).map(([status, count]) => ({ status, count }));
  }, [inquiries]);
  const priCounts = useMemo(() => {
    const order = ["عالية جدًا", "عالية", "متوسطة", "عادية"];
    const m = {}; inquiries.forEach((r) => { m[r.pri || "—"] = (m[r.pri || "—"] || 0) + 1; });
    return order.filter((p) => m[p]).map((p) => ({ pri: p, count: m[p] })).concat(Object.entries(m).filter(([p]) => !order.includes(p)).map(([pri, count]) => ({ pri, count })));
  }, [inquiries]);
  const ownerLoad = useMemo(() => {
    const m = {}; inquiries.filter((r) => r.closed !== "نعم").forEach((r) => { const o = r.owner || "غير محدد"; m[o] = (m[o] || 0) + 1; });
    return Object.entries(m).map(([owner, open]) => ({ owner, open })).sort((a, b) => b.open - a.open);
  }, [inquiries]);
  const total = inquiries.length;
  const open = inquiries.filter((r) => r.closed !== "نعم").length;
  const urgent = inquiries.filter((r) => isFlagLive(r.urgent, r.urgent_until)).length;
  const isNewCount = inquiries.filter((r) => r.last_modified && (Date.now() - new Date(r.last_modified + "T00:00:00").getTime()) / 86400000 <= 7).length;
  const weekVisitsTotal = dailyVisits.reduce((s, d) => s + d.visits, 0);

  const barCard = (title, data, xKey, barColor) => (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {data.length === 0 ? <div style={{ fontSize: 12, color: T.muted, padding: 10 }}>لا بيانات كافية.</div> : (
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey={xKey} tick={{ fontSize: 10.5, fill: T.muted }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: T.muted }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface }} />
              <Bar dataKey={data[0]?.count !== undefined ? "count" : data[0]?.open !== undefined ? "open" : "visits"} fill={barColor} radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[["إجمالي الاستفسارات", total], ["مفتوحة", open], ["عاجلة", urgent], ["جديدة (٧ أيام)", isNewCount], ["زيارات آخر أسبوع", weekVisitsTotal], ["أعضاء نشيطون هذا الشهر", monthlyActivity.length]].map(([label, val]) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: T.brass }}>{loading && (label.includes("زيارات") || label.includes("أعضاء")) ? "…" : val}</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {barCard("الزيارات آخر ٧ أيام", dailyVisits, "day", T.brass)}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {barCard("الاستفسارات حسب الحالة", statusCounts, "status", "#1E8E5A")}
        {barCard("الاستفسارات حسب الأولوية", priCounts, "pri", "#B8790F")}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>عبء العمل الحالي — استفسارات مفتوحة حسب المسؤول</div>
        {ownerLoad.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>لا يوجد استفسارات مفتوحة.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ownerLoad.map((o) => (
              <div key={o.owner} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.owner}</span>
                <div style={{ flex: 1, background: T.sunken, borderRadius: 999, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (o.open / (ownerLoad[0].open || 1)) * 100)}%`, height: "100%", background: T.brass, borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.brass, width: 20, textAlign: "end" }}>{o.open}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {barCard("أوقات الذروة (آخر ٣٠ يوم — بتوقيت السعودية)", peakHours, "hour", "#6B5FBC")}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>الاستفسارات الأكثر فتحًا (آخر ٣٠ يوم)</div>
          {topInquiries.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>{loading ? "جارٍ التحميل..." : "لا بيانات بعد."}</div> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {topInquiries.map((t) => (
                <a
                  key={t.id}
                  href={`${window.location.origin}${window.location.pathname}?note=${t.id}`}
                  target="_blank" rel="noreferrer"
                  title={t.note}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 13,
                    padding: "10px 16px", textDecoration: "none", cursor: "pointer", minWidth: 60,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.brass }}>#{t.id}</span>
                  <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>{t.count} فتحة</span>
                </a>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>توزيع كل نشاط بالموقع (آخر ٣٠ يوم)</div>
          {eventBreakdown.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>{loading ? "جارٍ التحميل..." : "لا بيانات بعد."}</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {eventBreakdown.map((e) => (
                <div key={e.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 9, padding: "7px 10px" }}>
                  <span style={{ fontSize: 11.5 }}>{e.type}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.brass }}>{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>نشاط فريق الإدارة هذا الشهر</div>
        {monthlyActivity.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>{loading ? "جارٍ التحميل..." : "ما فيه نشاط مسجّل هذا الشهر بعد."}</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monthlyActivity.map((a) => (
              <div key={a.user} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 10, padding: "9px 12px" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{a.user}</span>
                <span style={{ fontSize: 12, color: T.brass, fontWeight: 700 }}>{a.count} إجراء</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ADMIN_TABS = [
  { key: "dashboard", label: "لوحة القرار", perms: ["view_dashboard"] },
  { key: "sync", label: "المزامنة والبيانات", perms: ["import_excel", "add_inquiry", "edit_inquiry", "delete_inquiry", "flag_urgent"] },
  { key: "analytics", label: "الزيارات والتحليلات", perms: ["view_analytics"] },
  { key: "filters", label: "الفلاتر المخصصة", perms: ["manage_filters"] },
  { key: "notices", label: "الإشعارات", perms: ["manage_notices"] },
  { key: "audit", label: "سجل النشاط", perms: ["view_audit_log"] },
  { key: "users", label: "المستخدمون", perms: ["edit_permissions", "create_users"] },
];

function AdminHome({ session, onLogout }) {
  const T = useSystemTheme();
  const [profile, setProfile] = useState(undefined);
  const [inquiries, setInquiries] = useState([]);
  const [progress, setProgress] = useState([]);
  const [categories, setCategories] = useState([]);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("dashboard");

  const refreshProfile = () => supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => setProfile(data || null));
  const refreshInquiries = () => supabase.from("inquiries").select("*").order("id").then(({ data }) => setInquiries(data || []));
  const refreshProgress = () => supabase.from("progress").select("*").order("month").then(({ data }) => setProgress(data || []));
  const refreshCategories = () => supabase.from("filter_categories").select("*").then(({ data }) => setCategories(data || []));

  useEffect(() => { refreshProfile(); refreshInquiries(); refreshProgress(); refreshCategories(); }, [session.user.id]);

  const flashToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };
  const log = async (action, details) => {
    await supabase.from("audit_log").insert({ user_name: profile?.name || session.user.email, action, details });
  };

  if (profile === undefined) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontFamily: "system-ui" }}>جارٍ التحميل...</div>;
  if (!profile) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} dir="rtl">
      <ALocked text={`حسابك (${session.user.email}) مسجّل دخول لكن ما له صلاحيات بعد. أضف صف له بجدول profiles من لوحة Supabase (راجع setup-supabase.sql).`} />
    </div>
  );
  const has = (perm) => (profile.perms || []).includes(perm);
  const visibleTabs = ADMIN_TABS.filter((t) => t.perms.some((p) => has(p)));
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : (visibleTabs[0]?.key || null);
  const liveStats = { total: inquiries.length, open: inquiries.filter((r) => r.closed !== "نعم").length, urgent: inquiries.filter((r) => isFlagLive(r.urgent, r.urgent_until)).length };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "system-ui, sans-serif", color: T.paper }} dir="rtl">
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T.brass + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><ShieldCheck size={17} color={T.brass} /></div>
          <div><div style={{ fontSize: 14, fontWeight: 700 }}>لوحة إدارة ألبورادا</div><div style={{ fontSize: 11, color: T.muted }}>{liveStats.total} استفسار · {liveStats.open} مفتوح · {liveStats.urgent} عاجل</div></div>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.hash = ""; window.location.reload(); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${T.line}`, borderRadius: 10, padding: "7px 12px", fontSize: 12.5, color: T.muted, cursor: "pointer" }}><LogOut size={13} /> خروج</button>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: 6, background: T.sunken, padding: 4, borderRadius: 12, marginBottom: 18, flexWrap: "wrap" }}>
          {visibleTabs.map((t) => (<button key={t.key} onClick={() => setTab(t.key)} style={{ flex: "1 1 auto", border: "none", borderRadius: 9, padding: "9px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: activeTab === t.key ? T.surface : "transparent", color: activeTab === t.key ? T.brass : T.muted, boxShadow: activeTab === t.key ? T.shadow : "none" }}>{t.label}</button>))}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 60px" }}>
        {!activeTab && <ALocked text="حسابك ما عنده صلاحية وصول لأي قسم." />}
        {activeTab === "dashboard" && <ADashboardTab inquiries={inquiries} />}
        {activeTab === "sync" && <ASyncTab inquiries={inquiries} refreshInquiries={refreshInquiries} progress={progress} refreshProgress={refreshProgress} categories={categories} refreshCategories={refreshCategories} flashToast={flashToast} canFlag={has("flag_urgent")} canImport={has("import_excel")} canAdd={has("add_inquiry")} canEdit={has("edit_inquiry")} canDelete={has("delete_inquiry")} log={log} />}
        {activeTab === "analytics" && <AAnalyticsTab flashToast={flashToast} canExport={has("export_data")} />}
        {activeTab === "filters" && <AFiltersTab categories={categories} refreshCategories={refreshCategories} flashToast={flashToast} log={log} />}
        {activeTab === "notices" && <ANoticesTab flashToast={flashToast} log={log} />}
        {activeTab === "audit" && <AAuditLogTab />}
        {activeTab === "users" && <AUsersTab profile={profile} flashToast={flashToast} log={log} canCreate={has("create_users")} canEditPerms={has("edit_permissions")} />}
      </div>

      {toast && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.paper, color: T.bg, padding: "11px 20px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 8, boxShadow: T.shadowUp }}><Check size={15} /> {toast}</div>}
    </div>
  );
}

function AdminApp() {
  const session = useSupaAuth();
  if (session === undefined) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: THEMES.light.muted }}>جارٍ التحقق من الدخول...</div>;
  if (!session) return <AdminLogin />;
  return <AdminHome session={session} />;
}

/* ═══════════════════════════════════════════════════════════
   ١٦. نقطة الدخول النهائية — يوجّه بين الموقع العام ولوحة الإدارة
   حسب الرابط: أضف #admin بآخر رابط الموقع لفتح لوحة الإدارة، مثال:
   https://your-site.vercel.app/#admin
   ═══════════════════════════════════════════════════════════ */
function App() {
  const [route, setRoute] = useState(() => (window.location.hash === "#admin" ? "admin" : "site"));
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash === "#admin" ? "admin" : "site");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route === "admin" ? <AdminApp /> : <PublicSite />;
}

export default App;
