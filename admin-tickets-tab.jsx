/* ═══════════════════════════════════════════════════════════
   admin-tickets-tab.jsx — تبويب «تذاكر الملاك» (7.0.0)
   كل استفسار أو مقترح يرسله مالك من الموقع يوصل هنا برقم تذكرة:
   • فرز: لم تُراجع / قيد المراجعة / تمت (حُوّلت لاستفسار أو أُغلقت) + بحث برقم الفيلا أو التذكرة
   • لكل تذكرة: رد يظهر للمالك عند المتابعة، ربطها برقم الاستفسار، تغيير الحالة، نسخ النص، حذف
   • استخراج الكل (أو المعروض) إكسل
   • زر استقبال التذاكر: مقفول / للملاك المسجّلين فقط / لأي زائر برقم فيلته
   الصلاحية: manage_tickets — الجدول والدوال: migration-owner-tickets.sql
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { BadgeCheck, Copy, Download, Inbox, Search, Trash2 } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";
import { TICKET_KINDS, TICKET_STATUS } from "./ticket-kit.jsx";

const S = {
  wrap: { maxWidth: 860, margin: "0 auto", padding: "4px 0", color: "#1F2C35" },
  card: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 16, marginBottom: 14 },
  h: { fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 12.5, color: "#5F7280", margin: "0 0 12px", lineHeight: 1.8 },
  btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "7px 12px", fontWeight: 500, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", font: "inherit", fontSize: 13, color: "#1F2C35" },
  pri: { background: "#1B7F8E", borderColor: "#1B7F8E", color: "#fff" },
  inp: { boxSizing: "border-box", border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 13.5, color: "#1F2C35" },
  chip: (c) => ({ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: c + "1A", color: c, whiteSpace: "nowrap" }),
};
const MODES = [["all", "مفتوح للجميع", "أي زائر يرسل برقم فيلته"], ["owners", "للملاك المسجّلين", "بعد الدخول بحساب الفيلا فقط"], ["off", "مقفول", "زر الإرسال يختفي من الموقع"]];
const FILTERS = [["open", "لم تُراجع"], ["review", "قيد المراجعة"], ["done", "تمت"], ["all", "الكل"]];
const fmt = (v) => (v ? new Date(v).toLocaleString("ar-SA-u-nu-latn-ca-gregory", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const isDone = (s) => s === "converted" || s === "closed";

function TicketCard({ r, onSave, onDelete, flashToast }) {
  const [reply, setReply] = useState(r.admin_reply || "");
  const [inq, setInq] = useState(r.inquiry_id ? String(r.inquiry_id) : "");
  useEffect(() => { setReply(r.admin_reply || ""); setInq(r.inquiry_id ? String(r.inquiry_id) : ""); }, [r.admin_reply, r.inquiry_id]);
  const st = TICKET_STATUS[r.status] || TICKET_STATUS.new;
  const dirty = reply !== (r.admin_reply || "") || inq !== (r.inquiry_id ? String(r.inquiry_id) : "");
  const patch = (status) => {
    const p = { admin_reply: reply.trim(), inquiry_id: /^[0-9]+$/.test(inq.trim()) ? Number(inq.trim()) : null };
    if (status) p.status = status;
    if (status === "converted" && !p.inquiry_id) { flashToast("اكتب رقم الاستفسار اللي سجلته بالموقع أولًا"); return; }
    onSave(r, p);
  };
  return (
    <div style={{ ...S.card, borderInlineStart: `4px solid ${st.color}` }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <b dir="ltr" style={{ fontFamily: "ui-monospace, monospace", fontSize: 14.5 }}>{r.ticket_no}</b>
        <span style={{ fontWeight: 700, fontSize: 14 }}>فيلا {r.villa}</span>
        {r.verified ? <span style={S.chip("#2E7D5B")} title="أُرسلت من حساب الفيلا بعد تسجيل الدخول"><BadgeCheck size={11} style={{ verticalAlign: -2 }} /> مؤكدة</span> : <span style={S.chip("#5F7280")} title="رقم الفيلا كتبه المرسل بنفسه (بدون تسجيل دخول)">غير مؤكدة</span>}
        <span style={S.chip(r.kind === "suggestion" ? "#5A4E8C" : "#1B7F8E")}>{TICKET_KINDS[r.kind]}</span>
        <span style={S.chip(st.color)}>{st.short}</span>
        <span style={{ fontSize: 11.5, color: "#5F7280", marginInlineStart: "auto" }}>{fmt(r.created_at)}</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.95, whiteSpace: "pre-wrap", background: "#F7F9FB", borderRadius: 10, padding: "10px 12px" }}>{r.body}</div>
      <textarea value={reply} onChange={(e) => setReply(e.target.value.slice(0, 1500))} rows={2} placeholder="رد للمالك (اختياري) — يظهر له عند متابعة التذكرة" style={{ ...S.inp, width: "100%", marginTop: 10, resize: "vertical", lineHeight: 1.8 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
        <input value={inq} onChange={(e) => setInq(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="رقم الاستفسار" title="رقم الاستفسار بالموقع لو حوّلت التذكرة" style={{ ...S.inp, width: 118, padding: "7px 10px" }} />
        {dirty && <button type="button" style={{ ...S.btn, ...S.pri }} onClick={() => patch(null)}>حفظ</button>}
        {r.status !== "review" && <button type="button" style={S.btn} onClick={() => patch("review")}>قيد المراجعة</button>}
        {r.status !== "converted" && <button type="button" style={{ ...S.btn, borderColor: "#2E7D5B", color: "#2E7D5B" }} onClick={() => patch("converted")}>تمت: حُوّلت لاستفسار</button>}
        {r.status !== "closed" && <button type="button" style={S.btn} onClick={() => patch("closed")}>تمت: إغلاق</button>}
        {r.status !== "new" && <button type="button" style={S.btn} onClick={() => patch("new")}>إرجاع لـ«لم تُراجع»</button>}
        <span style={{ marginInlineStart: "auto", display: "inline-flex", gap: 2 }}>
          <button type="button" title="نسخ نص التذكرة" style={{ ...S.btn, border: 0, padding: 7 }} onClick={async () => { try { await navigator.clipboard.writeText(`[${r.ticket_no} · فيلا ${r.villa} · ${TICKET_KINDS[r.kind]}]\n${r.body}`); flashToast("نُسخ النص"); } catch { flashToast("تعذّر النسخ"); } }}><Copy size={16} /></button>
          <button type="button" title="حذف التذكرة" style={{ ...S.btn, border: 0, padding: 7, color: "#A8443C" }} onClick={() => onDelete(r)}><Trash2 size={16} /></button>
        </span>
      </div>
    </div>
  );
}

export function ATicketsTab({ flashToast, log, canManage }) {
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState(null);       // null = تحميل · "missing" = الهجرة ما اشتغلت
  const [loading, setLoading] = useState(true);
  const [flt, setFlt] = useState("open");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(30);

  const load = async () => {
    const { data, error } = await supabase.from("owner_tickets").select("*").order("created_at", { ascending: false });
    if (!error) setRows(data || []);
    setLoading(false);
  };
  const loadMode = async () => {
    const { data, error } = await supabase.from("site_settings").select("tickets_mode").eq("id", 1).single();
    setMode(error || !data ? "missing" : data.tickets_mode || "all");
  };
  useEffect(() => {
    load(); loadMode();
    const ch = supabase.channel("admin-owner-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "owner_tickets" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const counts = useMemo(() => ({
    open: rows.filter((r) => r.status === "new").length,
    review: rows.filter((r) => r.status === "review").length,
    done: rows.filter((r) => isDone(r.status)).length,
    all: rows.length,
  }), [rows]);
  const list = useMemo(() => {
    const t = q.trim().toUpperCase().replace(/^T-?/, "");
    return rows.filter((r) => (flt === "all" || (flt === "open" && r.status === "new") || (flt === "review" && r.status === "review") || (flt === "done" && isDone(r.status)))
      && (kind === "all" || r.kind === kind)
      && (!t || String(r.villa) === t || r.ticket_no.includes(t) || r.body.includes(q.trim())));
  }, [rows, flt, kind, q]);

  if (!canManage) return <div style={S.wrap}><div style={S.card}>هذا القسم يحتاج صلاحية «إدارة تذاكر الملاك».</div></div>;
  if (mode === "missing") return <div style={S.wrap} dir="rtl"><div style={S.card}>الخاصية تحتاج تجهيز قاعدة البيانات مرة واحدة: شغّل ملف <b>migration-owner-tickets.sql</b> ثم حدّث الصفحة.</div></div>;

  const saveMode = async (m) => {
    if (m === mode) return;
    const { error } = await supabase.from("site_settings").update({ tickets_mode: m }).eq("id", 1);
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); return; }
    setMode(m); flashToast("تم الحفظ"); log("تذاكر الملاك", `استقبال التذاكر: ${MODES.find((x) => x[0] === m)[1]}`);
  };
  const onSave = async (r, p) => {
    const { error } = await supabase.from("owner_tickets").update(p).eq("id", r.id);
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); return; }
    setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
    flashToast(p.status ? `${r.ticket_no}: ${TICKET_STATUS[p.status].short}` : "تم الحفظ");
    log("تذاكر الملاك", `${r.ticket_no} (فيلا ${r.villa})${p.status ? ` ← ${TICKET_STATUS[p.status].short}` : " — تحديث الرد"}${p.inquiry_id ? ` · استفسار ${p.inquiry_id}` : ""}`);
  };
  const onDelete = async (r) => {
    if (!window.confirm(`حذف التذكرة ${r.ticket_no} (فيلا ${r.villa}) نهائيًا؟`)) return;
    const { error } = await supabase.from("owner_tickets").delete().eq("id", r.id);
    if (error) { flashToast(`تعذّر الحذف: ${error.message}`); return; }
    setRows((xs) => xs.filter((x) => x.id !== r.id)); flashToast("تم الحذف");
    log("تذاكر الملاك", `حذف ${r.ticket_no} (فيلا ${r.villa})`);
  };
  const exportXlsx = (src, label) => {
    const data = src.map((r) => ({
      "رقم التذكرة": r.ticket_no, "رقم الفيلا": r.villa, "مؤكدة": r.verified ? "نعم" : "لا", "النوع": TICKET_KINDS[r.kind],
      "الحالة": (TICKET_STATUS[r.status] || TICKET_STATUS.new).short, "النص": r.body, "رد الإدارة": r.admin_reply || "",
      "رقم الاستفسار": r.inquiry_id || "", "تاريخ الإرسال": fmt(r.created_at), "آخر تحديث": fmt(r.updated_at),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 13 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 70 }, { wch: 40 }, { wch: 13 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, "تذاكر الملاك");
    XLSX.writeFile(wb, `alborada_owner_tickets_${new Date().toISOString().slice(0, 10)}.xlsx`);
    log("تذاكر الملاك", `استخراج إكسل (${label}: ${src.length})`);
  };

  return (
    <div style={S.wrap} dir="rtl">
      <div style={S.card}>
        <h3 style={S.h}><Inbox size={17} />تذاكر الملاك</h3>
        <p style={S.sub}>كل مالك يرسل استفساره أو مقترحه من الموقع برقم فيلته ويستلم رقم تذكرة. التذكرة توصلك هنا فقط، وما تنزل بالموقع إلا لو سجلتها أنت كاستفسار.</p>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>استقبال التذاكر</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MODES.map(([k, t, d]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => saveMode(k)} style={{ ...S.btn, flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "9px 13px", borderWidth: 2, borderColor: mode === k ? "#1B7F8E" : "#E1E8EC", background: mode === k ? "#1B7F8E10" : "#fff" }}>
              <b style={{ fontSize: 13, color: mode === k ? "#1B7F8E" : "#1F2C35" }}>{t}</b><span style={{ fontSize: 11.5, color: "#5F7280" }}>{d}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...S.card, paddingBottom: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setFlt(k); setLimit(30); }} style={{ ...S.btn, ...(flt === k ? S.pri : {}) }}>{l} <b>{counts[k]}</b></button>
          ))}
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...S.inp, padding: "7px 10px" }} aria-label="النوع">
            <option value="all">كل الأنواع</option><option value="inquiry">استفسار</option><option value="suggestion">مقترح</option>
          </select>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <Search size={15} style={{ position: "absolute", insetInlineStart: 10, top: 11, color: "#5F7280" }} />
            <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(30); }} placeholder="ابحث برقم الفيلا، رقم التذكرة، أو كلمة" style={{ ...S.inp, width: "100%", paddingInlineStart: 32 }} />
          </div>
          <button type="button" style={S.btn} disabled={!list.length} onClick={() => exportXlsx(list, "المعروض")}><Download size={15} />استخراج المعروض</button>
          <button type="button" style={S.btn} disabled={!rows.length} onClick={() => exportXlsx(rows, "الكل")}><Download size={15} />استخراج الكل</button>
        </div>
      </div>

      {loading ? <div style={S.sub}>جارٍ التحميل…</div> : !list.length ? (
        <div style={{ ...S.card, textAlign: "center", color: "#5F7280", fontSize: 13.5 }}>{rows.length ? "لا تذاكر بهذا الفرز." : "ما وصلت أي تذكرة بعد."}</div>
      ) : list.slice(0, limit).map((r) => <TicketCard key={r.id} r={r} onSave={onSave} onDelete={onDelete} flashToast={flashToast} />)}
      {list.length > limit && <button type="button" style={S.btn} onClick={() => setLimit((n) => n + 40)}>عرض المزيد ({list.length - limit} باقي)</button>}
    </div>
  );
}
