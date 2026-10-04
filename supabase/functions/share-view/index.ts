import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* share-view v4 — روابط المشاركة الخاصة: التحقق + PIN + الجلسات + التتبع (بدون JWT: المستلم ما عنده حساب).
   الأمان:
   • الرمز ١٢٨ بت (٢٢ حرفًا). القاعدة تحفظ مفتاح بحث مشتقًّا بـ HKDF لا الرمز نفسه.
   • PIN اختياري: PBKDF2-SHA256 ١٥٠ ألف دورة، قفل ١٥ دقيقة بعد ٥ أخطاء، وإلغاء الرابط بعد ١٥ خطأ إجمالًا.
   • جلسة موقّعة HMAC-SHA256 (linkId|sessionId|exp) تُفحص عند كل استدعاء — الإلغاء ينتهي مفعوله فورًا.
   • مقارنات ثابتة الزمن، Cache-Control: no-store، حدّ طلبات تقريبي لكل IP.
   • IP لا يُخزَّن: فقط بصمة HMAC مقتطعة. الدالة ما ترجع أي بيانات للموقع — فقط حالة الرابط ونطاق العرض. */
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PIN_ITER = 150000;
const EVENT_TYPES = new Set(["click", "tab", "link", "download", "hide", "show", "end"]);
const MAX_EVENTS_PER_SESSION = 4000;
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
const b64u = (b: ArrayBuffer) => {
  const u = new Uint8Array(b); let s = "";
  u.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function hmac(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}
const sign = async (secret: string, msg: string) => b64u(await hmac(secret, msg));
async function lookupKey(token: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(token), "HKDF", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: enc.encode("alborada-share-v4"), info: enc.encode("alborada/share/lookup/v4") }, k, 256));
}
async function pinHash(pin: string, saltHex: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: PIN_ITER }, k, 256));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const clip = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

function parseUA(ua: string) {
  const device = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : "desktop";
  const browser = /edg\//i.test(ua) ? "Edge" : /opr\/|opera/i.test(ua) ? "Opera" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Other";
  const os = /windows/i.test(ua) ? "Windows" : /iphone|ipad|ios/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}

type Row = { revoked_at: string | null; expires_at: string; opens: number; max_opens: number; locked_until?: string | null };
function stateOf(r: Row | null, consumeCheck: boolean) {
  if (!r) return "unknown";
  if (r.revoked_at) return "revoked";
  if (new Date(r.expires_at).getTime() <= Date.now()) return "expired";
  if (r.locked_until && new Date(r.locked_until).getTime() > Date.now()) return "locked";
  if (consumeCheck && r.opens >= r.max_opens) return "exhausted";
  return "ok";
}

