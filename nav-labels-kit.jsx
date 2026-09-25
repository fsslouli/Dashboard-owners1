/* ═══════════════════════════════════════════════════════════
   nav-labels-kit.jsx — تسمية الأقسام (تبويبات الموقع العام + لوحة الإدارة)
   قابلة للتعديل بالكامل من تبويب إدارة وحد، بدون لمس أي مكان ثاني بالكود.

   الفكرة: عمود nav_labels (jsonb) بجدول site_settings الموجود، شكله:
     { "<مفتاح_التبويب>": { "ar": "نص", "en": "text" } }
   أي مفتاح ما له قيمة بالعمود يرجع للنص الافتراضي المكتوب بالكود أصلاً.
   ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useCallback } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { autoTranslateAr } from "./translate-kit.js";

/* النصوص الافتراضية — لو حد يبي "يرجّع الأصلي" بعد تعديل */
export const DEFAULT_PUBLIC_LABELS = [
  { key: "overview", ar: "نظرة عامة", en: "Overview" },
  { key: "notes", ar: "متابعة الملاحظات", en: "Notes Board" },
  { key: "progress", ar: "تقدم التنفيذ", en: "Progress" },
  { key: "docs", ar: "المخططات والمستندات", en: "Plans & Documents" },
  { key: "gallery", ar: "الصور والمقاطع", en: "Photos & Videos" },
];
/* لوحة الإدارة عربي بس (نفس أسلوب الموقع الحالي) */
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
];

/* يقرأ التسميات من site_settings، ويتحدّث لحظيًا لو عدّل مشرف ثاني */
export function useNavLabels(supabase) {
  const [labels, setLabels] = useState({});
  const load = useCallback(async () => {
    const { data } = await supabase.from("site_settings").select("nav_labels").eq("id", 1).single();
    setLabels(data?.nav_labels || {});
  }, [supabase]);
  useEffect(() => {
    load();
    const ch = supabase.channel("nav_labels_watch")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "site_settings", filter: "id=eq.1" },
        (p) => setLabels(p.new?.nav_labels || {}))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [supabase, load]);
  return labels;
}

/* استخدام بتبويبات الموقع العام: NL(labels, "overview", "نظرة عامة", "Overview", lang) */
export const NL = (labels, key, ar, en, lang) => {
  const o = labels?.[key];
  return lang === "en" ? (o?.en || en) : (o?.ar || ar);
};
/* استخدام بلوحة الإدارة (عربي بس): NLA(labels, "dashboard", "لوحة القرار") */
export const NLA = (labels, key, ar) => labels?.[key]?.ar || ar;

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
    const next = { ...labels, [key]: { ...(labels[key] || {}), ...patch } };
    setLabels(next); setBusy(true);
    const { error } = await supabase.from("site_settings").update({ nav_labels: next }).eq("id", 1);
    setBusy(false);
    if (error) { flashToast("تعذّر الحفظ — تأكد من صلاحيتك"); return; }
    flashToast("تم الحفظ");
  };
  const reset = async (key) => {
    const next = { ...labels }; delete next[key];
    setLabels(next);
    const { error } = await supabase.from("site_settings").update({ nav_labels: next }).eq("id", 1);
    if (error) { flashToast("تعذّر الحفظ"); return; }
    log("إرجاع اسم قسم للافتراضي", key);
    flashToast("رجع للاسم الافتراضي");
  };

  const S = {
    wrap: { maxWidth: 700, margin: "0 auto", padding: "16px 4px" },
    group: { marginBottom: 26 },
    h: { font: "600 15px/1.4 inherit", margin: "0 0 10px", color: "#5F7280" },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #EEF2F4" },
    row1col: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #EEF2F4" },
    inp: { width: "100%", border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 8, padding: "6px 10px", fontSize: 13.5 },
    ib: { width: 30, height: 30, display: "grid", placeItems: "center", border: 0, background: "none", borderRadius: 8, color: "#5F7280", cursor: "pointer" },
  };

  const Row = ({ d, twoLang }) => {
    const [ar, setAr] = useState(labels[d.key]?.ar ?? "");
    const [en, setEn] = useState(labels[d.key]?.en ?? "");
    const overridden = !!labels[d.key];
    return (
      <div style={twoLang ? S.row : S.row1col}>
        <input style={S.inp} value={ar} placeholder={d.ar} onChange={(e) => setAr(e.target.value)}
          onBlur={async (e) => {
            const v = e.target.value; save(d.key, { ar: v });
            if (twoLang && !en.trim()) { const t = await autoTranslateAr(supabase, v); if (t) { setEn(t); save(d.key, { ar: v, en: t }); } }
          }} />
        {twoLang && (
          <input style={{ ...S.inp, direction: "ltr" }} value={en} placeholder={d.en} onChange={(e) => setEn(e.target.value)}
            onBlur={() => save(d.key, { en })} />
        )}
        {overridden ? (
          <button style={S.ib} title="إرجاع للاسم الافتراضي" onClick={() => reset(d.key)}><RotateCcw size={14} /></button>
        ) : <span style={{ width: 30 }} />}
      </div>
    );
  };

  return (
    <div style={S.wrap}>
      <p style={{ fontSize: 13, color: "#5F7280", marginBottom: 18 }}>
        غيّر اسم أي تبويب بالموقع العام أو بلوحة الإدارة. اترك الحقل فاضي وينزل الاسم الافتراضي (الشفّاف باللون الرمادي) — التعديل يُحفظ لحظة تطلع من الحقل.
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
