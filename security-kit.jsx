/* ═══════════════════════════════════════════════════════════
   security-kit.jsx — طبقة أمان الإدارة (٦.٠.٠)
   - مهلة خمول: خروج تلقائي بعد فترة بدون نشاط (لوحة الإدارة + وضع التحرير)
   - تحقق بخطوتين TOTP (Supabase MFA): تسجيل/حذف العوامل من تبويب "الأمان"،
     وإذا الحساب مفعّل عليه عامل مؤكَّد يُطلب الكود قبل فتح اللوحة أو وضع التحرير.
   - تغيير كلمة المرور + إنهاء كل الجلسات على كل الأجهزة.
   ملاحظة صريحة: هذا فرض من جهة المتصفح. الفرض الكامل من جهة قاعدة البيانات (aal2)
   مجهّز كملف SQL منفصل ولا يُطبَّق إلا بعد ما يسجّل كل المشرفين عامل التحقق.
   ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { ShieldCheck, KeyRound, LogOut, Trash2, Smartphone } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";

export const IDLE_MINUTES = 30;

/* خروج تلقائي بعد خمول — يعيد ضبط المؤقت عند أي نشاط */
export function useIdleSignOut(minutes = IDLE_MINUTES, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    let t;
    const out = async () => { try { await supabase.auth.signOut(); } catch (e) { /* تجاهل */ } window.location.hash = ""; window.location.reload(); };
    const reset = () => { clearTimeout(t); t = setTimeout(out, minutes * 60 * 1000); };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [minutes, enabled]);
}

const box = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif", background: "#F7F9FB" };
const card = { width: "100%", maxWidth: 360, background: "#fff", borderRadius: 20, border: "1px solid #E1E8EC", padding: "32px 26px", textAlign: "center" };
const inp = { width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 11, border: "1px solid #E1E8EC", fontSize: 20, letterSpacing: 6, textAlign: "center", direction: "ltr", outline: "none", background: "#F7F9FB" };
const btn = { width: "100%", marginTop: 14, padding: "11px", borderRadius: 11, border: 0, background: "#1B7F8E", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" };

/* بوابة: لو فيه عامل TOTP مؤكَّد والجلسة aal1 → اطلب الكود */
export function MfaGate({ children }) {
  const [state, setState] = useState("checking"); // checking | challenge | ok
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const { data: f } = await supabase.auth.mfa.listFactors();
        const fac = (f?.totp || []).find((x) => x.status === "verified");
        if (fac) { setFactorId(fac.id); setState("challenge"); return; }
      }
    } catch (e) { /* فشل الفحص لا يقفل صاحب الحساب برّه، الفرض الحقيقي بالقاعدة */ }
    setState("ok");
  }, []);
  useEffect(() => { check(); }, [check]);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId });
      if (e1) throw e1;
      const { error: e2 } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
      if (e2) throw e2;
      setState("ok");
    } catch (e3) { setErr("الكود غير صحيح أو منتهي."); setCode(""); }
    setBusy(false);
  };

  if (state === "checking") return <div style={{ ...box, color: "#5F7280" }}>جارٍ التحقق من الأمان...</div>;
  if (state === "challenge") return (
    <div style={box} dir="rtl">
      <form onSubmit={submit} style={card}>
        <Smartphone size={30} color="#1B7F8E" style={{ margin: "0 auto 12px" }} />
        <h1 style={{ fontSize: 17, margin: "0 0 6px" }}>التحقق بخطوتين</h1>
        <p style={{ fontSize: 12.5, color: "#5F7280", margin: "0 0 18px" }}>أدخل الكود المكوّن من 6 أرقام من تطبيق المصادقة</p>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus style={inp} placeholder="••••••" />
        {err && <p style={{ color: "#B3402F", fontSize: 12.5, margin: "10px 0 0" }}>{err}</p>}
        <button type="submit" disabled={busy || code.length !== 6} style={{ ...btn, opacity: busy || code.length !== 6 ? 0.5 : 1 }}>تأكيد</button>
        <button type="button" onClick={async () => { await supabase.auth.signOut(); window.location.hash = ""; window.location.reload(); }} style={{ ...btn, background: "none", color: "#5F7280", marginTop: 6 }}>خروج</button>
      </form>
    </div>
  );
  return children;
}

