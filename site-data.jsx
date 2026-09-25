/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: site-data */
import { supabase } from "./app-bootstrap.jsx";
import { createContext, useContext, useEffect, useState } from "react";
import INQUIRIES_DATA from "./inquiries.json";
import { BANNAA_FONT, bannaaGround } from "./design-bannaa.jsx";
import { DEFAULT_DESIGN_KEY, DESIGN_KEYS } from "./design-nova.jsx";

/* ═══════════════════════════════════════════════════════════
   نسخة أساسية مدمجة — تعمل فورًا بدون رفع أي ملف.
   يستبدلها التحديث المنشور عند وجوده.
   ═══════════════════════════════════════════════════════════ */
/* ── ٢. البيانات الثابتة: قوائم مرجعية، ثم سجل الملاحظات RAW ── */
export const PRI_ORDER = ["عالية جدًا", "عالية", "متوسطة", "عادية"];
export const STA_ORDER = ["معتمدة", "تم الرفض", "قيد الدراسة", "تم التصويت"];
/* ── فئة البند (عمود «تصنيف نوع البند» بملف الإكسل) ──
   يوصف طبيعة البند نفسه: هل هو تصحيح عيب، أو تحسين تصميمي، أو ترقية، أو مجرد استفسار…
   الترتيب هنا هو ترتيب العرض بالفلاتر (الأهم أولًا)، وأي قيمة جديدة تجي من الإكسل
   تنضاف تلقائيًا بعدها عبر نفس محرك المطابقة الذكي المستخدم مع باقي الأعمدة. */
export const CAT_ORDER = ["تصحيح عيب تنفيذي", "تصميمي/جمالي", "ترقية", "استفسار فني توضيحي", "تجاري", "إداري/نظامي"];

/* ── مستندات المخططات (تبويب "المخططات والمستندات") ── */
/* ── مصدر المخططات: صور WebP مقصوصة لكل دور/واجهة على حدة (تجربة جوال أفضل من PDF) ── */
export const DOC_BASE = "https://codnqkeycfhznzbqlpds.supabase.co/storage/v1/object/public/Owners%20docs/";
const P = (f, ar, en) => ({ f, ar, en });

