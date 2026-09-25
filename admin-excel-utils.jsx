/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-excel-utils */
import { ADMIN_FIELD_LABEL, CURRENT_ADMIN_THEME, INQ_FIELDS_ADMIN, toMonthKey, useSystemTheme } from "./admin-core.jsx";
import { MONTH_AR, MONTH_EN_LABEL, PG_BLOCK_DISPLAY_ORDER, monthKeyOf, nextMonthKey } from "./site-data.jsx";
import * as XLSX from "xlsx";
import * as Brain from "./import-brain.js";
import { Check, MinusCircle, Pencil, PlusCircle, ShieldAlert } from "lucide-react";

/* أدوات مساعدة عامة لواجهة الإدارة */
/* صندوق ملاحظة/تحذير داخل لوحة الإدارة.
   كان يستخدم class="note-box"، لكن تعريف الـ CSS يعيش داخل <style> تبع الموقع العام
   وما يُرسَم إطلاقًا على مسار #admin — فكانت الصناديق تطلع نصًا عاريًا بلا خلفية.
   الآن التنسيق مضمّن مباشرة فيشتغل بالمسارين. */
export const aNoteStyle = (T, color) => ({
  padding: "12px 14px", borderRadius: 12, background: T.sunken,
  color: color || T.muted, fontSize: 12, lineHeight: 1.85,
});

export function ABadge({ kind, children }) {
  const T = useSystemTheme();
  const map = { add: { bg: "#1E8E5A14", fg: "#1E8E5A", icon: PlusCircle }, change: { bg: "#B8790F14", fg: "#B8790F", icon: Pencil }, missing: { bg: "#C0392B14", fg: "#C0392B", icon: MinusCircle }, ok: { bg: "#1E8E5A14", fg: "#1E8E5A", icon: Check } };
  const { bg, fg, icon: Icon } = map[kind] || map.add;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color: fg, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999 }}><Icon size={12} /> {children}</span>;
}
/* ملخص مختصر لكل صف تغيّر — أي حقول بالضبط اختلفت (الرد، الحالة..) بدل رقم عام بس،
   عشان تعرف بلمحة وش تغيّر قبل ما تعتمد */
