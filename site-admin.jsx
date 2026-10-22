/* ═══════════════════════════════════════════════════════════
   site-admin.jsx — «تخصيص الموقع والنسخ» (٦.٠.٠)
   مركز واحد لكل تخصيصات الموقع: العنوان، اللون المميز، عرض الصفحة، التبويبات المخصّصة،
   الأقسام المخفية، الاستفسارات المثبّتة، النصوص المعدّلة، الكتل، سجل النسخ والاسترجاع،
   والتصدير/الاستيراد. يُستخدم بلوحة الإدارة وبدرج وضع التحرير.
   كل تعديل عبر patchNavLabels (يقرأ آخر نسخة ثم يكتب) — والخادم يفرض صلاحية manage_theme.
   ═══════════════════════════════════════════════════════════ */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, ExternalLink, Eye, History, Pin, RotateCcw, Send, Trash2, Upload, Plus, Check } from "lucide-react";
import { NAV_LABELS_MAX_BYTES, patchNavLabels, readLocalHistory, replaceNavLabels, useNavLabels } from "./nav-labels-kit.jsx";
import { CUSTOM_TAB_ICONS, MAX_CUSTOM_TABS, PAGE_WIDTHS, customTabsOf, hiddenSecsOf, normalizeTelegramUrl, pinsOf, safeColor, sectionLabel, siteOf, styleOf, telegramUrlOf } from "./site-custom.js";
import { TELEGRAM_URL } from "./app-bootstrap.jsx";
import { DOCS } from "./site-data.jsx";

/* ── عمليات مشتركة (تستخدمها لوحة الإدارة ووضع التحرير) ── */
const newTabKey = () => "c_" + Math.random().toString(36).slice(2, 8);
export async function addCustomTab(supabase, { ar, en, icon }) {
  let full = false;
  const key = newTabKey();
  const res = await patchNavLabels(supabase, (nl) => {
    const tabs = Array.isArray(nl._tabs) ? nl._tabs : [];
    if (tabs.length >= MAX_CUSTOM_TABS) { full = true; return nl; }
    return { ...nl, _tabs: [...tabs, { key, ar: String(ar || "").slice(0, 60), en: String(en || "").slice(0, 60), icon: CUSTOM_TAB_ICONS[icon] ? icon : "star" }] };
  }, `إضافة تبويب: ${ar}`);
  if (full) return { error: { message: `الحد الأقصى ${MAX_CUSTOM_TABS} تبويبات مخصّصة` } };
  return { ...res, key };
}
export function updateCustomTab(supabase, key, patch) {
  return patchNavLabels(supabase, (nl) => {
    const tabs = (Array.isArray(nl._tabs) ? nl._tabs : []).map((t) => (t && t.key === key ? { ...t, ...patch } : t));
    const next = { ...nl, _tabs: tabs };
    if (next[key] && ("ar" in patch || "en" in patch)) { const o = { ...next[key] }; delete o.ar; delete o.en; next[key] = o; }
    return next;
  }, "تعديل تبويب مخصّص");
}
export function deleteCustomTab(supabase, key) {
  return patchNavLabels(supabase, (nl) => {
    const next = { ...nl, _tabs: (Array.isArray(nl._tabs) ? nl._tabs : []).filter((t) => t && t.key !== key) };
    if (next._blocks) { next._blocks = { ...next._blocks }; delete next._blocks[key]; }
    delete next[key];
    if (Array.isArray(next._order)) next._order = next._order.filter((k) => k !== key);
    return next;
  }, "حذف تبويب مخصّص");
}
export function toggleHiddenSec(supabase, key) {
  return patchNavLabels(supabase, (nl) => {
    const cur = Array.isArray(nl._hide) ? nl._hide : [];
    return { ...nl, _hide: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
  }, `إخفاء/إظهار قسم: ${key}`);
}
export function togglePin(supabase, id) {
  return patchNavLabels(supabase, (nl) => {
    const cur = (Array.isArray(nl._pins) ? nl._pins : []).map(Number);
    return { ...nl, _pins: cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 50) };
  }, `تثبيت/إلغاء تثبيت #${id}`);
}

