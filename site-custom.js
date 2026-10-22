/* ═══════════════════════════════════════════════════════════
   site-custom.js — قراءة تخصيصات الموقع (٦.٠.٠) — خفيف، يُحمَّل للزوّار
   كل التخصيصات محفوظة بعمود site_settings.nav_labels (jsonb) بدون أي هجرة:
     _order  : ترتيب التبويبات            _texts : تسمية النصوص
     _blocks : كتل المحتوى لكل تبويب       _tabs  : تبويبات مخصّصة جديدة
     _hide   : أقسام مخفية عن الزوّار       _pins  : استفسارات مثبّتة بالأعلى
     _style  : لون مميز وعرض الصفحة         _site  : عنوان الموقع
     _links  : روابط عامة (telegram = رابط قروب الملاك — يتعدّل من لوحة الإدارة بدون نشر كود)
   أمان: كل قيمة تُنظَّف وقت العرض (مفاتيح بحروف آمنة فقط، ألوان #RRGGBB فقط) —
   فحتى لو انحفظت قيمة غريبة ما تقدر تحقن CSS أو سكربت بالصفحة.
   ═══════════════════════════════════════════════════════════ */
import {
  Award, Bell, BookOpen, Briefcase, Building2, Calendar, ClipboardList, FileText, Folder, HardHat, Heart, Home,
  Image, Info, Lightbulb, Link2, MapPin, Megaphone, MessageCircle, Phone, Ruler, Shield, Star, Users, Video, Wrench,
} from "lucide-react";

export const CUSTOM_TAB_ICONS = {
  star: Star, info: Info, megaphone: Megaphone, bell: Bell, calendar: Calendar, users: Users, wrench: Wrench,
  hardhat: HardHat, building: Building2, home: Home, map: MapPin, phone: Phone, book: BookOpen, folder: Folder,
  file: FileText, image: Image, video: Video, clipboard: ClipboardList, ruler: Ruler, idea: Lightbulb,
  chat: MessageCircle, link: Link2, award: Award, briefcase: Briefcase, heart: Heart, shield: Shield,
};
export const MAX_CUSTOM_TABS = 12;

const KEY_RE = /^[a-z0-9_-]{1,40}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const safeKey = (k) => (typeof k === "string" && KEY_RE.test(k) ? k : null);
export const safeColor = (c) => (typeof c === "string" && COLOR_RE.test(c) ? c : null);
const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});

/* التبويبات المخصّصة: [{ key, ar, en, icon }] */
export function customTabsOf(nl) {
  const a = Array.isArray(nl?._tabs) ? nl._tabs : [];
  const seen = new Set();
  return a.filter((t) => t && safeKey(t.key) && t.key.startsWith("c_") && !seen.has(t.key) && seen.add(t.key))
    .slice(0, MAX_CUSTOM_TABS)
    .map((t) => ({ key: t.key, ar: String(t.ar || "تبويب جديد").slice(0, 60), en: String(t.en || t.ar || "New tab").slice(0, 60), icon: CUSTOM_TAB_ICONS[t.icon] ? t.icon : "star" }));
}

/* الأقسام المخفية عن الزوّار: مصفوفة مفاتيح data-ek */
export function hiddenSecsOf(nl) {
  const a = Array.isArray(nl?._hide) ? nl._hide : [];
  return [...new Set(a.map(safeKey).filter(Boolean))].slice(0, 200);
}
/* CSS الإخفاء — للزوّار: مخفي تمامًا. بوضع التحرير: باهت ومعلَّم عشان تقدر ترجّعه */
export function hiddenSecsCss(keys, editing) {
  if (!keys.length) return "";
  const sel = keys.map((k) => `[data-ek="${k}"]`).join(",");
  return editing
    ? `${sel}{opacity:.35!important;outline:2px dashed #C0392B!important;outline-offset:2px;position:relative;}`
    : `${sel}{display:none!important;}`;
}

/* الاستفسارات المثبّتة بالأعلى (بالترتيب) */
export function pinsOf(nl) {
  const a = Array.isArray(nl?._pins) ? nl._pins : [];
  return [...new Set(a.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 50);
}

/* اللون المميز + عرض الصفحة */
export const PAGE_WIDTHS = { normal: null, wide: 1400, full: "none" };
export function styleOf(nl) {
  const s = obj(nl?._style);
  return { accent: safeColor(s.accent), width: PAGE_WIDTHS[s.width] !== undefined ? s.width : "normal" };
}
/* لون النص المناسب فوق اللون المميز (أبيض أو داكن حسب السطوع) */
export function onColor(hex) {
  const c = safeColor(hex); if (!c) return "#fff";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#1F2C35" : "#fff";
}

/* عنوان الموقع */
export function siteOf(nl) {
  const s = obj(nl?._site);
  const clip = (v) => (typeof v === "string" ? v.trim().slice(0, 80) : "");
  return { title_ar: clip(s.title_ar), title_en: clip(s.title_en) };
}

/* رابط قروب تليجرام (6.7.0): من nav_labels._links.telegram، ولو غير موجود أو غير صالح يرجع للرابط الافتراضي بالكود.
   لا يُقبل إلا https://t.me/… أو https://telegram.me/… بحروف آمنة فقط (ما يقدر أحد يحط رابط غريب أو سكربت). */
const TG_RE = /^https:\/\/(t|telegram)\.me\/[A-Za-z0-9_+\-/]{3,80}$/;
export const isTelegramUrl = (u) => typeof u === "string" && TG_RE.test(u.trim());
/* يكمّل الرابط لو انكتب بدون https:// (مثل t.me/+abc) — ويرجّع نص فاضي لو ما ينفع */
export const normalizeTelegramUrl = (u) => {
  let s = String(u || "").trim();
  if (/^(t|telegram)\.me\//i.test(s)) s = "https://" + s;
  s = s.replace(/^http:\/\//i, "https://").replace(/^https:\/\/(www\.)?/i, "https://");
  return isTelegramUrl(s) ? s : "";
};
export function telegramUrlOf(nl, fallback) {
  const u = obj(nl?._links).telegram;
  return isTelegramUrl(u) ? u.trim() : fallback;
}

/* أسماء الأقسام القابلة للإخفاء (تظهر بقائمة "الأقسام المخفية") */
export const SECTION_LABELS = {
  "title": "عنوان الموقع", "toggles": "أزرار اللغة والمظهر", "telegram": "زر مجتمع الملاك",
  "updated": "آخر تحديث", "header-chips": "شارات (يجب الاطلاع/مهم/جديد)",
  "status": "حالة السجل", "where": "أين ظهرت الاستفسارات", "cats": "طبيعة البنود", "charts": "مسار الردود والتراكم",
  "notes-tools": "البحث والفلاتر", "notes-count": "عدد النتائج",
  "pg-target": "تقدم المشروع مقابل الهدف", "pg-timeline": "المسار الزمني", "pg-phases": "المراحل", "pg-blocks": "البلوكات",
  "docs-intro": "مقدمة المخططات", "credit": "سطر فريق تمثيل الملاك", "credit-sub": "سطر المبادرة",
  "footer-links": "رابط سجل التحديثات ودخول الإدارة",
};
export const sectionLabel = (k) => SECTION_LABELS[k] || (k.startsWith("doc-") ? `مستند: ${k.slice(4)}` : k);
