/* share-kit.jsx — روابط المشاركة الخاصة 4.0 (أدوات مشتركة بين الإدارة وصفحة المستلم)
   الطبقات:
   ١) الرمز ١٢٨ بت عشوائي (٢٢ حرفًا فقط) ويوضع بعد # فلا يصل لسجلات الخادم ولا لرأس Referer.
   ٢) القاعدة ما تحفظ الرمز ولا بصمته المباشرة، بل مفتاح بحث مشتق بـ HKDF-SHA256 بنطاق مخصص.
   ٣) PIN اختياري يُخزَّن بـ PBKDF2 (١٥٠ ألف دورة) مع ملح، وقفل بعد ٥ أخطاء وإلغاء تلقائي بعد ١٥.
   ٤) جلسة موقّعة HMAC تُفحص كل ٤٥ ثانية، والتتبع يمرّ بنفس الجلسة.
   التحقق والعدّ والتتبع بدالة Supabase Edge اسمها share-view (راجع supabase/functions/share-view). */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./app-bootstrap.jsx";

/* دومين المشاركة المنفصل (اختياري لكن موصى به): متغير بيئة Vercel باسم VITE_SHARE_HOST
   مثل: owners-share.vercel.app — بدون https:// */
export const SHARE_HOST = String((typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SHARE_HOST) || "").trim().toLowerCase();
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
export const PIN_ITER = 150000;

export const onShareHost = () => !!SHARE_HOST && typeof window !== "undefined" && window.location.hostname.toLowerCase() === SHARE_HOST;
export const shareTokenFromHash = () => {
  const m = /^#\/s\/([A-Za-z0-9_-]{22})$/.exec(typeof window === "undefined" ? "" : window.location.hash);
  return m ? m[1] : null;
};
export const buildShareUrl = (token) => `${SHARE_HOST ? `https://${SHARE_HOST}` : window.location.origin}/#/s/${token}`;

const toHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));

/* رمز جديد: ١٦ بايت عشوائية بصيغة base64url (٢٢ حرفًا) */
export function makeToken() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = ""; b.forEach((x) => { s += String.fromCharCode(x); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* مفتاح البحث: HKDF-SHA256(token) بنطاق alborada/share/lookup/v4 — نفس الحساب بالخادم */
export async function lookupKey(token) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(token), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: enc.encode("alborada-share-v4"), info: enc.encode("alborada/share/lookup/v4") }, k, 256);
  return toHex(bits);
}
export const makeSalt = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); return toHex(b); };
export async function pinHash(pin, saltHex) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: PIN_ITER }, k, 256);
  return toHex(bits);
}

