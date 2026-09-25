/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-tabs-1 */
import { ADMIN_EVENT_TYPES, ADMIN_PERMISSIONS, fmtAdminDate, isoAdminDate, useSystemTheme } from "./admin-core.jsx";
import { ABadge, ASegmented, aNoteStyle } from "./admin-excel-utils.jsx";
import { supabase } from "./app-bootstrap.jsx";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, BarChart3, Check, ChevronDown, ChevronUp, Download, History, Lock, Pencil, PlusCircle, RefreshCw, Sparkles, Tag, Trash2, UserPlus, Users, X } from "lucide-react";

/* ── الزيارات والتحليلات — يقرأ من جدول logs الحقيقي ── */
export function AAnalyticsTab({ flashToast, canExport }) {
  const T = useSystemTheme();
  const today = new Date();
  const [from, setFrom] = useState(isoAdminDate(new Date(today - 6 * 86400000)));
  const [to, setTo] = useState(isoAdminDate(today));
  const [rangeReady, setRangeReady] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState(new Set(ADMIN_EVENT_TYPES.map((t) => t.key)));
  const [events, setEvents] = useState([]); const [loading, setLoading] = useState(true);
  const [todaysVisits, setTodaysVisits] = useState(0);
  const [typeCounts, setTypeCounts] = useState({});
  const [refreshTick, setRefreshTick] = useState(0);

  /* افتراضيًا نعرض كل السجل من أول يوم — نجيب أقدم تاريخ فعلي بدل ما نفترض مدة ثابتة */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("logs").select("created_at").order("created_at", { ascending: true }).limit(1);
      if (data && data.length) setFrom(isoAdminDate(new Date(data[0].created_at)));
      setRangeReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!rangeReady) return;
    setLoading(true);
    (async () => {
      const gte = from + "T00:00:00", lte = to + "T23:59:59";

      /* الأرقام بالبطاقة الشاملة: عدّ حقيقي مباشر من قاعدة البيانات لكل نوع — بدون سقف الـ 1000 صف
         (استعلام count فقط، ما يجيب صفوف، فيرجع الرقم الحقيقي الكامل دايمًا) */
      const counts = {};
      await Promise.all(ADMIN_EVENT_TYPES.map(async (t) => {
        const { count } = await supabase.from("logs").select("id", { count: "exact", head: true })
          .eq("event_type", t.key).gte("created_at", gte).lte("created_at", lte);
        counts[t.key] = count || 0;
      }));
      setTypeCounts(counts);

      /* الصفوف التفصيلية (للمعاينة والتصدير) — نجيبها بالكامل عبر ترقيم صفحات يتجاوز سقف الـ 1000 صف الافتراضي */
      let all = []; let from_i = 0; const page = 1000;
      while (true) {
        const { data, error } = await supabase.from("logs").select("*")
          .gte("created_at", gte).lte("created_at", lte)
          .order("created_at", { ascending: false }).range(from_i, from_i + page - 1);
        if (error || !data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < page) break;
        from_i += page;
        if (all.length > 50000) break; // سقف أمان
      }
      setEvents(all); setLoading(false);

      const { count: tv } = await supabase.from("logs").select("id", { count: "exact", head: true })
        .eq("event_type", "visit").gte("created_at", isoAdminDate(today) + "T00:00:00");
      setTodaysVisits(tv || 0);
    })();
  }, [from, to, rangeReady, refreshTick]);

  const toggleType = (key) => setSelectedTypes((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const filtered = events.filter((e) => selectedTypes.has(e.event_type));
  const inquiryOpensInRange = filtered.filter((e) => e.event_type === "inquiry_open").length;
  const uniqueSessions = new Set(filtered.map((e) => e.session_id)).size;
  const setPreset = (days) => { setFrom(isoAdminDate(new Date(today - days * 86400000))); setTo(isoAdminDate(today)); };
  const setAllTime = async () => {
    const { data } = await supabase.from("logs").select("created_at").order("created_at", { ascending: true }).limit(1);
    if (data && data.length) setFrom(isoAdminDate(new Date(data[0].created_at)));
    setTo(isoAdminDate(today));
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // ورقة الملخص الشامل — أول ورقة تفتح، نظرة سريعة على كل شي
    const uniqueSessionsAll = new Set(filtered.map((e) => e.session_id)).size;
    const summaryRows = [
      { "البند": "الفترة", "القيمة": `${from} إلى ${to}` },
      { "البند": "إجمالي الأحداث", "القيمة": filtered.length },
      { "البند": "زوّار مميّزون بالفترة", "القيمة": uniqueSessionsAll },
      { "البند": "تاريخ إصدار التقرير", "القيمة": fmtAdminDate(new Date()) },
      {},
      { "البند": "نوع الحدث", "القيمة": "العدد" },
      ...ADMIN_EVENT_TYPES.map((t) => ({ "البند": t.label, "القيمة": filtered.filter((e) => e.event_type === t.key).length })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true }), "ملخص شامل");

    // ورقة مستقلة لكل نوع حدث فيه بيانات
    ADMIN_EVENT_TYPES.forEach((t) => {
      const rows = filtered.filter((e) => e.event_type === t.key);
      if (!rows.length) return;
      const sheetRows = rows.map((e) => ({ "تصنيف": e.category ?? "", "قيمة": e.value ?? "", "الجلسة": e.session_id, "التاريخ والوقت": fmtAdminDate(e.created_at) }));
      const safeName = t.label.replace(/[\\/*?:"\[\]]/g, "").slice(0, 28); // حد أقصى لاسم الورقة بإكسل
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), safeName);
    });

    XLSX.writeFile(wb, `تقرير-الزيارات-${from}_${to}.xlsx`);
    flashToast("تم تصدير التقرير — كل نوع بورقة مستقلة + ملخص شامل");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[["زيارات اليوم", todaysVisits], ["استفسارات فُتحت بالفترة", inquiryOpensInRange], ["زوّار مميّزون بالفترة", uniqueSessions]].map(([label, val]) => (<div key={label} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: T.brass }}>{val}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{label}</div></div>))}
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><BarChart3 size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>ملخص شامل — {from} إلى {to}</span></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setRefreshTick((n) => n + 1)} title="تحديث الأرقام الآن" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: T.sunken, border: "none", borderRadius: 999, cursor: "pointer", color: T.brass }}><RefreshCw size={12} /></button>
            <button onClick={setAllTime} style={{ fontSize: 11, background: T.brass + "16", color: T.brass, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer", fontWeight: 700 }}>الكل</button>
            <button onClick={() => setPreset(6)} style={{ fontSize: 11, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>أسبوع</button>
            <button onClick={() => setPreset(29)} style={{ fontSize: 11, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>شهر</button>
            <button onClick={() => setPreset(59)} style={{ fontSize: 11, background: T.sunken, color: T.muted, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>شهرين</button>
          </div>
        </div>
        {loading ? (
          <div style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: 14 }}>جارٍ حساب الأرقام...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {ADMIN_EVENT_TYPES.map((t) => { const Icon = t.icon; const c = typeCounts[t.key] || 0; return (
              <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.sunken, borderRadius: 10, padding: "9px 12px" }}>
                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} color={T.brass} /> {t.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.brass }}>{c}</span>
              </div>
            );})}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.brass + "12", borderRadius: 10, padding: "9px 12px", gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>الإجمالي الكلي</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.brass }}>{Object.values(typeCounts).reduce((s, v) => s + v, 0)}</span>
            </div>
          </div>
        )}
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><BarChart3 size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>استخراج تقرير مخصص</span></div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>من تاريخ</label><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>إلى تاريخ</label><input type="date" value={to} min={from} max={isoAdminDate(today)} onChange={(e) => setTo(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} /></div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>{ADMIN_EVENT_TYPES.map((t) => { const on = selectedTypes.has(t.key); const Icon = t.icon; return (<button key={t.key} onClick={() => toggleType(t.key)} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "7px 12px", fontSize: 12, cursor: "pointer", border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "16" : "transparent", color: on ? T.brass : T.muted, fontWeight: on ? 700 : 500 }}><Icon size={13} /> {t.label}</button>); })}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: T.muted }}>{loading ? "جارٍ التحميل..." : `${filtered.length} حدث مطابق`}</span>
          {canExport ? (<button onClick={exportExcel} disabled={filtered.length === 0} style={{ display: "flex", alignItems: "center", gap: 7, background: filtered.length ? T.brass : T.line, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: filtered.length ? "pointer" : "not-allowed" }}><Download size={15} /> تصدير إكسل</button>) : (<span style={{ fontSize: 11.5, color: T.faint, display: "flex", alignItems: "center", gap: 5 }}><Lock size={12} /> بدون صلاحية تصدير</span>)}
        </div>
      </div>
    </div>
  );
}
/* ── الفلاتر: تحكم إداري كامل بقيم الأولوية والفئة والحالة والجهة المجيبة
   والاجتماع — إعادة تسمية تُحدّث كل استفسار يستخدم القيمة تلقائيًا (وتدمج
   بذكاء لو سمّيت قيمة باسم موجود أصلاً)، وحذف محمي يرفض ويعرض عدد
   الاستفسارات المتأثرة إلا بتأكيد صريح، وترتيب يتحكم بترتيب ظهور القيمة
   بفلاتر الموقع العام ونموذج إضافة/تعديل استفسار.
   النموذج والموقع مستثنيان من هذا: قيمتهما نص حر تُصنَّف بخوارزمية بالكود
   (مو قيمة محفوظة مباشرة)، فتعديلهما يحتاج تصميم مختلف — يظهران هنا للعِلم
   فقط بدون أزرار تحرير. ── */
const FILTERS_TIER1 = ["pri", "cat", "status", "owner", "meeting"];

export function AFiltersTab({ categories, refreshCategories, flashToast, log }) {
  const T = useSystemTheme();
  const [newCatName, setNewCatName] = useState(""); const [newVal, setNewVal] = useState(""); const [draftValues, setDraftValues] = useState([]);
  const [editingVal, setEditingVal] = useState(null);   /* { key, old, draft } */
  const [confirmDel, setConfirmDel] = useState(null);   /* { key, val, count } */
  const [addingTo, setAddingTo] = useState(null);       /* key */
  const [addDraft, setAddDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const addValueToDraft = () => { if (!newVal.trim()) return; setDraftValues((v) => [...v, newVal.trim()]); setNewVal(""); };
  const createCategory = async () => {
    if (!newCatName.trim() || draftValues.length === 0) { flashToast("لازم اسم الفئة وقيمة وحدة على الأقل"); return; }
    await supabase.from("filter_categories").insert({ key: `custom-${Date.now()}`, label: newCatName.trim(), locked: false, values: draftValues });
    log("إنشاء فئة فلترة", `"${newCatName.trim()}" بقيم: ${draftValues.join("، ")}`);
    setNewCatName(""); setDraftValues([]); flashToast("تمت إضافة فئة الفلترة"); refreshCategories();
  };
  const deleteCategory = async (c) => { await supabase.from("filter_categories").delete().eq("key", c.key); log("حذف فئة فلترة", c.label); refreshCategories(); };
  const deleteValue = async (c, val) => { await supabase.from("filter_categories").update({ values: c.values.filter((v) => v !== val) }).eq("key", c.key); log("حذف قيمة فلتر", `${val} من ${c.label}`); refreshCategories(); };

  /* ═══ v2.8.5 — تحكم كامل بالفئات الأساسية الخمس ═══ */
  const doRename = async (key, oldVal, draft) => {
    const v = (draft || "").trim();
    setEditingVal(null);
    if (!v || v === oldVal) return;
    setBusy(true);
    const { error } = await supabase.rpc("rename_filter_value", { p_key: key, p_old: oldVal, p_new: v });
    setBusy(false);
    if (error) { flashToast("تعذّر إعادة التسمية: " + error.message); return; }
    log("إعادة تسمية قيمة فلتر", `${key}: "${oldVal}" ← "${v}"`);
    flashToast("تم التحديث في كل الاستفسارات المرتبطة");
    refreshCategories();
  };
  const doDelete = async (key, val, force = false) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("delete_filter_value", { p_key: key, p_val: val, p_force: force });
    setBusy(false);
    if (error) { flashToast("تعذّر الحذف: " + error.message); return; }
    if (data > 0 && !force) { setConfirmDel({ key, val, count: data }); return; }
    setConfirmDel(null);
    log("حذف قيمة فلتر", `${key}: "${val}"${force ? ` (وتفريغ الحقل بـ${data ?? ""} استفسار)` : ""}`);
    flashToast("تم الحذف");
    refreshCategories();
  };
  const doReorder = async (key, values, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= values.length) return;
    const next = [...values]; [next[i], next[j]] = [next[j], next[i]];
    const { data: upd, error } = await supabase.from("filter_categories").update({ values: next }).eq("key", key).select("key");
    if (error) { flashToast("تعذّر إعادة الترتيب"); return; }
    if (!upd || upd.length === 0) { flashToast("ما تم الحفظ — الحساب الحالي ما عنده صلاحية \"إدارة الفلاتر\""); return; }
    refreshCategories();
  };
  const doAdd = async (key, values) => {
    const v = addDraft.trim();
    if (!v) return;
    if (values.includes(v)) { flashToast("القيمة موجودة أصلًا بنفس الفئة"); return; }
    setBusy(true);
    const { data: upd, error } = await supabase.from("filter_categories").update({ values: [...values, v] }).eq("key", key).select("key");
    setBusy(false);
    if (error) { flashToast("تعذّر الإضافة: " + error.message); return; }
    /* v2.8.6 — RLS يرفض التحديث بصمت (صفر صفوف بدون خطأ) لو الحساب بدون صلاحية،
       فكانت الإضافة تبان ناجحة وهي ما انحفظت */
    if (!upd || upd.length === 0) { flashToast("ما تمت الإضافة — الحساب الحالي ما عنده صلاحية \"إدارة الفلاتر\""); return; }
    log("إضافة قيمة فلتر", `${key}: "${v}"`);
    setAddDraft(""); setAddingTo(null);
    refreshCategories();
  };

  const rowStyle = { display: "flex", alignItems: "center", gap: 7, background: T.sunken, borderRadius: 10, padding: "6px 8px" };
  const iconBtn = (color) => ({ background: "none", border: "none", cursor: "pointer", color: color || T.muted, display: "flex", alignItems: "center", padding: 4, flexShrink: 0 });
  const tier1 = FILTERS_TIER1.map((k) => categories.find((c) => c.key === k)).filter(Boolean);
  const builtinOther = categories.filter((c) => c.locked && !FILTERS_TIER1.includes(c.key));
  const custom = categories.filter((c) => !c.locked);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ ...aNoteStyle(T) }}>
        إعادة التسمية تُحدّث كل استفسار يستخدم القيمة تلقائيًا. الحذف يرفض ويعرض
        عدد الاستفسارات المتأثرة لو القيمة مستخدمة، وما ينفّذ إلا بتأكيدك الصريح.
      </div>

      {tier1.map((c) => (
        <div key={c.key} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{c.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(c.values || []).map((v, i) => {
              const isEditing = editingVal && editingVal.key === c.key && editingVal.old === v;
              return (
                <div key={v} style={rowStyle}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <button disabled={i === 0} onClick={() => doReorder(c.key, c.values, i, -1)} style={{ ...iconBtn(), opacity: i === 0 ? 0.25 : 1, padding: 1 }} title="أعلى"><ChevronUp size={12} /></button>
                    <button disabled={i === c.values.length - 1} onClick={() => doReorder(c.key, c.values, i, 1)} style={{ ...iconBtn(), opacity: i === c.values.length - 1 ? 0.25 : 1, padding: 1 }} title="أسفل"><ChevronDown size={12} /></button>
                  </div>
                  {isEditing ? (
                    <input
                      autoFocus value={editingVal.draft}
                      onChange={(e) => setEditingVal((s) => ({ ...s, draft: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") doRename(c.key, v, editingVal.draft); if (e.key === "Escape") setEditingVal(null); }}
                      onBlur={() => doRename(c.key, v, editingVal.draft)}
                      style={{ flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.brass}`, fontSize: 12.5, background: T.surface, fontFamily: "inherit" }}
                    />
                  ) : (
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                  )}
                  {!isEditing && (
                    <button onClick={() => setEditingVal({ key: c.key, old: v, draft: v })} style={iconBtn()} title="تعديل الاسم" disabled={busy}><Pencil size={12} /></button>
                  )}
                  <button onClick={() => doDelete(c.key, v)} style={iconBtn("#C0392B")} title="حذف" disabled={busy}><Trash2 size={12} /></button>
                </div>
              );
            })}
            {(!c.values || c.values.length === 0) && <div style={{ fontSize: 12, color: T.faint, padding: "4px 2px" }}>ما فيه قيم بعد.</div>}
          </div>

          {addingTo === c.key ? (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input autoFocus value={addDraft} onChange={(e) => setAddDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doAdd(c.key, c.values || [])}
                placeholder="قيمة جديدة" style={{ flex: 1, minWidth: 0, padding: "7px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5, background: T.sunken, fontFamily: "inherit" }} />
              <button onClick={() => doAdd(c.key, c.values || [])} disabled={busy} style={{ background: T.brass + "16", color: T.brass, border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>إضافة</button>
              <button onClick={() => { setAddingTo(null); setAddDraft(""); }} style={iconBtn()}><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => { setAddingTo(c.key); setAddDraft(""); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px dashed ${T.line}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: T.brass, cursor: "pointer", marginTop: 10, width: "100%", justifyContent: "center", fontFamily: "inherit" }}>
              <PlusCircle size={13} /> إضافة قيمة لـ{c.label}
            </button>
          )}
        </div>
      ))}

      {builtinOther.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <Lock size={13} color={T.faint} />
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>فئات مُدارة من الكود (النموذج والموقع)</span>
          </div>
          <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.8, margin: "0 0 12px" }}>
            قيمتهما نص حر يُصنَّف تلقائيًا (لا قيمة محفوظة مباشرة)، فتعديلهما من هنا معطّل حاليًا.
            تحتاج تصميم مختلف — قولّي لو تبيها.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {builtinOther.map((c) => (
              <div key={c.key} style={{ background: T.sunken, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 7 }}>{c.label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(c.values || []).map((v) => (
                    <span key={v} style={{ background: T.brass + "10", color: T.muted, borderRadius: 999, padding: "3px 9px", fontSize: 11 }}>{v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Tag size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>إضافة فئة فلترة جديدة يدويًا</span></div>
        <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>اسم الفئة</label>
        <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="مثال: رقم الاجتماع" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 12, fontSize: 13, background: T.sunken }} />
        <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>القيم</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addValueToDraft())} placeholder="مثال: الاجتماع الخامس — ثم Enter" style={{ flex: 1, boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} />
          <button onClick={addValueToDraft} style={{ background: T.brass + "16", color: T.brass, border: "none", borderRadius: 10, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إضافة</button>
        </div>
        {draftValues.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>{draftValues.map((v) => (<span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.sunken, borderRadius: 999, padding: "5px 10px", fontSize: 12 }}>{v} <X size={12} style={{ cursor: "pointer" }} onClick={() => setDraftValues((d) => d.filter((x) => x !== v))} /></span>))}</div>}
        <button onClick={createCategory} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><PlusCircle size={15} /> إنشاء فئة الفلترة</button>
      </div>

      {custom.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>الفئات المخصصة</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {custom.map((c) => (
              <div key={c.key} style={{ background: T.sunken, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.label}</span>
                  <button onClick={() => deleteCategory(c)} style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11.5 }}><Trash2 size={13} /> حذف الفئة</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(c.values || []).map((v) => (<span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.brass + "14", color: T.brass, borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 600 }}>{v} <X size={11} style={{ cursor: "pointer" }} onClick={() => deleteValue(c, v)} /></span>))}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="ovl" onClick={() => setConfirmDel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={17} color="#C0392B" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>القيمة مستخدمة فعليًا</span>
            </div>
            <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.8, margin: "0 0 16px" }}>
              "{confirmDel.val}" مستخدمة حاليًا في {confirmDel.count} {confirmDel.count === 1 ? "استفسار" : "استفسارات"}.
              لو تابعت، الحقل بهذي الاستفسارات يصير فاضي (بدون قيمة) بدل ما يبقى يشاور على قيمة محذوفة.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => doDelete(confirmDel.key, confirmDel.val, true)} disabled={busy} style={{ flex: 1, background: "#C0392B", color: "#fff", border: "none", borderRadius: 11, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>تفريغ الحقل واحذف</button>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>تراجع</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── سجل نشاط الإدارة ── */
export function AAuditLogTab() {
  const T = useSystemTheme();
  const [entries, setEntries] = useState([]);
  useEffect(() => { supabase.from("audit_log").select("*").order("ts", { ascending: false }).limit(200).then(({ data }) => setEntries(data || [])); }, []);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><History size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>سجل نشاط الإدارة</span></div>
      {entries.length === 0 ? (<div style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: 20 }}>ما فيه أي نشاط مسجّل بعد.</div>) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ background: T.sunken, borderRadius: 11, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>{e.action}</span><span style={{ fontSize: 11, color: T.faint }}>{fmtAdminDate(e.ts)}</span></div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{e.details}</div>
              <div style={{ fontSize: 11, color: T.brass, marginTop: 4, fontWeight: 600 }}>بواسطة: {e.user_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── تعديل صلاحيات أعضاء موجودين (إنشاء الحساب نفسه يتم من لوحة Supabase) ── */
export function AUsersTab({ profile, flashToast, log, canCreate, canEditPerms }) {
  const T = useSystemTheme();
  const [members, setMembers] = useState([]); const [editingId, setEditingId] = useState(null); const [form, setForm] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState(null); // { name, email, password, perms }
  /* v2.9.1 — ما تقدر تمنح حساب جديد صلاحية ما تملكها (إلا لو عندك «تعديل الصلاحيات»).
     نفس القاعدة مطبّقة بالخادم (admin-invite-user) — هنا بس عشان ما تعرض خيار مرفوض. */
  const myPerms = (profile && profile.perms) || [];
  const grantable = canEditPerms ? ADMIN_PERMISSIONS : ADMIN_PERMISSIONS.filter((p) => myPerms.includes(p.key));
  const load = () => supabase.from("profiles").select("*").then(({ data }) => setMembers(data || []));
  useEffect(() => { load(); }, []);
  const startEdit = (m) => { setEditingId(m.id); setForm({ ...m }); };
  const togglePerm = (key) => setForm((f) => ({ ...f, perms: f.perms.includes(key) ? f.perms.filter((p) => p !== key) : [...f.perms, key] }));
  const save = async () => {
    await supabase.from("profiles").update({ name: form.name, role: form.role, perms: form.perms }).eq("id", form.id);
    log("تعديل صلاحيات عضو", `${form.name} — ${form.perms.length} صلاحية`);
    flashToast("تم حفظ الصلاحيات"); setEditingId(null); setForm(null); load();
  };
  const startCreate = () => setNewUser({ name: "", email: "", password: "", perms: [] });
  const toggleNewPerm = (key) => setNewUser((f) => ({ ...f, perms: f.perms.includes(key) ? f.perms.filter((p) => p !== key) : [...f.perms, key] }));
  const createUser = async () => {
    if (!newUser.email.trim() || newUser.password.length < 6) { flashToast("لازم بريد صحيح وكلمة مرور ٦ أحرف فأكثر"); return; }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-invite-user", {
      body: { email: newUser.email.trim(), password: newUser.password, name: newUser.name.trim() || newUser.email.trim(), perms: newUser.perms.filter((k) => grantable.some((g) => g.key === k)) },
    });
    setCreating(false);
    if (error || data?.error) {
      /* رسالة الخادم الفعلية (مثل: صلاحية ما تملكها) بدل رسالة عامة */
      let msg = data?.error;
      if (!msg && error && error.context && typeof error.context.json === "function") {
        try { const b = await error.context.json(); msg = b && b.error; } catch (_) {}
      }
      flashToast(msg || "تعذّر إنشاء الحساب"); return;
    }
    log("إضافة عضو جديد", `${newUser.name || newUser.email} — ${newUser.perms.length} صلاحية`);
    flashToast("تم إنشاء الحساب — يقدر يدخل فورًا بنفس البريد وكلمة المرور");
    setNewUser(null); load();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Users size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>أعضاء لوحة الإدارة</span></div>
          {canCreate && <button onClick={startCreate} style={{ display: "flex", alignItems: "center", gap: 6, background: T.brass, color: "#fff", border: "none", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><UserPlus size={14} /> إضافة عضو جديد</button>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {members.map((u) => (
            <div key={u.id} style={{ background: T.sunken, borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{u.name || "(بدون اسم)"}</div><div style={{ fontSize: 11, color: T.muted }}>{u.role}</div></div>
                {canEditPerms && <button onClick={() => startEdit(u)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 9, padding: "6px 10px", fontSize: 11.5, color: T.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Pencil size={12} /> تعديل</button>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>{(u.perms || []).map((p) => <span key={p} style={{ fontSize: 10.5, background: T.brass + "14", color: T.brass, borderRadius: 999, padding: "2px 8px" }}>{ADMIN_PERMISSIONS.find((x) => x.key === p)?.label}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
      {form && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>تعديل صلاحيات: {form.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {ADMIN_PERMISSIONS.map((p) => { const on = form.perms.includes(p.key); const Icon = p.icon; return (
              <button key={p.key} onClick={() => togglePerm(p.key)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "start", border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "0D" : T.sunken, borderRadius: 11, padding: "10px 12px", cursor: "pointer" }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${on ? T.brass : T.faint}`, background: on ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={13} color="#fff" />}</span>
                <Icon size={14} color={on ? T.brass : T.faint} /><span style={{ fontSize: 12.5, color: on ? T.paper : T.muted }}>{p.label}</span>
              </button>
            );})}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Check size={15} /> حفظ</button>
            <button onClick={() => { setEditingId(null); setForm(null); }} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}
      {newUser && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>إضافة عضو جديد بالكامل</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>الاسم</label><input value={newUser.name} onChange={(e) => setNewUser((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>البريد الإلكتروني</label><input type="email" value={newUser.email} onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }} /></div>
          </div>
          <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>كلمة مرور مبدئية (يقدر يغيّرها بعدين)</label>
          <input type="text" value={newUser.password} onChange={(e) => setNewUser((f) => ({ ...f, password: e.target.value }))} placeholder="٦ أحرف على الأقل" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 14, fontSize: 13, background: T.sunken }} />
          <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 8 }}>الصلاحيات</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {!canEditPerms && <div style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.7 }}>تقدر تمنح الحساب الجديد الصلاحيات اللي عندك فقط.</div>}
            {grantable.map((p) => { const on = newUser.perms.includes(p.key); const Icon = p.icon; return (
              <button key={p.key} onClick={() => toggleNewPerm(p.key)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "start", border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "0D" : T.sunken, borderRadius: 11, padding: "10px 12px", cursor: "pointer" }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${on ? T.brass : T.faint}`, background: on ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={13} color="#fff" />}</span>
                <Icon size={14} color={on ? T.brass : T.faint} /><span style={{ fontSize: 12.5, color: on ? T.paper : T.muted }}>{p.label}</span>
              </button>
            );})}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={createUser} disabled={creating} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: creating ? "wait" : "pointer", opacity: creating ? .7 : 1 }}><UserPlus size={15} /> {creating ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button>
            <button onClick={() => setNewUser(null)} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── الإشعارات المؤقتة (تنبيه/مهم) مع تصويت اختياري محمي من التكرار ── */
export function ANoticesTab({ flashToast, log }) {
  const T = useSystemTheme();
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState(null);
  const load = () => supabase.from("notices").select("*").order("created_at", { ascending: false }).then(({ data }) => setNotices(data || []));
  useEffect(() => { load(); }, []);
  const startAdd = () => setForm({ title: "", body: "", kind: "info", durationDays: "7", votesEnabled: false });
  const create = async () => {
    if (!form.title.trim() || !form.body.trim()) { flashToast("لازم عنوان ونص"); return; }
    const expires_at = form.durationDays === "0" ? null : new Date(Date.now() + Number(form.durationDays) * 86400000).toISOString();
    await supabase.from("notices").insert({ title: form.title.trim(), body: form.body.trim(), kind: form.kind, votes_enabled: form.votesEnabled, expires_at });
    log("نشر إشعار جديد", `"${form.title.trim()}" (${form.kind}) — ${form.durationDays === "0" ? "بدون انتهاء" : `${form.durationDays} يوم`}`);
    flashToast("تم نشر الإشعار على الموقع"); setForm(null); load();
  };
  const remove = async (n) => { await supabase.from("notices").delete().eq("id", n.id); log("حذف إشعار", n.title); flashToast("تم الحذف"); load(); };
  const [voteCounts, setVoteCounts] = useState({});
  useEffect(() => {
    if (!notices.length) return;
    supabase.from("notice_votes").select("notice_id").then(({ data }) => {
      const counts = {};
      (data || []).forEach((v) => { counts[v.notice_id] = (counts[v.notice_id] || 0) + 1; });
      setVoteCounts(counts);
    });
  }, [notices]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={16} color={T.brass} /><span style={{ fontSize: 14, fontWeight: 700 }}>إشعارات الموقع العام</span></div>
          <button onClick={startAdd} style={{ display: "flex", alignItems: "center", gap: 6, background: T.brass, color: "#fff", border: "none", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><PlusCircle size={14} /> إشعار جديد</button>
        </div>
        <p style={{ fontSize: 12, color: T.muted, margin: "6px 0 0", lineHeight: 1.7 }}>يظهر بأعلى الموقع العام لكل الزوّار، ويختفي تلقائيًا بعد المدة اللي تحددها.</p>
      </div>

      {form && (
        <div style={{ background: T.surface, border: `1px solid ${T.brass}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>إشعار جديد</div>
          <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>الموضوع (العنوان)</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="مثال: اجتماع الملاك القادم" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 12, fontSize: 13, background: T.sunken }} />
          <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>النص</label>
          <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={4} placeholder="اكتب تفاصيل الإشعار هنا..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 12, fontSize: 13, background: T.sunken, fontFamily: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>النوع</label>
              <ASegmented value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} options={[{ value: "info", label: "تنبيه" }, { value: "important", label: "مهم" }]} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 }}>يبقى ظاهر لمدة</label>
              <select value={form.durationDays} onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken }}>
                <option value="1">يوم واحد</option><option value="3">3 أيام</option><option value="7">أسبوع</option>
                <option value="14">أسبوعين</option><option value="30">شهر</option><option value="0">بدون انتهاء (يدوي فقط)</option>
              </select>
            </div>
          </div>
          <button onClick={() => setForm((f) => ({ ...f, votesEnabled: !f.votesEnabled }))} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "start", border: `1px solid ${form.votesEnabled ? T.brass : T.line}`, background: form.votesEnabled ? T.brass + "0D" : T.sunken, borderRadius: 11, padding: "10px 12px", cursor: "pointer", width: "100%", marginBottom: 16 }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${form.votesEnabled ? T.brass : T.faint}`, background: form.votesEnabled ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{form.votesEnabled && <Check size={13} color="#fff" />}</span>
            <span style={{ fontSize: 12.5 }}>تفعيل التصويت (تأييد/عدم تأييد) — صوت واحد لكل جهاز، محمي من التكرار</span>
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={create} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}><Check size={15} /> نشر الإشعار</button>
            <button onClick={() => setForm(null)} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>الإشعارات الحالية</div>
        {notices.length === 0 ? (<div style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: 20 }}>ما فيه إشعارات منشورة حاليًا.</div>) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notices.map((n) => {
              const expired = n.expires_at && new Date(n.expires_at) < new Date();
              return (
                <div key={n.id} style={{ background: T.sunken, borderRadius: 12, padding: 12, opacity: expired ? .5 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {n.kind === "important" ? <ABadge kind="missing">مهم</ABadge> : <ABadge kind="change">تنبيه</ABadge>} {n.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>{n.body}</div>
                      <div style={{ fontSize: 11, color: T.faint, marginTop: 4 }}>
                        {expired ? "انتهى" : n.expires_at ? `ينتهي ${fmtAdminDate(n.expires_at)}` : "بدون انتهاء"}
                        {n.votes_enabled && ` · ${voteCounts[n.id] || 0} صوت`}
                      </div>
                    </div>
                    <button onClick={() => remove(n)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C0392B", flexShrink: 0 }}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
