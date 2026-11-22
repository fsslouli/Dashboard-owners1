/* ═══════════════════════════════════════════════════════════
   meeting-chip-kit.jsx — زر الاجتماع بجنب «جديد الحي» (7.13.0)
   زر اختصار واحد بالهيدر، يفلتر الاستفسارات حسب اجتماع تحدده من لوحة الإدارة.
   الإعدادات تُخزَّن بلا هجرة في site_settings.nav_labels._meetingChip:
     { on, ar, en, mode, from, to, meeting, ids[], include[], exclude[], until }
   أربع طرق للربط (mode):
     week    — كل بند تعدّل آخر ٧ أيام (أو عدد أيام تحدده: days)
     period  — كل بند تعدّل بين تاريخين (from → to)
     meeting — البنود المربوطة باجتماع معيّن (حقل «الاجتماع» الموجود أصلًا)
     manual  — اختيار يدوي بند بند
   وفوق أي طريقة: include (إضافة يدوية) و exclude (استثناء يدوي).
   ═══════════════════════════════════════════════════════════ */
import { useMemo, useState } from "react";
import { CalendarDays, Check, Eye, EyeOff, Plus, X } from "lucide-react";
import { patchNavLabels } from "./nav-labels-kit.jsx";

export const MODES = [
  ["week", "آخر أيام", "كل بند تعدّل في آخر عدد أيام تحدده"],
  ["period", "فترة محددة", "كل بند تعدّل بين تاريخين تحددهما"],
  ["meeting", "حسب الاجتماع", "البنود المربوطة بالاجتماع في حقل «الاجتماع»"],
  ["manual", "اختيار يدوي", "أنت تختار البنود واحد واحد"],
];
export const DEFAULT_CHIP = { on: false, ar: "الاجتماع الثامن", en: "8th Meeting", mode: "week", days: 7, from: "", to: "", meeting: "", ids: [], include: [], exclude: [], until: "" };

export function chipCfg(navLabels) {
  const c = navLabels && navLabels._meetingChip;
  return c && typeof c === "object" ? { ...DEFAULT_CHIP, ...c } : { ...DEFAULT_CHIP };
}
const day = (d) => String(d || "").slice(0, 10);
export function chipActive(c) {
  if (!c || !c.on) return false;
  if (c.until && day(c.until) < new Date().toISOString().slice(0, 10)) return false;
  return true;
}
export function chipMatch(r, c) {
  if (!c) return false;
  const id = Number(r.id);
  if ((c.exclude || []).map(Number).includes(id)) return false;
  if ((c.include || []).map(Number).includes(id)) return true;
  const lm = day(r.last_modified);
  switch (c.mode) {
    case "week": {
      if (!lm) return false;
      const d = (Date.now() - new Date(lm + "T00:00:00").getTime()) / 86400000;
      return d >= 0 && d <= (Number(c.days) || 7);
    }
    case "period": return !!lm && (!c.from || lm >= day(c.from)) && (!c.to || lm <= day(c.to));
    case "meeting": {
      const ms = Array.isArray(r.meetings) && r.meetings.length ? r.meetings : r.meeting ? [r.meeting] : [];
      return !!c.meeting && ms.includes(c.meeting);
    }
    case "manual": return (c.ids || []).map(Number).includes(id);
    default: return false;
  }
}

/* ── بطاقة الإدارة ── */
const S = {
  card: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 16, marginBottom: 14, color: "#1F2C35" },
  h: { fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 12.5, color: "#5F7280", margin: "0 0 12px", lineHeight: 1.8 },
  inp: { boxSizing: "border-box", border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 10, padding: "8px 11px", font: "inherit", fontSize: 13.5, color: "#1F2C35" },
  btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "7px 12px", fontWeight: 500, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", font: "inherit", fontSize: 13, color: "#1F2C35" },
  pri: { background: "#1B7F8E", borderColor: "#1B7F8E", color: "#fff" },
  lab: { fontSize: 12, fontWeight: 700, color: "#5F7280", margin: "12px 0 6px" },
};

