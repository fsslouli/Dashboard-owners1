/* gate-kit.jsx — دخول الملاك (6.12.0)
   ─────────────────────────────────────────────────────────────
   الفكرة: الإدارة تفعّل «تسجيل الدخول» من لوحة الإدارة ← تبويب «دخول الملاك»، وبثلاثة أوضاع:
     off      الموقع مفتوح للكل (الوضع الافتراضي — ما يتغيّر شي)
     full     ما ينفتح الموقع إلا بعد الدخول برقم الفيلا + الرقم السري
     partial  شاشة الدخول فيها «دخول كزائر»: الزائر يشوف فقط الأقسام اللي حددتها الإدارة، والباقي بعد دخول المالك
   القفل الحقيقي بقاعدة البيانات (دالة gate_ok داخل سياسات القراءة — راجع migration-owner-login.sql)،
   وهذا الملف واجهته فقط: شاشة الدخول + شارة الحساب + توجيه الموقع العام.
   حساب الإدارة يفتح الموقع بدون رقم فيلا (جلسته نفسها تكفي). */
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "./app-bootstrap.jsx";
import { THEMES, clearInqCache, hideBoot } from "./site-data.jsx";
import { WmLayer, sanitizeWm, wmStamp } from "./share-wm-kit.jsx";
import { TicketLauncher } from "./ticket-kit.jsx";
import { ProtectLayer, protectOn, sanitizeProtect } from "./protect-kit.jsx";

/* صفحة فحص الاستلام تُحمَّل عند الحاجة فقط (7.1.0) */
const HandoverLauncher = lazy(() => import("./handover-kit.jsx").then((m) => ({ default: m.HandoverLauncher })));

export const GATE_MODES = ["off", "full", "partial"];
export const GATE_TABS = ["overview", "notes", "progress", "docs", "gallery"];
export const VILLA_MAX = 596;
const CFG_KEY = "gate_cfg_v1";

const readCfg = () => {
  try {
    const v = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
    return v && GATE_MODES.includes(v.mode) ? { mode: v.mode, tabs: Array.isArray(v.tabs) ? v.tabs.filter((t) => GATE_TABS.includes(t)) : [], wm: v.wm && typeof v.wm === "object" ? v.wm : null, tickets: ["off", "owners", "all"].includes(v.tickets) ? v.tickets : "off", handover: ["owners", "all"].includes(v.handover) ? v.handover : "hidden", protect: sanitizeProtect(v.protect) } : null;
  } catch { return null; }
};
const writeCfg = (c) => { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch { /* */ } };

/* أرقام عربية/فارسية → لاتينية (المالك يكتب من لوحة مفاتيح الجوال بأي لغة) */
export const latinDigits = (s) => String(s ?? "")
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

/* نوع الجلسة الحالية: admin (حساب إدارة) | villa (حساب فيلا) | share (مستلم رابط مشاركة) | null */
export function sessionKind(session) {
  const m = session?.user?.app_metadata || {};
  if (!session) return { kind: null, villa: null };
  if (m.villa_login != null) return { kind: "villa", villa: Number(m.villa_login) };
  if (m.share_link) return { kind: "share", villa: null };
  return { kind: "admin", villa: null };
}

export async function callOwnerLogin(action, body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/owner-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action, ...body }),
  });
  let j = null; try { j = await r.json(); } catch { /* */ }
  if (!j || typeof j.state !== "string") throw new Error("owner-login: bad response");
  return j;
}

