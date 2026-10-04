/* site-analytics.js — تتبع شامل لاستخدام الموقع العام (5.0.0)
   يلتقط: جلسة كاملة (جهاز/متصفح/دولة تقريبية/لغة/مصدر الزيارة)، كل ضغطة (نوع العنصر + نصه + القسم الحالي)،
   كل الأحداث الدلالية القديمة (logEvent) تلقائيًا، البحث، تغيّر اللغة والمظهر، عمق التمرير، مدة النشاط الفعلية،
   الأخطاء البرمجية، الإخفاء/الإظهار/الإغلاق.
   الخصوصية: معرّف مجهول عشوائي بالمتصفح (لتمييز العائد) بدون كوكيز ولا IP؛ لا يُسجَّل أي نص يكتبه الزائر عدا عبارة البحث؛
   يتوقف تلقائيًا مع إشارة Do-Not-Track، ومع متصفح عليه جلسة إدارة (حتى لا تلوّث تصفحك الشخصي الإحصاءات). */
import { SUPABASE_ANON_KEY, SUPABASE_URL, siteHook } from "./app-bootstrap.jsx";

const EP = `${SUPABASE_URL}/functions/v1/site-track`;
const VKEY = "ab_vid";
const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

let started = false; let sid = null; let queue = []; let tab = ""; let theme = "";
let activeMs = 0; let visSince = 0; let maxScroll = 0; let errCount = 0; let flushing = false; let lastKey = ""; let lastAt = 0;

function visitorId() {
  try {
    let v = localStorage.getItem(VKEY);
    if (!v || !/^[0-9a-f]{16,32}$/.test(v)) {
      const b = new Uint8Array(12); crypto.getRandomValues(b);
      v = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(VKEY, v);
    }
    return v;
  } catch { return null; }
}
function isAdminBrowser() {
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ""; if (/^sb-.*-auth-token$/.test(k)) return true; } } catch { /* */ }
  return false;
}
const post = (body, keepalive) => fetch(EP, {
  method: "POST", keepalive: !!keepalive,
  headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  body: JSON.stringify(body),
}).then((r) => r.json()).catch(() => null);

const curActive = () => activeMs + (visSince ? Date.now() - visSince : 0);

export function siteTrack(type, o = {}) {
  if (!started) return;
  queue.push({ t: Date.now(), type, category: clip(o.category, 80), value: clip(o.value, 120), extra: clip(o.extra, 160), tab: o.tab ?? tab, target: clip(o.target, 30), label: clip(o.label, 100) });
  if (queue.length >= 25) flush(false);
}
export function siteSetTab(t) { tab = t || ""; }
export function siteSetTheme(t) { theme = t || ""; }

async function flush(ka) {
  if (!sid || flushing || (!queue.length && !ka)) return;
  const events = queue; queue = []; flushing = true;
  const r = await post({ action: "track", sid, events, active_ms: Math.round(curActive()), scroll: maxScroll, theme }, ka);
  flushing = false;
  if (!r || r.ok === false) { if (r && r.expired) { sid = null; } else queue = events.concat(queue).slice(-150); }
}

function describe(el) {
  const hit = el.closest?.("button,a,[role=button],[role=tab],summary,input,select,textarea,label,img,video,iframe,[data-track]") || el;
  const tag = (hit.tagName || "el").toLowerCase();
  let label = hit.getAttribute?.("aria-label") || hit.getAttribute?.("data-track") || hit.getAttribute?.("title") || hit.getAttribute?.("alt") || "";
  if (!label) label = (tag === "input" || tag === "select" || tag === "textarea") ? (hit.getAttribute?.("name") || hit.getAttribute?.("placeholder") || hit.type || "") : (hit.innerText || hit.textContent || "");
  return { hit, tag, label };
}
function onClick(e) {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;
  const { hit, tag, label } = describe(el);
  const key = `${tag}|${label}`; const now = Date.now();
  if (key === lastKey && now - lastAt < 250) return;
  lastKey = key; lastAt = now;
  if (tag === "a" && hit.href) {
    let host = ""; try { host = new URL(hit.href, location.href).host; } catch { /* */ }
    const isFile = /\.(pdf|dwg|dxf|xlsx?|docx?|zip|png|jpe?g|mp4)(\?|$)/i.test(hit.href) || hit.hasAttribute("download");
    siteTrack(isFile ? "download" : "link", { target: tag, label, value: host, extra: clip((hit.href || "").split("?")[0].split("/").pop(), 80) });
    return;
  }
  siteTrack("click", { target: tag, label });
}
function onScroll() {
  const d = document.documentElement; const h = d.scrollHeight - window.innerHeight;
  if (h > 0) maxScroll = Math.max(maxScroll, Math.min(100, Math.round((window.scrollY / h) * 100)));
}
function onVis() {
  if (document.visibilityState === "hidden") { if (visSince) { activeMs += Date.now() - visSince; visSince = 0; } siteTrack("hide"); flush(true); }
  else { visSince = Date.now(); siteTrack("show"); }
}
function onHide() { if (visSince) { activeMs += Date.now() - visSince; visSince = 0; } siteTrack("end"); flush(true); }
function onError(ev) {
  if (errCount >= 5) return; errCount++;
  siteTrack("error", { value: clip(ev?.message || ev?.reason?.message || ev?.reason || "error", 120), extra: clip(ev?.filename ? `${ev.filename}:${ev.lineno}` : "", 120) });
}

export async function startSiteAnalytics(initialTheme = "") {
  if (started || typeof window === "undefined") return;
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;
  if (isAdminBrowser()) return;
  theme = initialTheme; started = true;
  siteHook.fn = (type, category, value, extra) => { if (type !== "click") siteTrack(type, { category, value, extra }); };
  let ref = ""; try { const h = document.referrer ? new URL(document.referrer).host : ""; ref = h && h !== location.host ? h : ""; } catch { /* */ }
  const r = await post({ action: "start", vid: visitorId(), client: { lang: navigator.language || "", screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`, tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })(), ref, theme } });
  if (!r || !r.ok || !r.sid) { started = false; siteHook.fn = null; queue = []; return; }
  sid = r.sid;
  visSince = document.visibilityState === "visible" ? Date.now() : 0;
  document.addEventListener("click", onClick, true);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onError);
  setInterval(() => flush(false), 6000);
  flush(false);
}
