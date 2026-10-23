/* ═══════════════════════════════════════════════════════════
   local-mt-core.js (6.8.0) — منطق محرّك الترجمة الداخلي (عربي ← إنجليزي) بدون أي خدمة خارجية.
   الموديل نفسه (opus-mt-ar-en) يشتغل داخل لوحة الإدارة على جهاز المشرف (local-mt-worker.js)،
   وهذا الملف يحيطه بمعرفة المشروع:
   ١) تصحيح إملاء شائع بملاحظات الملاك (لايوجد ← لا يوجد، الداخليه ← الداخلية…)
   ٢) تقسيم البنية: «… — الحل المقترح: …»، «المطلوب:»، «الوضع الحالي:» تُترجم بقوالب ثابتة
   ٣) حماية المصطلحات: كل مصطلح بمعجم المشروع يُستبدل برقم بديل قبل الترجمة ثم يرجع بمقابله
      المعتمد (الموديل ينقل الأرقام كما هي) — فالأفياش = outlets دائمًا لا «grasses»
   ٤) تصحيحات بعدية مشروطة بوجود المصطلح العربي (حماية ثانية لو ضاع رقم بديل)
   ٥) فحص جودة: الأرقام، بقايا حروف عربية، تناسب الطول — والنتيجة «مسودة» تنتظر الاعتماد
   بلا React وبلا شبكة — يُختبر محليًا بنفس الكود.
   ═══════════════════════════════════════════════════════════ */
import { GLOSSARY } from "./translation-glossary.js";

export { ENGINE_ID, MODEL_ID } from "./local-mt-config.js";
const AR = "\\u0621-\\u064A";

/* ── ١) تطبيع الإملاء ── */
const YH = new RegExp(`(^|[^${AR}])([${AR}]{3,})يه(?=[^${AR}]|$)`, "g");
/* ضمائر متصلة تنتهي بـ«يه» وهي صحيحة (عليه، فيه…) — ما تتحول لتاء مربوطة */
const YH_KEEP = new Set(["عليه", "اليه", "إليه", "لديه", "فيه", "يديه", "عينيه", "اخيه", "أخيه", "ابيه", "أبيه", "ذويه", "طرفيه", "جانبيه", "كليه", "عليهِ"]);
/* كلمات شائعة تنكتب بالهاء بدل التاء المربوطة (الموديل ما يعرفها بالهاء) */
const TA = ["زياده", "ماده", "طريقه", "مساحه", "شركه", "صيانه", "سلامه", "جوده", "خدمه", "مرحله", "غرفه", "نافذه", "حديقه", "واجهه", "خاصه",
  "مقفله", "مغلقه", "مفتوحه", "قائمه", "كميه", "نسبه", "تكلفه", "مشكله", "ملاحظه", "اضافه", "إضافه", "ازاله", "إزاله", "معالجه", "تجربه",
  "مقارنه", "مدينه", "منطقه", "دوره", "شبكه", "جهه", "مده", "فتره", "مسافه", "درجه", "حراره", "رطوبه", "كفاءه", "قوه", "طبقه", "بلاطه", "صبه"];
