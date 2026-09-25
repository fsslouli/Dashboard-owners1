/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-sync-tab */
import { fmtAdminDate, useSystemTheme } from "./admin-core.jsx";
import { aNoteStyle, downloadProgressTemplate, parseMonthCell, parsePctCell, parseProgressWorkbook } from "./admin-excel-utils.jsx";
import { supabase } from "./app-bootstrap.jsx";
import { MONTH_AR, monthKeyParts, nextMonthKey } from "./site-data.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, RefreshCw, TrendingUp, Upload } from "lucide-react";

/* ── لوحة رفع ملف «بيانات تقدّم التنفيذ» — تكتب بجدول progress_readings (بلوك
   واحد + شهر واحد + نسبة لكل صف)، ومنه يُحسب كل شي آخر تلقائيًا عبر
   progress_matrix_v ويظهر بتبويب «تقدّم التنفيذ» بالموقع العام مباشرة لكل
   الزوّار عبر Supabase Realtime، بدون أي تعديل كود ولا إعادة نشر. ── */
export function ProgressReadingsSync({ flashToast, canImport, log }) {
  const T = useSystemTheme();
  const fileRef = useRef(null);
  const wbRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [current, setCurrent] = useState([]);
  const [blocksMeta, setBlocksMeta] = useState([]);
  const [monthNotes, setMonthNotes] = useState({});
  const [currentPhaseOverrides, setCurrentPhaseOverrides] = useState([]);
  const [newBlockPhase, setNewBlockPhase] = useState({});
  const [forceMonths, setForceMonths] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [mode, setMode] = useState("file"); // "file" | "manual"
  const [entryMonth, setEntryMonth] = useState("");
  const [blockValues, setBlockValues] = useState({});
  const [phaseValues, setPhaseValues] = useState({ p1: "", p2: "", p3: "", p4: "" });
  const [skipMonth, setSkipMonth] = useState(false);
  const [skipNote, setSkipNote] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  const loadCurrent = () => supabase.from("progress_readings").select("*").then(({ data }) => setCurrent(data || []));
  const loadBlocks = () => supabase.from("progress_blocks").select("*").order("sort_order").then(({ data }) => setBlocksMeta(data || []));
  const loadNotes = () => supabase.from("progress_month_notes").select("*").then(({ data }) => setMonthNotes(Object.fromEntries((data || []).map((n) => [n.month, n.note]))));
  const loadPhaseOverrides = () => supabase.from("progress_phase_overrides").select("*").then(({ data }) => setCurrentPhaseOverrides(data || []));
  useEffect(() => { loadCurrent(); loadBlocks(); loadNotes(); loadPhaseOverrides(); }, []);

  const knownBlockNumbers = useMemo(() => new Set(blocksMeta.map((b) => b.block_number)), [blocksMeta]);

  /* أول ما تتوفر البيانات، اقترح الشهر التالي تلقائيًا للإدخال المباشر —
     الأدمن يقدر يغيّره لأي شهر ثاني يبي يراجعه أو يصححه. */
  useEffect(() => {
    if (entryMonth || !current.length) return;
    const lastMonth = [...new Set(current.map((r) => r.month))].sort().pop();
    if (lastMonth) setEntryMonth(nextMonthKey(lastMonth));
  }, [current, entryMonth]);

  /* تغيير الشهر بالإدخال المباشر: لو الشهر عنده بيانات مسجَّلة فعلًا، تُحمَّل
     كما هي للتصحيح؛ غير كذا تُقترح آخر نسبة معروفة لكل بلوك كنقطة بداية بدل
     ما يكتب الأدمن ١٦ رقم من الصفر كل مرة. */
  useEffect(() => {
    if (!entryMonth || !blocksMeta.length) return;
    const monthRows = current.filter((r) => r.month === entryMonth);
    if (monthRows.length) {
      setBlockValues(Object.fromEntries(monthRows.map((r) => [r.block_number, String(r.pct)])));
    } else {
      const latest = {};
      current.filter((r) => r.month < entryMonth).forEach((r) => {
        if (!latest[r.block_number] || r.month > latest[r.block_number].month) latest[r.block_number] = r;
      });
      setBlockValues(Object.fromEntries(Object.entries(latest).map(([b, r]) => [b, String(r.pct)])));
    }
    const monthOverrides = currentPhaseOverrides.filter((o) => o.month === entryMonth);
    setPhaseValues({
      p1: monthOverrides.find((o) => o.phase === "p1")?.pct ?? "",
      p2: monthOverrides.find((o) => o.phase === "p2")?.pct ?? "",
      p3: monthOverrides.find((o) => o.phase === "p3")?.pct ?? "",
      p4: monthOverrides.find((o) => o.phase === "p4")?.pct ?? "",
    });
    setSkipMonth(monthNotes[entryMonth] != null);
    setSkipNote(monthNotes[entryMonth] || "");
  }, [entryMonth, blocksMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  const setBlockValue = (b, v) => setBlockValues((s) => ({ ...s, [b]: v }));
  const setPhaseValue = (p, v) => setPhaseValues((s) => ({ ...s, [p]: v }));

  const submitManual = async () => {
    if (!canImport) { flashToast('ما عندك صلاحية "رفع ومزامنة بيانات من إكسل" اللازمة'); return; }
    const mk = parseMonthCell(entryMonth);
    if (!mk) { flashToast('اكتب الشهر بصيغة صحيحة، مثل 2026-09'); return; }
    setSubmittingManual(true);
    try {
      if (skipMonth) {
        const { error } = await supabase.from("progress_month_notes").upsert(
          { month: mk, note: skipNote.trim(), updated_at: new Date().toISOString() }, { onConflict: "month" }
        );
        if (error) throw error;
        log("تحديث تقدّم التنفيذ (إدخال مباشر)", `${mk}: لا قراءة — ${skipNote.trim() || "بلا سبب مذكور"}`);
        flashToast("تم تسجيل الشهر كـ«لا قراءة» بالموقع");
      } else {
        const rows = [];
        for (const b of blocksMeta.map((x) => x.block_number)) {
          const raw = blockValues[b];
          if (raw == null || String(raw).trim() === "") continue;
          const pr = parsePctCell(raw);
          if (pr.error) { flashToast(`نسبة البلوك ${b} غير صالحة: ${pr.error}`); setSubmittingManual(false); return; }
          rows.push({ block_number: b, month: mk, pct: pr.value, updated_at: new Date().toISOString() });
        }
        if (!rows.length) { flashToast("ما فيه أي بلوك مُعبّى — اكتب نسبة بلوك واحد على الأقل، أو فعّل «لا قراءة»"); setSubmittingManual(false); return; }

        const { data: backupRows } = await supabase.from("progress_readings").select("*");
        await supabase.from("progress_readings_backups").insert({
          label: `قبل إدخال مباشر لتقدّم التنفيذ بتاريخ ${fmtAdminDate(new Date())}`,
          rows: backupRows || [],
        });
        const { data: oldBackups } = await supabase.from("progress_readings_backups").select("id").order("created_at", { ascending: false });
        if (oldBackups && oldBackups.length > 5) {
          await supabase.from("progress_readings_backups").delete().in("id", oldBackups.slice(5).map((x) => x.id));
        }
        const { error } = await supabase.from("progress_readings").upsert(rows, { onConflict: "block_number,month" });
        if (error) throw error;

        /* نسب مراحل مباشرة — تُكتب لو مُعبّاة، وتُحذف لو كانت موجودة وصارت فاضية
           (يعني الأدمن رجع يعتمد متوسط البلوكات بدل الرقم المباشر). */
        const upsertPhases = [], deletePhases = [];
        for (const p of ["p1", "p2", "p3", "p4"]) {
          const raw = phaseValues[p];
          const hadBefore = currentPhaseOverrides.some((o) => o.phase === p && o.month === mk);
          if (raw == null || String(raw).trim() === "") { if (hadBefore) deletePhases.push(p); continue; }
          const pr = parsePctCell(raw);
          if (pr.error) { flashToast(`نسبة ${PHASE_LABEL[p]} غير صالحة: ${pr.error}`); setSubmittingManual(false); return; }
          upsertPhases.push({ phase: p, month: mk, pct: pr.value, updated_at: new Date().toISOString() });
        }
        if (upsertPhases.length) {
          const { error } = await supabase.from("progress_phase_overrides").upsert(upsertPhases, { onConflict: "phase,month" });
          if (error) throw error;
        }
        for (const p of deletePhases) {
          await supabase.from("progress_phase_overrides").delete().eq("phase", p).eq("month", mk);
        }
        /* لو الشهر كان مسجَّلاً "لا قراءة" من قبل وصار له إدخال حقيقي الحين، نشيل الملاحظة. */
        if (monthNotes[mk] != null) await supabase.from("progress_month_notes").delete().eq("month", mk);

        log("تحديث تقدّم التنفيذ (إدخال مباشر)", `${mk}: ${rows.length} بلوك${upsertPhases.length ? ` + ${upsertPhases.length} نسبة مرحلة` : ""}`);
        flashToast("تم تحديث تقدّم التنفيذ بالموقع");
      }
      loadCurrent(); loadNotes(); loadPhaseOverrides();
    } catch {
      flashToast("تعذّر تحديث تقدّم التنفيذ — لم يتغيّر شي بالبيانات الحالية");
    }
    setSubmittingManual(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
        wbRef.current = wb;
        setParsed(parseProgressWorkbook(wb, knownBlockNumbers));
        setForceMonths(new Set()); setNewBlockPhase({});
      } catch { wbRef.current = null; setParsed({ error: "تعذّرت قراءة الملف — تأكد إنه ملف إكسل صالح (.xlsx)." }); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const currentByKey = useMemo(() => new Map(current.map((r) => [`${r.block_number}|${r.month}`, r.pct])), [current]);
  const currentCountByMonth = useMemo(() => {
    const m = new Map(); current.forEach((r) => m.set(r.month, (m.get(r.month) || 0) + 1)); return m;
  }, [current]);

  /* حماية من فقدان البيانات، على مستوى الشهر: لو الملف أعطى عدد بلوكات أقل
     بكثير مما هو مسجَّل فعليًا لشهر معيّن، يُستبعد هذا الشهر تلقائيًا من
     التحديث ويحتاج تأكيدًا صريحًا — تمامًا نفس فلسفة الحماية بالنظام القديم،
     لكن على مستوى بلوك واحد بدل ملف كامل، فالتشخيص أدق. */
  const diffByMonth = useMemo(() => {
    if (!parsed || parsed.error || !parsed.readings.length) return [];
    const byMonth = new Map();
    parsed.readings.forEach((r) => { (byMonth.get(r.month) || byMonth.set(r.month, []).get(r.month)).push(r); });
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, rows]) => {
      const curCount = currentCountByMonth.get(month) || 0;
      const dataLoss = curCount >= 4 && rows.length < curCount / 2;
      const items = rows.map((r) => {
        const prev = currentByKey.get(`${r.block}|${r.month}`);
        const isNew = prev == null;
        const changed = !isNew && Math.abs(prev - r.pct) > 0.004;
        return { ...r, isNew, changed, prev };
      });
      return {
        month, items, dataLoss, curCount,
        newCount: items.filter((x) => x.isNew).length,
        changedCount: items.filter((x) => x.changed).length,
      };
    });
  }, [parsed, currentByKey, currentCountByMonth]);

  const toggleForce = (mk) => setForceMonths((s) => { const n = new Set(s); n.has(mk) ? n.delete(mk) : n.add(mk); return n; });

  const registerNewBlocks = async () => {
    const entries = Object.entries(newBlockPhase).filter(([, ph]) => ph);
    if (!entries.length) { flashToast("اختر مرحلة كل بلوك جديد أولًا"); return; }
    setRegistering(true);
    try {
      const maxOrder = blocksMeta.reduce((m, b) => Math.max(m, b.sort_order), 0);
      const rows = entries.map(([bnum, phase], i) => ({ block_number: +bnum, phase, sort_order: maxOrder + i + 1 }));
      const { error } = await supabase.from("progress_blocks").insert(rows);
      if (error) throw error;
      log("تسجيل بلوكات جديدة بتقدّم التنفيذ", entries.map(([b, p]) => `${b}→${p}`).join("، "));
      flashToast("تم تسجيل البلوكات الجديدة");
      await loadBlocks();
      if (wbRef.current) setParsed(parseProgressWorkbook(wbRef.current, new Set([...knownBlockNumbers, ...entries.map(([b]) => +b)])));
    } catch { flashToast("تعذّر تسجيل البلوكات الجديدة"); }
    setRegistering(false);
  };

  const apply = async () => {
    if (!canImport) { flashToast('ما عندك صلاحية "رفع ومزامنة بيانات من إكسل" اللازمة'); return; }
    if (!parsed || parsed.error) return;
    if (!diffByMonth.length && !parsed.skips.length && !parsed.phaseOverrides.length) return;
    if (parsed.unknownBlocks.length) { flashToast("سجّل مرحلة البلوكات الجديدة أولًا قبل التحديث — تحت قائمة التحذيرات."); return; }
    const monthsToWrite = diffByMonth.filter((m) => !m.dataLoss || forceMonths.has(m.month));
    const toWrite = monthsToWrite.flatMap((m) => m.items);
    if (!toWrite.length && !parsed.skips.length && !parsed.phaseOverrides.length) { flashToast("كل الأشهر مستثناة بسبب حماية فقدان البيانات — راجع التحذيرات."); return; }
    setApplying(true);
    try {
      if (toWrite.length) {
        const { data: backupRows } = await supabase.from("progress_readings").select("*");
        await supabase.from("progress_readings_backups").insert({
          label: `قبل رفع بيانات التقدم بتاريخ ${fmtAdminDate(new Date())}`,
          rows: backupRows || [],
        });
        const { data: oldBackups } = await supabase.from("progress_readings_backups").select("id").order("created_at", { ascending: false });
        if (oldBackups && oldBackups.length > 5) {
          await supabase.from("progress_readings_backups").delete().in("id", oldBackups.slice(5).map((b) => b.id));
        }
        const rows = toWrite.map((r) => ({ block_number: r.block, month: r.month, pct: r.pct, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from("progress_readings").upsert(rows, { onConflict: "block_number,month" });
        if (error) throw error;
      }
      if (parsed.skips.length) {
        const noteRows = parsed.skips.map((s) => ({ month: s.month, note: s.note, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from("progress_month_notes").upsert(noteRows, { onConflict: "month" });
        if (error) throw error;
      }
      if (parsed.phaseOverrides.length) {
        const phaseRows = parsed.phaseOverrides.map((o) => ({ phase: o.phase, month: o.month, pct: o.pct, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from("progress_phase_overrides").upsert(phaseRows, { onConflict: "phase,month" });
        if (error) throw error;
      }
      const parts = [];
      if (toWrite.length) parts.push(`${toWrite.length} قراءة عبر ${monthsToWrite.length} شهر`);
      if (parsed.skips.length) parts.push(`${parsed.skips.length} ملاحظة "لا قراءة"`);
      if (parsed.phaseOverrides.length) parts.push(`${parsed.phaseOverrides.length} نسبة مرحلة مباشرة`);
      log("رفع بيانات تقدّم التنفيذ", `${parts.join(" + ")} — ${fileName}`);
      const skipped = diffByMonth.length - monthsToWrite.length;
      flashToast(skipped > 0 ? `تم التحديث — استُثني ${skipped} شهر بسبب حماية فقدان البيانات` : "تم تحديث تقدّم التنفيذ بالموقع");
      setParsed(null); wbRef.current = null; setFileName(""); setForceMonths(new Set());
      loadCurrent(); loadNotes(); loadPhaseOverrides();
    } catch {
      flashToast("تعذّر تحديث تقدّم التنفيذ — لم يتغيّر شي بالبيانات الحالية");
    }
    setApplying(false);
  };

  if (!canImport) return null;
  const PHASE_LABEL = { p1: "الأولى", p2: "الثانية", p3: "الثالثة", p4: "الرابعة" };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <TrendingUp size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>تحديث بيانات تقدّم التنفيذ</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: T.sunken, borderRadius: 11, padding: 4, width: "fit-content" }}>
        <button onClick={() => setMode("file")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: mode === "file" ? T.brass : "transparent", color: mode === "file" ? "#fff" : T.muted, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          <FileSpreadsheet size={13} /> ملف إكسل
        </button>
        <button onClick={() => setMode("manual")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: mode === "manual" ? T.brass : "transparent", color: mode === "manual" ? "#fff" : T.muted, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          <TrendingUp size={13} /> إدخال مباشر بالموقع
        </button>
      </div>

      {mode === "file" && (
      <>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "4px 0 14px", lineHeight: 1.7 }}>
        ملف بسيط بأعمدة: رقم البلوك، الشهر، نسبة الإنجاز — صف واحد لكل بلوك بكل شهر.
        نزّل الملف الحالي — يجيك بآخره سطور الشهر الجديد فاضية جاهزة، بس عبّي الأرقام وارفعه هنا.
        نسبة كل مرحلة تُحسب تلقائيًا من متوسط بلوكاتها، والإجمالي من متوسط المراحل الأربع — إلا لو كتبت رقمًا
        مباشرًا من المطوّر (سطر بعمود رقم البلوك اكتب فيه اسم المرحلة مثل <b>"المرحلة الأولى"</b> بدل رقم بلوك)، فيُعتمد
        هو بدل المتوسط لذاك الشهر بالذات.
        شهر ما وصلت فيه قراءة من المطوّر؟ سطر واحد بعمود رقم البلوك اكتب فيه <b>"لا قراءة"</b> مع الشهر وسبب مختصر
        بعمود الملاحظة — يظهر للزائر بنص واضح بدل فجوة صامتة.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, background: T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          <Upload size={15} /> رفع ملف بيانات التقدم
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => downloadProgressTemplate(current, blocksMeta, monthNotes, currentPhaseOverrides)} disabled={!current.length}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", color: T.brass, border: `1px solid ${T.brass}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: current.length ? "pointer" : "default", opacity: current.length ? 1 : 0.5 }}>
          <FileSpreadsheet size={15} /> تنزيل الملف الحالي
        </button>
        {fileName && <span style={{ fontSize: 12, color: T.muted }}>{fileName}</span>}
      </div>

      {parsed?.error && <div style={{ ...aNoteStyle(T, "#c0392b"), marginTop: 14 }}>{parsed.error}</div>}

      {parsed && !parsed.error && (
        <div style={{ marginTop: 16 }}>
          {parsed.errors?.length > 0 && (
            <div style={{ ...aNoteStyle(T, "#c0392b"), marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{parsed.errors.length} صف تجاوزناه — صحّح بالملف وأعد الرفع:</div>
              {parsed.errors.slice(0, 30).map((w, i) => <div key={i}>⚠ {w}</div>)}
              {parsed.errors.length > 30 && <div>… و{parsed.errors.length - 30} صفًا آخر</div>}
            </div>
          )}

          {parsed.unknownBlocks?.length > 0 && (
            <div style={{ ...aNoteStyle(T, "#b8860b"), marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>بلوكات جديدة غير مسجّلة — اختر مرحلة كل بلوك ثم سجّلها قبل التحديث:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {parsed.unknownBlocks.map((b) => (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span>بلوك {b}</span>
                    <select value={newBlockPhase[b] || ""} onChange={(e) => setNewBlockPhase((s) => ({ ...s, [b]: e.target.value }))}
                      style={{ padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, fontSize: 12.5 }}>
                      <option value="">اختر المرحلة…</option>
                      <option value="p1">المرحلة الأولى</option>
                      <option value="p2">المرحلة الثانية</option>
                      <option value="p3">المرحلة الثالثة</option>
                      <option value="p4">المرحلة الرابعة</option>
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={registerNewBlocks} disabled={registering} style={{ marginTop: 8, background: "#b8860b", color: "#fff", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                {registering ? "جارٍ التسجيل..." : "تسجيل البلوكات الجديدة"}
              </button>
            </div>
          )}

          {parsed.readings.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 8 }}>
                {parsed.readings.length} قراءة صالحة عبر {parsed.monthsFound.length} شهر: {parsed.monthsFound.join(" · ")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {diffByMonth.map((m) => {
                  const { y, m: mm } = monthKeyParts(m.month);
                  return (
                    <div key={m.month} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: m.dataLoss ? "#c0392b22" : T.sunken, border: m.dataLoss ? "1px solid #c0392b" : "none", borderRadius: 9, padding: "8px 12px" }}>
                      <span style={{ fontSize: 12.5 }}>{MONTH_AR[mm - 1]} {y} — {m.items.length} بلوك</span>
                      {m.dataLoss ? (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c0392b", cursor: "pointer" }}>
                          <input type="checkbox" checked={forceMonths.has(m.month)} onChange={() => toggleForce(m.month)} />
                          ⚠ الملف فيه بلوكات أقل بكثير من المسجَّل ({m.items.length} من {m.curCount}) — أكّد لو تقصد هذا فعلًا
                        </label>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.muted }}>
                          {m.newCount > 0 && <span style={{ color: T.brass }}>{m.newCount} جديد</span>}
                          {m.newCount > 0 && m.changedCount > 0 && " · "}
                          {m.changedCount > 0 && <span style={{ color: "#b8860b" }}>{m.changedCount} تغيّر</span>}
                          {!m.newCount && !m.changedCount && "بدون تغيير"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {diffByMonth.some((m) => m.dataLoss) && (
                <div style={{ ...aNoteStyle(T, "#c0392b"), marginBottom: 12 }}>
                  ⚠ فيه أشهر مستبعدة تلقائيًا من هذا التحديث لأن الملف أعطى بلوكات أقل بكثير مما هو مسجَّل حاليًا لها (يدل غالبًا على خطأ بقراءة الملف لا تحديث حقيقي). راجعها أعلاه، ولا تؤكّدها إلا لو متأكد إن الشهر فعلًا لازم يصير ناقصًا.
                </div>
              )}
            </>
          )}

          {parsed.skips.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 8 }}>
                {parsed.skips.length} شهر "لا قراءة" سيُسجَّل بملاحظة واضحة للزائر:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {parsed.skips.map((s) => {
                  const { y, m: mm } = monthKeyParts(s.month);
                  const existed = monthNotes[s.month] != null;
                  return (
                    <div key={s.month} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: T.sunken, borderRadius: 9, padding: "8px 12px" }}>
                      <span style={{ fontSize: 12.5 }}>{MONTH_AR[mm - 1]} {y} {s.note ? `— ${s.note}` : ""}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: existed ? T.muted : T.brass }}>{existed ? "تحديث ملاحظة" : "جديد"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {parsed.phaseOverrides.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 8 }}>
                {parsed.phaseOverrides.length} نسبة مرحلة مباشرة من المطوّر — تحلّ محلّ متوسط البلوكات لذاك الشهر بالذات:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {parsed.phaseOverrides.map((o) => {
                  const { y, m: mm } = monthKeyParts(o.month);
                  const prevRow = currentPhaseOverrides.find((c) => c.phase === o.phase && c.month === o.month);
                  const isNew = !prevRow;
                  const changed = prevRow && Math.abs(prevRow.pct - o.pct) > 0.004;
                  return (
                    <div key={`${o.phase}-${o.month}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: T.sunken, borderRadius: 9, padding: "8px 12px" }}>
                      <span style={{ fontSize: 12.5 }}>{PHASE_LABEL[o.phase]} — {MONTH_AR[mm - 1]} {y} — {o.pct}%</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: isNew ? T.brass : changed ? "#b8860b" : T.muted }}>
                        {isNew ? "جديد" : changed ? `تغيّر (كان ${prevRow.pct}%)` : "بدون تغيير"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(parsed.readings.length > 0 || parsed.skips.length > 0 || parsed.phaseOverrides.length > 0) && (
            <button onClick={apply} disabled={applying || parsed.unknownBlocks.length > 0}
              style={{ display: "flex", alignItems: "center", gap: 7, background: (applying || parsed.unknownBlocks.length) ? T.muted : T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: (applying || parsed.unknownBlocks.length) ? "not-allowed" : "pointer" }}>
              <RefreshCw size={15} /> {applying ? "جارٍ التحديث..." : "تحديث الموقع الآن"}
            </button>
          )}
        </div>
      )}
      </>
      )}

      {mode === "manual" && (
        <div>
          <p style={{ fontSize: 12.5, color: T.muted, margin: "4px 0 14px", lineHeight: 1.7 }}>
            اختر الشهر — لو كان مسجَّلًا تنعرض أرقامه للتصحيح، ولو شهر جديد تنعرض أقرب نسبة معروفة لكل بلوك كنقطة
            بداية بدل ما تكتب من الصفر. عدّل اللي يحتاج تعديل واترك الباقي، ثم اضغط تحديث.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>الشهر</label>
            <input type="text" value={entryMonth} onChange={(e) => setEntryMonth(e.target.value.trim())} placeholder="2026-09"
              style={{ width: 110, padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, fontSize: 13, textAlign: "center" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer", marginInlineStart: 10 }}>
              <input type="checkbox" checked={skipMonth} onChange={(e) => setSkipMonth(e.target.checked)} />
              هذا الشهر بلا قراءة من المطوّر
            </label>
          </div>

          {skipMonth ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>سبب مختصر (اختياري)</label>
              <input type="text" value={skipNote} onChange={(e) => setSkipNote(e.target.value)} placeholder="مثال: المطوّر لم يُصدر تقرير هذا الشهر"
                style={{ width: "100%", maxWidth: 420, padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, fontSize: 12.5 }} />
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginBottom: 16 }}>
                {blocksMeta.map((b) => (
                  <div key={b.block_number} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: T.sunken, borderRadius: 9, padding: "7px 10px" }}>
                    <span style={{ fontSize: 12 }}>بلوك {b.block_number} <span style={{ color: T.muted }}>({PHASE_LABEL[b.phase]})</span></span>
                    <input type="text" inputMode="decimal" value={blockValues[b.block_number] ?? ""} onChange={(e) => setBlockValue(b.block_number, e.target.value)}
                      placeholder="%" style={{ width: 64, padding: "5px 6px", borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface, color: T.paper, fontSize: 12.5, textAlign: "center" }} />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>نسب مراحل مباشرة من المطوّر (اختياري)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginBottom: 16 }}>
                {["p1", "p2", "p3", "p4"].map((p) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: T.sunken, borderRadius: 9, padding: "7px 10px" }}>
                    <span style={{ fontSize: 12 }}>المرحلة {PHASE_LABEL[p]}</span>
                    <input type="text" inputMode="decimal" value={phaseValues[p]} onChange={(e) => setPhaseValue(p, e.target.value)}
                      placeholder="متوسط" style={{ width: 64, padding: "5px 6px", borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface, color: T.paper, fontSize: 12.5, textAlign: "center" }} />
                  </div>
                ))}
              </div>
            </>
          )}

          <button onClick={submitManual} disabled={submittingManual || !entryMonth}
            style={{ display: "flex", alignItems: "center", gap: 7, background: (submittingManual || !entryMonth) ? T.muted : T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: (submittingManual || !entryMonth) ? "not-allowed" : "pointer" }}>
            <RefreshCw size={15} /> {submittingManual ? "جارٍ التحديث..." : "تحديث الموقع الآن"}
          </button>
        </div>
      )}
    </div>
  );
}
