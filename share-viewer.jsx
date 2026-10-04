/* share-viewer.jsx — صفحة المستلم: تتحقق من الرابط (+PIN إن وُجد) ثم تعرض الأقسام المحددة فقط.
   ما فيها زر إدارة ولا سجل تحديثات ولا رابط للموقع الرئيسي (راجع share داخل public-site.jsx).
   ٤.٠: تتبّع النشاط داخل الجلسة (يُعلَن للمستلم بوضوح قبل الفتح) — راجع createTracker بـ share-kit.jsx. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { THEMES, hideBoot } from "./site-data.jsx";
import { PublicSite } from "./public-site.jsx";
import { SHARE_MESSAGES, callShare, createTracker, isValidToken, shareTokenFromHash } from "./share-kit.jsx";

const skey = (t) => `share_sid_${t.slice(0, 12)}`;
const readSid = (t) => { try { return sessionStorage.getItem(skey(t)); } catch { return null; } };
const writeSid = (t, v) => { try { v ? sessionStorage.setItem(skey(t), v) : sessionStorage.removeItem(skey(t)); } catch { /* */ } };

function useDark() {
  const [d, setD] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const h = (e) => setD(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return d;
}

function Card({ icon = true, title, text, action, busy, children, foot }) {
  const T = useDark() ? THEMES.dark : THEMES.light;
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif", color: T.paper }}>
      <div style={{ width: "100%", maxWidth: 420, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 20, padding: "34px 26px", textAlign: "center", boxShadow: T.shadowUp }}>
        {icon && <div style={{ width: 52, height: 52, borderRadius: 14, background: T.brass + "16", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}><ShieldCheck size={24} color={T.brass} /></div>}
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>{title}</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.9, color: T.muted, margin: 0 }}>{text}</p>
        {children}
        {action && (
          <button onClick={action.onClick} disabled={busy} style={{ marginTop: 22, width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: T.brass, color: T.onAccent || "#fff", fontSize: 14.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}>{action.label}</button>
        )}
        {foot && <p style={{ fontSize: 11.5, lineHeight: 1.8, color: T.faint, margin: "16px 0 0" }}>{foot}</p>}
      </div>
    </div>
  );
}

