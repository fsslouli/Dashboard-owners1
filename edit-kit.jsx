/* ═══════════════════════════════════════════════════════════
   edit-kit.jsx — وضع «تحرير الموقع مباشرة» (٦.٠.٠)
   الرابط: ‎#edit‎ — يعرض الموقع العام نفسه بتصميمه الحالي، وفوقه أدوات تحكم
   حسب صلاحيات حسابك بالضبط (نفس صلاحيات لوحة الإدارة، والخادم هو اللي يفرضها).

   • الاستفسارات: تعديل / تكرار / حذف من كل بطاقة وصف، + إضافة جديد.
   • التبويبات: إعادة تسمية (عربي/English)، إخفاء/إظهار، وترتيب بالسحب.
   • اختصارات: قفز مباشر لأي تبويب إدارة (المعرض، الروابط، المقاطع…).

   يُحمَّل بحزمة منفصلة؛ الزائر العادي ما ينزّل منه شي.
   ═══════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, GripVertical, LayoutDashboard, LogOut, Pencil, PlusCircle, RotateCcw, ShieldCheck, Trash2, X,
} from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";
import { EditCtx, useEdit } from "./edit-ctx.js";
import { ADMIN_BLANK_INQ, ADMIN_FIELD_LABEL, INQ_FIELDS_ADMIN, toDbBool, toYesNo, useSupaAuth, useSystemTheme } from "./admin-core.jsx";
import { afieldInput, canonicalizeRow } from "./admin-excel-utils.jsx";
import { AAttachmentsPanel, ATT_BUCKET } from "./attach-kit.jsx";
import { AInquiryTrail } from "./admin-trail-sync.jsx";
import { CAT_ORDER } from "./site-data.jsx";
import { NAV_ORDER_KEY, orderedKeys } from "./nav-labels-kit.jsx";
import { autoTranslateAr } from "./translate-kit.js";

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
export function EditProvider({ children }) {
  const T = useSystemTheme();
  const session = useSupaAuth();
  const [profile, setProfile] = useState(undefined);
  const [categories, setCategories] = useState([]);
  const [hasCatCol, setHasCatCol] = useState(true);
  const [sheet, setSheet] = useState(null);
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
  }, [profile]);

  const toast = useCallback((m) => {
    setToastMsg(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2800);
  }, []);
  const has = useCallback((p) => !!profile && (profile.perms || []).includes(p), [profile]);
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
    INQ_FIELDS_ADMIN.concat(["reply_en"]).forEach((k) => { if (k in src && (k !== "cat" || hasCatCol)) fields[k] = src[k]; });
    const { error } = await supabase.from("inquiries").insert({ ...fields, id: nextId, urgent: false, closed: "لا" });
    if (error) { toast("تعذّر التكرار: " + (error.message || "")); return; }
    log("تكرار استفسار (وضع التحرير)", `#${r.id} ← #${nextId}`);
    toast(`أُنشئ #${nextId} نسخةً من #${r.id}`);
  }, [hasCatCol, log, toast]);

  const value = useMemo(() => ({
    on: true, T, supabase, profile, has, log, toast, categories, hasCatCol,
    openEditor: (target) => setSheet(target),
    removeInquiry, duplicateInquiry,
    CardActions, TabsEditor,
  }), [T, profile, has, log, toast, categories, hasCatCol, removeInquiry, duplicateInquiry]);

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
      {toastMsg && (
        <div role="status" style={{ position: "fixed", bottom: 78, left: "50%", transform: "translateX(-50%)", zIndex: 120, background: T.paper, color: T.bg, padding: "10px 18px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 8, boxShadow: T.shadowUp }}>
          <Check size={15} /> {toastMsg}
        </div>
      )}
    </EditCtx.Provider>
  );
}

/* ═══ الشريط العائم ═══ */
function EditBar() {
  const ed = useEdit();
  const { T } = ed;
  const btn = (primary) => ({
    display: "flex", alignItems: "center", gap: 6, border: primary ? 0 : `1px solid ${T.line}`, borderRadius: 999, padding: "9px 14px",
    background: primary ? T.brass : "transparent", color: primary ? T.onAccent : T.paper, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  });
  return (
    <div dir="rtl" role="toolbar" aria-label="أدوات وضع التحرير" className="no-print"
      style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 110, maxWidth: "calc(100vw - 20px)", overflowX: "auto",
        display: "flex", alignItems: "center", gap: 6, padding: 6, borderRadius: 999, background: T.surface, border: `1px solid ${T.brass}66`, boxShadow: T.shadowUp, fontFamily: "system-ui, sans-serif" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", fontSize: 12, fontWeight: 800, color: T.brass, whiteSpace: "nowrap" }}><Pencil size={13} /> وضع التحرير</span>
      {ed.has("add_inquiry") && <button style={btn(true)} onClick={() => ed.openEditor({ mode: "new" })}><PlusCircle size={14} /> استفسار</button>}
      <button style={btn(false)} onClick={() => go("#admin")}><LayoutDashboard size={14} /> اللوحة</button>
      <button style={btn(false)} onClick={() => go("")}><LogOut size={14} /> خروج</button>
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
  const canEdit = ed.has("edit_inquiry"), canAdd = ed.has("add_inquiry"), canDel = ed.has("delete_inquiry");
  if (!canEdit && !canAdd && !canDel) return null;
  const doDelete = async () => { setBusy(true); await ed.removeInquiry(r); setBusy(false); setAsk(false); };
  const wrap = inline ? { display: "flex", gap: 4, marginTop: 6 } : { position: "absolute", top: 8, insetInlineStart: 8, zIndex: 4, display: "flex", gap: 4 };
  return (
    <div dir="rtl" style={wrap} onClick={stop} onKeyDown={stop}>
      {ask ? (
        <>
          <button style={{ ...b, width: "auto", padding: "0 10px", background: "#C0392B", borderColor: "#C0392B", color: "#fff", fontSize: 11.5, fontFamily: "inherit" }} disabled={busy} onClick={doDelete}>{busy ? "…" : "تأكيد الحذف"}</button>
          <button style={b} onClick={() => setAsk(false)} aria-label="إلغاء"><X size={13} /></button>
        </>
      ) : (
        <>
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
  const { T, categories, hasCatCol } = ed;
  const isNew = target.mode === "new";
  const [form, setForm] = useState(isNew ? { ...ADMIN_BLANK_INQ } : null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    supabase.from("inquiries").select("*").eq("id", target.id).single().then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) { setErr("تعذّر تحميل الاستفسار"); return; }
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
    if (out.note && !out.note_en) { const t = await autoTranslateAr(supabase, out.note); if (t) out.note_en = t; }
    if (out.reply && !out.reply_en) { const t = await autoTranslateAr(supabase, out.reply); if (t) out.reply_en = t; }
    return out;
  };

  const save = async () => {
    if (!form.note?.trim()) { setErr("لازم نص الملاحظة على الأقل"); return; }
    setErr(""); setBusy(true);
    const clean = await translateMissing(canonicalizeRow(form, categories));
    const fields = {};
    INQ_FIELDS_ADMIN.concat(["reply_en"]).forEach((k) => { if (k in clean && (k !== "cat" || hasCatCol)) fields[k] = clean[k]; });
    fields.answered = toDbBool(clean.answered);
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
    onClose();
  };

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 130, display: "flex", justifyContent: "flex-start" }}>
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
              {afieldInput(ADMIN_FIELD_LABEL.status, form.status, set("status"), catVals("status", ["معتمدة", "قيد الدراسة", "تم التصويت", "تم الرفض"]))}
              {afieldInput(ADMIN_FIELD_LABEL.owner, form.owner, set("owner"), null, catVals("owner", []))}
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

function TabRow({ d, saved, hidden, canEdit, idx, last, T, onCommit, onToggle, onReset, onMove, drag }) {
  const [ar, setAr] = useState(saved.ar ?? "");
  const [en, setEn] = useState(saved.en ?? "");
  useEffect(() => { setAr(saved.ar ?? ""); setEn(saved.en ?? ""); }, [saved.ar, saved.en]);
  const dirty = ar !== (saved.ar ?? "") || en !== (saved.en ?? "");
  const inp = { width: "100%", minWidth: 0, boxSizing: "border-box", border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, borderRadius: 8, padding: "6px 9px", fontSize: 13, fontFamily: "inherit" };
  const ib = { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: 8, background: "transparent", color: T.muted, cursor: "pointer", padding: 0, flexShrink: 0 };
  const commit = () => onCommit(d.key, { ar: ar.trim(), en: en.trim() });
  const onKey = (e) => { if (e.key === "Enter") commit(); };
  return (
    <div draggable={canEdit} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; drag.start(d.key); }} onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); drag.drop(d.key); }} onDragEnd={drag.end}
      style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) minmax(0,1fr) auto", gap: 6, alignItems: "center", padding: "6px 8px", border: `1px solid ${T.line}`, borderRadius: 11, background: T.surface, opacity: hidden ? 0.55 : 1 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 2, color: T.faint, cursor: canEdit ? "grab" : "default" }}><GripVertical size={15} aria-hidden="true" /></span>
      <input style={inp} value={ar} placeholder={d.ar} onChange={(e) => setAr(e.target.value)} onKeyDown={onKey} disabled={!canEdit} aria-label={`اسم ${d.ar} بالعربي`} />
      <input style={{ ...inp, direction: "ltr" }} value={en} placeholder={d.en} onChange={(e) => setEn(e.target.value)} onKeyDown={onKey} disabled={!canEdit} aria-label={`اسم ${d.ar} بالإنجليزي`} />
      <span style={{ display: "flex", alignItems: "center" }}>
        {dirty && <button style={{ ...ib, background: T.brass, color: T.onAccent }} onClick={commit} title="حفظ الاسم" aria-label="حفظ الاسم"><Check size={14} /></button>}
        {canEdit && <button style={ib} onClick={() => onMove(d.key, -1)} disabled={idx === 0} title="أعلى/قبل" aria-label="تقديم"><ArrowUp size={14} style={{ opacity: idx === 0 ? 0.3 : 1 }} /></button>}
        {canEdit && <button style={ib} onClick={() => onMove(d.key, 1)} disabled={last} title="أسفل/بعد" aria-label="تأخير"><ArrowDown size={14} style={{ opacity: last ? 0.3 : 1 }} /></button>}
        {canEdit && <button style={ib} onClick={() => onToggle(d.key, hidden)} title={hidden ? "إظهار بالموقع" : "إخفاء بالموقع"} aria-label={hidden ? "إظهار" : "إخفاء"}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>}
        {canEdit && (saved.ar || saved.en) && <button style={ib} onClick={() => onReset(d.key)} title="الاسم الافتراضي" aria-label="الاسم الافتراضي"><RotateCcw size={13} /></button>}
      </span>
    </div>
  );
}

