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

const ageDays = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : Math.floor((Date.now() - d.getTime()) / DAY);
};

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
  const created = (days) => all.filter((r) => { const t = new Date(r.created_at || 0).getTime(); return t && now - t <= days * DAY; });

  const oldestOpen = [...open]
    .filter((r) => r.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(0, 3);

  const openAges = open.map((r) => ageDays(r.created_at)).filter((n) => n != null);
  const avgOpenAge = openAges.length ? Math.round(openAges.reduce((a, b) => a + b, 0) / openAges.length) : null;

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
    avgOpenAge != null ? `متوسط عمر البند المفتوح: ${avgOpenAge} يومًا` : null,
  ]);

  S("الأقدم فتحًا", oldestOpen.map((r) => {
    const a = ageDays(r.created_at);
    return `#${r.id} — ${String(r.note || "").slice(0, 70)}${a != null ? ` (مفتوح منذ ${a} يومًا)` : ""}`;
  }));

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