export function AMeetingChipCard({ supabase, navLabels, inquiries, flashToast, log, canEdit }) {
  const saved = useMemo(() => chipCfg(navLabels), [navLabels]);
  const [c, setC] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const up = (p) => { setC((x) => ({ ...x, ...p })); setDirty(true); };

  const meetingNames = useMemo(() => [...new Set((inquiries || []).flatMap((r) => (Array.isArray(r.meetings) ? r.meetings : []).concat(r.meeting ? [r.meeting] : [])).filter(Boolean))], [inquiries]);
  const matched = useMemo(() => (inquiries || []).filter((r) => chipMatch(r, c)), [inquiries, c]);
  /* قائمة الاختيار اليدوي: الأحدث تعديلًا أولًا، وأي بند ضمن آخر ٧ أيام يُعلَّم «تعدّل مؤخرًا» */
  const sorted = useMemo(() => [...(inquiries || [])].sort((a, b) => String(b.last_modified || "").localeCompare(String(a.last_modified || "")) || b.id - a.id), [inquiries]);
  const [show, setShow] = useState(30);
  const toggleIn = (key, id) => up({ [key]: (c[key] || []).map(Number).includes(id) ? (c[key] || []).filter((x) => Number(x) !== id) : [...(c[key] || []), id] });
  const markWeek = () => {
    const ids = sorted.filter((r) => chipMatch(r, { mode: "week", days: 7, exclude: [], include: [] })).map((r) => Number(r.id));
    up({ ids: [...new Set([...(c.ids || []).map(Number), ...ids])] });
  };

  const save = async () => {
    setBusy(true);
    const { error } = await patchNavLabels(supabase, (o) => { o._meetingChip = c; return o; }, "زر الاجتماع");
    setBusy(false);
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); return; }
    setDirty(false); flashToast(c.on ? "حُفظ — الزر ظاهر للزوّار" : "حُفظ — الزر مخفي");
    log && log("زر الاجتماع", `${c.on ? "تشغيل" : "إيقاف"} «${c.ar}» — ${MODES.find((m) => m[0] === c.mode)?.[1]} — ${matched.length} بند`);
  };
  const dis = !canEdit;
  const modeOn = (m) => c.mode === m;
  const pill = (on) => ({ ...S.btn, ...(on ? S.pri : {}) });

  return (
    <div style={S.card} dir="rtl">
      <h3 style={S.h}><CalendarDays size={17} />زر الاجتماع (بجنب «جديد الحي»)</h3>
      <p style={S.sub}>زر اختصار واحد بالهيدر يفلتر الاستفسارات اللي تخص اجتماعًا معينًا. اختر طريقة الربط، وشوف المعاينة تحت قبل الحفظ.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={dis} style={pill(c.on)} onClick={() => up({ on: !c.on })}>{c.on ? <Eye size={15} /> : <EyeOff size={15} />}{c.on ? "ظاهر للزوّار" : "مخفي"}</button>
        <input disabled={dis} value={c.ar} onChange={(e) => up({ ar: e.target.value })} placeholder="الاسم بالعربي" style={{ ...S.inp, flex: "1 1 150px" }} />
        <input disabled={dis} value={c.en} onChange={(e) => up({ en: e.target.value })} placeholder="English name" dir="ltr" style={{ ...S.inp, flex: "1 1 130px" }} />
      </div>

      <div style={S.lab}>طريقة الربط</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {MODES.map(([k, l]) => <button key={k} type="button" disabled={dis} style={pill(modeOn(k))} onClick={() => up({ mode: k })}>{modeOn(k) && <Check size={14} />}{l}</button>)}
      </div>
      <p style={{ ...S.sub, margin: "6px 0 0" }}>{MODES.find((m) => m[0] === c.mode)?.[2]}</p>

      {c.mode === "week" && <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>آخر <input disabled={dis} type="number" min={1} max={60} value={c.days} onChange={(e) => up({ days: e.target.value })} style={{ ...S.inp, width: 70 }} /> يوم</div>}
      {c.mode === "period" && <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>من <input disabled={dis} type="date" value={c.from} onChange={(e) => up({ from: e.target.value })} style={S.inp} /> إلى <input disabled={dis} type="date" value={c.to} onChange={(e) => up({ to: e.target.value })} style={S.inp} /></div>}
      {c.mode === "meeting" && <div style={{ marginTop: 10 }}>
        <select disabled={dis} value={c.meeting} onChange={(e) => up({ meeting: e.target.value })} style={S.inp}>
          <option value="">— اختر الاجتماع —</option>
          {meetingNames.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>}
      {c.mode === "manual" && <div style={{ marginTop: 10 }}><button type="button" disabled={dis} style={S.btn} onClick={markWeek}><Plus size={14} />علّم كل ما تعدّل آخر ٧ أيام</button></div>}

      <div style={S.lab}>تاريخ انتهاء الزر (اختياري)</div>
      <input disabled={dis} type="date" value={c.until} onChange={(e) => up({ until: e.target.value })} style={S.inp} />

      <div style={S.lab}>المعاينة — {matched.length} بند يدخل الزر</div>
      <p style={{ ...S.sub, margin: "0 0 8px" }}>
        ✓ = يدخل الزر. اضغط على أي بند تضيفه (+) أو تستثنيه (−) فوق الطريقة المختارة.
        {c.mode === "manual" ? " في الاختيار اليدوي الضغط يعلّم أو يشيل العلامة." : ""}
      </p>
      <div style={{ maxHeight: 340, overflow: "auto", border: "1px solid #E1E8EC", borderRadius: 12 }}>
        {sorted.slice(0, show).map((r) => {
          const id = Number(r.id), inn = chipMatch(r, c);
          const manual = c.mode === "manual";
          const onClick = () => {
            if (dis) return;
            if (manual) return toggleIn("ids", id);
            if (inn) { up({ exclude: [...new Set([...(c.exclude || []).map(Number), id])], include: (c.include || []).filter((x) => Number(x) !== id) }); }
            else { up({ include: [...new Set([...(c.include || []).map(Number), id])], exclude: (c.exclude || []).filter((x) => Number(x) !== id) }); }
          };
          const tag = (c.include || []).map(Number).includes(id) ? "أضفته" : (c.exclude || []).map(Number).includes(id) ? "استثنيته" : "";
          return (
            <button key={id} type="button" onClick={onClick} style={{ display: "flex", gap: 9, alignItems: "center", width: "100%", textAlign: "start", border: 0, borderBottom: "1px solid #EEF2F4", background: inn ? "#EAF5F1" : "#fff", padding: "8px 11px", font: "inherit", fontSize: 12.5, cursor: dis ? "default" : "pointer", color: "#1F2C35" }}>
              <span style={{ width: 18, height: 18, flex: "none", borderRadius: 5, display: "grid", placeItems: "center", background: inn ? "#2E7D5B" : "#EEF2F4", color: "#fff" }}>{inn ? <Check size={12} /> : <X size={11} color="#9AA9B3" />}</span>
              <b style={{ minWidth: 28 }}>{id}</b>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(r.note || "").slice(0, 80)}</span>
              {tag && <span style={{ fontSize: 10.5, color: "#B7791F", fontWeight: 700 }}>{tag}</span>}
              <span style={{ fontSize: 11, color: "#7C8C97", whiteSpace: "nowrap" }}>{String(r.last_modified || "").slice(5)}</span>
            </button>
          );
        })}
        {show < sorted.length && <button type="button" style={{ ...S.btn, margin: 8 }} onClick={() => setShow((n) => n + 40)}>عرض المزيد</button>}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" disabled={dis || busy || !dirty} style={{ ...S.btn, ...S.pri, opacity: dis || !dirty ? 0.5 : 1 }} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
        {dirty && <span style={{ fontSize: 12, color: "#B7791F" }}>فيه تعديلات غير محفوظة</span>}
      </div>
    </div>
  );
}
