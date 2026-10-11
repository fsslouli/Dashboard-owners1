/* ═══════════════════════════════════════════════════════════
   blocks-kit.jsx — عرض كتل المحتوى المخصّصة (٦.٠.٠) — يُحمَّل للزوّار
   تُخزَّن بـ site_settings.nav_labels._blocks = { <تبويب>: [ {id,type,...} ] } بدون هجرة.
   المحرّر نفسه بملف منفصل (blocks-editor.jsx) يُحمَّل بوضع التحرير فقط.
   أمان: لا HTML خام أبدًا — نص عادي فقط، وروابط/صور https (أو mailto/tel/#/مسار نسبي) فقط.
   ═══════════════════════════════════════════════════════════ */
import React from "react";
import { Heading, Type, MessageSquare, Image as Img, MousePointerClick, Youtube, List, ChevronDown, Table2, LayoutGrid, Minus } from "lucide-react";
import { parseYouTube, ytEmbedUrl } from "./youtube-kit.js";

export const BLOCKS_KEY = "_blocks";
export const MAX_BLOCKS_PER_TAB = 40;
export const BLOCK_TYPES = [
  { type: "heading", label: "عنوان", icon: Heading },
  { type: "text", label: "نص", icon: Type },
  { type: "callout", label: "تنبيه/مربع مميز", icon: MessageSquare },
  { type: "list", label: "قائمة نقاط", icon: List },
  { type: "accordion", label: "سؤال وجواب (قابل للطي)", icon: ChevronDown },
  { type: "image", label: "صورة", icon: Img },
  { type: "button", label: "زر/رابط", icon: MousePointerClick },
  { type: "video", label: "فيديو يوتيوب", icon: Youtube },
  { type: "table", label: "جدول", icon: Table2 },
  { type: "cards", label: "بطاقات", icon: LayoutGrid },
  { type: "divider", label: "فاصل", icon: Minus },
];

export const safeUrl = (u) => {
  const s = String(u || "").trim();
  if (/^https:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s) || s.startsWith("#") || (s.startsWith("/") && !s.startsWith("//"))) return s;
  return "";
};
export const pick = (b, f, lang) => String((lang === "en" ? (b[f + "_en"] || b[f]) : (b[f] || b[f + "_en"])) || "");

export const blocksOf = (navLabels, tab) => {
  const a = navLabels && navLabels[BLOCKS_KEY] && navLabels[BLOCKS_KEY][tab];
  return Array.isArray(a) ? a.filter((b) => b && typeof b === "object" && typeof b.type === "string") : [];
};

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const SIZES = { sm: 0.88, md: 1, lg: 1.2, xl: 1.5 };
const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
const cells = (line) => line.split("|").map((c) => c.trim());

export function Block(props) {
  const { b } = props;
  const st = {};
  if (COLOR_RE.test(b.color || "")) st.color = b.color;
  if (COLOR_RE.test(b.bg || "")) { st.background = b.bg; st.padding = "10px 14px"; st.borderRadius = 12; }
  if (b.bold) st.fontWeight = 700;
  if (SIZES[b.size] && b.size !== "md") st.fontSize = `${SIZES[b.size]}em`;
  return Object.keys(st).length ? <div style={st}><BlockInner {...props} /></div> : <BlockInner {...props} />;
}

