/* ═══════════════════════════════════════════════════════════
   blocks-editor.jsx — محرّر كتل المحتوى (٦.٠.٠) — بوضع التحرير فقط
   إضافة / تعديل / ترتيب / تكرار / إخفاء / حذف / نقل لتبويب ثاني، ورفع صور من الجهاز
   (حاوية gallery تحت مجلد site/ بصلاحية manage_theme — الخادم هو اللي يفرض الصلاحية).
   ═══════════════════════════════════════════════════════════ */
import React, { useRef, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Pencil, Check, X, Eye, EyeOff, Upload } from "lucide-react";
import { parseYouTube } from "./youtube-kit.js";
import { BLOCKS_KEY, BLOCK_TYPES, MAX_BLOCKS_PER_TAB, Block, blocksOf, safeUrl } from "./blocks-kit.jsx";
import { patchNavLabels } from "./nav-labels-kit.jsx";

const uid = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ضغط الصورة قبل الرفع (أقصى بُعد 1800، webp) */
async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  const s = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close && bmp.close();
  const blob = await new Promise((res) => { try { c.toBlob((b) => res(b), "image/webp", 0.82); } catch (_) { res(null); } });
  if (!blob) throw new Error("encode-failed");
  return blob;
}

const HINTS = {
  table: "كل سطر = صف، وافصل الخانات بعلامة | — أول سطر عناوين الأعمدة. مثال:\nالبند | الحالة | الموعد\nالعزل | منجز | سبتمبر",
  cards: "كل سطر = بطاقة: العنوان | الوصف | رابط اختياري. مثال:\nالمخطط المعتمد | نسخة أكتوبر 2024 | https://…",
  list: "كل سطر = نقطة",
};

