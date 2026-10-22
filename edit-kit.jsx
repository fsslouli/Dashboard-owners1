/* ═══════════════════════════════════════════════════════════
   edit-kit.jsx — وضع «تحرير الموقع مباشرة» (٦.٠.٠)
   الرابط: ‎#edit‎ — يعرض الموقع العام نفسه بتصميمه الحالي، وفوقه أدوات تحكم
   حسب صلاحيات حسابك بالضبط (نفس صلاحيات لوحة الإدارة، والخادم هو اللي يفرضها).

   • الاستفسارات: تعديل / تكرار / حذف من كل بطاقة وصف، + إضافة جديد.
   • التبويبات: إعادة تسمية (عربي/English)، إخفاء/إظهار، وترتيب بالسحب.
   • اختصارات: قفز مباشر لأي تبويب إدارة (المعرض، الروابط، المقاطع…).
   • (٦.٠.٠) تبويبات جديدة، كتل محتوى، تسمية أي نص، إخفاء أي قسم بالنقر، تثبيت استفسارات،
     ودرج «إدارة المحتوى» فيه كل أدوات اللوحة + مركز «تخصيص الموقع والنسخ».

   يُحمَّل بحزمة منفصلة؛ الزائر العادي ما ينزّل منه شي.
   ═══════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, GripVertical, LayoutDashboard, LogOut, Pencil, PlusCircle, RotateCcw, ShieldCheck, Trash2, Type, X, EyeOff as HideIcon,
  Settings2, Pin, PinOff, SquareDashedMousePointer, Plus, Undo2,
} from "lucide-react";
import { createPortal } from "react-dom";
import { supabase } from "./app-bootstrap.jsx";
import { EditCtx, useEdit } from "./edit-ctx.js";
import { AMediaTab } from "./admin-media-tab.jsx";
import { AFiltersTab, ANoticesTab } from "./admin-tabs-1.jsx";
import { AThemeTab } from "./admin-tabs-2.jsx";
import { AGalleryTab } from "./gallery-kit.jsx";
import { ALinksTab } from "./admin-links-tab.jsx";
import { AShareTab } from "./admin-share-tab.jsx";
import { ALabelsTab } from "./nav-labels-kit.jsx";
import { BlocksEditor } from "./blocks-editor.jsx";
import { SiteCustomPanel, addCustomTab, deleteCustomTab, docName, toggleHiddenSec, togglePin } from "./site-admin.jsx";
import { CUSTOM_TAB_ICONS, MAX_CUSTOM_TABS, hiddenSecsOf } from "./site-custom.js";
import { useIdleSignOut, MfaGate } from "./security-kit.jsx";
import { ADMIN_BLANK_INQ, ADMIN_FIELD_LABEL, INQ_FIELDS_ADMIN, toDbBool, toYesNo, useSupaAuth, useSystemTheme } from "./admin-core.jsx";
import { afieldInput, canonicalizeRow } from "./admin-excel-utils.jsx";
import { AAttachmentsPanel, ATT_BUCKET } from "./attach-kit.jsx";
import { AInquiryTrail } from "./admin-trail-sync.jsx";
import { SchedBtn } from "./schedule-kit.jsx";
import { CAT_ORDER, OWNER_TITLE_ORDER, PARTY_ORDER } from "./site-data.jsx";
import { NAV_ORDER_KEY, dropLocalHistory, orderedKeys, patchNavLabels, readLocalHistory, useNavLabels } from "./nav-labels-kit.jsx";
import { autoTranslateAr } from "./translate-kit.js";
import { syncLabelTranslations } from "./label-i18n.js";
import { isNumericText, normText, originalTextOf } from "./text-overrides.js";

const go = (hash) => { window.location.hash = hash; };

/* ── شاشة بوابة: لازم جلسة + ملف صلاحيات ── */
function Center({ T, children }) {
  return (
    <div dir="rtl" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, background: T.bg, color: T.muted, fontFamily: "system-ui, sans-serif", fontSize: 14, textAlign: "center" }}>
      {children}
    </div>
  );
}

