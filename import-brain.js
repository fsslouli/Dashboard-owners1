/* ═══════════════════════════════════════════════════════════
   مدقّق ملفات الاستفسارات — حتمي بالكامل، بلا شبكة وبلا خدمة خارجية.

   نفس الملف يعطي نفس النتيجة دائمًا. كل قاعدة مكتوبة هنا صراحة، فتقدر
   تراجعها وتحتج عليها — مو رأي يتغيّر من مرة لمرة.

   خمس طبقات:
     ١) بنية الملف    — ربط الأعمدة، المتجاهَل منها، أخطاء إكسل
     ٢) تعريف الأعمدة — نمط كل عمود، والخلايا الشاذة عنه
     ٣) قواعد المنطق  — التناقضات بين الحقول داخل الصف
     ٤) عابر الصفوف   — إزاحة الصفوف، انزياح التوزيع، الحذف الجماعي
     ٥) الملف المرجعي — بصمة إحصائية من السجل الحالي يُقاس عليها الجديد

   المستويات: blocker (أوقف واقرأ) ← high ← medium ← low
   المستوى ما يمنع الاعتماد — يُعرض بوضوح والقرار للمشرف.
   ═══════════════════════════════════════════════════════════ */

/* ── ١. توحيد النص العربي ── */
const AR_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
                    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };

export const toLatinDigits = (s) => String(s ?? "").replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d] || d);

/* توحيد فضفاض للمقارنة فقط — ما يُحفظ بقاعدة البيانات أبدًا.
   الهدف: نمنع «فرق زائف» بسبب مسافة أو تطويل أو همزة أو علامة ترقيم. */