export function DiffChangeList({ changed, T }) {
  if (!changed || !changed.length) return null;
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
      {changed.slice(0, 6).map((c) => (
        <div key={c.key} style={{ fontSize: 11, color: T.muted }}>
          <b style={{ color: T.brass }}>#{c.key}</b> — تغيّر: {c.fieldDiffs.map((f) => ADMIN_FIELD_LABEL[f] || f).join("، ")}
        </div>
      ))}
      {changed.length > 6 && <div style={{ fontSize: 11, color: T.faint }}>+{changed.length - 6} تغييرات أخرى</div>}
    </div>
  );
}
export function ASegmented({ options, value, onChange }) {
  const T = useSystemTheme();
  return <div style={{ display: "flex", background: T.sunken, borderRadius: 10, padding: 3, gap: 2 }}>{options.map((o) => (<button key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 8px", fontSize: 12, cursor: "pointer", fontWeight: 600, background: value === o.value ? T.brass : "transparent", color: value === o.value ? "#fff" : T.muted }}>{o.label}</button>))}</div>;
}
export function ALocked({ text }) {
  const T = useSystemTheme();
  return <div style={{ background: T.surface, border: `1px dashed ${T.line}`, borderRadius: 16, padding: 30, textAlign: "center" }}><ShieldAlert size={22} color={T.faint} style={{ marginBottom: 8 }} /><div style={{ fontSize: 13, color: T.muted }}>{text}</div></div>;
}
export function afieldInput(label, value, onChange, opts, listOpts) {
  const T = CURRENT_ADMIN_THEME;
  const listId = listOpts ? `dl-${label}`.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, "-") : undefined;
  return (
    <div key={label}>
      <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>{label}</label>
      {opts ? (<select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5, background: T.sunken }}>{opts.map((o) => <option key={o} value={o}>{o === "" ? "— بدون —" : o}</option>)}</select>)
        : (<>
            <input value={value || ""} onChange={(e) => onChange(e.target.value)} list={listId} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5, background: T.sunken }} />
            {listOpts && listOpts.length > 0 && <datalist id={listId}>{listOpts.map((o) => <option key={o} value={o} />)}</datalist>}
          </>)}
    </div>
  );
}
/* أسماء أعمدة بديلة شائعة — يقبل ملفات إكسل حقيقية بعناوين عربية، مو بس القالب الجاهز */
const HEADER_ALIASES = {
  id: ["id", "رقم", "الرقم", "م", "رقم الاستفسار", "no", "no.", "#"],
  model: ["model", "النموذج", "الموديل", "نوع النموذج", "موديل الفيلا"],
  loc: ["loc", "الموقع", "موقع الملاحظة", "مكان الملاحظة", "الموقع بالفيلا"],
  pri: ["pri", "الأولوية", "الاولوية", "درجة الأولوية", "الاهمية", "الأهمية"],
  /* عمود الفئة — العنوان الرسمي بالملف "تصنيف نوع البند"، والباقي صياغات بديلة محتملة.
     كلها بعيدة نصيًا عن عناوين الأعمدة الأخرى، فما تتعارض مع المطابقة التقريبية القائمة. */
  cat: ["cat", "category", "الفئة", "الفئه", "التصنيف", "تصنيف", "تصنيف نوع البند", "نوع البند", "تصنيف البند", "فئة البند", "نوع الاستفسار", "تصنيف الاستفسار"],
  status: ["status", "الحالة", "حالة المقترح", "حالة الاعتماد"],
  owner: ["owner", "المهندس", "المسؤول", "صاحب الرد", "المهندس المسؤول", "الجهة المعنية"],
  month: ["month", "الشهر", "شهر الرد", "شهر الرد (نص)", "تاريخ الطلب", "تاريخ الرد", "التاريخ"],
  note: ["note", "الملاحظة", "ملاحظة", "الاستفسار", "الملاحظة / الحل المقترح", "الملاحظة/الحل المقترح", "تفاصيل الطلب", "نص الاستفسار", "وصف الاستفسار"],
  note_en: ["note_en", "note (en)", "الملاحظة بالانجليزي", "note en"],
  reply: ["reply", "الرد", "رد", "الرد على المقترح", "رد المهندس", "التوضيح"],
  closed: ["closed", "مغلقة", "مقفل", "مقفل/مفتوح", "مقفل / مفتوح", "حالة الإغلاق", "حالة الطلب", "الإغلاق", "هل تم الإغلاق"],
  answered: ["answered", "حالة الرد", "هل تم الرد"],
};
/* مفاتيح مطبَّعة (بدون تشكيل/مسافات/فوارق أ-إ-آ) لكل بديل — أساس محرك المطابقة الذكي للعناوين */
const HEADER_LOOKUP = (() => {
  const map = {};
  Object.entries(HEADER_ALIASES).forEach(([canon, aliases]) => aliases.forEach((a) => { map[normalizeArabic(a)] = canon; }));
  return map;
})();
/* يطابق عنوان عمود حتى لو مختلف شوي بالصياغة عن القوالب المعروفة (مسافات زائدة، تشكيل، همزات، أقواس..)
   أولًا مطابقة تامة بعد التطبيع، ولو ما لقى، مطابقة تقريبية (Levenshtein) بحد أدنى للتشابه */
function resolveHeaderKey(rawKey) {
  const norm = normalizeArabic(rawKey);
  if (!norm) return null;
  if (HEADER_LOOKUP[norm]) return HEADER_LOOKUP[norm];
  let best = null, bestScore = 0;
  Object.entries(HEADER_LOOKUP).forEach(([alias, canon]) => {
    const longer = Math.max(alias.length, norm.length), shorter = Math.min(alias.length, norm.length);
    if (longer - shorter > Math.max(4, longer * 0.35)) return; // فرق طول كبير = مستبعد مبكرًا (يمنع تطابق عناوين قصيرة كجزء من عناوين طويلة غير مرتبطة)
    if (shorter / longer < 0.7) return; // نفس الغرض: يمنع اعتبار عنوان قصير جزءًا من عنوان أطول بلا علاقة فعلية
    const dist = levenshtein(norm, alias);
    const s = 1 - dist / longer;
    if (s > bestScore) { bestScore = s; best = canon; }
  });
  return bestScore >= 0.82 ? best : null;
}
function normalizeRow(row) {
  const out = {};
  Object.entries(row).forEach(([key, val]) => {
    const canon = resolveHeaderKey(String(key));
    out[canon || key] = val;
  });

  return out;
}

/* ═══ تطبيع القيم الثنائية (نعم/لا) — يحل مشكلة أعمدة مثل "حالة الإغلاق" و"حالة الرد" اللي تجي
   بصياغات مختلفة تمامًا عن القيم المعتمدة (مثلاً "مقفل"/"مفتوح" أو "تم الرد"/"بانتظار الرد" بدل
   "نعم"/"لا"). المطابقة التقريبية بالتشابه النصي ما تكفي هنا لأنها كلمات مختلفة كليًا وليست أخطاء
   إملائية، فنستخدم قوائم مرادفات صريحة لكل حقل على حدة بدلًا من الاعتماد على Levenshtein وحده ═══ */