function TabsEditor({ navLabels, defs }) {
  const ed = useEdit();
  const [open, setOpen] = useState(false);
  const dragKey = useRef(null);
  if (!ed) return null;
  const { T } = ed;
  const canEdit = ed.has("manage_theme");
  const keys = defs.map((d) => d.key);
  const order = orderedKeys(navLabels, keys);
  const byKey = Object.fromEntries(defs.map((d) => [d.key, d]));

  const persist = async (next, what) => {
    const { error } = await supabase.from("site_settings").update({ nav_labels: next }).eq("id", 1);
    if (error) { ed.toast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return false; }
    ed.log(what, "تبويبات الموقع");
    ed.toast("تم الحفظ");
    return true;
  };
  const commit = async (key, patch) => {
    let { ar, en } = patch;
    if (ar && !en) { const t = await autoTranslateAr(supabase, ar); if (t) en = t; }
    const cur = { ...(navLabels[key] || {}) };
    if (ar) cur.ar = ar; else delete cur.ar;
    if (en) cur.en = en; else delete cur.en;
    await persist({ ...navLabels, [key]: cur }, "تعديل اسم قسم (وضع التحرير)");
  };
  const toggle = (key, hidden) => persist({ ...navLabels, [key]: { ...(navLabels[key] || {}), hidden: !hidden } }, hidden ? "إظهار قسم بالموقع" : "إخفاء قسم بالموقع");
  const reset = (key) => { const next = { ...navLabels }; const cur = { ...(next[key] || {}) }; delete cur.ar; delete cur.en; next[key] = cur; return persist(next, "إرجاع اسم قسم للافتراضي"); };
  const reorder = (from, to) => {
    if (from === to) return;
    const arr = order.filter((k) => k !== from);
    arr.splice(Math.max(0, arr.indexOf(to)) + (order.indexOf(from) < order.indexOf(to) ? 1 : 0), 0, from);
    return persist({ ...navLabels, [NAV_ORDER_KEY]: arr }, "ترتيب أقسام الموقع");
  };
  const move = (key, dir) => {
    const i = order.indexOf(key), j = i + dir;
    if (j < 0 || j >= order.length) return;
    const arr = order.slice(); [arr[i], arr[j]] = [arr[j], arr[i]];
    return persist({ ...navLabels, [NAV_ORDER_KEY]: arr }, "ترتيب أقسام الموقع");
  };
  const drag = { start: (k) => { dragKey.current = k; }, drop: (k) => { const f = dragKey.current; dragKey.current = null; if (f) reorder(f, k); }, end: () => { dragKey.current = null; } };
  const shortcuts = SHORTCUTS.filter((s) => s.perms.some((p) => ed.has(p)));

  return (
    <section dir="rtl" className="no-print" aria-label="تحرير أقسام الموقع"
      style={{ margin: "10px 0 14px", border: `1px dashed ${T.brass}88`, borderRadius: 14, background: T.brass + "0d", fontFamily: "system-ui, sans-serif", color: T.paper }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: 0, background: "none", padding: "11px 14px", cursor: "pointer", color: T.brass, fontFamily: "inherit", fontSize: 13, fontWeight: 800 }}>
        <Pencil size={14} /> تحرير الأقسام والاختصارات
        <span style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 500, color: T.muted }}>{open ? "إخفاء" : "عرض"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
            {canEdit ? "اسحب الصف (أو استخدم الأسهم) لتغيير ترتيب التبويبات، وعدّل الاسم ثم اضغط ✓ أو Enter. العين تخفي القسم عن الزوّار." : "ما عندك صلاحية «تغيير مظهر الموقع وتسمية الأقسام»."}
          </div>
          {order.map((k, i) => {
            const d = byKey[k];
            return <TabRow key={k} d={d} saved={navLabels[k] || {}} hidden={!!navLabels[k]?.hidden} canEdit={canEdit} idx={i} last={i === order.length - 1} T={T}
              onCommit={commit} onToggle={toggle} onReset={reset} onMove={move} drag={drag} />;
          })}
          {shortcuts.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>تحكم كامل بمحتوى أي قسم (إضافة، حذف، ترتيب، نشر):</div>
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
