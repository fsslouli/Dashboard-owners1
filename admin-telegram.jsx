/* ═══════════════════════════════════════════════════════════
   تحديث قروب الملاك على تليجرام (٥.٣.٠) — لوحة الإدارة، تبويب «الإشعارات».
   ٧.٢.٠: قوالب جاهزة (تقدم الشهر · تحديث الموقع · جمع الملاحظات) تتعبّى من بيانات الموقع،
   مع فوتر ثابت في آخر كل رسالة. اختيار القالب يعبّي النص فقط — ما يُرسل شي إلا بـ«نشر» ثم «تأكيد».

   جاهز برمجيًا وغير مفعّل حتى يُضبط البوت (README ← «بوت تليجرام»):
   قبل الإعداد البطاقة تعرض «غير مفعّل بعد» وزر النشر معطّل.
   النشر يدوي دائمًا: نص مقترح من البيانات الحالية ← الأدمن يراجعه ويعدّله
   ← «نشر في القروب» ← «تأكيد النشر الآن». ما فيه أي نشر تلقائي.
   الاتصال بتليجرام كله من الدالة telegram-notify (مفتاح البوت ما يوصل للمتصفح).
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { Paperclip, RefreshCw, Send, X } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";
import { useSystemTheme } from "./admin-core.jsx";
import { aNoteStyle } from "./admin-excel-utils.jsx";
import { MONTH_AR } from "./site-data.jsx";

const FN = "telegram-notify";
const MAX_LEN = 4000;
const LIMIT_B = 1280 * 1024 * 1024; /* سقف الشهر: 1.25 جيجا */
const LIMIT_GB = "1.25";
const MAX_FILE = 20 * 1024 * 1024; /* حد الإرفاق: يمر للتليجرام مباشرة ولا يُحفظ عندنا */
const STATE_TEXT = {
  checking: "جارٍ فحص الربط…",
  not_deployed: "دالة البوت غير منشورة على الخادم بعد.",
  not_configured: "البوت غير مربوط بعد — اتبع خطوات الإعداد بالأسفل (دقيقتين).",
  need_chat: "المفتاح صحيح — باقي تحديد قروب الملاك (الخطوة ٢ بالأسفل).",
  bad_token: "مفتاح البوت غير صحيح — انسخه من جديد من BotFather.",
  chat_unreachable: "البوت ما يوصل للقروب — تأكد إنه مضاف للقروب وإن رقم القروب صحيح.",
  forbidden: "حسابك ما عنده صلاحية «الإشعارات» اللازمة للنشر.",
  error: "تعذّر فحص الربط الحين — جرّب «فحص الربط» بعد شوي.",
};

const isClosed = (r) => r && (r.closed === true || ["نعم", "مقفل", "مغلق", "مقفلة", "مغلقة"].includes(String(r.closed || "").trim()));
const fmtPct = (v) => (v == null || v === "" || !Number.isFinite(+v) ? null : `${(+v).toFixed(2)}٪`);

/* ═══ ٧.٢.٠ — الفوتر الثابت والقوالب. صوت البوت: رسالة آلية وليست بيانًا رسميًا. ═══ */
export const tgFooter = (siteUrl) => `🔗 التفاصيل في الموقع:\n${siteUrl}\n\n🤖 نشرة ملاك ألبورادا — رسالة آلية من بوت`;
const pct = (v) => (v == null || v === "" || !Number.isFinite(+v) ? null : `${(+v).toFixed(2)}%`);
const riyadhDate = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

/* ١) تقدم المشروع — من آخر شهرين في progress_matrix_v (rows[0] الأحدث). null لو ما فيه بيانات. */
export function tplProgress(rows, siteUrl) {
  const cur = rows && rows[0];
  const total = pct(cur && cur.phases && cur.phases.total);
  const mk = /^(\d{4})-(\d{2})$/.exec(String((cur && cur.month) || ""));
  if (!cur || !total || !mk) return null;
  const prev = pct(rows[1] && rows[1].phases && rows[1].phases.total);
  const L = [`📊 تقدم المشروع — ${MONTH_AR[+mk[2] - 1]} ${mk[1]}`, "", "حسب تقرير المطور الأخير:",
    `• متوسط الإنجاز العام: ${total}${prev ? ` (الشهر الماضي ${prev})` : ""}`];
  const bl = Object.entries(cur.blocks || {}).map(([b, v]) => [b, +v]).filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1]);
  if (bl.length >= 2) {
    L.push(`• الأعلى تقدماً: بلوك ${bl[0][0]} بنسبة ${pct(bl[0][1])}`);
    L.push(`• الأقل تقدماً: بلوك ${bl[bl.length - 1][0]} بنسبة ${pct(bl[bl.length - 1][1])}`);
  }
  L.push("", tgFooter(siteUrl));
  return L.join("\n");
}

