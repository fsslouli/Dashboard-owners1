/* ═══════════════════════════════════════════════════════════
   admin-shell.jsx — هيكل لوحة الإدارة الجديد (٦.٠.٠)
   قائمة جانبية مجمّعة + بحث سريع (Ctrl/⌘+K) + زر «تحرير الموقع مباشرة».
   لا يحذف ولا يخفي أي تبويب: أي تبويب غير مذكور بالمجموعات ينزل تلقائيًا
   تحت «أخرى»، فلو أُضيف تبويب جديد مستقبلًا ما يضيع.
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlarmClock, BarChart3, Bell, Clapperboard, ExternalLink, FileSpreadsheet, FileText, Filter, History,
  Images, LayoutDashboard, Link2, LogOut, Menu, MousePointerClick, Palette, PenLine, Search, ShieldCheck,
  Type, Users, X, Layers, Wand2, Languages, KeyRound, Inbox, CalendarDays, ClipboardCheck,
} from "lucide-react";

/* 7.4.0 — هيكلة جديدة: القائمة الجانبية صارت 11 قسمًا بثلاث مجموعات حسب طريقة العمل (بدل 23 تبويبًا)،
   وكل قسم يجمع التبويبات المتقاربة ويعرضها كشريط فرعي أعلى الصفحة. مفاتيح التبويبات نفسها لم تتغير،
   فالروابط (#admin/<مفتاح>) والصلاحيات وتسمية/إخفاء الأقسام تشتغل كما هي. */
export const ADMIN_SECTIONS = [
  { group: "العمل اليومي", id: "home", title: "الرئيسية", keys: ["dashboard", "brief"] },
  { group: "العمل اليومي", id: "inq", title: "الاستفسارات والبيانات", keys: ["sync", "filters", "i18n"] },
  { group: "العمل اليومي", id: "meet", title: "الاجتماعات", keys: ["meetings"] },
  { group: "العمل اليومي", id: "tix", title: "تذاكر الملاك", keys: ["tickets"] },
  { group: "العمل اليومي", id: "pub", title: "النشر والإشعارات", keys: ["notices", "scheduled"] },
  { group: "الموقع", id: "lib", title: "المكتبة والمحتوى", keys: ["gallery", "media", "links", "handover"] },
  { group: "الموقع", id: "look", title: "شكل الموقع", keys: ["theme", "site", "labels"] },
  { group: "الموقع", id: "access", title: "الوصول والمشاركة", keys: ["ownerlogin", "share"] },
  { group: "المتابعة والنظام", id: "stats", title: "الإحصاءات", keys: ["analytics", "insights"] },
  { group: "المتابعة والنظام", id: "sys", title: "المستخدمون والأمان", keys: ["users", "security", "audit"] },
];
const SECTION_ICON = { home: "dashboard", inq: "sync", meet: "meetings", tix: "tickets", pub: "notices", lib: "gallery", look: "theme", access: "ownerlogin", stats: "analytics", sys: "security" };
/* للتوافق مع أي استيراد قديم */
export const ADMIN_NAV_GROUPS = ADMIN_SECTIONS.map((x) => ({ title: x.title, keys: x.keys }));
const ICONS = {
  dashboard: LayoutDashboard, brief: FileText, sync: FileSpreadsheet, filters: Filter, notices: Bell,
  media: Clapperboard, gallery: Images, links: ExternalLink, scheduled: AlarmClock, labels: Type, theme: Palette,
  analytics: BarChart3, insights: Activity, share: Link2, audit: History, users: Users, security: ShieldCheck, site: Wand2, i18n: Languages, ownerlogin: KeyRound, tickets: Inbox, meetings: CalendarDays, handover: ClipboardCheck,
};
const iconOf = (k) => ICONS[k] || Layers;

/* يقسّم التبويبات الظاهرة على الأقسام؛ أي تبويب خارجها (تبويب جديد مستقبلًا) ينزل تحت «أخرى» فلا يضيع */
export function sectionTabs(tabs) {
  const byKey = new Map(tabs.map((t) => [t.key, t]));
  const used = new Set();
  const secs = ADMIN_SECTIONS.map((x) => {
    const items = x.keys.map((k) => byKey.get(k)).filter(Boolean);
    items.forEach((t) => used.add(t.key));
    return { ...x, items };
  }).filter((x) => x.items.length);
  const rest = tabs.filter((t) => !used.has(t.key));
  if (rest.length) secs.push({ group: "المتابعة والنظام", id: "other", title: "أخرى", keys: rest.map((t) => t.key), items: rest });
  return secs;
}
export function groupTabs(tabs) { return sectionTabs(tabs).map((x) => ({ title: x.title, items: x.items })); }

