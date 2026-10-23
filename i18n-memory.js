/* ═══════════════════════════════════════════════════════════
   i18n-memory.js (6.8.0) — ذاكرة الترجمة للموقع العام: { عربي: إنجليزي } من جدول i18n_memory.
   فيها كل نص عربي ديناميكي ما له ترجمة ثابتة بالكود (اسم أو منصب جديد، قيمة فلتر، إشعار، ملاحظة شهر)،
   ويعبّيها محرّك الترجمة الداخلي كمسودات، وتظهر هنا بعد اعتمادها. تتحدث لحظيًا (Realtime).
   قبل تطبيق الهجرة (الجدول غير موجود) ترجع null بصمت — والموقع يكمل بالترجمات الثابتة.
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useState } from "react";

let CACHE = null;
export function useI18nMemory(supabase) {
  const [m, setM] = useState(CACHE);
  useEffect(() => {
    let alive = true, t = null;
    /* المعتمد فقط (مراجَع يدويًا أو مراجَع سابقًا) — المسودات تنتظر اعتمادها من تبويب «الترجمة» */
    const load = () => supabase.from("i18n_memory").select("ar,en").in("engine", ["human", "reviewed", "claude"]).then(({ data, error }) => {
      if (!alive || error || !Array.isArray(data)) return;
      const next = {};
      data.forEach((r) => { if (r && r.ar && typeof r.en === "string" && r.en.trim()) next[r.ar] = r.en.trim(); });
      CACHE = next; setM(next);
    }, () => {});
    load();
    const ch = supabase.channel("public-i18n-memory-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "i18n_memory" }, () => { clearTimeout(t); t = setTimeout(load, 700); })
      .subscribe();
    return () => { alive = false; clearTimeout(t); try { supabase.removeChannel(ch); } catch (_) { /* تجاهل */ } };
  }, [supabase]);
  return m;
}
