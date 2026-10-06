/* ═══════════════════════════════════════════════════════════
   الملخّص التنفيذي — لوحة الإدارة فقط.

   النسخة القديمة كانت زر «ملخص» بترويسة الموقع العام: قائمة بنود مسطحة
   ما يحتاجها الزائر. هذي بديلها: تقرير قرار مبني لمن يدير السجل —
   حركة السجل، الاختناقات، الأقدم فتحًا، التركيز الجغرافي، ومصدر الإدخال.

   منطق خالص بلا React — يرجّع بنية مقاطع + نص جاهز للنسخ أو التنزيل.
   ═══════════════════════════════════════════════════════════ */

const DAY = 86400000;
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const blank = (v) => v === null || v === undefined || String(v).trim() === "";
const OPEN_STA = ["قيد الدراسة", "تم التصويت"];
const DECIDED = ["معتمدة", "تم الرفض"];
const HIGH_PRI = ["عالية جدًا", "عالية"];

const isClosed = (r) => {
  const c = r.closed;
  if (c === true) return true;
  if (typeof c === "string") return ["نعم", "مغلقة", "مقفلة", "مغلق", "مقفل"].includes(c.trim());
  return false;
};

const tally = (rows, field) => {
  const m = new Map();
  rows.forEach((r) => { const v = blank(r[field]) ? "(غير محدد)" : String(r[field]).trim(); m.set(v, (m.get(v) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
};

/* ── عمر الاستفسار (٥.٣.٠) ──
   السجل ما فيه عمود «تاريخ الرفع». created_at = وقت دخول السطر لقاعدة البيانات،
   وأغلب السجل دخلها دفعة وحدة يوم الاستيراد الأول — فكان العمر يطلع أيامًا وهو
   فعليًا أشهر. وعمود «الشهر» هو «شهر الرد» مو شهر الرفع، فما يصلح بديلًا.
   الحساب الصادق: حدّ أدنى معروف لكل استفسار = الأبعد من:
     ١) دخوله للنظام (أكيد انرفع قبلها أو يومها)
     ٢) نهاية شهر الرد (أكيد انرفع قبل الرد عليه)
   ما دخل النظام بعد الاستيراد الأول يُعتبر تاريخ دخوله تقريبًا تاريخ رفعه. */
const replyMonthEnd = (mk) => {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(mk || "").trim());
  return m ? Date.UTC(+m[1], +m[2], 1) : null; /* أول لحظة بالشهر التالي = نهاية شهر الرد */
};
const enteredAt = (r) => { const t = r && r.created_at ? new Date(r.created_at).getTime() : NaN; return Number.isFinite(t) ? t : null; };
/* الاستيراد الأول = أول دفعة دخلت السجل (خلال يوم من أقدم إدخال) */
const firstImportCutoff = (rows) => {
  const ts = rows.map(enteredAt).filter((t) => t != null);
  return ts.length ? Math.min(...ts) + DAY : null;
};
const ageInfo = (r, now, cutoff) => {
  const ent = enteredAt(r);
  const entryDays = ent != null ? Math.max(0, Math.floor((now - ent) / DAY)) : null;
  const re = replyMonthEnd(r.month);
  const replyDays = re != null && now > re ? Math.floor((now - re) / DAY) : null;
  if (entryDays == null && replyDays == null) return null;
  const days = Math.max(entryDays ?? 0, replyDays ?? 0);
  const fromFirstImport = ent != null && cutoff != null && ent <= cutoff;
  const exact = !fromFirstImport && entryDays != null && (replyDays == null || replyDays <= entryDays);
  return { days, exact, fromFirstImport };
};
const arCount = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const fmtAge = (d) => (d < 1 ? "أقل من يوم"
  : d < 60 ? arCount(d, "يوم واحد", "يومين", "أيام", "يومًا")
  : arCount(Math.floor(d / 30.44), "شهر واحد", "شهرين", "أشهر", "شهرًا"));
const ageText = (a) => `${fmtAge(a.days)}${a.exact ? "" : " على الأقل"}`;

/* ── البناء ── */
export function buildBrief(inquiries = [], { now = Date.now(), topN = 5, listCap = 15 } = {}) {
  const all = Array.isArray(inquiries) ? inquiries : [];
  const tot = all.length;
  const open = all.filter((r) => !isClosed(r));
  const closed = all.filter(isClosed);
  const decided = all.filter((r) => DECIDED.some((s) => s === String(r.status || "").trim()));
  const approved = all.filter((r) => String(r.status || "").trim() === "معتمدة");
  const noReply = all.filter((r) => blank(r.reply));
  const urgent = all.filter((r) => r.urgent === true);
  const important = all.filter((r) => r.important === true);
  const highOpen = open.filter((r) => HIGH_PRI.includes(String(r.pri || "").trim()));

  const since = (days) => all.filter((r) => { const t = new Date(r.updated_at || 0).getTime(); return t && now - t <= days * DAY; });
  const cutoff = firstImportCutoff(all);
  /* «أُضيفت» = استفسارات جديدة فعلًا؛ دفعة الاستيراد الأول ما تُحسب جديدة */
  const created = (days) => all.filter((r) => { const t = enteredAt(r); return t != null && !(cutoff != null && t <= cutoff) && now - t <= days * DAY; });

  const openAged = open.map((r) => ({ r, a: ageInfo(r, now, cutoff) })).filter((x) => x.a);
  const oldestOpen = [...openAged]
    .sort((x, y) => y.a.days - x.a.days || (+x.r.id || 0) - (+y.r.id || 0))
    .slice(0, 3);
  const avgOpenAge = openAged.length
    ? { days: Math.round(openAged.reduce((s, x) => s + x.a.days, 0) / openAged.length), exact: openAged.every((x) => x.a.exact) }
    : null;
  const openFromFirstImport = openAged.filter((x) => x.a.fromFirstImport).length;

  const sections = [];
  const S = (title, lines) => { if (lines.filter(Boolean).length) sections.push({ title, lines: lines.filter(Boolean) }); };

  S("الوضع العام", [
    `إجمالي البنود: ${tot}`,
    `مقفلة: ${closed.length} (${pct(closed.length, tot)}٪) · مفتوحة: ${open.length} (${pct(open.length, tot)}٪)`,
    decided.length ? `نسبة الاعتماد من المحسوم: ${pct(approved.length, decided.length)}٪ (${approved.length} من ${decided.length})` : null,
    `بنود بلا رد مسجّل: ${noReply.length}`,
  ]);

  S("توزيع الحالات", tally(all, "status").map(([v, n]) => `${v}: ${n} (${pct(n, tot)}٪)`));

  S("الحركة الأخيرة", [
    `تعديلات خلال ٧ أيام: ${since(7).length} · خلال ٣٠ يومًا: ${since(30).length}`,
    `بنود أُضيفت خلال ٣٠ يومًا: ${created(30).length}`,
    avgOpenAge ? `متوسط عمر البند المفتوح: ${ageText(avgOpenAge)}` : null,
    openFromFirstImport
      ? `${openFromFirstImport} من البنود المفتوحة دخلت النظام بالاستيراد الأول (${fmtDate(cutoff - DAY)}) وتاريخ رفعها غير مسجّل، فعمرها محسوب كحدّ أدنى`
      : null,
  ]);

  S("الأقدم فتحًا", oldestOpen.map(({ r, a }) =>
    `#${r.id} — ${String(r.note || "").slice(0, 70)} (مفتوح منذ ${ageText(a)})`));

  S("ضغط الأولوية", [
    `بنود مفتوحة بأولوية عالية أو أعلى: ${highOpen.length}`,
    ...tally(open, "pri").slice(0, topN).map(([v, n]) => `${v}: ${n} مفتوح`),
  ]);

  S(`أعلى ${topN} مواقع`, tally(all, "loc").slice(0, topN).map(([v, n]) => `${v}: ${n} (${pct(n, tot)}٪)`));
  S(`أعلى ${topN} فئات`, tally(all, "cat").slice(0, topN).map(([v, n]) => `${v}: ${n} (${pct(n, tot)}٪)`));
  S("النماذج", tally(all, "model").slice(0, 6).map(([v, n]) => `${v}: ${n}`));

  S("الوسوم النشطة", [
    urgent.length ? `يجب الاطلاع: ${urgent.length}` : null,
    important.length ? `مهم: ${important.length}` : null,
    !urgent.length && !important.length ? "ما فيه وسوم مفعّلة حاليًا" : null,
  ]);

  const byEntry = tally(all.filter((r) => !blank(r.created_by)), "created_by");
  const byEdit = tally(all.filter((r) => !blank(r.updated_by)), "updated_by");
  S("مصدر الإدخال والتعديل", [
    byEntry.length ? `الإدخال: ${byEntry.slice(0, 6).map(([v, n]) => `${v} (${n})`).join(" · ")}` : null,
    byEdit.length ? `آخر تعديل: ${byEdit.slice(0, 6).map(([v, n]) => `${v} (${n})`).join(" · ")}` : null,
    !byEntry.length && !byEdit.length ? "ما فيه بيانات إدخال مسجّلة على البنود الحالية" : null,
  ]);

  S(`بنود مفتوحة عالية الأولوية (أعلى ${listCap})`,
    highOpen.slice(0, listCap).map((r) => `#${r.id} [${r.status || "—"}] ${String(r.note || "").slice(0, 80)}`));

  S("مسؤولو الرد", tally(all.filter((r) => !blank(r.owner)), "owner").slice(0, topN).map(([v, n]) => `${v}: ${n}`));

  return {
    generatedAt: now,
    totals: { tot, open: open.length, closed: closed.length, noReply: noReply.length, urgent: urgent.length, important: important.length },
    sections,
  };
}

/* ── الإخراج ── */
export function briefToText(brief) {
  const out = [`ملخّص سجل استفسارات الملاك`, `تاريخ التوليد: ${fmtDate(brief.generatedAt)}`, ""];
  brief.sections.forEach((s) => {
    out.push(`${s.title}`);
    out.push("─".repeat(Math.max(8, s.title.length + 2)));
    s.lines.forEach((l) => out.push(`• ${l}`));
    out.push("");
  });
  out.push("— تقرير داخلي للإدارة، غير مخصّص للنشر.");
  return out.join("\n");
}

export function briefToMarkdown(brief) {
  const out = [`# ملخّص سجل استفسارات الملاك`, "", `**تاريخ التوليد:** ${fmtDate(brief.generatedAt)}`, ""];
  brief.sections.forEach((s) => {
    out.push(`## ${s.title}`, "");
    s.lines.forEach((l) => out.push(`- ${l}`));
    out.push("");
  });
  out.push("---", "", "_تقرير داخلي للإدارة، غير مخصّص للنشر._");
  return out.join("\n");
}
