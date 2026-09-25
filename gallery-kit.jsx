/* ═══════════════════════════════════════════════════════════
   gallery-kit.jsx — معرض الموقع (صور ومقاطع)، طبقة مستقلة عن Dashboard.jsx.

   الفكرة: نفس مبدأ youtube-kit.js/design-nova.jsx — ملف قائم بذاته يُستورد
   بسطرين بدون ما يلمس منطق باقي الموقع. جدولان بقاعدة البيانات:
     media_topics  — المواضيع (كل موضوع = قسم بالعرض العام)
     media_items   — العناصر داخل كل موضوع: صورة مرفوعة، صورة برابط خارجي،
                     أو مقطع يوتيوب (نفس منطق youtube-kit للتشغيل بضغطة وحدة)

   الصلاحية المستخدمة: manage_media (نفس صلاحية "مقاطع النماذج" الموجودة).
   شغّل migration-gallery.sql مرة وحدة قبل الاستخدام.
   ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ImagePlus, Link2, GripVertical, ChevronUp, ChevronDown, ChevronDown as Chevron,
  Eye, EyeOff, Trash2, Plus, X, Play, ExternalLink, Rows, LayoutGrid,
} from "lucide-react";
import { parseYouTube, isYouTubeId, ytThumb, loadYouTubeApi, createYtPlayer, warmYouTube, ytErrorText } from "./youtube-kit.js";
import { autoTranslateAr } from "./translate-kit.js";

/* ── أدوات مشتركة ───────────────────────────────────────── */
const BIDI_RE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const clean = (s) => String(s || "").replace(BIDI_RE, "").trim();