/* وضع القفل من site_settings — يُقرأ من المخبّأ أولًا (شاشة الدخول تطلع فورًا بلا وميض) ثم يتحدّث لحظيًا */
export function useGateConfig() {
  const [cached] = useState(readCfg);
  const [cfg, setCfg] = useState(() => cached || { mode: "off", tabs: [], wm: null, tickets: "off", handover: "hidden", protect: sanitizeProtect(null) });
  const [ready, setReady] = useState(!!cached);
  useEffect(() => {
    let alive = true;
    const guard = setTimeout(() => { if (alive) setReady(true); }, 2500);
    const pull = async () => {
      try {
        const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();
        if (!alive) return;
        /* العمودان غير موجودين = الهجرة ما اشتغلت بعد → الموقع مفتوح كما كان */
        const next = error || !data
          ? { mode: "off", tabs: [], wm: null, tickets: "off", handover: "hidden", protect: sanitizeProtect(null) }
          : { handover: ["owners", "all"].includes(data.handover_mode) ? data.handover_mode : "hidden", tickets: ["off", "owners", "all"].includes(data.tickets_mode) ? data.tickets_mode : "off", mode: GATE_MODES.includes(data.gate_mode) ? data.gate_mode : "off", tabs: (data.gate_guest_tabs || []).filter((t) => GATE_TABS.includes(t)), wm: data.gate_wm && typeof data.gate_wm === "object" ? data.gate_wm : null, protect: sanitizeProtect(data.protect) };
        setCfg((p) => (p.mode === next.mode && p.tabs.join() === next.tabs.join() && JSON.stringify(p.wm) === JSON.stringify(next.wm) && p.tickets === next.tickets && p.handover === next.handover && JSON.stringify(p.protect) === JSON.stringify(next.protect) ? p : next));
        writeCfg(next);
      } catch { /* يبقى المخبّأ */ }
      finally { if (alive) { clearTimeout(guard); setReady(true); } }
    };
    pull();
    const ch = supabase.channel("gate-settings-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "site_settings" }, pull)
      .subscribe();
    return () => { alive = false; clearTimeout(guard); supabase.removeChannel(ch); };
  }, []);
  return { ...cfg, ready };
}

function useSession() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

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

/* ── شاشة الدخول ── */
export function VillaLogin({ onDone, onGuest, notice }) {
  const T = useDark() ? THEMES.dark : THEMES.light;
  const [villa, setVilla] = useState("");
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const pinRef = useRef(null);
  useLayoutEffect(() => { hideBoot(true); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const v = Number(latinDigits(villa).trim()); const p = latinDigits(pin).trim();
    if (!Number.isInteger(v) || v < 1 || v > VILLA_MAX) { setErr(`اكتب رقم الفيلا (من 1 إلى ${VILLA_MAX})`); return; }
    if (!/^[0-9]{6}$/.test(p)) { setErr("الرقم السري 6 أرقام"); return; }
    setBusy(true); setErr("");
    try {
      const r = await callOwnerLogin("login", { villa: v, pin: p });
      if (r.state === "ok") {
        const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
        if (error) setErr("تعذّر فتح الجلسة — حاول مرة ثانية.");
        else if (onDone) onDone();
      } else if (r.state === "locked") {
        setErr(`الحساب مقفل مؤقتًا بعد محاولات خاطئة — حاول بعد ${r.minutes || 15} دقيقة.`); setPin("");
      } else if (r.state === "busy") {
        setErr("محاولات كثيرة — انتظر دقيقة ثم حاول.");
      } else if (r.state === "invalid") {
        setErr(r.left ? `رقم الفيلا أو الرقم السري غير صحيح — تبقّى ${r.left} محاولات قبل القفل المؤقت.` : "رقم الفيلا أو الرقم السري غير صحيح.");
        setPin(""); pinRef.current?.focus();
      } else setErr("تعذّر الدخول الآن — حاول بعد قليل.");
    } catch { setErr("تعذّر الاتصال — تأكد من الإنترنت ثم حاول."); }
    setBusy(false);
  };

  const inp = { width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 12, border: `1px solid ${T.line}`, fontSize: 18, letterSpacing: 3, textAlign: "center", outline: "none", background: T.sunken, color: T.paper, fontFamily: "inherit" };
  const lab = { fontSize: 12.5, color: T.muted, display: "block", marginBottom: 6 };
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: T.bg, color: T.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 370, background: T.surface, borderRadius: 20, border: `1px solid ${T.line}`, padding: "34px 26px", boxShadow: T.shadowUp }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: T.brass + "16", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}><KeyRound size={24} color={T.brass} /></div>
        <h1 style={{ textAlign: "center", fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>دخول الملاك</h1>
        <p style={{ textAlign: "center", fontSize: 12.5, lineHeight: 1.8, color: T.muted, margin: "0 0 22px" }}>{notice || "الموقع خاص بملاك المشروع. ادخل برقم فيلتك والرقم السري الذي وصلك من فريق تمثيل الملاك."}</p>
        <label style={lab} htmlFor="gate-villa">رقم الفيلا</label>
        <input id="gate-villa" value={villa} onChange={(e) => { setVilla(latinDigits(e.target.value).replace(/\D/g, "").slice(0, 3)); setErr(""); }}
          inputMode="numeric" autoComplete="username" dir="ltr" placeholder="مثال: 120" style={{ ...inp, marginBottom: 14 }} />
        <label style={lab} htmlFor="gate-pin">الرقم السري (6 أرقام)</label>
        <div style={{ position: "relative" }}>
          <input id="gate-pin" ref={pinRef} value={pin} onChange={(e) => { setPin(latinDigits(e.target.value).replace(/\D/g, "").slice(0, 6)); setErr(""); }}
            type={show ? "text" : "password"} inputMode="numeric" autoComplete="current-password" dir="ltr" placeholder="••••••" style={inp} />
          <button type="button" onClick={() => setShow((x) => !x)} aria-label={show ? "إخفاء الرقم السري" : "إظهار الرقم السري"} aria-pressed={show}
            style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, border: "none", background: "transparent", color: T.muted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {err && <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.7, color: "#C0392B", marginTop: 10 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 18, padding: "12px 0", borderRadius: 12, border: "none", background: T.brass, color: T.onAccent || "#fff", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}>
          <LogIn size={17} />{busy ? "جارٍ الدخول…" : "دخول"}
        </button>
        {onGuest && (
          <>
            <button type="button" onClick={onGuest} style={{ width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "transparent", color: T.paper, fontSize: 13.5, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "inherit" }}><Eye size={16} />دخول كزائر</button>
            <p style={{ textAlign: "center", fontSize: 11.5, color: T.faint || T.muted, margin: "6px 0 0" }}>الزائر يطّلع على أقسام محدودة فقط.</p>
          </>
        )}
        <p style={{ textAlign: "center", fontSize: 11.5, lineHeight: 1.8, color: T.faint || T.muted, margin: "16px 0 0" }}>
          نسيت الرقم السري؟ تواصل مع فريق تمثيل الملاك لإعادة تعيينه.
        </p>
        <button type="button" onClick={() => { window.location.hash = "#admin"; }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "6px auto 0", border: "none", background: "transparent", color: T.faint || T.muted, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
          <ShieldCheck size={13} />دخول الإدارة
        </button>
      </form>
    </div>
  );
}

/* شارة صغيرة ثابتة أسفل الصفحة: «فيلا 120 · خروج» للمسجّل، أو «دخول الملاك» للزائر بالوضع الجزئي */
function GateChip({ label, action, Icon, onClick }) {
  const T = useDark() ? THEMES.dark : THEMES.light;
  /* بالجوال شريط الأقسام ثابت أسفل الشاشة — نرفع الشارة فوقه حتى ما تغطيه */
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setNarrow(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return (
    <div dir="rtl" style={{ position: "fixed", insetInlineStart: 12, bottom: `calc(${narrow ? 92 : 14}px + env(safe-area-inset-bottom, 0px))`, zIndex: 60, display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 12px", borderRadius: 999, background: T.surface, color: T.paper, border: `1px solid ${T.line}`, boxShadow: T.shadowUp, fontFamily: "system-ui, sans-serif", fontSize: 12.5 }}>
      {label && <span style={{ color: T.muted }}>{label}</span>}
      <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, border: "none", background: T.brass, color: T.onAccent || "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        <Icon size={14} />{action}
      </button>
    </div>
  );
}

/* علامة مائية برقم الفيلا فوق الموقع كله (إعداداتها من لوحة الإدارة — نفس محرّك علامة روابط المشاركة) */
function VillaWatermark({ wm, villa, uid }) {
  const [minute, setMinute] = useState(wmStamp);
  useEffect(() => { const t = setInterval(() => setMinute(wmStamp()), 30000); return () => clearInterval(t); }, []);
  if (!wm || !wm.on) return null;
  return <WmLayer fixed wm={sanitizeWm(wm)} name={`فيلا ${villa}`} sid={uid} minute={minute} />;
}

const GUEST_KEY = "gate_guest_v1";
const readGuest = () => { try { return sessionStorage.getItem(GUEST_KEY) === "1"; } catch { return false; } };
const writeGuest = (v) => { try { v ? sessionStorage.setItem(GUEST_KEY, "1") : sessionStorage.removeItem(GUEST_KEY); } catch { /* */ } };

/* ── موجّه الموقع العام ──
   render(gateProp, key) يرسم <PublicSite/> — المفتاح يتغيّر مع تغيّر الهوية فيُعاد تحميل البيانات بالصلاحية الجديدة. */
export function GateRoot({ render }) {
  const cfg = useGateConfig();
  const session = useSession();
  /* الوضع الجزئي: شاشة الدخول أولًا وفيها زر «دخول كزائر» — اختيار الزائر يُحفظ لهذه الجلسة فقط */
  const [asGuest, setAsGuestRaw] = useState(readGuest);
  const setAsGuest = (v) => { writeGuest(v); setAsGuestRaw(v); };
  const [kicked, setKicked] = useState("");
  const { kind, villa } = sessionKind(session);
  const active = cfg.mode !== "off";
  const member = kind === "admin" || kind === "villa";

  /* حساب فيلا تغيّر رقمه السري أو تعطّل: القاعدة ترفض قراءته — نخرّجه ونطلب الدخول من جديد */
  const probe = useCallback(async () => {
    if (!active || kind !== "villa") return;
    try {
      const { data, error } = await supabase.rpc("gate_ok", { p_tabs: ["*"] });
      if (!error && data === false) {
        clearInqCache();
        setKicked("انتهت صلاحية دخولك (تغيّر الرقم السري أو أُوقف الحساب). ادخل بالرقم السري الجديد.");
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch { /* انقطاع مؤقت */ }
  }, [active, kind]);
  useEffect(() => {
    probe();
    const iv = setInterval(probe, 120000);
    const onVis = () => { if (document.visibilityState === "visible") probe(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [probe]);

  /* زائر بلا دخول والقفل مفعّل: ما نبقي نسخة استفسارات محفوظة بالجهاز */
  useEffect(() => { if (cfg.ready && session !== undefined && active && !member) clearInqCache(); }, [cfg.ready, session, active, member]);
  useEffect(() => { if (member) { setAsGuest(false); setKicked(""); } }, [member]);

  const logout = async () => { clearInqCache(); await supabase.auth.signOut({ scope: "local" }); };

  if (!cfg.ready || session === undefined) return null;   /* شاشة الإقلاع باقية لحد ما نعرف الوضع */
  /* زر «أرسل استفسارك» (7.0.0): للجميع أو للملاك المسجّلين فقط حسب إعداد لوحة الإدارة */
  const ticketsFor = (isVilla) => cfg.tickets === "all" || (cfg.tickets === "owners" && isVilla);
  /* الأزرار العائمة مرتبة فوق بعض: شارة الحساب ← زر التذاكر ← زر فحص الاستلام */
  const floats = (isVilla, hasChip) => {
    const tk = ticketsFor(isVilla);
    const ho = cfg.handover === "all" || (cfg.handover === "owners" && isVilla);
    return (
      <>
        {tk && <TicketLauncher villa={isVilla ? villa : null} raised={hasChip} />}
        {ho && <Suspense fallback={null}><HandoverLauncher villa={isVilla ? villa : null} level={(hasChip ? 1 : 0) + (tk ? 1 : 0)} /></Suspense>}
      </>
    );
  };
  /* 7.5.0 — حماية المحتوى: تسري على المالك والزائر، والإدارة مستثناة */
  const guard = kind !== "admin" && protectOn(cfg.protect)
    ? <ProtectLayer cfg={cfg.protect} who={kind === "villa" ? { kind: "villa", villa } : { kind: "guest" }} /> : null;
  if (!active) {
    return (
      <>
        {render(null, "open")}
        {guard}
        {kind === "villa" && <GateChip label={`فيلا ${villa}`} action="خروج" Icon={LogOut} onClick={logout} />}
        {floats(kind === "villa", kind === "villa")}
      </>
    );
  }
  if (member) {
    return (
      <>
        {render(null, `m-${session.user.id}`)}
        {guard}
        {kind === "villa" && <GateChip label={`فيلا ${villa}`} action="خروج" Icon={LogOut} onClick={logout} />}
        {kind === "villa" && <VillaWatermark wm={cfg.wm} villa={villa} uid={session.user.id} />}
        {floats(kind === "villa", kind === "villa")}
      </>
    );
  }
  const guestTabs = cfg.mode === "partial" ? cfg.tabs : [];
  if (cfg.mode === "full" || !guestTabs.length || !asGuest) {
    return <VillaLogin notice={kicked || undefined} onGuest={cfg.mode === "partial" && guestTabs.length ? () => setAsGuest(true) : null} />;
  }
  return (
    <>
      {render({ tabs: guestTabs }, "guest")}
      {guard}
      <GateChip label="زائر · أقسام محدودة" action="دخول الملاك" Icon={LogIn} onClick={() => setAsGuest(false)} />
      {floats(false, true)}
    </>
  );
}

/* صفحة المشاركة: لما القفل مفعّل نأخذ جلسة قراءة مؤقتة لمستلم الرابط (تنتهي مع جلسة الرابط) */
export async function ensureShareSession(sid) {
  try {
    const { data } = await supabase.auth.getSession();
    const m = data.session?.user?.app_metadata || {};
    const fresh = m.share_link && Number(m.share_exp) > Date.now() && String(sid || "").startsWith(`${m.share_link}|`);
    if (fresh) return true;
    const { data: st } = await supabase.from("site_settings").select("gate_mode").eq("id", 1).single();
    if (!st || !st.gate_mode || st.gate_mode === "off") return true;
    /* حساب إدارة أو فيلا مفتوح بنفس المتصفح يقرأ أصلًا — ما نبدّله */
    if (data.session && !m.share_link) return true;
    const r = await callOwnerLogin("share", { sid });
    if (r.state !== "ok") return false;
    const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    return !error;
  } catch { return false; }
}
export async function endShareSession() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.app_metadata?.share_link) { clearInqCache(); await supabase.auth.signOut({ scope: "local" }); }
  } catch { /* */ }
}
