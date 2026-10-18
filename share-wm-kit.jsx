/* share-wm-kit.jsx — العلامة المائية القابلة للضبط لكل رابط مشاركة (6.3.0)
   الإعدادات تُحفظ داخل عمود scope (jsonb) بالمفتاح "wm" — بدون أي هجرة على قاعدة البيانات،
   وتصل لصفحة المستلم مع scope كما هي. الروابط القديمة بلا wm تبقى بسلوكها السابق حرفيًا.
   مبني ليقبل الإضافات: حقل جديد = سطر بـ WM_DEFAULTS + سطر بـ sanitizeWm + عنصر تحكم بـ WmControls. */
import { useMemo } from "react";

export const WM_DEFAULTS = {
  opacity: 10,   // درجة السواد % (الافتراضي = السلوك القديم)
  size: 13,      // حجم الخط
  angle: -24,    // الميلان بالدرجات
  gap: 40,       // التباعد بين التكرارات
  color: "#7A8A94",
  name: true,    // إظهار اسم المستلم
  who: "",       // اسم مخصص على العلامة؛ فارغ = يُستعمل اسم الرابط عند الإنشاء
  sid: true,     // معرّف الجلسة
  time: true,    // التاريخ والوقت
  custom: "",    // نص إضافي
};

export const WM_COLORS = [
  { v: "#7A8A94", l: "رمادي" },
  { v: "#000000", l: "أسود" },
  { v: "#B8860B", l: "ذهبي" },
  { v: "#C0392B", l: "أحمر" },
];

export const WM_PRESETS = [
  { l: "خفيفة (الحالية)", p: { opacity: 10, size: 13, angle: -24, gap: 40, color: "#7A8A94" } },
  { l: "واضحة", p: { opacity: 22, size: 18, angle: -24, gap: 30, color: "#000000" } },
  { l: "قوية", p: { opacity: 40, size: 26, angle: -30, gap: 10, color: "#000000" } },
];

const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
const HEX = /^#[0-9A-Fa-f]{6}$/;

/* تنظيف أي إعدادات قادمة من القاعدة أو النموذج — لا نثق بالقيم أبدًا */
export function sanitizeWm(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    opacity: clamp(r.opacity, 3, 60, WM_DEFAULTS.opacity),
    size: clamp(r.size, 10, 48, WM_DEFAULTS.size),
    angle: clamp(r.angle, -60, 60, WM_DEFAULTS.angle),
    gap: clamp(r.gap, 0, 200, WM_DEFAULTS.gap),
    color: HEX.test(r.color || "") ? r.color : WM_DEFAULTS.color,
    name: r.name !== false,
    who: String(r.who || "").trim().slice(0, 22),
    sid: r.sid !== false,
    time: r.time !== false,
    custom: String(r.custom || "").trim().slice(0, 40),
  };
}

const pad = (n) => (n < 10 ? "0" + n : "" + n);
export const wmStamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* النص النهائي للعلامة: الأجزاء المفعّلة مفصولة بنقطة وسطية. name هنا النص الفعلي للاسم (أو فارغ) */
export function wmText(wm, { name, sid, minute }) {
  const parts = [];
  if (wm.name && name) parts.push(String(name).trim().slice(0, 22));
  if (wm.sid) parts.push(String(sid || "").slice(-6) || "------");
  if (wm.time) parts.push(minute || wmStamp());
  if (wm.custom) parts.push(wm.custom);
  return parts.join(" · ");
}

