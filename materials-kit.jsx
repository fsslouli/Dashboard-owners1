/* materials-kit.jsx — «سجل المواد» (7.9.0)
   جدول بسيط: المادة · مواصفاتها بسطر واحد · الحالة، مع تصدير الجدول كاملًا PDF.
   الظهور للزوار يتحكم به site_settings.materials_on (مخفي افتراضيًا) — والحماية الفعلية في RLS
   بجدول materials (migration-materials.sql)، فالزائر ما يقدر يقرأ الصفوف والسجل مخفي.
   «مرصودة» = شوهدت بالموقع · «معتمدة» = برد أو مستند من المطور · «قيد الدراسة» = لم تُحسم. */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useSystemTheme } from "./admin-core.jsx";
import { aNoteStyle } from "./admin-excel-utils.jsx";

export const MAT_STATUSES = ["مرصودة", "معتمدة", "قيد الدراسة"];
const ST_EN = { "مرصودة": "Observed on site", "معتمدة": "Approved", "قيد الدراسة": "Under study" };
const ST_COLOR = { "مرصودة": "#2E6F9E", "معتمدة": "#1E8E5A", "قيد الدراسة": "#B8790F" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lastUpdate = (rows) => {
  const t = Math.max(0, ...rows.map((r) => +new Date(r.updated_at || 0) || 0));
  return t ? new Date(t).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "medium" }) : "";
};

