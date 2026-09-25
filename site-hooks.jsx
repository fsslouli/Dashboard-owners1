/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: site-hooks */
import { logEvent } from "./app-bootstrap.jsx";
import { TKEY } from "./site-data.jsx";
import { useEffect, useRef, useState } from "react";

/* ── تفضيلات الزائر (ثيم/لغة/شكل العرض) — محفوظة بـ localStorage الخاص
   بمتصفح الزائر نفسه (شخصية بحتة، غير مرتبطة بمشروع الملاك، فما داعي
   لقاعدة البيانات هنا). كل بيانات المشروع الفعلية (الاستفسارات وتقدّم
   التنفيذ) تُقرأ وتُكتب حصرًا عبر Supabase — راجع قسمي ٦ب و٣ أعلاه. */
function readPref(key, allowed, fallback) {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (v && (!allowed || allowed.includes(v))) return v;
  } catch { /* وضع التصفح الخاص أو منع الكوكيز — نرجع للافتراضي بهدوء */ }
  return fallback;
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* تجاهل */ }
}
/* ── ٨. الخطافات المخصّصة (Hooks) ── */
export function usePrefersReduced() {
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
export function useInView(threshold = 0.3) {
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
export function useBackClose(isOpen, onClose) {
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
export function useThemeMode() {
  /* يُقرأ المحفوظ فورًا عند أول رسم — وإلا "auto" ويتبع وضع جهاز الزائر مباشرة */
  const [mode, setMode] = useState(() => readPref(TKEY, ["auto", "light", "dark"], "auto"));
  const [sysDark, setSysDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSysDark(mq.matches);
    const h = (e) => setSysDark(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  const pick = (m) => { setMode(m); writePref(TKEY, m); };

  const resolved = mode === "auto" ? (sysDark ? "dark" : "light") : mode;
  return { mode, setMode: pick, resolved };
}

/* لغة العرض — تُحفظ للمستخدم نفسه فقط، افتراضيًا عربي */
const LKEY = "owners-inquiries-lang";
export function useLangMode() {
  const [lang, setLang] = useState(() => readPref(LKEY, ["ar", "en"], "ar"));
  /* وسم <html> بالـ index.html مثبَّت على العربية؛ نزامنه مع اختيار الزائر عشان
     قارئات الشاشة تنطق المحتوى بلغته الصحيحة، ويضبط اتجاه المتصفح نفسه */
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
    } catch { /* تجاهل */ }
  }, [lang]);
  const pick = (l) => { setLang(l); writePref(LKEY, l); };
  return { lang, setLang: pick };
}

/* ── شكل عرض النتائج: بطاقات أو جدول ──
   الافتراضي "تلقائي": بطاقات على الجوال، وجدول على الشاشات 1024px فأعلى.
   الزر متاح على كل الأجهزة — أول ضغطة تثبّت اختيار المستخدم ويتجاوز الافتراضي،
   فمن يبغى "وضع سطح المكتب" على جواله يقدر يختاره بنفسه. */
const VKEY = "owners-inquiries-view";
const WIDE_Q = "(min-width: 1024px)";
export function useViewMode() {
  const [pref, setPref] = useState(() => readPref(VKEY, ["auto", "cards", "table"], "auto"));
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

  /* التسجيل هنا فقط — عند ضغط المستخدم على الزر، وليس عند تغيّر حجم الشاشة */
  const pick = (v) => {
    setPref(v);
    logEvent("filter", "view", v, null);
    writePref(VKEY, v);
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
export function useDesktopView() {
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
