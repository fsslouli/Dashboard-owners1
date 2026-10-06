/* ═══════════════════════════════════════════════════════════
   تحديث قروب الملاك على تليجرام (٥.٣.٠) — لوحة الإدارة، تبويب «الإشعارات».

   جاهز برمجيًا وغير مفعّل حتى يُضبط البوت (README ← «بوت تليجرام»):
   قبل الإعداد البطاقة تعرض «غير مفعّل بعد» وزر النشر معطّل.
   النشر يدوي دائمًا: نص مقترح من البيانات الحالية ← الأدمن يراجعه ويعدّله
   ← «نشر في القروب» ← «تأكيد النشر الآن». ما فيه أي نشر تلقائي.
   الاتصال بتليجرام كله من الدالة telegram-notify (مفتاح البوت ما يوصل للمتصفح).
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";
import { useSystemTheme } from "./admin-core.jsx";
import { aNoteStyle } from "./admin-excel-utils.jsx";
import { MONTH_AR } from "./site-data.jsx";

const FN = "telegram-notify";
const MAX_LEN = 4000;
const STATE_TEXT = {
  checking: "جارٍ فحص الربط…",
  not_deployed: "غير مفعّل بعد — البوت جاهز برمجيًا وينتظر الإعداد (README ← «بوت تليجرام»).",
  not_configured: "الدالة منشورة لكن ينقصها مفتاح البوت أو رقم القروب (أسرار Supabase).",
  bad_token: "مفتاح البوت غير صحيح — راجع TELEGRAM_BOT_TOKEN.",
  chat_unreachable: "البوت ما يوصل للقروب — تأكد إنه مضاف للقروب وإن رقم القروب صحيح.",
  forbidden: "حسابك ما عنده صلاحية «الإشعارات» اللازمة للنشر.",
  error: "تعذّر فحص الربط الحين — جرّب «فحص الربط» بعد شوي.",
};

const isClosed = (r) => r && (r.closed === true || ["نعم", "مقفل", "مغلق", "مقفلة", "مغلقة"].includes(String(r.closed || "").trim()));
const fmtPct = (v) => (v == null || v === "" || !Number.isFinite(+v) ? null : `${(+v).toFixed(2)}٪`);

/* نص مقترح هادئ من البيانات الحالية — يُعدَّل بحرية قبل النشر */
export function composeUpdate(inquiries, pgRow, siteUrl, now = new Date()) {
  const all = inquiries || [];
  const closed = all.filter(isClosed).length;
  const lines = [`تحديث لوحة متابعة الملاك — ${now.getDate()} ${MONTH_AR[now.getMonth()]} ${now.getFullYear()}`, ""];
  lines.push(`• الاستفسارات: ${all.length} — مقفلة ${closed} · قيد المتابعة ${all.length - closed}`);
  const ph = pgRow && pgRow.phases;
  const mk = /^(\d{4})-(\d{2})$/.exec(String((pgRow && pgRow.month) || ""));
  if (ph && mk) {
    const total = fmtPct(ph.total);
    if (total) lines.push(`• تقدّم التنفيذ (${MONTH_AR[+mk[2] - 1]} ${mk[1]}): ${total} لإجمالي المشروع`);
    const parts = [["p1", "الأولى"], ["p2", "الثانية"], ["p3", "الثالثة"], ["p4", "الرابعة"]]
      .map(([k, n]) => (fmtPct(ph[k]) ? `${n} ${fmtPct(ph[k])}` : null)).filter(Boolean);
    if (parts.length) lines.push(`   المراحل: ${parts.join(" · ")}`);
  }
  lines.push("", "التفاصيل كاملة على الموقع:", siteUrl);
  return lines.join("\n");
}

