/* ═══════════════════════════════════════════════════════════
   admin-i18n-tab.jsx (6.8.0) — لوحة «الترجمة»
   المحرّك داخلي بالكامل: موديل يشتغل على جهاز المشرف داخل المتصفح — بدون أي خدمة خارجية ولا مفتاح.
   • حالة المحرّك بهالجهاز (متحمّل؟ يحمّل؟) + زر «ترجم الآن» + تقدّم الترجمة.
   • «بانتظار اعتمادك»: كل مسودة جديدة، أو ترجمة قديمة لنص عربي تغيّر، أو نص ينتظر الترجمة.
     الزائر الإنجليزي ما يشوف أي مسودة — يشوف النص العربي مع تنبيه «قيد المراجعة» لين تعتمدها.
   • «كل الترجمات»: بحث وتعديل يدوي لأي نص (الحفظ هنا = اعتماد، والمحرّك ما يكتب على المعتمد).
   • «الأسماء والقيم»: ذاكرة الترجمة (أصحاب الردود، المناصب، قيم الفلاتر، الإشعارات، ملاحظات الأشهر).
   • «المعجم»: المصطلحات المثبّتة اللي يلتزم فيها المحرّك.
   الصلاحيات: اعتماد نصوص الاستفسارات = edit_inquiry · الأسماء والقيم = manage_theme أو edit_inquiry
   ═══════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCheck, Cpu, Download, Languages, RefreshCw, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { onSweepProgress, runAllTranslations } from "./label-i18n.js";
import { engineAvailable, engineCached, localSupported, onEngineStatus } from "./local-mt.js";
import { ENGINE_SIZE_MB } from "./local-mt-config.js";
import { staticEnFor } from "./site-data.jsx";
import { GLOSSARY } from "./translation-glossary.js";

const S = {
  wrap: { maxWidth: 860, margin: "0 auto", padding: "4px 0", color: "#1F2C35" },
  card: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 14, marginBottom: 10 },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "8px 14px", fontWeight: 600, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", font: "inherit", fontSize: 13, color: "#1F2C35" },
  pri: { background: "#1B7F8E", borderColor: "#1B7F8E", color: "#fff" },
  inp: { width: "100%", boxSizing: "border-box", border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 13.5, color: "#1F2C35", lineHeight: 1.7 },
  chip: (c) => ({ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: c + "1A", color: c, whiteSpace: "nowrap" }),
  hint: { fontSize: 12, color: "#5F7280", margin: "4px 0 0", lineHeight: 1.8 },
  ar: { fontSize: 13, lineHeight: 1.9, color: "#3A4A55", background: "#F7F9FB", borderRadius: 10, padding: "8px 11px", margin: "8px 0", whiteSpace: "pre-line" },
  tab: (on) => ({ padding: "7px 13px", borderRadius: 999, border: `1px solid ${on ? "#1B7F8E" : "#E1E8EC"}`, background: on ? "#1B7F8E14" : "#fff", color: "#1F2C35", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", font: "inherit" }),
  stat: { flex: "1 1 120px", background: "#F7F9FB", borderRadius: 12, padding: "10px 12px", minWidth: 0 },
  box: (c) => ({ background: c + "0F", border: `1px solid ${c}40`, borderRadius: 12, padding: "10px 12px", marginTop: 10 }),
  bar: { height: 6, borderRadius: 99, background: "#E1E8EC", overflow: "hidden", marginTop: 8 },
};
const APPROVED = new Set(["human", "reviewed", "claude"]);
const DRAFT = new Set(["local", "machine"]);
const ENG = {
  human: { t: "معتمدة", c: "#2E7D4F" },
  reviewed: { t: "معتمدة (مراجَعة سابقًا)", c: "#1B7F8E" },
  claude: { t: "معتمدة (مراجَعة سابقًا)", c: "#1B7F8E" },
  local: { t: "مسودة — بانتظار اعتمادك", c: "#8A6318" },
  machine: { t: "مسودة قديمة — بانتظار اعتمادك", c: "#8A6318" },
  stale: { t: "قديمة — النص العربي تغيّر", c: "#A8443C" },
  failed: { t: "تعذّرت", c: "#A8443C" },
  pending: { t: "بانتظار الترجمة", c: "#5F7280" },
};
const FIELD_AR = { note: "الملاحظة", reply: "الرد" };
const KIND_AR = { person: "اسم", title: "منصب", label: "قيمة", text: "نص", heading: "عنوان" };
const fmt = (v) => { try { return new Date(v).toLocaleString("ar-SA-u-nu-latn", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const mb = (b) => Math.round((b || 0) / 1e6);
const flagText = (f) => {
  const s = String(f || "");
  if (s === "machine") return null;
  if (s === "arabic_left") return "فيها حروف عربية";
  if (s.startsWith("numbers:")) return "تأكد من الأرقام: " + s.slice(8);
  if (s === "length") return "الطول غير متناسب";
  if (s === "term_check") return "تأكد من المصطلحات";
  if (s === "error") return "خطأ بالترجمة";
  if (s === "repetition") return "فيها تكرار";
  if (s === "empty") return "فاضية";
  if (s === "model_name") return "اسم النموذج";
  if (s.startsWith("uncertain:")) return "غير مؤكد: " + s.slice(10).trim();
  return s;
};
const needsReview = (st) => !APPROVED.has(st);

function Chip({ eng }) { const e = ENG[eng] || ENG.pending; return <span style={S.chip(e.c)}>{e.t}</span>; }

function FieldCard({ it, canEdit, onSave, onRetranslate }) {
  const [en, setEn] = useState(it.en || "");
  const [open, setOpen] = useState(needsReview(it.status));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEn(it.en || ""); }, [it.en]);
  const dirty = en.trim() !== (it.en || "").trim();
  const flags = (it.flags || []).map(flagText).filter(Boolean);
  const canApprove = !!en.trim() && (dirty || !APPROVED.has(it.status));
  return (
    <div style={S.card}>
      <div style={S.row}>
        <b style={{ fontSize: 13 }}>#{it.id} · {FIELD_AR[it.field]}</b>
        <Chip eng={it.status} />
        {flags.map((f, i) => <span key={i} style={S.chip("#8A6318")}>{f}</span>)}
        <button style={{ ...S.btn, padding: "4px 10px", fontSize: 12, marginInlineStart: "auto" }} onClick={() => setOpen((o) => !o)}>{open ? "إخفاء العربي" : "عرض العربي"}</button>
      </div>
      {open && <div style={S.ar} dir="rtl">{it.ar}</div>}
      <textarea dir="ltr" style={{ ...S.inp, minHeight: 74, marginTop: 8, resize: "vertical" }} value={en} readOnly={!canEdit}
        onChange={(e) => setEn(e.target.value)} placeholder={it.status === "pending" ? "بانتظار الترجمة — أو اكتبها بنفسك واعتمدها" : ""} />
      {it.status === "stale" && <p style={S.hint}>النص العربي تغيّر بعد هالترجمة — صحّحها واعتمدها، أو «أعد الترجمة».</p>}
      {canEdit && (
        <div style={{ ...S.row, marginTop: 8 }}>
          <button disabled={busy || !canApprove} style={{ ...S.btn, ...S.pri, opacity: busy || !canApprove ? 0.55 : 1 }}
            onClick={async () => { setBusy(true); await onSave(it, en.trim()); setBusy(false); }}>
            <Check size={14} /> {dirty ? "حفظ واعتماد" : "اعتماد كما هي"}
          </button>
          <button disabled={busy} style={S.btn} onClick={async () => { setBusy(true); await onRetranslate(it); setBusy(false); }}><RotateCcw size={14} /> أعد الترجمة</button>
        </div>
      )}
    </div>
  );
}

function TermRow({ t, canEdit, onSave, onDelete }) {
  const [en, setEn] = useState(t.en || "");
  useEffect(() => { setEn(t.en || ""); }, [t.en]);
  const stat = staticEnFor(t.ar);
  const flags = (t.flags || []).map(flagText).filter(Boolean);
  const dirty = en.trim() !== (t.en || "").trim();
  const canApprove = !!en.trim() && (dirty || !APPROVED.has(t.engine));
  const eng = t.engine === "failed" ? (t.en ? "local" : "failed") : t.engine;
  return (
    <div style={{ ...S.card, padding: 11 }}>
      <div style={S.row}>
        <span dir="rtl" style={{ fontSize: 13, fontWeight: 700, flex: "1 1 200px", minWidth: 0, whiteSpace: "pre-line" }}>{t.ar}</span>
        <span style={S.chip("#5F7280")}>{KIND_AR[t.kind] || t.kind}</span>
        <Chip eng={eng} />
      </div>
      {flags.length > 0 && <div style={{ ...S.row, marginTop: 6 }}>{flags.map((f, i) => <span key={i} style={S.chip("#8A6318")}>{f}</span>)}</div>}
      {stat && <p style={S.hint}>لها ترجمة ثابتة بالكود تُعرض بالموقع: <b dir="ltr">{stat}</b></p>}
      <div style={{ ...S.row, marginTop: 8, flexWrap: "nowrap" }}>
        {t.kind === "text"
          ? <textarea dir="ltr" style={{ ...S.inp, minHeight: 60, resize: "vertical" }} value={en} readOnly={!canEdit} onChange={(e) => setEn(e.target.value)} />
          : <input dir="ltr" style={S.inp} value={en} readOnly={!canEdit} onChange={(e) => setEn(e.target.value)} />}
        {canEdit && <button title={dirty ? "حفظ واعتماد" : "اعتماد كما هي"} disabled={!canApprove} style={{ ...S.btn, ...S.pri, opacity: canApprove ? 1 : 0.5 }} onClick={() => onSave(t, en.trim())}><Check size={14} /></button>}
        {canEdit && <button title="أعد الترجمة" style={S.btn} onClick={() => onDelete(t)}><RotateCcw size={14} /></button>}
      </div>
    </div>
  );
}

/* زر بخطوتين (بدل نافذة تأكيد المتصفح) */
function ConfirmButton({ label, confirmLabel, onConfirm, disabled }) {
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return undefined; const t = setTimeout(() => setArm(false), 4000); return () => clearTimeout(t); }, [arm]);
  return (
    <button disabled={disabled} style={{ ...S.btn, ...(arm ? S.pri : {}), opacity: disabled ? 0.55 : 1 }}
      onClick={() => { if (!arm) { setArm(true); return; } setArm(false); onConfirm(); }}>
      <CheckCheck size={14} /> {arm ? confirmLabel : label}
    </button>
  );
}