/* ٢) تحديث الموقع — عدد البنود (الجديدة/المعدّلة/المقفلة) منذ آخر إشعار، وإلا آخر ٧ أيام.
   last_modified بالأيام فقط، فنحسب من يوم آخر إشعار نفسه (>=) كي ما يختفي تحديث صار بعده بنفس اليوم. */
export function countUpdates(inquiries, lastNoticeAt, now = new Date()) {
  const since = lastNoticeAt ? riyadhDate(lastNoticeAt) : riyadhDate(new Date(now.getTime() - 7 * 86400000));
  return (inquiries || []).filter((r) => String(r.last_modified || r.lastModified || "").slice(0, 10) >= since).length;
}
export const tplSiteUpdate = (count, siteUrl) => `🔄 تم تحديث الموقع\n\nعدد البنود المحدّثة: ${count}\n\n${tgFooter(siteUrl)}`;

/* ٣) جمع الملاحظات — نص ثابت بلا تواريخ ولا متغيرات */
export const tplCollect = (siteUrl) => `📝 جمع ملاحظات الملاك\n\nيجري تجهيز جدول اجتماع قريب مع المطور. لإضافة ملاحظة أو استفسار أو اقتراح، أرسلها هنا في القروب أو خاص لأحد الممثلين قبل موعد الاجتماع.\n\nكل ما يصل يتم مراجعته وإدراجه في جدول الاجتماع.\n\n${tgFooter(siteUrl)}`;

/* نص مقترح هادئ من البيانات الحالية — يُعدَّل بحرية قبل النشر */
export function composeUpdate(inquiries, pgRow, siteUrl, now = new Date()) {
  const all = inquiries || [];
  const closed = all.filter(isClosed).length;
  const lines = [`تحديث لوحة متابعة الملاك — ${now.getDate()} ${MONTH_AR[now.getMonth()]} ${now.getFullYear()}`, ""];
  lines.push(`• الاستفسارات: ${all.length} — مقفلة ${closed} · قيد المتابعة ${all.length - closed}`);
  /* ملخص الأسبوع: ما أُضيف أو تحدّث خلال آخر ٧ أيام */
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const fresh = all.filter((r) => String(r.last_modified || r.lastModified || "").slice(0, 10) >= weekAgo);
  if (fresh.length) {
    const freshClosed = fresh.filter(isClosed).length;
    lines.push(`• الجديد خلال آخر 7 أيام: ${fresh.length} استفسار مضاف أو محدّث${freshClosed ? ` (منها ${freshClosed} أُقفلت)` : ""}`);
  }
  const ph = pgRow && pgRow.phases;
  const mk = /^(\d{4})-(\d{2})$/.exec(String((pgRow && pgRow.month) || ""));
  if (ph && mk) {
    const total = fmtPct(ph.total);
    if (total) lines.push(`• تقدّم التنفيذ (${MONTH_AR[+mk[2] - 1]} ${mk[1]}): ${total} لإجمالي المشروع`);
    const parts = [["p1", "الأولى"], ["p2", "الثانية"], ["p3", "الثالثة"], ["p4", "الرابعة"]]
      .map(([k, n]) => (fmtPct(ph[k]) ? `${n} ${fmtPct(ph[k])}` : null)).filter(Boolean);
    if (parts.length) lines.push(`   المراحل: ${parts.join(" · ")}`);
  }
  lines.push("", tgFooter(siteUrl));
  return lines.join("\n");
}

