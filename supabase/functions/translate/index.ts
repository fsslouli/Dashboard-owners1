import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ترجمة تلقائية عربي → إنجليزي (أو أي اتجاه ثاني تمرره بـ target/source).
   المفتاح يبقى بالسيرفر فقط (GOOGLE_TRANSLATE_API_KEY) — أبدًا بالواجهة.
   أي حساب دخول صالح بالموقع يقدر يستخدمها (ما تحتاج صلاحية معيّنة —
   الترجمة نفسها مو إجراء حسّاس، بس لازم تسجيل دخول عشان ما يستهلك أحد
   حصة المفتاح المجانية من برّا). */
Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const API_KEY = Deno.env.get("GOOGLE_TRANSLATE_API_KEY");

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "الترجمة التلقائية غير مفعّلة — مفتاح GOOGLE_TRANSLATE_API_KEY ناقص" }), { status: 500, headers: cors });
    }

    // تأكيد إن الطالب مسجّل دخول (أي حساب إدارة صالح) — بلا اشتراط صلاحية محددة
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "غير مصرّح — سجّل دخول أولًا" }), { status: 401, headers: cors });
    }

    const body = await req.json();
    const text = String(body?.text || "").slice(0, 2000);
    const target = /^[a-z]{2}$/.test(body?.target) ? body.target : "en";
    const source = /^[a-z]{2}$/.test(body?.source) ? body.source : "ar";
    if (!text.trim()) return new Response(JSON.stringify({ translated: "" }), { headers: cors });

    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source, target, format: "text" }),
    });
    const json = await res.json();
    const translated = json?.data?.translations?.[0]?.translatedText;
    if (!res.ok || typeof translated !== "string") {
      return new Response(JSON.stringify({ error: json?.error?.message || "تعذّرت الترجمة" }), { status: 502, headers: cors });
    }
    return new Response(JSON.stringify({ translated }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: cors });
  }
});