/* ── تحقق من ملف استيراد/نسخة قبل اعتمادها ── */
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
export function validateNavLabels(x) {
  if (!isObj(x)) return "الملف لا يحتوي تخصيصات صالحة";
  if (JSON.stringify(x).length > NAV_LABELS_MAX_BYTES) return "حجم الملف أكبر من المسموح";
  for (const [k, v] of Object.entries(x)) {
    if (k === "_order" || k === "_hide" || k === "_pins" || k === "_tabs") { if (!Array.isArray(v)) return `القيمة ${k} لازم تكون قائمة`; continue; }
    if (k === "_texts") { if (!isObj(v) || Object.values(v).some((t) => typeof t !== "string")) return "النصوص المعدّلة بصيغة غير صحيحة"; continue; }
    if (k === "_blocks") { if (!isObj(v) || Object.values(v).some((a) => !Array.isArray(a))) return "الكتل بصيغة غير صحيحة"; continue; }
    if (k === "_style" || k === "_site" || k === "_links") { if (!isObj(v)) return `القيمة ${k} بصيغة غير صحيحة`; continue; }
    if (!isObj(v)) return `إعداد التبويب ${k} بصيغة غير صحيحة`;
  }
  return null;
}
export function summarize(nl) {
  const n = nl || {};
  const blocks = isObj(n._blocks) ? Object.values(n._blocks).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0) : 0;
  const renamed = Object.entries(n).filter(([k, v]) => !k.startsWith("_") && isObj(v) && (v.ar || v.en)).length;
  const hiddenTabs = Object.entries(n).filter(([k, v]) => !k.startsWith("_") && isObj(v) && v.hidden).length;
  return {
    texts: isObj(n._texts) ? Object.keys(n._texts).length : 0, blocks, renamed, hiddenTabs,
    tabs: customTabsOf(n).length, hidden: hiddenSecsOf(n).length, pins: pinsOf(n).length,
  };
}
const summaryText = (s) => [
  s.tabs && `${s.tabs} تبويب مخصّص`, s.blocks && `${s.blocks} كتلة`, s.texts && `${s.texts} نص معدّل`,
  s.renamed && `${s.renamed} اسم قسم`, s.hiddenTabs && `${s.hiddenTabs} تبويب مخفي`, s.hidden && `${s.hidden} قسم مخفي`, s.pins && `${s.pins} مثبّت`,
].filter(Boolean).join(" · ") || "بدون تخصيصات";