export function normLoose(v) {
  let s = toLatinDigits(v).toLowerCase();
  s = s.replace(/[\u064B-\u0652\u0640]/g, "");            // تشكيل وتطويل
  s = s.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
  s = s.replace(/[.,،؛;:!؟?()\[\]{}"'«»\-_/\\|]+/g, " "); // ترقيم
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export const sameValue = (a, b) => normLoose(a) === normLoose(b);
export const isBlank = (v) => v === null || v === undefined || String(v).trim() === "";

/* تشابه نصي 0..1 — Dice على ثنائيات الحروف، أسرع وأدق من Levenshtein للنصوص الطويلة */
export function similarity(a, b) {
  const x = normLoose(a), y = normLoose(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0;
  return diceFromGrams(bigrams(x), bigrams(y));
}

/* خريطة الثنائيات تُبنى مرة لكل نص. الفحص الزوجي كان يعيد بناءها لكل مقارنة،
   وهذا كان أغلى بكثير من المقارنة نفسها على الملفات الكبيرة. */
export function bigrams(normalized) {
  const m = new Map();
  let total = 0;
  for (let i = 0; i < normalized.length - 1; i++) {
    const g = normalized.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
    total++;
  }
  return { m, total };
}

export function diceFromGrams(a, b) {
  if (!a.total && !b.total) return 1;
  if (!a.total || !b.total) return 0;
  const [small, big] = a.m.size <= b.m.size ? [a, b] : [b, a];
  let hit = 0;
  small.m.forEach((n, g) => { const o = big.m.get(g); if (o) hit += Math.min(n, o); });
  return (2 * hit) / (a.total + b.total);
}

/* ── ٢. صيغ نعم/لا ── */
const YES = ["نعم", "نعم.", "ايوه", "أيوه", "تم", "مغلق", "مغلقة", "مقفل", "مقفلة", "y", "yes", "true", "1", "✓", "✔"];
const NO = ["لا", "لا.", "مفتوح", "مفتوحة", "غير مغلق", "لم يتم", "n", "no", "false", "0", "-", "—"];
export function toYesNoSmart(v) {
  if (isBlank(v)) return null;
  if (v === true) return "نعم";
  if (v === false) return "لا";
  const n = normLoose(v);
  if (YES.some((y) => normLoose(y) === n)) return "نعم";
  if (NO.some((y) => normLoose(y) === n)) return "لا";
  return null;
}

/* ── ٣. تصحيحات آمنة يسويها المحرك بنفسه ──
   «آمنة» = ما تغيّر المعنى، وتقدر تراجعها كلها بالقائمة قبل الاعتماد. */
const TEXT_FIELDS = ["model", "loc", "pri", "cat", "status", "owner", "month", "note", "reply", "note_en", "reply_en"];

export function autoFixRow(row) {
  const out = { ...row };
  const fixes = [];
  const push = (field, from, to, why) => { if (String(from ?? "") !== String(to ?? "")) { fixes.push({ field, from, to, why }); out[field] = to; } };

  TEXT_FIELDS.forEach((f) => {
    if (out[f] == null) return;
    const raw = String(out[f]);
    const cleaned = raw.replace(/[\u200e\u200f\u202a-\u202e]/g, "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
    push(f, raw, cleaned, "مسافات ورموز اتجاه زائدة");
  });

  if (out.id != null && String(out.id).trim() !== "") {
    const latin = toLatinDigits(out.id).replace(/[^\d]/g, "");
    if (latin) push("id", out.id, Number(latin), "توحيد الأرقام العربية");
  }
  if (out.month != null) push("month", out.month, toLatinDigits(out.month), "توحيد الأرقام العربية");

  ["closed"].forEach((f) => {
    const yn = toYesNoSmart(out[f]);
    if (yn) push(f, out[f], yn, "توحيد صيغة نعم/لا");
  });
  ["answered", "urgent", "important"].forEach((f) => {
    if (out[f] === undefined) return;
    const yn = toYesNoSmart(out[f]);
    if (yn) push(f, out[f], yn === "نعم", "توحيد صيغة نعم/لا");
  });

  return { row: out, fixes };
}

/* ── ٣ب. تثبيت الإملاء على القيمة المعتمدة ──
   «معتمده» و«معتمدة» نفس القيمة عند المقارنة، لكن اللي ينكتب بقاعدة البيانات
   لازم يكون الصيغة المعتمدة وحدها — وإلا تراكمت صيغ متعددة لنفس القيمة
   وانكسرت الفلاتر والرسوم مع الوقت. */
export function canonicalizeToApproved(row, approved = {}) {
  const out = { ...row };
  const fixes = [];
  Object.entries(approved).forEach(([field, list]) => {
    const v = out[field];
    if (isBlank(v) || !Array.isArray(list)) return;
    const exact = list.find((a) => String(a) === String(v));
    if (exact) return;
    const loose = list.find((a) => sameValue(a, v));
    if (loose) { fixes.push({ field, from: v, to: loose, why: "تثبيت إملاء القيمة المعتمدة" }); out[field] = loose; }
  });
  return { row: out, fixes };
}

/* ── ٤. أقرب قيمة معتمدة ── */
export function closestApproved(value, approved, floor = 0.62) {
  let best = null, score = 0;
  (approved || []).forEach((a) => { const s = similarity(value, a); if (s > score) { score = s; best = a; } });
  return score >= floor ? { value: best, score } : null;
}

/* ══════════ مسمّيات ومستويات ══════════ */
const FIELD_AR = {
  id: "الرقم", model: "النموذج", loc: "الموقع", pri: "الأولوية", cat: "الفئة", status: "الحالة",
  owner: "المسؤول", month: "الشهر", note: "الملاحظة", note_en: "الملاحظة (EN)",
  reply: "الرد", reply_en: "الرد (EN)", closed: "الإغلاق", answered: "حالة الرد", meetings: "الاجتماعات",
};
export const fieldLabel = (f) => FIELD_AR[f] || f;

const LEVEL_RANK = { blocker: 0, high: 1, medium: 2, low: 3 };
export const LEVEL_AR = { blocker: "أوقف واقرأ", high: "حرج", medium: "يستحق المراجعة", low: "ملاحظة" };

const OPEN_STATUSES = ["قيد الدراسة", "تم التصويت"];
const DECIDED_STATUSES = ["معتمدة", "تم الرفض"];

/* مصنع الملاحظات — يوحّد الشكل ويبني عنوان خلية إكسل حقيقي متى ما توفّر */
function makeCollector(ctx = {}) {
  const list = [];
  const add = (level, code, msg, opts = {}) => {
    const { key = "—", field = "", excelRow = null, suggest = "" } = opts;
    let cell = "";
    const letter = ctx.colLetterOf && ctx.colLetterOf[field];
    if (excelRow && letter) cell = letter + excelRow;
    else if (excelRow) cell = "صف " + excelRow;
    list.push({ level, code, sheet: ctx.sheet || "", key: String(key), field, cell, msg, suggest });
  };
  return { list, add };
}

/* ══════════ ١) بنية الملف ══════════ */
export function auditStructure(meta = {}, { sheet = "", requiredFields = ["note"] } = {}) {
  const { add, list } = makeCollector({ sheet, colLetterOf: meta.colLetterOf || {} });
  const cols = meta.columns || [];
  const mapped = cols.filter((c) => c.field);

  requiredFields.forEach((f) => {
    if (!mapped.some((c) => c.field === f))
      add("blocker", "MISSING_REQUIRED",
        `ما فيه عمود انربط بحقل «${fieldLabel(f)}» — الشيت ما يصلح للمزامنة بدونه`, { field: f });
  });

  const ignored = cols.filter((c) => !c.field && c.nonEmpty > 0);
  if (ignored.length)
    add("high", "IGNORED_COLUMNS",
      `${ignored.length} عمود فيه بيانات ما انربط بأي حقل وراح يُهمل بالكامل: ${ignored.map((c) => `${c.letter} «${c.raw || "بلا عنوان"}»`).join("، ")}`,
      { suggest: "عدّل عنوان العمود بالملف ليطابق المعتمد، أو تجاهله بوعي" });

  const groups = new Map();
  mapped.forEach((c) => groups.set(c.field, [...(groups.get(c.field) || []), c]));
  groups.forEach((group, field) => {
    if (group.length > 1)
      add("medium", "DUPLICATE_COLUMNS",
        `عمودان أو أكثر انربطوا بحقل «${fieldLabel(field)}»: ${group.map((c) => `${c.letter} «${c.raw}»`).join("، ")} — تُعتمد أول قيمة غير فارغة`,
        { field });
  });

  (meta.errorCells || []).slice(0, 20).forEach((e) =>
    add("high", "EXCEL_ERROR", `خلية فيها خطأ إكسل (${e.value})`,
      { key: e.key ?? "—", field: e.field || "", excelRow: e.excelRow }));
  if ((meta.errorCells || []).length > 20)
    add("high", "EXCEL_ERROR_MORE", `و${meta.errorCells.length - 20} خلية أخرى فيها أخطاء إكسل`);

  if (meta.headerRowIndex > 0)
    add("low", "HEADER_OFFSET", `صف العناوين مو أول صف بالشيت — اعتُمد الصف ${meta.headerRowIndex + 1}`);
  if (!meta.rowCount)
    add("blocker", "EMPTY_SHEET", "الشيت ما فيه أي صف بيانات بعد صف العناوين");

  return list;
}

/* ══════════ ٢) تعريف الأعمدة ══════════ */
const isNumeric = (v) => /^\d+([.,]\d+)?$/.test(toLatinDigits(v).trim());

export function profileColumns(rows = [], meta = {}, { sheet = "" } = {}) {
  const { add, list } = makeCollector({ sheet, colLetterOf: meta.colLetterOf || {} });
  if (rows.length < 8) return list;   // عيّنة صغيرة = استنتاج غير موثوق

  const fields = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  fields.forEach((f) => {
    if (["note", "reply", "note_en", "reply_en", "meetings"].includes(f)) return;
    const vals = rows.map((r, i) => ({ v: r[f], i })).filter((x) => !isBlank(x.v));
    if (vals.length < 8) return;
    const ratio = vals.filter((x) => isNumeric(x.v)).length / vals.length;

    if (ratio >= 0.9 && ratio < 1)
      vals.filter((x) => !isNumeric(x.v)).slice(0, 6).forEach((x) =>
        add("medium", "TYPE_OUTLIER",
          `قيمة نصية داخل عمود «${fieldLabel(f)}» أغلبه أرقام: «${String(x.v).slice(0, 30)}»`,
          { key: rows[x.i]?.id ?? "—", field: f, excelRow: meta.excelRowOf?.[x.i] }));

    if (ratio > 0 && ratio <= 0.1)
      vals.filter((x) => isNumeric(x.v)).slice(0, 6).forEach((x) =>
        add("low", "TYPE_OUTLIER",
          `قيمة رقمية داخل عمود «${fieldLabel(f)}» أغلبه نصوص: «${String(x.v).slice(0, 30)}»`,
          { key: rows[x.i]?.id ?? "—", field: f, excelRow: meta.excelRowOf?.[x.i] }));
  });

  const shapes = new Set();
  rows.forEach((r) => {
    if (isBlank(r.month)) return;
    const s = toLatinDigits(r.month).trim();
    if (/^\d{4}-\d{2}$/.test(s)) shapes.add("YYYY-MM");
    else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) shapes.add("D/M/Y");
    else if (/^\d{4}$/.test(s)) shapes.add("YYYY");
    else shapes.add("نص حر");
  });
  if (shapes.size > 1)
    add("medium", "MIXED_DATE_FORMATS",
      `عمود الشهر فيه ${shapes.size} صيغ مختلفة (${[...shapes].join("، ")}) — بعضها ممكن ما يُقرأ`, { field: "month" });

  return list;
}

/* ══════════ ٣) قواعد المنطق داخل الصف ══════════ */
export function auditLogic(rows = [], { existing = [], approved = {}, meta = {}, sheet = "", projectStart = "2024-01" } = {}) {
  const { add, list } = makeCollector({ sheet, colLetterOf: meta.colLetterOf || {} });
  const byId = new Map(existing.map((r) => [String(r.id), r]));
  const seenIds = new Map();
  const nowMonth = new Date().toISOString().slice(0, 7);

  rows.forEach((row, i) => {
    const key = String(row.id ?? "").trim() || "—";
    const at = { key, excelRow: meta.excelRowOf?.[i] };

    if (isBlank(row.note)) add("high", "EMPTY_NOTE", "صف بلا نص ملاحظة — ما له معنى بالسجل", { ...at, field: "note" });

    if (key !== "—") {
      if (seenIds.has(key))
        add("high", "DUP_ID", `الرقم مكرر داخل نفس الملف (تكرر مع صف إكسل ${seenIds.get(key)})`, { ...at, field: "id" });
      else seenIds.set(key, meta.excelRowOf?.[i] ?? "?");
      if (!/^\d+$/.test(toLatinDigits(key)))
        add("medium", "BAD_ID", "الرقم مو رقمًا صحيحًا", { ...at, field: "id" });
    }

    const closed = toYesNoSmart(row.closed);
    const answered = toYesNoSmart(row.answered);
    const st = String(row.status ?? "").trim();
    const isOpen = OPEN_STATUSES.some((s) => sameValue(s, st));
    const isDecided = DECIDED_STATUSES.some((s) => sameValue(s, st));

    if (closed === "نعم" && isOpen)
      add("high", "CONTRA_CLOSED", `مقفلة = نعم مع حالة «${st}» — تناقض`, { ...at, field: "closed", suggest: "لا" });
    if (closed === "لا" && isDecided)
      add("medium", "CONTRA_OPEN", `الحالة «${st}» محسومة والبند مفتوح`, { ...at, field: "closed", suggest: "نعم" });
    if (isDecided && isBlank(row.reply))
      add("medium", "DECIDED_NO_REPLY", `حالة «${st}» بلا نص رد`, { ...at, field: "reply" });
    if (answered === "نعم" && isBlank(row.reply))
      add("medium", "ANSWERED_NO_REPLY", "تم الرد = نعم لكن خانة الرد فاضية", { ...at, field: "answered", suggest: "لا" });
    if (answered === "لا" && !isBlank(row.reply))
      add("low", "REPLY_NOT_ANSWERED", "فيه نص رد لكن تم الرد = لا", { ...at, field: "answered", suggest: "نعم" });
    if (!isBlank(row.reply) && isBlank(row.owner) && row.owner !== undefined)
      add("low", "REPLY_NO_OWNER", "فيه رد بلا مهندس مسؤول مسجّل", { ...at, field: "owner" });

    const mk = toLatinDigits(row.month || "").trim();
    if (/^\d{4}-\d{2}$/.test(mk)) {
      if (mk > nowMonth) add("medium", "FUTURE_MONTH", `الشهر «${mk}» بالمستقبل`, { ...at, field: "month" });
      if (mk < projectStart) add("low", "OLD_MONTH", `الشهر «${mk}» قبل بداية المشروع`, { ...at, field: "month" });
    }

    Object.entries(approved).forEach(([field, vlist]) => {
      const v = row[field];
      if (isBlank(v) || !Array.isArray(vlist) || !vlist.length) return;
      if (vlist.some((a) => sameValue(a, v))) return;
      const near = closestApproved(v, vlist);
      add(near ? "medium" : "low", "UNAPPROVED_VALUE",
        `القيمة «${String(v).slice(0, 40)}» مو ضمن القيم المعتمدة لحقل «${fieldLabel(field)}»`,
        { ...at, field, suggest: near ? near.value : "" });
    });

    const cur = byId.get(key);
    if (cur) {
      ["note", "reply", "status", "cat", "loc", "model", "month", "owner", "pri"].forEach((f) => {
        if (row[f] !== undefined && !isBlank(cur[f]) && isBlank(row[f]))
          add("high", "CLEARS_FIELD",
            `الملف يفرّغ حقل «${fieldLabel(f)}» وهو معبّأ حاليًا — غالبًا شيت ناقص مو حذفًا مقصودًا`, { ...at, field: f });
      });
      if (!isBlank(cur.note) && !isBlank(row.note) && similarity(cur.note, row.note) < 0.4)
        add("medium", "NOTE_REPLACED", "نص الملاحظة تغيّر جذريًا على نفس الرقم", { ...at, field: "note" });
      if (DECIDED_STATUSES.some((s) => sameValue(s, cur.status)) && isOpen)
        add("medium", "STATUS_BACKWARDS", `رجوع للخلف: من «${cur.status}» إلى «${st}»`, { ...at, field: "status" });
    }
  });

  return list;
}

/* ══════════ ٤) عابر الصفوف ══════════ */

/* إزاحة الصفوف: أخطر عطل صامت. لو نص البند ٤٧ الجديد يطابق نص البند ٤٦
   القديم وتكرر النمط، فالملف كله مزاح — والمقارنة العادية تعتبرها تعديلات
   مشروعة وتستبدل بيانات صحيحة ببيانات بند ثاني. */
export function detectRowShift(rows = [], existing = [], { sheet = "", minRun = 4 } = {}) {
  const { add, list } = makeCollector({ sheet });
  if (rows.length < minRun || existing.length < minRun) return list;
  const byId = new Map(existing.map((r) => [String(r.id), r]));

  let best = null;
  for (const offset of [-1, 1]) {
    let checked = 0, wins = 0, sumSh = 0, sumOwn = 0;
    const examples = [];
    rows.forEach((row) => {
      const id = Number(toLatinDigits(row.id));
      if (!id || isBlank(row.note)) return;
      const shifted = byId.get(String(id + offset));
      const own = byId.get(String(id));
      if (!shifted || !own || isBlank(shifted.note) || isBlank(own.note)) return;
      checked++;
      const sh = similarity(row.note, shifted.note);
      const ow = similarity(row.note, own.note);
      sumSh += sh; sumOwn += ow;
      if (sh >= 0.85 && sh > ow + 0.02) {
        wins++;
        if (examples.length < 3) examples.push(`#${id} يحمل نص #${id + offset}`);
      }
    });
    if (checked < minRun || wins < minRun) continue;
    const meanSh = sumSh / checked, meanOwn = sumOwn / checked, ratio = wins / checked;

    /* الشرط ليس «التشابه عالٍ» بل «المحاذاة المزاحة أفضل بشكل منهجي».
       بالملفات ذات الصياغة القالبية يكون التشابه عاليًا بالحالتين، فالفارق
       وحده هو الدليل. وشرط meanOwn < 0.98 يمنع الإنذار الكاذب حين تكون
       المحاذاة الصحيحة مطابقة أصلًا وما فيه إزاحة أساسًا. */
    if (ratio >= 0.6 && meanSh >= 0.85 && meanSh > meanOwn + 0.02 && meanOwn < 0.98) {
      const score = ratio * (meanSh - meanOwn);
      if (!best || score > best.score) best = { score, offset, wins, checked, ratio, examples };
    }
  }

  if (best)
    add("blocker", "ROW_SHIFT",
      `يبدو أن صفوف الملف مزاحة بمقدار ${Math.abs(best.offset)} — ${best.wins} من ${best.checked} صف يطابق نص بند مجاور أكثر من بنده هو (${best.examples.join("، ")}). الاعتماد بهذا الشكل يستبدل بيانات صحيحة ببيانات بند ثاني.`,
      { suggest: "افتح الملف وتأكد من محاذاة عمود الرقم مع بقية الأعمدة" });

  return list;
}

/* انزياح التوزيع: انقلاب مفاجئ بنسب حقل = مؤشر على عمود بمكان غلط */
export function detectDistributionShift(rows = [], existing = [], { fields = ["status", "cat", "pri", "model"], sheet = "", minRows = 20, threshold = 0.35 } = {}) {
  const { add, list } = makeCollector({ sheet });
  if (rows.length < minRows || existing.length < minRows) return list;

  const dist = (arr, f) => {
    const m = new Map(); let n = 0;
    arr.forEach((r) => { if (isBlank(r[f])) return; const k = normLoose(r[f]); m.set(k, (m.get(k) || 0) + 1); n++; });
    return { m, n };
  };

  fields.forEach((f) => {
    const a = dist(existing, f), b = dist(rows, f);
    if (a.n < minRows || b.n < minRows) return;
    const keys = new Set([...a.m.keys(), ...b.m.keys()]);
    let tv = 0;
    keys.forEach((k) => { tv += Math.abs((a.m.get(k) || 0) / a.n - (b.m.get(k) || 0) / b.n); });
    tv /= 2;
    if (tv >= threshold)
      add("high", "DIST_SHIFT",
        `توزيع «${fieldLabel(f)}» تغيّر بنسبة ${Math.round(tv * 100)}٪ دفعة واحدة مقابل السجل الحالي — راجع أن العمود بمكانه الصحيح`,
        { field: f });
  });
  return list;
}

/* الحذف الجماعي: نسبة كبيرة «غير موجودة بالملف» = شيت جزئي، مو قرار حذف */
export function detectMassRemoval(diffResults = []) {
  const { add, list } = makeCollector({});
  diffResults.forEach((r) => {
    if (r.mode === "replace") {
      const incoming = (r.newRows || []).length;
      if (r.removedCount > 0 && incoming < r.removedCount * 0.5)
        add("blocker", "MASS_REPLACE",
          `«${r.sheetName}» بوضع الاستبدال الكامل: ${incoming} صف يحل محل ${r.removedCount} — أكثر من نصف السجل بينمسح`,
          { suggest: "لو المقصود تحديث جزئي، بدّل الوضع إلى «دمج»" });
      return;
    }
    const missing = (r.missing || []).length;
    const base = r.currentCount ?? (missing + (r.changed || []).length);
    if (!missing || !base) return;
    const ratio = missing / base;
    if (ratio >= 0.5)
      add("blocker", "MASS_MISSING",
        `«${r.sheetName}»: ${missing} بند بالسجل ما ورد بالملف (${Math.round(ratio * 100)}٪) — الغالب أنه شيت جزئي`,
        { suggest: "تجاهل «غير الموجود بالملف» إلا إذا كنت فعلاً تبي حذفها" });
    else if (ratio >= 0.2)
      add("medium", "SOME_MISSING", `«${r.sheetName}»: ${missing} بند بالسجل ما ورد بالملف`, {});
  });
  return list;
}

/* تكرار بالمعنى داخل الملف — لفظي لا دلالي، بسقوف تمنع تجميد الواجهة */
export function detectDuplicates(rows = [], { sheet = "", meta = {}, rowCap = 800, hitCap = 50, floor = 0.9 } = {}) {
  const { add, list } = makeCollector({ sheet, colLetterOf: meta.colLetterOf || {} });
  if (rows.length > rowCap) return list;

  const notes = rows.map((r) => (isBlank(r.note) ? "" : normLoose(r.note)));
  const grams = notes.map((n) => (n ? bigrams(n) : null));
  let hits = 0;
  outer:
  for (let i = 0; i < rows.length; i++) {
    if (!notes[i]) continue;
    for (let j = i + 1; j < rows.length; j++) {
      if (!notes[j]) continue;
      if (String(rows[i].id) === String(rows[j].id)) continue;
      const lo = Math.min(notes[i].length, notes[j].length), hi = Math.max(notes[i].length, notes[j].length);
      if (lo / hi < 0.75) continue;
      if (diceFromGrams(grams[i], grams[j]) >= floor) {
        add("medium", "NEAR_DUP",
          `يشبه صف «${rows[j].id ?? "—"}» بنسبة عالية — يحتمل تكرار بصياغة مختلفة`,
          { key: rows[i].id ?? "—", field: "note", excelRow: meta.excelRowOf?.[i] });
        hits++;
        if (hits >= hitCap) break outer;
        break;
      }
    }
  }
  return list;
}

/* ══════════ ٥) الملف المرجعي من السجل الحالي ══════════ */
export function buildProfile(existing = []) {
  const freq = {};
  const pairs = new Set();
  const noteLens = [];
  ["model", "loc", "pri", "cat", "status", "owner"].forEach((f) => {
    freq[f] = new Map();
    existing.forEach((r) => {
      if (isBlank(r[f])) return;
      const k = normLoose(r[f]);
      freq[f].set(k, (freq[f].get(k) || 0) + 1);
    });
  });
  existing.forEach((r) => {
    if (!isBlank(r.model) && !isBlank(r.loc)) pairs.add(normLoose(r.model) + "|" + normLoose(r.loc));
    if (!isBlank(r.note)) noteLens.push(String(r.note).trim().length);
  });
  noteLens.sort((a, b) => a - b);
  const q = (p) => (noteLens.length ? noteLens[Math.min(noteLens.length - 1, Math.floor(noteLens.length * p))] : null);
  return { n: existing.length, freq, pairs, noteLen: { p05: q(0.05), p50: q(0.5), p95: q(0.95) } };
}

export function auditAgainstProfile(rows = [], profile, { sheet = "", meta = {} } = {}) {
  const { add, list } = makeCollector({ sheet, colLetterOf: meta.colLetterOf || {} });
  if (!profile || profile.n < 20) return list;   // مرجع ضعيف = استنتاج غير موثوق
  const { noteLen, pairs } = profile;

  rows.forEach((row, i) => {
    const at = { key: row.id ?? "—", excelRow: meta.excelRowOf?.[i] };

    if (!isBlank(row.note) && noteLen.p05 != null) {
      const len = String(row.note).trim().length;
      if (len < Math.max(8, noteLen.p05 * 0.4))
        add("low", "NOTE_TOO_SHORT",
          `الملاحظة أقصر بكثير من المعتاد بسجلك (${len} حرف مقابل وسيط ${noteLen.p50}) — قد تكون مبتورة`,
          { ...at, field: "note" });
      if (noteLen.p95 && len > noteLen.p95 * 3)
        add("low", "NOTE_TOO_LONG",
          `الملاحظة أطول بكثير من المعتاد (${len} حرف) — قد تكون خليتان اندمجتا`, { ...at, field: "note" });
    }

    if (!isBlank(row.model) && !isBlank(row.loc) && !pairs.has(normLoose(row.model) + "|" + normLoose(row.loc)))
      add("low", "NEW_PAIR",
        `تركيبة «${row.model} + ${row.loc}» ما ظهرت من قبل بسجلك — تأكد أنها صحيحة`, { ...at, field: "loc" });
  });

  return list;
}

/* ══════════ المشغّل الموحّد ══════════ */
export function runFullAudit({ sheets = [], existing = [], approved = {}, diffResults = [], projectStart } = {}) {
  let findings = [];
  const structure = [];
  const profile = buildProfile(existing);

  sheets.forEach((s) => {
    if (s.target && s.target !== "inquiries") return;
    const meta = s.meta || {};
    const rows = s.rows || [];
    const sheet = s.name || "";
    structure.push({ sheet, columns: meta.columns || [], rowCount: rows.length });
    findings = findings.concat(
      auditStructure(meta, { sheet, requiredFields: ["note"] }),
      profileColumns(rows, meta, { sheet }),
      auditLogic(rows, { existing, approved, meta, sheet, projectStart }),
      detectRowShift(rows, existing, { sheet }),
      detectDistributionShift(rows, existing, { sheet }),
      detectDuplicates(rows, { sheet, meta }),
      auditAgainstProfile(rows, profile, { sheet, meta }),
    );
  });

  findings = findings.concat(detectMassRemoval(diffResults));
  findings.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);

  const CAP = 400;
  let truncated = 0;
  if (findings.length > CAP) { truncated = findings.length - CAP; findings = findings.slice(0, CAP); }
  const counts = findings.reduce((a, f) => { a[f.level] = (a[f.level] || 0) + 1; return a; }, {});
  return { findings, counts, truncated, structure };
}

/* ══════════ ملخّص التغيير ══════════ */
export function changeDigest(results = []) {
  const lines = [];
  let tAdd = 0, tChg = 0, tMiss = 0;
  const fieldTally = new Map();

  results.forEach((r) => {
    if (r.mode === "replace") {
      lines.push(`• «${r.sheetName}»: استبدال كامل — ${(r.newRows || []).length} صف يحل محل ${r.removedCount} صف.`);
      return;
    }
    const add = (r.added || []).length, chg = (r.changed || []).length, miss = (r.missing || []).length;
    tAdd += add; tChg += chg; tMiss += miss;
    (r.changed || []).forEach((c) => (c.fieldDiffs || []).forEach((f) => fieldTally.set(f, (fieldTally.get(f) || 0) + 1)));
    const bits = [];
    if (add) bits.push(`${add} جديد`);
    if (chg) bits.push(`${chg} معدّل`);
    if (miss) bits.push(`${miss} غير موجود بالملف`);
    lines.push(`• «${r.sheetName}»: ${bits.length ? bits.join("، ") : "بلا فروقات"}.`);
  });

  const top = [...fieldTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `${fieldLabel(f)} (${n})`);
  if (top.length) lines.push(`• أكثر الحقول تغيّرًا: ${top.join("، ")}.`);

  const head = (tAdd || tChg || tMiss)
    ? `الملف فيه ${tAdd} إضافة و${tChg} تعديل${tMiss ? ` و${tMiss} بند بالسجل ما ورد بالملف` : ""}.`
    : "ما فيه أي فرق بين الملف والسجل الحالي.";

  return { head, lines, totals: { added: tAdd, changed: tChg, missing: tMiss } };
}

/* ══════════ تصدير التقرير ══════════ */
export function auditToText(audit, digest) {
  const out = ["تقرير تدقيق ملف الاستفسارات", `التاريخ: ${new Date().toLocaleString("ar-SA")}`, ""];
  if (digest) out.push(digest.head, ...digest.lines, "");

  (audit.structure || []).forEach((s) => {
    out.push(`الشيت: ${s.sheet} — ${s.rowCount} صف`);
    (s.columns || []).forEach((c) =>
      out.push(`  ${c.letter}  «${c.raw || "بلا عنوان"}»  →  ${c.field ? fieldLabel(c.field) : "(مُهمَل)"}`));
    out.push("");
  });

  ["blocker", "high", "medium", "low"].forEach((lv) => {
    const g = audit.findings.filter((f) => f.level === lv);
    if (!g.length) return;
    out.push(`${LEVEL_AR[lv]} (${g.length})`, "─".repeat(20));
    g.forEach((f) => {
      const where = [f.cell, f.key !== "—" ? `#${f.key}` : ""].filter(Boolean).join(" · ");
      out.push(`• ${where ? where + " — " : ""}${f.msg}${f.suggest ? ` ← المقترح: ${f.suggest}` : ""}`);
    });
    out.push("");
  });

  if (audit.truncated) out.push(`و${audit.truncated} ملاحظة إضافية لم تُعرض.`);
  if (!audit.findings.length) out.push("ما فيه أي ملاحظة — الملف نظيف.");
  return out.join("\n");
}
