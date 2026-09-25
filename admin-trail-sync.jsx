/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-trail-sync */
import { AImportAudit } from "./admin-audit-tab.jsx";
import { ADMIN_BLANK_INQ, ADMIN_FIELD_LABEL, ADMIN_TARGETS, INQ_FIELDS_ADMIN, REAL_BOOL_FIELDS, cmpVal, fmtAdminDate, isBlankCell, toDbBool, toMonthKey, toYesNo, useSystemTheme } from "./admin-core.jsx";
import { ABadge, ASegmented, DiffChangeList, afieldInput, canonicalizeRow, findNewColumnsAdmin, findNewValuesAdmin, readSheetWithMeta, textSimilarity } from "./admin-excel-utils.jsx";
import { ProgressReadingsSync } from "./admin-sync-tab.jsx";
import { supabase } from "./app-bootstrap.jsx";
import { CAT_ORDER, FLAG_META, isFlagLive } from "./site-data.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import * as Brain from "./import-brain.js";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Download, FileSpreadsheet, History, ListPlus, Pencil, PlusCircle, RefreshCw, ShieldAlert, Sparkles, Trash2, Upload, X } from "lucide-react";

/* ── تبويب المزامنة والتحرير اليدوي — يكتب فعليًا على جدول inquiries ── */
/* ── v2.9.1 — سجل البند داخل نموذج التعديل ──
   كان مستدعى هنا من إصدار سابق بدون ما يكون معرّفًا، فكان فتح «تعديل» على أي
   استفسار يوقف لوحة الإدارة بالكامل. يقرأ من inquiry_revisions (يعبّيها Trigger
   بقاعدة البيانات مع كل إضافة/تعديل) — قراءة فقط، ويختفي بهدوء لو ما فيه سجل. */