const TA_RE = new RegExp(`(^|[^${AR}])((?:و|ف|ب|ل|ك)?(?:ال)?)(${TA.join("|")})(?=[^${AR}]|$)`, "g");
/* الأرقام: هندية ← لاتينية، وبدون فواصل الآلاف — الموديل يهلوس بالأرقام المفصولة (50,000 ريال ← «R$1909») */
const toLatin = (t) => String(t || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
const plainNumbers = (t) => t.replace(/(\d)٫(?=\d)/g, "$1.").replace(/(\d)٬(?=\d{3})/g, "$1").replace(/\b\d{1,3}(?:,\d{3})+\b/g, (m) => m.replace(/,/g, ""));
export function normAr(t) {
  return plainNumbers(toLatin(t)).replace(/(\d)(?=[ء-ي])/g, "$1 ")
    .replace(TA_RE, (_m, pre, art, w) => pre + art + w.slice(0, -1) + "ة")
    .replace(/ـ/g, "")
    .replace(/لايوجد/g, "لا يوجد").replace(/لاتوجد/g, "لا توجد").replace(/ماعدا/g, "ما عدا").replace(/لايمكن/g, "لا يمكن")
    .replace(YH, (m, pre, stem) => (YH_KEEP.has(stem + "يه") || YH_KEEP.has((stem + "يه").replace(/^[وفبلك]/, "")) ? m : pre + stem + "ية"))
    .replace(/[ \t]+/g, " ").trim();
}

/* ── ٢) البنية ── */
const MARKERS = [
  [/\s*[—–-]\s*الحل المقترح\s*:\s*/g, " — proposed solution: "],
  [/(^|\n)\s*الحل المقترح\s*:\s*/g, "Proposed solution: "],
  [/(^|\n)\s*الوضع الحالي\s*:\s*/g, "Current situation: "],
  [/(^|\n)\s*المطلوب\s*:\s*/g, "Required: "],
  [/(^|\n)\s*(?:ال)?استفسار\s*:\s*/g, "Inquiry: "],
];
export function segments(text) {
  let t = String(text || "");
  const lits = [];
  for (const [re, en] of MARKERS) {
    t = t.replace(re, (...a) => { const nl = a[1] === "\n" ? "\n" : ""; lits.push(en); return `${nl}\u0001${lits.length - 1}\u0001`; });
  }
  const out = [];
  for (const part of t.split(/(\u0001\d+\u0001)/)) {
    const m = part.match(/^\u0001(\d+)\u0001$/);
    if (m) { out.push({ lit: lits[+m[1]] }); continue; }
    if (!part.trim()) { if (part.includes("\n")) out.push({ lit: "\n" }); continue; }
    if (/^\s*\n/.test(part)) out.push({ lit: "\n" });
    part.trim().split(/\n+/).forEach((line, i) => { if (i) out.push({ lit: "\n" }); if (line.trim()) out.push({ ar: line.trim() }); });
    if (/\n\s*$/.test(part)) out.push({ lit: "\n" });
  }
  return out;
}
export function sentences(text, max = 280) {
  const res = [];
  for (const line of String(text || "").split("\n")) {
    if (!line.trim()) continue;
    /* نقاط التقسيم: بعد علامة نهاية جملة، أو بعد « — » (الشرطة تبقى مع ما قبلها) — وأبدًا داخل الأقواس */
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (depth === 0 && /\s/.test(line[i + 1] || "") && (/[.؟?!؛;]/.test(ch) || (/[—–]/.test(ch) && /\s/.test(line[i - 1] || "")))) {
        parts.push(line.slice(start, i + 1)); start = i + 1;
      }
    }
    parts.push(line.slice(start));
    let cur = "";
    for (const raw of parts) {
      const p = raw.trim();
      if (!p) continue;
      if (cur && (/[—–]$/.test(cur) || (cur + " " + p).length > max)) { res.push(cur); cur = p; } else cur = cur ? cur + " " + p : p;
      while (cur.length > max) {
        /* جملة طويلة جدًا: نقسم عند فاصلة (حد عبارة) قبل الحد، وإلا عند مسافة */
        const win = cur.slice(0, max);
        const c = Math.max(win.lastIndexOf("، "), win.lastIndexOf(", "));
        const sp = win.lastIndexOf(" ");
        const at = c > 60 ? c + 1 : sp > 40 ? sp : max;
        res.push(cur.slice(0, at).trim()); cur = cur.slice(at).trim();
      }
    }
    if (cur.trim()) res.push(cur.trim());
  }
  return res;
}

/* ── ٣) حماية المصطلحات بأرقام بديلة ──
   مصطلحات يترجمها الموديل صح بنفسه (مجرَّبة على نصوص المشروع) ما نحميها — الحماية تفقده سياق الجملة */
const MODEL_OK = new Set(["فيلا", "غرفة السطح", "غرفة الغسيل", "كراج", "حمامات", "حمام", "سيراميك", "العزل الحراري", "ماسورة", "مواسير",
  "الخزان الأرضي", "خزان", "كوابل", "كيبل", "انتركوم", "كاميرات المراقبة", "سبليت", "كاسيت", "المالك", "المطور", "المقاولين", "المقاول",
  "فريق المشروع", "الوحدات", "الوحدة", "النماذج", "أورورا", "مكيفات", "مكيف", "إضاءة", "إنارة", "العزل الصوتي", "مياه الأمطار",
  "المهندس المسؤول", "الملاك", "تكييف", "الصرف الصحي", "المخططات الهندسية", "سور", "سور خارجي", "بورسلان", "الدور الأرضي"]);
