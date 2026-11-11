/* handover-kit.jsx — صفحة «فحص الاستلام» (7.1.0)
   قائمة فحص تفاعلية للمالك يوم استلام فيلته: يختار نموذجه، يمرّ على البنود (سليم / ملاحظة / لا ينطبق)،
   يكتب ملاحظته، ثم يطبع تقرير الملاحظات ليسلّمه لممثل المطور.
   • الإجابات تُحفظ على جهاز المالك فقط (localStorage) — ما يُرسل شي للخادم.
   • الظهور بالموقع يتحكم فيه site_settings.handover_mode: hidden (الافتراضي) | owners | all — من لوحة الإدارة.
   • المحتوى في handover-data.jsx. هذا الملف يُحمَّل عند الطلب فقط (ما يثقّل الصفحة الرئيسية). */
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ClipboardCheck, Minus, Printer, RotateCcw, TriangleAlert, X } from "lucide-react";
import { THEMES } from "./site-data.jsx";
import { HANDOVER_INTRO, HANDOVER_MODELS, HANDOVER_TOOLS, SEV, handoverItemsFor } from "./handover-data.jsx";

const KEY = "handover_v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const digits = (s) => String(s ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");

function useDark() {
  const [d, setD] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)"); if (!mq) return undefined;
    const h = (e) => setD(e.matches); mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return d;
}

