/* ═══════════════════════════════════════════════════════════
   admin-shell.jsx — هيكل لوحة الإدارة الجديد (٦.٠.٠)
   قائمة جانبية مجمّعة + بحث سريع (Ctrl/⌘+K) + زر «تحرير الموقع مباشرة».
   لا يحذف ولا يخفي أي تبويب: أي تبويب غير مذكور بالمجموعات ينزل تلقائيًا
   تحت «أخرى»، فلو أُضيف تبويب جديد مستقبلًا ما يضيع.
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BarChart3, Bell, Clapperboard, ExternalLink, FileSpreadsheet, FileText, Filter, History,
  Images, LayoutDashboard, Link2, LogOut, Menu, MousePointerClick, Palette, PenLine, Search, ShieldCheck,
  Type, Users, X, Layers, Wand2,
} from "lucide-react";

export const ADMIN_NAV_GROUPS = [
  { title: "الرئيسية", keys: ["dashboard", "brief"] },
  { title: "البيانات", keys: ["sync", "filters"] },
  { title: "محتوى الموقع", keys: ["site", "notices", "media", "gallery", "links", "labels", "theme"] },
  { title: "التحليلات", keys: ["analytics", "insights"] },
  { title: "المشاركة", keys: ["share"] },
  { title: "النظام", keys: ["audit", "users", "security"] },
];
const ICONS = {
  dashboard: LayoutDashboard, brief: FileText, sync: FileSpreadsheet, filters: Filter, notices: Bell,
  media: Clapperboard, gallery: Images, links: ExternalLink, labels: Type, theme: Palette,
  analytics: BarChart3, insights: Activity, share: Link2, audit: History, users: Users, security: ShieldCheck, site: Wand2,
};
const iconOf = (k) => ICONS[k] || Layers;

/* يقسّم التبويبات الظاهرة على المجموعات، وأي تبويب خارجها يروح لـ«أخرى» */
export function groupTabs(tabs) {
  const byKey = new Map(tabs.map((t) => [t.key, t]));
  const used = new Set();
  const groups = ADMIN_NAV_GROUPS.map((g) => {
    const items = g.keys.map((k) => byKey.get(k)).filter(Boolean);
    items.forEach((t) => used.add(t.key));
    return { title: g.title, items };
  }).filter((g) => g.items.length);
  const rest = tabs.filter((t) => !used.has(t.key));
  if (rest.length) groups.push({ title: "أخرى", items: rest });
  return groups;
}

const CSS = `
.ash{display:grid;grid-template-columns:272px minmax(0,1fr);min-height:100vh}
.ash-side{position:sticky;top:0;height:100vh;overflow-y:auto;display:flex;flex-direction:column;padding:16px 12px;gap:6px}
.ash-top{display:none}
.ash-main{min-width:0}
.ash-body{max-width:1080px;margin:0 auto;padding:22px 22px 80px}
.ash-item{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;border-radius:11px;padding:9px 11px;font:inherit;font-size:13.5px;cursor:pointer;text-align:start;transition:background .12s}
.ash-item:hover{background:var(--ash-hover)}
.ash-item:focus-visible,.ash-btn:focus-visible{outline:2px solid var(--ash-accent);outline-offset:2px}
.ash-ttl{font-size:11px;font-weight:700;letter-spacing:.02em;padding:12px 11px 4px;opacity:.7}
.ash-scrim{display:none}
@media (max-width:959px){
  .ash{display:block}
  .ash-side{position:fixed;inset:0 0 0 auto;width:min(86vw,320px);height:100vh;z-index:40;transform:translateX(105%);transition:transform .2s ease;box-shadow:-12px 0 40px rgba(0,0,0,.25)}
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

export function AdminShell({ T, tabs, activeKey, onSelect, stats, userLabel, onLogout, onEditSite, children }) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState(false);
  const groups = useMemo(() => groupTabs(tabs), [tabs]);

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
        {groups.map((g) => (
          <div key={g.title}>
            <div className="ash-ttl" style={{ color: T.muted }}>{g.title}</div>
            {g.items.map((t) => {
              const on = t.key === activeKey; const Ic = iconOf(t.key);
              return (
                <button key={t.key} className="ash-item" onClick={() => pick(t.key)} aria-current={on ? "page" : undefined}
                  style={{ background: on ? T.brass + "1f" : undefined, color: on ? T.brass : T.paper, fontWeight: on ? 700 : 500 }}>
                  <Ic size={16} /> {t.label}
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
            <div style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active?.label || "لوحة الإدارة"}</div>
            <button className="ash-btn" onClick={() => setFind(true)} aria-label="بحث سريع" style={iconBtn}><Search size={16} /></button>
            {onEditSite && <button className="ash-btn" onClick={onEditSite} aria-label="تحرير الموقع مباشرة" style={{ ...iconBtn, background: T.brass, color: T.onAccent, border: 0 }}><PenLine size={16} /></button>}
          </header>
          <main className="ash-body">
            {active && <h1 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 16px" }} className="ash-h1">{active.label}</h1>}
            {children}
          </main>
        </div>
      </div>
      {find && <QuickFind T={T} tabs={tabs} onPick={pick} onClose={() => setFind(false)} />}
    </div>
  );
}
