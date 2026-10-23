/* ═══════════════════════════════════════════════════════════
   i18n-translate (6.8.0) — موقوفة.
   الترجمة صارت داخلية بالكامل: محرّك يشتغل داخل لوحة الإدارة على جهاز المشرف
   (local-mt-core.js / local-mt-worker.js) بدون أي خدمة خارجية ولا مفتاح.
   هالدالة ما تسوي أي اتصال خارجي وما تقرأ أو تكتب أي بيانات — بس ترجع رد واضح لأي استدعاء قديم.
   ═══════════════════════════════════════════════════════════ */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(
    JSON.stringify({ ok: false, error: "disabled", message: "Translation runs inside the admin panel (internal engine). This endpoint is disabled." }),
    { status: 410, headers: cors },
  );
});
