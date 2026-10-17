/* ═══════════════════════════════════════════════════════════
   nav-labels-kit.jsx — تسمية الأقسام (تبويبات الموقع العام + لوحة الإدارة)
   قابلة للتعديل بالكامل من تبويب إدارة وحد، بدون لمس أي مكان ثاني بالكود.

   الفكرة: عمود nav_labels (jsonb) بجدول site_settings الموجود، شكله:
     { "<مفتاح_التبويب>": { "ar": "نص", "en": "text" } }
   أي مفتاح ما له قيمة بالعمود يرجع للنص الافتراضي المكتوب بالكود أصلاً.
   ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useCallback } from "react";
import { Pencil, RotateCcw, Eye, EyeOff, Check } from "lucide-react";
import { autoTranslateAr } from "./translate-kit.js";

/* النصوص الافتراضية — لو حد يبي "يرجّع الأصلي" بعد تعديل */
export const DEFAULT_PUBLIC_LABELS = [
  { key: "overview", ar: "نظرة عامة", en: "Overview" },
  { key: "notes", ar: "الاستفسارات", en: "Inquiries" },
  { key: "progress", ar: "تقدم التنفيذ", en: "Progress" },
  { key: "docs", ar: "المخططات والمستندات", en: "Plans & Documents" },
  { key: "gallery", ar: "الصور والمقاطع", en: "Photos & Videos" },
];
/* لوحة الإدارة عربي بس (نفس أسلوب الموقع الحالي) — "labels" هذا التبويب نفسه،
   محمي من الإخفاء عمدًا (لو تخفيه ما فيه طريقة ثانية ترجّعه). */
export const DEFAULT_ADMIN_LABELS = [
  { key: "dashboard", ar: "لوحة القرار" },
  { key: "sync", ar: "المزامنة والبيانات" },
  { key: "analytics", ar: "الزيارات والتحليلات" },
  { key: "filters", ar: "الفلاتر المخصصة" },
  { key: "notices", ar: "الإشعارات" },
  { key: "media", ar: "مقاطع النماذج" },
  { key: "gallery", ar: "معرض الموقع" },
  { key: "brief", ar: "الملخص التنفيذي" },
  { key: "theme", ar: "مظهر الموقع" },
  { key: "audit", ar: "سجل النشاط" },
  { key: "users", ar: "المستخدمون" },
  { key: "labels", ar: "تسمية الأقسام" },
  { key: "site", ar: "تخصيص الموقع والنسخ" },
  { key: "links", ar: "الروابط الخارجية" },
  { key: "scheduled", ar: "المجدولة" },
  { key: "share", ar: "روابط المشاركة" },
  { key: "insights", ar: "التحليلات الشاملة" },
  { key: "security", ar: "الأمان" },
];
const PROTECTED_KEYS = ["labels"]; /* ما تقدر تخفيها من نفس التبويب */

/* يقرأ التسميات من site_settings، ويتحدّث لحظيًا لو عدّل مشرف ثاني.
   (٦.٠.٠) اسم قناة فريد لكل استخدام — supabase-js يرجّع نفس القناة لو تكرر الاسم فيتعطل الثاني —
   ومع أي حدث نعيد القراءة من القاعدة بدل الاعتماد على حمولة الحدث (ممكن تنقص لو كبر الصف). */
