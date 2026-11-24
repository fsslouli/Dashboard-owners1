/* admin-changelog-tab.jsx — تبويب «سجل التحديثات» بلوحة الإدارة (7.16.0)
   يتحكم بما يراه الزائر من سجل التحديثات (site_settings.changelog_mode، من migration-changelog-mode.sql)
   ويعرض السجل الكامل بتفاصيله للإدارة فقط — الموقع العام ما يحمّل التفاصيل إلا لو اخترت «للجميع». */
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";
import { CHANGELOG } from "./changelog-legal-data.jsx";

const S = {
  wrap: { maxWidth: 820, margin: "0 auto", padding: "4px 0", color: "#1F2C35" },
  card: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 16, marginBottom: 14 },
  h: { fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 12.5, color: "#5F7280", margin: "0 0 12px", lineHeight: 1.8 },
  btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "8px 13px", cursor: "pointer", display: "inline-flex", font: "inherit", fontSize: 13, color: "#1F2C35" },
};
const MODES = [
  ["versions", "أرقام الإصدارات فقط", "الزائر يشوف رقم الإصدار وتاريخه بدون أي تفاصيل (الافتراضي)"],
  ["hidden", "رقم الإصدار بدون زر", "الرقم يظهر بتذييل الموقع كنص عادي ولا ينفتح له سجل"],
  ["all", "التفاصيل للجميع", "الزائر يفتح السجل ويقرأ تفاصيل كل تحديث (بدون بنود الإصلاحات الداخلية)"],
];

export function AChangelogTab({ flashToast, log, canManage }) {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    supabase.from("site_settings").select("changelog_mode").eq("id", 1).single()
      .then(({ data, error }) => setMode(error || !data ? "missing" : data.changelog_mode || "versions"));
  }, []);
  if (mode === "missing") return <div style={S.wrap} dir="rtl"><div style={S.card}>الخاصية تحتاج تجهيز قاعدة البيانات مرة واحدة: شغّل ملف <b>migration-changelog-mode.sql</b> ثم حدّث الصفحة.</div></div>;
  if (!mode) return <div style={S.wrap}>جارٍ التحميل…</div>;
  const save = async (m) => {
    if (m === mode) return;
    if (m === "all" && !window.confirm("إظهار تفاصيل التحديثات لكل زائر للموقع؟")) return;
    const { error } = await supabase.from("site_settings").update({ changelog_mode: m }).eq("id", 1);
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); return; }
    setMode(m); flashToast("تم الحفظ");
    log("سجل التحديثات", `ظهوره للزائر: ${MODES.find((x) => x[0] === m)[1]}`);
  };
  return (
    <div style={S.wrap} dir="rtl">
      <div style={S.card}>
        <h3 style={S.h}><History size={17} />ظهور سجل التحديثات للزائر</h3>
        <p style={S.sub}>تفاصيل التحديثات تبقى هنا بالإدارة. اختر وش يشوف الزائر لما يضغط رقم الإصدار بتذييل الموقع.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MODES.map(([k, t, d]) => (
            <button key={k} type="button" aria-pressed={mode === k} disabled={!canManage} onClick={() => save(k)} style={{ ...S.btn, flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "9px 13px", borderWidth: 2, borderColor: mode === k ? "#1B7F8E" : "#E1E8EC", background: mode === k ? "#1B7F8E10" : "#fff" }}>
              <b style={{ fontSize: 13, color: mode === k ? "#1B7F8E" : "#1F2C35" }}>{t}</b><span style={{ fontSize: 11.5, color: "#5F7280", textAlign: "right" }}>{d}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <h3 style={S.h}>سجل التحديثات الكامل (للإدارة فقط)</h3>
        {CHANGELOG.map((e) => (
          <div key={e.version} style={{ borderTop: "1px solid #EEF2F5", padding: "10px 0" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>v{e.version} <span style={{ color: "#5F7280", fontWeight: 400 }}>· {e.dateAr}</span></div>
            <ul style={{ margin: "6px 0 0", paddingInlineStart: 18, fontSize: 12.5, lineHeight: 1.85, color: "#44525C" }}>{(e.ar || []).map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}