/* حدّ طلبات تقريبي (لكل نسخة من الدالة) — طبقة إضافية فوق قفل الـ PIN */
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
  if (req.method !== "POST") return out({ state: "unknown" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SECRET = Deno.env.get("SHARE_SIGNING_SECRET") || SERVICE_KEY;
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0";
    if (limited(`${action === "track" ? "t" : "a"}:${ip}`, action === "track" ? 240 : 40)) return out({ state: "error" }, 429);

    /* ── التحقق من جلسة موقّعة (يستعمله session و track) ── */
    const readSid = async (sidRaw: unknown) => {
      const sid = String(sidRaw || "");
      const [payload, sig] = sid.split(".");
      if (!payload || !sig) return null;
      if (!safeEq(sig, await sign(SECRET, payload))) return null;
      const [linkId, sessId, expStr] = payload.split("|");
      if (!UUID_RE.test(linkId || "") || !UUID_RE.test(sessId || "")) return null;
      return { linkId, sessId, exp: Number(expStr) };
    };

    if (action === "session" || action === "track") {
      const s = await readSid(body?.sid);
      if (!s) return out({ state: "unknown" });
      const { data: r } = await db.from("share_links").select("scope,note,expires_at,revoked_at,opens,max_opens").eq("id", s.linkId).maybeSingle();
      const st = stateOf(r, false);
      if (st !== "ok") return out({ state: st });
      if (!s.exp || Date.now() >= s.exp) return out({ state: "session_ended" });

      if (action === "session") {
        await db.from("share_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", s.sessId);
        return out({ state: "ok", scope: r!.scope, note: r!.note, sessionEnds: new Date(s.exp).toISOString() });
      }

      /* track: دفعة أحداث من صفحة المستلم */
      const { data: sess } = await db.from("share_sessions").select("events,active_ms").eq("id", s.sessId).eq("link_id", s.linkId).maybeSingle();
      if (!sess) return out({ state: "unknown" });
      const incoming = Array.isArray(body?.events) ? body.events.slice(0, 50) : [];
      const room = Math.max(0, MAX_EVENTS_PER_SESSION - (sess.events || 0));
      const now = Date.now();
      const rows = incoming.slice(0, room).filter((e: { type?: string }) => EVENT_TYPES.has(String(e?.type))).map((e: Record<string, unknown>) => {
        const t = Number(e.t); const at = Number.isFinite(t) ? Math.min(now, Math.max(now - 3600000, t)) : now;
        const m = e.meta && typeof e.meta === "object" ? (e.meta as Record<string, unknown>) : null;
        return {
          session_id: s.sessId, link_id: s.linkId, at: new Date(at).toISOString(), type: String(e.type),
          tab: clip(e.tab, 30) || null, target: clip(e.target, 30) || null, label: clip(e.label, 100) || null,
          meta: m ? { host: clip(m.host, 120) || undefined, file: clip(m.file, 120) || undefined } : null,
        };
      });
      const ended = rows.some((x: { type: string }) => x.type === "end");
      if (rows.length) await db.from("share_events").insert(rows);
      const active = Math.max(Number(sess.active_ms) || 0, Math.min(Number(body?.active_ms) || 0, 1000 * 60 * 60 * 6));
      await db.from("share_sessions").update({
        events: (sess.events || 0) + rows.length, active_ms: active, last_seen_at: new Date().toISOString(),
        ...(ended ? { ended_at: new Date().toISOString() } : {}),
      }).eq("id", s.sessId);
      return out({ state: "ok" });
    }

    const token = String(body?.token || "");
    if (!TOKEN_RE.test(token)) return out({ state: "unknown" });
    const lk = await lookupKey(token);

    /* حالة فقط — لا تستهلك فتحة (حتى معاينات واتساب/تليجرام ما تضر الرابط) */
    if (action === "status") {
      const { data: r } = await db.from("share_links").select("expires_at,revoked_at,opens,max_opens,locked_until,has_pin").eq("token_hash", lk).maybeSingle();
      const st = stateOf(r, true);
      return out(st === "ok" ? { state: "ok", pin: !!r?.has_pin } : { state: st });
    }

    /* فتح فعلي: PIN (إن وُجد) ثم استهلاك فتحة ذرّيًا ثم جلسة موقّعة + تسجيل بداية الجلسة */
    if (action === "open") {
      const { data: r } = await db.from("share_links").select("id,expires_at,revoked_at,opens,max_opens,locked_until,pin_salt,pin_hash").eq("token_hash", lk).maybeSingle();
      const st = stateOf(r, true);
      if (st !== "ok") return out({ state: st });
      if (r!.pin_hash) {
        const pin = String(body?.pin ?? "");
        if (!pin) return out({ state: "pin" });
        if (pin.length > 32 || !safeEq(await pinHash(pin, r!.pin_salt as string), r!.pin_hash as string)) {
          const { data: f } = await db.rpc("share_pin_fail", { p_id: r!.id });
          if (f?.revoked) return out({ state: "revoked" });
          if (f?.locked) return out({ state: "locked" });
          return out({ state: "pin_wrong", left: f?.left ?? 0 });
        }
      }
      const { data, error } = await db.rpc("share_consume", { p_hash: lk });
      if (error || !data) return out({ state: "unknown" });
      if (data.state !== "ok") return out({ state: data.state });

      const ua = parseUA(req.headers.get("user-agent") || "");
      const c = body?.client || {};
      const country = clip(req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "", 2).toUpperCase() || null;
      const ipHash = (await sign(SECRET, `ip|${ip}`)).slice(0, 16);
      const { data: sess } = await db.from("share_sessions").insert({
        link_id: data.id, ip_hash: ipHash, country, ...ua,
        lang: clip(c.lang, 16) || null, screen: clip(c.screen, 16) || null, tz: clip(c.tz, 40) || null,
      }).select("id").single();
      if (!sess) return out({ state: "error" }, 500);
      await db.from("share_events").insert({ session_id: sess.id, link_id: data.id, type: "open", label: data.state });
      await db.from("share_sessions").update({ events: 1 }).eq("id", sess.id);

      const mins = Math.max(5, Math.min(240, Number(data.session_minutes) || 30));
      const exp = Math.min(Date.now() + mins * 60000, new Date(data.expires_at).getTime());
      const payload = `${data.id}|${sess.id}|${exp}`;
      const sid = `${payload}.${await sign(SECRET, payload)}`;
      return out({ state: "ok", sid, scope: data.scope, note: data.note, sessionEnds: new Date(exp).toISOString() });
    }
    return out({ state: "unknown" });
  } catch (_e) {
    return out({ state: "error" }, 500);
  }
});
