/* ═══════════════════════════════════════════════════════════
   gallery-kit.jsx — معرض الموقع (صور ومقاطع)، طبقة مستقلة عن Dashboard.jsx.

   الفكرة: نفس مبدأ youtube-kit.js/design-nova.jsx — ملف قائم بذاته يُستورد
   بسطرين بدون ما يلمس منطق باقي الموقع. جدولان بقاعدة البيانات:
     media_topics  — المواضيع (كل موضوع = قسم بالعرض العام)
     media_items   — العناصر داخل كل موضوع: صورة مرفوعة، صورة برابط خارجي،
                     مقطع يوتيوب، ومن ٣.٠.٠: PDF أو فيديو أو مستند مرفوع
                     (بحاوية attachments)، وروابط Drive وVimeo والملفات المباشرة.
                     العرض والتشغيل كله من attach-kit.jsx (نفس عارض المرفقات)

   الصلاحية المستخدمة: manage_media (نفس صلاحية "مقاطع النماذج" الموجودة).
   شغّل migration-gallery.sql مرة وحدة قبل الاستخدام.
   ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ImagePlus, FilePlus, GripVertical, ChevronUp, ChevronDown, ChevronDown as Chevron,
  Eye, EyeOff, Trash2, Plus, Rows, LayoutGrid, List, LayoutDashboard, Folder, ChevronLeft, ChevronRight, Play,
} from "lucide-react";
import { autoTranslateAr } from "./translate-kit.js";
import {
  ACCEPT_DOCS, ATT_BUCKET, AttachmentViewer, KindIcon, LinkField, MEDIA_PUBLIC_COLS, WARN_VIDEO,
  attMetaLine, attTitle, badgeText, sourceLabel, fmtSize, linkFields, toView, uploadAttachmentFile,
} from "./attach-kit.jsx";

/* ── أدوات مشتركة ───────────────────────────────────────── */
const BIDI_RE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const clean = (s) => String(s || "").replace(BIDI_RE, "").trim();

/* مسارات ملفات العنصر بالتخزين — للحذف (مصغّرة صور المعرض القديمة تُشتق من الاسم) */
const itemPaths = (it) => {
  const out = [it.storage_path, it.thumb_path, it._thumbPath];
  if ((it.bucket || "gallery") === "gallery" && it.kind === "image" && it.storage_path) out.push(it.storage_path.replace(/\.webp$/, "_thumb.webp"));
  return [...new Set(out.filter(Boolean))];
};
/* ألوان حقل الرابط — نفس ألوان هذا التبويب الثابتة */
const GT = { surface: "#fff", sunken: "#F7F9FB", line: "#E1E8EC", paper: "#1F2C35", muted: "#5F7280", faint: "#7E8F9A", brass: "#1B7F8E", onAccent: "#fff" };

/* ضغط الصورة بالمتصفح قبل الرفع: نسخة عرض (1600) ونسخة مصغّرة (480) */
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  const draw = (max, q) => new Promise((resolve) => {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    c.toBlob((b) => resolve(b), "image/webp", q) || resolve(null);
  });
  const [full, thumb] = await Promise.all([draw(1600, 0.8), draw(480, 0.7)]);
  bmp.close && bmp.close();
  if (!full || !thumb) throw new Error("encode-failed");
  return { full, thumb };
}

const niceTitle = (name) => {
  const n = name.replace(/\.[^.]+$/, "");
  return /^(img|dsc|pxl|photo|image|whatsapp|screenshot|صورة|\d)/i.test(n) ? "" : n.replace(/[_-]+/g, " ").trim();
};

/* أشكال عرض المكتبة بالموقع العام — القيمة المحفوظة بـ site_settings.gallery_layout */
const LAYOUT_LABEL = { docs: "زي المستندات", adaptive: "حسب نوع الملف", folders: "مجلدات تنفتح" };
const LAYOUTS = ["docs", "adaptive", "folders"];

/* قراءة إعدادات المعرض. لو عمود gallery_layout ما انضاف (الهجرة ما اشتغلت) نرجع لقراءة القديم بدون ما يطيح شي */
async function readGallerySettings(supabase) {
  let r = await supabase.from("site_settings").select("gallery_mode,gallery_layout").maybeSingle();
  if (!r.error) return { data: r.data, layoutOk: true };
  r = await supabase.from("site_settings").select("gallery_mode").maybeSingle();
  return { data: r.data, layoutOk: false };
}

/* ═══════════════════════════════════════════════════════════
   لوحة الإدارة — AGalleryTab
   ═══════════════════════════════════════════════════════════ */
