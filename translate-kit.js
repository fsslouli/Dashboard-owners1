/* ═══════════════════════════════════════════════════════════
   translate-kit.js — ترجمة تلقائية عربي → إنجليزي، بلا React.

   الفكرة: تكتب عربي بأي حقل بلوحة الإدارة، وينحط الإنجليزي وحده بالخلفية
   (Supabase Edge Function اسمها "translate")، بدون ما تلمس شي إنت.
   لو فشلت الترجمة لأي سبب (مفتاح ناقص، الشبكة، إلخ) ترجع نص فاضي بصمت —
   حفظ النص العربي نفسه أبدًا ما يتعطّل بسببها.
   ═══════════════════════════════════════════════════════════ */

/* استدعاء مباشر: await autoTranslateAr(supabase, "نص عربي") → "English text" أو "" */
export async function autoTranslateAr(supabase, text, target = "en") {
  const t = String(text || "").trim();
  if (!t) return "";
  try {
    const { data, error } = await supabase.functions.invoke("translate", { body: { text: t, target } });
    if (error || typeof data?.translated !== "string") return "";
    return data.translated;
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