/* خلفية CSS (بلاط SVG مائل) — حجم البلاطة يُحسب من النص والزاوية حتى لا ينقص الحرف عند الحواف */
export function wmBackground(wm, text) {
  if (!text) return "none";
  const s = wm.size, tw = Math.max(40, text.length * s * 0.55), r = (Math.abs(wm.angle) * Math.PI) / 180;
  const w = Math.round(tw * Math.cos(r) + s * 2 + wm.gap), h = Math.round(tw * Math.sin(r) + s * 2 + wm.gap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="${w / 2}" y="${h / 2 + s / 3}" font-family="system-ui,sans-serif" font-size="${s}" font-weight="600" fill="${wm.color}" text-anchor="middle" transform="rotate(${wm.angle} ${w / 2} ${h / 2})">${esc(text)}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/* طبقة العلامة نفسها — تُستعمل في صفحة المستلم وفي المعاينة */
export function WmLayer({ wm, name, sid, minute, fixed }) {
  const bg = useMemo(() => wmBackground(wm, wmText(wm, { name, sid, minute })), [wm, name, sid, minute]);
  return <div aria-hidden="true" style={{ position: fixed ? "fixed" : "absolute", inset: 0, zIndex: fixed ? 2147483000 : 2, pointerEvents: "none", opacity: wm.opacity / 100, backgroundImage: bg }} />;
}

/* لوحة التحكم بالنموذج (إدارة) + معاينة حيّة */
export function WmControls({ T, value, onChange, name }) {
  const wm = sanitizeWm(value);
  const set = (p) => onChange({ ...value, ...p });
  const lab = { fontSize: 11.5, color: T.muted, display: "flex", justifyContent: "space-between", marginBottom: 4 };
  const slider = (key, title, min, max, unit = "") => (
    <div style={{ marginBottom: 10 }}>
      <label style={lab}><span>{title}</span><span style={{ color: T.paper }}>{wm[key]}{unit}</span></label>
      <input type="range" min={min} max={max} step={1} value={wm[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} style={{ width: "100%" }} />
    </div>
  );
  const part = (key, text) => (
    <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.paper, cursor: "pointer" }}>
      <input type="checkbox" checked={!!wm[key]} onChange={(e) => set({ [key]: e.target.checked })} /> {text}
    </label>
  );
  const btn = (on) => ({ border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "14" : "none", color: T.paper, borderRadius: 9, padding: "6px 11px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" });
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 13px", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>العلامة المائية في صفحة المستلم</div>
      <div style={{ position: "relative", overflow: "hidden", height: 150, borderRadius: 10, background: T.sunken, marginBottom: 12, padding: "11px 13px", fontSize: 12.5, lineHeight: 1.9, color: T.paper }}>
        <div style={{ color: T.muted, fontSize: 11.5 }}>معاينة — استفسار رقم 41 · عالية جدًا</div>
        تسرب مياه من سقف الدور الأول عند الحمام الرئيسي، والمطلوب معالجة العزل قبل التشطيب.
        <WmLayer wm={wm} name={wm.who || name || "اسم المستلم"} sid="A3F9K2" />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {WM_PRESETS.map((p) => <button key={p.l} type="button" onClick={() => set(p.p)} style={btn(false)}>{p.l}</button>)}
      </div>
      {slider("opacity", "درجة السواد", 3, 60, "%")}
      {slider("size", "حجم الخط", 10, 48)}
      {slider("angle", "زاوية الميلان", -60, 60, "°")}
      {slider("gap", "التباعد (كثافة التكرار)", 0, 200)}
      <div style={{ ...lab, justifyContent: "flex-start", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <span>اللون</span>
        {WM_COLORS.map((c) => (
          <button key={c.v} type="button" aria-label={c.l} title={c.l} onClick={() => set({ color: c.v })}
            style={{ width: 30, height: 26, borderRadius: 8, background: c.v, cursor: "pointer", border: wm.color === c.v ? `2.5px solid ${T.paper}` : `1px solid ${T.line}` }} />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>ماذا تكتب العلامة</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        {part("name", "الاسم")}{part("sid", "معرّف الجلسة")}{part("time", "التاريخ والوقت")}
      </div>
      {wm.name && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 4 }}>الاسم الظاهر على العلامة (اتركه فارغًا ليكون اسم الرابط)</label>
          <input value={wm.who} onChange={(e) => set({ who: e.target.value })} maxLength={22} placeholder={name || "اسم الرابط"}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken, color: T.paper, fontFamily: "inherit", outline: "none" }} />
        </div>
      )}
      <input value={wm.custom} onChange={(e) => set({ custom: e.target.value })} maxLength={40} placeholder="نص إضافي (اختياري) مثل: ألبورادا — سري"
        style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken, color: T.paper, fontFamily: "inherit", outline: "none" }} />
      <div style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.8 }}>
        الاسم والمعرّف والوقت هي اللي تكشف مصدر أي لقطة شاشة. لو شلتها كلها وما كتبت نصًا تختفي العلامة تمامًا.
      </div>
    </div>
  );
}
