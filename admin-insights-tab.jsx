/* admin-insights-tab.jsx — التحليلات الشاملة (5.0.0)
   تقرأ من site_sessions / site_events عبر الدالة site_insights (تجميع بالقاعدة، توقيت الرياض). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Download, RefreshCw, Trash2 } from "lucide-react";
import { useSystemTheme } from "./admin-core.jsx";
import { ALocked } from "./admin-excel-utils.jsx";
import { supabase } from "./app-bootstrap.jsx";

const RANGES = [["today", "اليوم"], ["7", "7 أيام"], ["30", "30 يوم"], ["90", "90 يوم"], ["all", "الكل"]];
const EVENT_AR = {
  visit: "دخول", tab: "فتح قسم", inquiry_open: "فتح استفسار", filter: "فلتر", search: "بحث", click: "ضغطة", nav: "تنقّل", link: "رابط خارجي",
  download: "تحميل", share: "مشاركة", feedback: "تقييم", lang: "تغيير اللغة", theme: "تغيير المظهر", error: "خطأ", hide: "إخفاء الصفحة", show: "عودة للصفحة", end: "خروج", scroll: "تمرير",
};
const evName = (t) => EVENT_AR[t] || t;
const fmtMs = (ms) => { const s = Math.round((ms || 0) / 1000); if (s < 60) return `${s} ث`; const m = Math.floor(s / 60); return m < 60 ? `${m} د ${s % 60} ث` : `${Math.floor(m / 60)} س ${m % 60} د`; };
const fmtTime = (v) => new Date(v).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const num = (n) => Number(n || 0).toLocaleString("en-US");

function rangeBounds(key) {
  const to = new Date(Date.now() + 60000);
  if (key === "all") return [new Date("2020-01-01T00:00:00Z"), to];
  const riyadh = new Date(Date.now() + 3 * 3600000);
  const dayStart = new Date(Date.UTC(riyadh.getUTCFullYear(), riyadh.getUTCMonth(), riyadh.getUTCDate()) - 3 * 3600000);
  const back = key === "today" ? 0 : Number(key) - 1;
  return [new Date(dayStart.getTime() - back * 86400000), to];
}

function Kpi({ T, label, value, sub }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "12px 13px" }}>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: T.paper, fontFamily: "ui-monospace, monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.faint || T.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Panel({ T, title, children, note }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 15px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.paper, marginBottom: note ? 3 : 10 }}>{title}</div>
      {note && <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10, lineHeight: 1.7 }}>{note}</div>}
      {children}
    </div>
  );
}

function Ranked({ T, rows, empty = "لا بيانات بعد", valueKey = "n", sub }) {
  const list = (rows || []).filter((r) => r && r.k != null);
  if (!list.length) return <div style={{ fontSize: 12.5, color: T.muted }}>{empty}</div>;
  const max = Math.max(...list.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {list.map((r, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ color: T.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{String(r.k).replace(/^\d·\s?/, "")}{r.type ? ` (${evName(r.type)})` : ""}</span>
            <span style={{ color: T.muted, fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>{num(r[valueKey])}{sub && r[sub] != null ? ` · ${num(r[sub])}` : ""}</span>
          </div>
          <div style={{ height: 5, background: T.sunken, borderRadius: 4 }}><div style={{ height: 5, width: `${Math.max(3, ((Number(r[valueKey]) || 0) / max) * 100)}%`, background: T.brass, borderRadius: 4 }} /></div>
        </div>
      ))}
    </div>
  );
}

export function AInsightsTab({ flashToast, canExport, canPurge, log }) {
  const T = useSystemTheme();
  const [range, setRange] = useState("7");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [purgeDays, setPurgeDays] = useState("90");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const [from, to] = rangeBounds(range);
    const [a, b, c] = await Promise.all([
      supabase.rpc("site_insights", { p_from: from.toISOString(), p_to: to.toISOString() }),
      supabase.from("site_events").select("id,at,type,category,value,label,tab,session_id").order("id", { ascending: false }).limit(60),
      supabase.from("site_sessions").select("*").gte("started_at", from.toISOString()).order("started_at", { ascending: false }).limit(40),
    ]);
    if (a.error) { setErr(a.error.message?.includes("forbidden") ? "ما عندك صلاحية عرض التحليلات" : "تعذّر تحميل التحليلات — تأكد أنك شغّلت migration-site-analytics.sql"); setData(null); }
    else setData(a.data);
    setFeed(b.data || []); setSessions(c.data || []);
    setLoading(false);
  }, [range]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const iv = setInterval(load, 60000); return () => clearInterval(iv); }, [load]);

  const openSession = async (id) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setTimeline([]);
    const { data: ev } = await supabase.from("site_events").select("id,at,type,category,value,label,tab").eq("session_id", id).order("id").limit(400);
    setTimeline(ev || []);
  };

  const exportCsv = async () => {
    const [from, to] = rangeBounds(range);
    const { data: ev, error } = await supabase.from("site_events").select("at,session_id,type,category,value,extra,tab,target,label").gte("at", from.toISOString()).lt("at", to.toISOString()).order("id", { ascending: false }).limit(5000);
    if (error) { flashToast?.("تعذّر التصدير"); return; }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["الوقت", "الجلسة", "النوع", "الفئة", "القيمة", "إضافي", "القسم", "العنصر", "النص"];
    const rows = (ev || []).map((e) => [e.at, e.session_id, e.type, e.category, e.value, e.extra, e.tab, e.target, e.label].map(esc).join(","));
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `site-events-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    flashToast?.(`صُدّر ${rows.length} حدث`);
  };

  const purge = async () => {
    const d = Number(purgeDays);
    if (!d || d < 1) return;
    if (!window.confirm(`حذف جميع جلسات وأحداث التحليلات الأقدم من ${d} يوم؟ لا يمكن التراجع.`)) return;
    const cut = new Date(Date.now() - d * 86400000).toISOString();
    const { error } = await supabase.from("site_sessions").delete().lt("started_at", cut);
    if (error) { flashToast?.("تعذّر الحذف"); return; }
    try { await log?.("حذف بيانات التحليلات", `الأقدم من ${d} يوم`); } catch { /* */ }
    flashToast?.("تم الحذف"); load();
  };

  const t = data?.totals || {};
  const daily = useMemo(() => (data?.daily || []).map((x) => ({ ...x, d: String(x.d).slice(5) })), [data]);
  const hourly = useMemo(() => { const m = {}; (data?.hourly || []).forEach((x) => { m[x.h] = x.sessions; }); return Array.from({ length: 24 }, (_, h) => ({ h, n: m[h] || 0 })); }, [data]);
  const hMax = Math.max(...hourly.map((x) => x.n), 1);
  const sessMap = useMemo(() => Object.fromEntries(sessions.map((s) => [s.id, s])), [sessions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: T.sunken, padding: 3, borderRadius: 10 }}>
          {RANGES.map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)} style={{ border: "none", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: range === k ? T.surface : "transparent", color: range === k ? T.brass : T.muted }}>{l}</button>
          ))}
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${T.line}`, borderRadius: 9, padding: "6px 11px", fontSize: 12.5, color: T.muted, cursor: "pointer" }}><RefreshCw size={13} className={loading ? "spin" : ""} /> تحديث</button>
        {canExport && <button onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${T.line}`, borderRadius: 9, padding: "6px 11px", fontSize: 12.5, color: T.muted, cursor: "pointer" }}><Download size={13} /> CSV</button>}
        <span style={{ marginInlineStart: "auto", fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 5 }}><Activity size={13} color={t.live > 0 ? "#2E9E6B" : T.muted} /> الآن على الموقع: <b style={{ color: T.paper }}>{num(t.live)}</b></span>
      </div>

      {err && <ALocked text={err} />}
      {!err && !data && <div style={{ color: T.muted, fontSize: 13 }}>جارٍ التحميل…</div>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
            <Kpi T={T} label="الجلسات (الزيارات)" value={num(t.sessions)} />
            <Kpi T={T} label="زوّار مختلفون" value={num(t.visitors)} sub={`عائدون: ${num(t.returning)}`} />
            <Kpi T={T} label="متوسط وقت التصفح" value={fmtMs(t.avg_active_ms)} />
            <Kpi T={T} label="إجمالي الأحداث" value={num(t.events)} sub={`ضغطات: ${num(t.clicks)}`} />
            <Kpi T={T} label="زيارات بلا تفاعل" value={num(t.bounce)} sub={t.sessions ? `${Math.round((t.bounce / t.sessions) * 100)}%` : ""} />
            <Kpi T={T} label="تقييمات" value={`${num(t.likes)} / ${num(t.dislikes)}`} sub={`مشاركات: ${num(t.shares)}`} />
          </div>

          <Panel T={T} title="الجلسات يوميًا" note="بتوقيت الرياض">
            {daily.length ? (
              <div style={{ height: 190, direction: "ltr" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={daily}>
                    <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="d" tick={{ fontSize: 11, fill: T.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: T.muted }} width={30} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="sessions" name="جلسات" fill={T.brass} radius={[4, 4, 0, 0]} />
                    <Line dataKey="visitors" name="زوّار" stroke="#2E9E6B" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : <div style={{ fontSize: 12.5, color: T.muted }}>لا بيانات بعد</div>}
          </Panel>

          <Panel T={T} title="ساعات الذروة" note="عدد الجلسات حسب ساعة الدخول (الرياض)">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, direction: "ltr" }}>
              {hourly.map((x) => (
                <div key={x.h} title={`${x.h}:00 — ${x.n}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
                  <div style={{ width: "100%", height: `${(x.n / hMax) * 100}%`, minHeight: x.n ? 3 : 1, background: x.n ? T.brass : T.line, borderRadius: 2 }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.muted, marginTop: 4, direction: "ltr" }}><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            <Panel T={T} title="الأقسام الأكثر فتحًا"><Ranked T={T} rows={data.tabs} valueKey="views" sub="sessions" /></Panel>
            <Panel T={T} title="الاستفسارات الأكثر فتحًا" note="العدد · عدد الزوّار المختلفين"><Ranked T={T} rows={data.inquiries} valueKey="opens" sub="sessions" /></Panel>
            <Panel T={T} title="الفلاتر المستخدمة"><Ranked T={T} rows={data.filters} /></Panel>
            <Panel T={T} title="كلمات البحث" note="ما يبحث عنه الزوّار — يُحفظ نص البحث فقط"><Ranked T={T} rows={data.searches} /></Panel>
            <Panel T={T} title="أكثر العناصر ضغطًا"><Ranked T={T} rows={data.clicks} /></Panel>
            <Panel T={T} title="التنقّل والمستندات والمرفقات"><Ranked T={T} rows={data.nav} /></Panel>
            <Panel T={T} title="الروابط الخارجية والتحميلات"><Ranked T={T} rows={data.links} /></Panel>
            <Panel T={T} title="أخطاء الصفحة" note="أخطاء JavaScript عند الزوّار"><Ranked T={T} rows={data.errors} empty="لا أخطاء 👌" /></Panel>
            <Panel T={T} title="الأجهزة"><Ranked T={T} rows={data.devices} /></Panel>
            <Panel T={T} title="المتصفحات"><Ranked T={T} rows={data.browsers} /></Panel>
            <Panel T={T} title="أنظمة التشغيل"><Ranked T={T} rows={data.oses} /></Panel>
            <Panel T={T} title="الدول" note="تظهر فقط إن وفّرتها البنية؛ وإلا «—»"><Ranked T={T} rows={data.countries} /></Panel>
            <Panel T={T} title="اللغات"><Ranked T={T} rows={data.langs} /></Panel>
            <Panel T={T} title="أحجام الشاشات"><Ranked T={T} rows={data.screens} /></Panel>
            <Panel T={T} title="مصدر الزيارة"><Ranked T={T} rows={data.referrers} /></Panel>
            <Panel T={T} title="المظهر (فاتح/داكن)"><Ranked T={T} rows={data.themes} /></Panel>
            <Panel T={T} title="عمق التمرير"><Ranked T={T} rows={data.scroll} /></Panel>
            <Panel T={T} title="مدة التصفح الفعلية"><Ranked T={T} rows={data.durations} /></Panel>
          </div>

          <Panel T={T} title="آخر الأحداث (مباشر)" note="آخر 60 حدثًا على الموقع، تتجدد كل دقيقة">
            {feed.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                {feed.map((e) => (
                  <div key={e.id} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "baseline", borderBottom: `1px solid ${T.line}`, padding: "4px 0" }}>
                    <span style={{ color: T.muted, fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>{fmtTime(e.at)}</span>
                    <b style={{ color: T.brass, flexShrink: 0 }}>{evName(e.type)}</b>
                    <span style={{ color: T.paper, overflow: "hidden", textOverflow: "ellipsis" }}>{[e.category, e.label || e.value].filter(Boolean).join(" · ")}</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 12.5, color: T.muted }}>لا أحداث بعد</div>}
          </Panel>

          <Panel T={T} title="الجلسات" note="اضغط على جلسة لعرض مسار تصفحها خطوة بخطوة (آخر 40)">
            {sessions.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sessions.map((s) => (
                  <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10 }}>
                    <button onClick={() => openSession(s.id)} style={{ width: "100%", textAlign: "start", background: "none", border: "none", padding: "9px 11px", cursor: "pointer", color: T.paper, fontSize: 12.5, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontFamily: "inherit" }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: T.muted }}>{fmtTime(s.started_at)}</span>
                      <span>{[s.device, s.browser, s.os].filter(Boolean).join(" · ")}</span>
                      {s.is_returning && <b style={{ color: "#2E9E6B", fontSize: 11.5 }}>عائد</b>}
                      <span style={{ marginInlineStart: "auto", color: T.muted }}>{fmtMs(s.active_ms)} · {s.events} حدث · تمرير {s.max_scroll}%</span>
                    </button>
                    {open === s.id && (
                      <div style={{ padding: "4px 11px 10px", display: "flex", flexDirection: "column", gap: 3, maxHeight: 280, overflowY: "auto" }}>
                        {!timeline.length && <div style={{ fontSize: 12, color: T.muted }}>…</div>}
                        {timeline.map((e) => (
                          <div key={e.id} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                            <span style={{ color: T.muted, fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>{new Date(e.at).toLocaleTimeString("en-GB", { timeZone: "Asia/Riyadh" })}</span>
                            <b style={{ color: T.brass, flexShrink: 0 }}>{evName(e.type)}</b>
                            <span style={{ color: T.paper }}>{[e.category, e.label || e.value].filter(Boolean).join(" · ")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 12.5, color: T.muted }}>لا جلسات ضمن الفترة</div>}
          </Panel>
        </>
      )}

      <Panel T={T} title="الشفافية: ماذا يُتتبّع؟">
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.9 }}>
          يُسجَّل: الأقسام المفتوحة، الاستفسارات المفتوحة، الفلاتر وكلمات البحث، الضغطات على العناصر (نوع العنصر ونصه المقتطع)، الروابط والتحميلات، التقييم والمشاركة، تغيير اللغة والمظهر، عمق التمرير، مدة التصفح الفعلية، أخطاء الصفحة، ونوع الجهاز والمتصفح والنظام وحجم الشاشة.
          لا يُسجَّل: عنوان الـIP (فقط بصمة مقتطعة غير قابلة للعكس)، أي نص يكتبه الزائر عدا كلمة البحث، ولا مواضع المؤشر. لا كوكيز. يُستثنى من يفعّل «Do Not Track»، ومتصفح الإدارة المسجّل دخوله. ضغطات الفيديو المضمّنة (يوتيوب) لا يمكن رصدها.
        </div>
      </Panel>

      {canPurge && (
        <Panel T={T} title="حذف البيانات القديمة">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: T.muted }}>
            احذف الأقدم من
            <input type="number" min="1" value={purgeDays} onChange={(e) => setPurgeDays(e.target.value)} style={{ width: 70, padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.line}`, background: "transparent", color: T.paper, fontFamily: "inherit" }} />
            يوم
            <button onClick={purge} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #C0392B", color: "#C0392B", borderRadius: 9, padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}><Trash2 size={13} /> حذف</button>
          </div>
        </Panel>
      )}
    </div>
  );
}