function BlockInner({ b, lang, T }) {
  const t = pick(b, "text", lang);
  const align = b.align === "center" ? "center" : "start";
  const line = T?.line || "#E1E8EC";
  const accent = T?.brass || "#1B7F8E";
  if (b.type === "heading") return <h3 style={{ fontSize: 19, fontWeight: 700, margin: "6px 0", textAlign: align }}>{t}</h3>;
  if (b.type === "text") return <p style={{ fontSize: 14.5, lineHeight: 1.9, margin: "4px 0", whiteSpace: "pre-wrap", textAlign: align }}>{t}</p>;
  if (b.type === "callout") return <div style={{ padding: "12px 16px", borderRadius: 12, background: accent + "18", border: `1px solid ${accent}44`, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{t}</div>;
  if (b.type === "list") return <ul style={{ margin: "4px 0", paddingInlineStart: 22, fontSize: 14.5, lineHeight: 1.9 }}>{lines(t).map((x, i) => <li key={i}>{x}</li>)}</ul>;
  if (b.type === "accordion") {
    return (
      <details style={{ border: `1px solid ${line}`, borderRadius: 12, padding: "10px 14px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14.5 }}>{pick(b, "title", lang)}</summary>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{t}</p>
      </details>
    );
  }
  if (b.type === "divider") return <hr style={{ border: 0, borderTop: `1px solid ${line}`, margin: "10px 0" }} />;
  if (b.type === "image") {
    const src = safeUrl(b.url); if (!src || /^mailto:|^tel:|^#/i.test(src)) return null;
    return <figure style={{ margin: "6px 0", textAlign: "center" }}><img src={src} alt={t} loading="lazy" style={{ maxWidth: "100%", borderRadius: 12 }} />{t && <figcaption style={{ fontSize: 12.5, opacity: 0.7, marginTop: 4 }}>{t}</figcaption>}</figure>;
  }
  if (b.type === "button") {
    const href = safeUrl(b.url); if (!href) return null;
    const ext = /^https:/i.test(href);
    return <div style={{ textAlign: align, margin: "6px 0" }}><a href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} style={{ display: "inline-block", padding: "10px 20px", borderRadius: 11, background: accent, color: T?.onAccent || "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>{t || href}</a></div>;
  }
  if (b.type === "video") {
    const p = parseYouTube(b.url); const id = p && p.ok ? p.id : null; if (!id) return null;
    return <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden", margin: "6px 0" }}><iframe title={t || "video"} src={ytEmbedUrl(id)} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} /></div>;
  }
  if (b.type === "table") {
    const rows = lines(t).slice(0, 60).map(cells);
    if (!rows.length) return null;
    const [head, ...body] = rows;
    const td = { padding: "8px 10px", borderBottom: `1px solid ${line}`, textAlign: "start", verticalAlign: "top" };
    return (
      <div style={{ overflowX: "auto", margin: "6px 0", border: `1px solid ${line}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead><tr>{head.map((c, i) => <th key={i} style={{ ...td, fontWeight: 700, background: accent + "14" }}>{c}</th>)}</tr></thead>
          <tbody>{body.map((r, i) => <tr key={i}>{head.map((_, j) => <td key={j} style={td}>{r[j] || ""}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (b.type === "cards") {
    const items = lines(t).slice(0, 24).map(cells);
    if (!items.length) return null;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10, margin: "6px 0" }}>
        {items.map(([title, desc, url], i) => {
          const href = safeUrl(url);
          const body = (<><b style={{ display: "block", fontSize: 14.5, marginBottom: desc ? 4 : 0 }}>{title}</b>{desc && <span style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.7 }}>{desc}</span>}</>);
          const st = { display: "block", padding: "14px 16px", borderRadius: 14, border: `1px solid ${line}`, borderInlineStart: `3px solid ${accent}`, background: T?.surface || "transparent", color: "inherit", textDecoration: "none" };
          return href
            ? <a key={i} href={href} {...(/^https:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} style={st}>{body}</a>
            : <div key={i} style={st}>{body}</div>;
        })}
      </div>
    );
  }
  return null;
}

/* عرض الزوّار (وأيضًا وضع التحرير) */
export function BlocksView({ blocks, lang, T, pos = "bottom" }) {
  const vis = blocks.filter((b) => !b.hidden && (b.pos === "top" ? "top" : "bottom") === pos);
  if (!vis.length) return null;
  return <section dir={lang === "en" ? "ltr" : "rtl"} style={{ margin: "18px 0", display: "flex", flexDirection: "column", gap: 8 }}>{vis.map((b) => <Block key={b.id} b={b} lang={lang} T={T} />)}</section>;
}