export const DOCS = [
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
export const DOC_COLORS = {
  light: { red: "#A8443C", yellow: "#8A6318", green: "#1F7A5C", blue: "#2E6C86" },
  dark: { red: "#D48D87", yellow: "#D8B274", green: "#74B698", blue: "#8AB0C2" },
};

/* البيانات مستوردة من inquiries.json — راجع README لمنطق التحديث الأسبوعي */
const CHANGE_WINDOW_DAYS = 7;
export function isRecentlyChanged(d) {
  if (!d) return false;
  const days = (Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000;
  return days >= 0 && days <= CHANGE_WINDOW_DAYS;
}

/* ═══ وسوم "يجب الاطلاع" و"مهم" — تفعيل مؤقت (٣ أو ٧ أيام) أو دائم من لوحة الإدارة ═══
   الحقل المنطقي (urgent / important) = "دائم" وما له تاريخ انتهاء.
   حقل الـ_until (urgent_until / important_until) = وقت انتهاء التفعيل المؤقت.
   الوسم يُعتبر فعّالاً لو كان دائمًا، أو لو تاريخ الانتهاء لسه ما وصل. */
export function isFlagLive(permanentFlag, untilVal) {
  if (permanentFlag) return true;
  if (!untilVal) return false;
  return new Date(untilVal).getTime() > Date.now();
}
export const FLAG_META = {
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
  /* نطاق نموذج واحد — يرد بقاعدة البيانات بصيغ إملائية متفاوتة، والبحث المُوحَّد أدناه يلتقطها كلها */
  "امانيثير": "Amanither", "البا": "Alba", "البادا": "Bada",
};
export const trScope = (lang, v) => (lang === "en" ? trLookup(SCOPE_EN, v) : v);
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
  /* صيغ موجودة فعليًا بقاعدة البيانات وكانت تسقط بلا ترجمة بالوضع الإنجليزي */
  "الطابق الأرضي": "Ground Floor", "الطابق الأول": "First Floor", "الأرضي والأول": "Ground + First Floor",
  "الحوش الخلفي (الأرضي)": "Backyard (Ground Floor)", "الحوش الخلفي (الأرضي) والسطح": "Backyard (Ground Floor) & Roof",
  "الحوش الأمامي": "Front Yard", "الكهرباء": "Electrical",
};
const CAT_EN = {
  "تصحيح عيب تنفيذي": "Execution Defect Fix", "تصميمي/جمالي": "Design / Aesthetic",
  "ترقية": "Upgrade", "استفسار فني توضيحي": "Technical Clarification",
  "تجاري": "Commercial", "إداري/نظامي": "Administrative / Regulatory",
};
const OWN_EN = {
  "م/محمد عبدالمعطي": "Eng. Mohammed Abdulmuti", "م/رواحه": "Eng. Rawaha", "غير محدد": "Unspecified",
  "أبو سلطان": "Abu Sultan", "م/إبراهيم (مالك)": "Eng. Ibrahim (Owner)",
  /* جهات موجودة فعليًا بقاعدة البيانات وكانت تسقط بلا ترجمة */
  "م/أحمد ملحم": "Eng. Ahmed Malham", "أبو سلطان (مالك)": "Abu Sultan (Owner)", "أبو علي (مالك)": "Abu Ali (Owner)",
};
export const MEETING_ORDER = ["الاجتماع السادس ميداني", "الاجتماع الخامس", "الاجتماع الرابع", "الاجتماع الثالث"];
const MEETING_EN = { "الاجتماع الثالث": "3rd Meeting", "الاجتماع الرابع": "4th Meeting", "الاجتماع الخامس": "5th Meeting", "الاجتماع السادس ميداني": "6th Meeting (Site Visit)" };
export const MONTH_EN_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ── بحث مُتسامح بالترجمة ──
   بيانات الإكسل تجي بإملاء متفاوت لنفس القيمة (أمانيثير/امانيثير، أورورا/اورورا،
   الطابق الأرضي/الدور الأرضي...)، فالمطابقة الحرفية كانت تفشل وتترك النص عربيًا
   بالوضع الإنجليزي. نجرّب المطابقة الحرفية أولًا، وإلا نطابق بالنسخة المُوحَّدة عبر norm().
   ملاحظة: norm معرَّفة أدناه، والاستدعاء هنا يحصل وقت العرض لا وقت التحميل — فما فيه مشكلة. */
const normMapCache = new WeakMap();
function trLookup(map, v) {
  if (v == null || v === "") return v;
  if (map[v] != null) return map[v];
  let nm = normMapCache.get(map);
  if (!nm) {
    nm = {};
    for (const k of Object.keys(map)) { const n = norm(k); if (nm[n] == null) nm[n] = map[k]; }
    normMapCache.set(map, nm);
  }
  return nm[norm(v)] ?? v;
}

export const trPri = (lang, v) => (lang === "en" ? trLookup(PRI_EN, v) : v);
export const trSta = (lang, v) => (lang === "en" ? trLookup(STA_EN, v) : v);
export const trModel = (lang, v) => (lang === "en" ? trLookup(MODEL_EN, v) : v);
export const trZone = (lang, k) => (lang === "en" ? ZONE_EN[k] || k : (ZONES.find((z) => z.key === k) || {}).label || k);
export const trLoc = (lang, v) => (lang === "en" ? trLookup(LOC_EN, v) : v);
export const trOwn = (lang, v) => (lang === "en" ? trLookup(OWN_EN, v) : v);
export const trCat = (lang, v) => (lang === "en" ? trLookup(CAT_EN, v) : v);
export const trMeeting = (lang, v) => (lang === "en" ? trLookup(MEETING_EN, v) : v);
export const trMonth = (lang, m) => {
  if (!/^\d{4}-\d{2}$/.test(m || "")) return lang === "en" ? "—" : "—";
  const i = +m.slice(5, 7) - 1;
  return lang === "en" ? `${MONTH_EN_LABEL[i]} ${m.slice(0, 4)}` : `${MONTH_AR[i]} ${m.slice(0, 4)}`;
};
/* ═══ v2.8.3 — حارس ضد فشل خدمة الترجمة (MyMemory المجاني) ═══
   أحيانًا (تجاوز الحصة المجانية اليومية غالبًا) ترجع الخدمة نص تحذيرها الخاص داخل حقل
   الترجمة نفسه بدل رفض الطلب بوضوح — فيُحفظ بقاعدة البيانات وكأنه ترجمة صحيحة، ويظهر
   للزائر الإنجليزي حرفيًا (مثل "MYMEMORY WARNING: YOU USED ALL AVAILABLE..."). هذا يكتشف
   الصيغ الثابتة المعروفة لرسائل الخدمة ويتجاهلها، فترجع الواجهة للنص العربي الأصلي —
   بالضبط نفس تصرفها المعتاد مع أي ملاحظة ما وصلتها ترجمة بعد. */
const TR_FAIL_RX = /MYMEMORY WARNING|QUERY LENGTH LIMIT|WORDS LIMIT EXCEEDED|INVALID (SOURCE|TARGET) LANGUAGE|IS AN INVALID (SOURCE|TARGET) LANGUAGE|PLEASE SELECT TWO DISTINCT LANGUAGES|INVALID EMAIL PROVIDED|NO TRANSLATIONS? (FOUND|AVAILABLE)/i;
const isTrFail = (t) => typeof t === "string" && TR_FAIL_RX.test(t);
export const trNote = (lang, r) => (lang === "en" ? (r.note_en && !isTrFail(r.note_en) ? r.note_en : r.note) : r.note);
export const trReply = (lang, r) => (lang === "en" ? (r.reply_en && !isTrFail(r.reply_en) ? r.reply_en : r.reply) : r.reply);

/* ═══════════════════════════════════════════════════════════
   ٤. نظام الألوان (Theme) — فاتح للنهار وداكن لليل.
   الفلسفة: فصل بالمسافات والارتفاع، لا بالخطوط.
   ═══════════════════════════════════════════════════════════ */
export const THEMES = {
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

/* ═══════════════════════════════════════════════════════════
   ٤ب. أطقم الثيمات (Theme sets) — يختار الأدمن الطقم المعتمد من لوحة
   الإدارة، ويُحفظ بجدول site_settings، وينتقل لكل الزوّار فورًا عبر Realtime.
   كل طقم يوفّر نفس مفاتيح الألوان بالضبط (حتى يركّب بلا تعديل أي مكوّن)،
   بالإضافة إلى skin: هوية بصرية (خطوط، استدارة، تأثيرات خلفية).
   لوحة الإدارة تبقى دائمًا على الطقم الكلاسيكي.
   ═══════════════════════════════════════════════════════════ */
const SKIN_CLASSIC = { key: "classic", display: null, body: null, radius: 16, glass: false, aurora: false, grid: false, rule: false };
const SKIN_UFUQ    = { key: "ufuq",    display: "'IBM Plex Sans Arabic'", body: "'IBM Plex Sans Arabic'", radius: 18, glass: true,  aurora: true,  grid: true,  rule: false };
const SKIN_MAHDAR  = { key: "mahdar",  display: "'Amiri'",               body: "'IBM Plex Sans Arabic'", radius: 3,  glass: true,  aurora: false, grid: false, rule: true  };
const SKIN_MUKHATTAT = { key: "mukhattat", display: null, body: "'IBM Plex Sans Arabic'", radius: 0, glass: false, aurora: false, grid: false, rule: false, draft: true };
const SKIN_MASAR   = { key: "masar", display: null, body: "'IBM Plex Sans Arabic'", radius: 12, glass: false, aurora: false, grid: false, rule: false, spine: true };

export const THEME_SETS = {
  classic: {
    label: "الكلاسيكي", labelEn: "Classic",
    note: "الهوية الحالية — تيل ورمادي، فصل بالمسافات.",
    swatch: ["#F7F9FB", "#1B7F8E", "#1F2C35"],
    skin: SKIN_CLASSIC,
    light: THEMES.light, dark: THEMES.dark,
  },
  ufuq: {
    label: "أُفق", labelEn: "Ufuq",
    note: "كحلي معماري ونحاسي دافئ، ألواح زجاجية وشفق متحرك.",
    swatch: ["#080D14", "#C9A227", "#3FBFA8"],
    skin: SKIN_UFUQ,
    dark: {
      bg: "#080D14", surface: "#141D29", sunken: "#0B111A",
      paper: "#E8EEF4", muted: "#93A5B6", faint: "#64798D",
      brass: "#C9A227", line: "rgba(201,162,39,.17)", lineSoft: "rgba(255,255,255,.055)",
      shadow: "0 2px 6px rgba(0,0,0,.34), 0 16px 38px -24px rgba(0,0,0,.8)",
      shadowUp: "0 4px 12px rgba(0,0,0,.44), 0 28px 60px -26px rgba(0,0,0,.9)",
      zone: "#7E97AC", zoneOn: "#E3C765",
      sta: { "معتمدة": "#4FD1A5", "تم الرفض": "#E4756B", "قيد الدراسة": "#E8B84B", "تم التصويت": "#8FA8BE" },
      pri: { "عالية جدًا": "#E4756B", "عالية": "#E8B84B", "متوسطة": "#6FA8C4", "عادية": "#8FA8BE" },
      cat: {
        "تصحيح عيب تنفيذي": "#E4756B", "تصميمي/جمالي": "#B49CD8", "ترقية": "#4FD1A5",
        "استفسار فني توضيحي": "#6FA8C4", "تجاري": "#E8B84B", "إداري/نظامي": "#8FA8BE",
      },
      extra: ["#B49CD8", "#4FD1A5", "#C99A86", "#8FA8BE"],
      onAccent: "#0B1017",
    },
    light: {
      bg: "#F2F5F8", surface: "#FFFFFF", sunken: "#E9EEF4",
      paper: "#15212C", muted: "#53687A", faint: "#7B8C9C",
      brass: "#96751A", line: "rgba(21,33,44,.11)", lineSoft: "rgba(21,33,44,.06)",
      shadow: "0 1px 3px rgba(21,33,44,.05), 0 10px 26px -18px rgba(21,33,44,.2)",
      shadowUp: "0 3px 8px rgba(21,33,44,.08), 0 22px 46px -20px rgba(21,33,44,.26)",
      zone: "#7B94A8", zoneOn: "#96751A",
      sta: { "معتمدة": "#12795A", "تم الرفض": "#B04A40", "قيد الدراسة": "#8A6318", "تم التصويت": "#4E6474" },
      pri: { "عالية جدًا": "#B04A40", "عالية": "#8A6318", "متوسطة": "#2E6C86", "عادية": "#53687A" },
      cat: {
        "تصحيح عيب تنفيذي": "#B04A40", "تصميمي/جمالي": "#5E5488", "ترقية": "#12795A",
        "استفسار فني توضيحي": "#2E6C86", "تجاري": "#8A6318", "إداري/نظامي": "#4E6474",
      },
      extra: ["#5E5488", "#12795A", "#84544A", "#4E6474"],
      onAccent: "#FFFFFF",
    },
  },
  mahdar: {
    label: "المَحضر", labelEn: "Mahdar",
    note: "سجل أرشيفي — خط نسخي للعناوين، خطوط شعرة، نحاسي مكسور.",
    swatch: ["#0A0E12", "#B08D4F", "#4A8A6E"],
    skin: SKIN_MAHDAR,
    dark: {
      bg: "#0A0E12", surface: "#11161C", sunken: "#0D1218",
      paper: "#E6E9EB", muted: "#8C959D", faint: "#5C666E",
      brass: "#B08D4F", line: "rgba(255,255,255,.078)", lineSoft: "rgba(255,255,255,.045)",
      shadow: "0 1px 2px rgba(0,0,0,.3), 0 10px 26px -22px rgba(0,0,0,.7)",
      shadowUp: "0 2px 6px rgba(0,0,0,.4), 0 20px 44px -24px rgba(0,0,0,.85)",
      zone: "#78838C", zoneOn: "#B08D4F",
      sta: { "معتمدة": "#4A8A6E", "تم الرفض": "#AC554C", "قيد الدراسة": "#9A7838", "تم التصويت": "#6E8092" },
      pri: { "عالية جدًا": "#AC554C", "عالية": "#9A7838", "متوسطة": "#6E8092", "عادية": "#5C666E" },
      cat: {
        "تصحيح عيب تنفيذي": "#AC554C", "تصميمي/جمالي": "#8A7FA8", "ترقية": "#4A8A6E",
        "استفسار فني توضيحي": "#6E8092", "تجاري": "#9A7838", "إداري/نظامي": "#78838C",
      },
      extra: ["#8A7FA8", "#4A8A6E", "#A0796B", "#6E8092"],
      onAccent: "#0A0E12",
    },
    light: {
      bg: "#FAF9F6", surface: "#FFFFFF", sunken: "#F3F2ED",
      paper: "#14181C", muted: "#5A646C", faint: "#8A939B",
      brass: "#8A6A2F", line: "rgba(20,24,28,.1)", lineSoft: "rgba(20,24,28,.055)",
      shadow: "0 1px 2px rgba(20,24,28,.04), 0 8px 20px -18px rgba(20,24,28,.18)",
      shadowUp: "0 2px 5px rgba(20,24,28,.06), 0 18px 40px -22px rgba(20,24,28,.24)",
      zone: "#7B848C", zoneOn: "#8A6A2F",
      sta: { "معتمدة": "#2F6B52", "تم الرفض": "#96423A", "قيد الدراسة": "#7A5C25", "تم التصويت": "#4E6072" },
      pri: { "عالية جدًا": "#96423A", "عالية": "#7A5C25", "متوسطة": "#4E6072", "عادية": "#5A646C" },
      cat: {
        "تصحيح عيب تنفيذي": "#96423A", "تصميمي/جمالي": "#5E5488", "ترقية": "#2F6B52",
        "استفسار فني توضيحي": "#4E6072", "تجاري": "#7A5C25", "إداري/نظامي": "#4E6072",
      },
      extra: ["#5E5488", "#2F6B52", "#7E5347", "#4E6072"],
      onAccent: "#FFFFFF",
    },
  },
  mukhattat: {
    label: "المُخطَّط", labelEn: "Mukhattat",
    note: "لغة الرسم التنفيذي — ورق شبكة، علامات زوايا، وخطوط أبعاد.",
    swatch: ["#06182B", "#5CC8DE", "#FF7A5C"],
    skin: SKIN_MUKHATTAT,
    dark: {
      bg: "#06182B", surface: "#0B2540", sunken: "#04111F",
      paper: "#DCEAF5", muted: "#7FA3BE", faint: "#527892",
      brass: "#5CC8DE", line: "rgba(92,200,222,.21)", lineSoft: "rgba(92,200,222,.08)",
      shadow: "none", shadowUp: "0 0 0 1px rgba(92,200,222,.34)",
      zone: "#7FA3BE", zoneOn: "#5CC8DE",
      sta: { "معتمدة": "#3FC7A4", "تم الرفض": "#FF7A5C", "قيد الدراسة": "#E8A33D", "تم التصويت": "#7FA3BE" },
      pri: { "عالية جدًا": "#FF7A5C", "عالية": "#E8A33D", "متوسطة": "#7FA3BE", "عادية": "#527892" },
      cat: {
        "تصحيح عيب تنفيذي": "#FF7A5C", "تصميمي/جمالي": "#A79BE0", "ترقية": "#3FC7A4",
        "استفسار فني توضيحي": "#5CC8DE", "تجاري": "#E8A33D", "إداري/نظامي": "#7FA3BE",
      },
      extra: ["#A79BE0", "#3FC7A4", "#D69A87", "#7FA3BE"],
      onAccent: "#04111F",
    },
    light: {
      bg: "#EFF3F7", surface: "#FFFFFF", sunken: "#E4EBF2",
      paper: "#0C2136", muted: "#4A6B85", faint: "#7A93A8",
      brass: "#0B6E92", line: "rgba(11,110,146,.27)", lineSoft: "rgba(11,110,146,.1)",
      shadow: "none", shadowUp: "0 0 0 1px rgba(11,110,146,.42)",
      zone: "#4A6B85", zoneOn: "#0B6E92",
      sta: { "معتمدة": "#12795F", "تم الرفض": "#C4432B", "قيد الدراسة": "#8A6318", "تم التصويت": "#4A6B85" },
      pri: { "عالية جدًا": "#C4432B", "عالية": "#8A6318", "متوسطة": "#4A6B85", "عادية": "#7A93A8" },
      cat: {
        "تصحيح عيب تنفيذي": "#C4432B", "تصميمي/جمالي": "#5A4E8C", "ترقية": "#12795F",
        "استفسار فني توضيحي": "#0B6E92", "تجاري": "#8A6318", "إداري/نظامي": "#4A6B85",
      },
      extra: ["#5A4E8C", "#12795F", "#8A5140", "#4A6B85"],
      onAccent: "#FFFFFF",
    },
  },
  masar: {
    label: "المسار", labelEn: "Masar",
    note: "ترتيب زمني — عمود فقري تتفرّع منه القيود، بلون الطين الدافئ.",
    swatch: ["#0E1211", "#CE7A56", "#5AA37E"],
    skin: SKIN_MASAR,
    dark: {
      bg: "#0E1211", surface: "#161C1A", sunken: "#0A0D0C",
      paper: "#E9EDEA", muted: "#93A09A", faint: "#66736D",
      brass: "#CE7A56", line: "rgba(233,237,234,.095)", lineSoft: "rgba(233,237,234,.05)",
      shadow: "0 1px 2px rgba(0,0,0,.3), 0 12px 30px -24px rgba(0,0,0,.75)",
      shadowUp: "0 3px 8px rgba(0,0,0,.4), 0 24px 52px -26px rgba(0,0,0,.88)",
      zone: "#93A09A", zoneOn: "#CE7A56",
      sta: { "معتمدة": "#5AA37E", "تم الرفض": "#CE6B5E", "قيد الدراسة": "#C69A4A", "تم التصويت": "#8494A0" },
      pri: { "عالية جدًا": "#CE6B5E", "عالية": "#C69A4A", "متوسطة": "#8494A0", "عادية": "#66736D" },
      cat: {
        "تصحيح عيب تنفيذي": "#CE6B5E", "تصميمي/جمالي": "#A392C4", "ترقية": "#5AA37E",
        "استفسار فني توضيحي": "#8494A0", "تجاري": "#C69A4A", "إداري/نظامي": "#93A09A",
      },
      extra: ["#A392C4", "#5AA37E", "#C08A72", "#8494A0"],
      onAccent: "#0E1211",
    },
    light: {
      bg: "#F6F5F1", surface: "#FFFFFF", sunken: "#ECEBE5",
      paper: "#171D1B", muted: "#5A6763", faint: "#87938E",
      brass: "#A85434", line: "rgba(23,29,27,.1)", lineSoft: "rgba(23,29,27,.055)",
      shadow: "0 1px 2px rgba(23,29,27,.04), 0 10px 24px -20px rgba(23,29,27,.2)",
      shadowUp: "0 2px 6px rgba(23,29,27,.07), 0 22px 46px -22px rgba(23,29,27,.26)",
      zone: "#5A6763", zoneOn: "#A85434",
      sta: { "معتمدة": "#2E6B4E", "تم الرفض": "#A34438", "قيد الدراسة": "#8A6318", "تم التصويت": "#4E5E6A" },
      pri: { "عالية جدًا": "#A34438", "عالية": "#8A6318", "متوسطة": "#4E5E6A", "عادية": "#87938E" },
      cat: {
        "تصحيح عيب تنفيذي": "#A34438", "تصميمي/جمالي": "#5A4E8C", "ترقية": "#2E6B4E",
        "استفسار فني توضيحي": "#4E5E6A", "تجاري": "#8A6318", "إداري/نظامي": "#5A6763",
      },
      extra: ["#5A4E8C", "#2E6B4E", "#8A5140", "#4E5E6A"],
      onAccent: "#FFFFFF",
    },
  },
};
export const THEME_KEYS = ["classic", "ufuq", "mahdar", "mukhattat", "masar"];
export const DEFAULT_THEME_KEY = "classic";

/* خطوط إضافية تُحمَّل فقط عند اعتماد طقم يحتاجها — ما نثقّل الزائر بلا داعٍ */
const SKIN_FONTS = {
  mahdar: "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap",
};
export function useSkinFont(themeKey) {
  useEffect(() => {
    const href = SKIN_FONTS[themeKey];
    if (!href || document.querySelector(`link[data-skin-font="${themeKey}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.dataset.skinFont = themeKey;
    document.head.appendChild(l);
  }, [themeKey]);
}

/* الطقم والتصميم المعتمدان — يُقرآن من قاعدة البيانات ويتحدّثان لحظيًا لكل الزوّار.
   active_theme  = طقم الألوان (كلاسيكي/أفق/محضر/مخطط/مسار)
   active_design = هيكل التصميم نفسه (classic = القديم، nova = الجديد المتحرّك) */
/* ── صدى محلي للطقم/التصميم المعتمد ──
   المصدر الحقيقي يبقى قاعدة البيانات وحدها، لكن رحلة الشبكة تاخذ وقتًا، وخلالها
   كان الموقع يرسم الافتراضي (الكلاسيكي) ثم يقلب للمعتمد أمام عين الزائر.
   نحفظ آخر قيمة معروفة بمتصفح الزائر ونقرأها فورًا عند أول رسمة، فيبدأ الموقع
   بالتصميم الصحيح مباشرة. لو تغيّر الاعتماد من لوحة الإدارة، الرد الحي يصحّح
   القيمة ويحدّث الصدى — فالزيارة الجاية تبدأ صحيحة من البداية.
   نحفظ معها ألوان الخلفية ورابط الخط عشان شاشة الإقلاع بـ index.html تقدر
   ترسم اللون الصحيح قبل ما تُحمَّل حزمة الجافاسكربت أصلًا. */
const CFGKEY = "owners-site-config";

function readCachedCfg() {
  try {
    const o = JSON.parse(localStorage.getItem(CFGKEY) || "null");
    if (!o || !THEME_KEYS.includes(o.theme) || !DESIGN_KEYS.includes(o.design)) return null;
    return { theme: o.theme, design: o.design };
  } catch { return null; }
}

function writeCachedCfg(theme, design) {
  try {
    const set = THEME_SETS[theme] || THEME_SETS[DEFAULT_THEME_KEY];
    const lt = set.light || set.dark || {};
    const dk = set.dark || set.light || {};
    localStorage.setItem(CFGKEY, JSON.stringify({
      theme, design,
      /* «بنّاء» أرضيته أغمق درجة من خلفية الطقم — شاشة الإقلاع تاخذ نفس اللون */
      bg: design === "bannaa"
        ? { light: bannaaGround(lt, "light"), dark: bannaaGround(dk, "dark") }
        : { light: lt.bg, dark: dk.bg },
      fg: { light: lt.muted, dark: dk.muted },
      font: SKIN_FONTS[theme] || null,
      dfont: design === "bannaa" ? BANNAA_FONT : null,
    }));
  } catch { /* تصفح خاص أو تخزين ممنوع — نتجاهل بهدوء */ }
}

/* شاشة الإقلاع بـ index.html: تغطّي الصفحة بلون الطقم المخبّأ لين يجهز التصميم
   الصحيح. تُشال فورًا لو المخبّأ كان مطابقًا (الحالة الغالبة)، وبتلاشٍ قصير لو
   انتظرنا رد القاعدة — فما يشوف الزائر أي تبديل تصميم تحت عينه. */
export function hideBoot(instant) {
  if (typeof document === "undefined") return;
  const b = document.getElementById("boot");
  if (!b) return;
  if (instant) { b.remove(); return; }
  b.classList.add("boot-gone");
  setTimeout(() => b.remove(), 420);
}

export function useSiteConfig() {
  const [cached] = useState(readCachedCfg);   /* يُقرأ مرة واحدة قبل أول رسمة */
  const [cfg, setCfg] = useState(() => cached || { theme: DEFAULT_THEME_KEY, design: DEFAULT_DESIGN_KEY });
  /* جاهز = نعرف يقينًا وش التصميم المطلوب رسمه (من المخبّأ أو من رد القاعدة) */
  const [ready, setReady] = useState(!!cached);

  useEffect(() => {
    let alive = true;
    /* لو تأخّرت القاعدة أو فشل الاتصال، ما نحبس الزائر — نكمل بالمتاح */
    const guard = setTimeout(() => { if (alive) setReady(true); }, 1500);
    const pull = async () => {
      try {
        const { data } = await supabase.from("site_settings").select("active_theme,active_design").eq("id", 1).single();
        if (!alive) return;
        if (data) {
          const next = {
            theme: THEME_KEYS.includes(data.active_theme) ? data.active_theme : DEFAULT_THEME_KEY,
            design: DESIGN_KEYS.includes(data.active_design) ? data.active_design : DEFAULT_DESIGN_KEY,
          };
          /* لو المخبّأ كان مطابقًا نرجّع نفس الكائن — فما تصير إعادة رسم ولا انتقال ألوان */
          setCfg((p) => (p.theme === next.theme && p.design === next.design ? p : next));
          writeCachedCfg(next.theme, next.design);
        }
      } catch { /* يبقى المخبّأ أو الافتراضي */ }
      finally { if (alive) { clearTimeout(guard); setReady(true); } }
    };
    pull();
    const ch = supabase.channel("public-site-settings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, pull)
      .subscribe();
    return () => { alive = false; clearTimeout(guard); supabase.removeChannel(ch); };
  }, []);

  return { ...cfg, ready };
}

export const ThemeCtx = createContext({ T: THEMES.light, mode: "light", setMode: () => {}, resolved: "light" });
export const useT = () => useContext(ThemeCtx);

export const LangCtx = createContext({ lang: "ar", setLang: () => {} });
export const useLang = () => useContext(LangCtx);

/* ── ٥. أدوات نص عربي، تحليل النماذج، ومناطق المخطط ── */
export const hashPick = (s, arr) => arr[Math.abs([...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0)) % arr.length];

/* لون فئة البند — لو جت فئة جديدة من الإكسل بلا لون معرَّف، ناخذ لها لونًا ثابتًا من قائمة
   الألوان الإضافية بحسب نص الفئة نفسها (نفس أسلوب حالات الاعتماد)، فتبقى الألوان ثابتة
   بين الجلسات بدون ما نحتاج نضيف اللون يدويًا لكل فئة جديدة */
export const catColor = (T, v) => (v ? (T.cat && T.cat[v]) || hashPick(v, T.extra) : T.faint);

/* ── نص عربي: توحيد للبحث والمطابقة ── */
export const norm = (s = "") =>
  String(s).replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/\s+/g, " ").trim().toLowerCase();

/* ── نماذج المشروع الأربعة الفعلية ──
   عمود «نوع النموذج» في الملف يصف نطاق الملاحظة لا اسم نموذج واحد
   (مثل «جميع النماذج» أو «جميع النماذج عدا امانيثير»)، فنحلّله إلى النماذج المشمولة. */
export const MODEL_LIST = ["امانيثير", "اورورا", "البادا", "البا"];
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
export function modelsOf(scope) {
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
export const ZONES = [
  { key: "roof", label: "السطح" }, { key: "first", label: "الدور الأول" },
  { key: "slab", label: "الأرضي والأول" }, { key: "ground", label: "الدور الأرضي" },
  { key: "wet", label: "المطبخ ودورات المياه" }, { key: "stairs", label: "الدرج" },
  { key: "whole", label: "كامل الفيلا" }, { key: "party", label: "جدار الفلل المتلاصقة" },
  { key: "tank", label: "موقع الخزان" }, { key: "street", label: "الشارع" },
  { key: "na", label: "غير محدد / أخرى" },
];
export function zoneOf(loc) {
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
export const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const fmtDate = (iso) => {
  try { const d = new Date(iso); return `${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`; }
  catch { return ""; }
};

/* ── النسخة الأساسية كسجلات نصية ── مستوردة من inquiries.json */
export const BASE = INQUIRIES_DATA.map((r) => ({
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
const PG_MONTH_KEYS = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];
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
export const PG_NOTE = "بلوك ٢٣: لا توجد بيانات جديدة لمايو ويونيو، فتم ترحيل آخر نسبة مسجَّلة (١٩٫٥٠٪ في أبريل) بدل تجاهله.";
/* نسخة بدون أرقام شهرية (v) من PG_PHASES — تُستخدم لبناء بيانات أي شهور تجي من قاعدة
   البيانات مستقبلًا (تحافظ على نفس التسميات والترتيب الثابت بغض النظر عن مصدر الأرقام) */
const PG_PHASES_META = PG_PHASES.map(({ key, label, note }) => ({ key, label, note }));
export const PG_PHASE_NAME = { p1: "المرحلة الأولى", p2: "المرحلة الثانية", p3: "المرحلة الثالثة", p4: "المرحلة الرابعة", p_unassigned: "غير مصنّف" };
export const PG_BASE = { months: PG_MONTHS, monthKeys: PG_MONTH_KEYS, target: PG_TARGET, phases: PG_PHASES, blocks: PG_BLOCKS, note: PG_NOTE, monthNotes: {}, updatedAt: null, label: "", start: { y: 2026, m: 2 } };

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
   ٦ب. تقدّم التنفيذ من قاعدة البيانات — يحلّ محلّ الاعتماد الكامل على
   PG_BASE الثابت بالكود. المصدر الحقيقي بقاعدة البيانات هو جدول
   progress_readings (بلوك واحد + شهر واحد + نسبة لكل صف)، وview باسم
   progress_matrix_v يحسب منه تلقائيًا نفس شكل {month, phases, blocks}
   القديم — فالدالة buildPgFromRows تحتها ما احتاجت أي تعديل. الهدف
   (target) ما يُخزَّن إطلاقًا — يُحسب دائمًا آليًا بصيغة planTarget()
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
export const PG_BLOCK_DISPLAY_ORDER = [1, 2, 3, 5, 4, 7, 6, 8, 9, 10, 14, 13, 22, 12, 15, 23];
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
export const monthKeyOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
export const monthKeyParts = (key) => { const [y, m] = String(key).split("-").map(Number); return { y, m }; };
export function nextMonthKey(key) {
  const { y, m } = monthKeyParts(key);
  const t = y * 12 + (m - 1) + 1;
  return monthKeyOf(Math.floor(t / 12), (t % 12) + 1);
}
/* يبني نفس شكل بيانات PG_BASE (months/target/phases/blocks/start) من صفوف جدول
   progress_matrix — يملأ أي شهر مفقود بين أقدم وأحدث شهر موجود بقيمة فارغة (null)
   عشان يبقى تسلسل الأشهر متصلًا (مطلوب لحساب الهدف تلقائيًا ولتمديد الخطة مستقبلًا)
   حتى لو رفع الأدمن ملفًا فيه فجوة (مثلاً شهر سحبه المطوّر بالكامل ولا صار له صف أصلاً). */
export function buildPgFromRows(rows) {
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
  return { months, monthKeys, target, phases, blocks, note: PG_NOTE, updatedAt, label: "", start: { y: startY, m: startM } };
}

export const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arNum = (n) => String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
export const trYear = (lang, y) => (y == null ? "" : lang === "en" ? String(y) : arNum(y));

/* توسعة السلسلة حتى الشهر الحالي: أشهر جديدة بأهداف محسوبة وإنجاز فارغ (null) */
export function extendPlan(data, now) {
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
  const outK = Array.isArray(data.monthKeys) ? [...data.monthKeys] : [];
  for (let k = 1; k <= add; k++) {
    const t = (lastM - 1) + k;
    const y = lastY + Math.floor(t / 12);
    const m = (t % 12) + 1;
    outM.push(MONTH_AR[m - 1]);
    years.push(y);
    outT.push(planTarget(y, m));
    if (outK.length) outK.push(monthKeyOf(y, m));
  }
  const pad = (v) => [...(Array.isArray(v) ? v : []), ...Array(add).fill(null)];
  return {
    ...data,
    months: outM, monthKeys: outK.length ? outK : data.monthKeys, target: outT, years, added: add,
    phases: (data.phases || []).map((p) => ({ ...p, v: pad(p.v) })),
    blocks: (data.blocks || []).map((b) => ({ ...b, v: pad(b.v) })),
  };
}

/* ── ترجمة محتوى تقدم التنفيذ (النسخة الأساسية المدمجة فقط؛ التحديثات الحيّة تبقى كما رُفعت) ── */
export const PG_PHASE_NAME_EN = { p1: "Phase 1", p2: "Phase 2", p3: "Phase 3", p4: "Phase 4", p_unassigned: "Unclassified" };
const PG_LABEL_EN = { "إجمالي المشروع": "Total Project", "المرحلة الأولى": "Phase 1", "المرحلة الثانية": "Phase 2", "المرحلة الثالثة": "Phase 3", "المرحلة الرابعة": "Phase 4" };
const PG_PNOTE_EN = { "كل البلوكات": "All Blocks", "بلوكات ١-٥": "Blocks 1–5", "بلوكات ٦-٨": "Blocks 6–8", "بلوكات ٩-١٥": "Blocks 9–15", "بلوكات ٢٢ و٢٣": "Blocks 22 & 23" };
export const PG_NOTE_EN = "Block 23: no new data for May or June, so the last recorded reading (19.50% in April) was carried forward for the average rather than ignored.";
export const trPGMonth = (lang, m) => { const i = MONTH_AR.indexOf(m); return lang === "en" && i >= 0 ? MONTH_EN_LABEL[i] : m; };
export const trPGLabel = (lang, v) => (lang === "en" ? PG_LABEL_EN[v] || v : v);
export const trPGPNote = (lang, v) => (lang === "en" ? PG_PNOTE_EN[v] || v : v);

/* ── الترتيب المنطقي ── */
/* ── ٧. الترتيب المنطقي وتفضيلات الزائر ── */
export const rank = (order) => (v) => { const i = order.indexOf(v); return i === -1 ? order.length + 1 : i; };
export const uniqSorted = (arr, order) => [...new Set(arr)].filter(Boolean).sort((a, b) => rank(order)(a) - rank(order)(b) || a.localeCompare(b, "ar"));

export const TKEY = "owners-inquiries-theme";
