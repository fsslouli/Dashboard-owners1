/* ═══════════════════════════════════════════════════════════
   blocks-kit.jsx — كتل محتوى مخصّصة بأي تبويب (٦.٠.٠)
   تُخزَّن بـ site_settings.nav_labels._blocks = { <تبويب>: [ {id,type,...} ] } بدون هجرة.
   العرض خفيف للزوّار؛ المحرّر (BlocksEditor) يُحمَّل فقط داخل وضع التحرير.
   أمان: لا HTML خام أبدًا — نص عادي فقط، وروابط/صور https (أو mailto/tel/#/مسار نسبي) فقط.
   ═══════════════════════════════════════════════════════════ */
import React, { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Pencil, Check, X, Type, Heading, Image as Img, MousePointerClick, Youtube, Minus, MessageSquare, Eye, EyeOff } from "lucide-react";
import { parseYouTube, ytEmbedUrl } from "./youtube-kit.js";

export const BLOCKS_KEY = "_blocks";
export const MAX_BLOCKS_PER_TAB = 40;
export const BLOCK_TYPES = [
  { type: "heading", label: "عنوان", icon: Heading },
  { type: "text", label: "نص", icon: Type },
  { type: "callout", label: "تنبيه/مربع مميز", icon: MessageSquare },
  { type: "image", label: "صورة", icon: Img },
  { type: "button", label: "زر/رابط", icon: MousePointerClick },
  { type: "video", label: "فيديو يوتيوب", icon: Youtube },
  { type: "divider", label: "فاصل", icon: Minus },
];

const safeUrl = (u) => {
  const s = String(u || "").trim();
  if (/^https:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s) || s.startsWith("#") || (s.startsWith("/") && !s.startsWith("//"))) return s;
  return "";
};
const pick = (b, f, lang) => (lang === "en" ? (b[f + "_en"] || b[f]) : (b[f] || b[f + "_en"])) || "";

export const blocksOf = (navLabels, tab) => {
  const a = navLabels && navLabels[BLOCKS_KEY] && navLabels[BLOCKS_KEY][tab];
  return Array.isArray(a) ? a : [];
};

