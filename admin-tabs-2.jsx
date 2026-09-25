/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-tabs-2 */
import { ADMIN_EVENT_TYPES, isoAdminDate, useSystemTheme } from "./admin-core.jsx";
import { ABadge, ALocked, aNoteStyle } from "./admin-excel-utils.jsx";
import { supabase } from "./app-bootstrap.jsx";
import { DEFAULT_THEME_KEY, THEME_KEYS, THEME_SETS, isFlagLive } from "./site-data.jsx";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_DESIGN_KEY, DESIGN_KEYS, DESIGNS } from "./design-nova.jsx";
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ExternalLink, ShieldCheck } from "lucide-react";

/* ── لوحة القرار الداخلية — نظرة شاملة تساعد الإدارة تتخذ قرار بسرعة ── */
export function ADashboardTab({ inquiries }) {
  const T = useSystemTheme();
  const [dailyVisits, setDailyVisits] = useState([]);
  const [monthlyActivity, setMonthlyActivity] = useState([]);
  const [topInquiries, setTopInquiries] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [eventBreakdown, setEventBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 6 * 86400000);
      const { data: logs } = await supabase.from("logs").select("event_type,created_at").eq("event_type", "visit").gte("created_at", since.toISOString());
      const byDay = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        byDay[isoAdminDate(d)] = 0;
      }
      (logs || []).forEach((l) => { const k = isoAdminDate(new Date(l.created_at)); if (byDay[k] !== undefined) byDay[k]++; });
      const WD = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
      setDailyVisits(Object.entries(byDay).map(([k, v]) => ({ day: WD[new Date(k + "T12:00:00").getDay()], visits: v })));

      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data: acts } = await supabase.from("audit_log").select("user_name").gte("ts", monthStart.toISOString());
      const counts = {};
      (acts || []).forEach((a) => { counts[a.user_name] = (counts[a.user_name] || 0) + 1; });
      setMonthlyActivity(Object.entries(counts).map(([user, count]) => ({ user, count })).sort((a, b) => b.count - a.count));

      /* نشاط شامل لآخر ٣٠ يوم — لحساب الأكثر فتحًا وأوقات الذروة وتوزيع كل نوع حدث */
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: allEvents } = await supabase.from("logs").select("event_type,category,created_at").gte("created_at", since30).limit(8000);

      const opens = {};
      (allEvents || []).filter((e) => e.event_type === "inquiry_open" && e.category).forEach((e) => { opens[e.category] = (opens[e.category] || 0) + 1; });
      const inqById = new Map(inquiries.map((r) => [String(r.id), r]));
      setTopInquiries(
        Object.entries(opens).map(([id, count]) => ({ id, count, note: inqById.get(id)?.note || "—", model: inqById.get(id)?.model || "" }))
          .sort((a, b) => b.count - a.count).slice(0, 8)
      );

      const hourCounts = Array(24).fill(0);
      (allEvents || []).forEach((e) => { const h = (new Date(e.created_at).getUTCHours() + 3) % 24; hourCounts[h]++; }); // بتوقيت السعودية (UTC+3)
      setPeakHours(hourCounts.map((c, h) => ({ hour: `${h}`, count: c })));

      const evCounts = {};
      (allEvents || []).forEach((e) => { evCounts[e.event_type] = (evCounts[e.event_type] || 0) + 1; });
      setEventBreakdown(ADMIN_EVENT_TYPES.map((t) => ({ type: t.label, count: evCounts[t.key] || 0 })).filter((x) => x.count > 0));

      setLoading(false);
    })();
  }, []);

  const statusCounts = useMemo(() => {
    const m = {}; inquiries.forEach((r) => { m[r.status || "—"] = (m[r.status || "—"] || 0) + 1; });
    return Object.entries(m).map(([status, count]) => ({ status, count }));
  }, [inquiries]);
  const priCounts = useMemo(() => {
    const order = ["عالية جدًا", "عالية", "متوسطة", "عادية"];
    const m = {}; inquiries.forEach((r) => { m[r.pri || "—"] = (m[r.pri || "—"] || 0) + 1; });
    return order.filter((p) => m[p]).map((p) => ({ pri: p, count: m[p] })).concat(Object.entries(m).filter(([p]) => !order.includes(p)).map(([pri, count]) => ({ pri, count })));
  }, [inquiries]);
  const ownerLoad = useMemo(() => {
    const m = {}; inquiries.filter((r) => r.closed !== "نعم").forEach((r) => { const o = r.owner || "غير محدد"; m[o] = (m[o] || 0) + 1; });
    return Object.entries(m).map(([owner, open]) => ({ owner, open })).sort((a, b) => b.open - a.open);
  }, [inquiries]);
  const total = inquiries.length;
  const open = inquiries.filter((r) => r.closed !== "نعم").length;
  const urgent = inquiries.filter((r) => isFlagLive(r.urgent, r.urgent_until)).length;
  const isNewCount = inquiries.filter((r) => r.last_modified && (Date.now() - new Date(r.last_modified + "T00:00:00").getTime()) / 86400000 <= 7).length;
  const weekVisitsTotal = dailyVisits.reduce((s, d) => s + d.visits, 0);

  const barCard = (title, data, xKey, barColor) => (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {data.length === 0 ? <div style={{ fontSize: 12, color: T.muted, padding: 10 }}>لا بيانات كافية.</div> : (
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey={xKey} tick={{ fontSize: 10.5, fill: T.muted }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: T.muted }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface }} />
              <Bar dataKey={data[0]?.count !== undefined ? "count" : data[0]?.open !== undefined ? "open" : "visits"} fill={barColor} radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[["إجمالي الاستفسارات", total], ["مفتوحة", open], ["عاجلة", urgent], ["جديدة (٧ أيام)", isNewCount], ["زيارات آخر أسبوع", weekVisitsTotal], ["أعضاء نشيطون هذا الشهر", monthlyActivity.length]].map(([label, val]) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: T.brass }}>{loading && (label.includes("زيارات") || label.includes("أعضاء")) ? "…" : val}</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {barCard("الزيارات آخر ٧ أيام", dailyVisits, "day", T.brass)}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {barCard("الاستفسارات حسب الحالة", statusCounts, "status", "#1E8E5A")}
        {barCard("الاستفسارات حسب الأولوية", priCounts, "pri", "#B8790F")}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>عبء العمل الحالي — استفسارات مفتوحة حسب المسؤول</div>
        {ownerLoad.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>لا يوجد استفسارات مفتوحة.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ownerLoad.map((o) => (
              <div key={o.owner} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.owner}</span>
                <div style={{ flex: 1, background: T.sunken, borderRadius: 999, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (o.open / (ownerLoad[0].open || 1)) * 100)}%`, height: "100%", background: T.brass, borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.brass, width: 20, textAlign: "end" }}>{o.open}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {barCard("أوقات الذروة (آخر ٣٠ يوم — بتوقيت السعودية)", peakHours, "hour", "#6B5FBC")}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>الاستفسارات الأكثر فتحًا (آخر ٣٠ يوم)</div>
          {topInquiries.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>{loading ? "جارٍ التحميل..." : "لا بيانات بعد."}</div> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {topInquiries.map((t) => (
                <a
                  key={t.id}
                  href={`${window.location.origin}${window.location.pathname}?note=${t.id}`}
                  target="_blank" rel="noreferrer"
                  title={t.note}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 13,
                    padding: "10px 16px", textDecoration: "none", cursor: "pointer", minWidth: 60,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.brass }}>#{t.id}</span>
                  <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>{t.count} فتحة</span>
                </a>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>توزيع كل نشاط بالموقع (آخر ٣٠ يوم)</div>
          {eventBreakdown.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>{loading ? "جارٍ التحميل..." : "لا بيانات بعد."}</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {eventBreakdown.map((e) => (
                <div key={e.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 9, padding: "7px 10px" }}>
                  <span style={{ fontSize: 11.5 }}>{e.type}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.brass }}>{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>نشاط فريق الإدارة هذا الشهر</div>
        {monthlyActivity.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>{loading ? "جارٍ التحميل..." : "ما فيه نشاط مسجّل هذا الشهر بعد."}</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monthlyActivity.map((a) => (
              <div key={a.user} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 10, padding: "9px 12px" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{a.user}</span>
                <span style={{ fontSize: 12, color: T.brass, fontWeight: 700 }}>{a.count} إجراء</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── مظهر الموقع العام — اختيار الطقم المعتمد لكل الزوّار ── */
export function AThemeTab({ flashToast, log, canManage }) {
  const T = useSystemTheme();
  const [active, setActive] = useState(null);   /* { theme, design } */
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => supabase.from("site_settings").select("*").eq("id", 1).single()
    .then(({ data }) => {
      const cur = {
        theme: THEME_KEYS.includes(data?.active_theme) ? data.active_theme : DEFAULT_THEME_KEY,
        design: DESIGN_KEYS.includes(data?.active_design) ? data.active_design : DEFAULT_DESIGN_KEY,
      };
      setActive(cur); setPick((p) => p || cur);
    });
  useEffect(() => { load(); }, []);

  const dirty = !!pick && !!active && (pick.theme !== active.theme || pick.design !== active.design);

  const apply = async () => {
    if (!dirty) return;
    setBusy(true);
    const { error } = await supabase.from("site_settings")
      .update({ active_theme: pick.theme, active_design: pick.design, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setBusy(false);
    if (error) {
      /* v2.10.0: قيد عمود التصميم بقاعدة البيانات ما انوسّع بعد لـ«بنّاء» — نقول وش الحل بدل رسالة عامة */
      const needsDb = error.code === "23514" || /active_design_chk/.test(error.message || "");
      flashToast(needsDb ? "قاعدة البيانات ما تعرف هذا التصميم بعد — شغّل migration-design-bannaa.sql مرة وحدة" : "تعذّر الاعتماد — تأكد من صلاحيتك");
      return;
    }
    const parts = [];
    if (pick.design !== active.design) parts.push(`التصميم: ${DESIGNS[pick.design].label}`);
    if (pick.theme !== active.theme) parts.push(`الطقم: ${THEME_SETS[pick.theme].label}`);
    setActive(pick);
    log("اعتماد مظهر الموقع", parts.join(" — "));
    flashToast("تم الاعتماد — انتقل للزوّار فورًا");
  };

  if (!canManage) return <ALocked text="حسابك ما عنده صلاحية تغيير مظهر الموقع العام." />;
  if (active === null) return <div style={{ color: T.muted, fontSize: 13, padding: 20 }}>جارٍ التحميل...</div>;

  return (
    <div>
      <div style={{ ...aNoteStyle(T), marginBottom: 18 }}>
        من هنا تتحكّم بشكل الموقع العام. الاعتماد ينتقل لكل زائر مفتوح عنده الموقع
        <b> فورًا وبدون إعادة نشر</b>. لوحة الإدارة تبقى على شكلها الحالي دائمًا.
      </div>

      {/* ── ١) التصميم: القديم أو الجديد ── */}
      <style>{`
@keyframes admv{to{transform:translate3d(-14%,16%,0) scale(1.3);}}
.dsn-prev{position:relative;overflow:hidden;width:74px;height:56px;border-radius:11px;flex:none;
  border:1px solid ${T.line};background:${T.sunken};}
.dsn-prev b{position:absolute;display:block;border-radius:3px;background:${T.line};}
.dsn-prev b:nth-child(1){top:9px;inset-inline-start:9px;width:26px;height:4px;background:${T.brass};}
.dsn-prev b:nth-child(2){top:19px;inset-inline-start:9px;width:56px;height:10px;}
.dsn-prev b:nth-child(3){top:33px;inset-inline-start:9px;width:24px;height:14px;}
.dsn-prev b:nth-child(4){top:33px;inset-inline-start:37px;width:28px;height:14px;}
.dsn-prev.nv{background:${T.paper};}
.dsn-prev.nv i{position:absolute;width:44px;height:44px;border-radius:50%;filter:blur(11px);opacity:.85;
  animation:admv 5.5s ease-in-out infinite alternate;}
.dsn-prev.nv i:nth-of-type(1){top:-12px;inset-inline-end:-10px;background:${T.brass};}
.dsn-prev.nv i:nth-of-type(2){bottom:-14px;inset-inline-start:-12px;background:${T.sta["معتمدة"]};animation-delay:-2.4s;}
.dsn-prev.nv b{background:rgba(255,255,255,.22);backdrop-filter:blur(3px);border-radius:5px;}
.dsn-prev.nv b:nth-child(3){background:${T.brass};}
.dsn-prev.bn em{position:absolute;inset-inline:8px;height:7px;display:block;
  background:repeating-linear-gradient(90deg,${T.sta["معتمدة"]} 0 12px,transparent 12px 14px,${T.sta["معتمدة"]} 14px 26px,transparent 26px 28px,${T.sta["تم الرفض"]} 28px 40px,transparent 40px 42px);}
.dsn-prev.bn em:nth-child(1){bottom:12px;}
.dsn-prev.bn em:nth-child(2){bottom:21px;background-position:7px 0;}
.dsn-prev.bn em:nth-child(3){bottom:30px;}
.dsn-prev.bn em:nth-child(4){bottom:39px;inset-inline-end:30px;background-position:7px 0;}
.dsn-prev.bn i{position:absolute;inset-inline:8px;bottom:8px;height:2px;background:${T.paper};}
@media(prefers-reduced-motion:reduce){.dsn-prev.nv i{animation:none;}}
      `}</style>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 9 }}>التصميم</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 26 }}>
        {DESIGN_KEYS.map((k) => {
          const d = DESIGNS[k];
          const on = pick.design === k;
          const live = active.design === k;
          return (
            <button key={k} onClick={() => setPick((p) => ({ ...p, design: k }))} style={{
              textAlign: "right", cursor: "pointer", font: "inherit", padding: "14px 15px",
              borderRadius: 14, background: T.surface, color: T.paper,
              border: `${on ? 2 : 1}px solid ${on ? T.brass : T.line}`,
              boxShadow: on ? T.shadow : "none", display: "flex", alignItems: "center", gap: 13,
            }}>
              <span className={`dsn-prev${k === "nova" ? " nv" : ""}${k === "bannaa" ? " bn" : ""}`} aria-hidden="true">
                {k === "nova" && <><i /><i /></>}
                {k === "bannaa" ? <><em /><em /><em /><em /><i /></> : <><b /><b /><b /><b /></>}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 14 }}>{d.label}</b>
                  <span style={{ fontSize: 10.5, color: T.faint }}>{d.labelEn}</span>
                  {live && <ABadge kind="ok">معتمد الآن</ABadge>}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>{d.note}</span>
              </span>
              <span style={{
                width: 19, height: 19, flex: "none", borderRadius: "50%", display: "grid", placeItems: "center",
                border: `1.5px solid ${on ? T.brass : T.line}`, background: on ? T.brass : "transparent",
              }}>{on && <Check size={11} color={T.onAccent} />}</span>
            </button>
          );
        })}
      </div>

      {/* ── ٢) طقم الألوان ── */}
      <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 9 }}>
        طقم الألوان <span style={{ fontWeight: 400, color: T.faint }}>— يشتغل مع كل التصميمات</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {THEME_KEYS.map((k) => {
          const set = THEME_SETS[k];
          const on = pick.theme === k;
          const live = active.theme === k;
          return (
            <button key={k} onClick={() => setPick((p) => ({ ...p, theme: k }))} style={{
              textAlign: "right", cursor: "pointer", font: "inherit", padding: "14px 15px",
              borderRadius: 14, background: T.surface, color: T.paper,
              border: `${on ? 2 : 1}px solid ${on ? T.brass : T.line}`,
              boxShadow: on ? T.shadow : "none", display: "flex", alignItems: "center", gap: 13,
            }}>
              <span style={{ display: "flex", flex: "none", borderRadius: 9, overflow: "hidden", border: `1px solid ${T.line}` }}>
                {set.swatch.map((c, i) => (
                  <span key={i} style={{ width: 17, height: 42, background: c, display: "block" }} />
                ))}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <b style={{ fontSize: 14 }}>{set.label}</b>
                  <span style={{ fontSize: 10.5, color: T.faint }}>{set.labelEn}</span>
                  {live && <ABadge kind="ok">معتمد الآن</ABadge>}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>{set.note}</span>
              </span>
              <span style={{
                width: 19, height: 19, flex: "none", borderRadius: "50%", display: "grid", placeItems: "center",
                border: `1.5px solid ${on ? T.brass : T.line}`, background: on ? T.brass : "transparent",
              }}>{on && <Check size={11} color={T.onAccent} />}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 9, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={apply} disabled={busy || !dirty} style={{
          display: "flex", alignItems: "center", gap: 7, border: "none", borderRadius: 11,
          padding: "11px 18px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit",
          cursor: dirty ? "pointer" : "default",
          background: dirty ? T.brass : T.sunken, color: dirty ? T.onAccent : T.faint,
        }}><ShieldCheck size={15} /> {busy ? "جارٍ الاعتماد..." : !dirty ? "المظهر الحالي معتمد"
          : `اعتماد «${DESIGNS[pick.design].label} · ${THEME_SETS[pick.theme].label}»`}</button>
        <a href={`${window.location.origin}${window.location.pathname}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.muted,
            textDecoration: "none", border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 14px" }}>
          <ExternalLink size={13} /> معاينة الموقع العام
        </a>
      </div>
      <div style={{ fontSize: 11.5, color: T.faint, marginTop: 12, lineHeight: 1.85 }}>
        كل طقم فيه نسخة نهارية وليلية، ويتبع إعداد جهاز الزائر تلقائيًا كالمعتاد.
        التصميم والطقم مستقلّين: تقدر تجرّب «نوفا» بأي طقم ألوان، وترجع للكلاسيكي بضغطة وحدة لو ما عجبك.
      </div>
    </div>
  );
}
