/* ═══════════════════════════════════════════════════════════
   admin-links-tab.jsx — إدارة الروابط الخارجية («مساهمات الملاك»)
   إضافة / تعديل / حذف / ترتيب / نشر وإخفاء، وتحديد الأماكن اللي يظهر فيها كل رابط.
   الصلاحية: manage_links — الجدول: external_links (migration-external-links.sql)
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { autoTranslateAr } from "./translate-kit.js";
import { DEFAULT_DISCLAIMER_AR, LINK_PLACEMENTS, hostOf, safeUrl } from "./links-kit.jsx";

const S = {
  wrap: { maxWidth: 760, margin: "0 auto", padding: "4px 0" },
  card: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 12, marginBottom: 10, color: "#1F2C35" },
  row: { display: "flex", alignItems: "center", gap: 8 },
  btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "8px 14px", fontWeight: 500, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", font: "inherit", fontSize: 13 },
  pri: { background: "#1B7F8E", borderColor: "#1B7F8E", color: "#fff" },
  ib: (danger) => ({ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, background: "none", borderRadius: 8, color: danger ? "#A8443C" : "#5F7280", cursor: "pointer" }),
  lab: { display: "block", fontSize: 12, fontWeight: 600, color: "#5F7280", margin: "12px 0 5px" },
  inp: { width: "100%", boxSizing: "border-box", border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 14, color: "#1F2C35" },
  chip: (c) => ({ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: c + "1A", color: c, whiteSpace: "nowrap" }),
  hint: { fontSize: 11.5, color: "#5F7280", margin: "4px 0 0", lineHeight: 1.7 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 },
};

const BLANK = {
  title_ar: "", title_en: "", desc_ar: "", desc_en: "", author_ar: "إعداد أحد الملاك", author_en: "Prepared by one of the owners",
  disclaimer_ar: "", disclaimer_en: "", url: "", placements: ["gallery"], folder_ar: "مساهمات الملاك", folder_en: "Owner Contributions",
};
const FIELDS = ["title_ar", "title_en", "desc_ar", "desc_en", "author_ar", "author_en", "disclaimer_ar", "disclaimer_en", "url", "placements", "folder_ar", "folder_en"];
const nz = (v) => { const t = typeof v === "string" ? v.trim() : v; return t === "" ? null : t; };

function Field({ label, hint, children }) {
  return (<div><label style={S.lab}>{label}</label>{children}{hint && <p style={S.hint}>{hint}</p>}</div>);
}

function LinkEditor({ row, isNew, onSave, onCancel, supabase }) {
  const [d, setD] = useState(() => ({ ...BLANK, ...Object.fromEntries(FIELDS.map((k) => [k, row?.[k] ?? BLANK[k] ?? ""])) }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const togglePl = (k) => set("placements", d.placements.includes(k) ? d.placements.filter((x) => x !== k) : [...d.placements, k]);
  const href = safeUrl(d.url);

  /* الترجمة التلقائية لحقل إنجليزي فاضي عند مغادرة الحقل العربي (لا تمسح إنجليزي مكتوب يدويًا) */
  const tr = (ar, en) => async () => { if (d[ar].trim() && !d[en].trim()) { const t = await autoTranslateAr(supabase, d[ar]); if (t) setD((x) => (x[en].trim() ? x : { ...x, [en]: t })); } };

  const save = async () => {
    if (!d.title_ar.trim()) return setErr("اكتب عنوان الرابط.");
    if (!href) return setErr("الرابط لازم يبدأ بـ https:// ويكون صحيحًا.");
    if (!d.placements.length) return setErr("اختر مكانًا واحدًا على الأقل يظهر فيه الرابط.");
    if (!d.folder_ar.trim()) return setErr("اسم المجلد مطلوب.");
    setErr(""); setBusy(true);
    const payload = {
      title_ar: d.title_ar.trim(), title_en: nz(d.title_en), desc_ar: nz(d.desc_ar), desc_en: nz(d.desc_en),
      author_ar: nz(d.author_ar), author_en: nz(d.author_en), disclaimer_ar: nz(d.disclaimer_ar), disclaimer_en: nz(d.disclaimer_en),
      url: href, placements: d.placements, folder_ar: d.folder_ar.trim(), folder_en: nz(d.folder_en) || d.folder_ar.trim(),
    };
    const e = await onSave(payload);
    setBusy(false);
    if (e) setErr(e);
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 6, borderTop: "1px solid #EEF2F4" }}>
      <Field label="عنوان الرابط (عربي)">
        <input style={S.inp} value={d.title_ar} onChange={(e) => set("title_ar", e.target.value)} onBlur={tr("title_ar", "title_en")} maxLength={140} placeholder="مثال: ملخص التقارير الشهرية" />
      </Field>
      <Field label="Title (English)" hint="يُترجم تلقائيًا إذا تركته فاضي.">
        <input style={{ ...S.inp, direction: "ltr" }} value={d.title_en} onChange={(e) => set("title_en", e.target.value)} maxLength={140} />
      </Field>
      <Field label="الرابط (https)">
        <input style={{ ...S.inp, direction: "ltr" }} value={d.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" inputMode="url" />
        {d.url && (href
          ? <p style={S.hint}>الموقع اللي بيظهر بشاشة التنبيه: <b dir="ltr">{hostOf(href)}</b></p>
          : <p style={{ ...S.hint, color: "#A8443C" }}>رابط غير صحيح — لازم يبدأ بـ https://</p>)}
      </Field>
      <div style={S.grid2}>
        <Field label="صاحب الجهد (عربي)"><input style={S.inp} value={d.author_ar} onChange={(e) => set("author_ar", e.target.value)} onBlur={tr("author_ar", "author_en")} maxLength={120} placeholder="إعداد أحد الملاك" /></Field>
        <Field label="Author (English)"><input style={{ ...S.inp, direction: "ltr" }} value={d.author_en} onChange={(e) => set("author_en", e.target.value)} maxLength={120} /></Field>
      </div>
      <Field label="وصف مختصر (اختياري)" hint="يظهر بالبطاقة وبنافذة الإشعارات.">
        <textarea style={{ ...S.inp, minHeight: 66, resize: "vertical" }} value={d.desc_ar} onChange={(e) => set("desc_ar", e.target.value)} onBlur={tr("desc_ar", "desc_en")} maxLength={400} />
      </Field>
      <Field label="Short description (English)">
        <textarea style={{ ...S.inp, minHeight: 56, resize: "vertical", direction: "ltr" }} value={d.desc_en} onChange={(e) => set("desc_en", e.target.value)} maxLength={400} />
      </Field>
      <Field label="نص التنبيه بشاشة المغادرة (اختياري)" hint={`إذا تركته فاضي يظهر النص الافتراضي: «${DEFAULT_DISCLAIMER_AR}»`}>
        <textarea style={{ ...S.inp, minHeight: 66, resize: "vertical" }} value={d.disclaimer_ar} onChange={(e) => set("disclaimer_ar", e.target.value)} onBlur={tr("disclaimer_ar", "disclaimer_en")} maxLength={500} />
      </Field>
      <Field label="Leave-screen notice (English, optional)">
        <textarea style={{ ...S.inp, minHeight: 56, resize: "vertical", direction: "ltr" }} value={d.disclaimer_en} onChange={(e) => set("disclaimer_en", e.target.value)} maxLength={500} />
      </Field>

      <label style={S.lab}>وين يظهر الرابط؟ (تقدر تختار أكثر من مكان)</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {LINK_PLACEMENTS.map((p) => (
          <label key={p.key} style={{ ...S.row, padding: "9px 12px", border: "1px solid " + (d.placements.includes(p.key) ? "#1B7F8E" : "#E1E8EC"), background: d.placements.includes(p.key) ? "#1B7F8E12" : "#fff", borderRadius: 10, cursor: "pointer", fontSize: 13.5 }}>
            <input type="checkbox" checked={d.placements.includes(p.key)} onChange={() => togglePl(p.key)} style={{ width: 18, height: 18, accentColor: "#1B7F8E" }} />
            {p.ar}
          </label>
        ))}
      </div>
      {d.placements.includes("gallery") && (
        <div style={S.grid2}>
          <Field label="اسم المجلد بالمعرض (عربي)" hint="الروابط اللي لها نفس الاسم تتجمّع بمجلد واحد.">
            <input style={S.inp} value={d.folder_ar} onChange={(e) => set("folder_ar", e.target.value)} onBlur={tr("folder_ar", "folder_en")} maxLength={80} />
          </Field>
          <Field label="Folder name (English)"><input style={{ ...S.inp, direction: "ltr" }} value={d.folder_en} onChange={(e) => set("folder_en", e.target.value)} maxLength={80} /></Field>
        </div>
      )}

      {err && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#A8443C" }}>{err}</p>}
      <div style={{ ...S.row, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" style={{ ...S.btn, ...S.pri }} onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ…" : isNew ? "إضافة الرابط" : "حفظ التعديلات"}</button>
        <button type="button" style={S.btn} onClick={onCancel} disabled={busy}>إلغاء</button>
      </div>
    </div>
  );
}

export function ALinksTab({ supabase, flashToast, log, canManage }) {
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(null);   // id | "new"
  const [confirmDel, setConfirmDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("external_links").select("*").order("sort_order").order("id");
    if (error) { setMissing(true); setRows([]); return; }
    setMissing(false); setRows(data || []);
  };
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!canManage) return <p style={{ color: "#5F7280", textAlign: "center", padding: 30 }}>ما عندك صلاحية إدارة الروابط الخارجية.</p>;
  if (!rows) return <p style={{ color: "#5F7280", textAlign: "center", padding: 30 }}>جارٍ التحميل…</p>;
  if (missing) return (
    <div style={S.wrap}><div style={{ ...S.card, lineHeight: 1.9, fontSize: 14 }}>
      جدول الروابط غير مفعّل بعد. شغّل ملف <b dir="ltr">migration-external-links.sql</b> مرة وحدة في Supabase ← SQL Editor، ثم حدّث الصفحة.
    </div></div>
  );

  const add = async (payload) => {
    const sort_order = rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
    const { error } = await supabase.from("external_links").insert({ ...payload, sort_order, published: false });
    if (error) return "تعذّر الإضافة: " + (error.message || "");
    setEditing(null); log("إضافة رابط خارجي", payload.title_ar); flashToast("انضاف الرابط (غير منشور — انشره بزر العين)"); load();
    return null;
  };
  const update = (r) => async (payload) => {
    const { error } = await supabase.from("external_links").update(payload).eq("id", r.id);
    if (error) return "تعذّر الحفظ: " + (error.message || "");
    setEditing(null); log("تعديل رابط خارجي", payload.title_ar); flashToast("تم حفظ التعديلات"); load();
    return null;
  };
  const togglePub = async (r) => {
    const published = !r.published;
    setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, published } : x)));
    const { error } = await supabase.from("external_links").update({ published }).eq("id", r.id);
    if (error) { flashToast("تعذّر التغيير"); load(); return; }
    log(published ? "نشر رابط خارجي" : "إخفاء رابط خارجي", r.title_ar);
    flashToast(published ? "صار الرابط ظاهرًا للملاك" : "أُخفي الرابط عن الملاك");
  };
  const move = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= rows.length || busy) return;
    setBusy(true);
    /* لو تساوى الترتيب نعيد ترقيم الكل بالتسلسل الحالي ثم نبدّل */
    const seq = rows.map((r, k) => ({ id: r.id, sort_order: k }));
    [seq[i].sort_order, seq[j].sort_order] = [seq[j].sort_order, seq[i].sort_order];
    await Promise.all(seq.map((s2) => supabase.from("external_links").update({ sort_order: s2.sort_order }).eq("id", s2.id)));
    setBusy(false); load();
  };
  const del = async (r) => {
    setConfirmDel(null);
    const { error } = await supabase.from("external_links").delete().eq("id", r.id);
    if (error) { flashToast("تعذّر الحذف"); return; }
    log("حذف رابط خارجي", r.title_ar); flashToast("تم حذف الرابط"); load();
  };
  const plLabel = (k) => (LINK_PLACEMENTS.find((p) => p.key === k)?.ar || k).replace(/\s*\(.*\)/, "");

  return (
    <div style={S.wrap}>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#5F7280", lineHeight: 1.9 }}>
        روابط لمواقع خارجية (مثل موقع أعده أحد الملاك). أي رابط يُفتح بعد شاشة تنبيه «ستنتقل إلى موقع خارجي». الرابط الجديد يُضاف غير منشور — راجعه ثم انشره بزر العين.
      </p>
      {rows.map((r, i) => (
        <div key={r.id} style={{ ...S.card, opacity: r.published ? 1 : 0.8 }}>
          <div style={S.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.5 }}>{r.title_ar}</div>
              <div dir="ltr" style={{ fontSize: 12, color: "#5F7280", textAlign: "start", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hostOf(r.url)}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                <span style={S.chip(r.published ? "#1F7A5C" : "#8A6318")}>{r.published ? "منشور" : "مخفي"}</span>
                {(r.placements || []).map((k) => <span key={k} style={S.chip("#1B7F8E")}>{plLabel(k)}</span>)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <button type="button" style={S.ib()} aria-label="للأعلى" onClick={() => move(i, -1)} disabled={i === 0 || busy}><ChevronUp size={16} /></button>
              <button type="button" style={S.ib()} aria-label="للأسفل" onClick={() => move(i, 1)} disabled={i === rows.length - 1 || busy}><ChevronDown size={16} /></button>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              <a style={{ ...S.ib(), textDecoration: "none" }} href={safeUrl(r.url) || "#"} target="_blank" rel="noopener noreferrer" aria-label="تجربة الرابط"><ExternalLink size={16} /></a>
              <button type="button" style={S.ib()} aria-label={r.published ? "إخفاء" : "نشر"} onClick={() => togglePub(r)}>{r.published ? <Eye size={16} /> : <EyeOff size={16} />}</button>
              <button type="button" style={S.ib()} aria-label="تعديل" onClick={() => setEditing(editing === r.id ? null : r.id)}><Pencil size={16} /></button>
              <button type="button" style={S.ib(true)} aria-label="حذف" onClick={() => setConfirmDel(r.id)}><Trash2 size={16} /></button>
            </div>
          </div>
          {confirmDel === r.id && (
            <div style={{ ...S.row, marginTop: 10, padding: 10, background: "#A8443C12", borderRadius: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, flex: 1 }}>حذف «{r.title_ar}» نهائيًا؟</span>
              <button type="button" style={{ ...S.btn, background: "#A8443C", borderColor: "#A8443C", color: "#fff" }} onClick={() => del(r)}>حذف</button>
              <button type="button" style={S.btn} onClick={() => setConfirmDel(null)}>تراجع</button>
            </div>
          )}
          {editing === r.id && <LinkEditor key={r.id} row={r} onSave={update(r)} onCancel={() => setEditing(null)} supabase={supabase} />}
        </div>
      ))}
      {!rows.length && editing !== "new" && <p style={{ color: "#5F7280", textAlign: "center", padding: "24px 0" }}>ما فيه روابط بعد.</p>}
      {editing === "new" ? (
        <div style={S.card}><b>رابط جديد</b><LinkEditor isNew onSave={add} onCancel={() => setEditing(null)} supabase={supabase} /></div>
      ) : (
        <button type="button" style={{ ...S.btn, ...S.pri }} onClick={() => setEditing("new")}><Plus size={16} /> إضافة رابط جديد</button>
      )}
    </div>
  );
}
