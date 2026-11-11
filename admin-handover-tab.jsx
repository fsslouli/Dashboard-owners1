/* admin-handover-tab.jsx — تبويب «فحص الاستلام» بلوحة الإدارة (7.1.0)
   زر الظهور بالموقع (مخفي / للملاك المسجّلين / للجميع) + معاينة الصفحة كما يراها المالك + فهرس البنود.
   المحتوى نفسه في handover-data.jsx، والعمود site_settings.handover_mode من migration-handover.sql. */
import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Eye } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";
import { HANDOVER_MODELS, SEV, handoverItemsFor } from "./handover-data.jsx";
import { HandoverPage } from "./handover-kit.jsx";

const S = {
  wrap: { maxWidth: 820, margin: "0 auto", padding: "4px 0", color: "#1F2C35" },
  card: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 16, marginBottom: 14 },
  h: { fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 12.5, color: "#5F7280", margin: "0 0 12px", lineHeight: 1.8 },
  btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "8px 13px", fontWeight: 500, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", font: "inherit", fontSize: 13, color: "#1F2C35" },
  chip: (c) => ({ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: c + "1A", color: c, whiteSpace: "nowrap" }),
};
const MODES = [["hidden", "مخفي", "ما يظهر لأي زائر — للإدارة فقط (المعاينة)"], ["owners", "للملاك المسجّلين", "يظهر بعد الدخول بحساب الفيلا"], ["all", "للجميع", "يظهر لكل زائر للموقع"]];

export function AHandoverTab({ flashToast, log, canManage }) {
  const [mode, setMode] = useState(null);
  const [preview, setPreview] = useState(false);
  const [model, setModel] = useState("");
  useEffect(() => {
    supabase.from("site_settings").select("handover_mode").eq("id", 1).single()
      .then(({ data, error }) => setMode(error || !data ? "missing" : data.handover_mode || "hidden"));
  }, []);
  const sections = useMemo(() => handoverItemsFor(model), [model]);
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const bySev = useMemo(() => { const c = { d: 0, m: 0, f: 0 }; sections.forEach((s) => s.items.forEach((it) => { c[it.sev] += 1; })); return c; }, [sections]);

  if (mode === "missing") return <div style={S.wrap} dir="rtl"><div style={S.card}>الخاصية تحتاج تجهيز قاعدة البيانات مرة واحدة: شغّل ملف <b>migration-handover.sql</b> ثم حدّث الصفحة.</div></div>;
  if (!mode) return <div style={S.wrap}>جارٍ التحميل…</div>;

  const saveMode = async (m) => {
    if (m === mode) return;
    if (m !== "hidden" && !window.confirm(`نشر صفحة «فحص الاستلام» ${m === "all" ? "لكل الزوّار" : "للملاك المسجّلين"}؟`)) return;
    const { error } = await supabase.from("site_settings").update({ handover_mode: m }).eq("id", 1);
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); return; }
    setMode(m); flashToast(m === "hidden" ? "الصفحة مخفية الآن" : "تم النشر");
    log("فحص الاستلام", `ظهور الصفحة: ${MODES.find((x) => x[0] === m)[1]}`);
  };

  return (
    <div style={S.wrap} dir="rtl">
      <div style={S.card}>
        <h3 style={S.h}><ClipboardCheck size={17} />فحص استلام الفيلا</h3>
        <p style={S.sub}>قائمة فحص تفاعلية للمالك يوم الاستلام: يختار نموذجه، يعلّم كل بند (سليم / ملاحظة / لا ينطبق)، ويطبع تقرير ملاحظاته ليسلّمه لممثل المطور. إجابات المالك تبقى على جهازه فقط.</p>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ظهور الصفحة في الموقع</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MODES.map(([k, t, d]) => (
            <button key={k} type="button" aria-pressed={mode === k} disabled={!canManage} onClick={() => saveMode(k)} style={{ ...S.btn, flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "9px 13px", borderWidth: 2, borderColor: mode === k ? "#1B7F8E" : "#E1E8EC", background: mode === k ? "#1B7F8E10" : "#fff" }}>
              <b style={{ fontSize: 13, color: mode === k ? "#1B7F8E" : "#1F2C35" }}>{t}</b><span style={{ fontSize: 11.5, color: "#5F7280" }}>{d}</span>
            </button>
          ))}
        </div>
        <button type="button" style={{ ...S.btn, marginTop: 14, background: "#1B7F8E", borderColor: "#1B7F8E", color: "#fff" }} onClick={() => setPreview(true)}><Eye size={15} />معاينة الصفحة كما يراها المالك</button>
      </div>

      <div style={S.card}>
        <h3 style={S.h}>فهرس البنود</h3>
        <p style={S.sub}>{total} بند{model ? ` لنموذج ${HANDOVER_MODELS.find((m) => m.key === model).label}` : " (كل النماذج)"} — {bySev.d} خطرة · {bySev.m} مهمة · {bySev.f} تشطيب. كل بند فيه طريقة الفحص ومعيار القبول ومرجعه (بند الكود السعودي أو رقم الاستفسار).</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <button type="button" style={{ ...S.btn, padding: "5px 11px", ...(model === "" ? { borderColor: "#1B7F8E", color: "#1B7F8E" } : {}) }} onClick={() => setModel("")}>الكل</button>
          {HANDOVER_MODELS.map((m) => <button key={m.key} type="button" style={{ ...S.btn, padding: "5px 11px", ...(model === m.key ? { borderColor: "#1B7F8E", color: "#1B7F8E" } : {}) }} onClick={() => setModel(m.key)}>{m.label}</button>)}
        </div>
        {sections.map((s) => (
          <details key={s.key} style={{ borderTop: "1px solid #EEF2F5", padding: "9px 0" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13.5 }}>{s.title} <span style={{ color: "#5F7280", fontWeight: 400 }}>({s.items.length})</span></summary>
            {s.items.map((it) => (
              <div key={it.id} style={{ padding: "8px 0 2px", fontSize: 12.5, lineHeight: 1.85 }}>
                <b>{it.t}</b> <span style={S.chip(SEV[it.sev].color)}>{SEV[it.sev].label}</span>
                <div style={{ color: "#44525C" }}>المقبول: {it.ok}</div>
                <div style={{ color: "#8B95A1", fontSize: 11.5 }}>{it.ref}</div>
              </div>
            ))}
          </details>
        ))}
      </div>
      {preview && <HandoverPage preview onClose={() => setPreview(false)} />}
    </div>
  );
}
