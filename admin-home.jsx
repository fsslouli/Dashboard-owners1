/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-home */
import { MfaGate, ASecurityTab, useIdleSignOut } from "./security-kit.jsx";
import { SiteCustomPanel } from "./site-admin.jsx";
import { AdminLogin, isoAdminDate, useSupaAuth, useSystemTheme } from "./admin-core.jsx";
import { ALocked, aNoteStyle } from "./admin-excel-utils.jsx";
import { AMediaTab } from "./admin-media-tab.jsx";
import { AInsightsTab } from "./admin-insights-tab.jsx";
import { AAnalyticsTab, AAuditLogTab, AFiltersTab, ANoticesTab, AUsersTab } from "./admin-tabs-1.jsx";
import { ADashboardTab, AThemeTab } from "./admin-tabs-2.jsx";
import { ASyncTab } from "./admin-trail-sync.jsx";
import { supabase } from "./app-bootstrap.jsx";
import { THEMES, isFlagLive, trSta } from "./site-data.jsx";
import { useEffect, useMemo, useState } from "react";
import { briefToMarkdown, briefToText, buildBrief } from "./admin-brief.js";
import { downloadMeetingSheet, nextMeetingName, openInquiries } from "./admin-meeting-sheet.js";
import { ATelegramCard } from "./admin-telegram.jsx";
import { AGalleryTab } from "./gallery-kit.jsx";
import { AShareTab } from "./admin-share-tab.jsx";
import { ALinksTab } from "./admin-links-tab.jsx";
import { ALabelsTab, isHidden, NLA, useNavLabels } from "./nav-labels-kit.jsx";
import { AdminShell } from "./admin-shell.jsx";
import { Check, Copy, Download, FileSpreadsheet } from "lucide-react";

/* ═══ ورقة الاجتماع القادم (٥.٣.٠) — ملف إكسل بنفس شكل أوراق الاجتماعات بملف الاستفسارات ═══ */
function AMeetingSheet({ inquiries, flashToast, T, btn }) {
  const suggested = useMemo(() => nextMeetingName(inquiries || []), [inquiries]);
  const openCount = useMemo(() => openInquiries(inquiries || []).length, [inquiries]);
  const [name, setName] = useState("");
  const download = () => {
    try {
      const res = downloadMeetingSheet(inquiries || [], { sheetName: name.trim() || suggested, statusLabel: (v) => trSta("ar", v) });
      flashToast(`تم تنزيل «${res.sheetName}» — ${res.count} استفسار مفتوح`);
    } catch (e) { flashToast("تعذّر إنشاء ملف الإكسل"); }
  };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 15px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: T.paper, marginBottom: 6 }}>
        <FileSpreadsheet size={15} color={T.brass} /> ورقة الاجتماع القادم
      </div>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8, marginBottom: 10 }}>
        ملف إكسل بنفس أعمدة وتنسيق أوراق الاجتماعات بملف الاستفسارات، فيه الاستفسارات المفتوحة حاليًا ({openCount}) مرتبة برقمها،
        و«م» هو رقم الاستفسار بالسجل. تضيف عليه بنود الاجتماع الجديدة ثم تنقل الورقة لملفك.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={suggested} aria-label="اسم الورقة"
          style={{ flex: "1 1 180px", minWidth: 0, background: T.bg, color: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "inherit" }} />
        <button onClick={download} disabled={!openCount}
          style={{ ...btn(true), opacity: openCount ? 1 : 0.5, cursor: openCount ? "pointer" : "default" }}>
          <Download size={14} /> تنزيل الورقة
        </button>
      </div>
    </div>
  );
}

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

      <AMeetingSheet inquiries={inquiries} flashToast={flashToast} T={T} btn={btn} />

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
  { key: "insights", label: "التحليلات الشاملة", perms: ["view_insights"] },
  { key: "filters", label: "الفلاتر المخصصة", perms: ["manage_filters"] },
  { key: "notices", label: "الإشعارات", perms: ["manage_notices"] },
  { key: "media", label: "مقاطع النماذج", perms: ["manage_media"] },
  { key: "gallery", label: "معرض الموقع", perms: ["manage_gallery"] },
  { key: "links", label: "الروابط الخارجية", perms: ["manage_links"] },
  { key: "share", label: "روابط المشاركة", perms: ["manage_share"] },
  { key: "site", label: "تخصيص الموقع والنسخ", perms: ["manage_theme"] },
  { key: "labels", label: "تسمية الأقسام", perms: ["manage_theme"] },
  { key: "brief", label: "الملخص التنفيذي", perms: ["view_dashboard"] },
  { key: "theme", label: "مظهر الموقع", perms: ["manage_theme"] },
  { key: "audit", label: "سجل النشاط", perms: ["view_audit_log"] },
  { key: "users", label: "المستخدمون", perms: ["edit_permissions", "create_users"] },
  { key: "security", label: "الأمان", perms: null },
];

