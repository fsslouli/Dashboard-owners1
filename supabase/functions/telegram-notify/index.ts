import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════
   telegram-notify (٧.١.٠) — نشر تحديث في قروب الملاك على تليجرام + إعداد البوت من لوحة الإدارة.

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

    /* ٣) إعداد البوت: أسرار Supabase لها الأولوية، وإلا من جدول bot_config (يُضبط من لوحة الإدارة — ٧.١.٠).
          المفتاح ما يرجع للمتصفح أبدًا: يُكتب مرة واحدة ويُقرأ هنا فقط بمفتاح الخادم. */
    const { data: cfg } = await adminClient.from("bot_config").select("tg_token,tg_chat_id,tg_chat_title").eq("id", 1).maybeSingle();
    const envToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const envChat = Deno.env.get("TELEGRAM_CHAT_ID") || "";
    let token = envToken || cfg?.tg_token || "";
    let chatId = envChat || cfg?.tg_chat_id || "";

    const tgWith = async (tk: string, method: string, payload: Record<string, unknown>): Promise<TgResult> => {
      const r = await fetch(`https://api.telegram.org/bot${tk}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await r.json().catch(() => ({ ok: false }));
    };
    const tg = (method: string, payload: Record<string, unknown>) => tgWith(token, method, payload);
    const save = (patch: Record<string, unknown>) =>
      adminClient.from("bot_config").upsert({ id: 1, ...patch, updated_at: new Date().toISOString(), updated_by: userData.user!.id });

    let body: { action?: string; text?: unknown; token?: unknown; chat_id?: unknown } = {};
    try { body = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }

    /* حفظ مفتاح البوت من لوحة الإدارة (بعد التحقق منه عند تليجرام) */
    if (body.action === "setup_token") {
      const tk = String(body.token ?? "").trim();
      if (!/^[0-9]{6,12}:[A-Za-z0-9_-]{30,60}$/.test(tk)) return json({ ok: false, state: "bad_token" });
      const me = await tgWith(tk, "getMe", {});
      if (!me.ok) return json({ ok: false, state: "bad_token" });
      const { error } = await save({ tg_token: tk, tg_chat_id: null, tg_chat_title: null });
      if (error) return json({ ok: false, error: "store_failed" }, 500);
      return json({ ok: true, state: "need_chat", bot: String(me.result?.username || "") });
    }

    /* فصل البوت: يمسح المفتاح والقروب المحفوظين بالقاعدة */
    if (body.action === "disconnect") {
      await save({ tg_token: null, tg_chat_id: null, tg_chat_title: null });
      return json({ ok: true, state: envToken ? "env_managed" : "not_configured" });
    }

    if (!token) return json({ ok: false, state: "not_configured" });

    /* البحث عن القروبات اللي أُضيف لها البوت (من آخر التحديثات عنده) */
    if (body.action === "discover") {
      const me = await tg("getMe", {});
      if (!me.ok) return json({ ok: false, state: "bad_token" });
      const up = (await tg("getUpdates", { limit: 100, allowed_updates: ["message", "my_chat_member", "channel_post"] })) as unknown as { ok?: boolean; result?: Array<Record<string, any>> };
      const seen = new Map<string, { id: string; title: string; type: string }>();
      for (const u of up.result || []) {
        const c = u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat;
        if (c && ["group", "supergroup", "channel"].includes(c.type)) seen.set(String(c.id), { id: String(c.id), title: String(c.title || ""), type: String(c.type) });
      }
      return json({ ok: true, bot: String(me.result?.username || ""), chats: [...seen.values()] });
    }

    /* اعتماد القروب */
    if (body.action === "set_chat") {
      const cid = String(body.chat_id ?? "").trim();
      if (!/^-?[0-9]{5,20}$/.test(cid)) return json({ ok: false, state: "chat_unreachable" });
      const chat = await tg("getChat", { chat_id: cid });
      if (!chat.ok) return json({ ok: false, state: "chat_unreachable" });
      await save({ tg_chat_id: cid, tg_chat_title: String(chat.result?.title || "") });
      return json({ ok: true, state: "ready", chat: String(chat.result?.title || "") });
    }

    /* فحص الجاهزية: المفتاح صحيح + البوت يوصل للقروب */
    if (body.action === "status") {
      const me = await tg("getMe", {});
      if (!me.ok) return json({ ok: false, state: "bad_token" });
      const bot = String(me.result?.username || "");
      if (!chatId) return json({ ok: false, state: "need_chat", bot });
      const chat = await tg("getChat", { chat_id: chatId });
      if (!chat.ok) return json({ ok: false, state: "chat_unreachable", bot });
      return json({ ok: true, state: "ready", bot, chat: String(chat.result?.title || ""), managed: envToken ? "env" : "panel" });
    }
    if (!chatId) return json({ ok: false, state: "need_chat" });

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
