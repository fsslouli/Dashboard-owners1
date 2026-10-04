/* admin-share-report.jsx — تقرير نشاط رابط المشاركة (4.0.0)
   يعرض لكل رابط: ملخصًا، الأقسام التي زارها ومدة كل قسم، أكثر العناصر ضغطًا، الجلسات (جهاز/متصفح/دولة تقريبية)،
   وسجلًّا زمنيًّا كاملًا لكل ضغطة. متاح أثناء الجلسة وبعد انتهائها. التصدير CSV أو طباعة/حفظ PDF. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Download, MousePointerClick, Printer, RefreshCw, Trash2 } from "lucide-react";
import { SHARE_TABS } from "./share-kit.jsx";

const TYPE_AR = { open: "فتح الرابط", click: "ضغطة", tab: "انتقال لقسم", link: "رابط خارجي", download: "ملف / تحميل", hide: "أخفى الصفحة", show: "عاد للصفحة", end: "أغلق الصفحة" };
const TYPE_COLOR = { open: "#1E8E5A", click: "#2F6FDB", tab: "#8E44AD", link: "#B8790F", download: "#B8790F", hide: "#8A8A8A", show: "#8A8A8A", end: "#C0392B" };
const tabName = (k) => (k ? SHARE_TABS.find((t) => t.key === k)?.label.split(" (")[0] || k : "—");
const fmt = (d) => (d ? new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "medium" }) : "—");
const fmtT = (d) => (d ? new Date(d).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
const dur = (ms) => {
  const s = Math.round((ms || 0) / 1000);
  if (s < 60) return `${s} ث`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} د ${s % 60} ث` : `${Math.floor(m / 60)} س ${m % 60} د`;
};
const DEV_AR = { desktop: "حاسوب", mobile: "جوال", tablet: "لوحي" };

async function fetchAll(q, pageSize = 1000, pages = 8) {
  let out = [];
  for (let i = 0; i < pages; i++) {
    const { data, error } = await q().range(i * pageSize, i * pageSize + pageSize - 1);
    if (error) throw error;
    out = out.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  return out;
}

export function ShareReport({ supabase, link, T, flashToast, log, onBack }) {
  const [sessions, setSessions] = useState(null);
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [limit, setLimit] = useState(150);

  const load = useCallback(async () => {
    try {
      const ss = await fetchAll(() => supabase.from("share_sessions").select("*").eq("link_id", link.id).order("started_at", { ascending: true }));
      const ev = await fetchAll(() => supabase.from("share_events").select("id,session_id,at,type,tab,target,label,meta").eq("link_id", link.id).order("at", { ascending: true }).order("id", { ascending: true }));
      setSessions(ss); setEvents(ev);
    } catch { setSessions(false); }
  }, [supabase, link.id]);
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, [load]);

  const stats = useMemo(() => {
    if (!Array.isArray(sessions)) return null;
    const bySess = {}; events.forEach((e) => { (bySess[e.session_id] ||= []).push(e); });
    const tabTime = {}; const tabClicks = {}; const labels = {};
    sessions.forEach((s) => {
      const list = bySess[s.id] || [];
      const endMs = new Date(s.ended_at || s.last_seen_at).getTime();
      let cur = null; let since = new Date(s.started_at).getTime(); let visible = true;
      const close = (t) => { if (cur && visible) tabTime[cur] = (tabTime[cur] || 0) + Math.max(0, t - since); };
      list.forEach((e) => {
        const t = new Date(e.at).getTime();
        if (e.type === "tab") { close(t); cur = e.tab; since = t; visible = true; }
        else if (e.type === "hide") { close(t); visible = false; }
        else if (e.type === "show") { since = t; visible = true; }
        if (e.type === "click" || e.type === "link" || e.type === "download") {
          if (e.tab) tabClicks[e.tab] = (tabClicks[e.tab] || 0) + 1;
          if (e.label) { const k = `${e.label}`; labels[k] = (labels[k] || 0) + 1; }
        }
      });
      close(endMs);
    });
    const clicks = events.filter((e) => e.type === "click" || e.type === "link" || e.type === "download").length;
    const tabsSeen = [...new Set(events.filter((e) => e.tab).map((e) => e.tab))];
    const top = Object.entries(labels).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const devices = [...new Set(sessions.map((s) => [DEV_AR[s.device] || s.device, s.browser, s.os].filter(Boolean).join(" · ")))];
    const countries = [...new Set(sessions.map((s) => s.country).filter(Boolean))];
    const ips = new Set(sessions.map((s) => s.ip_hash).filter(Boolean)).size;
    return { bySess, tabTime, tabClicks, clicks, tabsSeen, top, devices, countries, ips,
      active: sessions.reduce((a, s) => a + (Number(s.active_ms) || 0), 0),
      last: sessions.length ? sessions[sessions.length - 1].last_seen_at : null };
  }, [sessions, events]);

  const rowsForExport = () => events.map((e) => {
    const s = (sessions || []).find((x) => x.id === e.session_id);
    return [fmt(e.at), s ? `#${(sessions.indexOf(s) + 1)}` : "", TYPE_AR[e.type] || e.type, tabName(e.tab), e.target || "", e.label || "", e.meta?.host || e.meta?.file || ""];
  });
  const csv = () => {
    const head = ["الوقت", "الجلسة", "النوع", "القسم", "العنصر", "النص", "تفاصيل"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = [head, ...rowsForExport()].map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `share-report-${link.label.replace(/[^\w؀-ۿ-]+/g, "_")}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) { flashToast("المتصفح منع نافذة الطباعة — اسمح بالنوافذ المنبثقة"); return; }
    const e = (v) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const sess = (sessions || []).map((s, i) => `<tr><td>#${i + 1}</td><td>${e(fmt(s.started_at))}</td><td>${e(dur(s.active_ms))}</td><td>${e([DEV_AR[s.device] || s.device, s.browser, s.os].filter(Boolean).join(" · "))}</td><td>${e(s.country || "—")}</td><td>${s.events}</td></tr>`).join("");
    const ev = rowsForExport().map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("");
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><title>تقرير نشاط رابط المشاركة</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:18px}h2{font-size:14px;margin-top:22px}table{border-collapse:collapse;width:100%;font-size:11.5px}td,th{border:1px solid #ccc;padding:5px 7px;text-align:right}th{background:#f3f3f3}</style><h1>تقرير نشاط رابط المشاركة: ${e(link.label)}</h1><p>أُنشئ: ${e(fmt(link.created_at))} — ينتهي: ${e(fmt(link.expires_at))} — الجلسات: ${(sessions || []).length} — الضغطات: ${stats?.clicks || 0} — مدة التصفح الفعلية: ${e(dur(stats?.active))}</p><h2>الجلسات</h2><table><tr><th>#</th><th>البداية</th><th>المدة الفعلية</th><th>الجهاز</th><th>الدولة</th><th>الأحداث</th></tr>${sess}</table><h2>السجل الزمني الكامل</h2><table><tr><th>الوقت</th><th>الجلسة</th><th>النوع</th><th>القسم</th><th>العنصر</th><th>النص</th><th>تفاصيل</th></tr>${ev}</table><script>setTimeout(function(){print()},300)</script></html>`);
    w.document.close();
  };
  const wipe = async () => {
    const a = await supabase.from("share_events").delete().eq("link_id", link.id);
    const b = await supabase.from("share_sessions").delete().eq("link_id", link.id);
    if (a.error || b.error) { flashToast("تعذّر مسح سجل النشاط"); return; }
    log && log("مسح سجل نشاط رابط مشاركة", link.label); setConfirmDel(false); flashToast("مُسح سجل النشاط"); load();
  };

  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 15px", marginBottom: 12 };
  const btn = { display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${T.line}`, color: T.muted, borderRadius: 9, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };
  const stat = (k, v) => (
    <div style={{ background: T.sunken, borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.muted }}>{k}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3, wordBreak: "break-word" }}>{v}</div>
    </div>
  );
  const pill = (t) => <span style={{ background: (TYPE_COLOR[t] || "#888") + "1c", color: TYPE_COLOR[t] || "#888", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{TYPE_AR[t] || t}</span>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={onBack} style={btn}><ArrowRight size={13} /> رجوع للروابط</button>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={load} style={btn}><RefreshCw size={12} /> تحديث</button>
          <button onClick={csv} style={btn} disabled={!events.length}><Download size={12} /> CSV</button>
          <button onClick={print} style={btn} disabled={!events.length}><Printer size={12} /> طباعة / PDF</button>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 7 }}><Activity size={16} color={T.brass} /> تقرير نشاط: {link.label}</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 14 }}>يُحدَّث تلقائيًا كل ٢٠ ثانية. الأحداث تصل على دفعات كل ٨ ثوانٍ تقريبًا وعند إغلاق الصفحة.</div>

      {sessions === null && <div style={card}>جارٍ التحميل…</div>}
      {sessions === false && <div style={card}>تعذّرت قراءة السجل — تأكد من تشغيل migration-share-links.sql.</div>}
      {Array.isArray(sessions) && sessions.length === 0 && <div style={card}>لم يفتح أحد هذا الرابط بعد، فلا يوجد نشاط مسجّل.</div>}

      {stats && sessions.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 12 }}>
            {stat("الجلسات", sessions.length)}
            {stat("مدة التصفح الفعلية", dur(stats.active))}
            {stat("الضغطات", stats.clicks)}
            {stat("أقسام زارها", stats.tabsSeen.length)}
            {stat("آخر نشاط", fmtT(stats.last))}
            {stat("أجهزة مختلفة (تقريبًا)", stats.ips || "—")}
          </div>
          <div style={{ ...card, fontSize: 12, lineHeight: 2 }}>
            <b>الجهاز:</b> {stats.devices.join(" — ") || "—"}<br />
            <b>الدولة (تقريبية):</b> {stats.countries.join("، ") || "غير متاحة"}<br />
            <b>أُنشئ:</b> {fmt(link.created_at)} · <b>ينتهي:</b> {fmt(link.expires_at)} · <b>فُتح:</b> {link.opens} من {link.max_opens}
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>الأقسام التي زارها</div>
            {Object.keys(stats.tabTime).length === 0 && <div style={{ fontSize: 12, color: T.muted }}>لا بيانات أقسام بعد.</div>}
            {Object.entries(stats.tabTime).sort((a, b) => b[1] - a[1]).map(([k, ms]) => {
              const max = Math.max(...Object.values(stats.tabTime), 1);
              return (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{tabName(k)}</span><span style={{ color: T.muted }}>{dur(ms)} · {stats.tabClicks[k] || 0} ضغطة</span></div>
                  <div style={{ height: 6, background: T.sunken, borderRadius: 4, marginTop: 4 }}><div style={{ width: `${Math.max(4, (ms / max) * 100)}%`, height: 6, background: T.brass, borderRadius: 4 }} /></div>
                </div>
              );
            })}
          </div>

          {stats.top.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><MousePointerClick size={14} color={T.brass} /> أكثر العناصر ضغطًا</div>
              {stats.top.map(([l, n]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: `1px dashed ${T.line}` }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span><b>{n}</b></div>)}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, margin: "16px 2px 8px" }}>الجلسات ({sessions.length})</div>
          {sessions.map((s, i) => {
            const list = stats.bySess[s.id] || []; const isOpen = open === s.id;
            const t0 = new Date(s.started_at).getTime();
            return (
              <div key={s.id} style={card}>
                <button onClick={() => setOpen(isOpen ? null : s.id)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b style={{ fontSize: 13 }}>الجلسة #{i + 1}</b>
                    <span style={{ fontSize: 11.5, color: T.muted }}>{fmt(s.started_at)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.9, marginTop: 4 }}>
                    {[DEV_AR[s.device] || s.device, s.browser, s.os].filter(Boolean).join(" · ")} · شاشة {s.screen || "—"} · لغة {s.lang || "—"} · {s.tz || "—"}{s.country ? ` · ${s.country}` : ""}<br />
                    مدة فعلية {dur(s.active_ms)} · {s.events} حدث · {s.ended_at ? `أُغلقت ${fmtT(s.ended_at)}` : `آخر ظهور ${fmtT(s.last_seen_at)}`} · {isOpen ? "إخفاء السجل ▲" : "عرض السجل الزمني ▼"}
                  </div>
                </button>
                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${T.line}`, paddingTop: 8, maxHeight: 420, overflow: "auto" }}>
                    {list.map((e) => (
                      <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12, padding: "4px 0", flexWrap: "wrap" }}>
                        <span dir="ltr" style={{ color: T.faint, minWidth: 54 }}>+{dur(new Date(e.at).getTime() - t0)}</span>
                        {pill(e.type)}
                        <span style={{ color: T.muted }}>{tabName(e.tab)}</span>
                        <span style={{ minWidth: 0, wordBreak: "break-word" }}>{e.label || ""}{e.meta?.host ? ` → ${e.meta.host}` : ""}{e.meta?.file ? ` (${e.meta.file})` : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ fontSize: 13, fontWeight: 700, margin: "16px 2px 8px" }}>السجل الكامل للضغطات (الأحدث أولًا)</div>
          <div style={card}>
            {[...events].filter((e) => !["hide", "show"].includes(e.type)).reverse().slice(0, limit).map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12, padding: "5px 0", borderBottom: `1px dashed ${T.line}`, flexWrap: "wrap" }}>
                <span dir="ltr" style={{ color: T.faint, minWidth: 66 }}>{fmtT(e.at)}</span>
                {pill(e.type)}
                <span style={{ color: T.muted }}>{tabName(e.tab)}</span>
                <span style={{ minWidth: 0, wordBreak: "break-word" }}>{e.label || e.target || ""}{e.meta?.host ? ` → ${e.meta.host}` : ""}</span>
              </div>
            ))}
            {events.length > limit && <button onClick={() => setLimit(limit + 300)} style={{ ...btn, marginTop: 10 }}>عرض المزيد</button>}
          </div>

          <div style={{ marginTop: 14 }}>
            {!confirmDel
              ? <button onClick={() => setConfirmDel(true)} style={btn}><Trash2 size={12} /> مسح سجل النشاط لهذا الرابط</button>
              : <button onClick={wipe} style={{ ...btn, borderColor: "#C0392B66", color: "#C0392B" }}><Trash2 size={12} /> تأكيد المسح النهائي (لا رجعة فيه)</button>}
          </div>
        </>
      )}
    </div>
  );
}
