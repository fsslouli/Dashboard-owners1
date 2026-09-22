import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* v2.9.1 — ما يقدر أحد يمنح حساب جديد صلاحية ما يملكها هو (إلا صاحب «تعديل الصلاحيات»).
   قبل كذا أي عضو عنده «إنشاء حسابات» كان يقدر ينشئ حساب بكل الصلاحيات ويدخل فيه. */
const PERM_RE = /^[a-z_]{2,40}$/;
function checkGrant(callerPerms: unknown, requested: unknown): { perms: string[]; denied: string[] } {
  const mine = Array.isArray(callerPerms) ? (callerPerms as unknown[]).filter((p): p is string => typeof p === "string") : [];
  const asked = Array.isArray(requested)
    ? [...new Set((requested as unknown[]).filter((p): p is string => typeof p === "string" && PERM_RE.test(p)))]
    : [];
  const denied = mine.includes("edit_permissions") ? [] : asked.filter((p) => !mine.includes(p));
  return { perms: asked, denied };
}

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
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "غير مصرّح — سجّل دخول أولًا" }), { status: 401, headers: cors });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // تأكيد إن المستدعي نفسه عنده صلاحية "إنشاء حسابات دخول جديدة" تحديدًا (مو أي صلاحية إدارية أخرى)
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("perms")
      .eq("id", userData.user.id)
      .single();
    if (!callerProfile || !(callerProfile.perms || []).includes("create_users")) {
      return new Response(JSON.stringify({ error: "ما عندك صلاحية إنشاء حسابات جديدة" }), { status: 403, headers: cors });
    }

    const body = await req.json();
    const { email, password, name, perms } = body || {};
    if (!email || !password || password.length < 6) {
      return new Response(JSON.stringify({ error: "البريد وكلمة مرور (٦ أحرف على الأقل) مطلوبين" }), { status: 400, headers: cors });
    }

    // التحقق من الصلاحيات المطلوبة قبل إنشاء أي حساب — فالرفض ما يخلّف حساب دخول يتيم
    const grant = checkGrant(callerProfile.perms, perms);
    if (grant.denied.length) {
      return new Response(
        JSON.stringify({ error: `ما تقدر تمنح صلاحية ما تملكها: ${grant.denied.join("، ")}`, denied: grant.denied }),
        { status: 403, headers: cors },
      );
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "تعذّر إنشاء الحساب" }), { status: 400, headers: cors });
    }

    const { error: profileErr } = await adminClient.from("profiles").insert({
      id: created.user.id,
      name: name || email,
      role: "custom",
      perms: grant.perms,
    });
    if (profileErr) {
      // ما نخلّي حساب دخول بلا ملف صلاحيات
      try { await adminClient.auth.admin.deleteUser(created.user.id); } catch (_) { /* نكمل بالرد */ }
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ success: true, id: created.user.id }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
