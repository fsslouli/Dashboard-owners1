/* admin-match-check.jsx — «فحص المطابقة» (7.9.0)
   يقرأ شيت «الاستفسارات» من ملف الإكسل ويقارنه بالموقع بنفس محرك المزامنة (نفس التنظيف ونفس قواعد المقارنة)،
   ويعرض النتيجة فقط: مطابق، أو قائمة الفروقات بندًا بندًا. قراءة فقط — ما يكتب أي شي بقاعدة البيانات. */
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Check, ShieldCheck, X } from "lucide-react";
import { ADMIN_FIELD_LABEL, INQ_FIELDS_ADMIN, REAL_BOOL_FIELDS, cmpVal, isBlankCell, toYesNo, useSystemTheme } from "./admin-core.jsx";
import { readSheetWithMeta } from "./admin-excel-utils.jsx";
import * as Brain from "./import-brain.js";

const short = (v) => { const s = isBlankCell(v) ? "—" : String(toYesNo(v)).replace(/\s+/g, " ").trim(); return s.length > 110 ? s.slice(0, 110) + "…" : s; };

/* المقارنة نفسها — مفصولة عن الواجهة حتى تُختبر وحدها */
export function matchCheck(fileRows, siteRows, fields = INQ_FIELDS_ADMIN) {
  const byId = new Map((siteRows || []).map((r) => [String(r.id), r]));
  const seen = new Set(); const diffs = []; const onlyFile = []; let blanks = 0;
  (fileRows || []).forEach((row) => {
    const k = String(row.id ?? "").trim(); if (!k) return;
    seen.add(k);
    const cur = byId.get(k);
    if (!cur) { onlyFile.push(k); return; }
    const fd = [];
    fields.forEach((f) => {
      const curVal = REAL_BOOL_FIELDS.includes(f) ? toYesNo(cur[f]) : cur[f];
      if (isBlankCell(row[f]) && !isBlankCell(curVal)) { if (row[f] !== undefined) blanks++; return; } /* خلية فاضية بالملف ما تمسح قيمة الموقع — نفس قاعدة المزامنة */
      if (cmpVal(f, row[f]) !== cmpVal(f, curVal)) fd.push({ f, file: row[f], site: curVal });
    });
    if (fd.length) diffs.push({ id: k, fields: fd });
  });
  const onlySite = (siteRows || []).map((r) => String(r.id)).filter((k) => !seen.has(k));
  return { total: seen.size, diffs, onlyFile, onlySite, blanks, ok: !diffs.length && !onlyFile.length && !onlySite.length };
}

export function AMatchCheck({ inquiries, categories, flashToast }) {
  const T = useSystemTheme();
  const ref = useRef(null);
  const [res, setRes] = useState(null);
  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
        const name = wb.SheetNames.find((n) => n.trim() === "الاستفسارات") || wb.SheetNames.find((n) => !/اجتماع|طلبات|ملاحظات|تقدم|progress/i.test(n));
        if (!name) { flashToast("ما لقيت شيت «الاستفسارات» بالملف"); return; }
        const approved = {};
        (categories || []).forEach((c) => {
          const f = { status: "status", pri: "pri", cat: "cat", model: "model", loc: "loc", owner: "owner", owner_title: "owner_title" }[c.key];
          if (f && Array.isArray(c.values) && c.values.length) approved[f] = c.values;
        });
        const { rows } = readSheetWithMeta(wb.Sheets[name], categories);
        const clean = rows.map((raw) => Brain.canonicalizeToApproved(Brain.autoFixRow(raw).row, approved).row);
        setRes({ file: file.name, sheet: name, at: new Date(), ...matchCheck(clean, inquiries) });
      } catch { flashToast("تعذّرت قراءة الملف"); }
    };
    reader.readAsArrayBuffer(file); e.target.value = "";
  };
  const good = "#1E8E5A", bad = "#C0392B";
  return (
    <div style={{ marginTop: 14, borderTop: `1px dashed ${T.line}`, paddingTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => ref.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", color: T.paper, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><ShieldCheck size={15} color={T.brass} /> فحص المطابقة</button>
        <span style={{ fontSize: 12, color: T.muted, flex: "1 1 200px", lineHeight: 1.7 }}>يقارن ملف الإكسل بالموقع ويعرض النتيجة فقط — ما يغيّر أي شي.</span>
        <input ref={ref} type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: "none" }} />
      </div>
      {res && (
        <div style={{ marginTop: 12, border: `1px solid ${res.ok ? good : bad}55`, background: (res.ok ? good : bad) + "10", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: res.ok ? good : bad }}>
              {res.ok ? <Check size={17} /> : <X size={17} />}
              {res.ok ? `مطابق — ${res.total} استفسار بلا أي فرق` : `غير مطابق — ${res.diffs.length} بند مختلف${res.onlyFile.length ? ` · ${res.onlyFile.length} بالملف فقط` : ""}${res.onlySite.length ? ` · ${res.onlySite.length} بالموقع فقط` : ""}`}
            </div>
            <button onClick={() => setRes(null)} aria-label="إغلاق النتيجة" style={{ background: "none", border: 0, color: T.muted, cursor: "pointer", padding: 2 }}><X size={15} /></button>
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}><span dir="ltr">{res.file}</span> · شيت «{res.sheet}» · {res.total} صف بالملف مقابل {inquiries.length} بالموقع</div>
          {res.onlyFile.length > 0 && <div style={{ fontSize: 12.5, marginTop: 8 }}><b>بالملف وليست بالموقع:</b> {res.onlyFile.join("، ")}</div>}
          {res.onlySite.length > 0 && <div style={{ fontSize: 12.5, marginTop: 8 }}><b>بالموقع وليست بالملف:</b> {res.onlySite.join("، ")}</div>}
          {res.diffs.slice(0, 40).map((d) => (
            <div key={d.id} style={{ marginTop: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.brass }}>استفسار {d.id}</div>
              {d.fields.map((x) => (
                <div key={x.f} style={{ fontSize: 12, lineHeight: 1.8, marginTop: 4 }}>
                  <b>{ADMIN_FIELD_LABEL[x.f] || x.f}</b>
                  <div style={{ color: T.muted }}>الإكسل: <span style={{ color: T.paper }}>{short(x.file)}</span></div>
                  <div style={{ color: T.muted }}>الموقع: <span style={{ color: T.paper }}>{short(x.site)}</span></div>
                </div>
              ))}
            </div>
          ))}
          {res.diffs.length > 40 && <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>+{res.diffs.length - 40} بند آخر مختلف</div>}
          {res.ok && res.blanks > 0 && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>ملاحظة: {res.blanks} خلية فاضية بالملف ولها قيمة بالموقع — الرفع ما يمسحها.</div>}
          {!res.ok && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10 }}>هذا فحص فقط. للتعديل استخدم «رفع ملف إكسل» وراجع الفروقات هناك.</div>}
        </div>
      )}
    </div>
  );
}