export function ATelegramCard({ inquiries, flashToast, log }) {
  const T = useSystemTheme();
  const [st, setSt] = useState({ state: "checking" });
  const [pgRow, setPgRow] = useState(null);
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const siteUrl = `${window.location.origin}${window.location.pathname}`;

  const check = async () => {
    setSt({ state: "checking" });
    try {
      const { data, error } = await supabase.functions.invoke(FN, { body: { action: "status" } });
      if (error) {
        const code = error.context && error.context.status;
        setSt({ state: code === 403 ? "forbidden" : !code || code === 404 ? "not_deployed" : "error" });
        return;
      }
      setSt(data && data.state ? data : { state: "error" });
    } catch (e) { setSt({ state: "not_deployed" }); }
  };
  useEffect(() => { check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    supabase.from("progress_matrix_v").select("month,phases").order("month", { ascending: false }).limit(1)
      .then(({ data }) => setPgRow((data && data[0]) || null));
  }, []);

  const draft = useMemo(() => composeUpdate(inquiries, pgRow, siteUrl), [inquiries, pgRow, siteUrl]);
  useEffect(() => { if (!touched) setText(draft); }, [draft, touched]);

  const ready = st.state === "ready";
  const tooLong = text.length > MAX_LEN;
  const canSend = ready && !sending && !!text.trim() && !tooLong;

  const send = async () => {
    if (!canSend) return;
    if (!confirm) { setConfirm(true); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(FN, { body: { action: "send", text: text.trim() } });
      if (error || !data || !data.ok) throw new Error("send failed");
      flashToast("تم النشر في قروب الملاك");
      if (log) log("نشر تحديث في قروب تليجرام", text.trim().split("\n")[0].slice(0, 120));
      setConfirm(false); setTouched(false);
    } catch (e) { flashToast("تعذّر النشر — ما وصلت الرسالة للقروب"); }
    setSending(false);
  };

  const btn = (primary, on = true) => ({
    display: "flex", alignItems: "center", gap: 7, border: `1px solid ${primary ? "transparent" : T.line}`, borderRadius: 11,
    padding: "9px 14px", fontSize: 12.5, fontFamily: "inherit", cursor: on ? "pointer" : "default", opacity: on ? 1 : 0.5,
    background: primary ? T.brass : T.surface, color: primary ? T.onAccent || "#fff" : T.paper,
  });

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Send size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>تحديث قروب الملاك (تليجرام)</span>
      </div>
      <div style={{ ...aNoteStyle(T, ready ? T.paper : undefined), marginBottom: 12 }}>
        {ready ? `جاهز للنشر — القروب: ${st.chat || "—"}${st.bot ? ` · البوت: @${st.bot}` : ""}` : (STATE_TEXT[st.state] || STATE_TEXT.error)}
      </div>
      <textarea value={text} dir="rtl" rows={9} aria-label="نص التحديث"
        onChange={(e) => { setText(e.target.value); setTouched(true); setConfirm(false); }}
        style={{ width: "100%", boxSizing: "border-box", background: T.bg, color: T.paper, border: `1px solid ${tooLong ? "#C0392B" : T.line}`, borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.8, fontFamily: "inherit", resize: "vertical" }} />
      <div style={{ fontSize: 11.5, color: tooLong ? "#C0392B" : T.muted, margin: "6px 2px 12px" }}>
        {text.length} / {MAX_LEN} حرف — راجع النص وعدّله قبل النشر، ما يُنشر شي تلقائيًا.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={send} disabled={!canSend} style={btn(true, canSend)}>
          <Send size={14} /> {sending ? "جارٍ النشر…" : confirm ? "تأكيد النشر الآن" : "نشر في القروب"}
        </button>
        {confirm && !sending && <button onClick={() => setConfirm(false)} style={btn(false)}>إلغاء</button>}
        <button onClick={() => { setTouched(false); setText(draft); setConfirm(false); }} style={btn(false)}>
          <RefreshCw size={14} /> تعبئة من البيانات الحالية
        </button>
        <button onClick={check} style={btn(false)}>فحص الربط</button>
      </div>
    </div>
  );
}