function AdminHome({ session, onLogout }) {
  const T = useSystemTheme();
  const navLabels = useNavLabels(supabase);
  const [profile, setProfile] = useState(undefined);
  const [inquiries, setInquiries] = useState([]);
  const [progress, setProgress] = useState([]);
  const [categories, setCategories] = useState([]);
  const [toast, setToast] = useState("");
  /* ‎#admin/<مفتاح>‎ يفتح التبويب مباشرة (يستخدمه وضع التحرير للاختصارات) */
  const [tab, setTabState] = useState(() => { const m = window.location.hash.match(/^#admin\/([a-z]+)/); return m ? m[1] : "dashboard"; });
  const setTab = (k) => { setTabState(k); try { window.history.replaceState(null, "", `#admin/${k}`); } catch (e) { /* ممنوع */ } };

  const refreshProfile = () => supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => setProfile(data || null));
  const refreshInquiries = () => supabase.from("inquiries").select("*").order("id").then(({ data }) => setInquiries(data || []));
  const refreshProgress = () => supabase.from("progress").select("*").order("month").then(({ data }) => setProgress(data || []));
  const refreshCategories = () => supabase.from("filter_categories").select("*").then(({ data }) => setCategories(data || []));

  useIdleSignOut();
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
  const visibleTabs = ADMIN_TABS.filter((t) => (t.perms === null || t.perms.some((p) => has(p))) && (t.key === "labels" || t.key === "gallery" || !isHidden(navLabels, t.key)));
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : (visibleTabs[0]?.key || null);
  const liveStats = { total: inquiries.length, open: inquiries.filter((r) => r.closed !== "نعم").length, urgent: inquiries.filter((r) => isFlagLive(r.urgent, r.urgent_until)).length };

  /* وضع التحرير المباشر يحتاج صلاحية محتوى واحدة على الأقل */
  const EDIT_PERMS = ["edit_inquiry", "add_inquiry", "delete_inquiry", "manage_gallery", "manage_media", "manage_links", "manage_notices", "manage_theme", "manage_filters", "import_excel"];
  const canEditSite = EDIT_PERMS.some((p) => has(p));
  const shellTabs = visibleTabs.map((t) => ({ key: t.key, label: NLA(navLabels, t.key, t.label) }));

  return (
    <>
      <AdminShell T={T} tabs={shellTabs} activeKey={activeTab} onSelect={setTab} stats={liveStats}
        userLabel={profile?.name || session.user.email}
        onLogout={async () => { await supabase.auth.signOut(); window.location.hash = ""; window.location.reload(); }}
        onEditSite={canEditSite ? () => { window.location.hash = "#edit"; } : null}>
        {!activeTab && <ALocked text="حسابك ما عنده صلاحية وصول لأي قسم." />}
        {activeTab === "dashboard" && <ADashboardTab inquiries={inquiries} />}
        {activeTab === "sync" && <ASyncTab inquiries={inquiries} refreshInquiries={refreshInquiries} progress={progress} refreshProgress={refreshProgress} categories={categories} refreshCategories={refreshCategories} flashToast={flashToast} canFlag={has("flag_urgent")} canImport={has("import_excel")} canRestore={has("restore_backup")} canAdd={has("add_inquiry")} canEdit={has("edit_inquiry")} canDelete={has("delete_inquiry")} log={log} />}
        {activeTab === "analytics" && <AAnalyticsTab flashToast={flashToast} canExport={has("export_data")} />}
        {activeTab === "insights" && <AInsightsTab flashToast={flashToast} canExport={has("export_data")} canPurge={has("purge_analytics")} log={log} />}
        {activeTab === "filters" && <AFiltersTab categories={categories} refreshCategories={refreshCategories} flashToast={flashToast} log={log} />}
        {activeTab === "notices" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <ANoticesTab flashToast={flashToast} log={log} />
            <ATelegramCard inquiries={inquiries} flashToast={flashToast} log={log} />
          </div>
        )}
        {activeTab === "media" && <AMediaTab flashToast={flashToast} log={log} canManage={has("manage_media")} canStats={has("view_analytics")} />}
        {activeTab === "gallery" && <AGalleryTab supabase={supabase} flashToast={flashToast} log={log} canManage={has("manage_gallery")} />}
        {activeTab === "links" && <ALinksTab supabase={supabase} flashToast={flashToast} log={log} canManage={has("manage_links")} />}
        {activeTab === "share" && <AShareTab supabase={supabase} flashToast={flashToast} log={log} canManage={has("manage_share")} by={profile?.name || session.user.email} />}
        {activeTab === "site" && <SiteCustomPanel supabase={supabase} T={T} log={log} toast={flashToast} canManage={has("manage_theme")} />}
        {activeTab === "labels" && <ALabelsTab supabase={supabase} flashToast={flashToast} log={log} canManage={has("manage_theme")} />}
        {activeTab === "brief" && <ABriefTab inquiries={inquiries} flashToast={flashToast} />}
        {activeTab === "theme" && <AThemeTab flashToast={flashToast} log={log} canManage={has("manage_theme")} />}
        {activeTab === "audit" && <AAuditLogTab />}
        {activeTab === "security" && <ASecurityTab flashToast={flashToast} log={log} email={session.user.email} />}
        {activeTab === "users" && <AUsersTab profile={profile} flashToast={flashToast} log={log} canCreate={has("create_users")} canEditPerms={has("edit_permissions")} />}
      </AdminShell>

      {toast && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.paper, color: T.bg, padding: "11px 20px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 8, boxShadow: T.shadowUp, zIndex: 70 }}><Check size={15} /> {toast}</div>}
    </>
  );
}

export function AdminApp() {
  const session = useSupaAuth();
  if (session === undefined) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: THEMES.light.muted }}>جارٍ التحقق من الدخول...</div>;
  if (!session) return <AdminLogin />;
  return <MfaGate><AdminHome session={session} /></MfaGate>;
}
