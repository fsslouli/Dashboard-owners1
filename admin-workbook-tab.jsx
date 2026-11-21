/* ═══════════════════════════════════════════════════════════
   admin-workbook-tab.jsx — «ملف الإكسل» (7.10.0)
   ملف الاستفسارات الكامل (كل الشيتات والتنسيق كما هو) محفوظ بخزنة خاصة «workbook» بنسخ مرقّمة:
   • آخر نسخة: تنزيل · رفع نسخة جديدة · فحص مطابقة تلقائي مع الموقع (نفس محرك المزامنة، قراءة فقط).
   • كل النسخ: تنزيل أي نسخة. ما فيه حذف ولا تعديل — كل رفع = نسخة جديدة والقديمة تبقى.
   • المساعد يرفع ويقرأ عبر الدالة workbook-intake (مفتاح سري)، والأدمن من هنا بصلاحية import_excel.
   • خاص بالإدارة: ما يوصله الملاك ولا الزوار ولا روابط المشاركة (الخزنة خاصة + RLS) — راجع migration-workbook.sql.
   ═══════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, Clock, Download, FileSpreadsheet, History, Info, Lock, RefreshCw, Upload, User, X } from "lucide-react";
import { useSystemTheme } from "./admin-core.jsx";
import { MatchResult, matchCheck, readInquiriesSheet } from "./admin-match-check.jsx";

const BUCKET = "workbook";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_BYTES = 25 * 1024 * 1024;
const FIRST_ROWS = 8;

/* 21-11-2026، 1:00 م — بتوقيت الرياض */
export function fmtRiyadh(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hour12: true })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  const pm = String(p.dayPeriod || "").toLowerCase().startsWith("p");
  return `${p.day}-${p.month}-${p.year}، ${p.hour}:${p.minute} ${pm ? "م" : "ص"}`;
}
const kb = (n) => `${Math.max(1, Math.round((Number(n) || 0) / 1024))} ك.ب`;
/* رقم النسخة من اسم الملف: ..._v53.xlsx ← 53 */
export const verOfName = (name) => { const m = String(name || "").match(/[_\-\s.]v(\d{1,4})(?=[^\d]*$)/i); return m ? Number(m[1]) : null; };
async function sha256Hex(buf) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); }));

