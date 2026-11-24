/* reply-kit.js — (7.15.0) ردّان أو أكثر داخل خانة «الرد» نفسها (بدون أعمدة جديدة بالإكسل ولا بقاعدة البيانات).
   الصيغة: كل رد بكتلة، والكتل تُفصل بسطر فيه ثلاث شرطات فقط (---)، وأول سطر بكل كتلة تاريخ الرد بين قوسين مربعين:

     [2026-07]
     نص الرد الأول…
     ---
     [2026-08-15 | رد المطور — الاجتماع الثامن]
     نص الرد الثاني (الأحدث)…

   • السطر بين القوسين: التاريخ ثم | ثم جهة الرد (اختياري): [2026-08-15] أو [2026-08-15 | رد المطور] أو [| رد المطور].
   • التاريخ: 2026-07 أو 2026-07-15 (الأرقام العربية تُقبل). نص بين القوسين بلا | يُعدّ تاريخًا ويظهر كما هو.
   • الكتلة اللي لها جهة رد (غير صاحب الرد المسجّل) ما يظهر عليها توقيع صاحب الرد.
   • الرد الواحد بدون فاصل ولا تاريخ يشتغل كما كان تمامًا (تاريخه = «شهر الرد»).
   • الترجمة (Reply EN) بنفس الصيغة وبنفس عدد الكتل والتواريخ.
   • آخر كتلة = الرد الأحدث (يظهر بلون الحالة وعليه توقيع صاحب الرد). */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s == null ? "" : s).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
const SEP_RX = /^[ \t‎‏]*-{3,}[ \t‎‏]*$/;
const MARK_RX = /^[ \t‎‏]*\[([^\]\n]{1,40})\][ \t‎‏]*$/;

export const REPLY_SEP = "---";
export const REPLY_DATE_RX = /^\d{4}-\d{2}(-\d{2})?$/;

/* يقسّم نص الرد إلى كتل: [{ date, text }] — date = "" لو ما فيه تاريخ */
export function parseReplies(raw) {
  const src = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n");
  if (!src.trim()) return [];
  const blocks = [[]];
  src.split("\n").forEach((ln) => { if (SEP_RX.test(ln)) blocks.push([]); else blocks[blocks.length - 1].push(ln); });
  const out = [];
  blocks.forEach((lines) => {
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    let date = "", label = "";
    const m = i < lines.length ? lines[i].match(MARK_RX) : null;
    if (m) {
      const inner = m[1];
      const k = inner.indexOf("|");
      if (k >= 0) { date = latin(inner.slice(0, k)).trim(); label = inner.slice(k + 1).trim(); } else date = latin(inner).trim();
      i++;
    }
    const text = lines.slice(i).join("\n").trim();
    if (text || date) out.push({ date, label, text });
  });
  return out.filter((b) => b.text);
}

/* نص مسطّح بدون علامات (للتيليجرام والملخصات): "latest" = آخر رد فقط، "all" = الكل بسطر فاصل */
export function replyPlain(raw, mode = "all") {
  const b = parseReplies(raw);
  if (!b.length) return "";
  if (mode === "latest") return b[b.length - 1].text;
  return b.map((x) => x.text).join("\n\n");
}

/* تاريخ العرض: "2026-07" ← يوليو 2026 | "2026-07-15" ← 15 يوليو 2026 | غير ذلك كما هو */
export function replyDateLabel(date, monthLabel /* (YYYY-MM)=>string */) {
  if (!date) return "";
  if (!REPLY_DATE_RX.test(date)) return date;
  const ym = monthLabel(date.slice(0, 7));
  return date.length === 10 ? `${+date.slice(8, 10)} ${ym}` : ym;
}

/* فحص الصيغة لمرحلة الاستيراد — يرجع [{ level, code, msg }] */
export function checkReplyFormat(reply, replyEn) {
  const out = [];
  const src = String(reply == null ? "" : reply);
  if (!src.trim()) return out;
  const hasSep = src.split(/\r?\n/).some((l) => SEP_RX.test(l));
  const hasMark = src.split(/\r?\n/).some((l) => MARK_RX.test(l));
  if (!hasSep && !hasMark) return out; /* رد واحد عادي */
  const bl = parseReplies(src);
  const raw = src.replace(/\r\n?/g, "\n").split("\n").filter((l) => SEP_RX.test(l)).length + 1;
  if (raw !== bl.length) out.push({ level: "medium", code: "REPLY_EMPTY_BLOCK", msg: `فيه فاصل (---) بجانبه رد فاضي: ${raw} كتل والمقروء منها ${bl.length}` });
  if (bl.length > 1 && bl.some((b) => !b.date)) out.push({ level: "low", code: "REPLY_NO_DATE", msg: "ردّان أو أكثر وبعض الكتل بلا تاريخ — ابدأ كل كتلة بسطر مثل [2026-07] (الرد الأول القديم المجهول تاريخه مقبول)" });
  bl.forEach((b) => { if (b.date && !REPLY_DATE_RX.test(b.date)) out.push({ level: "low", code: "REPLY_ODD_DATE", msg: `تاريخ «${b.date}» بغير الصيغة المعتمدة (2026-07 أو 2026-07-15) — يظهر للزائر كما هو` }); });
  const dates = bl.map((b) => b.date).filter((d) => REPLY_DATE_RX.test(d));
  for (let i = 1; i < dates.length; i++) if (dates[i] < dates[i - 1]) { out.push({ level: "medium", code: "REPLY_ORDER", msg: "ترتيب الردود غير تصاعدي — آخر كتلة لازم تكون الأحدث" }); break; }
  const en = String(replyEn == null ? "" : replyEn);
  if (en.trim()) {
    const eb = parseReplies(en);
    if (eb.length !== bl.length) out.push({ level: "medium", code: "REPLY_EN_BLOCKS", msg: `الترجمة (Reply EN) فيها ${eb.length} كتلة والعربي ${bl.length} — لازم نفس العدد بنفس الصيغة` });
    else if (eb.some((b, i) => (b.date || "") !== (bl[i].date || ""))) out.push({ level: "low", code: "REPLY_EN_DATES", msg: "تواريخ كتل الترجمة غير مطابقة لتواريخ العربي" });
  }
  return out;
}