/* تقرير للطباعة: «notes» = الملاحظات فقط · «blank» = القائمة كاملة فارغة للفحص الورقي */
function printReport(kind, sections, state) {
  const model = HANDOVER_MODELS.find((m) => m.key === state.model);
  const ans = state.a || {};
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "long", year: "numeric" });
  let n = 0;
  const body = sections.map((s) => {
    const items = kind === "blank" ? s.items : s.items.filter((it) => ans[it.id]?.s === "bad");
    if (!items.length) return "";
    return `<tr class="sec"><td colspan="${kind === "blank" ? 5 : 5}">${esc(s.title)}</td></tr>` + items.map((it) => {
      n += 1;
      const sev = SEV[it.sev];
      return kind === "blank"
        ? `<tr><td class="n">${n}</td><td><b>${esc(it.t)}</b><div class="how">${esc(it.how)}</div><div class="ok">القبول: ${esc(it.ok)}</div></td><td class="sv" style="color:${sev.color}">${sev.label}</td><td class="bx">☐ سليم<br>☐ ملاحظة<br>☐ لا ينطبق</td><td class="nt"></td></tr>`
        : `<tr><td class="n">${n}</td><td><b>${esc(it.t)}</b><div class="ok">المطلوب: ${esc(it.ok)}</div><div class="ref">${esc(it.ref)}</div></td><td class="sv" style="color:${sev.color}">${sev.label}</td><td class="nt2" colspan="2">${esc(ans[it.id]?.n || "—")}</td></tr>`;
    }).join("");
  }).join("");
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فحص الاستلام${state.villa ? ` — فيلا ${state.villa}` : ""}</title>
<style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{font-family:"IBM Plex Sans Arabic","Noto Naskh Arabic","Geeza Pro","Segoe UI",Tahoma,Arial,sans-serif;color:#17222B;margin:0;font-size:9.6pt;line-height:1.75}
header{border-bottom:2.5px solid #1B7F8E;padding-bottom:7px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
h1{font-size:15pt;margin:0}.meta{font-size:9pt;color:#5F7280}
table{width:100%;border-collapse:collapse}thead{display:table-header-group}
th{background:#1B7F8E;color:#fff;font-weight:600;padding:5px 7px;font-size:9pt;text-align:right}
td{border:1px solid #D5DEE4;padding:6px 7px;vertical-align:top}
tr{break-inside:avoid;page-break-inside:avoid}
tr.sec td{background:#E6F1F3;color:#0F5F6B;font-weight:700;font-size:10pt}
td.n{text-align:center;width:8mm;font-weight:700}td.sv{width:15mm;font-weight:700;text-align:center}
td.bx{width:24mm;font-size:8.6pt;white-space:nowrap}td.nt{width:44mm}td.nt2{width:70mm;white-space:pre-wrap}
.how{color:#44525C;font-size:8.8pt}.ok{font-size:8.8pt;color:#0F5F6B}.ref{font-size:8pt;color:#8B95A1}
.sign{display:flex;gap:14mm;margin-top:10mm;font-size:9.5pt}.sign div{flex:1;border-top:1px solid #17222B;padding-top:4px}
.bar{position:fixed;bottom:12px;left:12px}.bar button{font:inherit;padding:8px 14px;border-radius:9px;border:1px solid #1B7F8E;background:#1B7F8E;color:#fff;cursor:pointer}
@media print{.bar{display:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
<header><div><h1>${kind === "blank" ? "قائمة فحص استلام الفيلا" : "تقرير ملاحظات استلام الفيلا"}</h1><div class="meta">مشروع ألبورادا${model ? ` · نموذج ${esc(model.label)}` : ""}${state.villa ? ` · فيلا رقم ${esc(state.villa)}` : ""}</div></div>
<div class="meta">${today}${kind === "notes" ? ` · عدد الملاحظات: ${n}` : ""}</div></header>
${n ? `<table><thead><tr><th>م</th><th>البند</th><th>الأهمية</th>${kind === "blank" ? "<th>النتيجة</th><th>ملاحظات</th>" : '<th colspan="2">ملاحظة المالك</th>'}</tr></thead><tbody>${body}</tbody></table>` : "<p>لا توجد ملاحظات مسجّلة.</p>"}
<div class="sign"><div>المالك: الاسم والتوقيع</div><div>ممثل المطور: الاسم والتوقيع</div><div>التاريخ</div></div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

export function HandoverPage({ villa = null, onClose, preview = false }) {
  const T = useDark() ? THEMES.dark : THEMES.light;
  const [state, setState] = useState(() => { const s = load(); return { model: s.model || "", villa: villa ? String(villa) : s.villa || "", a: s.a || {} }; });
  const [open, setOpen] = useState(null);
  const [only, setOnly] = useState("all");      // all | todo | bad
  useEffect(() => { save(state); }, [state]);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  const sections = useMemo(() => handoverItemsFor(state.model), [state.model]);
  const all = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const stat = useMemo(() => {
    const a = state.a; let ok = 0, bad = 0, na = 0, badD = 0;
    all.forEach((it) => { const s = a[it.id]?.s; if (s === "ok") ok += 1; else if (s === "bad") { bad += 1; if (it.sev === "d") badD += 1; } else if (s === "na") na += 1; });
    return { ok, bad, na, badD, done: ok + bad + na, total: all.length };
  }, [all, state.a]);
  const setAns = (id, patch) => setState((p) => ({ ...p, a: { ...p.a, [id]: { ...(p.a[id] || {}), ...patch } } }));
  const mark = (id, s) => setState((p) => { const cur = p.a[id] || {}; const a = { ...p.a }; if (cur.s === s) { a[id] = { ...cur, s: undefined }; } else a[id] = { ...cur, s }; return { ...p, a }; });
  const reset = () => { if (window.confirm("مسح كل الإجابات والملاحظات المحفوظة على هذا الجهاز؟")) setState((p) => ({ ...p, a: {} })); };
  const pct = stat.total ? Math.round((stat.done / stat.total) * 100) : 0;

  const pill = (on, c) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 10, border: `1px solid ${on ? c : T.line}`, background: on ? c + "22" : "transparent", color: on ? c : T.muted, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit" });
  const btn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: 11, border: `1px solid ${T.line}`, background: T.surface, color: T.paper, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label="فحص الاستلام" style={{ position: "fixed", inset: 0, zIndex: 2147482500, background: T.bg, color: T.paper, overflowY: "auto", fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 2, background: T.bg, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ClipboardCheck size={20} color={T.brass} />
            <b style={{ fontSize: 16, flex: 1 }}>فحص استلام الفيلا{preview ? " — معاينة الإدارة" : ""}</b>
            <button type="button" onClick={onClose} aria-label="إغلاق" style={{ width: 36, height: 36, border: "none", background: "transparent", color: T.muted, cursor: "pointer", display: "grid", placeItems: "center" }}><X size={20} /></button>
          </div>
          {state.model && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 6, borderRadius: 99, background: T.sunken, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: T.brass, transition: "width .3s" }} /></div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: T.muted, marginTop: 6 }}>
                <span>{stat.done} من {stat.total} بند</span><span style={{ color: "#2E7D5B" }}>سليم {stat.ok}</span>
                <span style={{ color: "#B5382C" }}>ملاحظات {stat.bad}{stat.badD ? ` (منها ${stat.badD} خطرة)` : ""}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 90px" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>نموذج فيلتك</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
            {HANDOVER_MODELS.map((m) => {
              const on = state.model === m.key;
              return (
                <button key={m.key} type="button" aria-pressed={on} onClick={() => setState((p) => ({ ...p, model: m.key }))} style={{ textAlign: "start", padding: "10px 12px", borderRadius: 12, border: `2px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "14" : "transparent", color: T.paper, cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: on ? T.brass : T.paper }}>{m.label}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{m.note}</div>
                </button>
              );
            })}
          </div>
          <label style={{ display: "block", fontSize: 12.5, color: T.muted, margin: "12px 0 6px" }} htmlFor="ho-villa">رقم الفيلا (يظهر في التقرير)</label>
          <input id="ho-villa" value={state.villa} disabled={!!villa} onChange={(e) => setState((p) => ({ ...p, villa: digits(e.target.value).slice(0, 3) }))} inputMode="numeric" dir="ltr" placeholder="مثال: 120"
            style={{ width: 130, boxSizing: "border-box", padding: "9px 11px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, fontSize: 15, textAlign: "center", fontFamily: "inherit" }} />
        </div>

        {!state.model ? (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>قبل ما تبدأ</div>
            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 2 }}>{HANDOVER_INTRO.map((x) => <li key={x}>{x}</li>)}</ul>
            <div style={{ fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>خذ معك</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{HANDOVER_TOOLS.map((x) => <span key={x} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: T.sunken, color: T.muted }}>{x}</span>)}</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 14 }}>اختر نموذج فيلتك بالأعلى لتظهر القائمة.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {[["all", "كل البنود"], ["todo", "الباقي"], ["bad", "الملاحظات"]].map(([k, l]) => <button key={k} type="button" style={pill(only === k, T.brass)} onClick={() => setOnly(k)}>{l}</button>)}
            </div>
            {sections.map((s) => {
              const items = s.items.filter((it) => only === "all" || (only === "todo" && !state.a[it.id]?.s) || (only === "bad" && state.a[it.id]?.s === "bad"));
              if (!items.length) return null;
              const done = s.items.filter((it) => state.a[it.id]?.s).length;
              const isOpen = open === s.key || only !== "all";
              return (
                <div key={s.key} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
                  <button type="button" onClick={() => setOpen(isOpen && only === "all" ? null : s.key)} aria-expanded={isOpen} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "none", background: "transparent", color: T.paper, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
                    <b style={{ fontSize: 14.5, flex: 1 }}>{s.title}</b>
                    <span style={{ fontSize: 12, color: done === s.items.length ? "#2E7D5B" : T.muted }}>{done}/{s.items.length}</span>
                    <ChevronDown size={17} color={T.muted} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                  </button>
                  {isOpen && items.map((it) => {
                    const a = state.a[it.id] || {}; const sev = SEV[it.sev];
                    return (
                      <div key={it.id} style={{ padding: "13px 16px", borderTop: `1px solid ${T.line}` }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <b style={{ fontSize: 13.5, lineHeight: 1.7, flex: 1 }}>{it.t}</b>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: sev.color + "22", color: sev.color, whiteSpace: "nowrap" }}>{sev.label}</span>
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.9, color: T.muted, marginTop: 6 }}><b style={{ color: T.paper }}>كيف تفحص:</b> {it.how}</div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.9, marginTop: 2 }}><b>المقبول:</b> {it.ok}</div>
                        <div style={{ fontSize: 11, color: T.faint || T.muted, marginTop: 2 }}>{it.ref}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                          <button type="button" style={pill(a.s === "ok", "#2E7D5B")} aria-pressed={a.s === "ok"} onClick={() => mark(it.id, "ok")}><Check size={14} />سليم</button>
                          <button type="button" style={pill(a.s === "bad", "#B5382C")} aria-pressed={a.s === "bad"} onClick={() => mark(it.id, "bad")}><TriangleAlert size={14} />ملاحظة</button>
                          <button type="button" style={pill(a.s === "na", T.muted)} aria-pressed={a.s === "na"} onClick={() => mark(it.id, "na")}><Minus size={14} />لا ينطبق</button>
                        </div>
                        {a.s === "bad" && (
                          <textarea value={a.n || ""} onChange={(e) => setAns(it.id, { n: e.target.value.slice(0, 600) })} rows={2} placeholder="اكتب الملاحظة: وش العيب، وفي أي غرفة أو جدار"
                            style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "9px 11px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.sunken, color: T.paper, fontSize: 13, lineHeight: 1.8, resize: "vertical", fontFamily: "inherit" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {only !== "all" && !sections.some((s) => s.items.some((it) => (only === "todo" ? !state.a[it.id]?.s : state.a[it.id]?.s === "bad"))) && (
              <div style={{ textAlign: "center", color: T.muted, fontSize: 13.5, padding: 24 }}>{only === "todo" ? "خلصت كل البنود." : "ما سجلت أي ملاحظة."}</div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              <button type="button" style={{ ...btn, background: T.brass, color: T.onAccent || "#fff", borderColor: "transparent", fontWeight: 600 }} onClick={() => printReport("notes", sections, state)}><Printer size={16} />طباعة تقرير الملاحظات ({stat.bad})</button>
              <button type="button" style={btn} onClick={() => printReport("blank", sections, state)}><Printer size={16} />طباعة القائمة فارغة</button>
              <button type="button" style={{ ...btn, color: "#B5382C" }} onClick={reset}><RotateCcw size={15} />مسح الإجابات</button>
            </div>
            <p style={{ fontSize: 11.5, lineHeight: 1.9, color: T.faint || T.muted, marginTop: 14 }}>
              القائمة استرشادية أعدّها فريق تمثيل الملاك اعتمادًا على قائمة تحقق كود البناء السعودي للمباني السكنية (SBC 1101-1102) وعلى ما اعتُمد في استفسارات المشروع، ولا تغني عن فحص مهندس مختص. إجاباتك محفوظة على جهازك فقط.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* زر عائم يفتح الصفحة — level: كم زر عائم تحته (شارة الحساب، زر التذاكر) */
export function HandoverLauncher({ villa = null, level = 0 }) {
  const T = useDark() ? THEMES.dark : THEMES.light;
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => { const h = () => setNarrow(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return (
    <>
      <button type="button" className="no-print" onClick={() => setOpen(true)}
        style={{ position: "fixed", insetInlineStart: 12, bottom: `calc(${(narrow ? 92 : 14) + level * 50}px + env(safe-area-inset-bottom, 0px))`, zIndex: 60, display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.paper, boxShadow: T.shadowUp, fontFamily: "system-ui, sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        <ClipboardCheck size={16} color={T.brass} />فحص الاستلام
      </button>
      {open && <HandoverPage villa={villa} onClose={() => setOpen(false)} />}
    </>
  );
}