export function AWorkbookTab({ supabase, inquiries, categories, flashToast, log, canUpload }) {
  const T = useSystemTheme();
  const good = T.sta?.["معتمدة"] || "#1E8E5A";
  const bad = T.sta?.["تم الرفض"] || "#C0392B";
  const warnC = T.sta?.["قيد الدراسة"] || "#8A6318";

  const [rows, setRows] = useState(null); /* null = جارٍ التحميل */
  const [loadErr, setLoadErr] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busyV, setBusyV] = useState(null);
  const [check, setCheck] = useState({ state: "idle" });
  const [showDiff, setShowDiff] = useState(false);
  const [up, setUp] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("workbook_versions").select("*").order("version_no", { ascending: false }).limit(200);
    if (error) { setLoadErr(error.message || "تعذّر التحميل"); setRows([]); return; }
    setLoadErr(""); setRows(data || []);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  const latest = rows && rows.length ? rows[0] : null;

  const fetchBlob = useCallback(async (row) => {
    const { data, error } = await supabase.storage.from(BUCKET).download(row.storage_path);
    if (error || !data) throw error || new Error("download_failed");
    return data;
  }, [supabase]);

  const download = async (row) => {
    if (busyV) return;
    setBusyV(row.version_no);
    try {
      const blob = await fetchBlob(row);
      saveBlob(new Blob([blob], { type: XLSX_TYPE }), row.file_name || `workbook_v${row.version_no}.xlsx`);
      if (log) log("تنزيل ملف الإكسل الرئيسي", `v${row.version_no} — ${row.file_name}`);
    } catch { flashToast("تعذّر تنزيل الملف"); }
    setBusyV(null);
  };

  const runCheck = useCallback(async (row) => {
    if (!row) return;
    setCheck({ state: "running", v: row.version_no });
    try {
      const blob = await fetchBlob(row);
      const p = readInquiriesSheet(await blob.arrayBuffer(), categories);
      if (!p.sheet) { setCheck({ state: "error", v: row.version_no, msg: "ما لقيت شيت «الاستفسارات» بالملف" }); return; }
      setCheck({ state: "done", v: row.version_no, res: { file: row.file_name, sheet: p.sheet, at: new Date(), ...matchCheck(p.rows, inquiries) } });
    } catch { setCheck({ state: "error", v: row.version_no, msg: "تعذّرت قراءة الملف للفحص" }); }
  }, [fetchBlob, categories, inquiries]);

  /* فحص تلقائي لآخر نسخة أول ما يفتح التبويب (بعد ما تتحمّل الاستفسارات) */
  const autoKey = latest && inquiries && inquiries.length ? `${latest.version_no}:${inquiries.length}` : "";
  useEffect(() => { if (autoKey) runCheck(latest); }, [autoKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── رفع نسخة جديدة ── */
  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { flashToast("الملف لازم يكون إكسل ‎.xlsx"); return; }
    if (file.size > MAX_BYTES) { flashToast("الملف أكبر من 25 ميجا"); return; }
    setUp({ file, reading: true, note: "", warns: [] });
    try {
      const buf = await file.arrayBuffer();
      const sha = await sha256Hex(buf);
      const p = readInquiriesSheet(buf, categories);
      const count = p.rows.filter((r) => String(r.id ?? "").trim() !== "").length;
      const warns = [];
      if (latest && latest.sha256 && latest.sha256 === sha) warns.push({ block: true, t: `هذا نفس ملف آخر نسخة (v${latest.version_no}) بالضبط، فما يحتاج رفع.` });
      if (!p.sheet) warns.push({ t: "ما لقيت شيت «الاستفسارات» بالملف. تأكد إنه ملف الاستفسارات الصحيح." });
      if (latest && p.sheet && latest.inquiry_count != null && count < latest.inquiry_count) warns.push({ t: `الملف فيه ${count} استفسار، وآخر نسخة فيها ${latest.inquiry_count}. يمكن يكون أقدم.` });
      const fv = verOfName(file.name);
      if (latest && fv != null && fv < latest.version_no) warns.push({ t: `اسم الملف يقول v${fv}، وآخر نسخة بالموقع v${latest.version_no}. يمكن يكون أقدم.` });
      const lastSheets = Array.isArray(latest?.sheet_names) ? latest.sheet_names.length : 0;
      if (latest && p.sheetNames.length < lastSheets) warns.push({ t: `الملف فيه ${p.sheetNames.length} شيت، وآخر نسخة فيها ${lastSheets}. يمكن فيه شيتات ناقصة.` });
      setUp({ file, sha, sheets: p.sheetNames || [], count: p.sheet ? count : null, warns, note: "", reading: false });
    } catch { setUp(null); flashToast("تعذّرت قراءة الملف"); }
  };

  const doUpload = async () => {
    if (!up || up.reading || up.saving || up.warns.some((w) => w.block)) return;
    setUp((u) => ({ ...u, saving: true }));
    const path = `admin/${uuid()}.xlsx`;
    const { error: e1 } = await supabase.storage.from(BUCKET).upload(path, up.file, { contentType: XLSX_TYPE, upsert: false });
    if (e1) { setUp((u) => ({ ...u, saving: false })); flashToast("تعذّر رفع الملف"); return; }
    const note = (up.note || "").trim();
    const { data, error: e2 } = await supabase.rpc("workbook_register", {
      p_path: path, p_file_name: up.file.name, p_size: up.file.size, p_sha256: up.sha,
      p_sheet_names: up.sheets, p_inquiry_count: up.count, p_note: note,
    });
    if (e2 || !data) { setUp((u) => ({ ...u, saving: false })); flashToast("انرفع الملف لكن ما تسجّلت النسخة. جرّب مرة ثانية"); return; }
    const v = (Array.isArray(data) ? data[0] : data)?.version_no;
    if (log) log("رفع نسخة من ملف الإكسل الرئيسي", `v${v} — ${up.file.name}${note ? ` — ${note.slice(0, 80)}` : ""}`);
    flashToast(`تم الرفع، وصارت v${v} آخر نسخة`);
    setUp(null); setShowDiff(false); load();
  };

  /* ── تنسيقات ── */
  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 };
  const btn = (pri) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 11, padding: "10px 16px",
    fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    background: pri ? T.brass : "none", color: pri ? T.onAccent : T.brass, border: pri ? "none" : `1px solid ${T.brass}55`,
  });
  const pill = (bg, fg) => ({ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px", background: bg, color: fg });
  const tile = { background: T.sunken, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start", minWidth: 0 };
  const metaRow = { display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12, color: T.muted, alignItems: "center" };
  const byIcon = (r) => (r.source === "assistant" ? <Bot size={13} /> : <User size={13} />);
  const byText = (r) => (r.source === "assistant" ? `${r.uploaded_by_name || "المساعد"} من المحادثة` : `${r.uploaded_by_name || "الإدارة"} من اللوحة`);

  if (rows === null) return <div style={{ ...card, color: T.muted, fontSize: 13 }}>جارٍ التحميل...</div>;
  if (loadErr) return <div style={{ ...card, color: bad, fontSize: 13, lineHeight: 1.8 }}>تعذّر قراءة سجل النسخ: {loadErr}</div>;

  const chk = check.v === latest?.version_no ? check : { state: "idle" };
  const list = showAll ? rows : rows.slice(0, FIRST_ROWS);
  const sheetsOfLatest = Array.isArray(latest?.sheet_names) ? latest.sheet_names : [];

  const matchTile = () => {
    if (chk.state === "running") return <div style={tile}><b style={{ fontSize: 20, fontWeight: 800, color: T.muted, display: "flex" }}><RefreshCw size={20} /></b><span style={{ fontSize: 12, color: T.muted }}>جارٍ فحص المطابقة…</span></div>;
    if (chk.state === "done" && chk.res.ok) return <div style={tile}><b style={{ display: "flex", color: good }}><CheckCircle2 size={22} /></b><span style={{ fontSize: 12, color: good }}>مطابق للموقع</span></div>;
    if (chk.state === "done") {
      const n = chk.res.diffs.length + chk.res.onlyFile.length + chk.res.onlySite.length;
      return (
        <button onClick={() => setShowDiff((s) => !s)} style={{ ...tile, border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }} aria-expanded={showDiff}>
          <b style={{ fontSize: 20, fontWeight: 800, color: bad, display: "flex", alignItems: "center", gap: 6 }}><X size={20} /> {n}</b>
          <span style={{ fontSize: 12, color: bad }}>فرق مع الموقع (اضغط للتفاصيل)</span>
        </button>
      );
    }
    if (chk.state === "error") return <div style={tile}><b style={{ display: "flex", color: warnC }}><AlertTriangle size={20} /></b><span style={{ fontSize: 12, color: warnC }}>{chk.msg}</span></div>;
    return <div style={tile}><b style={{ display: "flex", color: T.muted }}><Clock size={20} /></b><span style={{ fontSize: 12, color: T.muted }}>المطابقة: لم تُفحص</span></div>;
  };

  const uploadPanel = () => (
    <div style={{ marginTop: 14, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, background: T.bg, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700 }}><Upload size={15} color={T.brass} /> رفع نسخة جديدة</div>
      {up.reading ? (
        <div style={{ fontSize: 12.5, color: T.muted }}>جارٍ قراءة الملف…</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px" }}>
            <FileSpreadsheet size={18} color={T.brass} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div dir="ltr" style={{ fontSize: 12.5, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", textAlign: "left", overflowWrap: "anywhere" }}>{up.file.name}</div>
              <div style={{ fontSize: 11.5, color: T.muted }}>{up.sheets.length} شيت{up.count != null ? ` · ${up.count} استفسار` : ""} · {kb(up.file.size)}</div>
            </div>
            <button onClick={() => fileRef.current?.click()} style={{ ...btn(false), padding: "7px 12px", fontSize: 12.5 }}>تغيير</button>
          </div>
          {up.warns.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: w.block ? bad : warnC, display: "flex", gap: 7, alignItems: "flex-start", lineHeight: 1.7 }}><AlertTriangle size={14} style={{ marginTop: 3, flexShrink: 0 }} /> {w.t}</div>
          ))}
          <input value={up.note} onChange={(e) => { const v = e.target.value; setUp((u) => ({ ...u, note: v })); }} maxLength={500}
            placeholder="وش تغيّر؟ (مثال: عدّلت ردود الاجتماع التاسع)" aria-label="وش تغيّر"
            style={{ background: T.surface, color: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
          <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7 }}>تنحفظ كنسخة جديدة وتصير هي آخر نسخة والمرجع. النسخ السابقة تبقى كما هي.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={doUpload} disabled={up.saving || up.warns.some((w) => w.block)}
              style={{ ...btn(true), opacity: up.saving || up.warns.some((w) => w.block) ? 0.55 : 1, cursor: up.saving ? "wait" : "pointer" }}>
              <Upload size={15} /> {up.saving ? "جارٍ الرفع…" : "رفع"}
            </button>
            <button onClick={() => setUp(null)} disabled={up.saving} style={btn(false)}>إلغاء</button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} style={{ display: "none" }} />

      {latest ? (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <FileSpreadsheet size={17} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>آخر نسخة</span>
            <span style={pill(T.sunken, T.muted)}><Lock size={12} /> خاص بالإدارة</span>
            <span style={pill(good + "22", good)}>الحالية</span>
          </div>
          <div dir="ltr" style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 13, background: T.sunken, borderRadius: 10, padding: "9px 12px", margin: "4px 0 8px", textAlign: "left", overflowWrap: "anywhere" }}>{latest.file_name}</div>
          <div style={metaRow}>
            <span style={{ color: T.paper, fontWeight: 700 }}>v{latest.version_no}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={13} /> {fmtRiyadh(latest.created_at)}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{byIcon(latest)} رفعها: {byText(latest)}</span>
            <span>{kb(latest.size_bytes)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, margin: "14px 0" }}>
            <div style={tile}><b style={{ fontSize: 20, fontWeight: 800 }}>{sheetsOfLatest.length || "—"}</b><span style={{ fontSize: 12, color: T.muted }}>شيت</span></div>
            <div style={tile}><b style={{ fontSize: 20, fontWeight: 800 }}>{latest.inquiry_count ?? "—"}</b><span style={{ fontSize: 12, color: T.muted }}>استفسار</span></div>
            {matchTile()}
          </div>
          {latest.note && <div style={{ fontSize: 12.5, lineHeight: 1.8, color: T.muted, marginBottom: 14 }}><b style={{ color: T.paper }}>وش تغيّر:</b> {latest.note}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => download(latest)} disabled={busyV != null} style={{ ...btn(true), opacity: busyV === latest.version_no ? 0.6 : 1 }}>
              <Download size={15} /> {busyV === latest.version_no ? "جارٍ التنزيل…" : "تنزيل آخر نسخة"}
            </button>
            {canUpload && <button onClick={() => fileRef.current?.click()} disabled={!!up?.saving} style={btn(false)}><Upload size={15} /> رفع نسخة جديدة</button>}
            <button onClick={() => { setShowDiff(true); runCheck(latest); }} disabled={chk.state === "running"} style={btn(false)}><RefreshCw size={15} /> فحص المطابقة</button>
          </div>
          {chk.state === "done" && showDiff && <MatchResult res={chk.res} inquiries={inquiries} onClose={() => setShowDiff(false)} />}
          {up && uploadPanel()}
          {sheetsOfLatest.length > 0 && (
            <details style={{ marginTop: 14, borderTop: `1px dashed ${T.line}`, paddingTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, listStyle: "none" }}><ChevronDown size={14} /> الشيتات ({sheetsOfLatest.length})</summary>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {sheetsOfLatest.map((s, i) => <span key={i} style={{ fontSize: 11.5, background: T.sunken, borderRadius: 999, padding: "4px 10px", color: T.muted }}>{s}</span>)}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><FileSpreadsheet size={17} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>ملف الإكسل الرئيسي</span><span style={pill(T.sunken, T.muted)}><Lock size={12} /> خاص بالإدارة</span></div>
          <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.8, marginBottom: 12 }}>ما فيه نسخة محفوظة للحين.</div>
          {canUpload && <button onClick={() => fileRef.current?.click()} style={btn(true)}><Upload size={15} /> رفع أول نسخة</button>}
          {up && uploadPanel()}
        </div>
      )}

      {rows.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><History size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>كل النسخ</span><span style={{ color: T.muted, fontSize: 12 }}>({rows.length})</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: T.sunken, borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontWeight: 800, fontSize: 13, color: T.brass, minWidth: 38 }}>v{r.version_no}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, overflowWrap: "anywhere" }}>{r.note || r.file_name}</div>
                  <div style={{ fontSize: 11, color: T.muted, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Clock size={12} /> {fmtRiyadh(r.created_at)} · {byIcon(r)} {r.uploaded_by_name || (r.source === "assistant" ? "المساعد" : "الإدارة")} · {kb(r.size_bytes)}{r.inquiry_count != null ? ` · ${r.inquiry_count} استفسار` : ""}
                    {i === 0 && <b style={{ color: good }}> · الحالية</b>}
                  </div>
                </div>
                <button onClick={() => download(r)} disabled={busyV != null} aria-label={`تنزيل v${r.version_no}`} title={`تنزيل v${r.version_no}`}
                  style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.brass, display: "flex", alignItems: "center", justifyContent: "center", cursor: busyV != null ? "wait" : "pointer", opacity: busyV === r.version_no ? 0.5 : 1 }}>
                  <Download size={15} />
                </button>
              </div>
            ))}
          </div>
          {rows.length > FIRST_ROWS && (
            <button onClick={() => setShowAll((s) => !s)} style={{ ...btn(false), marginTop: 10, padding: "7px 12px", fontSize: 12.5 }}>
              {showAll ? "عرض أقل" : `عرض كل النسخ (${rows.length})`}
            </button>
          )}
          <div style={{ fontSize: 11.5, color: T.faint, marginTop: 10 }}>كل النسخ محفوظة، ولا ينحذف شيء تلقائيًا.</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.9, color: T.muted, background: T.brass + "12", border: `1px solid ${T.brass}33`, borderRadius: 14, padding: "12px 14px" }}>
        <Info size={15} color={T.brass} style={{ marginTop: 5, flexShrink: 0 }} />
        <div><b style={{ color: T.paper }}>كيف يشتغل:</b> بعد أي تعديل على الإكسل في المحادثة، يرفع المساعد النسخة الكاملة هنا مباشرة مع سطر «وش تغيّر». وقبل أي تعديل جديد يقرأ آخر نسخة من هنا، فما تحتاج ترفع له الملف. ولو عدّلت الملف بنفسك، ارفعه بزر «رفع نسخة جديدة» عشان يصير هو المرجع. الملف خاص بالإدارة: ما يظهر للملاك ولا الزوار ولا روابط المشاركة.</div>
      </div>
    </div>
  );
}