/* صيغ القرار بالمعجم (تم اعتماد/بارد…) للمترجم الحرفي القديم — هنا يترجمها الموديل بسياقها */
const NOT_TERMS = new Set(["تم اعتماد", "تم الاعتماد", "تم رفض", "لن يتم", "سوف يتم", "قيد الدراسة", "قيد المراجعة", "بارد", "حار"]);
export const EXTRA_TERMS = [
  ["عدد الأفياش", "number of outlets"], ["الأدوار", "floors"], ["أدوار", "floors"],
  ["م/محمد عبدالمعطي", "Eng. Mohammed Abdulmuti"], ["م/أحمد ملحم", "Eng. Ahmed Malham"], ["م/رواحه", "Eng. Rawaha"], ["م/إبراهيم", "Eng. Ibrahim"],
  ["وديان الثميري", "Wedyan Althumairi"], ["وديان", "Wedyan"], ["أبو سلطان", "Abu Sultan"], ["أبو علي", "Abu Ali"], ["أدولفو", "Adolfo"],
  ["آمانيثير", "Amanecer"], ["امانيثير", "Amanecer"],
  ["سيتي سكيب", "Cityscape"], ["ملحق العقد", "contract addendum"], ["الملحق الخارجي", "external annex"], ["مدير التسليم", "handover manager"],
  ["اللفائف البيتومينية", "bituminous membrane rolls"],
];
const nrm = (t) => t.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const cls = (t) => nrm(t).replace(/[^\s]/g, (ch) => (ch === "ا" ? "[اأإآ]" : ch === "ه" ? "[ةه]" : ch === "ي" ? "[ىي]" : ch.replace(/[.*+?^${}()|[\]\\/'-]/g, "\\$&")));
const TERMS = [...GLOSSARY.filter(([ar]) => !MODEL_OK.has(ar) && !NOT_TERMS.has(ar)), ...EXTRA_TERMS]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([ar, en]) => {
    const base = ar.replace(/^ال/, "");
    const body = base.split(/\s+/).map((w, i) => (i === 0 ? cls(w) : "(?:ال)?" + cls(w))).join("\\s+");
    return { re: new RegExp(`(?<![${AR}])([وف]?)(لل|[بلك]?(?:ال)?)(${body})(?![${AR}])`, "g"), en };
  });
const PREP = { "ب": "في ", "ل": "إلى ", "لل": "إلى ", "ك": "مثل " };
/* الأرقام اللي يغلط فيها الموديل (12.5 ← «12,415»، 3400000 ← «34 million»، 2.75 ← «2-75»، 3-4 ← «3.4»، Cat6A ← «C4A»)
   تُحمى برقم بديل صحيح يرجع كما هو، ومعها التواريخ. الأرقام الصغيرة والسنوات ينقلها الموديل صح فتبقى. */
const NUM_RE = /\b[A-Za-z]+\d+[A-Za-z0-9]*\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d+(?:\.\d+)?[-–]\d+(?:\.\d+)?\b|\b\d+\.\d+\b|\b\d{4,}\b/g;
const fmtNum = (m) => (/^\d{5,}$/.test(m) ? Number(m).toLocaleString("en-US") : m);
export function protect(text) {
  const used = new Set(String(text).match(/\d+/g) || []);
  let n = 900;
  const map = new Map(), byEn = new Map();
  const next = () => { do { n++; } while (used.has(String(n))); return String(n); };
  let out = String(text).replace(NUM_RE, (m) => {
    if (/^(19|20)\d{2}$/.test(m)) return m;
    const code = next(); map.set(code, fmtNum(m)); return ` ${code} `;
  });
  for (const { re, en } of TERMS) {
    out = out.replace(re, (_m, w, p) => {
      let code = byEn.get(en);
      if (!code) { code = next(); byEn.set(en, code); map.set(code, en); }
      const conj = w === "و" ? "و" : w === "ف" ? "ف" : "";
      const prep = PREP[String(p).replace(/ال$/, "")] || "";
      return ` ${conj}${conj && prep ? " " : ""}${prep}${code} `;
    });
  }
  return { text: out.replace(/\s{2,}/g, " ").trim(), map };
}
export function restore(en, map) {
  let t = String(en || "");
  const missing = [];
  for (const [code, term] of map) {
    if (!new RegExp(`\\b${code}(?:'s|s)?\\b`).test(t)) { missing.push(code); continue; }
    t = t.replace(new RegExp(`\\b${code}(?:'s|s)?\\b`, "g"), term);
  }
  return { en: t, missing };
}

/* ── ٤) تصحيحات بعدية ── */
const POST = [
  [/&apos;|&#39;/g, "'"], [/&quot;/g, '"'], [/&amp;/g, "&"],
  [/\blitres\b/g, "liters"], [/\blitre\b/g, "liter"], [/\bmetres\b/g, "meters"], [/\bmetre\b/g, "meter"], [/\bcentimetres?\b/g, "cm"],
  [/\bcolour/g, "color"], [/\bfibre\b/g, "fiber"], [/\bcentre\b/g, "center"], [/\balumini?um\b/gi, "aluminum"],
  [/\bwater harvesting\b/gi, "water pooling"], [/\bin (first|second|ground|top) floor\b/gi, "on the $1 floor"], [/\bexcept roof\b/gi, "except the roof"],
  [/\bR\$\s?(?=\d)/g, "SAR "], [/\b(\d[\d,.]*)\s?(?:Saudi\s)?(?:rials?|riyals?|reals?)\b/gi, "SAR $1"],
  [/\s+'\s*s\b/g, "'s"], [/^The proposed solution:\s*/i, ""], [/\s{2,}/g, " "], [/\s+([,.;:])/g, "$1"],
];
/* [وجود هذا بالعربي، خطأ شائع بالإنجليزي، الصحيح] — شبكة أمان لو ترجم الموديل المصطلح بدون حماية */
const COND = [
  [/حوش/, /\b(monsters?|courtyards?)\b/gi, "yard"], [/مجلس/, /\b(council|boardroom|board room)\b/gi, "majlis"],
  [/فلل|الفلل/, /\belephants?\b/gi, "villas"], [/جبس/, /\b(Gibbs?\s*Bord|gypsies|Gips\s*Board)\b/gi, "gypsum board"],
  [/كسار/, /\b(fractures?|crushers?|scratches)\b/gi, "sill flashings"], [/دور(ات|ة) المياه/, /\bwater cycles?\b/gi, "bathrooms"],
  [/الادوار|الأدوار/, /\broles\b/gi, "floors"], [/(^|[^ء-ي])(ال)?دور(?![ء-ي])/, /\brole\b/gi, "floor"],
  [/بلك/, /\bBlack\b/g, "Block"], [/[اأ]فياش/, /\b(grass(es)?|cattle|vacs|chips|snakes|fish)\b/gi, "outlets"],
  [/سطح/, /\bsurface\b/gi, "roof"], [/صفاي/, /\b(rows?|profiles?|strainers?)\b/gi, "drain"], [/منور/, /\blighthouse\b/gi, "light well"],
  [/تاسيس|تأسيس/, /\b(establishment|foundation stage)\b/gi, "rough-in"],
  [/ملاك/, /\b(?:angels?|staff(?:ing| members)?)\b/gi, "owners"], [/نموذج|نماذج/, /\bforms\b/gi, "models"], [/نموذج|نماذج/, /\bform\b/gi, "model"],
  [/عزل/, /\bisolated\b/gi, "insulated"], [/فيلا|فلة|فلل/, /\belephants\b/gi, "villas"], [/فيلا|فلة|فلل/, /\belephant\b/gi, "villa"],
  [/بادا/, /\b(?:the )?pada\b/gi, "Albada"], [/مانيثير/, /\bAmanit(?:e|her)\b/gi, "Amanecer"], [/واجه/, /\binterfaces?\b/gi, "façade"], [/عزل/, /\bisolation\b/gi, "insulation"],
  [/بيتومين/, /\bpituminous\b/gi, "bituminous"], [/^(?![\s\S]*معدات)[\s\S]*تجهيزات/, /\b(supplies|equipment)\b/gi, "fit-outs"],
  [/(^|[^ء-ي])(ال)?درج(?![ء-ي])/, /\b(\d+(?:\s*(?:to|-)\s*\d+)?)\s+degrees\b/gi, "$1 steps"],
  [/\d{1,2}-\d{1,2}-\d{4}/, /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, "$1-$2-$3"],
];
export function post(en, ar = "") {
  let t = String(en || "").trim();
  for (const [re, to] of POST) t = t.replace(re, to);
  for (const [arRe, wrong, right] of COND) if (arRe.test(ar)) t = t.replace(wrong, right);
  if (/^\s*(ال)?استفسار\s+(عن|حول)/.test(ar)) t = t.replace(/^(Questions? (about|on|of|the)|Ask(ing)? (about|on)|Inquiring (about|into)|Query (about|on|into))\s*/i, "Inquiry about ");
  return t.trim();
}
const SMALL = new Set(["a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "by", "from", "as"]);
export function titleCase(s) {
  return String(s || "").split(" ").map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

/* ── ٥) فحص الجودة ── */
const AR_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const latinDigits = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/٫/g, ".").replace(/٬/g, ",").replace(/²/g, "2").replace(/³/g, "3");
const normNum = (x) => x.replace(/,/g, "").replace(/^0+(?=\d)/, "");
export const numbersOf = (s) => (latinDigits(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(normNum).filter(Boolean);
export function validate(ar, en, kind = "text") {
  const t = String(en || "").trim();
  if (!t) return ["empty"];
  const issues = [];
  if (AR_SCRIPT.test(t)) issues.push("arabic_left");
  const have = new Set(numbersOf(t));
  const missing = [...new Set(numbersOf(ar))].filter((n) => !have.has(n));
  if (missing.length) issues.push("numbers:" + missing.slice(0, 6).join(","));
  if (kind === "text" && ar.length >= 80) { const r = t.length / ar.length; if (r < 0.6 || r > 3.2) issues.push("length"); }
  return issues;
}

/* ── أسماء الأشخاص: نقل حرفي (الموديل يترجم معنى الاسم: «الجديد» ← «the new») ── */
const NAMES = {
  "محمد": "Mohammed", "احمد": "Ahmed", "عبدالله": "Abdullah", "عبد الله": "Abdullah", "خالد": "Khalid", "سلطان": "Sultan", "علي": "Ali",
  "فهد": "Fahad", "سعد": "Saad", "ناصر": "Nasser", "عبدالرحمن": "Abdulrahman", "ابراهيم": "Ibrahim", "عمر": "Omar", "يوسف": "Yousef",
  "سعود": "Saud", "فيصل": "Faisal", "تركي": "Turki", "بندر": "Bandar", "ماجد": "Majed", "نايف": "Naif", "سلمان": "Salman",
  "عبدالعزيز": "Abdulaziz", "صالح": "Saleh", "حمد": "Hamad", "منصور": "Mansour", "وليد": "Waleed", "طارق": "Tariq", "هشام": "Hisham",
  "مشعل": "Mishal", "راشد": "Rashed", "حسن": "Hassan", "حسين": "Hussein", "مصطفى": "Mustafa", "محمود": "Mahmoud", "عادل": "Adel",
  "سامي": "Sami", "ياسر": "Yasser", "زياد": "Ziyad", "نواف": "Nawaf", "عبدالمجيد": "Abdulmajeed", "عبدالمعطي": "Abdulmuti", "ملحم": "Malham",
  "رواحه": "Rawaha", "وديان": "Wedyan", "نوره": "Noura", "ساره": "Sarah", "مريم": "Maryam", "فاطمه": "Fatimah", "عبير": "Abeer", "هند": "Hind",
  "ابو": "Abu", "ام": "Umm", "بن": "bin", "بنت": "bint",
};
const LET = { "ا": "a", "أ": "a", "إ": "i", "آ": "aa", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z",
  "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h",
  "و": "o", "ي": "i", "ة": "a", "ى": "a", "ء": "", "ئ": "e", "ؤ": "o" };
export function transliterateName(ar) {
  return String(ar || "").trim().split(/\s+/).map((w) => {
    const k = nrm(w).replace(/ه$/, "ه");
    if (NAMES[k]) return NAMES[k];
    let al = "";
    let body = w;
    if (/^ال/.test(w) && w.length > 3) { al = "Al-"; body = w.slice(2); }
    const kb = nrm(body);
    const core = NAMES[kb] || kb.split("").map((c) => LET[c] ?? "").join("");
    return al + core.charAt(0).toUpperCase() + core.slice(1);
  }).join(" ");
}

/* ── الترجمة الكاملة لنص واحد. mt = (جملة عربية) => Promise<إنجليزي> (الموديل) ── */
/* مخرجات متكررة («hot, hot, hot…») = تعطّل بالتوليد */
const degenerate = (t) => /\b(\w+)(?:[\s,.;:-]+\1\b){4,}/i.test(String(t || ""));
async function run(mt, src, flags) {
  const cap = Math.min(400, 48 + Math.round(src.length * 1.5));
  let out = await mt(src, { max_new_tokens: cap });
  if (degenerate(out)) {
    out = await mt(src, { max_new_tokens: cap, no_repeat_ngram_size: 3, repetition_penalty: 1.3 });
    if (degenerate(out)) flags.add("repetition");
  }
  return out;
}
async function translatePiece(ar, mt, flags) {
  const { text: px, map } = protect(ar);
  if (!map.size) return post(await run(mt, ar, flags), ar);
  const r = restore(post(await run(mt, px, flags), ar), map);
  if (!r.missing.length) return post(r.en, ar);
  flags.add("term_check"); /* ضاع رقم بديل: نترجم الجملة بدون حماية ونعتمد على التصحيحات المشروطة */
  return post(await run(mt, ar, flags), ar);
}
export async function translateText(text, kind, mt) {
  const src = normAr(text);
  if (!src) return { en: "", flags: [] };
  const flags = new Set();
  if (kind && kind !== "text") {
    let prefix = "", rest = src;
    rest = rest.replace(/^م\s*\/\s*/, () => { prefix = "Eng. "; return ""; }).replace(/^د\s*\/\s*/, () => { prefix = "Dr. "; return ""; });
    const direct = EXTRA_TERMS.find(([a]) => nrm(a) === nrm(src)) || GLOSSARY.find(([a]) => nrm(a) === nrm(src));
    let en = direct ? direct[1] : kind === "person" ? transliterateName(rest) : await translatePiece(rest, mt, flags);
    if (!direct) en = prefix + en.replace(/[.。]+$/, "").trim();
    if (kind === "label" || kind === "heading" || kind === "title") en = titleCase(en);
    validate(src, en, kind).forEach((x) => flags.add(x));
    return { en, flags: [...flags] };
  }
  let out = "";
  for (const s of segments(src)) {
    if (s.lit !== undefined) { out += s.lit; continue; }
    const parts = [];
    for (const x of sentences(s.ar)) {
      /* « — » حد صلب: كل جزء يُترجم لحاله وترجع الشرطة بينهم */
      const dash = /\s*[—–]$/.test(x);
      const src = x.replace(/\s*[—–]$/, "");
      if (!src.trim()) { if (dash) parts.push("—"); continue; }
      let e = await translatePiece(src, mt, flags);
      if (parts.length && /—$/.test(parts[parts.length - 1]) && /^[A-Z][a-z]/.test(e)) e = e.charAt(0).toLowerCase() + e.slice(1);
      if (dash) e = e.replace(/[.。]+$/, "") + " —";
      parts.push(e);
    }
    let seg = parts.join(" ").trim();
    if (/proposed solution: $/.test(out) && seg) seg = seg.charAt(0).toLowerCase() + seg.slice(1);
    else if (seg) seg = seg.charAt(0).toUpperCase() + seg.slice(1);
    out += seg;
  }
  const en = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  validate(src, en, "text").forEach((x) => flags.add(x));
  return { en, flags: [...flags] };
}
