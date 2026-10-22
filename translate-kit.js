/* ═══════════════════════════════════════════════════════════
   translate-kit.js — ترجمة تلقائية عربي → إنجليزي، بلا React.

   6.8.0: كل الترجمة صارت تمر من محرّك واحد بالسيرفر (دالة i18n-translate):
   Claude بسياق المشروع ومعجمه + فحص جودة آلي، أو مترجم آلي بالمعجم لو ما فيه مفتاح.
   لو الدالة نفسها ما ردّت (مو منشورة بعد، انقطاع…) نرجع للمسار القديم (translate-text + المعجم بالواجهة).
   أي فشل يرجّع نص فاضي بصمت — حفظ النص العربي نفسه أبدًا ما يتعطّل بسببها.
   ═══════════════════════════════════════════════════════════ */

import { applyGlossary, splitForTranslation } from "./translation-glossary.js";

const FAIL_RX = /MYMEMORY WARNING|QUERY LENGTH LIMIT|WORDS LIMIT EXCEEDED|INVALID (SOURCE|TARGET) LANGUAGE/i;
const decode = (t) => String(t).replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/* المسار القديم (احتياط فقط): المعجم + تقطيع النص + translate-text — كله أو لا شي */
async function legacyTranslate(supabase, t) {
  try {
    const outLines = [];
    for (const chunks of splitForTranslation(t)) {
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

/* await autoTranslateAr(supabase, "نص عربي", { kind }) → "English text" أو ""
   kind: text (فقرة، الافتراضي) · heading (عنوان وسائط/مستند) · label (تسمية قصيرة) · person (اسم) · title (منصب) */
export async function autoTranslateAr(supabase, text, opts = {}) {
  const t = String(text || "").trim();
  if (!t) return "";
  const kind = opts && typeof opts === "object" && opts.kind ? opts.kind : "text";
  try {
    const { data, error } = await supabase.functions.invoke("i18n-translate", { body: { mode: "text", texts: [{ ar: t, kind }] } });
    if (!error && data && Array.isArray(data.results)) {
      const en = String(data.results[0]?.en || "").trim();
      return en; /* الدالة اشتغلت: نعتمد نتيجتها (حتى الفاضية) بدل مترجم أضعف */
    }
  } catch (_) { /* نكمل للاحتياط */ }
  return legacyTranslate(supabase, t);
}

/* هوك جاهز لحقل عربي واحد مربوط بحقل إنجليزي ثاني (لا يمسح إنجليزي مكتوب يدويًا) */
export function makeArBlurHandler(supabase, getEn, setEn, { skipIfFilled = true, kind = "text" } = {}) {
  return async (arText) => {
    if (skipIfFilled && String(getEn() || "").trim()) return;
    const en = await autoTranslateAr(supabase, arText, { kind });
    if (en) setEn(en);
    return en;
  };
}
