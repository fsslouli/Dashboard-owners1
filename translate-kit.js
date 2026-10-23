/* ═══════════════════════════════════════════════════════════
   translate-kit.js — ترجمة تلقائية عربي → إنجليزي لحقول لوحة الإدارة (عناوين، تسميات…)، بلا React.

   6.8.0: الترجمة صارت داخلية بالكامل — موديل يشتغل على جهاز المشرف (local-mt.js) بمعجم المشروع،
   بدون أي خدمة خارجية ولا مفتاح. الناتج يتعبّى بالحقل الإنجليزي ويشوفه المشرف ويعدّله قبل الحفظ
   (الحفظ نفسه = اعتماده). ما ينزّل المحرّك من نفسه: لو المحرّك مو متحمّل بهالجهاز يرجّع نص فاضي
   (يُجهَّز مرة وحدة من تبويب «الترجمة»). أي فشل يرجّع نص فاضي بصمت — حفظ العربي أبدًا ما يتعطّل بسببها.
   ═══════════════════════════════════════════════════════════ */
import { engineAvailable, translateLocal } from "./local-mt.js";

/* await autoTranslateAr(supabase, "نص عربي", { kind }) → "English text" أو ""
   kind: text (فقرة، الافتراضي) · heading (عنوان وسائط/مستند) · label (تسمية قصيرة) · person (اسم) · title (منصب)
   (المعامل supabase باقٍ للتوافق مع الاستدعاءات الموجودة) */
export async function autoTranslateAr(_supabase, text, opts = {}) {
  const t = String(text || "").trim();
  if (!t) return "";
  const kind = opts && typeof opts === "object" && opts.kind ? opts.kind : "text";
  try {
    if (!(await engineAvailable())) return "";
    const [r] = await translateLocal([{ ar: t, kind }]);
    return String((r && r.en) || "").trim();
  } catch (_) {
    return "";
  }
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