const clientInfo = () => {
  let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* */ }
  return { lang: navigator.language || "", screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`, tz };
};

export function ShareApp() {
  const [token, setToken] = useState(() => shareTokenFromHash());
  const [st, setSt] = useState("loading"); // loading | gate | ready | <حالة رفض> | error
  const [needPin, setNeedPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [grant, setGrant] = useState(null); // { scope, note, endsAt }
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const trackerRef = useRef(null);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    const h = () => setToken(shareTokenFromHash());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  useLayoutEffect(() => { if (st !== "ready") hideBoot(true); }, [st]);

  /* أول دخول: إن كان عندنا جلسة سابقة بالمتصفح نكمل بها (التحديث ما يستهلك فتحة)، وإلا نسأل عن حالة الرابط */
  useEffect(() => {
    if (!token) { setSt("none"); return undefined; }
    if (!isValidToken(token)) { setSt("unknown"); return undefined; }
    let live = true;
    setSt("loading"); setGrant(null);
    (async () => {
      try {
        const sid = readSid(token);
        if (sid) {
          const r = await callShare("session", { sid });
          if (!live) return;
          if (r.state === "ok") { setGrant({ scope: r.scope || {}, note: r.note || "", endsAt: r.sessionEnds }); setSt("ready"); return; }
          writeSid(token, null);
          if (r.state !== "session_ended") { setSt(r.state); return; }
          setSt("session_ended"); return;
        }
        const r = await callShare("status", { token });
        if (!live) return;
        if (r.state === "ok") { setNeedPin(!!r.pin); setSt("gate"); } else setSt(r.state);
      } catch { if (live) setSt("error"); }
    })();
    return () => { live = false; };
  }, [token]);

  const openNow = async () => {
    if (needPin && !pin.trim()) { setPinErr("اكتب رمز الدخول الذي وصلك مع الرابط"); return; }
    setBusy(true); setPinErr("");
    try {
      const r = await callShare("open", { token, pin: needPin ? pin.trim() : undefined, client: clientInfo() });
      if (!alive.current) return;
      if (r.state === "ok") { writeSid(token, r.sid); setGrant({ scope: r.scope || {}, note: r.note || "", endsAt: r.sessionEnds }); setSt("ready"); }
      else if (r.state === "pin") { setNeedPin(true); setPinErr("هذا الرابط يتطلب رمز دخول"); }
      else if (r.state === "pin_wrong") { setPinErr(`رمز الدخول غير صحيح — تبقّى ${r.left} محاولات قبل القفل المؤقت`); setPin(""); }
      else setSt(r.state);
    } catch { if (alive.current) setSt("error"); }
    if (alive.current) setBusy(false);
  };

  /* التتبع: يبدأ مع العرض وينتهي بخروج الجلسة */
  useEffect(() => {
    if (st !== "ready" || !token) return undefined;
    const tr = createTracker(() => readSid(token));
    trackerRef.current = tr;
    return () => { tr.flush(); tr.stop(); trackerRef.current = null; };
  }, [st, token]);

  /* أثناء العرض: نتحقق دوريًا — الإلغاء من الإدارة يطبّق خلال دقيقة، وانتهاء المدة بنفس لحظته */
  useEffect(() => {
    if (st !== "ready" || !token) return undefined;
    let live = true;
    const check = async () => {
      const sid = readSid(token);
      if (!sid) { setSt("session_ended"); return; }
      try {
        const r = await callShare("session", { sid });
        if (!live) return;
        if (r.state !== "ok") { writeSid(token, null); setGrant(null); setSt(r.state); }
      } catch { /* انقطاع مؤقت — نكمل ونعيد المحاولة بالدورة التالية */ }
    };
    const iv = setInterval(check, 45000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    let to = null;
    if (grant?.endsAt) {
      const ms = new Date(grant.endsAt).getTime() - Date.now();
      to = setTimeout(check, Math.max(500, Math.min(ms + 400, 2147000000)));
    }
    return () => { live = false; clearInterval(iv); clearTimeout(to); document.removeEventListener("visibilitychange", onVis); };
  }, [st, token, grant]);

  /* نعطي PublicSite دالة تتبّع القسم (ثابتة المرجع حتى لا تُعاد الأفكت) */
  const shareProp = useMemo(() => (grant ? { ...grant, onTab: (t) => trackerRef.current?.setTab(t) } : null), [grant]);

  if (st === "loading") return <Card icon={false} title="جارٍ التحقق من الرابط…" text="لحظات من فضلك." />;
  if (st === "gate") {
    const T = THEMES.light;
    return (
      <Card title="مشاركة خاصة" busy={busy} action={{ label: busy ? "جارٍ الفتح…" : "عرض المحتوى", onClick: openNow }}
        text="أُرسل لك هذا الرابط من صاحب الموقع لعرض محتوى محدد. الفتح محدود المدة، فاضغط الزر عندما تكون جاهزًا للاطلاع."
        foot="للحفاظ على خصوصية هذه المشاركة يُسجَّل نشاطك داخل هذه الصفحة (الأقسام التي تفتحها والنقرات ومدة التصفح) ويُعرض على صاحب الموقع فقط. لا يُسجَّل أي نص تكتبه ولا عنوان الـIP.">
        {needPin && (
          <div style={{ marginTop: 18 }}>
            <input type="password" inputMode="numeric" autoComplete="off" dir="ltr" value={pin} maxLength={32} placeholder="رمز الدخول"
              onChange={(e) => { setPin(e.target.value); setPinErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") openNow(); }}
              style={{ width: "100%", boxSizing: "border-box", textAlign: "center", letterSpacing: 4, fontSize: 18, padding: "11px 12px", borderRadius: 12, border: `1px solid ${pinErr ? "#C0392B" : T.line}`, background: "transparent", color: "inherit", outline: "none", fontFamily: "inherit" }} />
            {pinErr && <div style={{ color: "#C0392B", fontSize: 12.5, marginTop: 8, lineHeight: 1.7 }}>{pinErr}</div>}
          </div>
        )}
      </Card>
    );
  }
  if (st === "ready" && shareProp) return <PublicSite share={shareProp} />;
  const m = SHARE_MESSAGES[st] || SHARE_MESSAGES.unknown;
  return <Card title={m.t} text={m.d} />;
}
