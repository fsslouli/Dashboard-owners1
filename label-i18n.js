/* ═══════════════════════════════════════════════════════════
   label-i18n.js (6.8.0) — ترجمة تلقائية لأسماء الجهات المجيبة ومناصبهم وقيم الفلاتر.

   أي قيمة عربية جديدة (اسم، منصب، موقع، فئة، حالة، أولوية، اجتماع…) ما لها ترجمة ثابتة بالكود
   تُترجم بالخلفية عبر دالة translate-text وتنحفظ بـ site_settings.nav_labels._i18n { عربي: إنجليزي }.
   الموقع العام يقرأ القاموس تلقائيًا بالنسخة الإنجليزية (site-data.jsx → setDynEn).
   - الترجمة الثابتة بالكود تغلب دائمًا (تصحيح يدوي مضمون).
   - أي فشل (شبكة، صلاحية، حصة الترجمة) يمر بصمت ويُعاد المحاولة بالمرة الجاية — ما يعطّل شي.
   - م/ ← Eng. و د/ ← Dr. تُعالج بالكود، والباقي يترجمه المترجم (أسماء الأشخاص تحتاج مراجعة بصرية أحيانًا).
   ═══════════════════════════════════════════════════════════ */
import { autoTranslateAr } from "./translate-kit.js";
import { patchNavLabels } from "./nav-labels-kit.jsx";
import { needsEn, setDynEn } from "./site-data.jsx";

const AR_RX = /[ء-ي]/;
const FAIL_RX = /MYMEMORY WARNING|QUERY LENGTH LIMIT|WORDS LIMIT EXCEEDED|INVALID (SOURCE|TARGET) LANGUAGE/i;
const decode = (t) => String(t).replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/* يجهّز النص للترجمة: يفصل لقب «م/» و«د/» عن الاسم (يترجم الاسم وحده ويرجع اللقب إنجليزيًا) */
export function prepLabel(kind, v) {
  let prefix = "", rest = String(v).trim();
  if (kind === "owner" || kind === "owner_title") {
    rest = rest.replace(/^م\s*\/\s*/, () => { prefix = "Eng. "; return ""; });
    rest = rest.replace(/^د\s*\/\s*/, () => { prefix = "Dr. "; return ""; });
  }
  return { prefix, rest };
}
export function cleanTranslation(prefix, t) {
  let out = decode(t || "").trim().replace(/[.。]+$/, "").trim();
  if (!out || AR_RX.test(out) || FAIL_RX.test(out)) return "";
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return prefix + out;
}

let running = null;
/* يرجّع { added, failed } أو { error }. آمن للاستدعاء المتكرر (يشارك التشغيل الجاري). */
export function syncLabelTranslations(supabase, { max = 40 } = {}) {
  if (running) return running;
  running = (async () => {
    try {
      const { data: ss, error: e0 } = await supabase.from("site_settings").select("nav_labels").eq("id", 1).single();
      if (e0) return { error: e0.message };
      const nl = ss?.nav_labels && typeof ss.nav_labels === "object" ? ss.nav_labels : {};
      setDynEn(nl._i18n);

      const items = new Map(); /* قيمة عربية → نوعها */
      const add = (kind, v) => { const t = typeof v === "string" ? v.trim() : ""; if (t && needsEn(kind, t) && !items.has(t)) items.set(t, kind); };
      let { data: rows, error } = await supabase.from("inquiries").select("owner,owner_title,loc,cat,pri,status,party,meetings");
      if (error) ({ data: rows } = await supabase.from("inquiries").select("owner,loc,pri,status,meetings"));
      (rows || []).forEach((r) => {
        add("owner", r.owner); add("owner_title", r.owner_title); add("loc", r.loc); add("cat", r.cat);
        add("pri", r.pri); add("status", r.status); add("party", r.party);
        (Array.isArray(r.meetings) ? r.meetings : []).forEach((m) => add("meeting", m));
      });
      const { data: cats } = await supabase.from("filter_categories").select("key,values");
      const KINDS = { owner: "owner", owner_title: "owner_title", loc: "loc", cat: "cat", pri: "pri", status: "status", meeting: "meeting" };
      (cats || []).forEach((c) => { const k = KINDS[c.key]; if (k) (c.values || []).forEach((v) => add(k, v)); });

      const todo = [...items.entries()].slice(0, max);
      if (!todo.length) return { added: 0, failed: 0 };
      const out = {}; let failed = 0, idx = 0;
      const worker = async () => {
        while (idx < todo.length) {
          const [ar, kind] = todo[idx++];
          const { prefix, rest } = prepLabel(kind, ar);
          const en = rest ? cleanTranslation(prefix, await autoTranslateAr(supabase, rest)) : "";
          if (en) out[ar] = en; else failed++;
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      const n = Object.keys(out).length;
      if (!n) return { added: 0, failed };
      const { error: e1 } = await patchNavLabels(supabase, (cur) => ({ ...cur, _i18n: { ...(cur._i18n && typeof cur._i18n === "object" ? cur._i18n : {}), ...out } }), "ترجمة تلقائية للقيم", { silent: true });
      if (e1) return { error: e1.message || "تعذّر الحفظ" };
      return { added: n, failed };
    } catch (e) {
      return { error: String(e?.message || e) };
    } finally {
      running = null;
    }
  })();
  return running;
}
