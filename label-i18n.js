/* ═══════════════════════════════════════════════════════════
   label-i18n.js (6.8.0) — تشغيل الترجمة الداخلية من لوحة الإدارة.

   القاعدة تعرف وش ينقصه ترجمة أو تغيّر نصه العربي (i18n_pending / i18n_pending_terms):
   نصوص الاستفسارات والردود، أسماء أصحاب الردود ومناصبهم، قيم الفلاتر، الإشعارات وملاحظات الأشهر.
   هنا نترجمها بالمحرّك الداخلي على جهاز المشرف (local-mt.js) ونحفظها «مسودة» (engine = local) —
   والمسودة ما تظهر للزوار إلا بعد اعتمادها من تبويب «الترجمة».
   يشتغل تلقائيًا بعد أي حفظ أو استيراد وعند فتح لوحة الإدارة — بس لو المحرّك متحمّل بهالجهاز
   (التحميل الأول ≈140MB يكون بزر «ترجم الآن» من تبويب «الترجمة»، مو من نفسه).
   ═══════════════════════════════════════════════════════════ */
import { engineAvailable, localSupported, translateLocal } from "./local-mt.js";
import { MODEL_ID } from "./local-mt-config.js";

const CHUNK = 6;
let running = null, runningDl = false;
const subs = new Set();
/* متابعة التقدّم بالواجهة: fn({ done, total, phase }) — phase: start | item | end */
export function onSweepProgress(fn) { subs.add(fn); return () => subs.delete(fn); }
const tell = (p) => subs.forEach((fn) => { try { fn(p); } catch (_) { /* تجاهل */ } });

async function countPending(supabase) {
  const [a, b] = await Promise.all([
    supabase.rpc("i18n_pending", { p_upgrade: false, p_limit: 500 }),
    supabase.rpc("i18n_pending_terms", { p_upgrade: false, p_limit: 500 }),
  ]);
  return ((a && a.data) || []).length + ((b && b.data) || []).length;
}

/* دورة ترجمة واحدة (حتى ٤٠ نص + ٨٠ قيمة)
   allowDownload: يسمح بتحميل المحرّك أول مرة (زر «ترجم الآن» فقط)
   يرجّع { ok, engine, fields, terms, failed, remaining, needsEngine, busy, error } */
export function runTranslationSweep(supabase, source = "admin", { allowDownload = false } = {}) {
  if (running) {
    /* تشغيل يدوي جا أثناء تشغيل تلقائي (بدون تحميل) ← يكمل بعده بدل ما يرجع نتيجته */
    if (allowDownload && !runningDl) return running.then(() => runTranslationSweep(supabase, source, { allowDownload }));
    return running;
  }
  runningDl = allowDownload;
  running = (async () => {
    if (!localSupported()) return { ok: false, error: "المتصفح ما يدعم المحرك الداخلي" };
    const { data: fields, error: e1 } = await supabase.rpc("i18n_pending", { p_upgrade: false, p_limit: 40 });
    if (e1) return { ok: false, error: "db_not_ready: " + e1.message };
    const { data: terms, error: e2 } = await supabase.rpc("i18n_pending_terms", { p_upgrade: false, p_limit: 80 });
    if (e2) return { ok: false, error: "db_not_ready: " + e2.message };
    const items = [
      ...(terms || []).map((t) => ({ ar: t.ar, kind: t.kind || "label", meta: { type: "term", ar: t.ar, kind: t.kind || "label" } })),
      ...(fields || []).map((f) => ({ ar: f.ar, kind: "text", meta: { type: "inq", id: f.id, field: f.field, h: f.h } })),
    ];
    const res = { ok: true, source, engine: "local", fields: 0, terms: 0, failed: 0, remaining: 0 };
    if (!items.length) return res;
    /* المحرّك مو متحمّل بهالجهاز والتشغيل تلقائي ← ما ننزّل ≈140MB بدون علم المشرف */
    if (!allowDownload && !(await engineAvailable())) return { ...res, needsEngine: true, remaining: await countPending(supabase) };
    const { data: claimed, error: ec } = await supabase.rpc("i18n_claim", { p_seconds: 900 });
    if (ec) return { ok: false, error: ec.message };
    if (claimed === false) return { ok: true, busy: true };
    let error = null;
    try {
      tell({ done: 0, total: items.length, phase: "start" });
      for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK);
        const outs = await translateLocal(chunk.map(({ ar, kind }) => ({ ar, kind })), { onItem: (k) => tell({ done: i + k + 1, total: items.length, phase: "item" }) });
        const ok = [], bad = [];
        chunk.forEach((it, k) => {
          const o = outs[k] || {};
          const m = it.meta;
          if (o.en) ok.push(m.type === "term"
            ? { type: "term", ar: m.ar, kind: m.kind, en: o.en, f: o.flags || [] }
            : { type: "inq", id: m.id, field: m.field, h: m.h, en: o.en, f: o.flags || [] });
          else bad.push(m.type === "term" ? { type: "term", ar: m.ar, kind: m.kind } : { type: "inq", id: m.id, field: m.field, h: m.h });
        });
        if (ok.length) {
          const { error: ea } = await supabase.rpc("i18n_apply", { p_items: ok });
          if (ea) throw new Error(ea.message);
          ok.forEach((x) => { if (x.type === "term") res.terms++; else res.fields++; });
        }
        if (bad.length) { res.failed += bad.length; await supabase.rpc("i18n_fail", { p_items: bad }); }
      }
    } catch (e) {
      error = String((e && e.message) || e).slice(0, 300);
    } finally {
      await supabase.rpc("i18n_release", { p_engine: "local", p_has_key: false, p_model: MODEL_ID, p_result: res, p_error: error, p_machine_backoff_min: 0, p_claude_backoff_min: 0 });
      tell({ done: items.length, total: items.length, phase: "end" });
    }
    res.remaining = await countPending(supabase);
    return { ...res, ok: !error || res.fields + res.terms > 0, error };
  })().catch((e) => ({ ok: false, error: String((e && e.message) || e) })).finally(() => { running = null; runningDl = false; });
  return running;
}

/* يكمل الدورات لين ما يبقى شي */
export async function runAllTranslations(supabase, source = "panel", opts = {}) {
  const total = { ok: true, engine: "local", fields: 0, terms: 0, failed: 0, remaining: 0 };
  for (let round = 0; round < 25; round++) {
    const r = await runTranslationSweep(supabase, source, opts);
    if (!r || !r.ok || r.busy || r.needsEngine) return { ...total, ...(r || {}), fields: total.fields + ((r && r.fields) || 0), terms: total.terms + ((r && r.terms) || 0), failed: total.failed + ((r && r.failed) || 0) };
    total.fields += r.fields || 0; total.terms += r.terms || 0; total.failed += r.failed || 0; total.remaining = r.remaining || 0;
    if (r.error) total.error = r.error;
    if (!r.remaining || (r.fields || 0) + (r.terms || 0) === 0) break;
  }
  return total;
}

/* بعد أي حفظ: تشغيل بالخلفية بدون انتظار (ولا تحميل للمحرّك) */
export function kickTranslations(supabase, source = "save") {
  setTimeout(() => { runAllTranslations(supabase, source); }, 400);
}

/* عند فتح لوحة الإدارة: { added, remaining, needsEngine } */
export async function syncLabelTranslations(supabase) {
  const r = await runAllTranslations(supabase, "admin-open");
  return r && r.ok
    ? { added: (r.terms || 0) + (r.fields || 0), engine: r.engine, remaining: r.remaining || 0, needsEngine: !!r.needsEngine }
    : { error: (r && r.error) || "تعذّر" };
}
