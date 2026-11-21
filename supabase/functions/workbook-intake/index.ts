import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* workbook-intake (7.10.0) — «ملف الإكسل الرئيسي» من جهة المساعد.
   • محمية بمفتاح سري بالترويسة x-workbook-secret؛ المفتاح محفوظ بجدول app_secrets (RLS بدون سياسات = ما يقرأه إلا الخادم).
   • POST (multipart): file (.xlsx) + note + sheet_names (JSON) + inquiry_count + file_name + by_name + version (اختياري)
       ← يحفظ الملف كما هو بالخزنة الخاصة «workbook» (مجلد assistant/) ويسجّله كنسخة جديدة.
   • GET ?action=latest      ← آخر نسخة (الملف نفسه).
     GET ?action=get&version=N ← نسخة محددة.
     GET ?action=list        ← قائمة النسخ.
   • ما فيها أي حذف أو تعديل لنسخة موجودة: كل رفع = نسخة جديدة، ونفس الملف مرتين يُرفض (same_as_latest). */

const BUCKET = "workbook";
const MAX = 25 * 1024 * 1024;
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const safeEq = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

Deno.serve(async (req: Request) => {
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sec } = await admin.from("app_secrets").select("value").eq("key", "workbook_intake").maybeSingle();
    const given = req.headers.get("x-workbook-secret") || "";
    if (!sec?.value || !given || !safeEq(given, String(sec.value))) return json({ ok: false, error: "unauthorized" }, 401);

    const url = new URL(req.url);

    if (req.method === "GET") {
      const action = url.searchParams.get("action") || "latest";
      if (action === "list") {
        const { data, error } = await admin.from("workbook_versions")
          .select("version_no,file_name,size_bytes,sha256,sheet_names,inquiry_count,note,source,uploaded_by_name,created_at")
          .order("version_no", { ascending: false }).limit(200);
        if (error) return json({ ok: false, error: "list_failed" }, 500);
        return json({ ok: true, items: data || [] });
      }
      if (action === "latest" || action === "get") {
        let q = admin.from("workbook_versions").select("*");
        const v = Number(url.searchParams.get("version"));
        q = action === "get" && Number.isInteger(v) ? q.eq("version_no", v) : q.order("version_no", { ascending: false }).limit(1);
        const { data: rows, error } = await q;
        if (error) return json({ ok: false, error: "read_failed" }, 500);
        const row = rows?.[0];
        if (!row) return json({ ok: false, error: "none" }, 404);
        const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(row.storage_path);
        if (dlErr || !blob) return json({ ok: false, error: "file_read_failed" }, 500);
        return new Response(blob, {
          headers: {
            "Content-Type": XLSX_TYPE,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
            "X-Workbook-Version": String(row.version_no),
            "X-Workbook-Sha256": row.sha256 || "",
            "X-Workbook-File": encodeURIComponent(row.file_name),
            "Cache-Control": "no-store",
          },
        });
      }
      return json({ ok: false, error: "unknown_action" }, 400);
    }

    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    let form: FormData;
    try { form = await req.formData(); } catch { return json({ ok: false, error: "bad_form" }, 400); }
    const f = form.get("file");
    if (!(f instanceof File)) return json({ ok: false, error: "no_file" }, 400);
    if (f.size <= 0 || f.size > MAX) return json({ ok: false, error: "bad_size", max: MAX }, 400);
    const buf = new Uint8Array(await f.arrayBuffer());
    /* ملف xlsx = أرشيف zip يبدأ بـ PK\x03\x04 */
    if (!(buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)) return json({ ok: false, error: "not_xlsx" }, 400);
    const sha = hex(await crypto.subtle.digest("SHA-256", buf));

    const { data: last } = await admin.from("workbook_versions").select("version_no,sha256").order("version_no", { ascending: false }).limit(1);
    const maxV = Number(last?.[0]?.version_no || 0);
    if (last?.[0]?.sha256 && last[0].sha256 === sha) return json({ ok: false, error: "same_as_latest", version_no: maxV }, 409);

    let sheets: unknown = [];
    try { sheets = JSON.parse(String(form.get("sheet_names") || "[]")); } catch { sheets = []; }
    if (!Array.isArray(sheets)) sheets = [];
    const inqRaw = form.get("inquiry_count");
    const inq = inqRaw === null || inqRaw === "" ? null : Number(inqRaw);
    const note = String(form.get("note") || "").slice(0, 500);
    const byName = String(form.get("by_name") || "المساعد").slice(0, 60);
    const fileName = String(form.get("file_name") || f.name || "workbook.xlsx").slice(0, 200);
    const want = Number(form.get("version"));
    const versionNo = Number.isInteger(want) && want > maxV ? want : maxV + 1;

    const path = `assistant/${crypto.randomUUID()}.xlsx`;
    const up = await admin.storage.from(BUCKET).upload(path, buf, { contentType: XLSX_TYPE });
    if (up.error) return json({ ok: false, error: "upload_failed", detail: up.error.message }, 500);

    const { data: row, error } = await admin.from("workbook_versions").insert({
      version_no: versionNo, file_name: fileName, storage_path: path, size_bytes: f.size, sha256: sha,
      sheet_names: sheets, inquiry_count: inq !== null && Number.isFinite(inq) ? Math.round(inq) : null,
      note, source: "assistant", uploaded_by_name: byName,
    }).select("version_no,file_name,created_at").single();
    if (error || !row) {
      await admin.storage.from(BUCKET).remove([path]);
      return json({ ok: false, error: "register_failed", detail: error?.message || "" }, 500);
    }
    return json({ ok: true, ...row, sha256: sha, size_bytes: f.size });
  } catch (e) {
    return json({ ok: false, error: "server_error", detail: (e as Error)?.message || "" }, 500);
  }
});