let navWatchSeq = 0;
export function useNavLabels(supabase) {
  const [labels, setLabels] = useState({});
  const load = useCallback(async () => {
    const { data } = await supabase.from("site_settings").select("nav_labels").eq("id", 1).single();
    setLabels(data?.nav_labels && typeof data.nav_labels === "object" ? data.nav_labels : {});
  }, [supabase]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`nav_labels_watch_${++navWatchSeq}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "site_settings", filter: "id=eq.1" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [supabase, load]);
  return labels;
}

/* سجل نسخ محلي (٦.٠.٠): قبل كل تعديل تنحفظ النسخة السابقة بمتصفح المشرف (آخر 30) —
   يغذّي زر «تراجع» و«سجل النسخ». بدون أي تعديل على قاعدة البيانات. لو انضاف لاحقًا جدول
   site_settings_history بالقاعدة، لوحة التخصيص تقرأ منه أولًا تلقائيًا. */
const LOCAL_HIST_KEY = "alborada_site_custom_history_v1";
const LOCAL_HIST_MAX = 30, LOCAL_HIST_MAX_BYTES = 2000000;
export function readLocalHistory() {
  try { const a = JSON.parse(localStorage.getItem(LOCAL_HIST_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}
function writeLocalHistory(a) {
  try {
    let list = a.slice(0, LOCAL_HIST_MAX);
    while (list.length > 1 && JSON.stringify(list).length > LOCAL_HIST_MAX_BYTES) list = list.slice(0, -1);
    localStorage.setItem(LOCAL_HIST_KEY, JSON.stringify(list));
  } catch { /* تخزين المتصفح ممتلئ أو ممنوع — نكمل بدون سجل */ }
  try { window.dispatchEvent(new Event("site-custom-history")); } catch { /* بيئة بلا window */ }
}
export function pushLocalHistory(prev, what = "") {
  if (!prev || typeof prev !== "object") return;
  const list = readLocalHistory();
  if (list[0] && JSON.stringify(list[0].nav_labels) === JSON.stringify(prev)) return;
  writeLocalHistory([{ id: Date.now(), changed_at: new Date().toISOString(), actor: what || "تعديل", nav_labels: prev }, ...list]);
}
export function dropLocalHistory(id) { writeLocalHistory(readLocalHistory().filter((x) => x.id !== id)); }

/* تعديل آمن للتخصيصات (٦.٠.٠): يقرأ آخر نسخة من القاعدة ثم يطبّق التعديل عليها —
   فما يمسح تعديل سوّاه مشرف ثاني (أو تبويب ثاني) بنفس اللحظة. mutate تستلم نسخة قابلة للتعديل. */
export const NAV_LABELS_MAX_BYTES = 900000;
export async function patchNavLabels(supabase, mutate, what = "") {
  const { data, error: e0 } = await supabase.from("site_settings").select("nav_labels").eq("id", 1).single();
  if (e0) return { error: e0 };
  const cur = data?.nav_labels && typeof data.nav_labels === "object" ? data.nav_labels : {};
  const next = mutate(JSON.parse(JSON.stringify(cur)));
  if (!next || typeof next !== "object" || Array.isArray(next)) return { error: { message: "صيغة غير صالحة" } };
  if (JSON.stringify(next) === JSON.stringify(cur)) return { data: cur };
  if (JSON.stringify(next).length > NAV_LABELS_MAX_BYTES) return { error: { message: "حجم التخصيصات تجاوز الحد المسموح" } };
  const { error } = await supabase.from("site_settings").update({ nav_labels: next }).eq("id", 1);
  if (error) return { error };
  pushLocalHistory(cur, what);
  return { data: next };
}
/* استبدال كامل (استرجاع/استيراد) مع حفظ الحالية بالسجل قبلها */
export async function replaceNavLabels(supabase, next, what = "") {
  const { data } = await supabase.from("site_settings").select("nav_labels").eq("id", 1).single();
  const cur = data?.nav_labels && typeof data.nav_labels === "object" ? data.nav_labels : {};
  const { error } = await supabase.from("site_settings").update({ nav_labels: next }).eq("id", 1);
  if (error) return { error };
  pushLocalHistory(cur, what);
  return { data: next };
}

/* استخدام بتبويبات الموقع العام: NL(labels, "overview", "نظرة عامة", "Overview", lang) */
export const NL = (labels, key, ar, en, lang) => {
  const o = labels?.[key];
  return lang === "en" ? (o?.en || en) : (o?.ar || ar);
};
/* استخدام بلوحة الإدارة (عربي بس): NLA(labels, "dashboard", "لوحة القرار") */
export const NLA = (labels, key, ar) => labels?.[key]?.ar || ar;
/* هل القسم مخفي؟ isHidden(labels, "progress") */
export const isHidden = (labels, key) => !!labels?.[key]?.hidden;

/* ترتيب التبويبات (٦.٠.٠): يُحفظ بنفس العمود nav_labels تحت المفتاح "_order" كمصفوفة مفاتيح —
   بدون أي هجرة. مفتاح ما له مكان بالمصفوفة (تبويب جديد مستقبلًا) ينزل بآخرها بترتيبه الافتراضي،
   ومفتاح قديم ما عاد موجود يُتجاهل. فما يضيع تبويب بأي حال. */
export const NAV_ORDER_KEY = "_order";
export function orderedKeys(labels, defaults) {
  const saved = Array.isArray(labels?.[NAV_ORDER_KEY]) ? labels[NAV_ORDER_KEY] : [];
  const known = saved.filter((k, i) => defaults.includes(k) && saved.indexOf(k) === i);
  return [...known, ...defaults.filter((k) => !known.includes(k))];
}

/* ═══════════════════════════════════════════════════════════
   تبويب الإدارة — ALabelsTab
   ═══════════════════════════════════════════════════════════ */
export function ALabelsTab({ supabase, flashToast, log, canManage }) {
  const [labels, setLabels] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("site_settings").select("nav_labels").eq("id", 1).single();
    setLabels(data?.nav_labels || {});
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  if (!canManage) return <div style={{ padding: 24, color: "#8A6318" }}>ما عندك صلاحية تعديل تسميات الأقسام.</div>;
  if (labels === null) return <div style={{ padding: 24, opacity: 0.6 }}>يحمّل…</div>;

  const save = async (key, patch) => {
    setBusy(true);
    const { error, data } = await patchNavLabels(supabase, (nl) => ({ ...nl, [key]: { ...(nl[key] || {}), ...patch } }));
    setBusy(false);
    if (error) { flashToast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return false; }
    setLabels(data);
    flashToast("تم الحفظ"); return true;
  };
  const reset = async (key) => {
    const { error, data } = await patchNavLabels(supabase, (nl) => { const cur = { ...(nl[key] || {}) }; delete cur.ar; delete cur.en; return { ...nl, [key]: cur }; });
    if (error) { flashToast("تعذّر الحفظ: " + (error.message || "")); return; }
    setLabels(data);
    log("إرجاع اسم قسم للافتراضي", key);
    flashToast("رجع للاسم الافتراضي");
  };

  const toggleHidden = async (key, currentlyHidden) => {
    await save(key, { hidden: !currentlyHidden });
    log(currentlyHidden ? "إظهار قسم بالموقع" : "إخفاء قسم بالموقع", key);
  };

  const S = {
    wrap: { maxWidth: 700, margin: "0 auto", padding: "16px 4px" },
    group: { marginBottom: 26 },
    h: { font: "inherit", fontWeight: 600, fontSize: 15, lineHeight: 1.4, margin: "0 0 10px", color: "#5F7280" },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #EEF2F4" },
    row1col: { display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #EEF2F4" },
    inp: { width: "100%", border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 8, padding: "6px 10px", fontSize: 13.5 },
    ib: { width: 30, height: 30, display: "grid", placeItems: "center", border: 0, background: "none", borderRadius: 8, color: "#5F7280", cursor: "pointer" },
    ok: { width: 30, height: 30, display: "grid", placeItems: "center", border: 0, background: "#1B7F8E", color: "#fff", borderRadius: 8, cursor: "pointer" },
  };

  const Row = ({ d, twoLang }) => {
    const saved = labels[d.key] || {};
    const [ar, setAr] = useState(saved.ar ?? "");
    const [en, setEn] = useState(saved.en ?? "");
    const [saving, setSaving] = useState(false);
    const dirty = ar !== (saved.ar ?? "") || (twoLang && en !== (saved.en ?? ""));
    const overridden = !!saved.ar || !!saved.en;
    const hidden = isHidden(labels, d.key);
    const protectedRow = PROTECTED_KEYS.includes(d.key);

    const confirm = async () => {
      setSaving(true);
      const ok = await save(d.key, twoLang ? { ar, en } : { ar });
      setSaving(false);
      if (ok) log("تعديل اسم قسم", d.key);
    };
    const onArBlur = async () => {
      if (!twoLang || en.trim() || !ar.trim()) return;
      const t = await autoTranslateAr(supabase, ar);
      if (t) setEn(t); /* يقترح الإنجليزي بس، ما يحفظ — لازم تضغط تأكيد */
    };

    return (
      <div style={{ ...(twoLang ? S.row : S.row1col), opacity: hidden ? 0.55 : 1 }}>
        <input style={S.inp} value={ar} placeholder={d.ar} onChange={(e) => setAr(e.target.value)} onBlur={onArBlur} />
        {twoLang && (
          <input style={{ ...S.inp, direction: "ltr" }} value={en} placeholder={d.en} onChange={(e) => setEn(e.target.value)} />
        )}
        {dirty ? (
          <button style={S.ok} title="تأكيد الحفظ" disabled={saving} onClick={confirm}><Check size={15} /></button>
        ) : <span style={{ width: 30 }} />}
        <button style={{ ...S.ib, ...(protectedRow ? { opacity: 0.3, cursor: "default" } : {}) }}
          disabled={protectedRow}
          title={protectedRow ? "هذا التبويب ما ينخفى (هو نفسه مكان إظهار الأقسام)" : hidden ? "إظهار بالموقع" : "إخفاء بالموقع"}
          onClick={() => toggleHidden(d.key, hidden)}>
          {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        {overridden ? (
          <button style={S.ib} title="إرجاع للاسم الافتراضي" onClick={() => reset(d.key)}><RotateCcw size={14} /></button>
        ) : <span style={{ width: 30 }} />}
      </div>
    );
  };

  return (
    <div style={S.wrap}>
      <p style={{ fontSize: 13, color: "#5F7280", marginBottom: 18 }}>
        غيّر اسم أي تبويب واضغط ✓ لتأكيد الحفظ (يظهر لما يكون فيه تعديل ما انحفظ بعد)، أو أخفه كامل عن
        الزوّار/عن لوحة الإدارة بزر العين مباشرة. اترك حقل الاسم فاضي وينزل الافتراضي.
      </p>
      <div style={S.group}>
        <p style={S.h}><Pencil size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} /> تبويبات الموقع العام (عربي / English)</p>
        {DEFAULT_PUBLIC_LABELS.map((d) => <Row key={d.key} d={d} twoLang />)}
      </div>
      <div style={S.group}>
        <p style={S.h}><Pencil size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} /> تبويبات لوحة الإدارة</p>
        {DEFAULT_ADMIN_LABELS.map((d) => <Row key={d.key} d={d} />)}
      </div>
    </div>
  );
}
