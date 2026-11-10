import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* owner-login v1 (6.12.0) — دخول الملاك: رقم الفيلا + رقم سري من ٦ أرقام (بدون JWT: الزائر ما عنده حساب بعد).
   الإجراءان:
   • login  { villa, pin }  → يتحقق من الرقم السري ثم يرجّع جلسة Supabase حقيقية باسم حساب الفيلا.
   • share  { sid }         → جلسة قراءة مؤقتة لمستلم رابط مشاركة صالح، تنتهي مع جلسة الرابط نفسها.
   الأمان:
   • قفل ١٥ دقيقة بعد ٥ أخطاء متتالية لكل فيلا (villa_pin_fail)، وحدّ طلبات تقريبي لكل IP.
   • الرد على «فيلا غير موجودة / معطّلة / رقم خاطئ» واحد، فما ينعرف أي حساب موجود.
   • مقارنة ثابتة الزمن، Cache-Control: no-store، ولا يُخزَّن IP.
   • الرقم السري ما هو كلمة مرور حساب الدخول: الحساب له سرّ داخلي عشوائي، فتغيير الرقم السري
     من الإدارة يفصل الحساب القديم فورًا (gate_ok بقاعدة البيانات يرفض جلساته). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VILLA_MAX = 596;
const enc = new TextEncoder();
const b64u = (b: ArrayBuffer) => {
  const u = new Uint8Array(b); let s = "";
  u.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function sign(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const rand = (n: number) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); };
const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

/* حدّ طلبات تقريبي (لكل نسخة من الدالة) — طبقة إضافية فوق قفل الحساب */
const hits = new Map<string, { n: number; t: number }>();
function limited(key: string, max: number) {
  const now = Date.now(); const h = hits.get(key);
  if (!h || now - h.t > 60000) { hits.set(key, { n: 1, t: now }); if (hits.size > 5000) hits.clear(); return false; }
  h.n++; return h.n > max;
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const out = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ state: "error" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0";
    if (limited(`${action}:${ip}`, 20)) return out({ state: "busy" }, 429);

    /* دخول فعلي بحساب داخلي ثم إرجاع رمزَي الجلسة للمتصفح */
    const sessionFor = async (email: string, password: string) => {
      const pub = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await pub.auth.signInWithPassword({ email, password });
      if (error || !data?.session) return null;
      return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    };

    /* ── دخول مالك ── */
    if (action === "login") {
      const villa = Number(toLatinDigits(String(body?.villa ?? "")).trim());
      const pin = toLatinDigits(String(body?.pin ?? "")).trim();
      if (!Number.isInteger(villa) || villa < 1 || villa > VILLA_MAX || !/^[0-9]{6}$/.test(pin)) return out({ state: "invalid" });
      if (limited(`v:${villa}`, 12)) return out({ state: "busy" }, 429);

      const { data: acc } = await db.from("villa_accounts").select("villa,pin,enabled,locked_until,login_count").eq("villa", villa).maybeSingle();
      if (!acc || !acc.enabled) { safeEq(pin, "000000"); return out({ state: "invalid" }); }
      if (acc.locked_until && new Date(acc.locked_until).getTime() > Date.now()) {
        return out({ state: "locked", minutes: Math.max(1, Math.ceil((new Date(acc.locked_until).getTime() - Date.now()) / 60000)) });
      }
      if (!safeEq(pin, String(acc.pin))) {
        const { data: f } = await db.rpc("villa_pin_fail", { p_villa: villa });
        if (f?.locked) return out({ state: "locked", minutes: 15 });
        return out({ state: "invalid", left: f?.left ?? 0 });
      }

      /* الرقم صحيح — نجهّز حساب الدخول الداخلي (يُنشأ عند أول دخول، ويُستبدل بعد كل تغيير للرقم السري) */
      let { data: au } = await db.from("villa_auth").select("auth_user_id,auth_email,auth_secret,stale_ids").eq("villa", villa).maybeSingle();
      for (const id of (au?.stale_ids || []) as string[]) { try { await db.auth.admin.deleteUser(id); } catch (_e) { /* محذوف من قبل */ } }
      if (!au?.auth_user_id || !au.auth_email || !au.auth_secret) {
        const email = `villa${villa}.${rand(6)}@owners.alborada.invalid`;
        const secret = rand(24);
        const { data: cu, error: ce } = await db.auth.admin.createUser({
          email, password: secret, email_confirm: true,
          app_metadata: { villa_login: villa }, user_metadata: { name: `فيلا ${villa}` },
        });
        if (ce || !cu?.user) return out({ state: "error" }, 500);
        au = { auth_user_id: cu.user.id, auth_email: email, auth_secret: secret, stale_ids: [] };
        await db.from("villa_auth").upsert({ villa, ...au });
      } else if ((au.stale_ids || []).length) {
        await db.from("villa_auth").update({ stale_ids: [] }).eq("villa", villa);
      }
      const sess = await sessionFor(au.auth_email as string, au.auth_secret as string);
      if (!sess) return out({ state: "error" }, 500);
      await db.from("villa_accounts").update({
        fails: 0, locked_until: null, last_login_at: new Date().toISOString(), login_count: (acc.login_count || 0) + 1,
      }).eq("villa", villa);
      return out({ state: "ok", villa, ...sess });
    }

    /* ── جلسة قراءة لمستلم رابط مشاركة (نفس توقيع share-view) ── */
    if (action === "share") {
      const SECRET = Deno.env.get("SHARE_SIGNING_SECRET") || SERVICE_KEY;
      const [payload, sig] = String(body?.sid || "").split(".");
      if (!payload || !sig || !safeEq(sig, await sign(SECRET, payload))) return out({ state: "unknown" });
      const [linkId, sessId, expStr] = payload.split("|");
      const exp = Number(expStr);
      if (!UUID_RE.test(linkId || "") || !UUID_RE.test(sessId || "") || !exp || Date.now() >= exp) return out({ state: "session_ended" });
      const { data: l } = await db.from("share_links").select("revoked_at,expires_at").eq("id", linkId).maybeSingle();
      if (!l || l.revoked_at || new Date(l.expires_at).getTime() <= Date.now()) return out({ state: "revoked" });

      const email = `share.${sessId.slice(0, 8)}.${rand(5)}@owners.alborada.invalid`;
      const secret = rand(24);
      const { data: cu, error: ce } = await db.auth.admin.createUser({
        email, password: secret, email_confirm: true, app_metadata: { share_link: linkId, share_exp: exp },
      });
      if (ce || !cu?.user) return out({ state: "error" }, 500);
      const sess = await sessionFor(email, secret);
      if (!sess) return out({ state: "error" }, 500);
      return out({ state: "ok", ...sess });
    }

    return out({ state: "error" }, 400);
  } catch (_e) {
    return out({ state: "error" }, 500);
  }
});