const BOOLEAN_FIELD_WORDS = {
  closed: {
    true: ["نعم", "مقفل", "مغلق", "مغلقة", "تم الإغلاق", "تم اغلاقه", "منتهي", "closed", "yes", "true", "done", "1"],
    false: ["لا", "مفتوح", "غير مغلق", "قائم", "لم يغلق", "لايزال مفتوح", "لا يزال مفتوحا", "open", "no", "false", "pending", "0"],
  },
  answered: {
    true: ["تم الرد", "تم الرد عليه", "رد عليه", "نعم", "answered", "replied", "yes", "true", "done", "1"],
    false: ["لم يتم الرد", "بانتظار الرد", "لم يرد بعد", "لم يرد", "لا", "not answered", "awaiting", "pending", "no", "false", "0"],
  },
};
function normalizeBooleanish(value, field) {
  if (value == null || value === "") return value;
  const norm = normalizeArabic(value);
  if (!norm) return value;
  const words = BOOLEAN_FIELD_WORDS[field]; if (!words) return value;
  const hit = (list) => list.some((w) => { const nw = normalizeArabic(w); return norm === nw || norm.includes(nw); });
  if (hit(words.true)) return "نعم";
  if (hit(words.false)) return "لا";
  return value; // قيمة غير معروفة — تُترك كما هي لتمر بعدها على المطابقة التقريبية العامة (canonicalizeRow)
}
/* الحقول اللي قيمتها منطقية بطبيعتها (نعم/لا) وتحتاج هذا التطبيع الصريح قبل أي تطبيع عام آخر */
const BOOLEAN_FIELDS = ["closed", "answered"];
function normalizeBooleanFields(row) {
  const out = { ...row };
  BOOLEAN_FIELDS.forEach((f) => { if (out[f] != null && out[f] !== "") out[f] = normalizeBooleanish(out[f], f); });
  return out;
}

/* ═══ محرك مطابقة ذكي — يقرأ نص الخلية ويقرّبه لأقرب قيمة فلتر موجودة، مو مطابقة حرفية بس ═══ */
function normalizeArabic(s) {
  return String(s || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/^ال/, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  }
  return dp[m][n];
}
export function textSimilarity(a, b) {
  const na = normalizeArabic(a), nb = normalizeArabic(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.93;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}
function findClosestMatch(value, existingValues, threshold = 0.72) {
  let best = null, bestScore = 0;
  (existingValues || []).forEach((ev) => {
    const s = textSimilarity(value, ev);
    if (s > bestScore) { bestScore = s; best = ev; }
  });
  return bestScore >= threshold ? { match: best, score: bestScore } : null;
}
/* يقرّب قيم الفئات الأساسية (النموذج/الموقع/الأولوية/الحالة/الإغلاق) لأقرب قيمة معتمدة —
   يخلي البيانات موحّدة تلقائيًا حتى لو اختلفت الصياغة قليلًا بالملف عن القائمة المعتمدة */
export function canonicalizeRow(row, categories) {
  const out = { ...row };
  (categories || []).forEach((cat) => {
    if (!cat.locked) return;
    const val = out[cat.key];
    if (val == null || val === "") return;
    if (cat.values.includes(val)) return;
    const found = findClosestMatch(val, cat.values);
    if (found) out[cat.key] = found.match;
  });
  return out;
}

/* يكتشف صف العناوين الحقيقي تلقائيًا حتى لو فيه صف عنوان تجميعي فوقه (خلايا مدمجة) —
   يستخدم نفس محرك المطابقة التقريبية للعناوين، مو بس تطابق حرفي، عشان يلقط صف العناوين
   الصحيح حتى لو صياغته مختلفة شوي عن القوالب المعروفة */
/* ═══════════════════════════════════════════════════════════
   قارئ الشيت مع بيانات وصفية — النسخة اللي يعتمد عليها المدقّق.

   الفرق عن smartSheetToJson: يرجّع معه خريطة الأعمدة (وين انربط كل عمود
   وأيّها أُهمل)، ورقم صف إكسل الحقيقي لكل صف، وخلايا الأخطاء. بدون هالمعلومات
   ما نقدر نقول للمشرف «العمود G الصف ٤٩» ولا نكشف عمودًا يُهمل بصمت.
   ═══════════════════════════════════════════════════════════ */
export function readSheetWithMeta(sheet, categories) {
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  /* صف العناوين: الصف اللي انربطت منه أكبر عدد من الأعمدة ضمن أول ٦ صفوف */
  let headerRowIndex = 0, bestScore = -1;
  for (let i = 0; i < Math.min(6, grid.length); i++) {
    const score = (grid[i] || []).filter((cell) => resolveHeaderKey(String(cell))).length;
    if (score > bestScore) { bestScore = score; headerRowIndex = i; }
  }

  const headerCells = grid[headerRowIndex] || [];
  const width = Math.max(headerCells.length, ...grid.slice(headerRowIndex + 1).map((r) => (r || []).length), 0);
  const columns = [];
  for (let c = 0; c < width; c++) {
    const rawHead = String(headerCells[c] ?? "").trim();
    let nonEmpty = 0;
    for (let r = headerRowIndex + 1; r < grid.length; r++) {
      if (String((grid[r] || [])[c] ?? "").trim() !== "") nonEmpty++;
    }
    columns.push({ idx: c, letter: XLSX.utils.encode_col(c), raw: rawHead, field: resolveHeaderKey(rawHead), nonEmpty });
  }

  /* أول عمود غير فارغ لكل حقل هو المرجع بعنوان الخلية — لو تكرر الحقل بعمودين */
  const colLetterOf = {};
  columns.forEach((c) => { if (c.field && !colLetterOf[c.field]) colLetterOf[c.field] = c.letter; });

  const EXCEL_ERRS = ["#REF!", "#N/A", "#VALUE!", "#DIV/0!", "#NAME?", "#NULL!", "#NUM!", "#SPILL!"];
  const rawRows = [], excelRowOf = [], errorCells = [];

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const line = grid[r] || [];
    if (columns.every((c) => String(line[c.idx] ?? "").trim() === "")) continue; // صف فاصل فارغ
    const obj = {};
    columns.forEach((c) => {
      if (!c.field) return;
      const cell = String(line[c.idx] ?? "").trim();
      if (EXCEL_ERRS.includes(cell.toUpperCase()))
        errorCells.push({ excelRow: r + 1, field: c.field, value: cell, key: line[columns.find((x) => x.field === "id")?.idx] ?? "—" });
      /* عمودان بنفس الحقل: تُعتمد أول قيمة غير فارغة — وهذا اللي يخلّي
         «شهر الرد» و«شهر الرد (نص)» ما يطمس أحدهما الآخر */
      if (obj[c.field] === undefined || String(obj[c.field]).trim() === "") obj[c.field] = line[c.idx] ?? "";
    });
    rawRows.push(obj);
    excelRowOf.push(r + 1);
  }

  const rows = rawRows.map(normalizeRow).map(normalizeBooleanFields).map((r) => {
    const mk = toMonthKey(r.month);
    r.month = /^\d{4}-\d{2}$/.test(mk) ? mk : "";
    return r;
  }).map((r) => canonicalizeRow(r, categories));

  return { rows, meta: { headerRowIndex, columns, colLetterOf, excelRowOf, errorCells, rowCount: rows.length } };
}