/* ═══ مزوّد وضع التحرير ═══ */
export function EditProvider(props) {
  return <MfaGate><EditProviderInner {...props} /></MfaGate>;
}
function EditProviderInner({ children }) {
  const T = useSystemTheme();
  const session = useSupaAuth();
  useIdleSignOut(undefined, !!session);
  const [profile, setProfile] = useState(undefined);
  const [categories, setCategories] = useState([]);
  const [hasCatCol, setHasCatCol] = useState(true);
  const [hasPartyCol, setHasPartyCol] = useState(true); // عمود party (6.4.0) — لو الهجرة ما انطبّقت يُشال من الكتابة بدل ما تفشل
  const [hasOwnerTitleCol, setHasOwnerTitleCol] = useState(true); // عمود owner_title (6.7.0) — نفس الحماية
  const [sheet, setSheet] = useState(null);
  /* وضع نقر واحد فقط بنفس الوقت: تسمية النصوص أو إخفاء الأقسام */
  const [clickMode, setClickMode] = useState(null);
  const renaming = clickMode === "rename";
  const sectioning = clickMode === "sections";
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!session) { setProfile(session === null ? null : undefined); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => setProfile(data || null));
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile) return;
    supabase.from("filter_categories").select("*").then(({ data }) => setCategories(data || []));
    supabase.from("inquiries").select("cat").limit(1).then(({ error }) => { if (error) setHasCatCol(false); });
    supabase.from("inquiries").select("party").limit(1).then(({ error }) => { if (error) setHasPartyCol(false); });
    supabase.from("inquiries").select("owner_title").limit(1).then(({ error }) => { if (error) setHasOwnerTitleCol(false); });
  }, [profile]);

  const toast = useCallback((m) => {
    setToastMsg(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2800);
  }, []);
  const has = useCallback((p) => !!profile && (profile.perms || []).includes(p), [profile]);
  /* 6.8.0 — عند دخول مشرف له صلاحية تخصيص الموقع: أي قيمة جديدة بلا ترجمة تُترجم وتنحفظ تلقائيًا */
  useEffect(() => {
    if (!profile || !(profile.perms || []).includes("manage_theme")) return;
    const t = setTimeout(() => { syncLabelTranslations(supabase).then((r) => { if (r?.added) toast(`تُرجمت ${r.added} قيمة جديدة تلقائيًا`); }); }, 2500);
    return () => clearTimeout(t);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps
  const log = useCallback(async (action, details) => {
    try { await supabase.from("audit_log").insert({ user_name: profile?.name || session?.user?.email, action, details }); } catch (_) { /* السجل ما يوقف العمل */ }
  }, [profile, session]);

  const removeInquiry = useCallback(async (r) => {
    const { error } = await supabase.from("inquiries").delete().eq("id", r.id);
    if (error) { toast("تعذّر الحذف: " + (error.message || "تأكد من صلاحيتك")); return false; }
    /* المرفقات بدون مفتاح أجنبي — تُحذف يدويًا مع ملفاتها، نفس منطق لوحة الإدارة */
    try {
      const { data: gone } = await supabase.from("inquiry_attachments").delete().eq("inquiry_id", r.id).select("id,storage_path,thumb_path");
      const paths = (gone || []).flatMap((a) => [a.storage_path, a.thumb_path]).filter(Boolean);
      if (paths.length) supabase.storage.from(ATT_BUCKET).remove(paths);
    } catch (_) { /* الجدول غير موجود بعد */ }
    log("حذف استفسار (وضع التحرير)", `#${r.id} — ${(r.note || "").slice(0, 40)}`);
    toast(`حُذف الاستفسار #${r.id}`);
    return true;
  }, [log, toast]);

  const duplicateInquiry = useCallback(async (r) => {
    const { data: src, error: e1 } = await supabase.from("inquiries").select("*").eq("id", r.id).single();
    if (e1 || !src) { toast("تعذّر قراءة الاستفسار"); return; }
    const { data: top } = await supabase.from("inquiries").select("id").order("id", { ascending: false }).limit(1);
    const nextId = (top && top[0] ? top[0].id : 0) + 1;
    const fields = {};
    INQ_FIELDS_ADMIN.concat(["reply_en"]).forEach((k) => { if (k in src && (k !== "cat" || hasCatCol) && (k !== "party" || hasPartyCol) && (k !== "owner_title" || hasOwnerTitleCol)) fields[k] = src[k]; });
    const { error } = await supabase.from("inquiries").insert({ ...fields, id: nextId, urgent: false, closed: "لا" });
    if (error) { toast("تعذّر التكرار: " + (error.message || "")); return; }
    log("تكرار استفسار (وضع التحرير)", `#${r.id} ← #${nextId}`);
    toast(`أُنشئ #${nextId} نسخةً من #${r.id}`);
  }, [hasCatCol, hasPartyCol, hasOwnerTitleCol, log, toast]);

  const value = useMemo(() => ({
    on: true, T, supabase, profile, has, log, toast, categories, hasCatCol, hasPartyCol, hasOwnerTitleCol,
    openEditor: (target) => setSheet(target),
    renaming, toggleRename: () => setClickMode((m) => (m === "rename" ? null : "rename")),
    sectioning, toggleSections: () => setClickMode((m) => (m === "sections" ? null : "sections")),
    removeInquiry, duplicateInquiry,
    CardActions, TabsEditor, BlocksEditor,
  }), [T, profile, has, log, toast, categories, hasCatCol, hasPartyCol, hasOwnerTitleCol, removeInquiry, duplicateInquiry, renaming, sectioning]);

  if (session === undefined || (session && profile === undefined)) return <Center T={T}>جارٍ التحقق من صلاحياتك…</Center>;
  if (!session) {
    return (
      <Center T={T}>
        <ShieldCheck size={28} color={T.brass} />
        <div style={{ color: T.paper, fontWeight: 700, fontSize: 16 }}>وضع التحرير يحتاج تسجيل دخول</div>
        <button onClick={() => go("#admin")} style={{ border: 0, borderRadius: 12, padding: "11px 20px", background: T.brass, color: T.onAccent, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>تسجيل الدخول</button>
        <button onClick={() => go("")} style={{ border: 0, background: "none", color: T.muted, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>العودة للموقع</button>
      </Center>
    );
  }
  if (!profile) {
    return (
      <Center T={T}>
        <div>حسابك مسجّل دخول لكن ما له صلاحيات بعد.</div>
        <button onClick={() => go("")} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 18px", background: "none", color: T.muted, fontFamily: "inherit", cursor: "pointer" }}>العودة للموقع</button>
      </Center>
    );
  }

  return (
    <EditCtx.Provider value={value}>
      {children}
      <EditBar />
      {sheet && <InquirySheet target={sheet} onClose={() => setSheet(null)} />}
      {renaming && has("manage_theme") && <RenameLayer />}
      {sectioning && has("manage_theme") && <SectionsLayer />}
      {toastMsg && (
        <div role="status" data-edit-ui style={{ position: "fixed", bottom: 78, left: "50%", transform: "translateX(-50%)", zIndex: 120, background: T.paper, color: T.bg, padding: "10px 18px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 8, boxShadow: T.shadowUp }}>
          <Check size={15} /> {toastMsg}
        </div>
      )}
    </EditCtx.Provider>
  );
}

/* ═══ الشريط العائم ═══ */
/* ═══ درج إدارة المحتوى — نفس أدوات اللوحة، لكن فوق الموقع مباشرة ═══ */
const MANAGE_SECTIONS = [
  { key: "site", label: "تخصيص الموقع والنسخ", perm: "manage_theme" },
  { key: "gallery", label: "المعرض", perm: "manage_gallery" },
  { key: "links", label: "الروابط", perm: "manage_links" },
  { key: "media", label: "مقاطع النماذج", perm: "manage_media" },
  { key: "notices", label: "الإشعارات", perm: "manage_notices" },
  { key: "filters", label: "الفلاتر", perm: "manage_filters" },
  { key: "theme", label: "المظهر", perm: "manage_theme" },
  { key: "labels", label: "أسماء الأقسام", perm: "manage_theme" },
  { key: "share", label: "روابط المشاركة", perm: "manage_share" },
];
function ManageDrawer({ onClose }) {
  const ed = useEdit();
  const { T, supabase, has, log, toast } = ed;
  const secs = MANAGE_SECTIONS.filter((x) => has(x.perm));
  const [k, setK] = useState(secs[0]?.key);
  const [cats, setCats] = useState(ed.categories);
  const refreshCats = () => supabase.from("filter_categories").select("*").then(({ data }) => setCats(data || []));
  const by = ed.profile?.name || "";
  return (
    <div data-edit-ui dir="rtl" style={{ position: "fixed", top: 0, bottom: 0, insetInlineEnd: 0, width: "min(620px, 100vw)", zIndex: 130, background: T.bg, borderInlineStart: `1px solid ${T.line}`, boxShadow: T.shadowUp, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", color: T.paper }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${T.line}` }}>
        <b style={{ fontSize: 14, flex: 1 }}>إدارة المحتوى</b>
        <button onClick={onClose} aria-label="إغلاق" style={{ border: 0, background: "none", cursor: "pointer", color: T.muted }}><X size={18} /></button>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto", borderBottom: `1px solid ${T.line}` }}>
        {secs.map((x) => (
          <button key={x.key} onClick={() => setK(x.key)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${k === x.key ? T.brass : T.line}`, background: k === x.key ? T.brass + "22" : "transparent", color: T.paper, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>{x.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {k === "site" && <SiteCustomPanel supabase={supabase} T={T} log={log} toast={toast} canManage={has("manage_theme")} />}
        {k === "gallery" && <AGalleryTab supabase={supabase} flashToast={toast} log={log} canManage={has("manage_gallery")} />}
        {k === "links" && <ALinksTab supabase={supabase} flashToast={toast} log={log} canManage={has("manage_links")} />}
        {k === "media" && <AMediaTab flashToast={toast} log={log} canManage={has("manage_media")} canStats={has("view_analytics")} />}
        {k === "notices" && <ANoticesTab flashToast={toast} log={log} />}
        {k === "filters" && <AFiltersTab categories={cats} refreshCategories={refreshCats} flashToast={toast} log={log} />}
        {k === "theme" && <AThemeTab flashToast={toast} log={log} canManage={has("manage_theme")} />}
        {k === "labels" && <ALabelsTab supabase={supabase} flashToast={toast} log={log} canManage={has("manage_theme")} />}
        {k === "share" && <AShareTab supabase={supabase} flashToast={toast} log={log} canManage={has("manage_share")} by={by} />}
        {!k && <p style={{ color: T.muted }}>ما عندك صلاحية على أي قسم هنا.</p>}
      </div>
    </div>
  );
}

function EditBar() {
  const ed = useEdit();
  const { T } = ed;
  const [manage, setManage] = useState(false);
  const canManage = MANAGE_SECTIONS.some((x) => ed.has(x.perm));
  /* زر «تراجع»: يرجّع تخصيصات الموقع لآخر نسخة قبل آخر تعديل سوّيته من هذا المتصفح */
  const [histN, setHistN] = useState(() => readLocalHistory().length);
  const [undoing, setUndoing] = useState(false);
  useEffect(() => {
    const on = () => setHistN(readLocalHistory().length);
    window.addEventListener("site-custom-history", on); window.addEventListener("storage", on);
    return () => { window.removeEventListener("site-custom-history", on); window.removeEventListener("storage", on); };
  }, []);
  const undo = async () => {
    const [last] = readLocalHistory();
    if (!last || undoing) return;
    setUndoing(true);
    const { error } = await supabase.from("site_settings").update({ nav_labels: last.nav_labels || {} }).eq("id", 1);
    setUndoing(false);
    if (error) { ed.toast("تعذّر التراجع: " + (error.message || "")); return; }
    dropLocalHistory(last.id);
    ed.log("تراجع عن آخر تعديل بالموقع", last.actor || "");
    ed.toast(`تم التراجع عن: ${last.actor || "آخر تعديل"}`);
  };
  const btn = (primary) => ({
    display: "flex", alignItems: "center", gap: 6, border: primary ? 0 : `1px solid ${T.line}`, borderRadius: 999, padding: "9px 14px",
    background: primary ? T.brass : "transparent", color: primary ? T.onAccent : T.paper, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  });
  return (
    <div dir="rtl" data-edit-ui role="toolbar" aria-label="أدوات وضع التحرير" className="no-print"
      style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 110, maxWidth: "calc(100vw - 20px)", overflowX: "auto",
        display: "flex", alignItems: "center", gap: 6, padding: 6, borderRadius: 999, background: T.surface, border: `1px solid ${T.brass}66`, boxShadow: T.shadowUp, fontFamily: "system-ui, sans-serif" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", fontSize: 12, fontWeight: 800, color: T.brass, whiteSpace: "nowrap" }}><Pencil size={13} /> وضع التحرير</span>
      {ed.has("add_inquiry") && <button style={btn(true)} onClick={() => ed.openEditor({ mode: "new" })}><PlusCircle size={14} /> استفسار</button>}
      {ed.has("manage_theme") && (
        <button style={{ ...btn(ed.renaming), ...(ed.renaming ? { background: T.brass + "22", borderColor: T.brass } : {}) }} onClick={ed.toggleRename} aria-pressed={ed.renaming}><Type size={14} /> تسمية النصوص</button>
      )}
      {ed.has("manage_theme") && (
        <button style={{ ...btn(ed.sectioning), ...(ed.sectioning ? { background: T.brass + "22", borderColor: T.brass } : {}) }} onClick={ed.toggleSections} aria-pressed={ed.sectioning}><SquareDashedMousePointer size={14} /> إخفاء أقسام</button>
      )}
      {ed.has("manage_theme") && histN > 0 && <button style={btn(false)} disabled={undoing} onClick={undo} title="يرجّع تخصيصات الموقع (تبويبات، كتل، نصوص، أقسام، تثبيت) لما قبل آخر تعديل سوّيته من هذا المتصفح"><Undo2 size={14} /> تراجع</button>}
      {canManage && <button style={btn(false)} onClick={() => setManage(true)}><Settings2 size={14} /> إدارة المحتوى</button>}
      <button style={btn(false)} onClick={() => go("#admin")}><LayoutDashboard size={14} /> اللوحة</button>
      <button style={btn(false)} onClick={() => go("")}><LogOut size={14} /> خروج</button>
      {manage && createPortal(<ManageDrawer onClose={() => setManage(false)} />, document.body)}
    </div>
  );
}

/* ═══ أزرار كل بطاقة/صف استفسار ═══ */
function CardActions({ r, inline = false }) {
  const ed = useEdit();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ed) return null;
  const { T } = ed;
  const stop = (e) => e.stopPropagation();
  const b = { display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.muted, cursor: "pointer", padding: 0 };
  const canEdit = ed.has("edit_inquiry"), canAdd = ed.has("add_inquiry"), canDel = ed.has("delete_inquiry"), canPin = ed.has("manage_theme");
  if (!canEdit && !canAdd && !canDel && !canPin) return null;
  const doPin = async () => {
    setBusy(true);
    const { error } = await togglePin(supabase, r.id);
    setBusy(false);
    if (error) { ed.toast("تعذّر التثبيت: " + (error.message || "")); return; }
    ed.log(r.isPinned ? "إلغاء تثبيت استفسار" : "تثبيت استفسار بالأعلى", `#${r.id}`);
    ed.toast(r.isPinned ? `انلغى تثبيت #${r.id}` : `تثبّت #${r.id} بأعلى القائمة`);
  };
  const doDelete = async () => { setBusy(true); await ed.removeInquiry(r); setBusy(false); setAsk(false); };
  const wrap = inline ? { display: "flex", gap: 4, marginTop: 6 } : { position: "absolute", top: 8, insetInlineStart: 8, zIndex: 4, display: "flex", gap: 4 };
  return (
    <div dir="rtl" data-edit-ui style={wrap} onClick={stop} onKeyDown={stop}>
      {ask ? (
        <>
          <button style={{ ...b, width: "auto", padding: "0 10px", background: "#C0392B", borderColor: "#C0392B", color: "#fff", fontSize: 11.5, fontFamily: "inherit" }} disabled={busy} onClick={doDelete}>{busy ? "…" : "تأكيد الحذف"}</button>
          <button style={b} onClick={() => setAsk(false)} aria-label="إلغاء"><X size={13} /></button>
        </>
      ) : (
        <>
          {canPin && <button style={{ ...b, ...(r.isPinned ? { color: T.brass, borderColor: T.brass } : {}) }} disabled={busy} title={r.isPinned ? "إلغاء التثبيت" : "تثبيت بأعلى القائمة"} aria-label={r.isPinned ? `إلغاء تثبيت ${r.id}` : `تثبيت ${r.id}`} onClick={doPin}>{r.isPinned ? <PinOff size={13} /> : <Pin size={13} />}</button>}
          {canEdit && <button style={b} title="تعديل" aria-label={`تعديل الاستفسار ${r.id}`} onClick={() => ed.openEditor({ mode: "edit", id: r.id })}><Pencil size={13} /></button>}
          {canAdd && <button style={b} title="تكرار" aria-label={`تكرار الاستفسار ${r.id}`} onClick={() => ed.duplicateInquiry(r)}><Copy size={13} /></button>}
          {canDel && <button style={{ ...b, color: "#C0392B" }} title="حذف" aria-label={`حذف الاستفسار ${r.id}`} onClick={() => setAsk(true)}><Trash2 size={13} /></button>}
        </>
      )}
    </div>
  );
}

/* ═══ نموذج تعديل/إضافة استفسار (درج جانبي) ═══ */
function InquirySheet({ target, onClose }) {
  const ed = useEdit();
  const { T, categories, hasCatCol, hasPartyCol, hasOwnerTitleCol } = ed;
  const isNew = target.mode === "new";
  const [form, setForm] = useState(isNew ? { ...ADMIN_BLANK_INQ } : null);
  const [orig, setOrig] = useState(null); /* النسخة المحمّلة من القاعدة — لكشف الترجمة القديمة (6.8.0) */
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    supabase.from("inquiries").select("*").eq("id", target.id).single().then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) { setErr("تعذّر تحميل الاستفسار"); return; }
      setOrig(data);
      setForm({ ...data, answered: toYesNo(data.answered) });
    });
    return () => { alive = false; };
  }, [isNew, target.id]);

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const catVals = (key, fallback) => {
    const c = (categories || []).find((x) => x.key === key);
    return c && c.values && c.values.length ? c.values : fallback;
  };
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = isNew ? ed.has("add_inquiry") : ed.has("edit_inquiry");

  const translateMissing = async (obj) => {
    const out = { ...obj };
    /* 6.8.0 — لو تغيّر النص العربي والإنجليزي ما لمسه أحد، الإنجليزي القديم يُفرَّغ ويُعاد ترجمته */
    if (orig) {
      const same = (x, y) => (x || "") === (y || "");
      if (!same(out.note, orig.note) && same(out.note_en, orig.note_en)) out.note_en = "";
      if (!same(out.reply, orig.reply) && same(out.reply_en, orig.reply_en)) out.reply_en = "";
    }
    if (out.note && !out.note_en) { const t = await autoTranslateAr(supabase, out.note); if (t) out.note_en = t; }
    if (out.reply && !out.reply_en) { const t = await autoTranslateAr(supabase, out.reply); if (t) out.reply_en = t; }
    return out;
  };

  const buildFields = async () => {
    const clean = await translateMissing(canonicalizeRow(form, categories));
    const fields = {};
    INQ_FIELDS_ADMIN.concat(["reply_en"]).forEach((k) => { if (k in clean && (k !== "cat" || hasCatCol) && (k !== "party" || hasPartyCol) && (k !== "owner_title" || hasOwnerTitleCol)) fields[k] = clean[k]; });
    fields.answered = toDbBool(clean.answered);
    return fields;
  };
  /* جدولة: نفس التعديل لكن ما ينكتب للجدول الحي إلا بالوقت المحدد */
  const getSchedPatch = async () => {
    if (!form.note?.trim()) { setErr("لازم نص الملاحظة على الأقل"); return null; }
    const fields = await buildFields();
    return { patch: isNew ? { ...fields, urgent: false } : fields, label: `${isNew ? "إضافة" : "تعديل"} استفسار${isNew ? "" : " #" + target.id}: ${form.note.slice(0, 50)}` };
  };

  const save = async () => {
    if (!form.note?.trim()) { setErr("لازم نص الملاحظة على الأقل"); return; }
    setErr(""); setBusy(true);
    const fields = await buildFields();
    let error;
    if (isNew) {
      const { data: top } = await supabase.from("inquiries").select("id").order("id", { ascending: false }).limit(1);
      const nextId = (top && top[0] ? top[0].id : 0) + 1;
      ({ error } = await supabase.from("inquiries").insert({ ...fields, id: nextId, urgent: false }));
      if (!error) { ed.log("إضافة استفسار (وضع التحرير)", `#${nextId} — ${form.note.slice(0, 40)}`); ed.toast(`أُضيف الاستفسار #${nextId}`); }
    } else {
      ({ error } = await supabase.from("inquiries").update(fields).eq("id", target.id));
      if (!error) { ed.log("تعديل استفسار (وضع التحرير)", `#${target.id} — ${form.note.slice(0, 40)}`); ed.toast("تم الحفظ"); }
    }
    setBusy(false);
    if (error) { setErr("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return; }
    if (ed.has("manage_theme")) syncLabelTranslations(supabase); /* اسم/منصب/قيمة جديدة ← ترجمة تلقائية بالخلفية */
    onClose();
  };

  return (
    <div dir="rtl" data-edit-ui style={{ position: "fixed", inset: 0, zIndex: 130, display: "flex", justifyContent: "flex-start" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} />
      <aside role="dialog" aria-modal="true" aria-label={isNew ? "إضافة استفسار" : `تعديل الاستفسار ${target.id}`}
        style={{ position: "relative", width: "min(560px,100vw)", height: "100%", overflowY: "auto", background: T.surface, color: T.paper, borderInlineEnd: `1px solid ${T.line}`, boxShadow: T.shadowUp, padding: 18, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{isNew ? "إضافة استفسار" : `تعديل الاستفسار #${target.id}`}</div>
          <button onClick={onClose} aria-label="إغلاق" style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.line}`, background: "none", color: T.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>
        {!form ? (
          <div style={{ padding: 24, color: err ? "#C0392B" : T.muted, fontSize: 13 }}>{err || "جارٍ التحميل…"}</div>
        ) : (
          <>
            {!isNew && <AInquiryTrail id={target.id} row={form} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {afieldInput(ADMIN_FIELD_LABEL.model, form.model, set("model"), null, catVals("model", []))}
              {afieldInput(ADMIN_FIELD_LABEL.loc, form.loc, set("loc"), null, catVals("loc", []))}
              {afieldInput(ADMIN_FIELD_LABEL.pri, form.pri, set("pri"), catVals("pri", ["عالية جدًا", "عالية", "متوسطة", "عادية"]))}
              {hasCatCol && afieldInput(ADMIN_FIELD_LABEL.cat, form.cat ?? "", set("cat"), ["", ...catVals("cat", CAT_ORDER)])}
              {hasPartyCol && afieldInput(ADMIN_FIELD_LABEL.party, form.party ?? "", set("party"), ["", ...PARTY_ORDER])}
              {afieldInput(ADMIN_FIELD_LABEL.status, form.status, set("status"), catVals("status", ["معتمدة", "قيد الدراسة", "تم التصويت", "تم الرفض"]))}
              {afieldInput(ADMIN_FIELD_LABEL.owner, form.owner, set("owner"), null, catVals("owner", []))}
              {hasOwnerTitleCol && afieldInput(ADMIN_FIELD_LABEL.owner_title, form.owner_title ?? "", set("owner_title"), null, catVals("owner_title", OWNER_TITLE_ORDER))}
              {afieldInput(ADMIN_FIELD_LABEL.month, form.month, set("month"))}
              {afieldInput(ADMIN_FIELD_LABEL.closed, form.closed, set("closed"), ["نعم", "لا"])}
              {afieldInput(ADMIN_FIELD_LABEL.answered, form.answered, set("answered"), ["نعم", "لا"])}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {afieldInput(ADMIN_FIELD_LABEL.note, form.note, set("note"))}
              {afieldInput(ADMIN_FIELD_LABEL.note_en, form.note_en, set("note_en"))}
              {afieldInput(ADMIN_FIELD_LABEL.reply, form.reply, set("reply"))}
            </div>
            {isNew ? (
              <div style={{ marginBottom: 14, fontSize: 12.5, color: T.muted, lineHeight: 1.9, border: `1px dashed ${T.line}`, borderRadius: 12, padding: "10px 12px" }}>
                المرفقات (PDF، فيديو، صور، روابط) تنضاف بعد الحفظ: احفظ الاستفسار أولًا ثم افتح «تعديل».
              </div>
            ) : (
              <AAttachmentsPanel supabase={supabase} inquiryId={target.id} T={T} flashToast={ed.toast} log={ed.log} canEdit={ed.has("edit_inquiry")} />
            )}
            {err && <div role="alert" style={{ color: "#C0392B", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, position: "sticky", bottom: 0, background: T.surface, padding: "10px 0 2px" }}>
              <button onClick={save} disabled={busy || !canSave} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy || !canSave ? 0.6 : 1, fontFamily: "inherit" }}><Check size={15} /> {busy ? "جارٍ الحفظ…" : "حفظ"}</button>
              {canSave && <SchedBtn T={T} table="inquiries" id={isNew ? null : target.id} op={isNew ? "insert" : "update"} getPatch={getSchedPatch} label="جدولة استفسار" text="جدولة النشر" flash={ed.toast} onDone={onClose}
                style={{ display: "flex", alignItems: "center", background: "none", color: T.brass, border: `1px solid ${T.brass}66`, borderRadius: 11, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }} />}
              <button onClick={onClose} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ═══ محرّر التبويبات: تسمية + إخفاء + ترتيب بالسحب، واختصارات الإدارة ═══ */
const SHORTCUTS = [
  { tab: "gallery", label: "المعرض (مواضيع وصور)", perms: ["manage_gallery"] },
  { tab: "links", label: "الروابط الخارجية", perms: ["manage_links"] },
  { tab: "media", label: "مقاطع النماذج", perms: ["manage_media"] },
  { tab: "notices", label: "الإشعارات", perms: ["manage_notices"] },
  { tab: "filters", label: "الفلاتر المخصصة", perms: ["manage_filters"] },
  { tab: "sync", label: "المزامنة وتقدّم التنفيذ", perms: ["import_excel", "edit_inquiry", "add_inquiry"] },
  { tab: "theme", label: "مظهر الموقع", perms: ["manage_theme"] },
  { tab: "share", label: "روابط المشاركة", perms: ["manage_share"] },
];

function TabRow({ d, saved, hidden, canEdit, idx, last, T, onCommit, onToggle, onReset, onMove, onIcon, onDelete, drag }) {
  const baseAr = d.custom ? d.ar : (saved.ar ?? "");
  const baseEn = d.custom ? d.en : (saved.en ?? "");
  const [ar, setAr] = useState(baseAr);
  const [en, setEn] = useState(baseEn);
  useEffect(() => { setAr(baseAr); setEn(baseEn); }, [baseAr, baseEn]);
  const dirty = ar !== baseAr || en !== baseEn;
  const inp = { width: "100%", minWidth: 0, boxSizing: "border-box", border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, borderRadius: 8, padding: "6px 9px", fontSize: 13, fontFamily: "inherit" };
  const ib = { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: 8, background: "transparent", color: T.muted, cursor: "pointer", padding: 0, flexShrink: 0 };
  const commit = () => onCommit(d, { ar: ar.trim(), en: en.trim() });
  const onKey = (e) => { if (e.key === "Enter") commit(); };
  return (
    <div draggable={canEdit} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; drag.start(d.key); }} onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); drag.drop(d.key); }} onDragEnd={drag.end}
      style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) minmax(0,1fr) auto", gap: 6, alignItems: "center", padding: "6px 8px", border: `1px solid ${d.custom ? T.brass + "66" : T.line}`, borderRadius: 11, background: T.surface, opacity: hidden ? 0.55 : 1 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, color: T.faint, cursor: canEdit ? "grab" : "default" }}>
        <GripVertical size={15} aria-hidden="true" />
        {d.custom && canEdit ? (
          <select value={d.icon} onChange={(e) => onIcon(d.key, e.target.value)} title="الأيقونة" aria-label="أيقونة التبويب"
            style={{ border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, borderRadius: 7, fontSize: 11.5, padding: "2px 2px", maxWidth: 82 }}>
            {Object.keys(CUSTOM_TAB_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        ) : d.Icon ? <d.Icon size={14} color={T.brass} /> : null}
      </span>
      <input style={inp} value={ar} placeholder={d.ar} onChange={(e) => setAr(e.target.value)} onKeyDown={onKey} disabled={!canEdit} aria-label={`اسم ${d.ar} بالعربي`} />
      <input style={{ ...inp, direction: "ltr" }} value={en} placeholder={d.en} onChange={(e) => setEn(e.target.value)} onKeyDown={onKey} disabled={!canEdit} aria-label={`اسم ${d.ar} بالإنجليزي`} />
      <span style={{ display: "flex", alignItems: "center" }}>
        {dirty && <button style={{ ...ib, background: T.brass, color: T.onAccent }} onClick={commit} title="حفظ الاسم" aria-label="حفظ الاسم"><Check size={14} /></button>}
        {canEdit && <button style={ib} onClick={() => onMove(d.key, -1)} disabled={idx === 0} title="أعلى/قبل" aria-label="تقديم"><ArrowUp size={14} style={{ opacity: idx === 0 ? 0.3 : 1 }} /></button>}
        {canEdit && <button style={ib} onClick={() => onMove(d.key, 1)} disabled={last} title="أسفل/بعد" aria-label="تأخير"><ArrowDown size={14} style={{ opacity: last ? 0.3 : 1 }} /></button>}
        {canEdit && <button style={ib} onClick={() => onToggle(d.key, hidden)} title={hidden ? "إظهار بالموقع" : "إخفاء بالموقع"} aria-label={hidden ? "إظهار" : "إخفاء"}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>}
        {canEdit && !d.custom && (saved.ar || saved.en) && <button style={ib} onClick={() => onReset(d.key)} title="الاسم الافتراضي" aria-label="الاسم الافتراضي"><RotateCcw size={13} /></button>}
        {canEdit && d.custom && <button style={{ ...ib, color: "#C0392B" }} onClick={() => onDelete(d)} title="حذف التبويب ومحتواه" aria-label="حذف التبويب"><Trash2 size={13} /></button>}
      </span>
    </div>
  );
}

function TabsEditor({ navLabels, defs }) {
  const ed = useEdit();
  const [open, setOpen] = useState(false);
  const [nt, setNt] = useState({ ar: "", en: "", icon: "star" });
  const dragKey = useRef(null);
  if (!ed) return null;
  const { T } = ed;
  const canEdit = ed.has("manage_theme");
  const keys = defs.map((d) => d.key);
  const order = orderedKeys(navLabels, keys);
  const byKey = Object.fromEntries(defs.map((d) => [d.key, d]));
  const customCount = defs.filter((d) => d.custom).length;

  /* كل حفظ يقرأ آخر نسخة من القاعدة أولًا (ما يمسح كتل/نصوص انحفظت من مكان ثاني) */
  const persist = async (mutate, what) => {
    const { error } = await patchNavLabels(supabase, mutate, what);
    if (error) { ed.toast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return false; }
    ed.log(what, "تبويبات الموقع");
    ed.toast("تم الحفظ");
    return true;
  };
  const commit = async (d, patch) => {
    let { ar, en } = patch;
    if (ar && !en) { const t = await autoTranslateAr(supabase, ar); if (t) en = t; }
    if (d.custom) {
      if (!ar) { ed.toast("اسم التبويب المخصّص ما يكون فاضي"); return; }
      await persist((nl) => ({ ...nl, _tabs: (nl._tabs || []).map((t) => (t && t.key === d.key ? { ...t, ar: ar.slice(0, 60), en: (en || ar).slice(0, 60) } : t)) }), "تعديل اسم تبويب مخصّص");
      return;
    }
    await persist((nl) => {
      const cur = { ...(nl[d.key] || {}) };
      if (ar) cur.ar = ar; else delete cur.ar;
      if (en) cur.en = en; else delete cur.en;
      return { ...nl, [d.key]: cur };
    }, "تعديل اسم قسم (وضع التحرير)");
  };
  const toggle = (key, hidden) => persist((nl) => ({ ...nl, [key]: { ...(nl[key] || {}), hidden: !hidden } }), hidden ? "إظهار قسم بالموقع" : "إخفاء قسم بالموقع");
  const reset = (key) => persist((nl) => { const cur = { ...(nl[key] || {}) }; delete cur.ar; delete cur.en; return { ...nl, [key]: cur }; }, "إرجاع اسم قسم للافتراضي");
  const setOrder = (arr, what) => persist((nl) => ({ ...nl, [NAV_ORDER_KEY]: arr }), what);
  const reorder = (from, to) => {
    if (from === to) return;
    const arr = order.filter((k) => k !== from);
    arr.splice(Math.max(0, arr.indexOf(to)) + (order.indexOf(from) < order.indexOf(to) ? 1 : 0), 0, from);
    return setOrder(arr, "ترتيب أقسام الموقع");
  };
  const move = (key, dir) => {
    const i = order.indexOf(key), j = i + dir;
    if (j < 0 || j >= order.length) return;
    const arr = order.slice(); [arr[i], arr[j]] = [arr[j], arr[i]];
    return setOrder(arr, "ترتيب أقسام الموقع");
  };
  const setIcon = (key, icon) => persist((nl) => ({ ...nl, _tabs: (nl._tabs || []).map((t) => (t && t.key === key ? { ...t, icon } : t)) }), "تغيير أيقونة تبويب مخصّص");
  const remove = async (d) => {
    if (!window.confirm(`حذف تبويب «${d.ar}» وكل الكتل اللي فيه؟ (تقدر ترجعه من «سجل النسخ»)`)) return;
    const { error } = await deleteCustomTab(supabase, d.key);
    if (error) { ed.toast("تعذّر الحذف: " + (error.message || "")); return; }
    ed.log("حذف تبويب مخصّص", d.ar); ed.toast("انحذف التبويب");
  };
  const add = async () => {
    const ar = nt.ar.trim(); if (!ar) return;
    let en = nt.en.trim();
    if (!en) { const t = await autoTranslateAr(supabase, ar); if (t) en = t; }
    const { error } = await addCustomTab(supabase, { ar, en: en || ar, icon: nt.icon });
    if (error) { ed.toast("تعذّر الإضافة: " + (error.message || "")); return; }
    ed.log("إضافة تبويب مخصّص", ar); ed.toast("انضاف التبويب — افتحه وأضف له كتل"); setNt({ ar: "", en: "", icon: "star" });
  };
  const drag = { start: (k) => { dragKey.current = k; }, drop: (k) => { const f = dragKey.current; dragKey.current = null; if (f) reorder(f, k); }, end: () => { dragKey.current = null; } };
  const shortcuts = SHORTCUTS.filter((s) => s.perms.some((p) => ed.has(p)));
  const inp = { minWidth: 0, boxSizing: "border-box", border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, borderRadius: 8, padding: "6px 9px", fontSize: 13, fontFamily: "inherit" };

  return (
    <section dir="rtl" data-edit-ui className="no-print" aria-label="تحرير أقسام الموقع"
      style={{ margin: "10px 0 14px", border: `1px dashed ${T.brass}88`, borderRadius: 14, background: T.brass + "0d", fontFamily: "system-ui, sans-serif", color: T.paper }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: 0, background: "none", padding: "11px 14px", cursor: "pointer", color: T.brass, fontFamily: "inherit", fontSize: 13, fontWeight: 800 }}>
        <Pencil size={14} /> تحرير التبويبات (تسمية، ترتيب، إخفاء، إضافة تبويب جديد)
        <span style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 500, color: T.muted }}>{open ? "إخفاء" : "عرض"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
            {canEdit ? "اسحب الصف (أو استخدم الأسهم) لتغيير ترتيب التبويبات، وعدّل الاسم ثم اضغط ✓ أو Enter. العين تخفي القسم عن الزوّار. التبويبات المخصّصة (بإطار ملوّن) تقدر تغيّر أيقونتها وتحذفها." : "ما عندك صلاحية «تغيير مظهر الموقع وتسمية الأقسام»."}
          </div>
          {order.map((k, i) => {
            const d = byKey[k];
            if (!d) return null;
            return <TabRow key={k} d={d} saved={navLabels[k] || {}} hidden={!!navLabels[k]?.hidden} canEdit={canEdit} idx={i} last={i === order.length - 1} T={T}
              onCommit={commit} onToggle={toggle} onReset={reset} onMove={move} onIcon={setIcon} onDelete={remove} drag={drag} />;
          })}
          {canEdit && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto auto", gap: 6, alignItems: "center", marginTop: 4, padding: "8px", border: `1px dashed ${T.line}`, borderRadius: 11 }}>
              <input style={inp} placeholder="اسم تبويب جديد" value={nt.ar} onChange={(e) => setNt({ ...nt, ar: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") add(); }} aria-label="اسم التبويب الجديد" />
              <input style={{ ...inp, direction: "ltr" }} placeholder="English (optional)" value={nt.en} onChange={(e) => setNt({ ...nt, en: e.target.value })} aria-label="الاسم الإنجليزي" />
              <select style={inp} value={nt.icon} onChange={(e) => setNt({ ...nt, icon: e.target.value })} aria-label="الأيقونة">
                {Object.keys(CUSTOM_TAB_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <button onClick={add} disabled={!nt.ar.trim() || customCount >= MAX_CUSTOM_TABS}
                style={{ display: "flex", alignItems: "center", gap: 4, border: 0, borderRadius: 8, padding: "7px 12px", background: T.brass, color: T.onAccent, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: !nt.ar.trim() || customCount >= MAX_CUSTOM_TABS ? 0.5 : 1 }}><Plus size={13} /> تبويب</button>
            </div>
          )}
          {shortcuts.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>تحكم كامل بمحتوى أي قسم (أو من زر «إدارة المحتوى» بالشريط تحت بدون ما تطلع من الصفحة):</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {shortcuts.map((s) => (
                  <button key={s.tab} onClick={() => go(`#admin/${s.tab}`)}
                    style={{ border: `1px solid ${T.line}`, background: T.surface, color: T.paper, borderRadius: 999, padding: "7px 13px", fontFamily: "inherit", fontSize: 12.5, cursor: "pointer" }}>{s.label} ↗</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ═══ وضع «إخفاء أقسام»: اضغط أي قسم بالموقع لإخفائه عن الزوّار (أو إرجاعه) ═══ */
function SectionsLayer() {
  const ed = useEdit();
  const { T } = ed;
  const [pop, setPop] = useState(null);
  const nl = useNavLabels(supabase);
  const hiddenRef = useRef(new Set());
  hiddenRef.current = new Set(hiddenSecsOf(nl));
  useEffect(() => {
    document.body.classList.add("ed-secs");
    const st = document.createElement("style");
    st.setAttribute("data-edit-ui", "");
    st.textContent = `body.ed-secs [data-ek]{cursor:pointer !important}body.ed-secs [data-ek]:hover{outline:2.5px solid ${T.brass} !important;outline-offset:3px}body.ed-secs [data-edit-ui] *{cursor:auto}`;
    document.head.appendChild(st);
    const onClick = (e) => {
      if (e.target.closest && e.target.closest("[data-edit-ui]")) return;
      const el = e.target.closest && e.target.closest("[data-ek]");
      e.preventDefault(); e.stopPropagation();
      if (!el) { ed.toast("هذا الجزء ما ينخفى — اضغط على قسم يتلوّن إطاره"); return; }
      const key = el.getAttribute("data-ek");
      const hidden = hiddenRef.current.has(key);
      setPop({ x: e.clientX, y: e.clientY, key, hidden });
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); document.body.classList.remove("ed-secs"); st.remove(); };
  }, [T.brass]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pop) return null;
  const w = Math.min(300, window.innerWidth - 20);
  const left = Math.max(10, Math.min(pop.x - w / 2, window.innerWidth - w - 10));
  const top = Math.min(pop.y + 12, window.innerHeight - 150);
  const act = async () => {
    const { error } = await toggleHiddenSec(supabase, pop.key);
    if (error) { ed.toast("تعذّر الحفظ: " + (error.message || "")); return; }
    ed.log(pop.hidden ? "إظهار قسم للزوّار" : "إخفاء قسم عن الزوّار", docName(pop.key));
    ed.toast(pop.hidden ? "رجع القسم للزوّار" : "انخفى القسم عن الزوّار (يظهر لك باهت)");
    setPop(null);
  };
  const b = (primary) => ({ border: primary ? 0 : `1px solid ${T.line}`, borderRadius: 9, padding: "7px 12px", background: primary ? (pop.hidden ? T.brass : "#C0392B") : "transparent", color: primary ? "#fff" : T.muted, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
  return (
    <div dir="rtl" data-edit-ui role="dialog" aria-label="إخفاء قسم" style={{ position: "fixed", left, top, width: w, zIndex: 140, background: T.surface, color: T.paper, border: `1px solid ${T.brass}88`, borderRadius: 14, boxShadow: T.shadowUp, padding: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{docName(pop.key)}</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>{pop.hidden ? "هذا القسم مخفي عن الزوّار حاليًا." : "يختفي عن كل الزوّار فورًا، ويبقى ظاهر لك باهت عشان تقدر ترجعه."}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={b(true)} onClick={act}>{pop.hidden ? <><Eye size={12} style={{ verticalAlign: -2 }} /> إظهاره للزوّار</> : <><EyeOff size={12} style={{ verticalAlign: -2 }} /> إخفاؤه عن الزوّار</>}</button>
        <button style={{ ...b(false), marginInlineStart: "auto" }} onClick={() => setPop(null)}>إلغاء</button>
      </div>
    </div>
  );
}


/* ═══ وضع «تسمية النصوص»: اضغط أي نص بالموقع لتغيير اسمه أو إخفائه ═══ */
function textNodeAt(x, y, target) {
  let node = null;
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); node = p && p.offsetNode; }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); node = r && r.startContainer; }
  if (node && node.nodeType === 3 && normText(node.nodeValue) && node.parentElement && (target.contains(node) || node.parentElement.contains(target))) return node;
  for (const c of target.childNodes) if (c.nodeType === 3 && normText(c.nodeValue)) return c;
  return null;
}

function RenameLayer() {
  const ed = useEdit();
  const { T } = ed;
  const [pop, setPop] = useState(null);

  useEffect(() => {
    document.body.classList.add("ed-rename");
    const st = document.createElement("style");
    st.setAttribute("data-edit-ui", "");
    st.textContent = `body.ed-rename *:hover{outline:1.5px dashed ${T.brass};outline-offset:1px;cursor:text !important}body.ed-rename [data-edit-ui] *:hover{outline:none;cursor:auto !important}`;
    document.head.appendChild(st);
    const onClick = (e) => {
      if (e.target.closest && e.target.closest("[data-edit-ui]")) return;
      e.preventDefault(); e.stopPropagation();
      const node = textNodeAt(e.clientX, e.clientY, e.target);
      if (!node) { ed.toast("ما لقيت نص هنا — اضغط مباشرة على الكلمة"); return; }
      const original = normText(originalTextOf(node));
      if (isNumericText(original)) { ed.toast("هذا رقم يُحسب تلقائيًا من البيانات — يتغيّر بتعديل البيانات نفسها"); return; }
      setPop({ x: e.clientX, y: e.clientY, original, current: normText(node.nodeValue) });
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); document.body.classList.remove("ed-rename"); st.remove(); };
  }, [T.brass]); // eslint-disable-line react-hooks/exhaustive-deps

  return pop ? <RenamePopover pop={pop} onClose={() => setPop(null)} /> : null;
}

function RenamePopover({ pop, onClose }) {
  const ed = useEdit();
  const { T } = ed;
  const [val, setVal] = useState(pop.current);
  const [busy, setBusy] = useState(false);
  const w = Math.min(340, window.innerWidth - 20);
  const left = Math.max(10, Math.min(pop.x - w / 2, window.innerWidth - w - 10));
  const top = Math.min(pop.y + 14, window.innerHeight - 230);

  const persist = async (value) => {
    setBusy(true);
    let full = false;
    const { error } = await patchNavLabels(supabase, (nl) => {
      const texts = { ...(nl._texts || {}) };
      if (value == null) delete texts[pop.original]; else texts[pop.original] = value;
      if (Object.keys(texts).length > 400) { full = true; return nl; }
      const next = { ...nl };
      if (Object.keys(texts).length) next._texts = texts; else delete next._texts;
      return next;
    }, `تسمية نص: ${pop.original.slice(0, 40)}`);
    setBusy(false);
    if (full) { ed.toast("وصلت الحد الأقصى (400 نص معدّل)"); return; }
    if (error) { ed.toast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return; }
    ed.log(value == null ? "إرجاع نص للأصل (وضع التحرير)" : value === "" ? "إخفاء نص (وضع التحرير)" : "تسمية نص (وضع التحرير)", `${pop.original.slice(0, 60)}${value ? " ← " + value.slice(0, 60) : ""}`);
    ed.toast(value == null ? "رجع النص الأصلي" : "تم الحفظ");
    onClose();
  };
  const save = () => { const v = val.trim().slice(0, 400); if (!v || v === pop.original) { persist(v ? null : ""); return; } persist(v); };
  const btn = (kind) => ({ border: kind === "primary" ? 0 : `1px solid ${T.line}`, borderRadius: 9, padding: "7px 12px", background: kind === "primary" ? T.brass : "transparent", color: kind === "primary" ? T.onAccent : T.muted, fontFamily: "inherit", fontSize: 12.5, fontWeight: kind === "primary" ? 700 : 500, cursor: busy ? "wait" : "pointer" });

  return (
    <div dir="rtl" data-edit-ui role="dialog" aria-label="تسمية نص" style={{ position: "fixed", left, top, width: w, zIndex: 140, background: T.surface, color: T.paper, border: `1px solid ${T.brass}88`, borderRadius: 14, boxShadow: T.shadowUp, padding: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>الأصلي: <b style={{ color: T.paper }}>{pop.original.length > 70 ? pop.original.slice(0, 70) + "…" : pop.original}</b></div>
      <textarea autoFocus value={val} onChange={(e) => setVal(e.target.value)} rows={pop.original.length > 40 ? 3 : 2}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === "Escape") onClose(); }}
        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, borderRadius: 9, padding: "8px 10px", fontSize: 13.5, fontFamily: "inherit" }} />
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button style={btn("primary")} disabled={busy} onClick={save}>حفظ</button>
        <button style={btn()} disabled={busy} onClick={() => persist(null)} title="يرجّع النص الأصلي"><RotateCcw size={12} style={{ verticalAlign: -2 }} /> الأصل</button>
        <button style={btn()} disabled={busy} onClick={() => persist("")} title="يخفي هذا النص من الموقع"><HideIcon size={12} style={{ verticalAlign: -2 }} /> إخفاء</button>
        <button style={{ ...btn(), marginInlineStart: "auto" }} onClick={onClose}>إلغاء</button>
      </div>
      <div style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.7 }}>يسري على كل النصوص المطابقة تمامًا بنفس اللغة. للإنجليزي بدّل لغة الموقع ثم سمِّه.</div>
    </div>
  );
}