function cleanImageLink(raw) {
  const s = clean(raw);
  if (!/^https?:\/\//i.test(s)) return null;
  let u; try { u = new URL(s); } catch (_) { return null; }
  const h = u.hostname.replace(/^www\./, "");
  if (h === "imgur.com") {
    const m = u.pathname.match(/^\/([a-zA-Z0-9]{5,7})$/);
    if (m) return { url: `https://i.imgur.com/${m[1]}.jpg`, direct: true };
  }
  u.search = ""; u.hash = "";
  const direct = /\.(jpe?g|png|webp|gif|avif)$/i.test(u.pathname);
  return { url: u.toString(), direct };
}

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

/* ═══════════════════════════════════════════════════════════
   لوحة الإدارة — AGalleryTab
   ═══════════════════════════════════════════════════════════ */
export function AGalleryTab({ supabase, flashToast, log, canManage }) {
  const [topics, setTopics] = useState(null);      /* [{...topic, items:[...]}]  */
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState({});             /* topicId → موسّع؟ */
  const [confirmDel, setConfirmDel] = useState(null); /* {type:'topic'|'item', id, label} */
  const [mode, setMode] = useState("sections");
  const fileRefs = useRef({});

  const load = useCallback(async () => {
    const [{ data: t }, { data: it }, { data: s }] = await Promise.all([
      supabase.from("media_topics").select("*").order("sort_order").order("id"),
      supabase.from("media_items").select("*").order("sort_order").order("id"),
      supabase.from("site_settings").select("gallery_mode").maybeSingle(),
    ]);
    const byTopic = {};
    (it || []).forEach((r) => (byTopic[r.topic_id] || (byTopic[r.topic_id] = [])).push(r));
    setTopics((t || []).map((tp) => ({ ...tp, items: byTopic[tp.id] || [] })));
    if (s?.gallery_mode) setMode(s.gallery_mode);
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
    (t.items || []).filter((x) => x.storage_path).forEach((x) => supabase.storage.from("gallery").remove([x.storage_path]));
    await supabase.from("media_topics").delete().eq("id", t.id);
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

  const onAddLink = async (t, raw, errSetter) => {
    if (!raw.trim()) { errSetter("الصق رابط أول."); return; }
    const yid = isYouTubeId(clean(raw)) ? clean(raw) : (parseYouTube(raw)?.id || null);
    const sort_order = (t.items.length ? Math.max(...t.items.map((r) => r.sort_order)) : -1) + 1;
    if (yid) {
      const { data, error } = await supabase.from("media_items")
        .insert({ topic_id: t.id, kind: "video", source: "link", youtube_id: yid, sort_order }).select().single();
      if (error) { errSetter("تعذّر إضافة المقطع."); return; }
      errSetter(""); addItems(t, [data]); log("إضافة مقطع للمعرض", `youtu.be/${yid}`); return;
    }
    const im = cleanImageLink(raw);
    if (!im) { errSetter("ما قدرت أفهم هذا الرابط. لازم يبدأ بـ https:// أو يكون رابط يوتيوب."); return; }
    const { data, error } = await supabase.from("media_items")
      .insert({ topic_id: t.id, kind: "image", source: "link", external_url: im.url, sort_order }).select().single();
    if (error) { errSetter("تعذّر إضافة الرابط."); return; }
    errSetter(""); addItems(t, [data]);
    if (!im.direct) flashToast("انضاف الرابط — تأكد إنه يفتح صورة مباشرة عند الملاك");
    log("إضافة رابط صورة للمعرض", im.url);
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
    if (it.storage_path) supabase.storage.from("gallery").remove([it.storage_path, it._thumbPath].filter(Boolean));
    await supabase.from("media_items").delete().eq("id", it.id);
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
      <button style={{ ...S.btn, ...S.pri }} onClick={addTopic}><Plus size={16} /> إضافة موضوع جديد</button>
      <p style={{ fontSize: 13, color: "#5F7280", marginTop: 10 }}>
        كل موضوع يجمع أكثر من صورة وأكثر من مقطع. رتّب المواضيع والعناصر بالأسهم، وأضف بالرفع المباشر أو بلصق رابط (يوتيوب يصير مقطع، أي رابط صورة ثاني ينضاف كرابط خارجي).
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
                  <LinkAdder t={t} onAdd={onAddLink} S={S} />
                </div>
                <ol style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
                  {t.items.map((it, j) => (
                    <li key={it.id} style={S.irow}>
                      <GripVertical size={14} color="#8FA0AB" style={{ opacity: 0.5 }} />
                      <span style={S.ithumb}>
                        {it.kind === "video" ? <Play size={16} /> : it.source === "link" ? <Link2 size={16} /> :
                          <img src={supabase.storage.from("gallery").getPublicUrl(it._thumbPath || it.storage_path).data.publicUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <input style={S.it} defaultValue={it.title_ar || ""} placeholder="عنوان اختياري"
                          onBlur={(e) => saveItemTitle(it.id, e.target.value)} />
                        <div style={{ fontSize: 11.5, color: "#8FA0AB", direction: "ltr", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.kind === "video" ? `youtu.be/${it.youtube_id}` : it.source === "upload" ? "رفع" : it.external_url}
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

function LinkAdder({ t, onAdd, S }) {
  const [val, setVal] = useState(""); const [err, setErr] = useState("");
  const submit = () => onAdd(t, val, (m) => { setErr(m); if (!m) setVal(""); });
  return (
    <>
      <input style={S.link} value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="الصق رابط يوتيوب أو رابط صورة" />
      <button style={{ ...S.btn, ...S.pri }} onClick={submit}>إضافة</button>
      {err && <p style={{ ...S.err, flexBasis: "100%" }}>{err}</p>}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   الموقع العام — GallerySection
   props: supabase, T (طقم الألوان الحالي), L (مترجم ar/en), lang
   ═══════════════════════════════════════════════════════════ */
export function GallerySection({ supabase, T, L, lang }) {
  const [topics, setTopics] = useState(null);
  const [mode, setMode] = useState("sections");
  const [lb, setLb] = useState(null); /* {list, i} */

  useEffect(() => {
    let live = true;
    (async () => {
      const [{ data: t }, { data: it }, { data: s }] = await Promise.all([
        supabase.from("media_topics").select("*").eq("published", true).order("sort_order"),
        supabase.from("media_items").select("*").eq("published", true).order("sort_order"),
        supabase.from("site_settings").select("gallery_mode").maybeSingle(),
      ]);
      if (!live) return;
      const byTopic = {};
      (it || []).forEach((r) => (byTopic[r.topic_id] || (byTopic[r.topic_id] = [])).push(r));
      setTopics((t || []).map((tp) => ({ ...tp, items: byTopic[tp.id] || [] })).filter((tp) => tp.items.length));
      if (s?.gallery_mode) setMode(s.gallery_mode);
    })();
    return () => { live = false; };
  }, [supabase]);

  if (!topics) return null;
  if (!topics.length) return <p style={{ color: T.muted, textAlign: "center", padding: 40 }}>{L("ما فيه صور أو مقاطع بعد.", "No photos or videos yet.")}</p>;

  const thumbUrl = (it) => it.kind === "video" ? ytThumb(it.youtube_id) : it.source === "upload"
    ? supabase.storage.from("gallery").getPublicUrl(it.storage_path.replace(/\.webp$/, "_thumb.webp")).data.publicUrl
    : it.external_url;
  const fullUrl = (it) => it.source === "upload" ? supabase.storage.from("gallery").getPublicUrl(it.storage_path).data.publicUrl : it.external_url;

  const openLb = (list, it) => setLb({ list, i: list.findIndex((x) => x.id === it.id) });

  const sections = mode === "merged" ? [{ id: 0, title_ar: null, items: topics.flatMap((t) => t.items) }] : topics;

  const cardS = { display: "block", width: "100%", padding: 0, textAlign: "start", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden", cursor: "pointer" };
  const mediaS = { display: "block", position: "relative", aspectRatio: "4/3", background: T.paper };

  return (
    <div>
      {sections.map((sec) => (
        <section key={sec.id} style={{ marginBottom: 34 }}>
          {sec.title_ar && <h2 style={{ font: "600 clamp(20px,4vw,26px)/1.3 inherit", margin: "0 0 14px", paddingBottom: 6, borderBottom: `2px solid ${T.brass}`, display: "inline-block", color: T.paper }}>{sec.title_ar}</h2>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
            {sec.items.map((it) => (
              <button key={it.id} style={cardS} onClick={() => openLb(sec.items, it)}>
                <span style={mediaS}>
                  <img src={thumbUrl(it)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  {it.kind === "video" && (
                    <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff" }}>
                      <span style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center" }}><Play size={20} /></span>
                    </span>
                  )}
                </span>
                {it.title_ar && <span style={{ display: "block", padding: "9px 11px", fontSize: 13.5, color: T.paper }}>{it.title_ar}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
      {lb && <Lightbox list={lb.list} i={lb.i} setI={(i) => setLb((s) => ({ ...s, i }))} onClose={() => setLb(null)} fullUrl={fullUrl} L={L} />}
    </div>
  );
}

function Lightbox({ list, i, setI, onClose, fullUrl, L }) {
  const it = list[i];
  const hostRef = useRef(null);
  useEffect(() => {
    if (it.kind !== "video") return;
    let player = null, alive = true;
    warmYouTube();
    loadYouTubeApi().then((YT) => {
      if (!alive || !hostRef.current) return;
      player = createYtPlayer(YT, hostRef.current, { id: it.youtube_id, autoplay: true, lang: "ar", title: it.title_ar });
    });
    return () => { alive = false; try { player?.destroy?.(); } catch (_) {} };
  }, [it.id]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowLeft") setI((i + 1) % list.length); else if (e.key === "ArrowRight") setI((i - 1 + list.length) % list.length); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [i, list.length]);

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,13,17,.95)", display: "grid", gridTemplateRows: "1fr auto", padding: "60px 12px 8px" }}>
      <button onClick={onClose} aria-label="إغلاق" style={{ position: "absolute", top: 12, insetInlineStart: 12, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.1)", border: 0, color: "#fff", cursor: "pointer" }}><X size={20} /></button>
      {list.length > 1 && <>
        <button onClick={() => setI((i + 1) % list.length)} aria-label="السابق" style={{ position: "absolute", top: "50%", insetInlineStart: 12, transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.1)", border: 0, color: "#fff", cursor: "pointer" }}>‹</button>
        <button onClick={() => setI((i - 1 + list.length) % list.length)} aria-label="التالي" style={{ position: "absolute", top: "50%", insetInlineEnd: 12, transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.1)", border: 0, color: "#fff", cursor: "pointer" }}>›</button>
      </>}
      <div style={{ minHeight: 0, display: "grid", placeItems: "center" }}>
        {it.kind === "video"
          ? <div ref={hostRef} style={{ width: "min(100%,900px)", aspectRatio: "16/9", background: "#000", borderRadius: 8 }} />
          : <img src={fullUrl(it)} alt={it.title_ar || ""} style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 180px)", objectFit: "contain", borderRadius: 6 }} />}
      </div>
      <p style={{ textAlign: "center", padding: "12px 56px", margin: 0, color: "#fff" }}>
        {it.title_ar || L("بدون عنوان", "Untitled")} <span style={{ color: "#9FB0BA", fontSize: 13 }}>— {i + 1} / {list.length}</span>
      </p>
    </div>
  );
}