function smartSheetToJson(sheet, categories) {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  let bestIdx = 0, bestScore = -1;
  for (let i = 0; i < Math.min(6, raw.length); i++) {
    const score = (raw[i] || []).filter((cell) => resolveHeaderKey(String(cell))).length;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { range: bestIdx, defval: "", raw: false });
  return rows.map(normalizeRow).map(normalizeBooleanFields).map((r) => {
    /* عمودا "شهر الرد" (تاريخ) و"شهر الرد (نص)" (معادلة) ينطبق عليهما نفس الوسم؛ نعتمد
       أيّهما أعطى مفتاح شهر صالح، وما نسمح لعمود فاضي (معادلة بلا قيمة مخزّنة) إنه يطمس الآخر. */
    const mk = toMonthKey(r.month);
    r.month = /^\d{4}-\d{2}$/.test(mk) ? mk : "";
    return r;
  }).map((r) => canonicalizeRow(r, categories));
}

export function findNewValuesAdmin(rows, categories) {
  const found = []; const seen = new Set();
  categories.forEach((cat) => {
    const columnKey = cat.locked ? cat.key : cat.label;
    rows.forEach((row) => {
      const raw = row[columnKey]; if (raw == null || raw === "") return;
      String(raw).split(",").map((s) => s.trim()).filter(Boolean).forEach((val) => {
        if (!(cat.values || []).includes(val)) { const sig = cat.key + "::" + val; if (!seen.has(sig)) { seen.add(sig); found.push({ categoryKey: cat.key, categoryLabel: cat.label, value: val }); } }
      });
    });
  });
  return found;
}
export function findNewColumnsAdmin(rows, categories) {
  const known = new Set(["id", ...INQ_FIELDS_ADMIN]);
  categories.forEach((c) => known.add(c.locked ? c.key : c.label));
  const colValues = {};
  rows.forEach((row) => Object.keys(row).forEach((col) => {
    if (known.has(col)) return;
    const val = row[col]; if (val == null || val === "") return;
    (colValues[col] = colValues[col] || new Set()).add(String(val).trim());
  }));
  return Object.entries(colValues).map(([column, set]) => ({ column, values: [...set] }));
}

