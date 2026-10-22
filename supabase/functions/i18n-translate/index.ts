import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createCore } from "./core.ts";

/* ═══════════════════════════════════════════════════════════
   i18n-translate (6.8.0) — محرّك الترجمة الموحّد للموقع (عربي ← إنجليزي).

   الأوضاع:
   • sweep  — يترجم كل ما ينقصه ترجمة أو تغيّر نصه العربي (الاستفسارات + الأسماء والقيم
              والإشعارات وملاحظات الأشهر) ويحفظه مباشرة. تستدعيه الجدولة كل ٥ دقائق،
              ولوحة الإدارة بعد أي حفظ. ما يستقبل نصًا من الطالب — فما يمكن استغلاله لترجمة
              نصوص خارجية على حساب المفتاح، وأقصى عمله محدود بما هو ناقص فعلًا بقاعدة البيانات.
   • text   — ترجمة نصوص يرسلها الأدمن (عناوين الوسائط والروابط…). يتطلب دخول + صلاحية تحرير.
   • status — هل مفتاح Claude مضبوط؟ (بدون كشف المفتاح نفسه)

   المحرّك: Claude لو ANTHROPIC_API_KEY مضبوط بأسرار الدوال، وإلا المترجم الآلي المجاني
   بمعجم المشروع — ونتيجته توسم «آلية» وتُرقّى لـ Claude تلقائيًا أول ما ينضاف المفتاح.
   النموذج قابل للتغيير بسر اختياري I18N_MODEL (الافتراضي claude-sonnet-5-5).
   ═══════════════════════════════════════════════════════════ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });
const KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = Deno.env.get("I18N_MODEL") || "claude-sonnet-5-5";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const core = createCore({ db, key: KEY, model: MODEL });
const EDIT_PERMS = ["edit_inquiry", "add_inquiry", "import_excel", "manage_theme", "manage_gallery", "manage_media", "manage_links", "manage_notices", "manage_filters"];

const hits = new Map<string, { n: number; t: number }>();
function limited(key: string, max: number) {
  const now = Date.now(); const h = hits.get(key);
  if (!h || now - h.t > 60000) { hits.set(key, { n: 1, t: now }); if (hits.size > 2000) hits.clear(); return false; }
  h.n++; return h.n > max;
}

async function authUser(req: Request): Promise<{ id: string; perms: string[] } | null> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.startsWith("sb_") || jwt.split(".").length !== 3) return null;
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) return null;
  const { data: prof } = await db.from("profiles").select("perms").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, perms: Array.isArray(prof?.perms) ? prof!.perms as string[] : [] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  const mode = String(body.mode || "sweep");
  try {
    if (mode === "status") return json({ ok: true, has_key: !!KEY, model: KEY ? MODEL : null });
    if (mode === "text") {
      const u = await authUser(req);
      if (!u) return json({ error: "unauthorized" }, 401);
      if (!u.perms.some((p) => EDIT_PERMS.includes(p))) return json({ error: "forbidden" }, 403);
      if (limited("t:" + u.id, 40)) return json({ error: "rate_limited" }, 429);
      return json(await core.translateTexts(Array.isArray(body.texts) ? body.texts as unknown[] : []));
    }
    if (mode === "sweep") {
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0";
      if (limited("s:" + ip, 20)) return json({ ok: false, error: "rate_limited" }, 429);
      return json(await core.sweep(String(body.source || "manual").slice(0, 20)));
    }
    return json({ error: "unknown mode" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as { message?: string })?.message || e).slice(0, 300) }, 500);
  }
});