export function ATelegramCard({ inquiries, flashToast, log }) {
  const T = useSystemTheme();
  const [st, setSt] = useState({ state: "checking" });
  const [pgRows, setPgRows] = useState([]);
  const [tpl, setTpl] = useState(null); /* progress | site | collect | general */
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState(null);
  const siteUrl = window.location.origin;

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
    supabase.from("progress_matrix_v").select("month,phases,blocks").order("month", { ascending: false }).limit(2)
      .then(({ data }) => setPgRows(data || []));
  }, []);

  const lastNotice = st.last_notice_at || null;
  const updCount = useMemo(() => countUpdates(inquiries, lastNotice), [inquiries, lastNotice]);
  const draft = useMemo(() => {
    if (tpl === "progress") return tplProgress(pgRows, siteUrl) || "";
    if (tpl === "site") return tplSiteUpdate(updCount, siteUrl);
    if (tpl === "collect") return tplCollect(siteUrl);
    if (tpl === "general") return composeUpdate(inquiries, pgRows[0] || null, siteUrl);
    return "";
  }, [tpl, pgRows, inquiries, updCount, siteUrl]);
  useEffect(() => { if (!touched) setText(draft); }, [draft, touched]);
  const pickTpl = (k) => { setTpl(k); setTouched(false); setConfirm(false); };
  const noData = (tpl === "progress" && !draft) || (tpl === "site" && updCount === 0);

  /* إعداد البوت من اللوحة (٧.١.٠): لصق المفتاح ← اختيار القروب. المفتاح يُرسل للخادم مرة واحدة ولا يرجع. */
  const [tok, setTok] = useState("");
  const [chats, setChats] = useState(null);
  const [busy, setBusy] = useState("");
  const call = async (bodyArg) => {
    const { data, error } = await supabase.functions.invoke(FN, { body: bodyArg });
    if (error) throw error;
    return data || {};
  };
  const saveToken = async () => {
    setBusy("tok");
    try {
      const d = await call({ action: "setup_token", token: tok.trim() });
      if (d.ok) { setTok(""); setSt(d); flashToast(`تم ربط البوت @${d.bot}`); if (log) log("إعداد بوت تليجرام", `ربط البوت @${d.bot}`); }
      else flashToast("المفتاح غير صحيح — انسخه كاملًا من BotFather");
    } catch (e) { flashToast("تعذّر حفظ المفتاح"); }
    setBusy("");
  };
  const discover = async () => {
    setBusy("disc");
    try { const d = await call({ action: "discover" }); setChats(d.chats || []); if (d.bot) setSt((x) => ({ ...x, bot: d.bot })); }
    catch (e) { flashToast("تعذّر البحث عن القروبات"); }
    setBusy("");
  };
  const pickChat = async (c) => {
    setBusy("chat");
    try {
      const d = await call({ action: "set_chat", chat_id: c.id });
      if (d.ok) { flashToast(`تم اعتماد القروب: ${d.chat}`); if (log) log("إعداد بوت تليجرام", `اعتماد القروب: ${d.chat}`); setChats(null); await check(); }
      else flashToast("البوت ما يوصل لهذا القروب");
    } catch (e) { flashToast("تعذّر اعتماد القروب"); }
    setBusy("");
  };
  const disconnect = async () => {
    if (!window.confirm("فصل البوت؟ يُمسح المفتاح والقروب المحفوظان، وتقدر تربطه من جديد لاحقًا.")) return;
    try { await call({ action: "disconnect" }); if (log) log("إعداد بوت تليجرام", "فصل البوت"); setChats(null); await check(); } catch (e) { flashToast("تعذّر الفصل"); }
  };
  const needToken = st.state === "not_configured" || st.state === "bad_token";
  const needChat = st.state === "need_chat" || st.state === "chat_unreachable";

  const ready = st.state === "ready";
  const tooLong = text.length > MAX_LEN;
  const fileBig = !!file && file.size > MAX_FILE;
  const canSend = ready && !sending && (!!file || !!text.trim()) && !tooLong && !fileBig && (!!file || !noData);

  const send = async () => {
    if (!canSend) return;
    if (!confirm) { setConfirm(true); return; }
    setSending(true);
    try {
      let body = { action: "send", text: text.trim(), ...(tpl === "site" ? { mark: "site_update" } : {}) };
      if (file) {
        /* الملف يُرسل مع الطلب ويمر للتليجرام مباشرة — ما يُخزَّن في الموقع ولا في قاعدة البيانات */
        body = new FormData();
        body.append("action", "send_file"); body.append("text", text.trim()); body.append("file", file, file.name);
        if (tpl === "site") body.append("mark", "site_update");
      }
      const { data, error } = await supabase.functions.invoke(FN, { body });
      if (error || !data || !data.ok) {
        let info = null;
        try { info = await error?.context?.json?.(); } catch (_e) { /* ignore */ }
        if (info?.error === "monthly_limit") { flashToast(`ما يكفي المتبقي من سقف الشهر (${Math.floor((info.remaining || 0) / 1048576)} م.ب) — يتجدد أول الشهر`); setSending(false); return; }
        throw new Error("send failed");
      }
      if (file && data.bytes_used != null) setSt((x) => ({ ...x, bytes_used: data.bytes_used }));
      flashToast(file ? "تم نشر الملف في قروب الملاك" : "تم النشر في قروب الملاك");
      if (log) log(file ? "نشر ملف في قروب تليجرام" : "نشر تحديث في قروب تليجرام", `${file ? `[${file.name}] ` : ""}${text.trim().split("\n")[0].slice(0, 100)}`);
      setConfirm(false); setTouched(false); setTpl(null); setFile(null);
      if (tpl === "site") check();
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
      {(needToken || needChat) && (
        <div style={{ border: `1px dashed ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 13, lineHeight: 1.9 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>إعداد البوت</div>
          <div style={{ color: needToken ? T.paper : T.muted }}>
            <b>١) أنشئ البوت والصق مفتاحه:</b> افتح تليجرام ← ابحث عن <span dir="ltr">@BotFather</span> ← أرسل <span dir="ltr">/newbot</span> ← اكتب اسمًا (مثل «نشرة ملاك ألبورادا») ثم اسم مستخدم ينتهي بـ <span dir="ltr">bot</span> ← انسخ المفتاح اللي يعطيك والصقه هنا.
          </div>
          {needToken && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 4px" }}>
              <input value={tok} onChange={(e) => setTok(e.target.value)} type="password" dir="ltr" autoComplete="off" placeholder="123456789:AA…" aria-label="مفتاح البوت"
                style={{ flex: "1 1 220px", boxSizing: "border-box", background: T.bg, color: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 13, fontFamily: "ui-monospace, monospace" }} />
              <button onClick={saveToken} disabled={!tok.trim() || busy === "tok"} style={btn(true, !!tok.trim() && busy !== "tok")}>{busy === "tok" ? "جارٍ التحقق…" : "حفظ المفتاح"}</button>
            </div>
          )}
          <div style={{ color: needChat ? T.paper : T.muted, marginTop: 8 }}>
            <b>٢) أضف البوت لقروب الملاك:</b> من القروب ← إضافة عضو ← اسم البوت{st.bot ? <> (<span dir="ltr">@{st.bot}</span>)</> : ""}، وبعدها اضغط «ابحث عن القروب».
          </div>
          {needChat && (
            <div style={{ marginTop: 8 }}>
              <button onClick={discover} disabled={busy === "disc"} style={btn(true, busy !== "disc")}>{busy === "disc" ? "جارٍ البحث…" : "ابحث عن القروب"}</button>
              {chats && !chats.length && <div style={{ color: T.muted, fontSize: 12.5, marginTop: 8 }}>ما ظهر أي قروب. تأكد إنك أضفت البوت للقروب، ثم أعد البحث.</div>}
              {chats && chats.map((c) => (
                <button key={c.id} onClick={() => pickChat(c)} disabled={busy === "chat"} style={{ ...btn(false), marginTop: 8, width: "100%", justifyContent: "space-between" }}>
                  <span>{c.title || "بدون اسم"}</span><span style={{ color: T.muted, fontSize: 11.5 }}>اعتماد هذا القروب</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }} role="group" aria-label="قوالب الرسائل">
        {[["progress", "📊 تقدم الشهر"], ["site", "🔄 تحديث الموقع"], ["collect", "📝 جمع الملاحظات"], ["general", "ملخص عام"]].map(([k, label]) => (
          <button key={k} onClick={() => pickTpl(k)} aria-pressed={tpl === k}
            style={{ ...btn(tpl === k), padding: "7px 12px", fontSize: 12.5 }}>{label}</button>
        ))}
      </div>
      {tpl === "site" && (
        <div style={{ ...aNoteStyle(T, updCount === 0 ? "#C0392B" : undefined), marginBottom: 10 }}>
          {updCount === 0 ? "ما فيه بنود جديدة أو محدّثة منذ آخر إشعار — ما يُرسل شي."
            : `${updCount} بند منذ ${lastNotice ? "آخر إشعار (محسوبة بالأيام، تشمل تحديثات يوم آخر إشعار)" : "آخر 7 أيام (ما أُرسل إشعار قبل)"}.`}
        </div>
      )}
      {tpl === "progress" && !draft && <div style={{ ...aNoteStyle(T, "#C0392B"), marginBottom: 10 }}>ما فيه بيانات تقدم كافية لتعبئة هذا القالب.</div>}
      {!tpl && <div style={{ ...aNoteStyle(T), marginBottom: 10 }}>اختر قالبًا لتعبئة النص — ما يُرسل شي قبل «نشر» ثم «تأكيد».</div>}
      <textarea value={text} dir="rtl" rows={9} aria-label="نص التحديث"
        onChange={(e) => { setText(e.target.value); setTouched(true); setConfirm(false); }}
        style={{ width: "100%", boxSizing: "border-box", background: T.bg, color: T.paper, border: `1px solid ${tooLong ? "#C0392B" : T.line}`, borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.8, fontFamily: "inherit", resize: "vertical" }} />
      <div style={{ fontSize: 11.5, color: tooLong ? "#C0392B" : T.muted, margin: "6px 2px 12px" }}>
        {text.length} / {MAX_LEN} حرف — راجع النص وعدّله قبل النشر، ما يُنشر شي تلقائيًا.
      </div>
      <div style={{ ...aNoteStyle(T), marginBottom: 10 }}>
        <b>حدود الملفات:</b> سقف الشهر {LIMIT_GB} جيجا إجمالًا · الملف الواحد حتى 20 م.ب · بتجدّد أول كل شهر.
        {ready && st.bytes_used != null ? ` المتبقي هالشهر: ${Math.max(0, Math.round(((st.bytes_limit || LIMIT_B) - st.bytes_used) / 1048576))} م.ب من ${Math.round((st.bytes_limit || LIMIT_B) / 1048576)} م.ب.` : ""}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "0 0 12px" }}>
        <label style={{ ...btn(false), margin: 0 }}>
          <Paperclip size={14} /> إرفاق صورة أو ملف
          <input type="file" hidden onChange={(e) => { setFile(e.target.files?.[0] || null); setConfirm(false); e.target.value = ""; }} />
        </label>
        {file && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: fileBig ? "#C0392B" : T.muted }}>
            <span dir="ltr" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
            ({(file.size / 1048576).toFixed(1)} م.ب){fileBig ? " — أكبر من 20 م.ب" : ""}
            <button onClick={() => { setFile(null); setConfirm(false); }} aria-label="إزالة المرفق" style={{ background: "none", border: 0, color: T.muted, cursor: "pointer", padding: 2 }}><X size={14} /></button>
          </span>
        )}
      </div>
      {file && <div style={{ ...aNoteStyle(T), marginBottom: 10 }}>المرفق يمر لتليجرام مباشرة ولا يُحفظ في الموقع. {text.length > 1024 ? "النص أطول من 1024 حرف فيُرسل كرسالة مستقلة بعد الملف." : "النص يظهر كتعليق على الملف."}{st.can_send_files === false ? " ⚠️ البوت ما عنده صلاحية إرسال الملفات في القروب." : ""}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={send} disabled={!canSend} style={btn(true, canSend)}>
          <Send size={14} /> {sending ? "جارٍ النشر…" : confirm ? "تأكيد النشر الآن" : "نشر في القروب"}
        </button>
        {confirm && !sending && <button onClick={() => setConfirm(false)} style={btn(false)}>إلغاء</button>}
        <button onClick={() => { setTouched(false); setText(draft); setConfirm(false); }} style={btn(false, !!tpl)} disabled={!tpl}>
          <RefreshCw size={14} /> إعادة التعبئة من القالب
        </button>
        <button onClick={check} style={btn(false)}>فحص الربط</button>
        {(ready || needChat) && st.managed !== "env" && <button onClick={disconnect} style={btn(false)}>فصل البوت</button>}
      </div>
    </div>
  );
}