/* ═══════════════════════════════════════════════════════════
   محرك قراءة ملف «بيانات تقدّم التنفيذ» — v2.
   تنسيق مسطّح بسيط بدل جدول عريض: عمود لكل من رقم البلوك / الشهر /
   نسبة الإنجاز، وصف واحد لكل (بلوك + شهر). ما فيه جدول يُكتشف مكانه
   ولا عمود شهر يُحسب ترتيبه — قراءة الملف صارت مطابقة أعمدة بالاسم
   فقط، فبالتالي أبسط وأصعب على الكسر بكثير من محرك KPIs القديم.
   الإجمالي ومتوسط كل مرحلة ما يُقرآن من الملف إطلاقًا بعد الآن —
   قاعدة البيانات تحسبهم دائمًا من البلوكات (progress_matrix_v)، فيستحيل
   يتناقضا مع بعض (كان هذا التناقض موجودًا فعليًا ببيانات حقيقية —
   راجع ملاحظة سبتمبر ٢٠٢٦ بقسم التغييرات).
   ═══════════════════════════════════════════════════════════ */

/* يحوّل خلية شهر بأي صيغة معقولة إلى مفتاح YYYY-MM: تاريخ إكسل حقيقي،
   نص "2026-02" أو "2026/02"، أو اسم شهر عربي/إنجليزي مع سنة بأي ترتيب
   ("فبراير 2026"، "February 2026"، حتى لو بأرقام عربية). */
function monthIndexOf(text) {
  if (typeof text !== "string" || !text.trim()) return -1;
  const t = text.trim();
  let i = MONTH_EN_LABEL.findIndex((m) => m.toLowerCase() === t.toLowerCase());
  if (i >= 0) return i;
  i = MONTH_AR.findIndex((m) => normalizeArabic(m) === normalizeArabic(t));
  return i;
}
export function parseMonthCell(v) {
  if (v instanceof Date && !isNaN(v)) return monthKeyOf(v.getFullYear(), v.getMonth() + 1);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    /* رقم تسلسلي بصيغة إكسل — احتياط إضافي لو ما انقرأت كتاريخ حقيقي */
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return monthKeyOf(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Brain.toLatinDigits(v.trim());
  let m = t.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) { const mm = +m[2]; return mm >= 1 && mm <= 12 ? monthKeyOf(+m[1], mm) : null; }
  m = t.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) { const mm = +m[1]; return mm >= 1 && mm <= 12 ? monthKeyOf(+m[2], mm) : null; }
  const yearMatch = t.match(/(\d{4})/);
  const monthName = t.replace(/\d{4}/, "").trim();
  if (yearMatch && monthName) {
    const mi = monthIndexOf(monthName);
    if (mi >= 0) return monthKeyOf(+yearMatch[1], mi + 1);
  }
  return null;
}
/* يحوّل خلية نسبة بأي صيغة معقولة لرقم مئوي بمنزلتين عشريتين (٠-١٠٠):
   "47.64%"، "47.64"، أو كسر عشري "0.4764" (يُكتشف تلقائيًا: قيمة بلا
   علامة % و≤١ تُضرب ×١٠٠، غير كذا تُؤخذ كما هي). */
export function parsePctCell(v) {
  if (v == null || v === "") return { error: "فاضية" };
  let s = Brain.toLatinDigits(String(v)).trim();
  const hadPercentSign = s.includes("%");
  s = s.replace(/%/g, "").replace(/,/g, "").trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return { error: `"${v}" مو رقمًا` };
  const pct = (!hadPercentSign && n > 0 && n <= 1) ? n * 100 : n;
  if (pct < 0 || pct > 100) return { error: `${pct}٪ خارج المدى المنطقي (٠–١٠٠٪)` };
  return { value: Math.round(pct * 100) / 100 };
}
const PROGRESS_COL_MATCH = {
  block: (h) => /block/i.test(h) || normalizeArabic(h).includes(normalizeArabic("رقم البلوك")) || normalizeArabic(h) === normalizeArabic("بلوك"),
  month: (h) => /month/i.test(h) || normalizeArabic(h).includes(normalizeArabic("الشهر")) || normalizeArabic(h) === normalizeArabic("تاريخ"),
  pct: (h) => /percent|progress|pct/i.test(h) || normalizeArabic(h).includes(normalizeArabic("نسبة الإنجاز")) || normalizeArabic(h).includes(normalizeArabic("نسبة")),
  note: (h) => /note/i.test(h) || normalizeArabic(h).includes(normalizeArabic("ملاحظة")),
};
function findProgressHeaderRow(raw) {
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i] || [];
    const cols = {};
    row.forEach((cell, c) => {
      if (typeof cell !== "string" || !cell.trim()) return;
      if (cols.block == null && PROGRESS_COL_MATCH.block(cell)) cols.block = c;
      else if (cols.month == null && PROGRESS_COL_MATCH.month(cell)) cols.month = c;
      else if (cols.pct == null && PROGRESS_COL_MATCH.pct(cell)) cols.pct = c;
      else if (cols.note == null && PROGRESS_COL_MATCH.note(cell)) cols.note = c;
    });
    if (cols.block != null && cols.month != null && cols.pct != null) return { idx: i, ...cols };
  }
  return null;
}
/* نصوص تدل إن السطر "لا قراءة لهذا الشهر" بدل قراءة بلوك فعلية — يُكتب أي منها
   بعمود "رقم البلوك" مع ترك عمود "نسبة الإنجاز" فاضيًا. */