const CSS = `
.ash{display:grid;grid-template-columns:272px minmax(0,1fr);min-height:100vh}
.ash-side{position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;padding:16px 12px;gap:6px}
.ash-top{display:none}
.ash-main{min-width:0}
.ash-body{max-width:1080px;margin:0 auto;padding:22px 22px 80px}
.ash-item{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;border-radius:11px;padding:9px 11px;font:inherit;font-size:13.5px;cursor:pointer;text-align:start;transition:background .12s}
.ash-item:hover{background:var(--ash-hover)}
.ash-item:focus-visible,.ash-btn:focus-visible{outline:2px solid var(--ash-accent);outline-offset:2px}
.ash-ttl{font-size:11px;font-weight:700;letter-spacing:.02em;padding:12px 11px 4px;opacity:.7}
.ash-scrim{display:none}
.ash-sub{display:flex;gap:6px;overflow-x:auto;margin:0 0 16px;padding-bottom:2px;scrollbar-width:none}
.ash-sub::-webkit-scrollbar{display:none}
.ash-sub button{flex:0 0 auto;display:flex;align-items:center;gap:7px;border-radius:999px;padding:8px 14px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
.ash-badge{margin-inline-start:auto;min-width:20px;height:20px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
@media (max-width:959px){
  .ash{display:block}
  .ash-side{position:fixed;inset:0 0 0 auto;width:min(86vw,320px);height:100vh;height:100dvh;padding-bottom:calc(28px + env(safe-area-inset-bottom,0px));z-index:40;transform:translateX(105%);transition:transform .2s ease;box-shadow:-12px 0 40px rgba(0,0,0,.25)}
  .ash-side[data-open="1"]{transform:none}
  .ash-scrim[data-open="1"]{display:block;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:30}
  .ash-top{display:flex}
  .ash-body{padding:16px 14px 80px}
}
@media (prefers-reduced-motion:reduce){.ash-side{transition:none}}
`;

