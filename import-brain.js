/* ═══════════════════════════════════════════════════════════
   عقل المزامنة — منطق خالص بلا React وبلا شبكة، عشان يكون قابل للاختبار.

   وظيفته: يقرأ صفوف ملف الإكسل المرفوع، يقارنها بالسجل الحالي، ويطلع
   بثلاث نتائج:
     ١) تصحيحات آمنة يقدر يسويها بنفسه (مسافات، أرقام عربية، نعم/لا…)
     ٢) ملاحظات تدقيق تحتاج قرار بشري (تناقض، قيمة غير معتمدة، تكرار…)
     ٣) ملخّص عربي مقروء لما تغيّر فعليًا

   المراجعة بالذكاء الاصطناعي تجي فوق هذي الطبقة لا بدلها — لو الخدمة
   كانت مقطوعة أو المفتاح ناقص، كل اللي تحت يظل شغّالًا كما هو.
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

/* ── ٥. التدقيق ──
   كل ملاحظة فيها: المستوى، الصف، الحقل، الرسالة، واقتراح لو فيه. */
const L_HIGH = "high", L_MED = "medium", L_LOW = "low";
const OPEN_STATUSES = ["قيد الدراسة", "تم التصويت"];
const DECIDED_STATUSES = ["معتمدة", "تم الرفض"];