const SKIP_MONTH_MARKERS = ["لا قراءة", "بدون قراءة", "لا يوجد قراءة", "-", "no reading", "skip", "none"].map(normalizeArabic);
function isSkipMarker(v) {
  if (v == null) return false;
  const n = normalizeArabic(String(v));
  return n !== "" && SKIP_MONTH_MARKERS.includes(n);
}
/* نسبة مرحلة كما يقرّرها المطوّر مباشرة (أحيانًا تشمل بنودًا زي "الخدمات
   الأرضية" مو مرصودة كبلوك مستقل، فمو دايمًا مطابقة لمتوسط البلوكات) — يُكتب
   اسم المرحلة بعمود "رقم البلوك" بدل رقم بلوك، مع النسبة بعمود "نسبة الإنجاز".
   الصيغة "p1".."p4" مقصودة لمنع أي التباس مع رقم بلوك حقيقي (لا بلوك رقمه
   بحرف)، وأسماء المراحل العربية مقبولة كمان لسهولة الكتابة. */
const PHASE_MARKERS = {
  p1: ["p1", "المرحلة الأولى", "المرحلة 1", "الأولى"],
  p2: ["p2", "المرحلة الثانية", "المرحلة 2", "الثانية"],
  p3: ["p3", "المرحلة الثالثة", "المرحلة 3", "الثالثة"],
  p4: ["p4", "المرحلة الرابعة", "المرحلة 4", "الرابعة"],
};
const PHASE_MARKER_LOOKUP = new Map(
  Object.entries(PHASE_MARKERS).flatMap(([phase, labels]) => labels.map((l) => [normalizeArabic(Brain.toLatinDigits(l)), phase]))
);
function matchPhaseMarker(v) {
  if (v == null) return null;
  const n = normalizeArabic(Brain.toLatinDigits(String(v)).trim());
  return PHASE_MARKER_LOOKUP.get(n) || null;
}
/* المحرّك الرئيسي — ياخذ ملف إكسل مقروء (XLSX.read) وقائمة أرقام البلوكات
   المعروفة حاليًا بقاعدة البيانات، ويرجع {sheetName, readings, skips, errors,
   unknownBlocks, monthsFound} أو {error} لو ما لقى شيت أو صف عناوين صالح.
   بدون رمي استثناء أبدًا — لتقدر الواجهة تعرض رسالة عربية واضحة دائمًا. */
