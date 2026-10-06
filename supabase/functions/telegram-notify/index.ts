import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════
   telegram-notify (٥.٣.٠) — نشر تحديث في قروب الملاك على تليجرام.

   جاهزة وغير مفعّلة: ما تشتغل إلا بعد الإعداد (README ← «بوت تليجرام»).
   • تُستدعى من لوحة الإدارة فقط بحساب مسجّل — انشرها والتحقق من JWT مفعّل
     (الافتراضي)، ولا تستخدم --no-verify-jwt معها.
   • تتأكد إن المستدعي عنده صلاحية «manage_notices» (نفس صلاحية إشعارات الموقع).
   • ما فيه أي نشر تلقائي: الرسالة تنزل بالقروب فقط لما الأدمن يضغط «نشر» ويأكّد.
   • النص يُرسل كنص عادي (بدون تنسيق HTML/Markdown) فما يتغيّر شكله ولا يُفسَّر.

   الأسرار المطلوبة (لوحة Supabase ← Edge Functions ← Secrets):
     TELEGRAM_BOT_TOKEN  مفتاح البوت من @BotFather
     TELEGRAM_CHAT_ID    رقم القروب (يبدأ عادة بـ -100)
   ═══════════════════════════════════════════════════════════ */

const PERM = "manage_notices";
const MAX_LEN = 4000; /* حد تليجرام ٤٠٩٦ حرفًا للرسالة الواحدة */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

type TgResult = { ok?: boolean; description?: string; result?: Record<string, unknown> };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    /* ١) من المستدعي؟ */
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ ok: false, error: "unauthorized" }, 401);

    /* ٢) عنده صلاحية إشعارات الموقع؟ (نفس طريقة admin-invite-user) */
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await adminClient.from("profiles").select("perms").eq("id", userData.user.id).single();
    if (!profile || !(profile.perms || []).includes(PERM)) return json({ ok: false, error: "forbidden" }, 403);

    /* ٣) البوت مضبوط؟ */
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID") || "";
    if (!token || !chatId) return json({ ok: false, state: "not_configured" });

    const tg = async (method: string, payload: Record<string, unknown>): Promise<TgResult> => {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await r.json().catch(() => ({ ok: false }));
    };

    let body: { action?: string; text?: unknown } = {};
    try { body = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }

    /* فحص الجاهزية: المفتاح صحيح + البوت يوصل للقروب */
    if (body.action === "status") {
      const me = await tg("getMe", {});
      if (!me.ok) return json({ ok: false, state: "bad_token" });
      const chat = await tg("getChat", { chat_id: chatId });
      const bot = String(me.result?.username || "");
      if (!chat.ok) return json({ ok: false, state: "chat_unreachable", bot });
      return json({ ok: true, state: "ready", bot, chat: String(chat.result?.title || "") });
    }

    /* النشر */
    if (body.action === "send") {
      const text = String(body.text ?? "").trim();
      if (!text) return json({ ok: false, error: "empty" }, 400);
      if (text.length > MAX_LEN) return json({ ok: false, error: "too_long", max: MAX_LEN }, 400);
      const sent = await tg("sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: false } });
      if (!sent.ok) return json({ ok: false, error: "telegram_error", detail: sent.description || "" }, 502);
      return json({ ok: true, message_id: sent.result?.message_id ?? null });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "server_error" }, 500);
  }
});