/* اتصال بالدالة — ما ترجع أي بيانات للموقع، فقط حالة الرابط ونطاق ما يُعرض */
export async function callShare(action, body, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/share-view`, {
    method: "POST",
    keepalive: !!opts.keepalive,
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action, ...body }),
  });
  let j = null; try { j = await r.json(); } catch { /* */ }
  if (!j || typeof j.state !== "string") throw new Error("share-view: bad response");
  return j;
}
export const isValidToken = (t) => TOKEN_RE.test(t || "");

/* ───────── التتبع (صفحة المستلم فقط) ─────────
   يلتقط: كل ضغطة (نوع العنصر + نصّه المقتطع + القسم الحالي)، تغيّر القسم، الروابط الخارجية،
   التحميلات، الإخفاء/الإظهار، ومدة النشاط الفعلية. لا يسجّل أي نص يكتبه الزائر ولا مواضع المؤشر.
   الإرسال دفعات كل ٨ ثوانٍ وعند إغلاق الصفحة. */
const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
export function createTracker(getSid) {
  let q = []; let tab = ""; let timer = null; let visSince = document.visibilityState === "visible" ? Date.now() : 0; let active = 0; let lastKey = ""; let lastAt = 0; let stopped = false;
  const curActive = () => active + (visSince ? Date.now() - visSince : 0);
  const push = (type, o = {}) => {
    if (stopped) return;
    q.push({ t: Date.now(), type, tab: o.tab ?? tab, target: clip(o.target, 30), label: clip(o.label, 100), meta: o.meta || null });
    if (q.length >= 30) flush(false);
  };
  const flush = async (ka) => {
    const sid = getSid();
    if (!sid || (!q.length && !ka)) return;
    const events = q; q = [];
    try { await callShare("track", { sid, events, active_ms: Math.round(curActive()) }, { keepalive: !!ka }); }
    catch { q = events.concat(q).slice(-200); }
  };
  const describe = (el) => {
    const hit = el.closest?.("button,a,[role=button],[role=tab],summary,input,select,label,img,video,iframe,[data-track]") || el;
    const tag = (hit.tagName || "el").toLowerCase();
    const label = hit.getAttribute?.("aria-label") || hit.getAttribute?.("data-track") || hit.getAttribute?.("title") || hit.getAttribute?.("alt") || (tag === "input" || tag === "select" ? hit.getAttribute?.("name") || hit.type : hit.innerText || hit.textContent) || "";
    return { hit, tag, label };
  };
  const onClick = (e) => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return;
    const { hit, tag, label } = describe(el);
    const key = `${tag}|${label}`; const now = Date.now();
    if (key === lastKey && now - lastAt < 250) return;
    lastKey = key; lastAt = now;
    if (tag === "a" && hit.href) {
      let host = ""; try { host = new URL(hit.href, location.href).host; } catch { /* */ }
      const isFile = /\.(pdf|dwg|dxf|xlsx?|docx?|zip|png|jpe?g)(\?|$)/i.test(hit.href) || hit.hasAttribute("download");
      push(isFile ? "download" : "link", { target: tag, label, meta: { host, file: isFile ? clip(hit.href.split("?")[0].split("/").pop(), 80) : undefined } });
      return;
    }
    push("click", { target: tag, label });
  };
  const onVis = () => {
    if (document.visibilityState === "hidden") { if (visSince) { active += Date.now() - visSince; visSince = 0; } push("hide"); flush(true); }
    else { visSince = Date.now(); push("show"); }
  };
  const onHide = () => { if (visSince) { active += Date.now() - visSince; visSince = 0; } push("end"); flush(true); };
  document.addEventListener("click", onClick, true);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", onHide);
  timer = setInterval(() => flush(false), 8000);
  return {
    setTab: (t) => { if (t && t !== tab) { tab = t; push("tab", { tab: t, label: t }); } },
    flush: () => flush(false),
    stop: () => { stopped = true; clearInterval(timer); document.removeEventListener("click", onClick, true); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onHide); },
  };
}

/* الأقسام القابلة للتحديد — نفس مفاتيح تبويبات الموقع العام */
export const SHARE_TABS = [
  { key: "overview", label: "نظرة عامة (المؤشرات والرسوم)" },
  { key: "notes", label: "الاستفسارات والمرفقات" },
  { key: "progress", label: "تقدّم التنفيذ" },
  { key: "docs", label: "المخططات والمستندات" },
  { key: "gallery", label: "الصور والمقاطع" },
];

/* رسائل الحالات — صياغة رسمية بدون كشف تفاصيل داخلية */
export const SHARE_MESSAGES = {
  expired: { t: "انتهت صلاحية هذا الرابط", d: "هذا الرابط أُنشئ من صاحب الموقع لمشاركة محدودة المدة، وقد انتهت مدته. للحصول على رابط جديد تواصل مع الشخص الذي أرسله لك." },
  revoked: { t: "تم إلغاء هذا الرابط", d: "هذا الرابط أُنشئ من صاحب الموقع، وقد أُلغي ولم يعد متاحًا. للاستفسار تواصل مع الشخص الذي أرسله لك." },
  exhausted: { t: "اكتمل استخدام هذا الرابط", d: "هذا الرابط أُنشئ من صاحب الموقع لعدد محدود من مرات الفتح، وقد اكتملت. للحصول على رابط جديد تواصل مع الشخص الذي أرسله لك." },
  session_ended: { t: "انتهت جلسة العرض", d: "انتهت المدة المخصصة لهذا العرض. الرابط مخصص لفتح محدود ولا يمكن إعادة فتحه. للحصول على رابط جديد تواصل مع الشخص الذي أرسله لك." },
  locked: { t: "الرابط مقفل مؤقتًا", d: "تكررت محاولات إدخال رمز الدخول بشكل خاطئ، فقُفل الرابط لفترة قصيرة حفاظًا على الخصوصية. حاول لاحقًا أو تواصل مع الشخص الذي أرسله لك." },
  unknown: { t: "رابط غير صالح", d: "هذا الرابط غير صحيح أو غير مكتمل. تأكد من نسخه كاملًا كما وصلك، أو تواصل مع الشخص الذي أرسله لك." },
  none: { t: "صفحة مشاركة خاصة", d: "هذه الصفحة تُفتح فقط عبر رابط مشاركة خاص. إن وصلك رابط فافتحه كما هو." },
  error: { t: "تعذّر التحقق من الرابط", d: "حدثت مشكلة في الاتصال. تأكد من الإنترنت ثم أعد المحاولة." },
};