export function parseProgressWorkbook(wb, knownBlockNumbers) {
  const sheetName = wb.SheetNames.find((n) => /تقدم|progress/i.test(n))
    || wb.SheetNames.find((n) => {
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
      return !!findProgressHeaderRow(raw);
    });
  if (!sheetName) return { error: "ما لقيت شيت فيه أعمدة (رقم البلوك / الشهر / نسبة الإنجاز) بهذا الملف. تأكد إنه نفس ملف بيانات التقدم المعتاد." };

  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
  const header = findProgressHeaderRow(raw);
  if (!header) return { error: `ما لقيت صف عناوين يحتوي "رقم البلوك" و"الشهر" و"نسبة الإنجاز" بشيت "${sheetName}".` };

  const readings = [], skips = [], phaseOverrides = [], errors = [], seen = new Map(), seenSkip = new Map(), seenPhase = new Map();
  for (let i = header.idx + 1; i < raw.length; i++) {
    const row = raw[i] || [];
    const excelRow = i + 1;
    const blockCell = row[header.block], monthCell = row[header.month], pctCell = row[header.pct];
    const noteCell = header.note != null ? row[header.note] : null;
    if (blockCell == null && monthCell == null && pctCell == null) continue; /* صف فاضي كليًا — يُتجاوز بصمت */

    const cellRef = (col) => `${XLSX.utils.encode_col(col)}${excelRow}`;
    const isBlank = (v) => v == null || String(v).trim() === "";
    /* صف نموذج جاهز ما عُبّي بعد (رقم بلوك/اسم مرحلة موجود، بس الشهر والنسبة
       فاضيين) — يُتجاوز بصمت، ما يحتاج حذفه يدويًا لو ما احتاجه هذا الشهر. */
    if (isBlank(monthCell) && isBlank(pctCell) && !isSkipMarker(blockCell)) continue;

    /* سطر "لا قراءة لهذا الشهر" — بلا رقم بلوك ولا نسبة، يسجَّل كملاحظة شهر
       بدل قراءة بلوك، فيظهر بالموقع كسبب صريح بدل تخمين صامت. */
    if (isSkipMarker(blockCell)) {
      const mk = parseMonthCell(monthCell);
      if (!mk) { errors.push(`${cellRef(header.month)}: سطر "لا قراءة" بشهر غير مفهوم ("${monthCell ?? ""}")`); continue; }
      if (seenSkip.has(mk)) { errors.push(`${cellRef(header.block)}: سطر "لا قراءة" مكرّر لشهر ${mk} (أول ظهور بـ${seenSkip.get(mk)})`); continue; }
      seenSkip.set(mk, cellRef(header.block));
      skips.push({ month: mk, note: noteCell ? String(noteCell).trim() : "", cellRef: cellRef(header.block) });
      continue;
    }

    /* سطر نسبة مرحلة مباشرة من المطوّر — تحلّ محل المتوسط المحسوب من بلوكات
       تلك المرحلة لهذا الشهر بالذات فقط، وما تمس بقية الأشهر ولا البلوكات. */
    const phaseMark = matchPhaseMarker(blockCell);
    if (phaseMark) {
      const mk = parseMonthCell(monthCell);
      if (!mk) { errors.push(`${cellRef(header.month)}: سطر نسبة مرحلة بشهر غير مفهوم ("${monthCell ?? ""}")`); continue; }
      const pr = parsePctCell(pctCell);
      if (pr.error) { errors.push(`${cellRef(header.pct)}: ${pr.error}`); continue; }
      const dupKey = `${phaseMark}|${mk}`;
      if (seenPhase.has(dupKey)) { errors.push(`${cellRef(header.block)}: نسبة ${phaseMark} مكرّرة لنفس الشهر ${mk} (أول ظهور بـ${seenPhase.get(dupKey)})`); continue; }
      seenPhase.set(dupKey, cellRef(header.block));
      phaseOverrides.push({ phase: phaseMark, month: mk, pct: pr.value, cellRef: cellRef(header.pct) });
      continue;
    }

    const bnum = Number(Brain.toLatinDigits(String(blockCell ?? "")).trim());
    if (!Number.isInteger(bnum) || bnum <= 0) {
      /* سطر تعليمات/عنوان قسم (مثل "⬇ الشهر القادم...") بلا شهر ولا نسبة —
         يُتجاوز بصمت بدل ما يُحسب خطأ، فما يحتاج المستخدم يحذفه يدويًا. */
      if (monthCell == null && pctCell == null) continue;
      errors.push(`${cellRef(header.block)}: رقم بلوك غير صالح ("${blockCell ?? ""}")`); continue;
    }

    const mk = parseMonthCell(monthCell);
    if (!mk) { errors.push(`${cellRef(header.month)}: تعذّر فهم الشهر ("${monthCell ?? ""}") — استخدم صيغة 2026-02 أو "فبراير 2026"`); continue; }

    const pr = parsePctCell(pctCell);
    if (pr.error) { errors.push(`${cellRef(header.pct)}: ${pr.error}`); continue; }

    const dupKey = `${bnum}|${mk}`;
    if (seen.has(dupKey)) { errors.push(`${cellRef(header.block)}: بلوك ${bnum} مكرّر لنفس الشهر ${mk} (أول ظهور بـ${seen.get(dupKey)}) — احذف أحد الصفّين`); continue; }
    seen.set(dupKey, cellRef(header.block));

    readings.push({ block: bnum, month: mk, pct: pr.value, cellRef: cellRef(header.pct) });
  }

  /* شهر ما ينفع يكون له كل من قراءات بلوكات فعلية وسطر "لا قراءة" بنفس الوقت —
     تناقض بالملف نفسه، يحتاج تصحيح لا تخمين. */
  const readingMonths = new Set(readings.map((r) => r.month));
  skips.filter((s) => readingMonths.has(s.month)).forEach((s) => {
    errors.push(`${s.cellRef}: شهر ${s.month} عنده قراءات بلوكات فعلية وسطر "لا قراءة" بنفس الوقت — احذف أحدهما`);
  });
  const cleanSkips = skips.filter((s) => !readingMonths.has(s.month));

  if (!readings.length && !cleanSkips.length && !phaseOverrides.length && !errors.length) return { error: `شيت "${sheetName}" ما فيه أي صف بيانات تحت صف العناوين.` };
  const unknownBlocks = [...new Set(readings.filter((r) => !knownBlockNumbers.has(r.block)).map((r) => r.block))].sort((a, b) => a - b);
  const monthsFound = [...new Set(readings.map((r) => r.month))].sort();
  return { sheetName, readings, skips: cleanSkips, phaseOverrides, errors, unknownBlocks, monthsFound };
}

