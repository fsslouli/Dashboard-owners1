/* ═══════════════════════════════════════════════════════════
   youtube-kit.js — كل ما يخص مقاطع يوتيوب، بلا React.

   المبدأ: قبل ما يضغط الزائر «تشغيل» ما يُحمَّل من يوتيوب إلا صورة واحدة.
   مشغّل يوتيوب الرسمي (IFrame API) يُحمَّل عند أول تشغيل فقط، ويُستخدم لأنه
   الطريقة الوحيدة اللي تشغّل المقطع بضغطة وحدة على سفاري والجوال — الـ iframe
   العادي يحتاج هناك ضغطتين.

   متطلبات يوتيوب المطبّقة هنا (developers.google.com/youtube/terms/required-minimum-functionality):
   • هوية الموقع عبر Referer بسياسة strict-origin-when-cross-origin (غيابها = Error 153)
   • المشغّل لا يقل عن 200×200 بكسل، ولا يُغطّى بأي عنصر بعد التشغيل
   • نطاق youtube-nocookie.com (الوضع المحسّن للخصوصية)
   ═══════════════════════════════════════════════════════════ */

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_HOST_RE = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;
/* رموز اتجاه مخفية تلتصق بالروابط لما تُنسخ من واجهة عربية — تكسر القراءة بصمت */
const BIDI_RE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

export const isYouTubeId = (s) => typeof s === "string" && ID_RE.test(s);

/* "90" · "90s" · "1m30s" · "1h2m3s" · "1:30" · "01:02:03" ← ثوانٍ */
export function parseYtTime(v) {
  if (v == null) return 0;
  const s = String(v).trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+(\.\d+)?s?$/.test(s)) return Math.floor(parseFloat(s));
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) return s.split(":").reduce((a, p) => a * 60 + Number(p), 0);
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return 0;
}

/* يقرأ أي صيغة يلصقها المستخدم ويرجّع رقم المقطع:
   youtu.be/ID · watch?v=ID · shorts/ID · live/ID · embed/ID · youtube-nocookie ·
   m./music. · رابط داخل نص مشاركة · كود <iframe> كامل · رقم المقطع وحده.
   النتيجة: { ok:true, id, start, vertical, kind } أو { ok:false, reason } */