export function AGalleryTab({ supabase, flashToast, log, canManage }) {
  const [topics, setTopics] = useState(null);      /* [{...topic, items:[...]}]  */
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState({});             /* topicId → موسّع؟ */
  const [confirmDel, setConfirmDel] = useState(null); /* {type:'topic'|'item', id, label} */
  const [mode, setMode] = useState("sections");
  const [layout, setLayout] = useState("docs");
  const [layoutOk, setLayoutOk] = useState(true);   /* false = عمود gallery_layout ما انشغّلت هجرته */
  const fileRefs = useRef({});
  const docRefs = useRef({});

  const load = useCallback(async () => {
    const [{ data: t }, { data: it }, sr] = await Promise.all([
      supabase.from("media_topics").select("*").order("sort_order").order("id"),
      supabase.from("media_items").select("*").order("sort_order").order("id"),
      readGallerySettings(supabase),
    ]);
    const byTopic = {};
    (it || []).forEach((r) => (byTopic[r.topic_id] || (byTopic[r.topic_id] = [])).push(r));
    setTopics((t || []).map((tp) => ({ ...tp, items: byTopic[tp.id] || [] })));
    if (sr.data?.gallery_mode) setMode(sr.data.gallery_mode);
    if (sr.data?.gallery_layout) setLayout(sr.data.gallery_layout);
    setLayoutOk(sr.layoutOk);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  if (!canManage) return <div style={{ padding: 24, color: "#8A6318" }}>ما عندك صلاحية إدارة الوسائط.</div>;
  if (topics === null) return <div style={{ padding: 24, opacity: 0.6 }}>يحمّل…</div>;

  const saveMode = async (m) => {
    setMode(m);
    const { error } = await supabase.from("site_settings").update({ gallery_mode: m }).eq("id", 1);
    if (error) { flashToast("تعذّر حفظ طريقة العرض"); return; }
    log("تغيير طريقة عرض المعرض", m === "sections" ? "أقسام منفصلة" : "كل المواضيع مع بعض");
    flashToast("تم حفظ طريقة العرض بالموقع العام");
  };

  const saveLayout = async (l) => {
    const prev = layout;
    setLayout(l);
    const { error } = await supabase.from("site_settings").update({ gallery_layout: l }).eq("id", 1);
    if (error) {
      setLayout(prev);
      flashToast(/column|constraint/i.test(error.message || "") ? "شغّل migration-gallery-layout.sql أولًا." : "تعذّر حفظ شكل العرض");
      return;
    }
    log("تغيير شكل عرض المكتبة", LAYOUT_LABEL[l]);
    flashToast("تم حفظ شكل العرض بالموقع العام");
  };

  const addTopic = async () => {
    const { data, error } = await supabase.from("media_topics")
      .insert({ title_ar: "", sort_order: topics.length ? Math.max(...topics.map((t) => t.sort_order)) + 1 : 0 })
      .select().single();
    if (error) { flashToast("تعذّر إنشاء الموضوع: " + (error.message || "")); return; }
    setTopics((ts) => [...ts, { ...data, items: [] }]);
    setOpen((o) => ({ ...o, [data.id]: true }));
    log("إضافة موضوع بالمعرض", "بدون عنوان");
  };
  const renameTopic = (id, title_ar) => setTopics((ts) => ts.map((t) => (t.id === id ? { ...t, title_ar } : t)));
  const saveTopicTitle = async (id, title_ar) => {
    const title_en = await autoTranslateAr(supabase, title_ar);
    await supabase.from("media_topics").update({ title_ar, ...(title_en ? { title_en } : {}) }).eq("id", id);
  };
  const toggleTopicPub = async (t) => {
    const published = !t.published;
    setTopics((ts) => ts.map((x) => (x.id === t.id ? { ...x, published } : x)));
    await supabase.from("media_topics").update({ published }).eq("id", t.id);
    flashToast(published ? "صار الموضوع ظاهرًا للملاك" : "أُخفي الموضوع عن الملاك");
  };
  const moveTopic = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= topics.length || busy) return;
    const a = topics[i], b = topics[j]; setBusy(true);
    await Promise.all([
      supabase.from("media_topics").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("media_topics").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    setBusy(false); load();
  };
  const doDeleteTopic = async (t) => {
    setConfirmDel(null);
    const { error } = await supabase.from("media_topics").delete().eq("id", t.id);
    if (error) { flashToast("تعذّر حذف الموضوع"); return; }   /* الملفات ما تنمسح إلا بعد ما ينحذف السجل فعلًا */
    (t.items || []).filter((x) => x.storage_path).forEach((x) => supabase.storage.from(x.bucket || "gallery").remove(itemPaths(x)));
    setTopics((ts) => ts.filter((x) => x.id !== t.id));
    log("حذف موضوع بالمعرض", t.title_ar || "بدون عنوان");
    flashToast("تم حذف الموضوع");
  };

  const addItems = (t, rows) => setTopics((ts) => ts.map((x) => (x.id === t.id ? { ...x, items: [...x.items, ...rows] } : x)));
  const removeItemLocal = (t, id) => setTopics((ts) => ts.map((x) => (x.id === t.id ? { ...x, items: x.items.filter((r) => r.id !== id) } : x)));

  const onPickFiles = async (t, fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    flashToast(`جارٍ رفع ${files.length > 1 ? files.length + " صور" : "الصورة"}…`);
    let ok = 0;
    for (const f of files) {
      try {
        const { full, thumb } = await shrinkImage(f);
        const stem = crypto.randomUUID();
        const fullPath = `t${t.id}/${stem}.webp`, thumbPath = `t${t.id}/${stem}_thumb.webp`;
        const [u1, u2] = await Promise.all([
          supabase.storage.from("gallery").upload(fullPath, full, { contentType: "image/webp" }),
          supabase.storage.from("gallery").upload(thumbPath, thumb, { contentType: "image/webp" }),
        ]);
        if (u1.error || u2.error) continue;
        const sort_order = (t.items.length ? Math.max(...t.items.map((r) => r.sort_order)) : -1) + 1 + ok;
        const { data, error } = await supabase.from("media_items").insert({
          topic_id: t.id, kind: "image", source: "upload", title_ar: niceTitle(f.name),
          storage_path: fullPath, sort_order,
        }).select().single();
        if (!error) { addItems(t, [{ ...data, _thumbPath: thumbPath }]); ok++; }
      } catch (_) { /* تجاهل ملف واحد فشل، كمّل الباقي */ }
    }
    flashToast(ok ? `تمت إضافة ${ok} من ${files.length}` : "ما قدرت أرفع الصور المختارة");
    if (ok) log("رفع صور للمعرض", `${ok} صورة — موضوع "${t.title_ar || "بدون عنوان"}"`);
  };

  /* PDF وفيديو ومستندات: تنرفع لحاوية attachments (الحاوية gallery للصور فقط) */
  const onPickDocs = async (t, files) => {
    if (!files.length) return;
    flashToast(files.length > 1 ? `جارٍ رفع ${files.length} ملفات…` : "جارٍ رفع الملف…");
    let ok = 0;
    for (const f of files) {
      let paths = [];
      try {
        const up = await uploadAttachmentFile(supabase, f, { prefix: `gal/t${t.id}`, only: ["pdf", "video", "office"] });
        paths = up.paths;
        const sort_order = (t.items.length ? Math.max(...t.items.map((r) => r.sort_order)) : -1) + 1 + ok;
        const { data, error } = await supabase.from("media_items")
          .insert({ topic_id: t.id, bucket: ATT_BUCKET, ...up.fields, title_ar: niceTitle(f.name) || null, sort_order }).select().single();
        if (error) throw new Error(/column|constraint/i.test(error.message || "") ? "شغّل migration-attachments.sql أولًا." : error.message);
        addItems(t, [data]); ok++;
        if (up.fields.kind === "video" && up.fields.size_bytes > WARN_VIDEO) flashToast(`انضاف المقطع — كل مشاهدة كاملة تسحب ${fmtSize(up.fields.size_bytes)} من حصة النقل الشهرية`);
      } catch (e) {
        if (paths.length) supabase.storage.from(ATT_BUCKET).remove(paths);
        flashToast(`تعذّر رفع «${f.name}»: ${(e && e.userMsg) || (e && e.message) || ""}`);
      }
    }
    if (ok) { log("رفع ملفات للمعرض", `${ok} ملف — موضوع "${t.title_ar || "بدون عنوان"}"`); flashToast(`تمت إضافة ${ok} من ${files.length}`); }
  };

  /* الروابط: يوتيوب بنفس الصيغة السابقة، والباقي (صورة، PDF، فيديو، Drive، Vimeo) بالأعمدة الجديدة */
  const onAddLink = async (t, c, kind) => {
    const sort_order = (t.items.length ? Math.max(...t.items.map((r) => r.sort_order)) : -1) + 1;
    let row;
    if (c.provider === "youtube") row = { kind: "video", source: "link", youtube_id: c.ytId };
    else {
      row = linkFields(c, kind);
      if (!["image", "video", "pdf", "office"].includes(row.kind)) return "المعرض يقبل الصور والمقاطع وملفات PDF والمستندات فقط.";
    }
    let res = await supabase.from("media_items").insert({ topic_id: t.id, ...row, ...(c.provider === "youtube" ? { provider: "youtube", vertical: !!c.vertical } : {}), sort_order }).select().single();
    if (res.error && c.provider === "youtube" && /column/i.test(res.error.message || "")) {
      res = await supabase.from("media_items").insert({ topic_id: t.id, ...row, sort_order }).select().single();   /* قبل تشغيل migration-attachments.sql */
    }
    if (res.error) return /column|constraint/i.test(res.error.message || "") ? "هذا النوع يحتاج تشغيل migration-attachments.sql أولًا." : "تعذّر إضافة الرابط.";
    addItems(t, [res.data]);
    log("إضافة رابط للمعرض", c.url);
    return null;
  };

  const saveItemTitle = async (id, title_ar) => {
    const title_en = await autoTranslateAr(supabase, title_ar);
    await supabase.from("media_items").update({ title_ar, ...(title_en ? { title_en } : {}) }).eq("id", id);
  };
  const toggleItemPub = async (t, it) => {
    const published = !it.published;
    setTopics((ts) => ts.map((x) => (x.id === t.id ? { ...x, items: x.items.map((r) => (r.id === it.id ? { ...r, published } : r)) } : x)));
    await supabase.from("media_items").update({ published }).eq("id", it.id);
  };
  const moveItem = async (t, i, dir) => {
    const list = t.items; const j = i + dir; if (j < 0 || j >= list.length || busy) return;
    const a = list[i], b = list[j]; setBusy(true);
    await Promise.all([
      supabase.from("media_items").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("media_items").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    setBusy(false); load();
  };
  const doDeleteItem = async (t, it) => {
    setConfirmDel(null);
    const { error } = await supabase.from("media_items").delete().eq("id", it.id);
    if (error) { flashToast("تعذّر حذف العنصر"); return; }
    if (it.storage_path) supabase.storage.from(it.bucket || "gallery").remove(itemPaths(it));
    removeItemLocal(t, it.id);
    flashToast("تم حذف العنصر");
  };

  const S = {
    wrap: { maxWidth: 760, margin: "0 auto", padding: "16px 4px" },
    modeRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 14 },
    seg: { display: "flex", background: "#F1F5F8", borderRadius: 10, padding: 3 },
    segBtn: (on) => ({ border: 0, background: on ? "#fff" : "none", color: on ? "#1F2C35" : "#5F7280", fontWeight: on ? 600 : 400, borderRadius: 8, padding: "6px 12px", display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }),
    btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "8px 14px", fontWeight: 500, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center" },
    pri: { background: "#1B7F8E", borderColor: "#1B7F8E", color: "#fff" },
    topic: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 10, marginBottom: 10 },
    thead: { display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center" },
    tt: { width: "100%", border: 0, borderBottom: "1px solid transparent", background: "none", padding: "2px 0", font: "600 16px/1.5 inherit" },
    ib: (danger) => ({ width: 32, height: 32, display: "grid", placeItems: "center", border: 0, background: "none", borderRadius: 8, color: danger ? "#A8443C" : "#5F7280", cursor: "pointer" }),
    body: { marginTop: 10, paddingTop: 10, borderTop: "1px solid #EEF2F4" },
    tools: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
    link: { flex: "1 1 160px", minWidth: 0, border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 10, padding: "7px 12px", direction: "ltr" },
    err: { margin: "6px 0 0", fontSize: 13, color: "#A8443C" },
    irow: { display: "grid", gridTemplateColumns: "16px 46px 1fr auto", gap: 8, alignItems: "center", background: "#F7F9FB", borderRadius: 10, padding: "6px 8px", marginTop: 6 },
    ithumb: { width: 46, height: 34, borderRadius: 6, overflow: "hidden", background: "#1F2C35", color: "#fff", display: "grid", placeItems: "center", fontSize: 11 },
    it: { width: "100%", border: 0, background: "none", padding: "2px 0", fontSize: 13.5 },
  };

  return (
    <div style={S.wrap}>
      <div style={S.modeRow}>
        <span style={{ fontSize: 13, color: "#5F7280" }}>طريقة العرض بالموقع العام:</span>
        <div style={S.seg}>
          <button style={S.segBtn(mode === "sections")} onClick={() => saveMode("sections")}><Rows size={14} /> أقسام منفصلة</button>
          <button style={S.segBtn(mode === "merged")} onClick={() => saveMode("merged")}><LayoutGrid size={14} /> كل المواضيع مع بعض</button>
        </div>
      </div>
      <div style={{ ...S.modeRow, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#5F7280" }}>شكل العرض:</span>
        <div style={{ ...S.seg, flexWrap: "wrap" }} role="group" aria-label="شكل عرض المكتبة">
          <button style={S.segBtn(layout === "docs")} onClick={() => saveLayout("docs")} aria-pressed={layout === "docs"}><List size={14} /> {LAYOUT_LABEL.docs}</button>
          <button style={S.segBtn(layout === "adaptive")} onClick={() => saveLayout("adaptive")} aria-pressed={layout === "adaptive"}><LayoutDashboard size={14} /> {LAYOUT_LABEL.adaptive}</button>
          <button style={S.segBtn(layout === "folders")} onClick={() => saveLayout("folders")} aria-pressed={layout === "folders"}><Folder size={14} /> {LAYOUT_LABEL.folders}</button>
        </div>
      </div>
      {!layoutOk && <p style={{ ...S.err, margin: "0 0 12px" }}>شكل العرض ما يشتغل لين تشغّل <b dir="ltr">migration-gallery-layout.sql</b> مرة وحدة بـ SQL Editor. الموقع يعرض الآن الشكل الافتراضي «زي المستندات».</p>}
      <button style={{ ...S.btn, ...S.pri }} onClick={addTopic}><Plus size={16} /> إضافة موضوع جديد</button>
      <p style={{ fontSize: 13, color: "#5F7280", marginTop: 10 }}>
        كل موضوع يجمع صورًا ومقاطع وملفات PDF. رتّب المواضيع والعناصر بالأسهم، وأضف بالرفع المباشر (صور، PDF، فيديو حتى 50MB) أو بلصق رابط: يوتيوب وVimeo يُشغَّلان داخل الموقع، وDrive وأي رابط ملف أو صورة يُعرض كذلك.
      </p>

      {topics.map((t, i) => {
        const isOpen = !!open[t.id];
        return (
          <div key={t.id} style={S.topic}>
            <div style={{ ...S.thead, opacity: t.published ? 1 : 0.55 }}>
              <GripVertical size={16} color="#5F7280" />
              <input style={S.tt} value={t.title_ar || ""} placeholder="اكتب عنوان الموضوع"
                onChange={(e) => renameTopic(t.id, e.target.value)} onBlur={(e) => saveTopicTitle(t.id, e.target.value)} />
              <span style={{ display: "flex", gap: 2, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#5F7280", marginInlineEnd: 6 }}>{t.items.length} عنصر</span>
                <button style={S.ib(false)} disabled={i === 0} onClick={() => moveTopic(i, -1)} title="تحريك للأعلى"><ChevronUp size={16} /></button>
                <button style={S.ib(false)} disabled={i === topics.length - 1} onClick={() => moveTopic(i, 1)} title="تحريك للأسفل"><ChevronDown size={16} /></button>
                <button style={S.ib(false)} onClick={() => setOpen((o) => ({ ...o, [t.id]: !isOpen }))} title={isOpen ? "طي" : "فتح"}>
                  <Chevron size={16} style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                </button>
                <button style={S.ib(false)} onClick={() => toggleTopicPub(t)} title={t.published ? "إخفاء عن الملاك" : "إظهار للملاك"}>
                  {t.published ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button style={S.ib(true)} onClick={() => setConfirmDel({ type: "topic", t })} title="حذف الموضوع"><Trash2 size={15} /></button>
              </span>
            </div>

            {isOpen && (
              <div style={S.body}>
                <div style={S.tools}>
                  <button style={S.btn} onClick={() => fileRefs.current[t.id]?.click()}><ImagePlus size={15} /> إضافة صور</button>
                  <input ref={(el) => (fileRefs.current[t.id] = el)} type="file" accept="image/*" multiple hidden
                    onChange={(e) => { onPickFiles(t, e.target.files); e.target.value = ""; }} />
                  <button style={S.btn} onClick={() => docRefs.current[t.id]?.click()}><FilePlus size={15} /> PDF أو فيديو</button>
                  <input ref={(el) => (docRefs.current[t.id] = el)} type="file" accept={ACCEPT_DOCS} multiple hidden
                    onChange={(e) => { const fl = [...e.target.files]; e.target.value = ""; onPickDocs(t, fl); }} />
                  <div style={{ flexBasis: "100%", minWidth: 0 }}>
                    <LinkField T={GT} placeholder="الصق رابط يوتيوب أو Drive أو Vimeo أو صورة أو ملف PDF" allow={["image", "video", "pdf", "office"]}
                      onAdd={(c, kind) => onAddLink(t, c, kind)} />
                  </div>
                </div>
                <ol style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
                  {t.items.map((it, j) => (
                    <li key={it.id} style={S.irow}>
                      <GripVertical size={14} color="#8FA0AB" style={{ opacity: 0.5 }} />
                      <span style={{ ...S.ithumb, position: "relative" }}>
                        <KindIcon kind={it.kind} size={16} />
                        {toView(it, supabase, "gallery").thumb && (
                          <img src={toView(it, supabase, "gallery").thumb} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <input style={S.it} defaultValue={it.title_ar || ""} placeholder="عنوان اختياري"
                          onBlur={(e) => saveItemTitle(it.id, e.target.value)} />
                        <div style={{ fontSize: 11.5, color: "#8FA0AB", direction: "ltr", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.youtube_id ? `youtu.be/${it.youtube_id}` : attMetaLine(toView(it, supabase, "gallery"))}
                        </div>
                      </span>
                      <span style={{ display: "flex" }}>
                        <button style={S.ib(false)} disabled={j === 0} onClick={() => moveItem(t, j, -1)}><ChevronUp size={14} /></button>
                        <button style={S.ib(false)} disabled={j === t.items.length - 1} onClick={() => moveItem(t, j, 1)}><ChevronDown size={14} /></button>
                        <button style={S.ib(false)} onClick={() => toggleItemPub(t, it)}>{it.published ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                        <button style={S.ib(true)} onClick={() => setConfirmDel({ type: "item", t, it })}><Trash2 size={13} /></button>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,28,34,.4)", display: "grid", placeItems: "center", zIndex: 40 }} onClick={() => setConfirmDel(null)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 14px" }}>
              {confirmDel.type === "topic" ? `حذف الموضوع "${confirmDel.t.title_ar || "بدون عنوان"}" وكل ما فيه (${confirmDel.t.items.length} عنصر)؟` : "حذف هذا العنصر؟"}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={S.btn} onClick={() => setConfirmDel(null)}>تراجع</button>
              <button style={{ ...S.btn, background: "#A8443C", borderColor: "#A8443C", color: "#fff" }}
                onClick={() => (confirmDel.type === "topic" ? doDeleteTopic(confirmDel.t) : doDeleteItem(confirmDel.t, confirmDel.it))}>
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   الموقع العام — GallerySection
   props: supabase, T (طقم الألوان الحالي), L (مترجم ar/en), lang

   ثلاثة أشكال عرض، الإدارة تختار منها (site_settings.gallery_layout):
     docs      زي المستندات — صف لكل ملف بنفس بطاقة تبويب «المخططات والمستندات» (الافتراضي)
     adaptive  حسب نوع الملف — صفوف للتقارير، شبكة للصور، بطاقات عريضة للفيديو
     folders   مجلدات — كل موضوع ينفتح وينقفل
   العارض واحد للثلاثة: AttachmentViewer من attach-kit.jsx (يتنقّل بين عناصر نفس الموضوع).
   ═══════════════════════════════════════════════════════════ */
const GLX_CSS = `
.glx-sec{margin-bottom:30px;}
.glx-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 4px;margin-bottom:12px;}
.glx-head h2{margin:0;font-size:18px;line-height:1.5;}
.glx-count{font-size:12px;color:var(--gx-muted);white-space:nowrap;}
.glx-stack{display:flex;flex-direction:column;gap:18px;}
.glx-photos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}
@media(min-width:640px){.glx-photos{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}}
.glx-photo{position:relative;display:block;width:100%;aspect-ratio:1/1;margin:0;padding:0;overflow:hidden;cursor:pointer;
  border:1px solid var(--gx-line);border-radius:12px;background:var(--gx-sunken);transition:border-color .18s,transform .18s;}
.glx-photo:hover{border-color:var(--gx-accent);}
.glx-photo:active{transform:scale(.98);}
.glx-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--gx-faint);}
.glx-photo img,.glx-vid-m img,.glx-rt img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
.glx-vids{display:grid;grid-template-columns:1fr;gap:12px;}
@media(min-width:640px){.glx-vids{grid-template-columns:repeat(2,minmax(0,1fr));}}
.glx-vid{display:flex;flex-direction:column;width:100%;margin:0;padding:0;overflow:hidden;text-align:start;cursor:pointer;font:inherit;
  color:var(--gx-paper);background:var(--gx-surface);border:1px solid var(--gx-line);border-radius:20px;transition:border-color .18s,transform .18s;}
.glx-vid:hover{border-color:var(--gx-accent);}
.glx-vid:active{transform:scale(.985);}
.glx-vid-m{position:relative;display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;overflow:hidden;background:var(--gx-sunken);}
.glx-play{position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;border-radius:50%;
  background:rgba(255,255,255,.94);color:#0E1211;box-shadow:0 6px 18px rgba(0,0,0,.3);}
.glx-play svg{transform:translateX(1.5px);}
.glx-tag{position:absolute;bottom:10px;inset-inline-start:10px;padding:3px 8px;border-radius:7px;background:rgba(10,13,12,.74);color:#fff;
  font-size:10.5px;font-weight:600;line-height:1.6;direction:ltr;unicode-bidi:isolate;}
.glx-vid-c{display:flex;flex-direction:column;gap:3px;padding:12px 14px 14px;}
.glx-vid-t{font-size:14.5px;font-weight:600;line-height:1.45;}
.glx-vid-s{font-size:11.5px;color:var(--gx-muted);}
.glx-fold{margin-bottom:10px;overflow:hidden;border-radius:22px;background:var(--gx-surface);border:1px solid var(--gx-line);}
.glx-fh{display:flex;align-items:center;gap:12px;width:100%;margin:0;padding:14px;border:0;background:transparent;text-align:start;
  color:var(--gx-paper);cursor:pointer;font:inherit;}
.glx-fi{width:46px;height:46px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:14px;
  background:color-mix(in srgb,var(--gx-accent) 14%,transparent);color:var(--gx-accent);}
.glx-ft{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
.glx-ft b{font-size:15px;font-weight:600;line-height:1.45;}
.glx-ft span{font-size:12px;color:var(--gx-muted);}
.glx-chev{flex:none;display:flex;color:var(--gx-muted);transition:transform .2s ease;}
.glx-fold.open .glx-chev{transform:rotate(180deg);}
.glx-fb{padding:0 10px 10px;}
.glx-list{display:flex;flex-direction:column;gap:1px;overflow:hidden;border-radius:14px;background:var(--gx-line);}
.glx-row{display:flex;align-items:center;gap:11px;width:100%;min-height:56px;margin:0;padding:9px 10px;border:0;text-align:start;cursor:pointer;font:inherit;
  color:var(--gx-paper);background:color-mix(in srgb,var(--gx-paper) 4%,var(--gx-surface));}
.glx-row:hover{background:color-mix(in srgb,var(--gx-accent) 9%,var(--gx-surface));}
.glx-rt{position:relative;width:36px;height:36px;flex:none;box-sizing:border-box;overflow:hidden;display:flex;align-items:center;justify-content:center;
  border-radius:10px;background:var(--gx-sunken);border:1px solid var(--gx-line);color:var(--gx-accent);}
.glx-rn{flex:1;min-width:0;font-size:14px;font-weight:500;line-height:1.45;}
.glx-rb{flex:none;font-size:10.5px;font-weight:600;color:var(--gx-muted);direction:ltr;unicode-bidi:isolate;}
.glx-rg{flex:none;display:flex;color:var(--gx-faint);}
.glx-photo:focus-visible,.glx-vid:focus-visible,.glx-fh:focus-visible,.glx-row:focus-visible{outline:2px solid var(--gx-accent);outline-offset:2px;}
@media(prefers-reduced-motion:reduce){.glx-chev,.glx-photo,.glx-vid{transition:none;}}
`;
function ensureGlxCss() {
  if (typeof document === "undefined" || document.getElementById("glx-css")) return;
  const el = document.createElement("style"); el.id = "glx-css"; el.textContent = GLX_CSS; document.head.appendChild(el);
}
ensureGlxCss();

const hideBroken = (e) => { e.currentTarget.style.display = "none"; };
const isMediaKind = (a) => a.kind === "image" || a.kind === "video";
const chipOf = (a, lang) => (a.kind === "pdf" ? "PDF" : badgeText(a, lang));
const countText = (n, lang) => (lang === "en"
  ? `${n} ${n === 1 ? "item" : "items"}`
  : n === 1 ? "عنصر واحد" : n === 2 ? "عنصران" : n <= 10 ? `${n} عناصر` : `${n} عنصرًا`);

/* صف بنفس بطاقة «المخططات والمستندات» (doc-card) — فيرث شكل التصميم المعتمد (كلاسيكي/نوفا/بنّاء) تلقائيًا */
function DocRow({ a, T, lang, onOpen }) {
  const title = attTitle(a, lang), src = sourceLabel(a, lang);
  const Go = lang === "en" ? ChevronRight : ChevronLeft;
  const media = isMediaKind(a);
  const tile = a.kind === "pdf" ? "PDF" : a.kind === "office" || a.kind === "file" ? String(a.ext || "").toUpperCase() : "";
  const meta = media ? badgeText(a, lang) : `${badgeText(a, lang)}${title.includes(src) ? "" : ` · ${src}`}`;
  return (
    <button type="button" className="doc-card" onClick={onOpen}>
      <span className="doc-thumb" style={{ borderColor: T.brass + "55", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: T.brass }}>
        <KindIcon kind={a.kind} size={22} />
        {tile && <span dir="ltr" style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>{tile}</span>}
        {media && a.thumb && <img src={a.thumb} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0 }} onError={hideBroken} />}
        {a.kind === "video" && a.thumb && <span className="doc-vbadge" aria-hidden="true"><Play size={9} fill="currentColor" strokeWidth={0} /></span>}
      </span>
      <span className="doc-info">
        <span className="doc-name">{title}</span>
        <span className="doc-meta" style={{ color: T.brass }}>{meta}</span>
      </span>
      <span className="doc-go"><Go size={17} /></span>
    </button>
  );
}

/* شكل «حسب نوع الملف»: الملفات صفوف، الصور شبكة، الفيديو بطاقات عريضة */
function AdaptiveBlock({ views, T, lang, open }) {
  const idx = views.map((a, i) => ({ a, i }));
  const docs = idx.filter((x) => !isMediaKind(x.a));
  const photos = idx.filter((x) => x.a.kind === "image");
  const vids = idx.filter((x) => x.a.kind === "video");
  return (
    <div className="glx-stack">
      {docs.length > 0 && (
        <div className="doc-list">{docs.map(({ a, i }) => <DocRow key={a.id} a={a} T={T} lang={lang} onOpen={() => open(i)} />)}</div>
      )}
      {photos.length > 0 && (
        <div className="glx-photos">
          {photos.map(({ a, i }) => (
            <button key={a.id} type="button" className="glx-photo" onClick={() => open(i)} aria-label={attTitle(a, lang)}>
              <span className="glx-ph"><KindIcon kind="image" size={22} /></span>
              {a.thumb && <img src={a.thumb} alt="" loading="lazy" decoding="async" onError={hideBroken} />}
            </button>
          ))}
        </div>
      )}
      {vids.length > 0 && (
        <div className="glx-vids">
          {vids.map(({ a, i }) => {
            const title = attTitle(a, lang), src = sourceLabel(a, lang);
            return (
              <button key={a.id} type="button" className="glx-vid" onClick={() => open(i)}>
                <span className="glx-vid-m">
                  {a.thumb && <img src={a.thumb} alt="" loading="lazy" decoding="async" onError={hideBroken} />}
                  <span className="glx-play"><Play size={20} fill="currentColor" strokeWidth={0} /></span>
                  <span className="glx-tag">{badgeText(a, lang)}</span>
                </span>
                <span className="glx-vid-c">
                  <span className="glx-vid-t">{title}</span>
                  {!title.includes(src) && <span className="glx-vid-s">{src}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* شكل «مجلدات»: صف مضغوط داخل المجلد */
function FolderRows({ views, lang, open }) {
  const Go = lang === "en" ? ChevronRight : ChevronLeft;
  return (
    <div className="glx-list">
      {views.map((a, i) => (
        <button key={a.id} type="button" className="glx-row" onClick={() => open(i)}>
          <span className="glx-rt">
            <KindIcon kind={a.kind} size={17} />
            {isMediaKind(a) && a.thumb && <img src={a.thumb} alt="" loading="lazy" decoding="async" onError={hideBroken} />}
          </span>
          <span className="glx-rn">{attTitle(a, lang)}</span>
          <span className="glx-rb">{chipOf(a, lang)}</span>
          <span className="glx-rg"><Go size={15} /></span>
        </button>
      ))}
    </div>
  );
}

export function GallerySection({ supabase, T, L, lang }) {
  const [topics, setTopics] = useState(null);
  const [mode, setMode] = useState("sections");
  const [layout, setLayout] = useState("docs");
  const [openFold, setOpenFold] = useState({});   /* topicId → مفتوح؟ (الأول مفتوح افتراضيًا) */
  const [view, setView] = useState(null); /* {list, i} */

  useEffect(() => {
    let live = true, seq = 0;
    const items = async () => {
      const r = await supabase.from("media_items").select(MEDIA_PUBLIC_COLS).eq("published", true).order("sort_order");
      /* قبل تشغيل migration-attachments.sql ما فيه الأعمدة الجديدة — نقرأ القديمة */
      return r.error ? supabase.from("media_items").select("*").eq("published", true).order("sort_order") : r;
    };
    const load = async () => {
      const my = ++seq;
      const [{ data: t }, { data: it }, sr] = await Promise.all([
        supabase.from("media_topics").select("id,title_ar,title_en,sort_order").eq("published", true).order("sort_order"),
        items(),
        readGallerySettings(supabase),
      ]);
      if (!live || my !== seq) return;
      const byTopic = {};
      (it || []).forEach((r) => (byTopic[r.topic_id] || (byTopic[r.topic_id] = [])).push(r));
      setTopics((t || []).map((tp) => ({ ...tp, items: byTopic[tp.id] || [] })).filter((tp) => tp.items.length));
      if (sr.data?.gallery_mode) setMode(sr.data.gallery_mode);
      setLayout(sr.data?.gallery_layout || "docs");
    };
    load();
    /* media_rev = تغيّر المحتوى، site_settings = تغيّر شكل العرض أو طريقته من الإدارة (يوصل لكل الزوّار لحظيًا) */
    const ch = supabase.channel("public-gallery-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "media_rev" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, load)
      .subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, [supabase]);

  if (!topics) return null;
  if (!topics.length) return <p style={{ color: T.muted, textAlign: "center", padding: 40 }}>{L("ما فيه صور أو مقاطع بعد.", "No photos or videos yet.")}</p>;

  const lay = LAYOUTS.includes(layout) ? layout : "docs";
  const sections = mode === "merged" ? [{ id: 0, title_ar: null, items: topics.flatMap((t) => t.items) }] : topics;
  const vars = { "--gx-surface": T.surface, "--gx-sunken": T.sunken, "--gx-line": T.line, "--gx-paper": T.paper, "--gx-muted": T.muted, "--gx-faint": T.faint, "--gx-accent": T.brass };
  return (
    <div className="glx" style={vars}>
      {sections.map((sec, si) => {
        const views = sec.items.map((it) => toView(it, supabase, "gallery"));
        const title = lang === "en" ? sec.title_en || sec.title_ar : sec.title_ar;
        const open = (i) => setView({ list: views, i });

        if (lay === "folders" && title) {
          const isOpen = openFold[sec.id] ?? si === 0;
          return (
            <section key={sec.id} className={`glx-fold${isOpen ? " open" : ""}`}>
              <button type="button" className="glx-fh" aria-expanded={isOpen} onClick={() => setOpenFold((o) => ({ ...o, [sec.id]: !isOpen }))}>
                <span className="glx-fi"><Folder size={22} /></span>
                <span className="glx-ft"><b>{title}</b><span>{countText(views.length, lang)}</span></span>
                <span className="glx-chev"><ChevronDown size={18} /></span>
              </button>
              {isOpen && <div className="glx-fb"><FolderRows views={views} lang={lang} open={open} /></div>}
            </section>
          );
        }

        return (
          <section key={sec.id} className="glx-sec">
            {title && (
              <div className="glx-head">
                <h2 className="sec-t">{title}</h2>
                <span className="glx-count">{countText(views.length, lang)}</span>
              </div>
            )}
            {lay === "folders" ? <FolderRows views={views} lang={lang} open={open} />
              : lay === "adaptive" ? <AdaptiveBlock views={views} T={T} lang={lang} open={open} />
              : <div className="doc-list">{views.map((a, i) => <DocRow key={a.id} a={a} T={T} lang={lang} onOpen={() => open(i)} />)}</div>}
          </section>
        );
      })}
      {view && <AttachmentViewer list={view.list} index={view.i} onIndex={(i) => setView((v) => (v ? { ...v, i } : v))} onClose={() => setView(null)} lang={lang} />}
    </div>
  );
}
