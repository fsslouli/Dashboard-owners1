/* ticket-kit.jsx — تذاكر الملاك (6.14.0)
   المالك يرسل استفساره أو مقترحه برقم فيلته ويستلم رقم تذكرة (T-123456)، ويتابعها لاحقًا برقم التذكرة + رقم الفيلا.
   التذكرة تروح للوحة الإدارة ← «تذاكر الملاك» وما تنزل بالموقع إلا لو الإدارة حوّلتها لاستفسار.
   الإرسال والمتابعة عبر دالتين بقاعدة البيانات (ticket_submit / ticket_status) — راجع migration-owner-tickets.sql. */
import { useEffect, useState } from "react";
import { Check, Copy, MessageSquarePlus, Search, Send, X } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";
import { THEMES } from "./site-data.jsx";

export const TICKET_KINDS = { inquiry: "استفسار", suggestion: "مقترح" };
export const TICKET_STATUS = {
  new: { ar: "جديدة — لم تُراجع بعد", short: "جديدة", color: "#B7791F" },
  review: { ar: "قيد المراجعة", short: "قيد المراجعة", color: "#1B7F8E" },
  converted: { ar: "تمت — حُوّلت إلى استفسار في الموقع", short: "حُوّلت لاستفسار", color: "#2E7D5B" },
  closed: { ar: "تمت — أُغلقت", short: "مغلقة", color: "#5F7280" },
};
const digits = (s) => String(s ?? "")
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
const deviceId = () => {
  try {
    let d = localStorage.getItem("tk_device");
    if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem("tk_device", d); }
    return d;
  } catch { return ""; }
};
const fmt = (v) => (v ? new Date(v).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "long", year: "numeric" }) : "");
const ERR = {
  closed: "استقبال التذاكر متوقف حاليًا.",
  login_required: "الإرسال متاح للملاك بعد تسجيل الدخول برقم الفيلا.",
  bad_villa: "اكتب رقم فيلا صحيح (من 1 إلى 596).",
  bad_body: "اكتب نص الاستفسار أو المقترح (10 أحرف على الأقل، و2000 على الأكثر).",
  rate: "وصلت الحد المسموح من التذاكر حاليًا — حاول لاحقًا.",
};

function useDark() {
  const [d, setD] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)"); if (!mq) return undefined;
    const h = (e) => setD(e.matches); mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return d;
}

