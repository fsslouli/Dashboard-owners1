/* ═══════════════════════════════════════════════════════════
   core.ts (6.8.0) — منطق محرّك الترجمة مع قاعدة البيانات (مستقل عن HTTP، يُختبر محليًا بقاعدة وهمية).
   db = عميل Supabase بصلاحية الخدمة (أو بديل اختبار بنفس الواجهة: rpc + from().select().eq().maybeSingle()/in()).
   ═══════════════════════════════════════════════════════════ */
import { EngineError, KINDS, QuotaError, claudeTranslate, machineTranslate, type Item, type Kind, type Out } from "./engine.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
const errMsg = (e: unknown) => String((e as { message?: string })?.message || e).slice(0, 300);
const asKind = (k: unknown): Kind => (KINDS.includes(k as Kind) ? k as Kind : "label");
export const TM_KINDS: Kind[] = ["label", "person", "title"]; /* التسميات القصيرة اللي تتكرر بالموقع تنحفظ بذاكرة الترجمة */

export function createCore({ db, key, model, budgetMs = 95_000 }: { db: Db; key: string; model: string; budgetMs?: number }) {
  /* ═══ sweep — الترجمة التلقائية لكل ما هو ناقص أو قديم بقاعدة البيانات ═══ */
  async function sweep(source: string) {
    const deadline = Date.now() + budgetMs;
    const { data: claimed, error: ce } = await db.rpc("i18n_claim", { p_seconds: Math.ceil(budgetMs / 1000) + 55 });
    if (ce) return { ok: false, error: "db_not_ready: " + ce.message };
    if (claimed !== true) return { ok: true, busy: true };

    const res = { ok: true, source, engine: "", terms: 0, fields: 0, failed: 0, remaining: 0 };
    let error: string | null = null, quota = false, claudeFatal = false;
    try {
      const { data: st } = await db.from("i18n_state").select("claude_backoff_until,machine_backoff_until").eq("id", 1).maybeSingle();
      const now = Date.now();
      const claudeOk = !!key && !(st?.claude_backoff_until && Date.parse(st.claude_backoff_until) > now);
      const machineOk = !(st?.machine_backoff_until && Date.parse(st.machine_backoff_until) > now);

      const { data: terms, error: e1 } = await db.rpc("i18n_pending_terms", { p_upgrade: claudeOk, p_limit: 150 });
      if (e1) throw new Error("pending_terms: " + e1.message);
      const { data: fields, error: e2 } = await db.rpc("i18n_pending", { p_upgrade: claudeOk, p_limit: 80 });
      if (e2) throw new Error("pending: " + e2.message);

      type Meta = { type: "term"; ar: string; kind: Kind; reason: string } | { type: "inq"; id: number; field: string; h: string; reason: string };
      const items: Item[] = [];
      const meta = new Map<string, Meta>();
      (terms || []).forEach((t: { ar: string; kind: string; reason: string }, i: number) => {
        const id = "t" + i; const kind = asKind(t.kind);
        items.push({ id, ar: t.ar, kind }); meta.set(id, { type: "term", ar: t.ar, kind, reason: t.reason });
      });
      (fields || []).forEach((f: { id: number; field: string; ar: string; h: string; reason: string }) => {
        const id = `f${f.id}.${f.field}`;
        items.push({ id, ar: f.ar, kind: "text" }); meta.set(id, { type: "inq", id: f.id, field: f.field, h: f.h, reason: f.reason });
      });

      const payloadOf = (o: Out) => {
        const m = meta.get(o.id)!;
        return m.type === "term"
          ? { type: "term", ar: m.ar, kind: m.kind, en: o.en, e: o.engine, f: o.flags }
          : { type: "inq", id: m.id, field: m.field, h: m.h, en: o.en, e: o.engine, f: o.flags };
      };
      const doneIds = new Set<string>(), attempted = new Set<string>();
      const apply = async (outs: Out[]) => {
        const { error } = await db.rpc("i18n_apply", { p_items: outs.map(payloadOf) });
        if (error) throw new Error("apply: " + error.message);
        outs.forEach((o) => { doneIds.add(o.id); if (meta.get(o.id)!.type === "term") res.terms++; else res.fields++; });
      };

      if (claudeOk && items.length) {
        res.engine = "claude";
        try { await claudeTranslate(key, model, items, deadline, apply, attempted); }
        catch (e) { error = errMsg(e); claudeFatal = e instanceof EngineError && e.fatal; }
      }
      /* الآلي فقط لما Claude غير متاح أو تعطّل — ولا يعيد ترجمة بند آلي أصلًا (الترقية لـ Claude وحده) */
      const rest = items.filter((it) => !doneIds.has(it.id) && meta.get(it.id)!.reason !== "upgrade" && (!claudeOk || !!error));
      if (rest.length && machineOk && Date.now() < deadline) {
        res.engine = res.engine ? res.engine + "+machine" : "machine";
        try { await machineTranslate(rest, deadline, apply, attempted); }
        catch (e) {
          if (e instanceof QuotaError) quota = true;
          error = (error ? error + " | " : "") + (e instanceof QuotaError ? "MyMemory: انتهت الحصة اليومية المجانية" : errMsg(e));
        }
      }
      /* بند حاولنا فيه وما طلع له ناتج: نزيد عدّاد فشله (بعد ٣ محاولات يتوقف تكراره حتى يتغيّر نصه).
         لو Claude تعطّل كليًا (مفتاح/رصيد) ما نحسبها فشل على البند نفسه. */
      const failed = claudeFatal ? [] : items.filter((it) => attempted.has(it.id) && !doneIds.has(it.id));
      res.failed = failed.length;
      if (failed.length) {
        await db.rpc("i18n_fail", {
          p_items: failed.map((it) => {
            const m = meta.get(it.id)!;
            return m.type === "term" ? { type: "term", ar: m.ar, kind: m.kind } : { type: "inq", id: m.id, field: m.field, h: m.h };
          }),
        });
      }
      res.remaining = Math.max(0, items.length - doneIds.size - failed.length);
    } catch (e) {
      error = errMsg(e);
    } finally {
      await db.rpc("i18n_release", {
        p_engine: res.engine || null, p_has_key: !!key, p_model: key ? model : null, p_result: res, p_error: error,
        p_machine_backoff_min: quota ? 360 : 0, p_claude_backoff_min: claudeFatal ? 30 : 0,
      });
    }
    return { ...res, error };
  }

  /* ═══ translateTexts — نصوص يرسلها الأدمن (التحقق من الصلاحية يصير قبلها بـ index.ts) ═══ */
  async function translateTexts(raw: unknown[]) {
    const items: Item[] = raw.slice(0, 20).map((t, i) => {
      const o = (t && typeof t === "object" ? t : { ar: t }) as { ar?: unknown; kind?: unknown };
      return { id: String(i), ar: String(o.ar ?? "").slice(0, 4000).trim(), kind: KINDS.includes(o.kind as Kind) ? o.kind as Kind : "text" };
    }).filter((x) => x.ar);
    const results: Record<string, { en: string; engine: string; flags: string[] }> = {};

    /* التسميات والأسماء: ذاكرة الترجمة أولًا (نفس القيمة = نفس الترجمة بكل الموقع، وبدون تكلفة) */
    const short = items.filter((x) => TM_KINDS.includes(x.kind));
    if (short.length) {
      const { data: tm } = await db.from("i18n_memory").select("ar,en,engine,flags").in("ar", short.map((x) => x.ar));
      (tm || []).forEach((row: { ar: string; en: string; engine: string; flags: string[] }) => {
        if (row.en && row.engine !== "failed") short.filter((x) => x.ar === row.ar).forEach((x) => { results[x.id] = { en: row.en, engine: row.engine, flags: row.flags || [] }; });
      });
    }
    const fromTm = new Set(Object.keys(results));
    const todo = items.filter((x) => !results[x.id]);
    const deadline = Date.now() + Math.min(budgetMs, 45_000);
    const collect = async (outs: Out[]) => { outs.forEach((o) => { results[o.id] = { en: o.en, engine: o.engine, flags: o.flags }; }); };
    let engine = "", error: string | null = null;
    if (todo.length && key) {
      engine = "claude";
      try { await claudeTranslate(key, model, todo, deadline, collect); } catch (e) { error = errMsg(e); }
    }
    const rest = todo.filter((x) => !results[x.id]);
    if (rest.length && (!key || error)) {
      engine = engine ? engine + "+machine" : "machine";
      try { await machineTranslate(rest, deadline, collect); }
      catch (e) { error = (error ? error + " | " : "") + (e instanceof QuotaError ? "MyMemory quota" : errMsg(e)); }
    }
    const save = short.filter((x) => results[x.id] && !fromTm.has(x.id));
    if (save.length) {
      await db.rpc("i18n_apply", { p_items: save.map((x) => ({ type: "term", ar: x.ar, kind: x.kind, en: results[x.id].en, e: results[x.id].engine, f: results[x.id].flags })) });
    }
    return { ok: true, engine, error, results: raw.slice(0, 20).map((_, i) => results[String(i)] || { en: "", engine: null, flags: [] }) };
  }

  return { sweep, translateTexts };
}