export const docName = (k) => { const d = DOCS.find((x) => `doc-${String(x.id).toLowerCase()}` === k); return d ? `مستند: ${d.nameAr}` : sectionLabel(k); };
/* تاريخ ميلادي واضح بأرقام لاتينية (YYYY-MM-DD HH:MM) — بدون خلط اتجاهات */
const fmt = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso || "");
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* ═══ اللوحة ═══ */
export function SiteCustomPanel({ supabase, T, log, toast, canManage }) {
  const live = useNavLabels(supabase);
  const initialLive = useRef(live).current;   /* الخطّاف يرجّع {} لين توصل القراءة الأولى */
  const [nl, setNl] = useState(live);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setNl(live); if (live !== initialLive) setLoaded(true); }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState(null);
  const [histErr, setHistErr] = useState("");
  const [histLocal, setHistLocal] = useState(false);
  const fileRef = useRef(null);

  const site = useMemo(() => siteOf(nl), [nl]);
  const style = useMemo(() => styleOf(nl), [nl]);
  const tabs = useMemo(() => customTabsOf(nl), [nl]);
  const hidden = useMemo(() => hiddenSecsOf(nl), [nl]);
  const pins = useMemo(() => pinsOf(nl), [nl]);
  const texts = nl && isObj(nl._texts) ? Object.entries(nl._texts) : [];
  const sum = useMemo(() => summarize(nl), [nl]);

  const [title, setTitle] = useState({ ar: "", en: "" });
  useEffect(() => { setTitle({ ar: site.title_ar, en: site.title_en }); }, [site.title_ar, site.title_en]);
  const [newTab, setNewTab] = useState({ ar: "", en: "", icon: "star" });
  /* رابط قروب تليجرام (6.7.0): يُحفظ بـ nav_labels._links.telegram ويسري على الزوّار فورًا */
  const tgCurrent = useMemo(() => telegramUrlOf(nl, TELEGRAM_URL), [nl]);
  const tgCustom = !!(nl && isObj(nl._links) && nl._links.telegram);
  const [tgDraft, setTgDraft] = useState("");
  useEffect(() => { setTgDraft(tgCurrent); }, [tgCurrent]);
  const tgNorm = normalizeTelegramUrl(tgDraft);

  const run = async (p, msg, logMsg) => {
    setBusy(true);
    const res = await p;
    setBusy(false);
    if (res.error) { toast("تعذّر الحفظ: " + (res.error.message || "تأكد من صلاحيتك")); return false; }
    if (res.data) { setNl(res.data); setLoaded(true); }
    if (msg) toast(msg);
    if (logMsg && log) log(logMsg, "تخصيص الموقع");
    return true;
  };
  const patch = (fn, msg, logMsg) => run(patchNavLabels(supabase, fn, logMsg), msg, logMsg);

  /* سجل القاعدة (لو انضاف الجدول) وإلا السجل المحلي بهذا المتصفح */
  const loadHist = async () => {
    setHistErr("");
    const { data, error } = await supabase.from("site_settings_history").select("id,changed_at,actor,nav_labels").order("id", { ascending: false }).limit(40);
    if (!error) { setHistLocal(false); setHist(data || []); return; }
    setHistLocal(true); setHist(readLocalHistory());
  };
  useEffect(() => { if (canManage) loadHist(); }, [canManage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => { if (histLocal) setHist(readLocalHistory()); };
    window.addEventListener("site-custom-history", on);
    return () => window.removeEventListener("site-custom-history", on);
  }, [histLocal]);

  const restore = async (row) => {
    const err = validateNavLabels(row.nav_labels || {});
    if (err) { toast("النسخة غير صالحة: " + err); return; }
    if (!window.confirm(`استرجاع تخصيصات الموقع كما كانت قبل ${fmt(row.changed_at)}؟\n(${summaryText(summarize(row.nav_labels))})\nالحالة الحالية تنحفظ تلقائيًا بالسجل وتقدر ترجع لها.`)) return;
    setBusy(true);
    const { error } = await replaceNavLabels(supabase, row.nav_labels || {}, "قبل الاسترجاع");
    setBusy(false);
    if (error) { toast("تعذّر الاسترجاع: " + (error.message || "")); return; }
    setNl(row.nav_labels || {});
    log && log("استرجاع نسخة تخصيصات الموقع", `#${row.id} — ${fmt(row.changed_at)}`);
    toast("تم الاسترجاع — انتقل للزوّار فورًا");
    loadHist();
  };

  const exportJson = () => {
    const payload = { kind: "alborada-site-customizations", version: "6.0.0", exported_at: new Date().toISOString(), nav_labels: nl || {} };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `alborada-site-customizations-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    log && log("تصدير تخصيصات الموقع", summaryText(sum));
  };
  const importJson = async (file) => {
    if (!file) return;
    if (file.size > NAV_LABELS_MAX_BYTES) { toast("الملف كبير جدًا"); return; }
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch { toast("الملف ليس JSON صالح"); return; }
    const data = isObj(parsed) && isObj(parsed.nav_labels) ? parsed.nav_labels : parsed;
    const err = validateNavLabels(data);
    if (err) { toast(err); return; }
    if (!window.confirm(`استيراد التخصيصات من الملف واستبدال الحالية؟\n(${summaryText(summarize(data))})\nالحالة الحالية تنحفظ تلقائيًا بسجل النسخ.`)) return;
    setBusy(true);
    const { error } = await replaceNavLabels(supabase, data, "قبل الاستيراد");
    setBusy(false);
    if (error) { toast("تعذّر الاستيراد: " + (error.message || "")); return; }
    setNl(data); toast("تم الاستيراد"); log && log("استيراد تخصيصات الموقع", summaryText(summarize(data))); loadHist();
  };

  if (!canManage) return <div style={{ padding: 20, color: T.muted, fontSize: 13 }}>حسابك ما عنده صلاحية «تغيير مظهر الموقع وتسمية الأقسام».</div>;

  const S = {
    sec: { border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, background: T.surface, marginBottom: 14 },
    h: { fontSize: 14.5, fontWeight: 800, margin: "0 0 4px", color: T.paper, display: "flex", alignItems: "center", gap: 7 },
    p: { fontSize: 12.5, color: T.muted, margin: "0 0 12px", lineHeight: 1.8 },
    inp: { width: "100%", minWidth: 0, boxSizing: "border-box", border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, borderRadius: 9, padding: "8px 10px", fontSize: 13.5, fontFamily: "inherit" },
    b: (kind) => ({ display: "inline-flex", alignItems: "center", gap: 5, border: kind === "primary" ? 0 : `1px solid ${T.line}`, background: kind === "primary" ? T.brass : kind === "danger" ? "#C0392B" : "transparent", color: kind === "primary" ? T.onAccent : kind === "danger" ? "#fff" : T.paper, borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }),
    row: { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${T.lineSoft || T.line}`, fontSize: 13 },
    ib: { width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, background: "none", color: T.muted, cursor: "pointer", borderRadius: 7 },
  };

  return (
    <div dir="rtl" style={{ maxWidth: 820, margin: "0 auto", fontFamily: "inherit" }}>
      <div style={{ ...S.sec, background: T.brass + "10", borderColor: T.brass + "55" }}>
        <p style={S.h}>ملخص التخصيصات الحالية</p>
        <p style={{ ...S.p, margin: 0 }}>{loaded ? summaryText(sum) : "جارٍ التحميل…"}. أي تعديل يسري على كل الزوّار فورًا، وكل تغيير تنحفظ قبله نسخة تقدر ترجع لها من «سجل النسخ» تحت.</p>
      </div>

      {/* العنوان + المظهر */}
      <div style={S.sec}>
        <p style={S.h}>عنوان الموقع والمظهر</p>
        <p style={S.p}>العنوان يظهر بأعلى الصفحة وبتبويب المتصفح. اتركه فاضي للعنوان الأصلي.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input style={S.inp} placeholder="استفسارات الملاك" value={title.ar} onChange={(e) => setTitle({ ...title, ar: e.target.value })} />
          <input style={{ ...S.inp, direction: "ltr" }} placeholder="Owner Inquiries" value={title.en} onChange={(e) => setTitle({ ...title, en: e.target.value })} />
        </div>
        <button style={S.b("primary")} disabled={busy || (title.ar === site.title_ar && title.en === site.title_en)}
          onClick={() => patch((n) => ({ ...n, _site: { ...(isObj(n._site) ? n._site : {}), title_ar: title.ar.trim().slice(0, 80), title_en: title.en.trim().slice(0, 80) } }), "تم حفظ العنوان", "تعديل عنوان الموقع")}><Check size={13} /> حفظ العنوان</button>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 16, fontSize: 13 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>اللون المميز
            <input type="color" value={style.accent || "#1B7F8E"} onChange={(e) => { const c = safeColor(e.target.value); if (c) patch((n) => ({ ...n, _style: { ...(isObj(n._style) ? n._style : {}), accent: c } }), "تم تغيير اللون", "تغيير اللون المميز للموقع"); }} />
          </label>
          {style.accent && <button style={S.b()} disabled={busy} onClick={() => patch((n) => { const st = { ...(isObj(n._style) ? n._style : {}) }; delete st.accent; return { ...n, _style: st }; }, "رجع لون الطقم الأصلي", "إرجاع اللون المميز")}><RotateCcw size={12} /> لون الطقم الأصلي</button>}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>عرض الصفحة
            <select style={{ ...S.inp, width: "auto" }} value={style.width} onChange={(e) => { const w = e.target.value; if (PAGE_WIDTHS[w] !== undefined) patch((n) => ({ ...n, _style: { ...(isObj(n._style) ? n._style : {}), width: w } }), "تم", "تغيير عرض الصفحة"); }}>
              <option value="normal">عادي</option><option value="wide">عريض</option><option value="full">كامل الشاشة</option>
            </select>
          </label>
        </div>
      </div>

      {/* رابط قروب الملاك على تليجرام */}
      <div style={S.sec}>
        <p style={S.h}><Send size={15} color={T.brass} /> رابط قروب الملاك (تليجرام)</p>
        <p style={S.p}>الرابط اللي يفتحه زر «انضم لمجتمع الملاك». أي تعديل يسري على كل الزوّار فورًا بدون نشر نسخة جديدة. يقبل روابط t.me أو telegram.me فقط.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <input style={{ ...S.inp, direction: "ltr", flex: "1 1 260px" }} placeholder="https://t.me/+…" value={tgDraft}
            onChange={(e) => setTgDraft(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          <button style={S.b("primary")} disabled={busy || !tgNorm || tgNorm === tgCurrent}
            onClick={() => patch((n) => ({ ...n, _links: { ...(isObj(n._links) ? n._links : {}), telegram: tgNorm } }), "تم حفظ رابط القروب", `تغيير رابط قروب تليجرام: ${tgNorm}`)}><Check size={13} /> حفظ الرابط</button>
        </div>
        {tgDraft.trim() && !tgNorm && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 8px" }}>الرابط غير صالح — لازم يكون مثل https://t.me/+xxxx</p>}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 12.5, color: T.muted }}>
          <span>الرابط الحالي{tgCustom ? "" : " (الافتراضي)"}:</span>
          <a href={tgCurrent} target="_blank" rel="noopener noreferrer" dir="ltr" style={{ color: T.brass, display: "inline-flex", alignItems: "center", gap: 4, wordBreak: "break-all" }}>{tgCurrent} <ExternalLink size={12} /></a>
          {tgCustom && tgCurrent !== TELEGRAM_URL && (
            <button style={S.b()} disabled={busy} onClick={() => patch((n) => { const l = { ...(isObj(n._links) ? n._links : {}) }; delete l.telegram; return { ...n, _links: l }; }, "رجع الرابط الافتراضي", "إرجاع رابط قروب تليجرام للافتراضي")}><RotateCcw size={12} /> الرابط الافتراضي</button>
          )}
        </div>
      </div>

      {/* التبويبات المخصّصة */}
      <div style={S.sec}>
        <p style={S.h}>تبويبات (صفحات) جديدة</p>
        <p style={S.p}>أنشئ قسم جديد بالموقع باسمك وأيقونتك، وبعدها عبّه بالكتل من وضع التحرير (#edit). ترتيبه وإخفاؤه مع باقي التبويبات.</p>
        {tabs.map((t) => {
          const I = CUSTOM_TAB_ICONS[t.icon];
          return (
            <div key={t.key} style={S.row}>
              <I size={16} color={T.brass} />
              <span style={{ flex: 1 }}>{t.ar} <span style={{ color: T.faint, direction: "ltr" }}>· {t.en}</span></span>
              <select value={t.icon} onChange={(e) => run(updateCustomTab(supabase, t.key, { icon: e.target.value }), "تم", "تغيير أيقونة تبويب مخصّص")} style={{ ...S.inp, width: "auto", padding: "4px 6px" }}>
                {Object.keys(CUSTOM_TAB_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <button style={{ ...S.ib, color: "#C0392B" }} title="حذف التبويب ومحتواه" onClick={() => { if (window.confirm(`حذف تبويب «${t.ar}» وكل كتله؟ (يرجع من سجل النسخ)`)) run(deleteCustomTab(supabase, t.key), "انحذف التبويب", `حذف تبويب مخصّص: ${t.ar}`); }}><Trash2 size={14} /></button>
            </div>
          );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 6, marginTop: 10 }}>
          <input style={S.inp} placeholder="اسم التبويب" value={newTab.ar} onChange={(e) => setNewTab({ ...newTab, ar: e.target.value })} />
          <input style={{ ...S.inp, direction: "ltr" }} placeholder="English name" value={newTab.en} onChange={(e) => setNewTab({ ...newTab, en: e.target.value })} />
          <select style={{ ...S.inp, width: "auto" }} value={newTab.icon} onChange={(e) => setNewTab({ ...newTab, icon: e.target.value })}>
            {Object.keys(CUSTOM_TAB_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button style={S.b("primary")} disabled={busy || !newTab.ar.trim() || tabs.length >= MAX_CUSTOM_TABS}
            onClick={async () => { const ok = await run(addCustomTab(supabase, { ar: newTab.ar.trim(), en: newTab.en.trim(), icon: newTab.icon }), "انضاف التبويب", `إضافة تبويب مخصّص: ${newTab.ar.trim()}`); if (ok) setNewTab({ ar: "", en: "", icon: "star" }); }}><Plus size={13} /> إضافة</button>
        </div>
      </div>

      {/* الأقسام المخفية */}
      <div style={S.sec}>
        <p style={S.h}><Eye size={15} /> الأقسام المخفية عن الزوّار</p>
        <p style={S.p}>تخفي أي قسم من وضع التحرير بزر «إخفاء أقسام» ثم الضغط على القسم. هنا ترجّعها.</p>
        {hidden.length === 0 ? <p style={{ ...S.p, margin: 0 }}>ما فيه أقسام مخفية.</p> : (
          <>
            {hidden.map((k) => (
              <div key={k} style={S.row}>
                <span style={{ flex: 1 }}>{docName(k)}</span>
                <button style={S.b()} disabled={busy} onClick={() => run(toggleHiddenSec(supabase, k), "رجع القسم للزوّار", `إظهار قسم: ${k}`)}><Eye size={12} /> إظهار</button>
              </div>
            ))}
            <button style={{ ...S.b(), marginTop: 8 }} disabled={busy} onClick={() => patch((n) => ({ ...n, _hide: [] }), "رجعت كل الأقسام", "إظهار كل الأقسام المخفية")}>إظهار الكل</button>
          </>
        )}
      </div>

      {/* المثبّت */}
      <div style={S.sec}>
        <p style={S.h}><Pin size={15} /> الاستفسارات المثبّتة بالأعلى</p>
        <p style={S.p}>تثبّت أي استفسار من زر الدبوس على بطاقته بوضع التحرير. المثبّت يظهر أول القائمة بالترتيب الافتراضي.</p>
        {pins.length === 0 ? <p style={{ ...S.p, margin: 0 }}>ما فيه استفسارات مثبّتة.</p> : pins.map((id, i) => (
          <div key={id} style={S.row}>
            <span className="mono" style={{ flex: 1 }}>#{id}</span>
            <button style={S.ib} disabled={busy || i === 0} onClick={() => patch((n) => { const a = pinsOf(n); const j = a.indexOf(id); if (j > 0) [a[j - 1], a[j]] = [a[j], a[j - 1]]; return { ...n, _pins: a }; }, null, "ترتيب المثبّت")}><ArrowUp size={14} /></button>
            <button style={S.ib} disabled={busy || i === pins.length - 1} onClick={() => patch((n) => { const a = pinsOf(n); const j = a.indexOf(id); if (j >= 0 && j < a.length - 1) [a[j + 1], a[j]] = [a[j], a[j + 1]]; return { ...n, _pins: a }; }, null, "ترتيب المثبّت")}><ArrowDown size={14} /></button>
            <button style={{ ...S.ib, color: "#C0392B" }} title="إلغاء التثبيت" disabled={busy} onClick={() => run(togglePin(supabase, id), "انلغى التثبيت", `إلغاء تثبيت #${id}`)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {/* النصوص المعدّلة */}
      <div style={S.sec}>
        <p style={S.h}>النصوص المعدّلة ({texts.length})</p>
        <p style={S.p}>كل نص غيّرت اسمه أو أخفيته من وضع «تسمية النصوص». تقدر تعدّله هنا أو ترجّعه للأصل.</p>
        {texts.length === 0 ? <p style={{ ...S.p, margin: 0 }}>ما فيه نصوص معدّلة.</p> : texts.slice(0, 400).map(([orig, val]) => (
          <TextRow key={orig} orig={orig} val={val} S={S} T={T} busy={busy}
            onSave={(v) => patch((n) => ({ ...n, _texts: { ...(isObj(n._texts) ? n._texts : {}), [orig]: v.slice(0, 400) } }), "تم", "تعديل نص معدّل")}
            onReset={() => patch((n) => { const tx = { ...(isObj(n._texts) ? n._texts : {}) }; delete tx[orig]; return { ...n, _texts: tx }; }, "رجع النص الأصلي", "إرجاع نص للأصل")} />
        ))}
      </div>

      {/* سجل النسخ */}
      <div style={S.sec}>
        <p style={S.h}><History size={15} /> سجل النسخ والاسترجاع</p>
        <p style={S.p}>قبل كل تعديل على تخصيصات الموقع تنحفظ نسخة تلقائيًا. اضغط «استرجاع» يرجع الموقع كما كان قبل ذاك التعديل.
          {histLocal && <b> النسخ محفوظة بهذا المتصفح فقط (آخر 30 تعديل سوّيتها منه) — للاحتفاظ الدائم استخدم «تصدير» تحت.</b>}</p>
        {histErr && <p style={{ ...S.p, color: "#C0392B" }}>{histErr}</p>}
        {hist === null ? <p style={S.p}>يحمّل…</p> : hist.length === 0 && !histErr ? <p style={{ ...S.p, margin: 0 }}>ما فيه نسخ بعد — تبدأ تنحفظ مع أول تعديل.</p> : hist.map((r) => (
          <div key={r.id} style={S.row}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b dir="ltr" style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", unicodeBidi: "isolate" }}>{fmt(r.changed_at)}</b>
              <span style={{ color: T.muted, fontSize: 12 }}> — {r.actor || "—"}</span>
              <div style={{ color: T.faint, fontSize: 11.5 }}>{summaryText(summarize(r.nav_labels))}</div>
            </span>
            <button style={S.b()} disabled={busy} onClick={() => restore(r)}><RotateCcw size={12} /> استرجاع</button>
          </div>
        ))}
        {hist && hist.length > 0 && <button style={{ ...S.b(), marginTop: 8 }} onClick={loadHist}>تحديث القائمة</button>}
      </div>

      {/* تصدير/استيراد */}
      <div style={S.sec}>
        <p style={S.h}>نسخة احتياطية (تصدير / استيراد)</p>
        <p style={S.p}>نزّل كل التخصيصات بملف واحد واحتفظ فيه، أو ارفع ملف سابق يستبدل الحالية (مع حفظ الحالية بالسجل قبل الاستبدال).</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.b("primary")} onClick={exportJson}><Download size={13} /> تصدير</button>
          <button style={S.b()} disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><Upload size={13} /> استيراد ملف</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { importJson(e.target.files && e.target.files[0]); e.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

function TextRow({ orig, val, S, T, busy, onSave, onReset }) {
  const [v, setV] = useState(val);
  useEffect(() => { setV(val); }, [val]);
  return (
    <div style={{ ...S.row, flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 200px", minWidth: 0, color: T.muted, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis" }} title={orig}>{orig.length > 60 ? orig.slice(0, 60) + "…" : orig}</span>
      <input style={{ ...S.inp, flex: "1 1 200px" }} value={v} placeholder="(مخفي)" onChange={(e) => setV(e.target.value)} />
      {v !== val && <button style={S.b("primary")} disabled={busy} onClick={() => onSave(v)}><Check size={12} /></button>}
      <button style={S.ib} title="الأصل" disabled={busy} onClick={onReset}><RotateCcw size={13} /></button>
    </div>
  );
}
