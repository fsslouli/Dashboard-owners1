/* ═══════════════════════════════════════════════════════════
   admin-meetings-tab.jsx — تبويب «الاجتماعات» / وضع الاجتماع (7.1.0)
   ثلاث مراحل لكل اجتماع:
     ١) التجهيز   — تختار البنود المفتوحة وترتّبها بأقسام ← «جدول الأعمال» للطباعة أو الحفظ PDF (عربي فقط)
     ٢) التسجيل   — بعد الاجتماع تكتب رد المطور لكل بند، وتحدد الحالة والإقفال (تُحفظ مسودة، ما يتغيّر شي بالموقع)
     ٣) الاعتماد  — ضغطة واحدة تنزّل الردود على الاستفسارات بسطر مؤرَّخ باسم الاجتماع، مع نسخة احتياطية قبلها
   الجدول والدالة: migration-meetings.sql (meetings + meeting_apply). الصلاحية: edit_inquiry.
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Check, FileText, Plus, Printer, Trash2, X } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";

const S = {
  wrap: { maxWidth: 900, margin: "0 auto", padding: "4px 0", color: "#1F2C35" },
  card: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 16, marginBottom: 14 },
  h: { fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 12.5, color: "#5F7280", margin: "0 0 12px", lineHeight: 1.8 },
  btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "7px 12px", fontWeight: 500, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", font: "inherit", fontSize: 13, color: "#1F2C35" },
  pri: { background: "#1B7F8E", borderColor: "#1B7F8E", color: "#fff" },
  ib: { width: 30, height: 30, display: "grid", placeItems: "center", border: 0, background: "none", borderRadius: 8, color: "#5F7280", cursor: "pointer" },
  inp: { boxSizing: "border-box", border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 10, padding: "8px 11px", font: "inherit", fontSize: 13.5, color: "#1F2C35" },
  chip: (c) => ({ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: c + "1A", color: c, whiteSpace: "nowrap" }),
};
const PRI_COLOR = { "عالية جدًا": "#A8443C", "عالية": "#B7791F", "متوسطة": "#1B7F8E", "عادية": "#5F7280" };
const PRI_RANK = { "عالية جدًا": 0, "عالية": 1, "متوسطة": 2, "عادية": 3 };
const STATUS_OPTS = [["", "بدون تغيير"], ["معتمدة", "معتمدة"], ["تم الرفض", "غير معتمدة"], ["قيد الدراسة", "قيد الدراسة"]];
const STATUS_AR = { "تم الرفض": "غير معتمدة" };
const STAGE = { draft: ["تجهيز", "#B7791F"], held: ["تسجيل الردود", "#1B7F8E"], published: ["معتمد", "#2E7D5B"] };
const DEFAULT_SECTIONS = [{ title: "أولاً: البنود الرئيسية", ids: [] }, { title: "ثانياً: بنود تُطرح باختصار", ids: [] }];
const isClosed = (r) => ["نعم", "مقفل", "مغلق", "مقفلة", "مغلقة"].includes(String(r.closed || "").trim()) || r.closed === true;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dmy = (d) => (d ? d.split("-").reverse().join("-") : "");

/* صفحة طباعة عربية (جدول الأعمال أو المحضر) — تُفتح بنافذة جديدة، ومنها «طباعة» أو «حفظ PDF» */
function openPrint(meeting, byId, withResults) {
  const secs = (meeting.sections || []).filter((s) => (s.ids || []).length);
  const total = secs.reduce((n, s) => n + s.ids.length, 0);
  const rows = secs.map((s) => `<tr class="sec"><td colspan="${withResults ? 6 : 6}">${esc(s.title)} <span>(${s.ids.length})</span></td></tr>` + s.ids.map((id) => {
    const r = byId[id]; if (!r) return "";
    const res = (meeting.results || {})[id] || {};
    const last = withResults
      ? `<td class="t">${esc(res.reply || "—")}${res.status ? `<div class="st">الحالة: ${esc(STATUS_AR[res.status] || res.status)}</div>` : ""}${res.close ? `<div class="st">أُقفل البند</div>` : ""}</td>`
      : `<td class="t prev">${esc(r.reply || "بانتظار الرد")}</td>`;
    return `<tr><td class="n">${id}</td><td>${esc(r.model)}</td><td>${esc(r.loc)}</td><td><b style="color:${PRI_COLOR[r.pri] || "#333"}">${esc(r.pri)}</b></td><td class="t">${esc(r.note)}</td>${last}</tr>`;
  }).join("")).join("");
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(meeting.title)} — ${withResults ? "المحضر" : "جدول الأعمال"}</title>
<style>
@page{size:A4 landscape;margin:11mm}
*{box-sizing:border-box}
body{font-family:"IBM Plex Sans Arabic","Noto Naskh Arabic","Geeza Pro","Segoe UI",Tahoma,Arial,sans-serif;color:#17222B;margin:0;font-size:9.6pt;line-height:1.75}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #1B7F8E;padding-bottom:7px;margin-bottom:10px}
h1{font-size:16pt;margin:0}.meta{font-size:9pt;color:#5F7280}
table{width:100%;border-collapse:collapse}
thead{display:table-header-group}
th{background:#1B7F8E;color:#fff;font-weight:600;padding:6px 7px;font-size:9pt;text-align:right}
td{border:1px solid #D5DEE4;padding:6px 7px;vertical-align:top}
tr{break-inside:avoid;page-break-inside:avoid}
tr.sec td{background:#E6F1F3;color:#0F5F6B;font-weight:700;font-size:10pt;break-after:avoid}
tr.sec span{font-weight:400;color:#5F7280}
td.n{text-align:center;font-weight:700;width:8mm}
td.t{white-space:pre-wrap}
td.prev{color:#44525C;font-size:8.8pt}
.st{margin-top:4px;font-weight:700;color:#0F5F6B;font-size:8.8pt}
.bar{position:fixed;bottom:12px;left:12px;display:flex;gap:8px}
.bar button{font:inherit;padding:8px 14px;border-radius:9px;border:1px solid #1B7F8E;background:#1B7F8E;color:#fff;cursor:pointer}
@media print{.bar{display:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
<header><div><h1>${esc(meeting.title)} — ${withResults ? "محضر الاجتماع" : "جدول الأعمال"}</h1><div class="meta">فريق تمثيل الملاك · مشروع ألبورادا</div></div>
<div class="meta">${meeting.held_on ? `التاريخ: ${dmy(meeting.held_on)} · ` : ""}عدد البنود: ${total}</div></header>
<table><thead><tr><th>م</th><th style="width:26mm">النموذج</th><th style="width:28mm">الموقع</th><th style="width:17mm">الأولوية</th><th>الاستفسار</th><th style="width:${withResults ? 78 : 70}mm">${withResults ? "رد المطور في الاجتماع" : "آخر رد مسجّل"}</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

function MeetingEditor({ m, inquiries, onPatch, onApply, onDelete, onBack, flashToast, canEdit }) {
  const byId = useMemo(() => Object.fromEntries(inquiries.map((r) => [r.id, r])), [inquiries]);
  const sections = m.sections && m.sections.length ? m.sections : DEFAULT_SECTIONS;
  const picked = useMemo(() => new Set(sections.flatMap((s) => s.ids || [])), [sections]);
  const published = m.status === "published";
  const [q, setQ] = useState("");
  const [results, setResults] = useState(m.results || {});
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setResults(m.results || {}); setDirty(false); }, [m.id, m.updated_at]);

  const pool = useMemo(() => inquiries.filter((r) => !isClosed(r) && !picked.has(r.id) && (!q.trim() || String(r.id) === q.trim() || `${r.note} ${r.loc} ${r.model}`.includes(q.trim())))
    .sort((a, b) => (PRI_RANK[a.pri] ?? 9) - (PRI_RANK[b.pri] ?? 9) || a.id - b.id), [inquiries, picked, q]);
  const setSections = (next) => onPatch({ sections: next }, true);
  const add = (si, id) => setSections(sections.map((s, i) => (i === si ? { ...s, ids: [...(s.ids || []), id] } : s)));
  const remove = (si, id) => setSections(sections.map((s, i) => (i === si ? { ...s, ids: s.ids.filter((x) => x !== id) } : s)));
  const move = (si, idx, d) => setSections(sections.map((s, i) => {
    if (i !== si) return s; const ids = [...s.ids]; const j = idx + d; if (j < 0 || j >= ids.length) return s;
    [ids[idx], ids[j]] = [ids[j], ids[idx]]; return { ...s, ids };
  }));
  const shift = (si, id) => { const to = (si + 1) % sections.length; setSections(sections.map((s, i) => (i === si ? { ...s, ids: s.ids.filter((x) => x !== id) } : i === to ? { ...s, ids: [...(s.ids || []), id] } : s))); };
  const setRes = (id, patch) => { setResults((p) => ({ ...p, [id]: { reply: "", status: "", close: false, ...(p[id] || {}), ...patch } })); setDirty(true); };
  const filled = Object.values(results).filter((r) => (r.reply || "").trim() || r.status || r.close).length;
  const total = sections.reduce((n, s) => n + (s.ids || []).length, 0);
  const stage = STAGE[m.status] || STAGE.draft;

  return (
    <div style={S.wrap} dir="rtl">
      <div style={S.card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button type="button" style={S.btn} onClick={onBack}>← كل الاجتماعات</button>
          <input value={m.title} disabled={published || !canEdit} onChange={(e) => onPatch({ title: e.target.value.slice(0, 80) }, true)} aria-label="اسم الاجتماع" style={{ ...S.inp, flex: "1 1 180px", fontWeight: 700 }} />
          <input type="date" value={m.held_on || ""} disabled={published || !canEdit} onChange={(e) => onPatch({ held_on: e.target.value || null })} aria-label="تاريخ الاجتماع" style={S.inp} />
          <span style={S.chip(stage[1])}>{stage[0]}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <button type="button" style={S.btn} disabled={!total} onClick={() => { if (!openPrint(m, byId, false)) flashToast("المتصفح منع النافذة — اسمح بالنوافذ المنبثقة"); }}><Printer size={15} />جدول الأعمال (PDF)</button>
          {m.status !== "draft" && <button type="button" style={S.btn} onClick={() => { if (!openPrint({ ...m, results }, byId, true)) flashToast("المتصفح منع النافذة — اسمح بالنوافذ المنبثقة"); }}><FileText size={15} />المحضر (PDF)</button>}
          {m.status === "draft" && canEdit && <button type="button" style={{ ...S.btn, ...S.pri }} disabled={!total} onClick={() => onPatch({ status: "held" })}>انعقد الاجتماع — ابدأ تسجيل الردود</button>}
          {m.status === "held" && canEdit && <button type="button" style={S.btn} onClick={() => onPatch({ status: "draft" })}>رجوع للتجهيز</button>}
          {!published && canEdit && <button type="button" style={{ ...S.btn, color: "#A8443C", marginInlineStart: "auto" }} onClick={onDelete}><Trash2 size={15} />حذف</button>}
        </div>
      </div>

      {m.status === "draft" && (
        <>
          {sections.map((s, si) => (
            <div key={si} style={S.card}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <input value={s.title} disabled={!canEdit} onChange={(e) => setSections(sections.map((x, i) => (i === si ? { ...x, title: e.target.value.slice(0, 60) } : x)))} aria-label="عنوان القسم" style={{ ...S.inp, flex: 1, fontWeight: 700 }} />
                <span style={S.chip("#5F7280")}>{(s.ids || []).length} بند</span>
                {sections.length > 1 && !(s.ids || []).length && canEdit && <button type="button" style={S.ib} title="حذف القسم" onClick={() => setSections(sections.filter((_, i) => i !== si))}><X size={16} /></button>}
              </div>
              {!(s.ids || []).length ? <div style={{ ...S.sub, margin: 0 }}>ما في بنود — أضف من «البنود المفتوحة» بالأسفل.</div> : s.ids.map((id, idx) => {
                const r = byId[id];
                return (
                  <div key={id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 0", borderTop: idx ? "1px solid #EEF2F5" : 0 }}>
                    <b style={{ minWidth: 34, fontSize: 14 }}>{id}</b>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {r ? <><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}><span style={S.chip(PRI_COLOR[r.pri] || "#5F7280")}>{r.pri}</span><span style={S.chip("#5F7280")}>{r.loc}</span>{isClosed(r) && <span style={S.chip("#2E7D5B")}>مقفل</span>}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.note}</div></> : <span style={{ color: "#A8443C", fontSize: 13 }}>البند غير موجود</span>}
                    </div>
                    {canEdit && <div style={{ display: "flex" }}>
                      <button type="button" style={S.ib} title="أعلى" onClick={() => move(si, idx, -1)}><ArrowUp size={15} /></button>
                      <button type="button" style={S.ib} title="أسفل" onClick={() => move(si, idx, 1)}><ArrowDown size={15} /></button>
                      {sections.length > 1 && <button type="button" style={{ ...S.ib, width: "auto", padding: "0 6px", fontSize: 11.5 }} title="نقل للقسم التالي" onClick={() => shift(si, id)}>نقل</button>}
                      <button type="button" style={{ ...S.ib, color: "#A8443C" }} title="إزالة من الاجتماع" onClick={() => remove(si, id)}><X size={15} /></button>
                    </div>}
                  </div>
                );
              })}
            </div>
          ))}
          {canEdit && <button type="button" style={{ ...S.btn, marginBottom: 14 }} onClick={() => setSections([...sections, { title: "قسم جديد", ids: [] }])}><Plus size={15} />قسم جديد</button>}

          <div style={S.card}>
            <h3 style={S.h}>البنود المفتوحة ({pool.length})</h3>
            <p style={S.sub}>مرتبة بالأولوية. اضغط اسم القسم لإضافة البند إليه.</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برقم البند أو كلمة" style={{ ...S.inp, width: "100%", marginBottom: 8 }} />
            {pool.map((r, i) => (
              <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 0", borderTop: i ? "1px solid #EEF2F5" : 0 }}>
                <b style={{ minWidth: 34, fontSize: 14 }}>{r.id}</b>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}><span style={S.chip(PRI_COLOR[r.pri] || "#5F7280")}>{r.pri}</span><span style={S.chip("#5F7280")}>{r.loc}</span></div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.note}</div>
                  {canEdit && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {sections.map((s, si) => <button key={si} type="button" style={{ ...S.btn, padding: "4px 10px", fontSize: 12 }} onClick={() => add(si, r.id)}><Plus size={13} />{s.title.replace(/^[^:：]*[:：]\s*/, "") || s.title}</button>)}
                  </div>}
                </div>
              </div>
            ))}
            {!pool.length && <div style={{ ...S.sub, margin: 0 }}>كل البنود المفتوحة مضافة للاجتماع.</div>}
          </div>
        </>
      )}

      {m.status !== "draft" && (
        <>
          {!published && (
            <div style={{ ...S.card, background: "#F3FAFB", borderColor: "#BFE0E5" }}>
              <div style={{ fontSize: 13, lineHeight: 1.9 }}>اكتب رد المطور لكل بند كما قيل في الاجتماع. المسودة تُحفظ هنا فقط، وما يتغيّر شي بالموقع إلا لما تضغط «اعتماد النتائج». البنود اللي تتركها فاضية ما تتغيّر.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
                <button type="button" style={{ ...S.btn, ...(dirty ? S.pri : {}) }} disabled={!dirty} onClick={() => onPatch({ results })}>{dirty ? "حفظ المسودة" : "المسودة محفوظة"}</button>
                <button type="button" style={{ ...S.btn, borderColor: "#2E7D5B", color: "#2E7D5B" }} disabled={!filled || dirty} title={dirty ? "احفظ المسودة أولًا" : ""} onClick={() => onApply(filled)}><Check size={15} />اعتماد النتائج على الموقع ({filled})</button>
              </div>
            </div>
          )}
          {published && <div style={{ ...S.card, background: "#F2F8F4", borderColor: "#BFDCCB", fontSize: 13 }}>اعتُمدت نتائج هذا الاجتماع ونزلت على الاستفسارات. المحضر متاح للطباعة.</div>}
          {sections.filter((s) => (s.ids || []).length).map((s, si) => (
            <div key={si} style={S.card}>
              <h3 style={{ ...S.h, marginBottom: 10 }}>{s.title}</h3>
              {s.ids.map((id, idx) => {
                const r = byId[id]; const res = results[id] || {};
                return (
                  <div key={id} style={{ padding: "12px 0", borderTop: idx ? "1px solid #EEF2F5" : 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}><b style={{ fontSize: 14 }}>{id}</b>{r && <span style={S.chip(PRI_COLOR[r.pri] || "#5F7280")}>{r.pri}</span>}{r && <span style={{ fontSize: 12, color: "#5F7280" }}>{r.loc}</span>}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.85, margin: "6px 0 8px", color: "#33424D" }}>{r ? r.note : "البند غير موجود"}</div>
                    <textarea value={res.reply || ""} disabled={published || !canEdit} onChange={(e) => setRes(id, { reply: e.target.value.slice(0, 3000) })} rows={2} placeholder="رد المطور في الاجتماع" style={{ ...S.inp, width: "100%", resize: "vertical", lineHeight: 1.8 }} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 8 }}>
                      <select value={res.status || ""} disabled={published || !canEdit} onChange={(e) => setRes(id, { status: e.target.value })} aria-label="حالة المقترح" style={{ ...S.inp, padding: "6px 10px" }}>
                        {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{v ? `الحالة: ${l}` : l}</option>)}
                      </select>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!res.close} disabled={published || !canEdit} onChange={(e) => setRes(id, { close: e.target.checked })} />إقفال البند
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function AMeetingsTab({ inquiries, refreshInquiries, flashToast, log, canEdit }) {
  const [rows, setRows] = useState(null);     // null = تحميل · "missing" = الهجرة ما اشتغلت
  const [openId, setOpenId] = useState(null);
  const [title, setTitle] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("meetings").select("*").order("created_at", { ascending: false });
    setRows(error ? "missing" : data || []);
  };
  useEffect(() => { load(); }, []);

  if (rows === "missing") return <div style={S.wrap} dir="rtl"><div style={S.card}>الخاصية تحتاج تجهيز قاعدة البيانات مرة واحدة: شغّل ملف <b>migration-meetings.sql</b> ثم حدّث الصفحة.</div></div>;
  if (!rows) return <div style={S.wrap}>جارٍ التحميل…</div>;

  const cur = rows.find((r) => r.id === openId);
  const patch = async (p, quiet) => {
    setRows((xs) => xs.map((x) => (x.id === cur.id ? { ...x, ...p } : x)));
    const { data, error } = await supabase.from("meetings").update(p).eq("id", cur.id).select().single();
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); load(); return; }
    if (!quiet) setRows((xs) => xs.map((x) => (x.id === cur.id ? data : x)));
    if (p.status) log("الاجتماعات", `${cur.title}: ${STAGE[p.status][0]}`);
    if (p.results) flashToast("حُفظت المسودة");
  };
  const apply = async (n) => {
    if (!window.confirm(`اعتماد نتائج «${cur.title}»؟\nبتنزل ردود ${n} بند على الاستفسارات بالموقع فورًا (مع نسخة احتياطية قبلها)، وما تقدر تعدّل المحضر بعدها.`)) return;
    const { data, error } = await supabase.rpc("meeting_apply", { p_id: cur.id });
    if (error) { flashToast(`تعذّر الاعتماد: ${error.message}`); return; }
    flashToast(`تم: تحدّث ${data?.updated ?? 0} بند، وأُقفل ${data?.closed ?? 0}`);
    log("الاجتماعات", `اعتماد نتائج ${cur.title}: ${data?.updated ?? 0} بند محدّث، ${data?.closed ?? 0} مقفل`);
    await load(); if (refreshInquiries) refreshInquiries();
  };
  const del = async () => {
    if (!window.confirm(`حذف «${cur.title}»؟ (الاستفسارات نفسها ما تتأثر)`)) return;
    const { error } = await supabase.from("meetings").delete().eq("id", cur.id);
    if (error) { flashToast(`تعذّر الحذف: ${error.message}`); return; }
    log("الاجتماعات", `حذف ${cur.title}`); setOpenId(null); load();
  };
  const create = async () => {
    const t = title.trim(); if (t.length < 2) { flashToast("اكتب اسم الاجتماع (مثل: الاجتماع الثامن)"); return; }
    const { data, error } = await supabase.from("meetings").insert({ title: t, sections: DEFAULT_SECTIONS }).select().single();
    if (error) { flashToast(`تعذّر الإنشاء: ${error.message}`); return; }
    log("الاجتماعات", `إنشاء ${t}`); setTitle(""); setRows((xs) => [data, ...xs]); setOpenId(data.id);
  };

  if (cur) return <MeetingEditor m={cur} inquiries={inquiries} onPatch={patch} onApply={apply} onDelete={del} onBack={() => { setOpenId(null); load(); }} flashToast={flashToast} canEdit={canEdit} />;

  const openCount = inquiries.filter((r) => !isClosed(r)).length;
  return (
    <div style={S.wrap} dir="rtl">
      <div style={S.card}>
        <h3 style={S.h}><CalendarDays size={17} />وضع الاجتماع</h3>
        <p style={S.sub}>جهّز جدول الأعمال من البنود المفتوحة ({openCount} بند)، اطبعه PDF، وبعد الاجتماع سجّل ردود المطور واعتمدها على الموقع بضغطة وحدة.</p>
        {canEdit && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} placeholder="اسم الاجتماع — مثال: الاجتماع الثامن" style={{ ...S.inp, flex: "1 1 220px" }} />
          <button type="button" style={{ ...S.btn, ...S.pri }} onClick={create}><Plus size={15} />اجتماع جديد</button>
        </div>}
      </div>
      {!rows.length ? <div style={{ ...S.card, textAlign: "center", color: "#5F7280", fontSize: 13.5 }}>ما في اجتماعات بعد.</div> : rows.map((r) => {
        const st = STAGE[r.status] || STAGE.draft; const n = (r.sections || []).reduce((a, s) => a + (s.ids || []).length, 0);
        return (
          <button key={r.id} type="button" onClick={() => setOpenId(r.id)} style={{ ...S.card, width: "100%", textAlign: "start", cursor: "pointer", font: "inherit", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <b style={{ fontSize: 14.5 }}>{r.title}</b>
            <span style={S.chip(st[1])}>{st[0]}</span>
            <span style={{ fontSize: 12.5, color: "#5F7280" }}>{n} بند{r.held_on ? ` · ${dmy(r.held_on)}` : ""}</span>
          </button>
        );
      })}
    </div>
  );
}
