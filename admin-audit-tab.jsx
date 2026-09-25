/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-audit-tab */
import { isoAdminDate, useSystemTheme } from "./admin-core.jsx";
import { useMemo, useState } from "react";
import * as Brain from "./import-brain.js";
import { AlertTriangle } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   ١٥ب. مدقّق ملف الاستفسارات — واجهة الطبقات الخمس.

   كل ما يُعرض هنا محسوب محليًا بملف import-brain.js: لا شبكة، لا خدمة
   خارجية، ولا مفتاح. نفس الملف يعطي نفس النتيجة دائمًا.

   مستوى «أوقف واقرأ» يُعرض بوضوح وما يمنع الاعتماد — القرار للمشرف.
   ═══════════════════════════════════════════════════════════ */
export function AImportAudit({ diffResults, inquiries, categories, sheets, sheetMeta, mapping, flashToast }) {
  const T = useSystemTheme();
  const [openLevels, setOpenLevels] = useState({ blocker: true, high: true, medium: false, low: false });
  const [showCols, setShowCols] = useState(false);

  /* القيم المعتمدة من جدول الفلاتر نفسه — ما نثبّت أي قيمة بالكود */
  const approved = useMemo(() => {
    const map = {};
    (categories || []).forEach((c) => {
      const f = { status: "status", pri: "pri", cat: "cat", model: "model", loc: "loc", owner: "owner" }[c.key];
      if (f && Array.isArray(c.values) && c.values.length) map[f] = c.values;
    });
    return map;
  }, [categories]);

  const auditSheets = useMemo(() => {
    if (!sheets) return [];
    return Object.entries(sheets)
      .filter(([name]) => {
        const cfg = (mapping || {})[name];
        return cfg && cfg.selected !== false && cfg.target !== "ignore";
      })
      .map(([name, rows]) => ({
        name, rows,
        meta: (sheetMeta || {})[name] || {},
        target: (mapping || {})[name]?.target,
      }));
  }, [sheets, sheetMeta, mapping]);

  const audit = useMemo(
    () => Brain.runFullAudit({ sheets: auditSheets, existing: inquiries || [], approved, diffResults: diffResults || [] }),
    [auditSheets, inquiries, approved, diffResults]
  );
  const digest = useMemo(() => Brain.changeDigest(diffResults || []), [diffResults]);

  const tone = {
    blocker: T.pri["عالية جدًا"],
    high: T.pri["عالية"] || T.pri["عالية جدًا"],
    medium: T.brass,
    low: T.muted,
  };
  const LEVELS = ["blocker", "high", "medium", "low"];

  const exportReport = () => {
    const text = Brain.auditToText(audit, digest);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `تقرير-تدقيق-${isoAdminDate(new Date())}.txt`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const copyReport = async () => {
    try { await navigator.clipboard.writeText(Brain.auditToText(audit, digest)); flashToast("نُسخ تقرير التدقيق"); }
    catch { flashToast("المتصفح منع النسخ"); }
  };

  const blockers = audit.counts.blocker || 0;

  return (
    <div style={{ margin: "12px 0 16px" }}>
      {/* شريط «أوقف واقرأ» — يظهر فقط عند وجود ما يستحق */}
      {blockers > 0 && (
        <div style={{
          background: `${T.pri["عالية جدًا"]}14`, border: `1.5px solid ${T.pri["عالية جدًا"]}`,
          borderRadius: 13, padding: "12px 14px", marginBottom: 11,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <AlertTriangle size={16} color={T.pri["عالية جدًا"]} />
            <b style={{ fontSize: 13, color: T.pri["عالية جدًا"] }}>
              {blockers === 1 ? "ملاحظة واحدة تستحق التوقّف" : `${blockers} ملاحظات تستحق التوقّف`}
            </b>
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.8 }}>
            الاعتماد ما زال متاحًا — لكن اقرأها قبل ما تكمّل.
          </div>
        </div>
      )}

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, background: T.sunken }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 9 }}>
          <b style={{ fontSize: 13 }}>تدقيق الملف</b>
          {LEVELS.map((lv) => audit.counts[lv] ? (
            <button key={lv} onClick={() => setOpenLevels((o) => ({ ...o, [lv]: !o[lv] }))} style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${tone[lv]}`, background: openLevels[lv] ? tone[lv] : "transparent",
              color: openLevels[lv] ? T.onAccent : tone[lv],
            }}>{Brain.LEVEL_AR[lv]}: {audit.counts[lv]}</button>
          ) : null)}
          {!audit.findings.length && (
            <span style={{ fontSize: 11.5, color: T.sta["معتمدة"] }}>ما فيه أي ملاحظة — الملف نظيف</span>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={() => setShowCols((v) => !v)} style={{
            fontSize: 11.5, background: "none", border: "none", color: T.brass, cursor: "pointer", fontFamily: "inherit",
          }}>{showCols ? "إخفاء ربط الأعمدة" : "ربط الأعمدة"}</button>
          <button onClick={copyReport} style={{
            fontSize: 11.5, background: "none", border: "none", color: T.brass, cursor: "pointer", fontFamily: "inherit",
          }}>نسخ التقرير</button>
          <button onClick={exportReport} style={{
            fontSize: 11.5, background: "none", border: "none", color: T.brass, cursor: "pointer", fontFamily: "inherit",
          }}>تنزيل</button>
        </div>

        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.9 }}>
          {digest.head}
          {digest.lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        {/* خريطة ربط الأعمدة — تكشف أي عمود يُهمل بصمت */}
        {showCols && audit.structure.map((sec, i) => (
          <div key={i} style={{ marginTop: 11, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7 }}>{sec.sheet} — {sec.rowCount} صف</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {(sec.columns || []).map((c) => (
                <div key={c.letter} style={{ fontSize: 11.5, display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="mono" style={{ color: T.faint, minWidth: 22 }}>{c.letter}</span>
                  <span style={{ flex: 1, minWidth: 0, color: T.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.raw || <i style={{ color: T.faint }}>بلا عنوان</i>}
                  </span>
                  <span style={{ color: c.field ? T.sta["معتمدة"] : (c.nonEmpty ? T.pri["عالية جدًا"] : T.faint) }}>
                    {c.field ? Brain.fieldLabel(c.field) : (c.nonEmpty ? `مُهمَل (${c.nonEmpty} قيمة)` : "فارغ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* الملاحظات مجمّعة بالمستوى */}
        {LEVELS.map((lv) => {
          const group = audit.findings.filter((f) => f.level === lv);
          if (!group.length || !openLevels[lv]) return null;
          return (
            <div key={lv} style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
              {group.map((f, i) => (
                <div key={i} style={{
                  display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12, lineHeight: 1.7,
                  background: T.surface, border: `1px solid ${T.line}`, borderInlineStart: `3px solid ${tone[lv]}`,
                  borderRadius: 10, padding: "8px 10px",
                }}>
                  <span className="mono" style={{ fontSize: 10.5, color: T.faint, flex: "none", minWidth: 46, textAlign: "start" }}>
                    {f.cell || (f.key !== "—" ? `#${f.key}` : "—")}
                  </span>
                  <span style={{ flex: 1 }}>
                    {f.field && <b style={{ color: T.paper }}>{Brain.fieldLabel(f.field)}: </b>}
                    <span style={{ color: T.muted }}>{f.msg}</span>
                    {f.suggest && <span style={{ color: T.sta["معتمدة"] }}> ← المقترح: {f.suggest}</span>}
                  </span>
                </div>
              ))}
            </div>
          );
        })}

        {audit.truncated > 0 && (
          <div style={{ fontSize: 11.5, color: T.faint, marginTop: 9 }}>
            و{audit.truncated} ملاحظة إضافية لم تُعرض — عالج الأعلى مستوى ثم أعد الرفع.
          </div>
        )}
      </div>
    </div>
  );
}
