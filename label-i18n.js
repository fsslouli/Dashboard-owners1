/* ═══════════════════════════════════════════════════════════
   label-i18n.js (6.8.0) — واجهة لوحة الإدارة لمحرّك الترجمة بالسيرفر (دالة i18n-translate).

   المحرّك نفسه يكتشف كل ما ينقصه ترجمة أو تغيّر نصه العربي — نصوص الاستفسارات والردود،
   أسماء أصحاب الردود ومناصبهم، قيم الفلاتر، الإشعارات وملاحظات الأشهر — ويترجمه ويحفظه.
   يشتغل تلقائيًا كل ٥ دقائق بالجدولة؛ وهنا نستدعيه فورًا بعد أي حفظ عشان تطلع الترجمة خلال ثواني.
   ═══════════════════════════════════════════════════════════ */

let running = null;
/* يرجّع { ok, engine, fields, terms, failed, remaining, error } — آمن للاستدعاء المتكرر (يشارك التشغيل الجاري) */
export function runTranslationSweep(supabase, source = "admin") {
  if (running) return running;
  running = supabase.functions.invoke("i18n-translate", { body: { mode: "sweep", source } })
    .then(({ data, error }) => (error ? { ok: false, error: error.message || String(error) } : (data || { ok: false })))
    .catch((e) => ({ ok: false, error: String(e?.message || e) }))
    .finally(() => { running = null; });
  return running;
}

/* بعد أي حفظ: تشغيل بالخلفية بدون انتظار (وأي شي يفوت تلتقطه الجدولة) */
export function kickTranslations(supabase, source = "save") {
  setTimeout(() => { runTranslationSweep(supabase, source); }, 400);
}

/* توافق مع الاستدعاءات السابقة: { added } = عدد ما تُرجم بهالدورة */
export async function syncLabelTranslations(supabase) {
  const r = await runTranslationSweep(supabase, "admin-open");
  return r && r.ok ? { added: (r.terms || 0) + (r.fields || 0), engine: r.engine, remaining: r.remaining || 0 } : { error: r?.error || "تعذّر" };
}