export function AI18nTab({ supabase, flashToast, log, canEditInq, canEditTerms }) {
  const [st, setSt] = useState(null);
  const [rows, setRows] = useState(null);
  const [terms, setTerms] = useState([]);
  const [pend, setPend] = useState({ fields: [], terms: [] });
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("review");
  const [q, setQ] = useState("");
  const [eng, setEng] = useState({ state: "idle", loaded: 0, total: 0, error: "" });
  const [cached, setCached] = useState(null);
  const [prog, setProg] = useState(null);
  const supported = localSupported();

  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([
      supabase.from("i18n_state").select("*").eq("id", 1).maybeSingle(),
      supabase.from("inquiries").select("id,note,note_en,reply,reply_en,i18n").order("id", { ascending: false }),
      supabase.from("i18n_memory").select("*").order("updated_at", { ascending: false }),
      supabase.rpc("i18n_pending", { p_upgrade: false, p_limit: 500 }),
      supabase.rpc("i18n_pending_terms", { p_upgrade: false, p_limit: 500 }),
    ]);
    if (a.error || b.error || c.error || d.error) { setNotReady(true); setRows([]); return; }
    setNotReady(false);
    setSt(a.data || null); setRows(b.data || []); setTerms(c.data || []);
    setPend({ fields: d.data || [], terms: e.data || [] });
  }, [supabase]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => onEngineStatus((s) => { setEng(s); if (s.state === "ready") setCached(true); }), []);
  useEffect(() => { engineCached().then(setCached); }, []);
  useEffect(() => onSweepProgress((p) => setProg(p.phase === "end" ? null : p)), []);

  /* كل حقل ملاحظة/رد كبند واحد بحالته */
  const items = useMemo(() => {
    if (!rows) return [];
    const pending = new Map((pend.fields || []).map((p) => [`${p.id}.${p.field}`, p.reason]));
    const out = [];
    rows.forEach((r) => ["note", "reply"].forEach((field) => {
      const ar = r[field]; if (!ar || !String(ar).trim()) return;
      const en = r[field + "_en"] || "";
      const m = (r.i18n && r.i18n[field]) || {};
      const reason = pending.get(`${r.id}.${field}`);
      const status = reason === "missing" ? "pending" : reason === "stale" ? "stale" : (m.e || (en ? "reviewed" : "pending"));
      out.push({ key: `${r.id}.${field}`, id: r.id, field, ar, en, status, flags: Array.isArray(m.f) ? m.f : [] });
    }));
    return out;
  }, [rows, pend]);
  const counts = useMemo(() => {
    const c = { approved: 0, drafts: 0, pending: 0, review: 0, cleanDrafts: [] };
    items.forEach((it) => {
      if (APPROVED.has(it.status)) c.approved++; else if (DRAFT.has(it.status)) c.drafts++; else c.pending++;
      if (needsReview(it.status)) c.review++;
      if (DRAFT.has(it.status) && it.en && !(it.flags || []).some(flagText)) c.cleanDrafts.push(it);
    });
    return c;
  }, [items]);
  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const base = view === "review" ? items.filter((it) => needsReview(it.status)) : items;
    return nq ? base.filter((it) => String(it.id) === nq || it.ar.toLowerCase().includes(nq) || (it.en || "").toLowerCase().includes(nq)) : base;
  }, [items, view, q]);
  const termList = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const missing = (pend.terms || []).filter((p) => !terms.some((t) => t.ar === p.ar)).map((p) => ({ ar: p.ar, en: "", kind: p.kind, engine: "pending", flags: [] }));
    const rank = (t) => (t.engine === "pending" ? 0 : t.engine === "failed" ? 1 : DRAFT.has(t.engine) ? 2 : staticEnFor(t.ar) ? 4 : 3);
    const all = [...missing, ...terms].sort((a, b) => rank(a) - rank(b));
    return nq ? all.filter((t) => t.ar.toLowerCase().includes(nq) || (t.en || "").toLowerCase().includes(nq)) : all;
  }, [terms, pend, q]);
  const termDrafts = useMemo(() => terms.filter((t) => DRAFT.has(t.engine) && t.en && !(t.flags || []).some(flagText)), [terms]);
  const waiting = (pend.fields || []).length + (pend.terms || []).length;

  const sweep = async () => {
    setBusy(true);
    const r = await runAllTranslations(supabase, "panel", { allowDownload: true });
    setBusy(false);
    if (!r?.ok) { flashToast("تعذّر تشغيل الترجمة: " + (r?.error || "")); load(); return; }
    if (r.busy) { flashToast("الترجمة شغّالة الحين من جهاز أو نافذة ثانية — حدّث بعد دقيقة"); return; }
    const n = (r.fields || 0) + (r.terms || 0);
    flashToast(n ? `انترجم ${n} نص كمسودة — راجعها واعتمدها${r.remaining ? ` (باقي ${r.remaining})` : ""}` : r.error ? "تعذّر: " + r.error : "ما فيه شي ينتظر الترجمة");
    if (n) log("تشغيل الترجمة الداخلية", `${r.fields || 0} نص + ${r.terms || 0} اسم/قيمة — مسودات بانتظار الاعتماد`);
    load();
  };
  const review = async (payload) => {
    const { data, error } = await supabase.rpc("i18n_review", { p_items: payload });
    if (error) { flashToast("تعذّر: " + (error.message || "تأكد من صلاحيتك")); return -1; }
    return data || 0;
  };
  const saveField = async (it, en) => {
    const dirty = en !== (it.en || "").trim();
    const n = await review([{ type: "inq", action: "approve", id: it.id, field: it.field, ar: it.ar, ...(dirty ? { en } : {}) }]);
    if (n < 0) return;
    if (!n) { flashToast("النص العربي تغيّر من بعد ما فتحت الصفحة — حدّثت لك القائمة، راجعه من جديد"); load(); return; }
    log("اعتماد ترجمة", `استفسار #${it.id} — ${FIELD_AR[it.field]}${dirty ? " (بعد التعديل)" : ""}`);
    flashToast("اعتُمدت — تظهر الحين للزوار بالإنجليزي"); load();
  };
  const approveAllDrafts = async () => {
    const list_ = counts.cleanDrafts;
    const n = await review(list_.map((it) => ({ type: "inq", action: "approve", id: it.id, field: it.field, ar: it.ar })));
    if (n < 0) return;
    log("اعتماد مسودات الترجمة دفعة وحدة", `${n} نص`);
    flashToast(`اعتُمد ${n} نص`); load();
  };
  const needEngineFirst = async () => {
    if (await engineAvailable()) return false;
    flashToast(`جهّز المحرك أول من زر «تجهيز المحرك» فوق (حوالي ${ENGINE_SIZE_MB}MB مرة وحدة)`);
    return true;
  };
  const retranslate = async (it) => {
    if (await needEngineFirst()) return;
    const n = await review([{ type: "inq", action: "reset", id: it.id, field: it.field }]);
    if (n < 0) return;
    log("إعادة ترجمة", `استفسار #${it.id} — ${FIELD_AR[it.field]}`);
    await runAllTranslations(supabase, "retranslate");
    flashToast("انترجمت من جديد كمسودة"); load();
  };
  const saveTerm = async (t, en) => {
    /* أي حفظ يدوي هنا = اعتماد (تريقر القاعدة يعلّمه «مراجَع» ولا يكتب عليه المحرّك) */
    const { error } = t.engine === "pending" && !terms.some((x) => x.ar === t.ar)
      ? await supabase.from("i18n_memory").insert({ ar: t.ar, en, kind: t.kind || "label" })
      : await supabase.from("i18n_memory").update({ en }).eq("ar", t.ar);
    if (error) { flashToast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return; }
    log("اعتماد ترجمة قيمة", `${t.ar} → ${en}`);
    flashToast("اعتُمدت"); load();
  };
  const approveAllTerms = async () => {
    let n = 0;
    for (const t of termDrafts) {
      const { error } = await supabase.from("i18n_memory").update({ en: t.en }).eq("ar", t.ar);
      if (!error) n++;
    }
    log("اعتماد مسودات الأسماء والقيم دفعة وحدة", `${n} قيمة`);
    flashToast(`اعتُمدت ${n} قيمة`); load();
  };
  const deleteTerm = async (t) => {
    if (!terms.some((x) => x.ar === t.ar)) return;
    if (await needEngineFirst()) return;
    const { error } = await supabase.from("i18n_memory").delete().eq("ar", t.ar);
    if (error) { flashToast("تعذّر: " + (error.message || "")); return; }
    await runAllTranslations(supabase, "retranslate");
    flashToast("انترجمت من جديد كمسودة"); load();
  };

  if (rows === null) return <div style={{ padding: 24, opacity: 0.6 }}>يحمّل…</div>;
  if (notReady) return (
    <div style={S.wrap}><div style={{ ...S.card, borderColor: "#E8C9A0", background: "#FFF9F0" }}>
      <b>نظام الترجمة يحتاج تجهيز قاعدة البيانات</b>
      <p style={S.hint}>شغّل ملف <span dir="ltr">migration-i18n-pro.sql</span> مرة وحدة من محرر SQL في Supabase، وبعدها ارجع لهالصفحة.</p>
    </div></div>
  );

  const lastRes = st?.last_result || null;
  const loading = eng.state === "loading";
  const ready = eng.state === "ready" || cached === true;
  const pct = eng.total > 0 ? Math.min(100, Math.round((eng.loaded / eng.total) * 100)) : 0;
  return (
    <div style={S.wrap}>
      <style>{"@keyframes i18nspin{to{transform:rotate(360deg)}}"}</style>
      <div style={S.card}>
        <div style={S.row}>
          <Languages size={18} color="#1B7F8E" />
          <b style={{ fontSize: 15 }}>الترجمة الإنجليزية</b>
          {supported && (
            <button disabled={busy || loading} onClick={sweep} style={{ ...S.btn, ...S.pri, marginInlineStart: "auto", opacity: busy || loading ? 0.6 : 1 }}>
              {ready ? <RefreshCw size={14} style={busy ? { animation: "i18nspin 1s linear infinite" } : undefined} /> : <Download size={14} />}
              {busy || loading ? (loading ? "يجهّز المحرك…" : "يترجم…") : ready ? `ترجم الآن${waiting ? ` (${waiting})` : ""}` : `تجهيز المحرك (حوالي ${ENGINE_SIZE_MB}MB)`}
            </button>
          )}
        </div>
        <p style={S.hint}>
          <span style={S.chip("#2E7D4F")}><ShieldCheck size={11} style={{ verticalAlign: -1 }} /> داخلي بالكامل</span>{" "}
          الترجمة تشتغل على جهازك داخل المتصفح — بدون أي خدمة خارجية ولا مفتاح. كل ترجمة جديدة تنحفظ <b>مسودة</b> وما تظهر للزوار إلا بعد ما تعتمدها هنا؛ لين ذاك، الزائر بالنسخة الإنجليزية يشوف النص العربي مع تنبيه «الترجمة قيد المراجعة».
        </p>

        {!supported ? (
          <div style={S.box("#A8443C")}><div style={{ ...S.row, fontWeight: 700, fontSize: 13 }}><AlertTriangle size={15} color="#A8443C" /> متصفحك ما يدعم المحرك الداخلي — افتح اللوحة من متصفح حديث (كروم، سفاري، إيدج).</div></div>
        ) : (
          <div style={S.box(eng.state === "error" ? "#A8443C" : ready ? "#2E7D4F" : "#8A6318")}>
            <div style={{ ...S.row, fontWeight: 700, fontSize: 13 }}>
              <Cpu size={15} color={eng.state === "error" ? "#A8443C" : ready ? "#2E7D4F" : "#8A6318"} />
              {eng.state === "error" ? "تعذّر تشغيل المحرك بهالجهاز"
                : loading ? (eng.total ? `يحمّل المحرك… ${mb(eng.loaded)} / ${mb(eng.total)}MB` : "يجهّز المحرك…")
                  : ready ? "المحرك جاهز على هالجهاز" : cached === null ? "يتحقق من المحرك…" : "المحرك مو متحمّل على هالجهاز"}
            </div>
            {loading && eng.total > 0 && <div style={S.bar}><div style={{ width: pct + "%", height: "100%", background: "#8A6318" }} /></div>}
            {eng.state === "error" && <p style={{ ...S.hint, color: "#A8443C" }} dir="ltr">{eng.error}</p>}
            {!ready && !loading && eng.state !== "error" && cached === false && (
              <p style={S.hint}>أول مرة بس: يتحمّل حوالي {ENGINE_SIZE_MB}MB من الموقع نفسه وينحفظ بالمتصفح (يُفضّل على Wi-Fi). بعدها يترجم تلقائيًا بعد أي حفظ أو استيراد وعند فتح اللوحة. كل جهاز تستخدمه للإدارة يحتاجه مرة وحدة.</p>
            )}
            {ready && <p style={S.hint}>يترجم تلقائيًا بعد أي حفظ أو استيراد وعند فتح اللوحة من هالجهاز.</p>}
          </div>
        )}
        {prog && prog.total > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>يترجم {Math.min(prog.done, prog.total)} من {prog.total}…</div>
            <div style={S.bar}><div style={{ width: Math.round((Math.min(prog.done, prog.total) / prog.total) * 100) + "%", height: "100%", background: "#1B7F8E" }} /></div>
          </div>
        )}

        <div style={{ ...S.row, marginTop: 12, alignItems: "stretch" }}>
          {[["معتمدة (تظهر للزوار)", counts.approved, "#2E7D4F"], ["مسودات بانتظار اعتمادك", counts.drafts, "#8A6318"], ["بانتظار الترجمة / قديمة", counts.pending, "#5F7280"]].map(([t, n, c]) => (
            <div key={t} style={S.stat}><div style={{ fontSize: 11.5, color: "#5F7280" }}>{t}</div><div style={{ fontSize: 20, fontWeight: 800, color: c }}>{n}</div></div>
          ))}
        </div>
        {st?.last_run_at && (
          <p style={S.hint}>آخر تشغيل: {fmt(st.last_run_at)}{lastRes ? ` — ${(lastRes.fields || 0) + (lastRes.terms || 0)} نص` : ""}.</p>
        )}
        {st?.last_error && <p style={{ ...S.hint, color: "#A8443C" }}>آخر ملاحظة من المحرك: <span dir="ltr">{st.last_error}</span></p>}
      </div>

      <div style={{ ...S.row, margin: "6px 0 12px" }}>
        {[["review", `بانتظار اعتمادك (${counts.review})`], ["all", `كل الترجمات (${items.length})`], ["terms", `الأسماء والقيم (${termList.length})`], ["glossary", `المعجم (${GLOSSARY.length})`]].map(([k, t]) => (
          <button key={k} style={S.tab(view === k)} onClick={() => setView(k)}>{t}</button>
        ))}
        {view !== "glossary" && (
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
            <Search size={14} style={{ position: "absolute", insetInlineStart: 10, top: 11, color: "#5F7280" }} />
            <input style={{ ...S.inp, paddingInlineStart: 30 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم أو نص…" />
          </div>
        )}
      </div>

      {view === "review" && canEditInq && counts.cleanDrafts.length > 1 && (
        <div style={{ ...S.row, marginBottom: 10 }}>
          <ConfirmButton label={`اعتماد كل المسودات بدون ملاحظات (${counts.cleanDrafts.length})`} confirmLabel={`متأكد؟ اعتماد ${counts.cleanDrafts.length} نص`} onConfirm={approveAllDrafts} />
          <span style={S.hint}>المسودات اللي عليها ملاحظة (أرقام، مصطلحات…) تبقى لمراجعتك وحدة وحدة.</span>
        </div>
      )}
      {(view === "review" || view === "all") && (
        list.length === 0
          ? <div style={{ ...S.card, textAlign: "center", color: "#5F7280" }}>{view === "review" ? "ما فيه شي ينتظر اعتمادك — كل الترجمات المعروضة معتمدة." : "ما فيه نتائج."}</div>
          : list.slice(0, 120).map((it) => <FieldCard key={it.key} it={it} canEdit={canEditInq} onSave={saveField} onRetranslate={retranslate} />)
      )}
      {view === "terms" && (
        <>
          <p style={{ ...S.hint, marginBottom: 10 }}>كل اسم أو منصب أو قيمة فلتر أو إشعار أو ملاحظة شهر جديدة تنترجم هنا تلقائيًا كمسودة، وتظهر بالموقع بعد اعتمادها. أي حفظ يدوي هنا يُعتمد مباشرة ولا يكتب عليه المحرك.</p>
          {canEditTerms && termDrafts.length > 1 && (
            <div style={{ ...S.row, marginBottom: 10 }}>
              <ConfirmButton label={`اعتماد كل مسودات القيم بدون ملاحظات (${termDrafts.length})`} confirmLabel={`متأكد؟ اعتماد ${termDrafts.length} قيمة`} onConfirm={approveAllTerms} />
            </div>
          )}
          {termList.length === 0 ? <div style={{ ...S.card, textAlign: "center", color: "#5F7280" }}>ما فيه قيم.</div>
            : termList.slice(0, 200).map((t) => <TermRow key={t.ar} t={t} canEdit={canEditTerms} onSave={saveTerm} onDelete={deleteTerm} />)}
        </>
      )}
      {view === "glossary" && (
        <div style={S.card}>
          <p style={{ ...S.hint, marginTop: 0 }}>المصطلحات المثبّتة اللي يلتزم فيها المحرك الداخلي: كل مصطلح يُحمى قبل الترجمة ويرجع بمقابله المعتمد. تعديلها يكون بملف <span dir="ltr">translation-glossary.js</span>.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 6, marginTop: 10 }}>
            {GLOSSARY.map(([ar, en]) => (
              <div key={ar} style={{ display: "flex", justifyContent: "space-between", gap: 8, background: "#F7F9FB", borderRadius: 8, padding: "6px 10px", fontSize: 12.5 }}>
                <span dir="rtl">{ar}</span><span dir="ltr" style={{ color: "#1B7F8E", fontWeight: 600 }}>{en}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