/* ينشئ ملف إكسل بنفس التنسيق المسطّح من قراءات وملاحظات "لا قراءة" ونسب
   مراحل مباشرة موجودة حاليًا بقاعدة البيانات — زر "تنزيل الملف الحالي" بلوحة
   الرفع. الملف ذاته يخرج جاهزًا للتحديث القادم: تاريخ كامل بلا فجوات + سطور
   الشهر الجديد فاضية بالأسفل (١٦ بلوك + ٤ مراحل اختيارية) — تعبّي الأرقام
   مباشرة وترفعه، فما يصير ازدواجية ولا لخبطة بمكان الإضافة كل شهر. */
export function downloadProgressTemplate(rows, blocksMeta, monthNotes, phaseOverrides) {
  const phaseLabel = { p1: "الأولى", p2: "الثانية", p3: "الثالثة", p4: "الرابعة" };
  const phaseFullLabel = { p1: "المرحلة الأولى", p2: "المرحلة الثانية", p3: "المرحلة الثالثة", p4: "المرحلة الرابعة" };
  const phaseSortRank = { p1: 91, p2: 92, p3: 93, p4: 94 };
  const byBlock = Object.fromEntries((blocksMeta || []).map((b) => [b.block_number, b]));
  const monthsWithRows = new Set(rows.map((r) => r.month));
  /* أشهر "لا قراءة" — تُدرَج كسطر واحد بكل شهر بدل ما تبقى غيابًا صامتًا،
     فيفضل الملف مرجعًا متصلًا يحكي القصة كاملة لوحده. */
  const skipEntries = Object.entries(monthNotes || {}).filter(([mk]) => !monthsWithRows.has(mk));
  const dataRows = [
    ...rows.map((r) => ({ month: r.month, block: r.block_number, cells: [r.block_number, (byBlock[r.block_number] ? `المرحلة ${phaseLabel[byBlock[r.block_number].phase] || byBlock[r.block_number].phase}` : ""), r.month, r.pct / 100, ""] })),
    ...skipEntries.map(([mk, note]) => ({ month: mk, block: -1, cells: ["لا قراءة", "", mk, "", note || ""] })),
    /* نسب مراحل مباشرة من المطوّر — تظهر بعد بلوكات نفس الشهر، آخر السطور. */
    ...(phaseOverrides || []).map((o) => ({ month: o.month, block: phaseSortRank[o.phase] || 99, cells: [phaseFullLabel[o.phase] || o.phase, "", o.month, o.pct / 100, "رقم مباشر من المطوّر — يحلّ محلّ متوسط البلوكات لهذه المرحلة/الشهر"] })),
  ].sort((a, b) => a.month.localeCompare(b.month) || a.block - b.block);

  const aoa = [["رقم البلوك", "المرحلة", "الشهر", "نسبة الإنجاز", "ملاحظة"], ...dataRows.map((r) => r.cells)];

  /* سطور الشهر القادم — فاضية جاهزة للتعبئة المباشرة، نفس الترتيب والبلوكات
     كل مرة، فيصير مكان الإضافة معروفًا دائمًا وما يصير ازدواجية صفوف. */
  const allMonths = dataRows.map((r) => r.month).filter(Boolean).sort();
  const lastMonth = allMonths[allMonths.length - 1];
  if (lastMonth) {
    const nextMonth = nextMonthKey(lastMonth);
    const orderedBlocks = (blocksMeta && blocksMeta.length ? blocksMeta.map((b) => b.block_number) : PG_BLOCK_DISPLAY_ORDER);
    aoa.push([`⬇ الشهر القادم (${nextMonth}) — عبّي الشهر والنسبة بكل صف مباشرة`, "", "", "", ""]);
    orderedBlocks.forEach((b) => {
      const meta = byBlock[b];
      aoa.push([b, meta ? `المرحلة ${phaseLabel[meta.phase] || meta.phase}` : "", "", "", ""]);
    });
    aoa.push([`⬇ رقم مرحلة مباشر من المطوّر (اختياري) — عبّيه بس لو مختلف عن متوسط بلوكاته`, "", "", "", ""]);
    ["p1", "p2", "p3", "p4"].forEach((p) => aoa.push([phaseFullLabel[p], "", "", "", "رقم مباشر من المطوّر — اختياري"]));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 38 }];
  for (let i = 1; i < aoa.length; i++) { const cell = ws[XLSX.utils.encode_cell({ r: i, c: 3 })]; if (cell && typeof cell.v === "number") cell.z = "0.00%"; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "بيانات_التقدم");
  XLSX.writeFile(wb, `تقدم_التنفيذ_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
