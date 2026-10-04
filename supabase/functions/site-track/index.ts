import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* site-track v1 — تحليلات الموقع العام (بدون JWT: الزائر ما عنده حساب).
   • start: ينشئ جلسة (جهاز/متصفح/دولة تقريبية/لغة/مصدر الزيارة) ويرجع sid موقّع HMAC صالح ٨ ساعات.
   • track: دفعة أحداث (≤٤٠) على جلسة صالحة؛ حدّ ٣٠٠٠ حدث للجلسة؛ حدّ طلبات لكل IP.
   • IP لا يُخزَّن: فقط بصمة HMAC مقتطعة. لا يُخزَّن أي نص يكتبه الزائر عدا عبارة البحث (مقتطعة، وتُعلَن بالإشعار). */
const VID_RE = /^[0-9a-f]{16,32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TYPE_RE = /^[a-z_]{2,24}$/;
const MAX_EVENTS = 3000;
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
const clip = (s: unknown, n: number) => { const v = String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n); return v || null; };
function parseUA(ua: string) {
  const device = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : "desktop";
  const browser = /edg\//i.test(ua) ? "Edge" : /opr\/|opera/i.test(ua) ? "Opera" : /samsungbrowser/i.test(ua) ? "Samsung" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Other";
  const os = /windows/i.test(ua) ? "Windows" : /iphone|ipad|ios/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}
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
    "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  };
  const out = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ ok: false }, 405);
  try {
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SECRET = "site|" + (Deno.env.get("SHARE_SIGNING_SECRET") || SERVICE_KEY);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0";
    if (limited(`${action}:${ip}`, action === "track" ? 120 : 20)) return out({ ok: false }, 429);

    if (action === "start") {
      const vid = String(body?.vid || "");
      const c = body?.client || {};
      const ua = parseUA(req.headers.get("user-agent") || "");
      if (/bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slurp/i.test(req.headers.get("user-agent") || "")) return out({ ok: false });
      let returning = false;
      if (VID_RE.test(vid)) {
        const { count } = await db.from("site_sessions").select("id", { count: "exact", head: true }).eq("visitor_id", vid);
        returning = (count || 0) > 0;
      }
      const country = clip(req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "", 2)?.toUpperCase() || null;
      const ipHash = (await sign(SECRET, `ip|${ip}`)).slice(0, 16);
      const { data: s } = await db.from("site_sessions").insert({
        visitor_id: VID_RE.test(vid) ? vid : null, is_returning: returning, country, ip_hash: ipHash, ...ua,
        lang: clip(c.lang, 16), screen: clip(c.screen, 16), tz: clip(c.tz, 40), referrer: clip(c.ref, 80), theme: clip(c.theme, 20),
      }).select("id").single();
      if (!s) return out({ ok: false }, 500);
      const exp = Date.now() + 8 * 3600 * 1000;
      const payload = `${s.id}|${exp}`;
      return out({ ok: true, sid: `${payload}.${await sign(SECRET, payload)}` });
    }

    if (action === "track") {
      const sid = String(body?.sid || "");
      const [payload, sig] = sid.split(".");
      if (!payload || !sig || !safeEq(sig, await sign(SECRET, payload))) return out({ ok: false });
      const [sessId, expStr] = payload.split("|");
      if (!UUID_RE.test(sessId || "") || Date.now() > Number(expStr)) return out({ ok: false, expired: true });
      const { data: sess } = await db.from("site_sessions").select("events,active_ms,max_scroll").eq("id", sessId).maybeSingle();
      if (!sess) return out({ ok: false });
      const incoming = Array.isArray(body?.events) ? body.events.slice(0, 40) : [];
      const room = Math.max(0, MAX_EVENTS - (sess.events || 0));
      const now = Date.now();
      const rows = incoming.slice(0, room).filter((e: { type?: string }) => TYPE_RE.test(String(e?.type))).map((e: Record<string, unknown>) => {
        const t = Number(e.t); const at = Number.isFinite(t) ? Math.min(now, Math.max(now - 3600000, t)) : now;
        return { session_id: sessId, at: new Date(at).toISOString(), type: String(e.type), category: clip(e.category, 80), value: clip(e.value, 120), extra: clip(e.extra, 160), tab: clip(e.tab, 30), target: clip(e.target, 30), label: clip(e.label, 100) };
      });
      if (rows.length) await db.from("site_events").insert(rows);
      const upd: Record<string, unknown> = {
        events: (sess.events || 0) + rows.length, last_seen_at: new Date().toISOString(),
        active_ms: Math.max(Number(sess.active_ms) || 0, Math.min(Number(body?.active_ms) || 0, 6 * 3600000)),
        max_scroll: Math.max(sess.max_scroll || 0, Math.min(100, Math.max(0, Math.round(Number(body?.scroll) || 0)))),
      };
      if (rows.some((x: { type: string }) => x.type === "end")) upd.ended_at = new Date().toISOString();
      if (clip(body?.theme, 20)) upd.theme = clip(body.theme, 20);
      await db.from("site_sessions").update(upd).eq("id", sessId);
      return out({ ok: true });
    }
    return out({ ok: false });
  } catch (_e) {
    return out({ ok: false }, 500);
  }
});