export function auditRows({ rows = [], existing = [], approved = {}, keyOf = (r) => r.id } = {}) {
  const out = [];
  const add = (level, key, field, msg, suggest) => out.push({ level, key: String(key ?? "—"), field: field || "", msg, suggest: suggest ?? "" });
  const byId = new Map(existing.map((r) => [String(r.id), r]));
  const seen = new Map();

  rows.forEach((row) => {
    const key = keyOf(row);
    const k = String(key ?? "").trim();

    /* ٥-١ سلامة الصف نفسه */
    if (isBlank(row.note)) add(L_HIGH, k || "—", "note", "صف بلا نص ملاحظة — ما له معنى بالسجل");
    if (k) {
      if (seen.has(k)) add(L_HIGH, k, "id", `الرقم مكرر داخل نفس الملف (تكرر مع صف «${String(seen.get(k)).slice(0, 40)}…»)`);
      else seen.set(k, row.note || "");
      if (!/^\d+$/.test(toLatinDigits(k))) add(L_MED, k, "id", "الرقم مو رقمًا صحيحًا");
    }

    /* ٥-٢ تناقضات منطقية */
    const closed = toYesNoSmart(row.closed);
    const answered = toYesNoSmart(row.answered);
    const st = String(row.status ?? "").trim();
    if (closed === "نعم" && OPEN_STATUSES.some((s) => sameValue(s, st)))
      add(L_HIGH, k, "closed", `مقفلة = نعم مع حالة «${st}» — تناقض`, "لا");
    if (closed === "لا" && DECIDED_STATUSES.some((s) => sameValue(s, st)))
      add(L_MED, k, "closed", `الحالة «${st}» محسومة والبند مفتوح`, "نعم");
    if (DECIDED_STATUSES.some((s) => sameValue(s, st)) && isBlank(row.reply))
      add(L_MED, k, "reply", `حالة «${st}» بلا نص رد`);
    if (answered === "نعم" && isBlank(row.reply))
      add(L_MED, k, "answered", "تم الرد = نعم لكن خانة الرد فاضية", "لا");
    if (answered === "لا" && !isBlank(row.reply))
      add(L_LOW, k, "answered", "فيه نص رد لكن تم الرد = لا", "نعم");

    /* ٥-٣ قيم خارج المعتمد */
    Object.entries(approved).forEach(([field, list]) => {
      const v = row[field];
      if (isBlank(v) || !Array.isArray(list) || !list.length) return;
      if (list.some((a) => sameValue(a, v))) return;
      const near = closestApproved(v, list);
      add(near ? L_MED : L_LOW, k, field,
        `القيمة «${String(v).slice(0, 40)}» مو ضمن القيم المعتمدة`,
        near ? near.value : "");
    });

    /* ٥-٤ مقارنة بالسجل الحالي */
    const cur = byId.get(k);
    if (cur) {
      ["note", "reply", "status", "cat", "loc", "model", "month", "owner", "pri"].forEach((f) => {
        if (!isBlank(cur[f]) && isBlank(row[f]))
          add(L_HIGH, k, f, `الملف يفرّغ حقل «${f}» وهو معبّأ حاليًا — غالبًا شيت ناقص مو حذفًا مقصودًا`);
      });
      if (!isBlank(cur.note) && !isBlank(row.note) && similarity(cur.note, row.note) < 0.4)
        add(L_MED, k, "note", "نص الملاحظة تغيّر جذريًا على نفس الرقم — يحتمل إزاحة صفوف بالملف");
      if (DECIDED_STATUSES.some((s) => sameValue(s, cur.status)) && OPEN_STATUSES.some((s) => sameValue(s, st)))
        add(L_MED, k, "status", `رجوع للخلف: من «${cur.status}» إلى «${st}»`);
    }
  });

  /* ٥-٥ تكرار داخل الملف بالمعنى لا بالرقم.
     المقارنة زوجية (n²)، فنحميها بحدّين: سقف صفوف، واستبعاد مبكر للأزواج
     المتباعدة بالطول — بدونهما ملف كبير يجمّد الواجهة بلا فائدة. */
  const DUP_ROW_CAP = 800;   // فوقه نتخطى الفحص الزوجي كليًا
  const DUP_HIT_CAP = 50;    // بعده الرسالة صارت واضحة، والزيادة ضجيج
  if (rows.length <= DUP_ROW_CAP) {
    const notes = rows.map((r) => (isBlank(r.note) ? "" : normLoose(r.note)));
    const grams = notes.map((n) => (n ? bigrams(n) : null));
    let hits = 0;
    outer:
    for (let i = 0; i < rows.length; i++) {
      if (!notes[i]) continue;
      for (let j = i + 1; j < rows.length; j++) {
        if (!notes[j]) continue;
        if (String(keyOf(rows[i])) === String(keyOf(rows[j]))) continue;
        const lo = Math.min(notes[i].length, notes[j].length), hi = Math.max(notes[i].length, notes[j].length);
        if (lo / hi < 0.75) continue; // فرق طول كبير = مستحيل يتجاوز عتبة 0.9
        if (diceFromGrams(grams[i], grams[j]) >= 0.9) {
          add(L_MED, keyOf(rows[i]), "note", `يشبه صف «${keyOf(rows[j])}» بنسبة عالية — يحتمل تكرار بصياغة مختلفة`);
          hits++;
          if (hits >= DUP_HIT_CAP) break outer;
          break; // تنبيه واحد لكل صف يكفي — ما نكرر نفس الصف مع كل شبيه له
        }
      }
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  out.sort((x, y) => rank[x.level] - rank[y.level]);
  /* سقف عام: ملف فوضوي ممكن يولّد آلاف الملاحظات فيغرق الواجهة ويخفي المهم.
     نرجّع الأهم فقط ونعلّم على الباقي بعدّاد. */
  const CAP = 400;
  if (out.length > CAP) {
    const kept = out.slice(0, CAP);
    kept.push({ level: "low", key: "—", field: "", msg: `و${out.length - CAP} ملاحظة إضافية لم تُعرض — عالج الحرج أولًا ثم أعد الرفع`, suggest: "" });
    return kept;
  }
  return out;
}

/* ── ٦. ملخّص عربي لما تغيّر ── */
const FIELD_AR = {
  model: "النموذج", loc: "الموقع", pri: "الأولوية", cat: "الفئة", status: "الحالة",
  owner: "المسؤول", month: "الشهر", note: "الملاحظة", reply: "الرد",
  closed: "الإغلاق", answered: "حالة الرد", meetings: "الاجتماعات",
};
export const fieldLabel = (f) => FIELD_AR[f] || f;

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

  const top = [...fieldTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([f, n]) => `${fieldLabel(f)} (${n})`);
  if (top.length) lines.push(`• أكثر الحقول تغيّرًا: ${top.join("، ")}.`);

  const head = (tAdd || tChg || tMiss)
    ? `الملف فيه ${tAdd} إضافة و${tChg} تعديل${tMiss ? ` و${tMiss} بند بالسجل ما ورد بالملف` : ""}.`
    : "ما فيه أي فرق بين الملف والسجل الحالي.";

  return { head, lines, totals: { added: tAdd, changed: tChg, missing: tMiss } };
}

/* ── ٧. تجهيز حمولة مختصرة للمراجعة بالذكاء الاصطناعي ──
   نرسل عيّنة محدودة فقط: نص كبير = بطء وتكلفة بلا فائدة إضافية. */
export function buildReviewPayload(results, approved, cap = 40) {
  const changed = [], added = [];
  results.forEach((r) => {
    (r.changed || []).slice(0, cap).forEach((c) => {
      const before = {}, after = {};
      (c.fieldDiffs || []).forEach((f) => { before[f] = c.cur?.[f] ?? null; after[f] = c.row?.[f] ?? null; });
      changed.push({ key: c.key, note: String(c.cur?.note || c.row?.note || "").slice(0, 160), before, after });
    });
    (r.added || []).slice(0, cap).forEach((a) => {
      added.push({ key: a.id ?? "—", note: String(a.note || "").slice(0, 160), status: a.status, cat: a.cat, closed: a.closed, reply: String(a.reply || "").slice(0, 120) });
    });
  });
  return { approved, changed: changed.slice(0, cap), added: added.slice(0, cap) };
}