export function parseYouTube(input) {
  let raw = String(input == null ? "" : input).replace(BIDI_RE, "").trim();
  if (!raw) return { ok: false, reason: "empty" };

  if (/<iframe/i.test(raw)) {
    const m = raw.match(/src\s*=\s*["']([^"']+)["']/i);
    if (!m) return { ok: false, reason: "invalid" };
    raw = m[1].trim();
  }
  if (ID_RE.test(raw)) return { ok: true, id: raw, start: 0, vertical: false, kind: "video" };

  /* رابط وسط نص («شاهد هذا: https://youtu.be/…») — ناخذ أول رابط يوتيوب */
  if (/\s/.test(raw)) {
    const m = raw.match(/(?:https?:\/\/)?(?:[\w-]+\.)*(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/\S+/i);
    if (!m) return { ok: false, reason: "not_youtube" };
    raw = m[0];
  }
  if (raw.startsWith("//")) raw = "https:" + raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = "https://" + raw;

  let u;
  try { u = new URL(raw); } catch { return { ok: false, reason: "invalid" }; }
  if (!YT_HOST_RE.test(u.hostname)) return { ok: false, reason: "not_youtube" };

  const parts = u.pathname.split("/").filter(Boolean);
  const head = (parts[0] || "").toLowerCase();
  let id = null, kind = "video";

  if (/youtu\.be$/i.test(u.hostname)) id = parts[0] || null;
  else if (head === "watch" || head === "") id = u.searchParams.get("v");
  else if (head === "embed" || head === "v" || head === "e") id = parts[1] || null;
  else if (head === "shorts") { id = parts[1] || null; kind = "shorts"; }
  else if (head === "live") { id = parts[1] || null; kind = "live"; }
  else if (head === "attribution_link") {
    const inner = u.searchParams.get("u");
    return inner ? parseYouTube("https://www.youtube.com" + inner) : { ok: false, reason: "invalid" };
  }

  /* «videoseries» طوله ١١ حرفًا بالضبط — يطابق شكل رقم مقطع وهو رابط قائمة تشغيل */
  if (id === "videoseries") id = null;
  if (!id) {
    if (u.searchParams.get("list")) return { ok: false, reason: "playlist" };
    if (["channel", "c", "user"].includes(head) || head.startsWith("@")) return { ok: false, reason: "channel" };
    return { ok: false, reason: "invalid" };
  }
  if (!ID_RE.test(id)) return { ok: false, reason: "invalid" };

  const hashT = (u.hash.match(/[#&]t=([^&]+)/) || [])[1];
  const t = u.searchParams.get("t") ?? u.searchParams.get("start") ?? hashT;
  return { ok: true, id, start: parseYtTime(t), vertical: kind === "shorts", kind };
}

/* 225 ← "3:45" · 3725 ← "1:02:05" */
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`;
}

/* الصور المصغّرة. hqdefault متوفّرة دائمًا؛ الأعلى دقة قد لا توجد لبعض المقاطع —
   ويوتيوب وقتها ما يرجّع خطأ، يرجّع صورة رمادية 120×90 (لذا نفحص المقاس لا onerror) */
export const ytThumb = (id, q = "hqdefault") => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
export const ytThumbWebp = (id, q = "maxresdefault") => `https://i.ytimg.com/vi_webp/${id}/${q}.webp`;
export const isYtPlaceholder = (img) => !!img && img.naturalWidth <= 120 && img.naturalHeight <= 90;

/* أعلى دقة متوفّرة فعليًا لهذا المقطع (أو null) — تحميل بأولوية منخفضة */
export function bestYtPoster(id, cb) {
  let alive = true;
  const list = [ytThumbWebp(id, "maxresdefault"), ytThumb(id, "maxresdefault"), ytThumbWebp(id, "sddefault")];
  const next = (i) => {
    if (!alive || i >= list.length) { if (alive) cb(null); return; }
    const im = new window.Image();
    try { im.fetchPriority = "low"; } catch (_) {}
    im.onload = () => { if (!alive) return; if (isYtPlaceholder(im)) next(i + 1); else cb(list[i]); };
    im.onerror = () => next(i + 1);
    im.src = list[i];
  };
  next(0);
  return () => { alive = false; };
}

export const ytWatchUrl = (id, start) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${start ? `&t=${start}s` : ""}`;
export const ytShortUrl = (id, start) => `https://youtu.be/${encodeURIComponent(id)}${start ? `?t=${start}` : ""}`;

const YT_HOST = "https://www.youtube-nocookie.com";

function playerVars({ start, autoplay, lang }) {
  const v = { autoplay: autoplay ? 1 : 0, playsinline: 1, rel: 0, iv_load_policy: 3, enablejsapi: 1, hl: lang === "en" ? "en" : "ar" };
  if (start > 0) v.start = Math.floor(start);
  if (typeof window !== "undefined" && window.location && /^https?:/.test(window.location.origin)) v.origin = window.location.origin;
  return v;
}

/* رابط تضمين مباشر — خطة بديلة لو تعذّر تحميل مشغّل يوتيوب الرسمي */
export function ytEmbedUrl(id, opts = {}) {
  const p = new URLSearchParams(Object.entries(playerVars(opts)).map(([k, v]) => [k, String(v)]));
  return `${YT_HOST}/embed/${encodeURIComponent(id)}?${p}`;
}

/* iframe بديل بكل السمات المطلوبة (بما فيها سياسة الـ Referer) */
export function ytPlainIframe(id, opts = {}) {
  const f = document.createElement("iframe");
  f.src = ytEmbedUrl(id, opts);
  f.title = opts.title || "YouTube video";
  f.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
  f.setAttribute("allowfullscreen", "");
  f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  return f;
}

/* تحميل مشغّل يوتيوب الرسمي مرة وحدة لكل الصفحة — مع مهلة، عشان ما يعلّق الزائر
   لو كان محجوبًا بإضافة أو شبكة. */
let apiPromise = null;
export function loadYouTubeApi(timeoutMs = 9000) {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let done = false;
    const finish = (ok, v) => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (ok) resolve(v); else { apiPromise = null; reject(v); }
    };
    const timer = setTimeout(() => finish(false, new Error("yt-api-timeout")), timeoutMs);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      try { if (typeof prev === "function") prev(); } catch (_) {}
      if (window.YT && window.YT.Player) finish(true, window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => finish(false, new Error("yt-api-load"));
    document.head.appendChild(s);
  });
  return apiPromise;
}

/* ينشئ مشغّلًا داخل el (يُستبدل بـ iframe). يرجّع كائن YT.Player */
export function createYtPlayer(YT, el, { id, start = 0, autoplay = false, lang = "ar", title, onReady, onState, onError }) {
  return new YT.Player(el, {
    host: YT_HOST,
    videoId: id,
    width: "100%",
    height: "100%",
    playerVars: playerVars({ start, autoplay, lang }),
    events: {
      onReady: (e) => {
        try {
          const f = e.target.getIframe && e.target.getIframe();
          if (f && title) f.title = title;
        } catch (_) {}
        if (onReady) onReady(e);
      },
      onStateChange: (e) => { if (onState) onState(e); },
      onError: (e) => { if (onError) onError(e); },
    },
  });
}

/* تسخين الاتصالات لحظة اقتراب المؤشر/الإصبع من زر التشغيل — يوفّر جزءًا من الثانية */
let warmed = false;
export function warmYouTube() {
  if (warmed || typeof document === "undefined") return;
  warmed = true;
  [YT_HOST, "https://www.youtube.com", "https://www.google.com"].forEach((href) => {
    const l = document.createElement("link");
    l.rel = "preconnect"; l.href = href;
    document.head.appendChild(l);
  });
}

/* رموز أخطاء مشغّل يوتيوب ← شرح للإدارة */
export function ytErrorText(code) {
  switch (Number(code)) {
    case 2: return "رقم المقطع غير صالح.";
    case 5: return "تعذّر تشغيل المقطع في هذا المتصفح.";
    case 100: return "المقطع غير موجود، أو محذوف، أو «خاص» (Private). اجعله «عام» أو «غير مدرج».";
    case 101:
    case 150: return "صاحب المقطع منع عرضه خارج يوتيوب. فعّل «السماح بالتضمين» من YouTube Studio ← التفاصيل ← المزيد.";
    case 153: return "المتصفح ما أرسل هوية الموقع ليوتيوب (Error 153). جرّب متصفحًا آخر أو عطّل إضافات حجب التتبّع.";
    default: return `تعذّر تشغيل المقطع (رمز ${code}).`;
  }
}