export function BlocksEditor({ tab, tabLabel, tabs = [], navLabels, supabase, log, toast, lang, T, canUpload = false }) {
  const blocks = blocksOf(navLabels, tab);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const accent = T?.brass || "#1B7F8E";
  const inpS = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T?.line || "#E1E8EC"}`, fontSize: 13.5, background: T?.surface || "#fff", color: T?.paper || "#1F2C35", marginBottom: 6, fontFamily: "inherit" };
  const ibS = { width: 28, height: 28, display: "grid", placeItems: "center", border: 0, background: "none", borderRadius: 7, cursor: "pointer", color: T?.muted || "#5F7280" };

  /* كل تعديل يقرأ آخر نسخة من القاعدة أولًا (ما يمسح تعديلات غيرك) */
  const persist = async (mut, logMsg) => {
    setBusy(true);
    let overflow = false;
    const { error } = await patchNavLabels(supabase, (nl) => {
      const all = { ...(nl[BLOCKS_KEY] || {}) };
      const res = mut(all);
      if (Object.values(res).some((a) => Array.isArray(a) && a.length > MAX_BLOCKS_PER_TAB)) { overflow = true; return nl; }
      Object.keys(res).forEach((k) => { if (Array.isArray(res[k]) && !res[k].length) delete res[k]; });
      return { ...nl, [BLOCKS_KEY]: res };
    }, logMsg);
    setBusy(false);
    if (overflow) { toast(`الحد الأقصى ${MAX_BLOCKS_PER_TAB} كتلة لكل تبويب`); return false; }
    if (error) { toast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return false; }
    log && log(logMsg, tab); return true;
  };
  const inTab = (all, k = tab) => (Array.isArray(all[k]) ? [...all[k]] : []);

  const move = (id, d) => persist((all) => { const a = inTab(all); const i = a.findIndex((x) => x.id === id), j = i + d; if (i >= 0 && j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]]; return { ...all, [tab]: a }; }, "ترتيب كتل");
  const dup = (b) => persist((all) => { const a = inTab(all); const i = a.findIndex((x) => x.id === b.id); a.splice(i + 1, 0, { ...b, id: uid() }); return { ...all, [tab]: a }; }, "تكرار كتلة");
  const hide = (b) => persist((all) => ({ ...all, [tab]: inTab(all).map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)) }), "إظهار/إخفاء كتلة");
  const del = async (b) => {
    if (!window.confirm("حذف هذه الكتلة نهائيًا؟ (تقدر ترجعها من «سجل النسخ»)")) return;
    const ok = await persist((all) => ({ ...all, [tab]: inTab(all).filter((x) => x.id !== b.id) }), "حذف كتلة");
    /* صورة مرفوعة من هنا؟ نخليها بالحاوية عشان «سجل النسخ» يقدر يرجّع الكتلة بصورتها */
    if (ok) toast("انحذفت الكتلة");
  };
  const save = async () => {
    const d = { ...editing };
    const target = d._tab && d._tab !== tab ? d._tab : tab;
    delete d._tab;
    for (const k of ["text", "text_en", "title", "title_en"]) if (typeof d[k] === "string") d[k] = d[k].slice(0, 6000);
    if (["image", "button"].includes(d.type) && !safeUrl(d.url)) { toast("الرابط لازم يبدأ بـ https://"); return; }
    if (d.type === "video" && !parseYouTube(d.url).ok) { toast("رابط يوتيوب غير صالح"); return; }
    if (["heading", "text", "callout", "list", "table", "cards"].includes(d.type) && !(d.text || "").trim() && !(d.text_en || "").trim()) { toast("اكتب المحتوى أولًا"); return; }
    const ok = await persist((all) => {
      const src = inTab(all).filter((x) => x.id !== d.id);
      if (target === tab) {
        const a = inTab(all); const i = a.findIndex((x) => x.id === d.id);
        if (i >= 0) a[i] = d; else a.push(d);
        return { ...all, [tab]: a };
      }
      return { ...all, [tab]: src, [target]: [...inTab(all, target), d] };
    }, target === tab ? "حفظ كتلة" : "نقل كتلة لتبويب آخر");
    if (ok) { setEditing(null); toast(target === tab ? "تم الحفظ" : "انتقلت الكتلة للتبويب المختار"); }
  };
  const start = (type) => { setAdding(false); setEditing({ id: uid(), type, text: "", text_en: "", url: "", align: "start" }); };

  const upload = async (file) => {
    if (!file || !file.type.startsWith("image/")) { toast("اختر ملف صورة"); return; }
    setBusy(true);
    try {
      const blob = await shrink(file);
      const path = `site/${crypto.randomUUID ? crypto.randomUUID() : uid()}.webp`;
      const { error } = await supabase.storage.from("gallery").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("gallery").getPublicUrl(path);
      setEditing((e) => ({ ...e, url: data.publicUrl }));
      toast("انرفعت الصورة — اضغط حفظ");
    } catch (e) {
      toast("تعذّر رفع الصورة (يحتاج صلاحية «إدارة المعرض»): " + (e?.message || ""));
    }
    setBusy(false);
  };

  const needsText = (t) => t !== "divider";
  const needsUrl = (t) => ["image", "button", "video"].includes(t);
  const label = (t) => BLOCK_TYPES.find((x) => x.type === t)?.label || t;

  return (
    <div data-edit-ui="1" dir="rtl" className="no-print" style={{ margin: "14px 0", padding: 14, border: `2px dashed ${accent}88`, borderRadius: 14, background: accent + "0d", fontFamily: "system-ui, sans-serif", color: T?.paper }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
        <b style={{ fontSize: 13.5, color: accent }}>كتل مخصّصة — {tabLabel}</b>
        <button disabled={busy} onClick={() => setAdding((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: 0, background: accent, color: T?.onAccent || "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} /> إضافة</button>
      </div>
      {adding && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {BLOCK_TYPES.map(({ type, label: lb, icon: I }) => (
            <button key={type} onClick={() => start(type)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, border: `1px solid ${accent}55`, background: T?.surface || "#fff", color: accent, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}><I size={14} /> {lb}</button>
          ))}
        </div>
      )}
      {blocks.length === 0 && !editing && <p style={{ fontSize: 12.5, color: T?.muted, margin: 0 }}>ما فيه كتل بهذا التبويب. اضغط «إضافة» وأنشئ عنوان، نص، صورة، زر، فيديو، جدول، بطاقات…</p>}
      {blocks.map((b, i) => (
        <div key={b.id} style={{ background: T?.surface || "#fff", border: `1px solid ${T?.line || "#E1E8EC"}`, borderRadius: 10, padding: 8, marginBottom: 8, opacity: b.hidden ? 0.5 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: T?.muted, flex: 1 }}>{label(b.type)}{b.pos === "top" ? " · أعلى" : ""}{b.hidden ? " (مخفية)" : ""}</span>
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
        <div style={{ background: T?.surface || "#fff", border: `1px solid ${accent}`, borderRadius: 10, padding: 12 }}>
          <b style={{ fontSize: 13 }}>{label(editing.type)}</b>
          {HINTS[editing.type] && <div style={{ fontSize: 11.5, color: T?.muted, whiteSpace: "pre-wrap", margin: "6px 0", lineHeight: 1.7 }}>{HINTS[editing.type]}</div>}
          {editing.type === "accordion" && (<>
            <input style={{ ...inpS, marginTop: 8 }} placeholder="السؤال / العنوان (عربي)" value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <input style={{ ...inpS, direction: "ltr" }} placeholder="Question (optional)" value={editing.title_en || ""} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} />
          </>)}
          {needsText(editing.type) && (<>
            <textarea style={{ ...inpS, minHeight: ["heading", "button", "image"].includes(editing.type) ? 40 : 100, marginTop: 8 }}
              placeholder={editing.type === "button" ? "نص الزر (عربي)" : editing.type === "image" ? "وصف الصورة (اختياري)" : editing.type === "accordion" ? "الجواب (عربي)" : "المحتوى بالعربي"}
              value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
            <textarea style={{ ...inpS, direction: "ltr", minHeight: 40 }} placeholder="English (optional)" value={editing.text_en} onChange={(e) => setEditing({ ...editing, text_en: e.target.value })} />
          </>)}
          {needsUrl(editing.type) && (
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <input style={{ ...inpS, direction: "ltr", flex: 1 }} placeholder={editing.type === "video" ? "https://youtu.be/…" : "https://…"} value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
              {editing.type === "image" && canUpload && (<>
                <button type="button" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 10px", borderRadius: 8, border: `1px solid ${accent}`, background: "none", color: accent, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}><Upload size={14} /> {busy ? "يرفع…" : "رفع من الجهاز"}</button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files && e.target.files[0]); e.target.value = ""; }} />
              </>)}
            </div>
          )}
          {editing.type === "image" && safeUrl(editing.url) && <img src={safeUrl(editing.url)} alt="" style={{ maxWidth: 160, maxHeight: 110, borderRadius: 8, display: "block", marginBottom: 6 }} />}
          {["heading", "text", "button"].includes(editing.type) && (
            <select style={inpS} value={editing.align} onChange={(e) => setEditing({ ...editing, align: e.target.value })}><option value="start">محاذاة: البداية</option><option value="center">محاذاة: وسط</option></select>
          )}
          {editing.type !== "divider" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 12.5, margin: "4px 0 10px" }}>
              <label>لون النص <input type="color" value={editing.color || "#1f2933"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></label>
              <label>خلفية <input type="color" value={editing.bg || "#ffffff"} onChange={(e) => setEditing({ ...editing, bg: e.target.value })} /></label>
              <button type="button" onClick={() => setEditing({ ...editing, color: "", bg: "" })} style={{ border: 0, background: "none", color: T?.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>مسح الألوان</button>
              <select value={editing.size || "md"} onChange={(e) => setEditing({ ...editing, size: e.target.value })}><option value="sm">صغير</option><option value="md">عادي</option><option value="lg">كبير</option><option value="xl">كبير جدًا</option></select>
              <label><input type="checkbox" checked={!!editing.bold} onChange={(e) => setEditing({ ...editing, bold: e.target.checked })} /> عريض</label>
            </div>
          )}
          <select style={inpS} value={editing.pos === "top" ? "top" : "bottom"} onChange={(e) => setEditing({ ...editing, pos: e.target.value })}><option value="bottom">المكان: أسفل التبويب</option><option value="top">المكان: أعلى التبويب</option></select>
          {tabs.length > 1 && (
            <select style={inpS} value={editing._tab || tab} onChange={(e) => setEditing({ ...editing, _tab: e.target.value })}>
              {tabs.map((x) => <option key={x.key} value={x.key}>التبويب: {x.label}</option>)}
            </select>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy} onClick={save} style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 14px", borderRadius: 9, border: 0, background: accent, color: T?.onAccent || "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><Check size={14} /> حفظ</button>
            <button onClick={() => setEditing(null)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 14px", borderRadius: 9, border: `1px solid ${T?.line || "#E1E8EC"}`, background: "none", color: T?.paper, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><X size={14} /> إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

