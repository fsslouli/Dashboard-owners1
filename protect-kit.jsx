/* ═══════════════════════════════════════════════════════════
   protect-kit.jsx (7.5.0) — حماية المحتوى من النسخ ولقطات الشاشة.
   مهم: المتصفح لا يستطيع منع لقطة الشاشة نفسها (خصوصًا على الجوال) — هذه الطبقة تصعّب النسخ وتجعل أي لقطة قابلة للتتبّع:
   • copy  : قفل تحديد النص والنسخ والقائمة اليمنى والسحب والطباعة والحفظ.
   • blur  : تغبيش المحتوى عند فقدان التركيز أو مفاتيح لقطة الشاشة (ينفع على الكمبيوتر أساسًا).
   • guest : علامة مائية ظاهرة للزائر بلا دخول فيها رمز جهازه والتاريخ.
   • stamp : «الختم الخفي» — نفس الهوية (رقم الفيلا أو رمز الزائر + التاريخ) بنقش خافت جدًا (≈3.5%) فوق الصفحة كلها؛
             يُكشف من لوحة الإدارة («كاشف الختم») برفع اللقطة المسرّبة.
   الإعداد: site_settings.protect (jsonb) — كله مقفول افتراضيًا ويُفعَّل من «دخول الملاك» بلوحة الإدارة. الإدارة مستثناة.
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";

export const PROTECT_DEFAULTS = { copy: false, blur: false, guest: false, stamp: false };
export function sanitizeProtect(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return { copy: !!r.copy, blur: !!r.blur, guest: !!r.guest, stamp: !!r.stamp };
}
export const protectOn = (p) => !!p && (p.copy || p.blur || p.guest || p.stamp);

/* رمز ثابت لهذا الجهاز (زائر بلا دخول) — 5 خانات بلا أحرف ملتبسة */
const CODE_KEY = "pv_code_v1";
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function deviceCode() {
  try {
    let c = localStorage.getItem(CODE_KEY);
    if (!c || !/^[A-Z2-9]{5}$/.test(c)) {
      const a = new Uint8Array(5); crypto.getRandomValues(a);
      c = Array.from(a, (x) => ALPHA[x % ALPHA.length]).join("");
      localStorage.setItem(CODE_KEY, c);
    }
    return c;
  } catch { return "-----"; }
}
const pad = (n) => String(n).padStart(2, "0");
const dayStamp = () => { const d = new Date(); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${String(d.getFullYear()).slice(2)}`; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function tile(text, { size, angle, color, gap }) {
  const tw = Math.max(40, text.length * size * 0.62), r = (Math.abs(angle) * Math.PI) / 180;
  const w = Math.round(tw * Math.cos(r) + size * 2 + gap), h = Math.round(tw * Math.sin(r) + size * 2 + gap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="${w / 2}" y="${h / 2 + size / 3}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="800" fill="${color}" text-anchor="middle" transform="rotate(${angle} ${w / 2} ${h / 2})">${esc(text)}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const COPY_CSS = `
html.pv-copy .dash, html.pv-copy .dash *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}
html.pv-copy .dash input, html.pv-copy .dash textarea, html.pv-copy .dash [contenteditable="true"]{-webkit-user-select:text!important;user-select:text!important}
html.pv-copy .dash img{-webkit-user-drag:none;pointer-events:none}
@media print{html.pv-copy body > *{display:none!important}html.pv-copy body::after{content:"الطباعة غير متاحة — المحتوى محمي";display:block;padding:40px;font:700 18px system-ui;text-align:center}}
html.pv-blur #root{filter:blur(22px) saturate(.6)!important;transition:none!important}
`;

/* who: { kind: "villa" | "guest", villa } */
export function ProtectLayer({ cfg, who }) {
  const p = useMemo(() => sanitizeProtect(cfg), [cfg]);
  const [day, setDay] = useState(dayStamp);
  const blurT = useRef(0);
  useEffect(() => { const t = setInterval(() => setDay(dayStamp()), 600000); return () => clearInterval(t); }, []);

  /* قفل النسخ */
  useEffect(() => {
    if (!p.copy) return undefined;
    const h = document.documentElement; h.classList.add("pv-copy");
    const editable = (t) => !!(t && t.closest && t.closest('input,textarea,[contenteditable="true"]'));
    const stop = (e) => { if (!editable(e.target)) e.preventDefault(); };
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "s", "p", "u"].includes(k) && !editable(e.target)) e.preventDefault();
    };
    const evs = ["copy", "cut", "contextmenu", "dragstart", "selectstart"];
    evs.forEach((n) => document.addEventListener(n, stop, true));
    document.addEventListener("keydown", onKey, true);
    return () => { h.classList.remove("pv-copy"); evs.forEach((n) => document.removeEventListener(n, stop, true)); document.removeEventListener("keydown", onKey, true); };
  }, [p.copy]);

  /* التغبيش عند فقدان التركيز / مفاتيح اللقطة */
  useEffect(() => {
    if (!p.blur) return undefined;
    const h = document.documentElement;
    const on = () => { clearTimeout(blurT.current); h.classList.add("pv-blur"); };
    const off = () => { clearTimeout(blurT.current); blurT.current = setTimeout(() => h.classList.remove("pv-blur"), 250); };
    const onVis = () => (document.visibilityState === "hidden" ? on() : off());
    const onKey = (e) => {
      const shot = e.key === "PrintScreen" || (e.metaKey && e.shiftKey && ["3", "4", "5", "s"].includes((e.key || "").toLowerCase()));
      if (shot) { on(); blurT.current = setTimeout(() => h.classList.remove("pv-blur"), 1800); try { navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(""); } catch { /* */ } }
    };
    window.addEventListener("blur", on); window.addEventListener("focus", off);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onKey, true); window.addEventListener("keyup", onKey, true);
    return () => {
      clearTimeout(blurT.current); h.classList.remove("pv-blur");
      window.removeEventListener("blur", on); window.removeEventListener("focus", off);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onKey, true);
    };
  }, [p.blur]);

  const isVilla = who && who.kind === "villa";
  const id = isVilla ? `V${who.villa}` : `G-${deviceCode()}`;
  const stampBg = useMemo(() => (p.stamp ? tile(`${id} · ${day}`, { size: 16, angle: -12, color: "#808080", gap: 10 }) : null), [p.stamp, id, day]);
  const guestBg = useMemo(() => (p.guest && !isVilla ? tile(`زائر · ${deviceCode()} · ${day}`, { size: 15, angle: -24, color: "#808080", gap: 90 }) : null), [p.guest, isVilla, day]);
  const base = { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2147482990 };
  return (
    <>
      {(p.copy || p.blur) && <style>{COPY_CSS}</style>}
      {guestBg && <div aria-hidden="true" style={{ ...base, opacity: 0.16, backgroundImage: guestBg }} />}
      {stampBg && <div aria-hidden="true" style={{ ...base, opacity: 0.035, backgroundImage: stampBg }} />}
    </>
  );
}

/* ── كاشف الختم (للإدارة): يرفع لقطة ويُظهر النقش الخفي بتكبير الفروق الدقيقة ── */
export function revealStamp(img, gain = 55) {
  const scale = Math.min(1, 1800 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale)), h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const mk = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const a = mk(), b = mk(), out = mk();
  const ca = a.getContext("2d"), cb = b.getContext("2d"), co = out.getContext("2d");
  ca.drawImage(img, 0, 0, w, h);
  cb.filter = `blur(${Math.max(2, Math.round(w / 260))}px)`; cb.drawImage(a, 0, 0);
  const A = ca.getImageData(0, 0, w, h), B = cb.getImageData(0, 0, w, h), O = co.createImageData(w, h);
  for (let i = 0; i < A.data.length; i += 4) {
    const ga = A.data[i] * 0.299 + A.data[i + 1] * 0.587 + A.data[i + 2] * 0.114;
    const gb = B.data[i] * 0.299 + B.data[i + 1] * 0.587 + B.data[i + 2] * 0.114;
    const d = Math.abs(ga - gb);
    /* الفروق الكبيرة = محتوى الصفحة نفسه (نص وحدود) فنطفيها؛ الفروق الدقيقة = الختم فنكبّرها */
    const v = d > 9 ? 0 : Math.min(255, d * gain);
    O.data[i] = O.data[i + 1] = O.data[i + 2] = v; O.data[i + 3] = 255;
  }
  co.putImageData(O, 0, 0);
  return out;
}

export function StampReveal({ S }) {
  const [url, setUrl] = useState("");
  const [gain, setGain] = useState(55);
  const imgRef = useRef(null);
  const boxRef = useRef(null);
  const draw = (g) => {
    const img = imgRef.current, box = boxRef.current;
    if (!img || !box || !img.complete || !img.naturalWidth) return;
    const c = revealStamp(img, g); c.style.maxWidth = "100%"; c.style.borderRadius = "10px";
    box.innerHTML = ""; box.appendChild(c);
  };
  const pick = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; if (url) URL.revokeObjectURL(url); setUrl(URL.createObjectURL(f)); };
  return (
    <div>
      <p style={S.hint}>ارفع لقطة الشاشة المشكوك فيها: يطلع لك النقش الخفي (مثل <b dir="ltr">V120 · 13-11-26</b> = فيلا 120 بتاريخه، أو <b dir="ltr">G-XXXXX</b> = رمز جهاز زائر). الصورة تُعالج على جهازك ولا تُرفع لأي مكان.</p>
      <input type="file" accept="image/*" onChange={pick} style={{ fontSize: 13, marginBottom: 10 }} />
      {url && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 8 }}>قوة الكشف
            <input type="range" min="10" max="120" value={gain} onChange={(e) => { const g = Number(e.target.value); setGain(g); draw(g); }} style={{ flex: 1 }} />
          </label>
          <img ref={imgRef} src={url} alt="" onLoad={() => draw(gain)} style={{ display: "none" }} />
          <div ref={boxRef} style={{ overflow: "auto", maxHeight: 520, border: "1px solid #E1E8EC", borderRadius: 10, background: "#000" }} />
        </>
      )}
    </div>
  );
}