/* تبويب الأمان — متاح لكل مستخدم مسجّل (يخص حسابه هو فقط) */
export function ASecurityTab({ flashToast, log, email }) {
  const [factors, setFactors] = useState(null);
  const [enroll, setEnroll] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    if (mounted.current) setFactors((data?.totp || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const startEnroll = async () => {
    setBusy(true);
    /* نظّف أي تسجيل ناقص قديم */
    for (const f of (factors || []).filter((x) => x.status !== "verified")) { await supabase.auth.mfa.unenroll({ factorId: f.id }); }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator " + new Date().toISOString().slice(0, 10) });
    setBusy(false);
    if (error) { flashToast("تعذّر البدء: " + error.message); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  const confirmEnroll = async () => {
    setBusy(true);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: enroll.id });
    const { error: e2 } = e1 ? { error: e1 } : await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (e2) { flashToast("الكود غير صحيح"); return; }
    setEnroll(null); setCode(""); await load(); flashToast("تم تفعيل التحقق بخطوتين");
    log && log("تفعيل التحقق بخطوتين", email || "");
  };
  const removeFactor = async (f) => {
    if (!window.confirm("حذف عامل التحقق؟ يضعف أمان حسابك.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) { flashToast("تعذّر الحذف: " + error.message); return; }
    await load(); flashToast("تم الحذف"); log && log("حذف عامل تحقق بخطوتين", email || "");
  };
  const changePw = async () => {
    if (pw.length < 12) { flashToast("كلمة المرور لازم 12 حرف على الأقل"); return; }
    if (pw !== pw2) { flashToast("كلمتا المرور غير متطابقتين"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { flashToast("تعذّر التغيير: " + error.message); return; }
    setPw(""); setPw2(""); flashToast("تم تغيير كلمة المرور"); log && log("تغيير كلمة مرور", email || "");
  };
  const signOutAll = async () => {
    if (!window.confirm("إنهاء كل الجلسات على كل الأجهزة (تشمل هذا الجهاز)؟")) return;
    log && await log("إنهاء كل الجلسات", email || "");
    await supabase.auth.signOut({ scope: "global" });
    window.location.hash = ""; window.location.reload();
  };

  const verified = (factors || []).filter((f) => f.status === "verified");
  const S = {
    wrap: { maxWidth: 640, margin: "0 auto", padding: "8px 4px", display: "flex", flexDirection: "column", gap: 16 },
    sec: { border: "1px solid #E1E8EC", borderRadius: 14, padding: 18, background: "#fff" },
    h: { fontSize: 15, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 },
    p: { fontSize: 13, color: "#5F7280", margin: "0 0 12px", lineHeight: 1.7 },
    b: { padding: "9px 16px", borderRadius: 10, border: 0, background: "#1B7F8E", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
    i: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid #E1E8EC", marginBottom: 8, fontSize: 14, background: "#F7F9FB", direction: "ltr" },
  };
  return (
    <div style={S.wrap}>
      <div style={S.sec}>
        <p style={S.h}><Smartphone size={17} /> التحقق بخطوتين (TOTP)</p>
        <p style={S.p}>يحمي حسابك حتى لو انسرقت كلمة المرور. استخدم أي تطبيق مصادقة (Google Authenticator، Microsoft Authenticator، 1Password…).</p>
        {factors === null ? <p style={S.p}>يحمّل…</p> : verified.length > 0 ? (
          <>
            {verified.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #EEF2F4", fontSize: 13 }}>
                <span><ShieldCheck size={14} color="#1B7F8E" style={{ verticalAlign: -2 }} /> مفعّل — {f.friendly_name || "Authenticator"}</span>
                <button onClick={() => removeFactor(f)} title="حذف" style={{ border: 0, background: "none", cursor: "pointer", color: "#B3402F" }}><Trash2 size={15} /></button>
              </div>
            ))}
          </>
        ) : !enroll ? (
          <button style={S.b} disabled={busy} onClick={startEnroll}>تفعيل التحقق بخطوتين</button>
        ) : (
          <div>
            <p style={S.p}>1) امسح الرمز بالتطبيق. 2) اكتب الكود المكوّن من 6 أرقام لتأكيد التفعيل.</p>
            <img src={enroll.qr} alt="QR" style={{ width: 180, height: 180, background: "#fff", display: "block", margin: "0 auto 10px" }} />
            <p style={{ ...S.p, textAlign: "center", direction: "ltr", userSelect: "all", fontSize: 12 }}>{enroll.secret}</p>
            <input style={{ ...S.i, textAlign: "center", letterSpacing: 6, fontSize: 18 }} value={code} inputMode="numeric" placeholder="••••••" onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            <button style={{ ...S.b, opacity: code.length === 6 ? 1 : 0.5 }} disabled={busy || code.length !== 6} onClick={confirmEnroll}>تأكيد وتفعيل</button>
          </div>
        )}
      </div>

      <div style={S.sec}>
        <p style={S.h}><KeyRound size={17} /> تغيير كلمة المرور</p>
        <p style={S.p}>12 حرف على الأقل. استخدم كلمة فريدة غير مستعملة بأي موقع آخر.</p>
        <input style={S.i} type="password" autoComplete="new-password" placeholder="كلمة المرور الجديدة" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input style={S.i} type="password" autoComplete="new-password" placeholder="تأكيد كلمة المرور" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <button style={{ ...S.b, opacity: pw && pw2 ? 1 : 0.5 }} disabled={busy || !pw || !pw2} onClick={changePw}>تغيير</button>
      </div>

      <div style={S.sec}>
        <p style={S.h}><LogOut size={17} /> الجلسات</p>
        <p style={S.p}>خروج تلقائي بعد {IDLE_MINUTES} دقيقة بدون نشاط. لو شككت بأي اختراق أنهِ كل الجلسات فورًا.</p>
        <button style={{ ...S.b, background: "#B3402F" }} onClick={signOutAll}>إنهاء كل الجلسات على كل الأجهزة</button>
      </div>
    </div>
  );
}
