/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-home */
import { AdminLogin, isoAdminDate, useSupaAuth, useSystemTheme } from "./admin-core.jsx";
import { ALocked, aNoteStyle } from "./admin-excel-utils.jsx";
import { AMediaTab } from "./admin-media-tab.jsx";
import { AAnalyticsTab, AAuditLogTab, AFiltersTab, ANoticesTab, AUsersTab } from "./admin-tabs-1.jsx";
import { ADashboardTab, AThemeTab } from "./admin-tabs-2.jsx";
import { ASyncTab } from "./admin-trail-sync.jsx";
import { supabase } from "./app-bootstrap.jsx";
import { THEMES, isFlagLive } from "./site-data.jsx";
import { useEffect, useMemo, useState } from "react";
import { briefToMarkdown, briefToText, buildBrief } from "./admin-brief.js";
import { AGalleryTab } from "./gallery-kit.jsx";
import { ALabelsTab, isHidden, NLA, useNavLabels } from "./nav-labels-kit.jsx";
import { Check, Copy, Download, LogOut, ShieldCheck } from "lucide-react";

/* ═══ ١٥ج. الملخّص التنفيذي — لوحة الإدارة فقط ═══ */
function ABriefTab({ inquiries, flashToast }) {
  const T = useSystemTheme();
  const brief = useMemo(() => buildBrief(inquiries || []), [inquiries]);
  const [copied, setCopied] = useState("");

  const copy = async (kind) => {
    const text = kind === "md" ? briefToMarkdown(brief) : briefToText(brief);
    try { await navigator.clipboard.writeText(text); setCopied(kind); setTimeout(() => setCopied(""), 1600); }
    catch { flashToast("المتصفح منع النسخ"); }
  };
  const download = () => {
    const blob = new Blob([briefToMarkdown(brief)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ملخص-الاستفسارات-${isoAdminDate(new Date())}.md`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const btn = (on) => ({
    display: "flex", alignItems: "center", gap: 7, border: `1px solid ${T.line}`, borderRadius: 11,
    padding: "9px 14px", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
    background: on ? T.brass : T.surface, color: on ? T.onAccent : T.paper,
  });

  return (
    <div>
      <div style={{ ...aNoteStyle(T), marginBottom: 14 }}>
        تقرير داخلي يُبنى لحظيًا من السجل الحالي. كان زر «ملخص» بترويسة الموقع العام —
        نُقل هنا لأن الزائر ما يحتاجه، وتوسّع ليشمل حركة السجل والأقدم فتحًا ومصدر الإدخال.
      </div>

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => copy("txt")} style={btn(copied === "txt")}>
          <Copy size={14} /> {copied === "txt" ? "تم النسخ" : "نسخ كنص"}
        </button>
        <button onClick={() => copy("md")} style={btn(copied === "md")}>
          <Copy size={14} /> {copied === "md" ? "تم النسخ" : "نسخ Markdown"}
        </button>
        <button onClick={download} style={btn(false)}><Download size={14} /> تنزيل ملف</button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {brief.sections.map((sec, i) => (
          <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 15px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.paper, marginBottom: 8 }}>{sec.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {sec.lines.map((l, j) => (
                <div key={j} style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.8 }}>• {l}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ADMIN_TABS = [
  { key: "dashboard", label: "لوحة القرار", perms: ["view_dashboard"] },
  { key: "sync", label: "المزامنة والبيانات", perms: ["import_excel", "add_inquiry", "edit_inquiry", "delete_inquiry", "flag_urgent"] },
  { key: "analytics", label: "الزيارات والتحليلات", perms: ["view_analytics"] },
  { key: "filters", label: "الفلاتر المخصصة", perms: ["manage_filters"] },
  { key: "notices", label: "الإشعارات", perms: ["manage_notices"] },
  { key: "media", label: "مقاطع النماذج", perms: ["manage_media"] },
  { key: "gallery", label: "معرض الموقع", perms: ["manage_media"] },
  { key: "labels", label: "تسمية الأقسام", perms: ["manage_notices"] },
  { key: "brief", label: "الملخص التنفيذي", perms: ["view_dashboard"] },
  { key: "theme", label: "مظهر الموقع", perms: ["manage_notices"] },
  { key: "audit", label: "سجل النشاط", perms: ["view_audit_log"] },
  { key: "users", label: "المستخدمون", perms: ["edit_permissions", "create_users"] },
];

function AdminHome({ session, onLogout }) {
  const T = useSystemTheme();
  const navLabels = useNavLabels(supabase);
  const [profile, setProfile] = useState(undefined);
  const [inquiries, setInquiries] = useState([]);
  const [progress, setProgress] = useState([]);
  const [categories, setCategories] = useState([]);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("dashboard");

  const refreshProfile = () => supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => setProfile(data || null));
  const refreshInquiries = () => supabase.from("inquiries").select("*").order("id").then(({ data }) => setInquiries(data || []));
  const refreshProgress = () => supabase.from("progress").select("*").order("month").then(({ data }) => setProgress(data || []));
  const refreshCategories = () => supabase.from("filter_categories").select("*").then(({ data }) => setCategories(data || []));

  useEffect(() => { refreshProfile(); refreshInquiries(); refreshProgress(); refreshCategories(); }, [session.user.id]);

  const flashToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };
  const log = async (action, details) => {
    await supabase.from("audit_log").insert({ user_name: profile?.name || session.user.email, action, details });
  };

  if (profile === undefined) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontFamily: "system-ui" }}>جارٍ التحميل...</div>;
  if (!profile) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} dir="rtl">
      <ALocked text={`حسابك (${session.user.email}) مسجّل دخول لكن ما له صلاحيات بعد. أضف صف له بجدول profiles من لوحة Supabase (راجع setup-supabase.sql).`} />
    </div>
  );
  const has = (perm) => (profile.perms || []).includes(perm);
  const visibleTabs = ADMIN_TABS.filter((t) => t.perms.some((p) => has(p)) && (t.key === "labels" || !isHidden(navLabels, t.key)));
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : (visibleTabs[0]?.key || null);
  const liveStats = { total: inquiries.length, open: inquiries.filter((r) => r.closed !== "نعم").length, urgent: inquiries.filter((r) => isFlagLive(r.urgent, r.urgent_until)).length };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "system-ui, sans-serif", color: T.paper }} dir="rtl">
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T.brass + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><ShieldCheck size={17} color={T.brass} /></div>
          <div><div style={{ fontSize: 14, fontWeight: 700 }}>لوحة إدارة ألبورادا</div><div style={{ fontSize: 11, color: T.muted }}>{liveStats.total} استفسار · {liveStats.open} مفتوح · {liveStats.urgent} عاجل</div></div>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.hash = ""; window.location.reload(); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${T.line}`, borderRadius: 10, padding: "7px 12px", fontSize: 12.5, color: T.muted, cursor: "pointer" }}><LogOut size={13} /> خروج</button>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: 6, background: T.sunken, padding: 4, borderRadius: 12, marginBottom: 18, flexWrap: "wrap" }}>
          {visibleTabs.map((t) => (<button key={t.key} onClick={() => setTab(t.key)} style={{ flex: "1 1 auto", border: "none", borderRadius: 9, padding: "9px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: activeTab === t.key ? T.surface : "transparent", color: activeTab === t.key ? T.brass : T.muted, boxShadow: activeTab === t.key ? T.shadow : "none" }}>{NLA(navLabels, t.key, t.label)}</button>))}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 60px" }}>
        {!activeTab && <ALocked text="حسابك ما عنده صلاحية وصول لأي قسم." />}
        {activeTab === "dashboard" && <ADashboardTab inquiries={inquiries} />}
        {activeTab === "sync" && <ASyncTab inquiries={inquiries} refreshInquiries={refreshInquiries} progress={progress} refreshProgress={refreshProgress} categories={categories} refreshCategories={refreshCategories} flashToast={flashToast} canFlag={has("flag_urgent")} canImport={has("import_excel")} canAdd={has("add_inquiry")} canEdit={has("edit_inquiry")} canDelete={has("delete_inquiry")} log={log} />}
        {activeTab === "analytics" && <AAnalyticsTab flashToast={flashToast} canExport={has("export_data")} />}
        {activeTab === "filters" && <AFiltersTab categories={categories} refreshCategories={refreshCategories} flashToast={flashToast} log={log} />}
        {activeTab === "notices" && <ANoticesTab flashToast={flashToast} log={log} />}
        {activeTab === "media" && <AMediaTab flashToast={flashToast} log={log} canManage={has("manage_media")} canStats={has("view_analytics")} />}
        {activeTab === "gallery" && <AGalleryTab supabase={supabase} flashToast={flashToast} log={log} canManage={has("manage_media")} />}
        {activeTab === "labels" && <ALabelsTab supabase={supabase} flashToast={flashToast} log={log} canManage={has("manage_notices")} />}
        {activeTab === "brief" && <ABriefTab inquiries={inquiries} flashToast={flashToast} />}
        {activeTab === "theme" && <AThemeTab flashToast={flashToast} log={log} canManage={has("manage_notices")} />}
        {activeTab === "audit" && <AAuditLogTab />}
        {activeTab === "users" && <AUsersTab profile={profile} flashToast={flashToast} log={log} canCreate={has("create_users")} canEditPerms={has("edit_permissions")} />}
      </div>

      {toast && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.paper, color: T.bg, padding: "11px 20px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 8, boxShadow: T.shadowUp }}><Check size={15} /> {toast}</div>}
    </div>
  );
}

export function AdminApp() {
  const session = useSupaAuth();
  if (session === undefined) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: THEMES.light.muted }}>جارٍ التحقق من الدخول...</div>;
  if (!session) return <AdminLogin />;
  return <AdminHome session={session} />;
}