const REV_FIELD_LABEL = {
  model: "النموذج", loc: "الموقع", pri: "الأولوية", cat: "الفئة", status: "الحالة", owner: "الجهة المجيبة",
  month: "الشهر", note: "نص الاستفسار", reply: "الرد", closed: "مغلق", answered: "تمت الإجابة",
  urgent: "عاجل", important: "مهم", meetings: "الاجتماعات",
};
function revVal(v) {
  if (v == null || v === "") return "—";
  if (v === "true") return "نعم";
  if (v === "false") return "لا";
  let s = String(v);
  if (/^\s*\[/.test(s)) { try { const a = JSON.parse(s); if (Array.isArray(a)) s = a.length ? a.join("، ") : "—"; } catch (_) {} }
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
}
function AInquiryTrail({ id, row }) {
  const T = useSystemTheme();
  const [revs, setRevs] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    setRevs(null); setOpen(false);
    supabase.from("inquiry_revisions").select("id,op,changed_by,changed_at,changes")
      .eq("inquiry_id", id).order("changed_at", { ascending: false }).limit(30)
      .then(({ data, error }) => { if (alive) setRevs(error ? [] : data || []); });
    return () => { alive = false; };
  }, [id]);
  const last = revs && revs[0];
  const created = revs && revs.find((r) => r.op === "insert");
  const createdBy = (row && row.created_by) || (created && created.changed_by) || null;
  const lastBy = (row && row.updated_by) || (last && last.changed_by) || null;
  const lastAt = (row && row.updated_at) || (last && last.changed_at) || null;
  if (!createdBy && !lastBy && !(revs && revs.length)) return null;
  const Chev = open ? ChevronUp : ChevronDown;
  return (
    <div style={{ background: T.sunken, borderRadius: 12, padding: "10px 12px", marginBottom: 14, fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <History size={14} color={T.brass} style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 700 }}>سجل البند</span>
        <span style={{ color: T.muted }}>
          {createdBy ? `أضافه: ${createdBy}` : ""}
          {createdBy && lastBy ? " · " : ""}
          {lastBy ? `آخر تعديل: ${lastBy}${lastAt ? ` (${fmtAdminDate(lastAt)})` : ""}` : ""}
        </span>
        {revs && revs.length > 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "4px 9px", fontSize: 11.5, color: T.muted, cursor: "pointer", fontFamily: "inherit" }}>
            {open ? "إخفاء" : `التعديلات (${revs.length}${revs.length === 30 ? "+" : ""})`} <Chev size={12} />
          </button>
        )}
      </div>
      {open && revs && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, maxHeight: 280, overflowY: "auto" }}>
          {revs.map((r) => {
            const ch = r.changes && typeof r.changes === "object" ? r.changes : {};
            const keys = r.op === "update" ? Object.keys(ch) : [];
            return (
              <div key={r.id} style={{ background: T.surface, borderRadius: 10, padding: "8px 10px", border: `1px solid ${T.line}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: T.muted, fontSize: 11.5 }}>
                  <b style={{ color: r.op === "delete" ? "#C0392B" : r.op === "insert" ? "#1E8E5A" : T.brass }}>{r.op === "insert" ? "إضافة" : r.op === "delete" ? "حذف" : "تعديل"}</b>
                  <span>{r.changed_by || "نظام"}</span>
                  <span style={{ color: T.faint }}>{fmtAdminDate(r.changed_at)}</span>
                </div>
                {keys.map((k) => (
                  <div key={k} style={{ fontSize: 11.5, marginTop: 5, lineHeight: 1.7 }}>
                    <span style={{ color: T.faint }}>{REV_FIELD_LABEL[k] || k}: </span>
                    <span style={{ color: T.muted, textDecoration: "line-through", textDecorationColor: T.faint }}>{revVal(ch[k] && ch[k].from)}</span>
                    <span style={{ color: T.faint }}> ← </span>
                    <span>{revVal(ch[k] && ch[k].to)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ASyncTab({ inquiries, refreshInquiries, progress, refreshProgress, categories, refreshCategories, flashToast, canFlag, canImport, canAdd, canEdit, canDelete, log }) {
  const T = useSystemTheme();
  /* v2.8.5 — يقرأ قيم فئة فلترة من الجدول الحي (تديره لوحة "الفلاتر")، ويرجع
     للقائمة المدمجة بالكود لو الفئة لسه ما وصلت أو فاضية — نفس منطق الرجوع
     المستخدم بالموقع العام، عشان النموذج هنا يبقى متوافقًا مع أي تعديل إداري فورًا. */
  const catVals = (key, fallback) => {
    const c = (categories || []).find((x) => x.key === key);
    return c && c.values && c.values.length ? c.values : fallback;
  };
  const fileRef = useRef(null);
  const [sheets, setSheets] = useState(null);
  const [mapping, setMapping] = useState({});
  const [stage, setStage] = useState(null); // null | "select" (اختيار الشيتات) | "results" (نتيجة المقارنة)
  const [diffResults, setDiffResults] = useState(null);
  const [sheetMeta, setSheetMeta] = useState({});
  const [newValues, setNewValues] = useState([]);
  const [newColumns, setNewColumns] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [applying, setApplying] = useState(false);
  /* ═══ أمان الرفع: نتحقق أول شي إذا عمود "cat" (الفئة) موجود فعلًا بجدول inquiries ═══
     لو قاعدة البيانات ما انحدّثت بعد بملف setup-supabase.sql، نشيل الحقل من كل عمليات
     الكتابة والمقارنة تلقائيًا — فتبقى مزامنة الإكسل شغّالة تمامًا زي قبل بدون أي خطأ،
     وتشتغل الفئة وحدها أول ما ينضاف العمود، بدون أي تعديل ثاني على الكود. */
  const [hasCatCol, setHasCatCol] = useState(true);
  useEffect(() => {
    supabase.from("inquiries").select("cat").limit(1).then(({ error }) => { if (error) setHasCatCol(false); });
  }, []);
  const INQ_FIELDS = useMemo(() => (hasCatCol ? INQ_FIELDS_ADMIN : INQ_FIELDS_ADMIN.filter((f) => f !== "cat")), [hasCatCol]);
  const stripCat = (obj) => { if (hasCatCol) return obj; const { cat, ...rest } = obj; return rest; };
  /* ═══ أمان الفرز: نتحقق إذا عمود "created_at" (تاريخ الإضافة) موجود فعلًا — لو قاعدة
     البيانات ما انحدّثت بعد بملف setup-supabase.sql، فرز "الأحدث إضافة" يرجع تلقائيًا
     لترتيب رقم الاستفسار بدل ما يسبب خطأ. ═══ */
  const [hasCreatedAtCol, setHasCreatedAtCol] = useState(true);
  useEffect(() => {
    supabase.from("inquiries").select("created_at").limit(1).then(({ error }) => { if (error) setHasCreatedAtCol(false); });
  }, []);
  const [sortBy, setSortBy] = useState("reply_desc");
  const SORT_OPTIONS = [
    { value: "reply_desc", label: "تاريخ الرد" },
    { value: "updated_desc", label: "آخر تعديل" },
    { value: "created_desc", label: "أحدث إضافة" },
    { value: "id_asc", label: "الرقم" },
  ];
  /* فرز حسب تاريخ الرد الخاص بالاستفسار نفسه (عمود الشهر) — الأحدث فوق. الاستفسارات
     اللي ما لها تاريخ رد بعد (بانتظار الرد) تنزل آخر القائمة بدل ما تتصدّرها، ويُفكّ
     التعادل داخل نفس الشهر برقم الاستفسار تنازليًا (الأحدث إضافة أولاً). */
  const replyMonthOf = (r) => {
    const mk = toMonthKey(r.month);
    return /^\d{4}-\d{2}$/.test(mk) ? mk : "";
  };
  const sortedInquiries = useMemo(() => {
    const arr = [...inquiries];
    if (sortBy === "reply_desc") return arr.sort((a, b) => {
      const ma = replyMonthOf(a), mb = replyMonthOf(b);
      if (!ma && !mb) return b.id - a.id;
      if (!ma) return 1;
      if (!mb) return -1;
      return mb.localeCompare(ma) || b.id - a.id;
    });
    if (sortBy === "updated_desc") return arr.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    if (sortBy === "created_desc" && hasCreatedAtCol) return arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) || b.id - a.id);
    return arr.sort((a, b) => a.id - b.id);
  }, [inquiries, sortBy, hasCreatedAtCol]);
  const rowDateLabel = (r) => {
    if (sortBy === "reply_desc") { const mk = replyMonthOf(r); return mk ? `تاريخ الرد: ${mk}` : "بانتظار الرد"; }
    if (sortBy === "created_desc" && hasCreatedAtCol) return r.created_at ? `أُضيف: ${fmtAdminDate(r.created_at)}` : null;
    if (sortBy === "updated_desc") return r.updated_at ? `آخر تعديل: ${fmtAdminDate(r.updated_at)}` : null;
    return null;
  };
  const [backups, setBackups] = useState([]);
  const [restoring, setRestoring] = useState(null);
  const loadBackups = () => supabase.from("data_backups").select("*").order("created_at", { ascending: false }).then(({ data }) => setBackups(data || []));
  useEffect(() => { loadBackups(); }, []);
  const restoreBackup = async (b) => {
    if (!canImport) { flashToast("ما عندك صلاحية \"رفع ومزامنة بيانات من إكسل\" اللازمة للاسترجاع"); return; }
    setRestoring(b.id);
    const { error } = await supabase.rpc("restore_inquiries_backup", { p_backup_id: b.id });
    if (error) {
      flashToast("تعذّر الاسترجاع — لم يتغيّر شي بالبيانات الحالية");
    } else {
      log("استرجاع نسخة احتياطية", b.label);
      flashToast("تم الاسترجاع بنجاح");
    }
    setRestoring(null);
    refreshInquiries(); refreshProgress();
  };

  const guessTarget = (name) => { const n = name.toLowerCase(); if (n.includes("تقدم") || n.includes("progress")) return "progress"; return "inquiries"; };
  const guessMode = (name) => (/اجتماع|طلبات|ملاحظات/.test(name) ? "append" : "merge");
  /* يقارن قيمة حقل قادم من الملف (نص "نعم/لا" دائمًا بعد التطبيع) بقيمة الحقل بالسجل الحالي —
     يحوّل حقول boolean الحقيقية (زي answered) لنفس صيغة "نعم/لا" قبل المقارنة، وإلا أي مقارنة
     نصية بينها وبين true/false الفعلي بقاعدة البيانات كانت راح تفشل دائمًا وتُحسب "تغيّر" زورًا */
  const fieldsThatDiffer = (fields, row, cur) => fields.filter((f) => {
    const curVal = REAL_BOOL_FIELDS.includes(f) ? toYesNo(cur[f]) : cur[f];
    const inRaw = row[f], curRaw = curVal;
    /* خلية فاضية بالملف ما تعني "امسح القيمة" — تعني "ما فيه بيانات لهذا الحقل بهذا الملف".
       بدون هذي الحماية، أي عمود ما يقرأه المحرك (معادلة بدون قيمة مخزّنة، أو شيت جزئي)
       كان يمسح بيانات صحيحة ويُحسب "تعديل" على كل صف — وهذا اللي مسح عمود الشهر فعليًا. */
    if (isBlankCell(inRaw) && !isBlankCell(curRaw)) return false;
    return cmpVal(f, inRaw) !== cmpVal(f, curRaw);
  });
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inquiries.map(({ urgent, updated_at, ...r }) => r)), "الاستفسارات");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(progress), "تقدم_التنفيذ");
    XLSX.writeFile(wb, "قالب-البيانات.xlsx");
  };
  const runCompareWith = (parsedSheets, mapObj) => {
    const results = []; let scanRows = [];
    Object.entries(mapObj).forEach(([sheetName, cfg]) => {
      if (cfg.target === "ignore" || cfg.selected === false) return; // شيت غير مُختار بخطوة "اختيار الشيتات" أو مُستبعد يدويًا
      const rows = parsedSheets[sheetName]; const cfgTarget = ADMIN_TARGETS.find((t) => t.key === cfg.target);
      /* حقول المقارنة: للاستفسارات ناخذها من INQ_FIELDS (اللي يحذف "cat" لو العمود مو موجود بعد) */
      const cmpFields = cfg.target === "inquiries" ? INQ_FIELDS : cfgTarget.fields;
      const current = cfg.target === "inquiries" ? inquiries : progress; const keyField = cfgTarget.keyField;
      if (cfg.mode === "replace") { results.push({ sheetName, target: cfg.target, mode: "replace", newRows: rows, removedCount: current.length }); if (cfg.target === "inquiries") scanRows = scanRows.concat(rows); return; }
      if (cfg.mode === "append") {
        const tag = (cfg.tag ?? sheetName).trim();
        if (cfg.target !== "inquiries") { results.push({ sheetName, target: cfg.target, mode: "append", newRows: rows, tag }); return; }
        /* ═══ مطابقة محتوى ذكية بدل الإلحاق الأعمى — تقارن كل صف بالاستفسارات الموجودة أصلاً
           تحت نفس وسم الشيت (meetings) عن طريق تشابه نص الملاحظة، مو رقم تسلسلي (لأن كل شيت
           اجتماع يبدأ ترقيمه من ١ فيتعارض مع باقي الشيتات). هذا يمنع تكرار نفس الصفوف كل مرة
           يُرفع نفس الملف، ويكتشف التعديلات (رد جديد، تغيّر حالة..) على صف اتّفق مضمونه سابقًا ═══ */
        const existingTagged = current.filter((r) => Array.isArray(r.meetings) && r.meetings.includes(tag));
        const usedIds = new Set(); const added = []; const changed = [];
        rows.forEach((row) => {
          let bestRow = null, bestScore = 0;
          existingTagged.forEach((cur) => {
            if (usedIds.has(cur.id)) return;
            const s = textSimilarity(row.note || "", cur.note || "");
            if (s > bestScore) { bestScore = s; bestRow = cur; }
          });
          if (bestRow && bestScore >= 0.85) {
            usedIds.add(bestRow.id);
            const fdiffs = fieldsThatDiffer(cmpFields, row, bestRow);
            if (fdiffs.length) changed.push({ key: String(bestRow.id), row, cur: bestRow, fieldDiffs: fdiffs });
          } else {
            added.push(row);
          }
        });
        results.push({ sheetName, target: cfg.target, mode: "append", added, changed, tag });
        scanRows = scanRows.concat(added, changed.map((c) => c.row));
        return;
      }
      const currentByKey = new Map(current.map((r) => [String(r[keyField]), r]));
      const incomingKeys = new Set(); const added = []; const changed = [];
      rows.forEach((row) => {
        const k = String(row[keyField] ?? "").trim(); if (!k) return; incomingKeys.add(k);
        const cur = currentByKey.get(k);
        if (!cur) { added.push(row); return; }
        const fdiffs = fieldsThatDiffer(cmpFields, row, cur);
        if (fdiffs.length) changed.push({ key: k, row, cur, fieldDiffs: fdiffs });
      });
      const missing = current.filter((r) => !incomingKeys.has(String(r[keyField])));
      results.push({ sheetName, target: cfg.target, mode: "merge", added, changed, missing, keyField, currentCount: current.length });
      if (cfg.target === "inquiries") scanRows = scanRows.concat(added, changed.map((c) => c.row));
    });
    setDiffResults(results);
    setStage("results");
    /* ذكي بالكامل: أي قيمة أو عمود جديد يُعتمد تلقائيًا كفلتر افتراضيًا — بدون ما تحتاج تراجعها وحدة وحدة،
       تقدر بس تلغي أي وحدة محددة لو ما تبيها قبل الاعتماد النهائي */
    setNewValues(findNewValuesAdmin(scanRows, categories).map((f) => ({ ...f, decision: "add" })));
    setNewColumns(findNewColumnsAdmin(scanRows, categories).map((f) => ({ ...f, decision: "add" })));
  };
  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
        /* ═══ تنظيف تلقائي قبل أي مقارنة ═══
           مسافات ورموز اتجاه، أرقام عربية، صيغ نعم/لا، وتثبيت إملاء القيم على
           الصيغة المعتمدة بجدول الفلاتر. الغرض مو التجميل: بدونه كل صف كان
           يظهر «معدّلًا» لمجرد اختلاف مسافة أو همزة، فيغرق الفرق الحقيقي. */
        const approvedMap = {};
        (categories || []).forEach((c) => {
          const f = { status: "status", pri: "pri", cat: "cat", model: "model", loc: "loc", owner: "owner" }[c.key];
          if (f && Array.isArray(c.values) && c.values.length) approvedMap[f] = c.values;
        });
        let fixCount = 0;
        const parsed = {}, parsedMeta = {};
        wb.SheetNames.forEach((name) => {
          const { rows, meta } = readSheetWithMeta(wb.Sheets[name], categories);
          parsedMeta[name] = meta;
          parsed[name] = rows.map((raw) => {
            const a = Brain.autoFixRow(raw);
            const b = Brain.canonicalizeToApproved(a.row, approvedMap);
            fixCount += a.fixes.length + b.fixes.length;
            return b.row;
          });
        });
        setSheetMeta(parsedMeta);
        if (fixCount) flashToast(`نُظّف الملف تلقائيًا — ${fixCount} تصحيح قبل المقارنة`);
        const initMap = {}; wb.SheetNames.forEach((name) => { initMap[name] = { target: guessTarget(name), mode: guessMode(name), selected: parsed[name].length > 0 }; });
        setSheets(parsed); setMapping(initMap); setDiffResults(null);
        setStage("select"); /* الخطوة الأولى: اختيار الشيتات ومراجعة طريقة التعامل معها قبل أي مقارنة */
      } catch { flashToast("تعذّرت قراءة الملف"); }
    };
    reader.readAsArrayBuffer(file); e.target.value = "";
  };
  const runCompare = () => runCompareWith(sheets, mapping);
  const toggleSheetSelected = (name) => setMapping((m) => ({ ...m, [name]: { ...m[name], selected: m[name]?.selected === false } }));
  /* تحديد قرار قيمة واحدة — المفتاح هو نفس التوقيع المستخدم بالعرض: categoryKey::value */
  const setValueDecision = (sig, decision) =>
    setNewValues((prev) => prev.map((v) => (v.categoryKey + "::" + v.value === sig ? { ...v, decision } : v)));
  const decideAllValues = (decision) => setNewValues((prev) => prev.map((v) => ({ ...v, decision })));
  const setColDecision = (col, decision) => setNewColumns((prev) => prev.map((c) => (c.column === col ? { ...c, decision } : c)));
  const decideAllCols = (decision) => setNewColumns((prev) => prev.map((c) => ({ ...c, decision })));

  const autoTranslate = async (obj) => {
    const out = { ...obj };
    try {
      if (out.note && !out.note_en) {
        const { data } = await supabase.functions.invoke("translate-text", { body: { text: out.note } });
        if (data?.translated) out.note_en = data.translated;
      }
      if (out.reply && !out.reply_en) {
        const { data } = await supabase.functions.invoke("translate-text", { body: { text: out.reply } });
        if (data?.translated) out.reply_en = data.translated;
      }
    } catch { /* لو فشلت الترجمة نكمل بدونها — ما توقف المزامنة */ }
    return out;
  };
  /* ترجمة خلفية غير معطّلة — تشتغل بعد اعتماد المزامنة بدون ما توقف الواجهة، وحدة وحدة بفاصل بسيط
     عشان ما نضغط على خدمة الترجمة المجانية دفعة وحدة */
  /* ترجمة دفعة واحدة بعد اعتماد المزامنة — بدل صف صف بفاصل ٣٠٠ملي.
     الدالة import-assist تترجم حتى ١٢٠ بندًا بطلب واحد، وترجع تلقائيًا
     للمترجم المجاني لو مفتاح الذكاء الاصطناعي مو مضبوط. */
  const backgroundTranslate = async (ids) => {
    if (!ids || !ids.length) return;
    try {
      const { data: rows } = await supabase.from("inquiries")
        .select("id,note,note_en,reply,reply_en").in("id", ids.slice(0, 300));
      const need = (rows || []).filter((r) => (r.note && !r.note_en) || (r.reply && !r.reply_en));
      for (let i = 0; i < need.length; i += 60) {
        const batch = need.slice(i, i + 60);
        const items = batch.map((r) => ({
          id: String(r.id),
          note: r.note_en ? "" : (r.note || ""),
          reply: r.reply_en ? "" : (r.reply || ""),
        }));
        const { data } = await supabase.functions.invoke("import-assist", { body: { mode: "translate", items } });
        const byId = new Map((data?.results || []).map((x) => [String(x.id), x]));
        await Promise.all(batch.map(async (r) => {
          const t = byId.get(String(r.id));
          if (!t) return;
          const patch = {};
          if (!r.note_en && t.note_en) patch.note_en = t.note_en;
          if (!r.reply_en && t.reply_en) patch.reply_en = t.reply_en;
          if (Object.keys(patch).length) await supabase.from("inquiries").update(patch).eq("id", r.id);
        }));
      }
    } catch { /* الترجمة تحسين مو شرط — المزامنة نفسها خلصت */ }
    refreshInquiries();
  };
  /* يبني كائن الحقول الجاهز للكتابة الفعلية بقاعدة البيانات — يحوّل حقول boolean الحقيقية
     (answered) من نص "نعم/لا" إلى true/false فعلي، ويترك closed كنص زي ما هو (عمود نصي) */
  const buildInsertPayload = (r) => Object.fromEntries(INQ_FIELDS.map((f) =>
    REAL_BOOL_FIELDS.includes(f) ? [f, toDbBool(r[f] ?? "لا")] : [f, r[f] ?? ""]
  ));
  const buildPatchPayload = (r) => Object.fromEntries(
    INQ_FIELDS.map((f) => [f, r[f]]).filter(([, v]) => v !== undefined)
      .map(([f, v]) => (REAL_BOOL_FIELDS.includes(f) ? [f, toDbBool(v)] : [f, v]))
  );
  const applyAll = async () => {
    setApplying(true);
    let count = 0;
    try {
      // نسخة احتياطية تلقائية قبل أي تعديل — نحتفظ بآخر نسختين فقط غير النسخة الجديدة
      const { data: backupInq } = await supabase.from("inquiries").select("*");
      const { data: backupProg } = await supabase.from("progress").select("*");
      await supabase.from("data_backups").insert({
        label: `قبل مزامنة بتاريخ ${fmtAdminDate(new Date())}`,
        inquiries: backupInq || [], progress: backupProg || [],
      });
      const { data: allBackups } = await supabase.from("data_backups").select("id").order("created_at", { ascending: false });
      if (allBackups && allBackups.length > 2) {
        const idsToDelete = allBackups.slice(2).map((b) => b.id);
        await supabase.from("data_backups").delete().in("id", idsToDelete);
      }

      let nextAppendId = inquiries.length ? Math.max(...inquiries.map((r) => r.id)) + 1 : 1;
      const todayISOOuter = new Date().toISOString().slice(0, 10);
      const pendingTranslateIds = [];
      for (const res of diffResults) {
        if (res.target === "inquiries") {
          if (res.mode === "replace") {
            const rows = res.newRows.map((r) => ({ ...buildInsertPayload(r), id: Number(r.id), urgent: false }));
            const { error } = await supabase.rpc("replace_inquiries_full", { p_rows: rows });
            if (error) throw error;
            rows.forEach((r) => { if (r.note && !r.note_en) pendingTranslateIds.push(r.id); });
            count += rows.length;
          } else if (res.mode === "append") {
            const newRows = res.added.map((r) => ({ ...buildInsertPayload(r), id: nextAppendId++, urgent: false, last_modified: todayISOOuter, meetings: res.tag ? [res.tag] : [] }));
            if (newRows.length) await supabase.from("inquiries").insert(newRows);
            newRows.forEach((r) => { if (r.note && !r.note_en) pendingTranslateIds.push(r.id); });
            for (const { key, row } of res.changed || []) {
              const patch = buildPatchPayload(row);
              await supabase.from("inquiries").update(patch).eq("id", Number(key));
              if (patch.note && !patch.note_en) pendingTranslateIds.push(Number(key));
            }
            count += newRows.length + (res.changed ? res.changed.length : 0);
          } else {
            for (const { key, row } of res.changed) {
              const patch = buildPatchPayload(row);
              await supabase.from("inquiries").update(patch).eq("id", Number(key));
              if (patch.note && !patch.note_en) pendingTranslateIds.push(Number(key));
            }
            // العناصر المضافة فعليًا (مو المعدّلة) توسم "جديد" تلقائيًا لمدة ٧ أيام
            const todayISO = new Date().toISOString().slice(0, 10);
            const newRows = res.added.map((row) => ({ ...buildInsertPayload(row), id: Number(row.id), urgent: false, last_modified: todayISO }));
            if (newRows.length) await supabase.from("inquiries").insert(newRows);
            newRows.forEach((r) => { if (r.note && !r.note_en) pendingTranslateIds.push(r.id); });
            count += res.added.length + res.changed.length;
          }
        } else if (res.target === "progress") {
          if (res.mode === "replace") {
            const { error } = await supabase.rpc("replace_progress_full", { p_rows: res.newRows });
            if (error) throw error;
            count += res.newRows.length;
          } else {
            for (const { key, row } of res.changed) await supabase.from("progress").update({ planned: row.planned, actual: row.actual }).eq("month", key);
            if (res.added.length) await supabase.from("progress").insert(res.added);
            count += res.added.length + res.changed.length;
          }
        }
      }
      const addVals = newValues.filter((v) => v.decision === "add");
      const addCols = newColumns.filter((c) => c.decision === "add");
      for (const v of addVals) {
        const cat = categories.find((c) => c.key === v.categoryKey);
        if (cat) await supabase.from("filter_categories").update({ values: [...(cat.values || []), v.value] }).eq("key", cat.key);
      }
      for (const c of addCols) {
        await supabase.from("filter_categories").insert({ key: `custom-col-${Date.now()}-${c.column}`, label: c.column, locked: false, values: c.values });
      }
      if (addVals.length || addCols.length) await refreshCategories();
      if (addVals.length) log("إضافة قيم فلترة تلقائيًا", addVals.map((v) => `${v.value} → ${v.categoryLabel}`).join("، "));
      addCols.forEach((c) => log("إنشاء فئة فلترة من عمود جديد", `"${c.column}" بقيم: ${c.values.join("، ")}`));
      log("مزامنة بيانات", `تم اعتماد ${count} عنصر عبر ${diffResults.length} شيت`);
      await refreshInquiries(); await refreshProgress();
      flashToast(`تم تحديث الموقع بالكامل — ${count} عنصر`);
      loadBackups();
      setSheets(null); setDiffResults(null); setNewValues([]); setNewColumns([]); setStage(null);
      /* الترجمة تصير بالخلفية بدون ما توقّف الحفظ — عشان ما تعلّق الاعتماد لو فيها عدد كبير من الصفوف */
      if (pendingTranslateIds.length) backgroundTranslate(pendingTranslateIds);
    } catch (err) {
      flashToast("صار خطأ أثناء الحفظ — تأكد إن جداول Supabase مجهّزة (setup-supabase.sql)");
    }
    setApplying(false);
  };

  /* ═══ وسوم "يجب الاطلاع" و"مهم" — عند التفعيل تُختار مدة: ٣ أيام، ٧ أيام، أو دائم.
     التفعيل الدائم يستخدم الحقل المنطقي (urgent/important)، والمؤقت يستخدم حقل
     الـ_until (تاريخ انتهاء) — العرض العام يحسب الحالة الفعلية من الاثنين معًا. ═══ */
  const [flagPicker, setFlagPicker] = useState(null); // { id, key: "urgent" | "important" }
  const isFlagActive = (r, key) => isFlagLive(r[FLAG_META[key].boolField], r[FLAG_META[key].untilField]);
  const applyFlag = async (r, key, choice) => {
    const meta = FLAG_META[key];
    const patch = choice === "clear" ? { [meta.boolField]: false, [meta.untilField]: null }
      : choice === "forever" ? { [meta.boolField]: true, [meta.untilField]: null }
      : { [meta.boolField]: false, [meta.untilField]: new Date(Date.now() + choice * 86400000).toISOString() };
    await supabase.from("inquiries").update(patch).eq("id", r.id);
    const actionLabel = choice === "clear" ? "إلغاء" : choice === "forever" ? "تفعيل دائم" : `تفعيل لمدة ${choice} أيام`;
    log(`تعديل وسم "${meta.labelAr}"`, `${actionLabel} على الاستفسار #${r.id}`);
    setFlagPicker(null);
    refreshInquiries();
  };
  const flagButtonClick = (r, key) => {
    if (isFlagActive(r, key)) { applyFlag(r, key, "clear"); return; }
    setFlagPicker((p) => (p && p.id === r.id && p.key === key) ? null : { id: r.id, key });
  };
  const isMarkedNew = (r) => { if (!r.last_modified) return false; const days = (Date.now() - new Date(r.last_modified + "T00:00:00").getTime()) / 86400000; return days >= 0 && days <= 7; };
  const toggleNew = async (r) => {
    const newVal = isMarkedNew(r) ? null : new Date().toISOString().slice(0, 10);
    await supabase.from("inquiries").update({ last_modified: newVal }).eq("id", r.id);
    log("تعديل وسم جديد", `${newVal ? "تفعيل" : "إلغاء"} علامة "جديد" على الاستفسار #${r.id}`);
    refreshInquiries();
  };
  const startAdd = () => { setEditing("new"); setForm({ ...ADMIN_BLANK_INQ }); };
  const startEdit = (r) => { setEditing(r.id); setForm({ ...r, closed: r.closed, answered: toYesNo(r.answered) }); };
  const saveForm = async () => {
    if (!form.note?.trim()) { flashToast("لازم نص الملاحظة على الأقل"); return; }
    const translatedForm = await autoTranslate(canonicalizeRow(form, categories));
    const payload = stripCat({ ...translatedForm, answered: toDbBool(translatedForm.answered) });
    if (editing === "new") {
      const nextId = inquiries.length ? Math.max(...inquiries.map((r) => r.id)) + 1 : 1;
      await supabase.from("inquiries").insert({ ...payload, id: nextId, urgent: false });
      log("إضافة استفسار يدويًا", `#${nextId} — ${form.note.slice(0, 40)}`); flashToast("تمت الإضافة");
    } else {
      await supabase.from("inquiries").update(payload).eq("id", editing);
      log("تعديل استفسار يدويًا", `#${editing} — ${form.note.slice(0, 40)}`); flashToast("تم الحفظ");
    }
    setEditing(null); setForm(null); refreshInquiries();
  };
  const confirmDelete = async (r) => {
    await supabase.from("inquiries").delete().eq("id", r.id);
    log("حذف استفسار يدويًا", `#${r.id} — ${(r.note || "").slice(0, 40)}`);
    flashToast("تم الحذف"); setConfirmDeleteId(null); refreshInquiries();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {canImport && (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><FileSpreadsheet size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>مزامنة من ملف إكسل</span></div>
        <p style={{ fontSize: 12.5, color: T.muted, margin: "4px 0 14px", lineHeight: 1.7 }}>حدد لكل شيت وش يمثّل، وراجع الفروقات قبل الاعتماد — التغييرات تُكتب مباشرة بقاعدة البيانات.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, background: T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Upload size={15} /> رفع ملف إكسل</button>
          <button onClick={downloadTemplate} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", color: T.brass, border: `1px solid ${T.brass}55`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Download size={15} /> تنزيل قالب</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
        </div>
      </div>
      )}

      {canImport && <ProgressReadingsSync flashToast={flashToast} canImport={canImport} log={log} />}

      {canImport && backups.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><History size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>نسخ احتياطية</span></div>
          <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 12px", lineHeight: 1.7 }}>تُؤخذ تلقائيًا قبل كل مزامنة إكسل — يُحتفظ بآخر نسختين فقط. لو صار خطأ بمزامنة، ترجع بضغطة وحدة.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {backups.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 10, padding: "10px 12px" }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{(b.inquiries || []).length} استفسار · {(b.progress || []).length} صف تقدّم</div>
                </div>
                <button onClick={() => restoreBackup(b)} disabled={restoring === b.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${T.brass}55`, color: T.brass, borderRadius: 9, padding: "7px 12px", fontSize: 11.5, fontWeight: 600, cursor: restoring === b.id ? "wait" : "pointer" }}>
                  <RefreshCw size={12} /> {restoring === b.id ? "جارٍ الاسترجاع..." : "استرجاع هذي النسخة"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sheets && stage === "select" && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>الخطوة ١ — اختر الشيتات اللي تبي تقارنها</div>
          <p style={{ fontSize: 12, color: T.muted, margin: "0 0 14px" }}>ألغِ تحديد أي شيت ما تبي يدخل بالمقارنة (مثل شيتات مرجعية بلا بيانات فعلية). النظام حدد الباقي تلقائيًا — عدّل بس لو تبي تغيّر شي.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.keys(sheets).map((name) => {
              const on = mapping[name]?.selected !== false;
              return (
                <div key={name} style={{ background: T.sunken, borderRadius: 12, padding: 14, opacity: on ? 1 : 0.55 }}>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: on ? 10 : 0, cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <input type="checkbox" checked={on} onChange={() => toggleSheetSelected(name)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
                    </span>
                    <span style={{ fontSize: 11, color: T.faint }}>{sheets[name].length} صف</span>
                  </label>
                  {on && (<>
                    <ASegmented value={mapping[name]?.target} onChange={(v) => setMapping((m) => ({ ...m, [name]: { ...m[name], target: v } }))} options={ADMIN_TARGETS.map((t) => ({ value: t.key, label: t.label }))} />
                    {mapping[name]?.target !== "ignore" && <div style={{ marginTop: 8 }}><ASegmented value={mapping[name]?.mode} onChange={(v) => setMapping((m) => ({ ...m, [name]: { ...m[name], mode: v } }))} options={[{ value: "merge", label: "مقارنة وتحديث" }, { value: "append", label: "➕ إلحاق ذكي" }, { value: "replace", label: "⚠️ استبدال كامل" }]} /></div>}
                    {mapping[name]?.mode === "append" && mapping[name]?.target === "inquiries" && (
                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>تسمية الفلتر (يظهر بالموقع العام — تقدر تعدله)</label>
                        <input value={mapping[name]?.tag ?? name} onChange={(e) => setMapping((m) => ({ ...m, [name]: { ...m[name], tag: e.target.value } }))} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5, background: T.sunken }} />
                      </div>
                    )}
                  </>)}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={runCompare} style={{ display: "flex", alignItems: "center", gap: 7, background: T.brass, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><RefreshCw size={14} /> قارن الآن</button>
            <button onClick={() => { setSheets(null); setMapping({}); setStage(null); }} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}

      {diffResults && stage === "results" && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>الخطوة ٢ — نتيجة المقارنة</span>
            <button onClick={() => setStage("select")} style={{ background: "none", border: "none", color: T.brass, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>تعديل اختيار الشيتات</button>
          </div>
          <AImportAudit diffResults={diffResults} inquiries={inquiries} categories={categories}
            sheets={sheets} sheetMeta={sheetMeta} mapping={mapping} flashToast={flashToast} />
          {(() => {
            const totals = diffResults.reduce((acc, res) => {
              if (res.mode === "replace") { acc.added += res.newRows.length; acc.removed += res.removedCount; }
              else if (res.mode === "append") { acc.added += (res.added ? res.added.length : res.newRows.length); acc.changed += (res.changed ? res.changed.length : 0); }
              else { acc.added += res.added.length; acc.changed += res.changed.length; acc.missing += res.missing.length; }
              return acc;
            }, { added: 0, changed: 0, missing: 0, removed: 0 });
            const parts = [];
            if (totals.added) parts.push(`${totals.added} استفسار جديد`);
            if (totals.changed) parts.push(`${totals.changed} تحديث على استفسارات موجودة`);
            if (totals.missing) parts.push(`${totals.missing} موجودة بالقاعدة وغير موجودة بالملف`);
            if (totals.removed) parts.push(`${totals.removed} سيُحذف بالاستبدال الكامل`);
            const summary = parts.length ? `قارنت ${diffResults.length} شيت بكل الاستفسارات الحالية: ${parts.join("، ")}.` : `قارنت ${diffResults.length} شيت بكل الاستفسارات الحالية — ما فيه أي فرق، البيانات مطابقة تمامًا.`;
            return <p style={{ fontSize: 12.5, color: T.paper, margin: "0 0 14px", lineHeight: 1.8, background: T.sunken, borderRadius: 10, padding: "10px 12px" }}>{summary}</p>;
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {diffResults.map((res) => (
              <div key={res.sheetName}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: T.muted }}>شيت "{res.sheetName}" ← {ADMIN_TARGETS.find((t) => t.key === res.target).label}</div>
                {res.mode === "replace" ? (
                  <div style={{ background: "#C0392B14", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, color: "#C0392B" }}>⚠️ سيُحذف {res.removedCount} ويُستبدل بـ {res.newRows.length} جديد.</div>
                ) : res.mode === "append" ? (
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {res.added.length === 0 && (!res.changed || res.changed.length === 0) ? <span style={{ fontSize: 12.5, color: T.muted }}>لا فرق — كل الصفوف موجودة أصلًا بنفس المحتوى.</span> : <>
                        {res.added.length > 0 && <ABadge kind="add">{res.added.length} جديد فعليًا</ABadge>}
                        {res.changed && res.changed.length > 0 && <ABadge kind="change">{res.changed.length} تحديث على صفوف مطابقة سابقًا</ABadge>}
                      </>}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>الجديد سيُوسم بفلتر: <b style={{ color: T.brass }}>{res.tag}</b> — النظام اكتشف الصفوف المكررة بمطابقة نص الملاحظة، فما راح تتكرر لو رفعت نفس الملف مرة ثانية.</div>
                    <DiffChangeList changed={res.changed} T={T} />
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {res.added.length === 0 && res.changed.length === 0 && res.missing.length === 0 ? <span style={{ fontSize: 12.5, color: T.muted }}>لا فرق.</span> : <>
                        {res.added.length > 0 && <ABadge kind="add">{res.added.length} جديد</ABadge>}
                        {res.changed.length > 0 && <ABadge kind="change">{res.changed.length} تغيّر</ABadge>}
                        {res.missing.length > 0 && <ABadge kind="missing">{res.missing.length} ناقص</ABadge>}
                      </>}
                    </div>
                    <DiffChangeList changed={res.changed} T={T} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {newValues.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px dashed ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><Sparkles size={15} color={T.brass} /><span style={{ fontSize: 13, fontWeight: 700 }}>قيم جديدة داخل فلاتر موجودة — راح تُضاف تلقائيًا</span></div>
              <p style={{ fontSize: 11.5, color: T.muted, margin: "0 0 10px" }}>معتمدة كلها افتراضيًا. لغِ أي واحدة لو ما تبيها.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => decideAllValues("add")} style={{ fontSize: 11.5, background: "#1E8E5A14", color: "#1E8E5A", border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}>تحديد الكل: إضافة</button>
                <button onClick={() => decideAllValues("skip")} style={{ fontSize: 11.5, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}>تحديد الكل: تجاهل</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {newValues.map((v) => { const sig = v.categoryKey + "::" + v.value; return (
                  <div key={sig} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 10, padding: "8px 12px" }}>
                    <span style={{ fontSize: 12.5 }}><b>{v.value}</b> <span style={{ color: T.faint }}>← {v.categoryLabel}</span></span>
                    <ASegmented value={v.decision} onChange={(d) => setValueDecision(sig, d)} options={[{ value: "add", label: "إضافة كفلتر" }, { value: "skip", label: "تجاهل" }]} />
                  </div>
                );})}
              </div>
            </div>
          )}

          {newColumns.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px dashed ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><ListPlus size={15} color={T.brass} /><span style={{ fontSize: 13, fontWeight: 700 }}>أعمدة جديدة كليًا بالملف — راح تُنشأ كفلاتر تلقائيًا</span></div>
              <p style={{ fontSize: 11.5, color: T.muted, margin: "0 0 10px" }}>معتمدة كلها افتراضيًا. لغِ أي واحدة لو ما تبيها.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => decideAllCols("add")} style={{ fontSize: 11.5, background: "#1E8E5A14", color: "#1E8E5A", border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}>تحديد الكل: إنشاء فئة</button>
                <button onClick={() => decideAllCols("skip")} style={{ fontSize: 11.5, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}>تحديد الكل: تجاهل</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {newColumns.map((c) => (
                  <div key={c.column} style={{ background: T.sunken, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{c.column} <span style={{ color: T.faint, fontWeight: 500 }}>({c.values.length} قيمة)</span></span>
                      <ASegmented value={c.decision} onChange={(d) => setColDecision(c.column, d)} options={[{ value: "add", label: "إنشاء فئة" }, { value: "skip", label: "تجاهل" }]} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{c.values.slice(0, 8).map((v) => <span key={v} style={{ fontSize: 11, background: T.surface, borderRadius: 999, padding: "2px 8px", border: `1px solid ${T.line}` }}>{v}</span>)}{c.values.length > 8 && <span style={{ fontSize: 11, color: T.faint }}>+{c.values.length - 8}</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={applyAll} disabled={applying} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: applying ? "wait" : "pointer", opacity: applying ? .7 : 1 }}><Check size={15} /> {applying ? "جارٍ الحفظ..." : "اعتماد كل شي"}</button>
            <button onClick={() => { setSheets(null); setMapping({}); setDiffResults(null); setNewValues([]); setNewColumns([]); setStage(null); }} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}><X size={15} /> تجاهل الكل</button>
          </div>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>الاستفسارات الحالية ({inquiries.length})</span>
          <button onClick={startAdd} disabled={!canAdd} style={{ display: "flex", alignItems: "center", gap: 6, background: canAdd ? T.brass : T.line, color: "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: canAdd ? "pointer" : "not-allowed", opacity: canAdd ? 1 : .6 }}><PlusCircle size={13} /> إضافة يدويًا</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, color: T.muted, flexShrink: 0 }}>الفرز:</span>
          <ASegmented value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sortedInquiries.map((r) => (
            <div key={r.id} style={{ background: T.sunken, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button disabled={!canFlag} onClick={() => flagButtonClick(r, "urgent")} title={isFlagActive(r, "urgent") ? "إلغاء علامة \"يجب الاطلاع\" عن هذا الاستفسار بالموقع العام" : "إظهار علامة \"يجب الاطلاع\" واختيار مدتها"} style={{ flexShrink: 0, background: isFlagActive(r, "urgent") ? "#B8790F" : T.line, border: "none", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: canFlag ? "pointer" : "not-allowed", opacity: canFlag ? 1 : .5 }}>
                  <ShieldAlert size={14} color={isFlagActive(r, "urgent") ? "#fff" : T.faint} />
                </button>
                <button disabled={!canFlag} onClick={() => toggleNew(r)} title={isMarkedNew(r) ? "إلغاء وسم جديد" : "وسم كـ جديد (٧ أيام)"} style={{ flexShrink: 0, background: isMarkedNew(r) ? T.brass : T.line, border: "none", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: canFlag ? "pointer" : "not-allowed", opacity: canFlag ? 1 : .5 }}>
                  <Sparkles size={14} color={isMarkedNew(r) ? "#fff" : T.faint} />
                </button>
                <button disabled={!canFlag} onClick={() => flagButtonClick(r, "important")} title={isFlagActive(r, "important") ? "إلغاء علامة \"مهم\" عن هذا الاستفسار بالموقع العام" : "إظهار علامة \"مهم\" واختيار مدتها"} style={{ flexShrink: 0, background: isFlagActive(r, "important") ? "#C0392B" : T.line, border: "none", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: canFlag ? "pointer" : "not-allowed", opacity: canFlag ? 1 : .5 }}>
                  <AlertTriangle size={14} color={isFlagActive(r, "important") ? "#fff" : T.faint} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, display: "flex", gap: 8, minWidth: 0 }}>
                    <span style={{ color: T.faint, fontWeight: 700, flexShrink: 0 }}>#{r.id}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{r.note}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{r.model} · {r.loc} · {r.status}{r.cat ? ` · ${r.cat}` : ""}{rowDateLabel(r) ? ` · ${rowDateLabel(r)}` : ""}</div>
                </div>
                {canEdit && <button onClick={() => startEdit(r)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted, flexShrink: 0 }}><Pencil size={12} /></button>}
                {canDelete && (confirmDeleteId === r.id ? (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => confirmDelete(r)} style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "0 8px", fontSize: 11, cursor: "pointer" }}>تأكيد</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "0 8px", fontSize: 11, cursor: "pointer", color: T.muted }}>لا</button>
                  </div>
                ) : (<button onClick={() => setConfirmDeleteId(r.id)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C0392B", flexShrink: 0 }}><Trash2 size={12} /></button>))}
              </div>
              {flagPicker && flagPicker.id === r.id && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "7px 9px", borderRadius: 10, background: T.surface, border: `1px solid ${T.line}` }}>
                  <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>مدة "{FLAG_META[flagPicker.key].labelAr}":</span>
                  <button onClick={() => applyFlag(r, flagPicker.key, 3)} style={{ fontSize: 11.5, background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer", color: T.paper }}>٣ أيام</button>
                  <button onClick={() => applyFlag(r, flagPicker.key, 7)} style={{ fontSize: 11.5, background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer", color: T.paper }}>٧ أيام</button>
                  <button onClick={() => applyFlag(r, flagPicker.key, "forever")} style={{ fontSize: 11.5, background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer", color: T.paper }}>دائم</button>
                  <button onClick={() => setFlagPicker(null)} style={{ marginRight: "auto", background: "none", border: "none", color: T.faint, cursor: "pointer", display: "flex" }}><X size={13} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {form && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{editing === "new" ? "إضافة استفسار يدويًا" : `تعديل الاستفسار #${editing}`}</div>
          {editing !== "new" && <AInquiryTrail id={editing} row={form} />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {afieldInput(ADMIN_FIELD_LABEL.model, form.model, (v) => setForm((f) => ({ ...f, model: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.loc, form.loc, (v) => setForm((f) => ({ ...f, loc: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.pri, form.pri, (v) => setForm((f) => ({ ...f, pri: v })), catVals("pri", ["عالية جدًا", "عالية", "متوسطة", "عادية"]))}
            {afieldInput(ADMIN_FIELD_LABEL.cat, form.cat ?? "", (v) => setForm((f) => ({ ...f, cat: v })), ["", ...catVals("cat", CAT_ORDER)])}
            {afieldInput(ADMIN_FIELD_LABEL.status, form.status, (v) => setForm((f) => ({ ...f, status: v })), catVals("status", ["معتمدة", "قيد الدراسة", "تم التصويت", "تم الرفض"]))}
            {afieldInput(ADMIN_FIELD_LABEL.owner, form.owner, (v) => setForm((f) => ({ ...f, owner: v })), null, catVals("owner", []))}
            {afieldInput(ADMIN_FIELD_LABEL.month, form.month, (v) => setForm((f) => ({ ...f, month: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.closed, form.closed, (v) => setForm((f) => ({ ...f, closed: v })), ["نعم", "لا"])}
            {afieldInput(ADMIN_FIELD_LABEL.answered, form.answered, (v) => setForm((f) => ({ ...f, answered: v })), ["نعم", "لا"])}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {afieldInput(ADMIN_FIELD_LABEL.note, form.note, (v) => setForm((f) => ({ ...f, note: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.note_en, form.note_en, (v) => setForm((f) => ({ ...f, note_en: v })))}
            {afieldInput(ADMIN_FIELD_LABEL.reply, form.reply, (v) => setForm((f) => ({ ...f, reply: v })))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveForm} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Check size={15} /> حفظ</button>
            <button onClick={() => { setEditing(null); setForm(null); }} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