function QuickFind({ T, tabs, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const list = useMemo(() => {
    const s = q.trim();
    return s ? tabs.filter((t) => t.label.includes(s) || t.key.includes(s.toLowerCase())) : tabs;
  }, [q, tabs]);
  useEffect(() => { setIdx(0); }, [q]);
  const onKey = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && list[idx]) onPick(list[idx].key);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="بحث سريع" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 60, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(92vw,520px)", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: T.shadowUp, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${T.line}` }}>
          <Search size={16} color={T.muted} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="اذهب إلى قسم…"
            style={{ flex: 1, border: 0, outline: "none", background: "transparent", color: T.paper, fontSize: 14.5, fontFamily: "inherit" }} />
          <kbd style={{ fontSize: 10.5, color: T.muted, border: `1px solid ${T.line}`, borderRadius: 6, padding: "2px 6px" }}>Esc</kbd>
        </div>
        <div style={{ maxHeight: 340, overflowY: "auto", padding: 6 }}>
          {list.length === 0 && <div style={{ padding: 18, fontSize: 13, color: T.muted, textAlign: "center" }}>لا نتائج</div>}
          {list.map((t, i) => {
            const Ic = iconOf(t.key);
            return (
              <button key={t.key} onClick={() => onPick(t.key)} onMouseEnter={() => setIdx(i)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, textAlign: "start",
                  background: i === idx ? T.sunken : "transparent", color: T.paper }}>
                <Ic size={15} color={T.brass} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ T, tabs, activeKey, onSelect, stats, badges, userLabel, onLogout, onEditSite, children }) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState(false);
  const sections = useMemo(() => sectionTabs(tabs), [tabs]);
  const groupNames = useMemo(() => [...new Set(sections.map((x) => x.group))], [sections]);
  const activeSec = sections.find((x) => x.items.some((t) => t.key === activeKey)) || null;
  /* آخر تبويب فرعي زرته بكل قسم — ترجع له لما تفتح القسم مرة ثانية */
  const lastRef = useRef({});
  if (activeSec) lastRef.current[activeSec.id] = activeKey;
  const badgeOf = (keys) => keys.reduce((n, k) => n + ((badges && badges[k]) || 0), 0);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setFind(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (k) => { onSelect(k); setOpen(false); setFind(false); window.scrollTo?.({ top: 0 }); };
  const active = tabs.find((t) => t.key === activeKey);

  const vars = { "--ash-hover": T.sunken, "--ash-accent": T.brass };
  const iconBtn = { display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 11, border: `1px solid ${T.line}`, background: T.surface, color: T.muted, cursor: "pointer" };

  const SideBody = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 10px" }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: T.brass + "1c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ShieldCheck size={19} color={T.brass} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>لوحة إدارة ألبورادا</div>
          <div style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userLabel}</div>
        </div>
        <button className="ash-btn" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" style={{ ...iconBtn, marginInlineStart: "auto", width: 32, height: 32, display: open ? "flex" : "none" }}><X size={16} /></button>
      </div>

      {onEditSite && (
        <button className="ash-btn" onClick={onEditSite}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", border: 0, borderRadius: 12, padding: "12px 10px", background: T.brass, color: T.onAccent, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 4 }}>
          <PenLine size={16} /> تحرير الموقع مباشرة
        </button>
      )}
      <button className="ash-btn ash-item" onClick={() => setFind(true)} style={{ border: `1px solid ${T.line}`, color: T.muted, background: T.surface }}>
        <Search size={15} /> <span style={{ flex: 1 }}>بحث سريع</span>
        <kbd style={{ fontSize: 10.5, border: `1px solid ${T.line}`, borderRadius: 6, padding: "1px 6px" }}>Ctrl K</kbd>
      </button>

      <nav aria-label="أقسام لوحة الإدارة" style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        {groupNames.map((gn) => (
          <div key={gn}>
            <div className="ash-ttl" style={{ color: T.muted }}>{gn}</div>
            {sections.filter((x) => x.group === gn).map((x) => {
              const on = activeSec && activeSec.id === x.id; const Ic = iconOf(SECTION_ICON[x.id] || x.items[0].key);
              const target = x.items.find((t) => t.key === lastRef.current[x.id]) || x.items[0];
              const n = badgeOf(x.items.map((t) => t.key));
              return (
                <button key={x.id} className="ash-item" onClick={() => pick(target.key)} aria-current={on ? "page" : undefined}
                  style={{ background: on ? T.brass + "1f" : undefined, color: on ? T.brass : T.paper, fontWeight: on ? 700 : 500 }}>
                  <Ic size={16} /> {x.items.length === 1 ? x.items[0].label : x.title}
                  {n > 0 && <span className="ash-badge" style={{ background: T.brass, color: T.onAccent }}>{n}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, fontSize: 11, color: T.muted, justifyContent: "space-between", padding: "0 4px" }}>
          <span>{stats.total} استفسار</span><span>{stats.open} مفتوح</span><span>{stats.urgent} عاجل</span>
        </div>
        <button className="ash-btn ash-item" onClick={onLogout} style={{ color: T.muted, border: `1px solid ${T.line}`, justifyContent: "center" }}><LogOut size={14} /> خروج</button>
      </div>
    </>
  );

  return (
    <div dir="rtl" style={{ ...vars, background: T.bg, color: T.paper, fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
      <style>{CSS}</style>
      <div className="ash">
        <aside className="ash-side" data-open={open ? "1" : "0"} style={{ background: T.surface, borderInlineEnd: `1px solid ${T.line}` }}>{SideBody}</aside>
        <div className="ash-scrim" data-open={open ? "1" : "0"} onClick={() => setOpen(false)} />
        <div className="ash-main">
          <header className="ash-top" style={{ position: "sticky", top: 0, zIndex: 20, alignItems: "center", gap: 10, padding: "10px 14px", background: T.surface, borderBottom: `1px solid ${T.line}` }}>
            <button className="ash-btn" onClick={() => setOpen(true)} aria-label="فتح القائمة" style={iconBtn}><Menu size={18} /></button>
            <div style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(activeSec && activeSec.items.length > 1 ? activeSec.title : active?.label) || "لوحة الإدارة"}</div>
            <button className="ash-btn" onClick={() => setFind(true)} aria-label="بحث سريع" style={iconBtn}><Search size={16} /></button>
            <button className="ash-btn" onClick={onLogout} aria-label="خروج" style={iconBtn}><LogOut size={16} /></button>
            {onEditSite && <button className="ash-btn" onClick={onEditSite} aria-label="تحرير الموقع مباشرة" style={{ ...iconBtn, background: T.brass, color: T.onAccent, border: 0 }}><PenLine size={16} /></button>}
          </header>
          <main className="ash-body">
            {active && <h1 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 14px" }} className="ash-h1">{activeSec && activeSec.items.length > 1 ? activeSec.title : active.label}</h1>}
            {activeSec && activeSec.items.length > 1 && (
              <div className="ash-sub" role="tablist" aria-label={activeSec.title}>
                {activeSec.items.map((t) => {
                  const on = t.key === activeKey; const Ic = iconOf(t.key); const n = (badges && badges[t.key]) || 0;
                  return (
                    <button key={t.key} role="tab" aria-selected={on} onClick={() => pick(t.key)}
                      style={{ border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass : T.surface, color: on ? T.onAccent : T.paper, fontWeight: on ? 700 : 500 }}>
                      <Ic size={14} /> {t.label}{n > 0 && <b style={{ fontSize: 11 }}>({n})</b>}
                    </button>
                  );
                })}
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
      {find && <QuickFind T={T} tabs={tabs} onPick={pick} onClose={() => setFind(false)} />}
    </div>
  );
}