function Block({ b, lang, T }) {
  const t = pick(b, "text", lang);
  const align = b.align === "center" ? "center" : "start";
  if (b.type === "heading") return <h3 style={{ fontSize: 19, fontWeight: 700, margin: "6px 0", textAlign: align }}>{t}</h3>;
  if (b.type === "text") return <p style={{ fontSize: 14.5, lineHeight: 1.9, margin: "4px 0", whiteSpace: "pre-wrap", textAlign: align }}>{t}</p>;
  if (b.type === "callout") return <div style={{ padding: "12px 16px", borderRadius: 12, background: (T?.brass || "#B8924A") + "18", border: `1px solid ${(T?.brass || "#B8924A")}44`, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{t}</div>;
  if (b.type === "divider") return <hr style={{ border: 0, borderTop: `1px solid ${T?.line || "#E1E8EC"}`, margin: "10px 0" }} />;
  if (b.type === "image") {
    const src = safeUrl(b.url); if (!src || /^mailto:|^tel:/i.test(src)) return null;
    return <figure style={{ margin: "6px 0", textAlign: "center" }}><img src={src} alt={t} loading="lazy" style={{ maxWidth: "100%", borderRadius: 12 }} />{t && <figcaption style={{ fontSize: 12.5, opacity: 0.7, marginTop: 4 }}>{t}</figcaption>}</figure>;
  }
  if (b.type === "button") {
    const href = safeUrl(b.url); if (!href) return null;
    const ext = /^https:/i.test(href);
    return <div style={{ textAlign: align, margin: "6px 0" }}><a href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} style={{ display: "inline-block", padding: "10px 20px", borderRadius: 11, background: T?.brass || "#1B7F8E", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>{t || href}</a></div>;
  }
  if (b.type === "video") {
    const p = parseYouTube(b.url); const id = p && p.ok ? p.id : null; if (!id) return null;
    return <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden", margin: "6px 0" }}><iframe title={t || "video"} src={ytEmbedUrl(id)} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} /></div>;
  }
  return null;
}

/* عرض الزوّار (وأيضًا وضع التحرير) */
export function BlocksView({ blocks, lang, T }) {
  const vis = blocks.filter((b) => !b.hidden);
  if (!vis.length) return null;
  return <section dir={lang === "en" ? "ltr" : "rtl"} style={{ margin: "18px 0", display: "flex", flexDirection: "column", gap: 8 }}>{vis.map((b) => <Block key={b.id} b={b} lang={lang} T={T} />)}</section>;
}

/* ═══ المحرّر ═══ */
const uid = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const inpS = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid #E1E8EC", fontSize: 13.5, background: "#fff", marginBottom: 6 };
const ibS = { width: 28, height: 28, display: "grid", placeItems: "center", border: 0, background: "none", borderRadius: 7, cursor: "pointer", color: "#5F7280" };

export function BlocksEditor({ tab, tabLabel, navLabels, supabase, log, toast, lang, T }) {
  const blocks = blocksOf(navLabels, tab);
  const [editing, setEditing] = useState(null); // block draft
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const persist = async (mut, logMsg) => {
    setBusy(true);
    const { data, error: e0 } = await supabase.from("site_settings").select("nav_labels").eq("id", 1).single();
    if (e0) { setBusy(false); toast("تعذّر القراءة: " + e0.message); return false; }
    const nl = { ...(data?.nav_labels || {}) };
    const all = { ...(nl[BLOCKS_KEY] || {}) };
    const cur = Array.isArray(all[tab]) ? [...all[tab]] : [];
    const next = mut(cur);
    if (next.length > MAX_BLOCKS_PER_TAB) { setBusy(false); toast("وصلت الحد الأقصى للكتل بهذا التبويب"); return false; }
    all[tab] = next; nl[BLOCKS_KEY] = all;
    const { error } = await supabase.from("site_settings").update({ nav_labels: nl }).eq("id", 1);
    setBusy(false);
    if (error) { toast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return false; }
    log && log(logMsg, tab); return true;
  };

  const move = (id, d) => persist((a) => { const i = a.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; }, "ترتيب كتل");
  const del = (b) => { if (window.confirm("حذف هذه الكتلة؟")) persist((a) => a.filter((x) => x.id !== b.id), "حذف كتلة"); };
  const dup = (b) => persist((a) => { const i = a.findIndex((x) => x.id === b.id); a.splice(i + 1, 0, { ...b, id: uid() }); return a; }, "تكرار كتلة");
  const hide = (b) => persist((a) => a.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)), "إظهار/إخفاء كتلة");
  const save = async () => {
    const d = { ...editing };
    for (const k of ["text", "text_en"]) if (typeof d[k] === "string") d[k] = d[k].slice(0, 4000);
    if (d.url && !safeUrl(d.url) && d.type !== "video") { toast("الرابط لازم يبدأ بـ https://"); return; }
    if (d.type === "video" && !parseYouTube(d.url).ok) { toast("رابط يوتيوب غير صالح"); return; }
    const ok = await persist((a) => { const i = a.findIndex((x) => x.id === d.id); if (i >= 0) a[i] = d; else a.push(d); return a; }, "حفظ كتلة");
    if (ok) { setEditing(null); toast("تم الحفظ"); }
  };
  const start = (type) => { setAdding(false); setEditing({ id: uid(), type, text: "", text_en: "", url: "", align: "start" }); };
  const needsText = (t) => t !== "divider";
  const needsUrl = (t) => ["image", "button", "video"].includes(t);

  return (
    <div data-edit-ui="1" dir="rtl" style={{ margin: "14px 0", padding: 14, border: "2px dashed #1B7F8E88", borderRadius: 14, background: "#1B7F8E0d", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <b style={{ fontSize: 13.5, color: "#1B7F8E" }}>كتل مخصّصة — {tabLabel}</b>
        <button disabled={busy} onClick={() => setAdding((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: 0, background: "#1B7F8E", color: "#fff", fontSize: 13, cursor: "pointer" }}><Plus size={14} /> إضافة</button>
      </div>
      {adding && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {BLOCK_TYPES.map(({ type, label, icon: I }) => (
            <button key={type} onClick={() => start(type)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, border: "1px solid #1B7F8E55", background: "#fff", color: "#1B7F8E", fontSize: 12.5, cursor: "pointer" }}><I size={14} /> {label}</button>
          ))}
        </div>
      )}
      {blocks.length === 0 && !editing && <p style={{ fontSize: 12.5, color: "#5F7280", margin: 0 }}>ما فيه كتل بهذا التبويب. اضغط "إضافة" وأنشئ أي عنوان أو نص أو صورة أو زر أو فيديو.</p>}
      {blocks.map((b, i) => (
        <div key={b.id} style={{ background: "#fff", border: "1px solid #E1E8EC", borderRadius: 10, padding: 8, marginBottom: 8, opacity: b.hidden ? 0.5 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: "#5F7280", flex: 1 }}>{BLOCK_TYPES.find((x) => x.type === b.type)?.label}{b.hidden ? " (مخفية)" : ""}</span>
            <button style={ibS} title="أعلى" disabled={busy || i === 0} onClick={() => move(b.id, -1)}><ArrowUp size={14} /></button>
            <button style={ibS} title="أسفل" disabled={busy || i === blocks.length - 1} onClick={() => move(b.id, 1)}><ArrowDown size={14} /></button>
            <button style={ibS} title="تعديل" onClick={() => setEditing({ ...b })}><Pencil size={14} /></button>
            <button style={ibS} title="تكرار" disabled={busy} onClick={() => dup(b)}><Copy size={14} /></button>
            <button style={ibS} title={b.hidden ? "إظهار" : "إخفاء"} disabled={busy} onClick={() => hide(b)}>{b.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            <button style={{ ...ibS, color: "#B3402F" }} title="حذف" disabled={busy} onClick={() => del(b)}><Trash2 size={14} /></button>
          </div>
          <Block b={b} lang={lang} T={T} />
        </div>
      ))}
      {editing && (
        <div style={{ background: "#fff", border: "1px solid #1B7F8E", borderRadius: 10, padding: 12 }}>
          <b style={{ fontSize: 13 }}>{BLOCK_TYPES.find((x) => x.type === editing.type)?.label}</b>
          {needsText(editing.type) && (<>
            <textarea style={{ ...inpS, minHeight: editing.type === "heading" || editing.type === "button" ? 40 : 90, marginTop: 8 }} placeholder={editing.type === "button" ? "نص الزر (عربي)" : editing.type === "image" ? "وصف الصورة (اختياري)" : "النص بالعربي"} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
            <textarea style={{ ...inpS, direction: "ltr", minHeight: 40 }} placeholder="English (optional)" value={editing.text_en} onChange={(e) => setEditing({ ...editing, text_en: e.target.value })} />
          </>)}
          {needsUrl(editing.type) && <input style={{ ...inpS, direction: "ltr" }} placeholder={editing.type === "video" ? "https://youtu.be/…" : "https://…"} value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} />}
          {["heading", "text", "button"].includes(editing.type) && (
            <select style={inpS} value={editing.align} onChange={(e) => setEditing({ ...editing, align: e.target.value })}><option value="start">محاذاة: البداية</option><option value="center">محاذاة: وسط</option></select>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy} onClick={save} style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 14px", borderRadius: 9, border: 0, background: "#1B7F8E", color: "#fff", fontSize: 13, cursor: "pointer" }}><Check size={14} /> حفظ</button>
            <button onClick={() => setEditing(null)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 14px", borderRadius: 9, border: "1px solid #E1E8EC", background: "#fff", fontSize: 13, cursor: "pointer" }}><X size={14} /> إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