/* يفتح نافذة جاهزة للطباعة/الحفظ PDF بالجدول كاملًا — نفس أسلوب «فحص الاستلام» */
export function printMaterials(rows, siteUrl = window.location.origin) {
  const body = rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td class="m">${esc(r.name)}</td><td>${esc(r.spec)}</td><td class="s" style="color:${ST_COLOR[r.status] || "#17222B"}">${esc(r.status)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>سجل المواد — ألبورادا</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{font-family:"IBM Plex Sans Arabic","Noto Naskh Arabic","Geeza Pro","Segoe UI",Tahoma,Arial,sans-serif;color:#17222B;margin:0;font-size:10.5pt;line-height:1.8}
header{border-bottom:2.5px solid #1B7F8E;padding-bottom:7px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
h1{font-size:16pt;margin:0}.meta{font-size:9pt;color:#5F7280}
table{width:100%;border-collapse:collapse}thead{display:table-header-group}
th{background:#1B7F8E;color:#fff;font-weight:600;padding:6px 8px;font-size:9.5pt;text-align:right}
td{border:1px solid #D5DEE4;padding:7px 8px;vertical-align:top}
tr{break-inside:avoid;page-break-inside:avoid}
td.n{text-align:center;width:9mm;font-weight:700}td.m{width:48mm;font-weight:700}td.s{width:26mm;font-weight:700;text-align:center;white-space:nowrap}
.key{margin-top:10px;font-size:8.8pt;color:#5F7280;line-height:1.9}
.bar{position:fixed;bottom:12px;left:12px}.bar button{font:inherit;padding:8px 14px;border-radius:9px;border:1px solid #1B7F8E;background:#1B7F8E;color:#fff;cursor:pointer}
@media print{.bar{display:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
<header><div><h1>سجل المواد</h1><div class="meta">مشروع ألبورادا · عدد المواد: ${rows.length}</div></div>
<div class="meta">${lastUpdate(rows) ? `آخر تحديث: ${lastUpdate(rows)}` : ""}</div></header>
<table><thead><tr><th>م</th><th>المادة</th><th>المواصفات</th><th>الحالة</th></tr></thead><tbody>${body}</tbody></table>
<div class="key"><b>مرصودة:</b> شوهدت في الموقع أثناء المعاينة. <b>معتمدة:</b> وردت برد أو مستند من المطور. <b>قيد الدراسة:</b> لم يُحسم اختيارها بعد.<br>هذا السجل من إعداد ممثلي الملاك للمتابعة، وليس مستندًا صادرًا من المطور. ${esc(siteUrl)}</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

const CSS = `
.mtl{border:1px solid var(--m-line);background:var(--m-surface);border-radius:16px;padding:16px;margin-bottom:18px}
.mtl-h{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.mtl-h b{font-size:15.5px}.mtl-h span{font-size:12px;color:var(--m-muted)}
.mtl-pdf{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--m-line);background:transparent;color:var(--m-accent);border-radius:10px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.mtl-t{width:100%;border-collapse:collapse;font-size:13px}
.mtl-t th{text-align:start;font-size:11.5px;font-weight:600;color:var(--m-muted);padding:7px 8px;border-bottom:1px solid var(--m-line)}
.mtl-t td{padding:9px 8px;border-bottom:1px solid var(--m-line);vertical-align:top;line-height:1.7}
.mtl-t tr:last-child td{border-bottom:0}
.mtl-t td.m{font-weight:700;white-space:nowrap}
.mtl-t td.m a{color:inherit;text-decoration:underline;text-decoration-color:var(--m-accent);text-underline-offset:3px}
.mtl-st{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap}
.mtl-key{font-size:11.5px;color:var(--m-muted);margin-top:10px;line-height:1.8}
@media (max-width:640px){
  .mtl-t thead{display:none}.mtl-t,.mtl-t tbody,.mtl-t tr,.mtl-t td{display:block;width:100%}
  .mtl-t tr{padding:10px 0;border-bottom:1px solid var(--m-line)}.mtl-t tr:last-child{border-bottom:0}
  .mtl-t td{border:0;padding:1px 2px}.mtl-t td.m{white-space:normal;display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
  .mtl-t td.s{display:none}.mtl-t td.m .mtl-st{display:inline-block}
}
@media (min-width:641px){.mtl-t td.m .mtl-st{display:none}}
`;
const Pill = ({ s, lang }) => <span className="mtl-st" style={{ background: (ST_COLOR[s] || "#888") + "1F", color: ST_COLOR[s] || "#888" }}>{lang === "en" ? ST_EN[s] || s : s}</span>;

/* الجدول نفسه — يُستخدم في الموقع العام وفي معاينة الإدارة */
export const matLink = (r) => (r.media_url || r.ref_url || null);
export function MaterialsTable({ rows, T, L, lang = "ar", pdf = true }) {
  const vars = { "--m-surface": T.surface, "--m-line": T.line, "--m-muted": T.muted, "--m-accent": T.brass };
  return (
    <section className="mtl" style={vars} dir={lang === "en" ? "ltr" : "rtl"}>
      <style>{CSS}</style>
      <div className="mtl-h">
        <div><b>{L("سجل المواد", "Materials register")}</b> <span>· {rows.length} {L("مادة", "items")}{lastUpdate(rows) ? ` · ${L("آخر تحديث", "updated")} ${lastUpdate(rows)}` : ""}</span></div>
        {pdf && <button type="button" className="mtl-pdf" onClick={() => printMaterials(rows)}><FileDown size={14} /> {L("تنزيل PDF", "Download PDF")}</button>}
      </div>
      <table className="mtl-t">
        <thead><tr><th>{L("المادة", "Material")}</th><th>{L("المواصفات", "Specification")}</th><th>{L("الحالة", "Status")}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="m"><span>{matLink(r) ? <a href={matLink(r)} target="_blank" rel="noopener noreferrer">{r.name}</a> : r.name}</span><Pill s={r.status} lang={lang} /></td>
              <td>{r.spec}</td>
              <td className="s"><Pill s={r.status} lang={lang} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mtl-key">{L("مرصودة: شوهدت في الموقع · معتمدة: برد أو مستند من المطور · قيد الدراسة: لم تُحسم بعد.", "Observed: seen on site · Approved: per a developer reply or document · Under study: not yet decided.")}</div>
    </section>
  );
}

/* يربط كل مادة بملفها في المكتبة (media_id) — الرابط يُقرأ من الملف نفسه فيتحدّث معه. فشل القراءة = بلا روابط فقط. */
async function withMedia(supabase, rows) {
  const ids = [...new Set(rows.map((r) => r.media_id).filter(Boolean))];
  if (!ids.length) return rows;
  const { data } = await supabase.from("media_items").select("id,external_url").in("id", ids);
  const m = new Map((data || []).map((x) => [x.id, x.external_url]));
  return rows.map((r) => ({ ...r, media_url: (r.media_id && m.get(r.media_id)) || null }));
}

/* الموقع العام: يظهر أعلى المكتبة فقط لما الإدارة تفعّله. أي خطأ (الهجرة ما اشتغلت) = لا شيء. */
export function MaterialsSection({ supabase, T, L, lang }) {
  const [rows, setRows] = useState(null);
  const [pdf, setPdf] = useState(true);
  useEffect(() => {
    let live = true;
    (async () => {
      const { data: s, error: e1 } = await supabase.from("site_settings").select("materials_on,materials_pdf").eq("id", 1).single();
      if (!live || e1 || !s || !s.materials_on) return;
      setPdf(s.materials_pdf !== false);
      const { data, error } = await supabase.from("materials").select("id,name,spec,status,ref_url,media_id,sort_order,updated_at").order("sort_order").order("id");
      if (!live || error) return;
      const full = await withMedia(supabase, data || []);
      if (live) setRows(full);
    })();
    return () => { live = false; };
  }, [supabase]);
  if (!rows || !rows.length) return null;
  return <MaterialsTable rows={rows} T={T} L={L} lang={lang} pdf={pdf} />;
}

/* ═══ لوحة الإدارة — تبويب «سجل المواد» ═══ */
const BLANK = { name: "", spec: "", status: "مرصودة", ref_url: "", media_id: "" };
export function AMaterialsTab({ supabase, flashToast, log, canManage }) {
  const T = useSystemTheme();
  const [on, setOn] = useState(null); /* null = جارٍ التحميل · "missing" = الهجرة ما اشتغلت */
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null); /* {id?, name, spec, status, ref_url} */
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pdfOn, setPdfOn] = useState(true);
  const [lib, setLib] = useState([]); /* ملفات المكتبة للربط */
  const load = async () => {
    const { data: s, error: e1 } = await supabase.from("site_settings").select("materials_on,materials_pdf").eq("id", 1).single();
    if (e1 || !s) { setOn("missing"); return; }
    setOn(!!s.materials_on); setPdfOn(s.materials_pdf !== false);
    const { data } = await supabase.from("materials").select("*").order("sort_order").order("id");
    setRows(await withMedia(supabase, data || []));
    const { data: m } = await supabase.from("media_items").select("id,title_ar,kind,topic_id").order("topic_id").order("sort_order");
    setLib(m || []);
  };
  const togglePdf = async () => {
    if (!canManage) return;
    const next = !pdfOn;
    const { error } = await supabase.from("site_settings").update({ materials_pdf: next }).eq("id", 1);
    if (error) { flashToast("تعذّر الحفظ"); return; }
    setPdfOn(next); flashToast(next ? "زر PDF ظاهر للزوار" : "زر PDF مخفي عن الزوار");
    if (log) log("سجل المواد", next ? "إظهار زر PDF" : "إخفاء زر PDF");
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    if (!canManage) return;
    const next = !on;
    if (next && !window.confirm(`إظهار «سجل المواد» لكل زوار الموقع الآن؟ (${rows.length} مادة)`)) return;
    const { error } = await supabase.from("site_settings").update({ materials_on: next }).eq("id", 1);
    if (error) { flashToast("تعذّر الحفظ"); return; }
    setOn(next); flashToast(next ? "السجل ظاهر للزوار الآن" : "السجل مخفي عن الزوار");
    if (log) log("سجل المواد", next ? "إظهار للزوار" : "إخفاء عن الزوار");
  };
  const save = async () => {
    const name = form.name.trim(), spec = form.spec.replace(/\s*\n+\s*/g, " ").trim();
    if (!name || !spec) { flashToast("اكتب اسم المادة ومواصفاتها"); return; }
    setBusy(true);
    const rec = { name, spec, status: form.status, ref_url: form.ref_url.trim() || null, media_id: form.media_id ? Number(form.media_id) : null, updated_at: new Date().toISOString() };
    const q = form.id ? supabase.from("materials").update(rec).eq("id", form.id)
      : supabase.from("materials").insert({ ...rec, sort_order: (Math.max(0, ...rows.map((r) => r.sort_order || 0)) + 1) });
    const { error } = await q;
    setBusy(false);
    if (error) { flashToast("تعذّر الحفظ"); return; }
    flashToast(form.id ? "تم التعديل" : "أُضيفت المادة");
    if (log) log(form.id ? "تعديل مادة في السجل" : "إضافة مادة للسجل", name);
    setForm(null); load();
  };
  const remove = async (r) => {
    if (!window.confirm(`حذف «${r.name}» من السجل؟`)) return;
    const { error } = await supabase.from("materials").delete().eq("id", r.id);
    if (error) { flashToast("تعذّر الحذف"); return; }
    if (log) log("حذف مادة من السجل", r.name);
    load();
  };
  const move = async (i, d) => {
    const j = i + d; if (j < 0 || j >= rows.length) return;
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    await Promise.all(next.map((r, k) => (r.sort_order === k + 1 ? null : supabase.from("materials").update({ sort_order: k + 1 }).eq("id", r.id))));
    load();
  };

  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 };
  const btn = (primary) => ({ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${primary ? "transparent" : T.line}`, borderRadius: 10, padding: "8px 13px", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", background: primary ? T.brass : T.surface, color: primary ? T.onAccent || "#fff" : T.paper });
  const inp = { width: "100%", boxSizing: "border-box", background: T.bg, color: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 13, fontFamily: "inherit" };
  const ib = { background: "none", border: 0, color: T.muted, cursor: "pointer", padding: 5, display: "inline-flex" };

  if (on === null) return <div style={card}>جارٍ التحميل…</div>;
  if (on === "missing") return <div style={card}>الخاصية تحتاج تجهيز قاعدة البيانات مرة واحدة: شغّل ملف <b>migration-materials.sql</b> ثم حدّث الصفحة.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} dir="rtl">
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>سجل المواد</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.8 }}>جدول بسيط يظهر أعلى «المكتبة»: المادة ومواصفاتها بسطر واحد وحالتها، مع زر تنزيل PDF.</div>
          </div>
          <button onClick={toggle} disabled={!canManage} aria-pressed={on} style={{ ...btn(on), fontWeight: 700 }}>{on ? <Eye size={15} /> : <EyeOff size={15} />} {on ? "ظاهر للزوار" : "مخفي عن الزوار"}</button>
        </div>
        <div style={{ ...aNoteStyle(T, on ? undefined : "#B8790F"), marginTop: 12 }}>{on ? "الزوار يشوفون السجل الآن. أي إضافة أو تعديل يظهر لهم مباشرة." : "السجل مخفي: ما يظهر لأي زائر ولا يُقرأ من قاعدة البيانات إلا للإدارة. جهّز المواد براحتك ثم فعّله."}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {canManage && <button onClick={() => setForm({ ...BLANK })} style={btn(true)}><Plus size={14} /> إضافة مادة</button>}
          <button onClick={() => setPreview((v) => !v)} style={btn(false)} disabled={!rows.length}><Eye size={14} /> {preview ? "إخفاء المعاينة" : "معاينة كما يراه الزائر"}</button>
          <button onClick={() => { if (!printMaterials(rows)) flashToast("اسمح بالنوافذ المنبثقة لتنزيل الملف"); }} style={btn(false)} disabled={!rows.length}><FileDown size={14} /> تنزيل PDF</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 14, borderTop: `1px dashed ${T.line}`, paddingTop: 12 }}>
          <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}><b style={{ color: T.paper }}>زر «تنزيل PDF» للزوار</b> — مفتاح مستقل عن ظهور السجل.</div>
          <button onClick={togglePdf} disabled={!canManage} aria-pressed={pdfOn} style={btn(pdfOn)}>{pdfOn ? <Eye size={14} /> : <EyeOff size={14} />} {pdfOn ? "الزر ظاهر" : "الزر مخفي"}</button>
        </div>
      </div>

      {form && (
        <div style={{ ...card, borderColor: T.brass }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{form.id ? "تعديل مادة" : "مادة جديدة"}</div>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, color: T.muted }}>المادة<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="مثال: ألواح جبس عادية" style={{ ...inp, marginTop: 4 }} /></label>
            <label style={{ fontSize: 12, color: T.muted }}>المواصفات (سطر واحد مختصر)<input value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} maxLength={140} placeholder="العلامة، النوع، المقاس، مكان الاستخدام" style={{ ...inp, marginTop: 4 }} /><span style={{ fontSize: 11, color: form.spec.length > 110 ? "#B8790F" : T.faint }}>{form.spec.length} / 140</span></label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: T.muted }}>الحالة:</span>
              {MAT_STATUSES.map((s) => <button key={s} onClick={() => setForm({ ...form, status: s })} aria-pressed={form.status === s} style={{ ...btn(form.status === s), padding: "6px 11px" }}>{s}</button>)}
            </div>
            <label style={{ fontSize: 12, color: T.muted }}>ربط بملف من المكتبة (اختياري)
              <select value={form.media_id || ""} onChange={(e) => setForm({ ...form, media_id: e.target.value })} style={{ ...inp, marginTop: 4 }}>
                <option value="">بدون ربط</option>
                {lib.map((m) => <option key={m.id} value={m.id}>{m.title_ar || `ملف ${m.id}`}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: T.muted }}>أو رابط خارجي (اختياري)<input value={form.ref_url} onChange={(e) => setForm({ ...form, ref_url: e.target.value })} dir="ltr" placeholder="https://…" style={{ ...inp, marginTop: 4 }} /></label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={busy} style={btn(true)}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
            <button onClick={() => setForm(null)} style={btn(false)}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={card}>
        {!rows.length && <div style={{ color: T.muted, fontSize: 13 }}>ما فيه مواد بعد — اضغط «إضافة مادة».</div>}
        {rows.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 0", borderBottom: i < rows.length - 1 ? `1px dashed ${T.line}` : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name} <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: (ST_COLOR[r.status] || "#888") + "1F", color: ST_COLOR[r.status] || "#888", marginInlineStart: 4 }}>{r.status}</span></div>
              <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7, marginTop: 2 }}>{r.spec}</div>
              {r.media_id ? <div style={{ fontSize: 11, color: T.faint }}>🔗 مرتبط بملف المكتبة: {(lib.find((m) => m.id === r.media_id) || {}).title_ar || `#${r.media_id}`}</div>
                : r.ref_url && <div dir="ltr" style={{ fontSize: 11, color: T.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{r.ref_url}</div>}
            </div>
            {canManage && (
              <div style={{ display: "flex", flexShrink: 0 }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="تحريك لأعلى" style={{ ...ib, opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={15} /></button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="تحريك لأسفل" style={{ ...ib, opacity: i === rows.length - 1 ? 0.3 : 1 }}><ArrowDown size={15} /></button>
                <button onClick={() => setForm({ id: r.id, name: r.name, spec: r.spec, status: r.status, ref_url: r.ref_url || "", media_id: r.media_id || "" })} aria-label="تعديل" style={ib}><Pencil size={15} /></button>
                <button onClick={() => remove(r)} aria-label="حذف" style={{ ...ib, color: "#C0392B" }}><Trash2 size={15} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {preview && rows.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>المعاينة (كما يظهر في الموقع):</div>
          <MaterialsTable rows={rows} T={T} L={(a) => a} lang="ar" pdf={pdfOn} />
        </div>
      )}
    </div>
  );
}