/* villa: رقم الفيلا لو المالك مسجّل دخول (يُقفل الحقل) · raised: فيه شارة حساب تحت الزر فنرفعه */
export function TicketLauncher({ villa = null, raised = false }) {
  const T = useDark() ? THEMES.dark : THEMES.light;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("send");
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => { const h = () => setNarrow(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const [v, setV] = useState(villa ? String(villa) : "");
  const [kind, setKind] = useState("inquiry");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);       // { ticket, villa }
  const [copied, setCopied] = useState(false);
  const [tNo, setTNo] = useState("");
  const [tVilla, setTVilla] = useState(villa ? String(villa) : "");
  const [found, setFound] = useState(null);
  useEffect(() => { if (villa) { setV(String(villa)); setTVilla(String(villa)); } }, [villa]);
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open]);

  const send = async (e) => {
    e.preventDefault();
    const vn = Number(digits(v).trim());
    if (!Number.isInteger(vn) || vn < 1 || vn > 596) { setErr(ERR.bad_villa); return; }
    if (body.trim().length < 10) { setErr(ERR.bad_body); return; }
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabase.rpc("ticket_submit", { p_villa: vn, p_kind: kind, p_body: body.trim(), p_device: deviceId() });
      if (error || !data) setErr("تعذّر الإرسال الآن — حاول بعد قليل.");
      else if (data.state === "ok") { setDone({ ticket: data.ticket, villa: data.villa }); setBody(""); setTNo(data.ticket); setTVilla(String(data.villa)); }
      else setErr(ERR[data.state] || "تعذّر الإرسال — راجع البيانات وحاول.");
    } catch { setErr("تعذّر الاتصال — تأكد من الإنترنت ثم حاول."); }
    setBusy(false);
  };
  const track = async (e) => {
    e.preventDefault();
    let no = digits(tNo).trim().toUpperCase(); if (/^[0-9]{6}$/.test(no)) no = `T-${no}`;
    const vn = Number(digits(tVilla).trim());
    if (!/^T-[0-9]{6}$/.test(no) || !Number.isInteger(vn)) { setErr("اكتب رقم التذكرة (مثل T-123456) ورقم الفيلا."); return; }
    setBusy(true); setErr(""); setFound(null);
    try {
      const { data, error } = await supabase.rpc("ticket_status", { p_ticket: no, p_villa: vn });
      if (error || !data) setErr("تعذّر الاستعلام الآن — حاول بعد قليل.");
      else if (data.state === "ok") setFound(data);
      else setErr("ما لقينا تذكرة بهذا الرقم لهذه الفيلا.");
    } catch { setErr("تعذّر الاتصال — تأكد من الإنترنت ثم حاول."); }
    setBusy(false);
  };

  const inp = { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 11, border: `1px solid ${T.line}`, fontSize: 15, outline: "none", background: T.sunken, color: T.paper, fontFamily: "inherit" };
  const lab = { fontSize: 12.5, color: T.muted, display: "block", margin: "12px 0 6px" };
  const seg = (on) => ({ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "18" : "transparent", color: on ? T.brass : T.paper, fontSize: 13.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit" });
  const pri = { width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 12, border: "none", background: T.brass, color: T.onAccent || "#fff", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "inherit" };
  const st = found ? TICKET_STATUS[found.status] || TICKET_STATUS.new : null;

  return (
    <>
      <button type="button" className="no-print" onClick={() => { setOpen(true); setErr(""); }} aria-label="أرسل استفسارك أو مقترحك"
        style={{ position: "fixed", insetInlineStart: 12, bottom: `calc(${(narrow ? 92 : 14) + (raised ? 50 : 0)}px + env(safe-area-inset-bottom, 0px))`, zIndex: 60, display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.paper, boxShadow: T.shadowUp, fontFamily: "system-ui, sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        <MessageSquarePlus size={16} color={T.brass} />أرسل استفسارك
      </button>
      {open && (
        <div dir="rtl" role="dialog" aria-modal="true" aria-label="تذاكر الملاك" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 2147482000, background: "rgba(8,12,16,.55)", display: "flex", alignItems: narrow ? "flex-end" : "center", justifyContent: "center", padding: narrow ? 0 : 20, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", background: T.surface, color: T.paper, borderRadius: narrow ? "20px 20px 0 0" : 20, border: `1px solid ${T.line}`, padding: "20px 20px calc(22px + env(safe-area-inset-bottom, 0px))", boxShadow: T.shadowUp }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <b style={{ fontSize: 16 }}>استفسارات ومقترحات الملاك</b>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" style={{ width: 34, height: 34, border: "none", background: "transparent", color: T.muted, cursor: "pointer", display: "grid", placeItems: "center" }}><X size={19} /></button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <button type="button" style={seg(tab === "send")} onClick={() => { setTab("send"); setErr(""); }}>إرسال جديد</button>
              <button type="button" style={seg(tab === "track")} onClick={() => { setTab("track"); setErr(""); }}>متابعة تذكرة</button>
            </div>

            {tab === "send" && done && (
              <div style={{ textAlign: "center", padding: "18px 0 4px" }}>
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2E7D5B22", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Check size={26} color="#2E7D5B" /></div>
                <div style={{ fontSize: 14, color: T.muted }}>تم الاستلام — رقم تذكرتك</div>
                <div dir="ltr" style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, margin: "6px 0 4px", fontFamily: "ui-monospace, monospace" }}>{done.ticket}</div>
                <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.9 }}>فيلا {done.villa} · احتفظ بالرقم لمتابعة التذكرة. يراجعها فريق تمثيل الملاك، ولو اعتُمدت تُرفع لمدير المشروع وتظهر ضمن الاستفسارات.</div>
                <button type="button" style={{ ...pri, background: "transparent", color: T.paper, border: `1px solid ${T.line}` }} onClick={async () => { try { await navigator.clipboard.writeText(done.ticket); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ } }}><Copy size={16} />{copied ? "تم النسخ" : "نسخ رقم التذكرة"}</button>
                <button type="button" style={{ ...pri, marginTop: 10 }} onClick={() => setDone(null)}>إرسال تذكرة أخرى</button>
              </div>
            )}

            {tab === "send" && !done && (
              <form onSubmit={send}>
                <label style={lab} htmlFor="tk-villa">رقم الفيلا</label>
                <input id="tk-villa" value={v} disabled={!!villa} onChange={(e) => { setV(digits(e.target.value).replace(/\D/g, "").slice(0, 3)); setErr(""); }} inputMode="numeric" dir="ltr" placeholder="مثال: 120" style={{ ...inp, textAlign: "center", letterSpacing: 2, opacity: villa ? 0.75 : 1 }} />
                <label style={lab}>النوع</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.entries(TICKET_KINDS).map(([k, l]) => <button key={k} type="button" style={seg(kind === k)} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
                </div>
                <label style={lab} htmlFor="tk-body">{kind === "inquiry" ? "اكتب استفسارك" : "اكتب مقترحك"}</label>
                <textarea id="tk-body" value={body} onChange={(e) => { setBody(e.target.value.slice(0, 2000)); setErr(""); }} rows={5} placeholder="اذكر المكان (مثل: الدور الأرضي، السطح) ووصف الملاحظة بوضوح." style={{ ...inp, resize: "vertical", lineHeight: 1.8, minHeight: 120 }} />
                <div style={{ fontSize: 11.5, color: T.faint || T.muted, textAlign: "end", marginTop: 4 }}>{body.length} / 2000</div>
                {err && <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.7, color: "#C0392B", marginTop: 6 }}>{err}</div>}
                <button type="submit" disabled={busy} style={pri}><Send size={16} />{busy ? "جارٍ الإرسال…" : "إرسال"}</button>
                <p style={{ fontSize: 11.5, lineHeight: 1.8, color: T.faint || T.muted, margin: "12px 0 0", textAlign: "center" }}>تذكرتك تصل لفريق تمثيل الملاك فقط، ولا تُنشر في الموقع قبل مراجعتها.</p>
              </form>
            )}

            {tab === "track" && (
              <form onSubmit={track}>
                <label style={lab} htmlFor="tk-no">رقم التذكرة</label>
                <input id="tk-no" value={tNo} onChange={(e) => { setTNo(e.target.value.slice(0, 9)); setErr(""); }} dir="ltr" placeholder="T-123456" style={{ ...inp, textAlign: "center", letterSpacing: 2 }} />
                <label style={lab} htmlFor="tk-tv">رقم الفيلا</label>
                <input id="tk-tv" value={tVilla} disabled={!!villa} onChange={(e) => { setTVilla(digits(e.target.value).replace(/\D/g, "").slice(0, 3)); setErr(""); }} inputMode="numeric" dir="ltr" style={{ ...inp, textAlign: "center", letterSpacing: 2, opacity: villa ? 0.75 : 1 }} />
                {err && <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.7, color: "#C0392B", marginTop: 8 }}>{err}</div>}
                <button type="submit" disabled={busy} style={pri}><Search size={16} />{busy ? "جارٍ البحث…" : "عرض الحالة"}</button>
                {found && (
                  <div style={{ marginTop: 16, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b dir="ltr" style={{ fontFamily: "ui-monospace, monospace", fontSize: 15 }}>{found.ticket}</b>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: st.color + "22", color: st.color }}>{st.ar}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>{TICKET_KINDS[found.kind]} · أُرسلت {fmt(found.created_at)}</div>
                    {found.inquiry_id && <div style={{ fontSize: 13, marginTop: 8 }}>سُجّلت في الموقع كاستفسار رقم <b>{found.inquiry_id}</b>.</div>}
                    {found.reply && <div style={{ fontSize: 13.5, lineHeight: 1.9, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, whiteSpace: "pre-wrap" }}><span style={{ color: T.muted, fontSize: 12 }}>رد فريق تمثيل الملاك:</span><br />{found.reply}</div>}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
