/* ═══════════════════════════════════════════════════════════
   translate-kit.js — ترجمة تلقائية عربي → إنجليزي، بلا React.

   الفكرة: تكتب عربي بأي حقل بلوحة الإدارة، وينحط الإنجليزي وحده بالخلفية
   (Supabase Edge Function اسمها "translate")، بدون ما تلمس شي إنت.
   لو فشلت الترجمة لأي سبب (مفتاح ناقص، الشبكة، إلخ) ترجع نص فاضي بصمت —
   حفظ النص العربي نفسه أبدًا ما يتعطّل بسببها.
   ═══════════════════════════════════════════════════════════ */

import { applyGlossary, splitForTranslation } from "./translation-glossary.js";

/* استدعاء مباشر: await autoTranslateAr(supabase, "نص عربي") → "English text" أو "" (6.8.0: بمعجم مصطلحات + تقطيع للنص الطويل)
   - المعجم (translation-glossary.js) يثبّت مقابل المصطلحات الهندسية قبل الإرسال للمترجم الآلي.
   - النص الطويل يُقطَّع لجمل (المترجم المجاني كان يقص عند ~490 حرفًا بصمت).
   - كله أو لا شي: لو فشلت أي قطعة أو بانت مقصوصة نرجّع "" بدل ترجمة ناقصة تنحفظ كأنها كاملة. */
const FAIL_RX = /MYMEMORY WARNING|QUERY LENGTH LIMIT|WORDS LIMIT EXCEEDED|INVALID (SOURCE|TARGET) LANGUAGE/i;
const decode = (t) => String(t).replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
export async function autoTranslateAr(supabase, text, target = "en") {
  const t = String(text || "").trim();
  if (!t) return "";
  try {
    const lines = splitForTranslation(t);
    const outLines = [];
    for (const chunks of lines) {
      const done = [];
      for (const c of chunks) {
        const body = applyGlossary(c);
        const { data, error } = await supabase.functions.invoke("translate-text", { body: { text: body } });
        const en = !error && typeof data?.translated === "string" ? decode(data.translated).replace(/\s{2,}/g, " ").trim() : "";
        if (!en || FAIL_RX.test(en) || (body.length > 120 && en.length < body.length * 0.3)) return "";
        done.push(en);
      }
      outLines.push(done.join(" "));
    }
    return outLines.join("\n").trim();
  } catch (_) {
    return "";
  }
}

/* هوك جاهز لحقل عربي واحد مربوط بحقل إنجليزي ثاني:
   const { onArBlur, busy } = useAutoTranslate(supabase, setEnglishValue);
   onArBlur يُستدعى بحدث onBlur لحقل العربي، ويملأ الإنجليزي تلقائيًا —
   إلا لو كان المستخدم كتب إنجليزي يدوي أصلًا (skipIfFilled=true الافتراضي). */
export function makeArBlurHandler(supabase, getEn, setEn, { skipIfFilled = true } = {}) {
  return async (arText) => {
    if (skipIfFilled && String(getEn() || "").trim()) return;
    const en = await autoTranslateAr(supabase, arText);
    if (en) setEn(en);
    return en;
  };
}
