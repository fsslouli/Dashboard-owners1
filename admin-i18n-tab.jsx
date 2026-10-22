/* ═══════════════════════════════════════════════════════════
   admin-i18n-tab.jsx (6.8.0) — لوحة «الترجمة»
   • حالة المحرّك: Claude مفعّل؟ آخر تشغيل وآخر خطأ، وزر «ترجم الآن».
   • «تحتاج مراجعة»: كل ترجمة آلية أو موسومة بملاحظة جودة (رقم ناقص، مصطلح غير مؤكد…) أو بانتظار الترجمة.
   • «كل الترجمات»: بحث وتعديل يدوي لأي نص (التعديل اليدوي يُعتمد «مراجَع» وما يكتب عليه المحرّك).
   • «الأسماء والقيم»: ذاكرة الترجمة (أسماء أصحاب الردود، المناصب، قيم الفلاتر، الإشعارات، ملاحظات الأشهر).
   • «المعجم»: المصطلحات المثبّتة اللي يلتزم فيها المحرّك.
   الصلاحيات: تعديل نصوص الاستفسارات = edit_inquiry · تعديل الأسماء والقيم = manage_theme أو edit_inquiry
   ═══════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Languages, RefreshCw, RotateCcw, Search } from "lucide-react";
import { runTranslationSweep } from "./label-i18n.js";
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
};
const ENG = {
  claude: { t: "Claude", c: "#1B7F8E" }, human: { t: "مراجَعة يدويًا", c: "#2E7D4F" },
  machine: { t: "آلية — تحتاج مراجعة", c: "#A8443C" }, failed: { t: "تعذّرت", c: "#A8443C" }, pending: { t: "بانتظار الترجمة", c: "#8A6318" },
};
const FIELD_AR = { note: "الملاحظة", reply: "الرد" };
const KIND_AR = { person: "اسم", title: "منصب", label: "قيمة", text: "نص", heading: "عنوان" };
const engAr = (e) => String(e || "").split("+").map((x) => (x === "claude" ? "Claude" : x === "machine" ? "آلي" : x)).join(" + ");
const fmt = (v) => { try { return new Date(v).toLocaleString("ar-SA-u-nu-latn", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const flagText = (f) => {
  const s = String(f || "");
  if (s === "machine") return null;
  if (s === "arabic_left") return "فيها حروف عربية";
  if (s.startsWith("numbers:")) return "أرقام ناقصة: " + s.slice(8);
  if (s === "length") return "الطول غير متناسب";
  if (s === "model_name") return "اسم النموذج";
  if (s.startsWith("uncertain:")) return "غير مؤكد: " + s.slice(10).trim();
  return s;
};

function Chip({ eng }) { const e = ENG[eng] || ENG.pending; return <span style={S.chip(e.c)}>{e.t}</span>; }

function FieldCard({ it, canEdit, onSave, onRetranslate }) {
  const [en, setEn] = useState(it.en || "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEn(it.en || ""); }, [it.en]);
  const dirty = en.trim() !== (it.en || "").trim();
  const flags = (it.flags || []).map(flagText).filter(Boolean);
  return (
    <div style={S.card}>
      <div style={S.row}>
        <b style={{ fontSize: 13 }}>#{it.id} · {FIELD_AR[it.field]}</b>
        <Chip eng={it.status} />
        {flags.map((f, i) => <span key={i} style={S.chip(f.startsWith("غير مؤكد") ? "#8A6318" : "#A8443C")}>{f}</span>)}
        <button style={{ ...S.btn, padding: "4px 10px", fontSize: 12, marginInlineStart: "auto" }} onClick={() => setOpen((o) => !o)}>{open ? "إخفاء العربي" : "عرض العربي"}</button>
      </div>
      {open && <div style={S.ar} dir="rtl">{it.ar}</div>}
      <textarea dir="ltr" style={{ ...S.inp, minHeight: 74, marginTop: 8, resize: "vertical" }} value={en} readOnly={!canEdit}
        onChange={(e) => setEn(e.target.value)} placeholder={it.status === "pending" ? "بانتظار الترجمة التلقائية…" : ""} />
      {canEdit && (
        <div style={{ ...S.row, marginTop: 8 }}>
          <button disabled={busy || !en.trim() || (!dirty && it.status === "human")} style={{ ...S.btn, ...S.pri, opacity: busy || !en.trim() ? 0.6 : 1 }}
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
  const canApprove = !!en.trim() && (dirty || (t.engine !== "human" && t.engine !== "claude") || flags.length > 0);
  return (
    <div style={{ ...S.card, padding: 11 }}>
      <div style={S.row}>
        <span dir="rtl" style={{ fontSize: 13, fontWeight: 700, flex: "1 1 200px", minWidth: 0, whiteSpace: "pre-line" }}>{t.ar}</span>
        <span style={S.chip("#5F7280")}>{KIND_AR[t.kind] || t.kind}</span>
        <Chip eng={t.engine === "failed" ? (t.en ? "machine" : "failed") : t.engine} />
      </div>
      {flags.length > 0 && <div style={{ ...S.row, marginTop: 6 }}>{flags.map((f, i) => <span key={i} style={S.chip("#8A6318")}>{f}</span>)}</div>}
      {stat && <p style={S.hint}>لها ترجمة ثابتة بالكود تُعرض بالموقع: <b dir="ltr">{stat}</b></p>}
      <div style={{ ...S.row, marginTop: 8, flexWrap: "nowrap" }}>
        {t.kind === "text"
          ? <textarea dir="ltr" style={{ ...S.inp, minHeight: 60, resize: "vertical" }} value={en} readOnly={!canEdit} onChange={(e) => setEn(e.target.value)} />
          : <input dir="ltr" style={S.inp} value={en} readOnly={!canEdit} onChange={(e) => setEn(e.target.value)} />}
        {canEdit && <button title={dirty ? "حفظ واعتماد" : "اعتماد كما هي"} disabled={!canApprove} style={{ ...S.btn, ...S.pri, opacity: canApprove ? 1 : 0.5 }} onClick={() => onSave(t, en.trim())}><Check size={14} /></button>}
        {canEdit && <button title="حذف لإعادة الترجمة" style={S.btn} onClick={() => onDelete(t)}><RotateCcw size={14} /></button>}
      </div>
    </div>
  );
}

export function AI18nTab({ supabase, flashToast, log, canEditInq, canEditTerms }) {
  const [st, setSt] = useState(null);
  const [fn, setFn] = useState(null);
  const [rows, setRows] = useState(null);
  const [terms, setTerms] = useState([]);
  const [pend, setPend] = useState({ fields: [], terms: [] });
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("review");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([
      supabase.from("i18n_state").select("*").eq("id", 1).maybeSingle(),
      supabase.from("inquiries").select("id,note,note_en,reply,reply_en,i18n").order("id", { ascending: false }),
      supabase.from("i18n_memory").select("*").order("updated_at", { ascending: false }),
      supabase.rpc("i18n_pending", { p_upgrade: false, p_limit: 500 }),
      supabase.rpc("i18n_pending_terms", { p_upgrade: false, p_limit: 500 }),
    ]);
    if (a.error || b.error || c.error) { setNotReady(true); setRows([]); return; }
    setNotReady(false);
    setSt(a.data || null); setRows(b.data || []); setTerms(c.data || []);
    setPend({ fields: d.data || [], terms: e.data || [] });
  }, [supabase]);
  useEffect(() => {
    load();
    supabase.functions.invoke("i18n-translate", { body: { mode: "status" } }).then(({ data }) => setFn(data || null)).catch(() => setFn(null));
  }, [load, supabase]);

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
      const status = reason === "missing" || reason === "stale" ? "pending" : (m.e || (en ? "claude" : "pending"));
      out.push({ key: `${r.id}.${field}`, id: r.id, field, ar, en, status, reason, flags: Array.isArray(m.f) ? m.f : [], at: m.t, meta: m, rowI18n: r.i18n || {} });
    }));
    return out;
  }, [rows, pend]);
  const needsReview = (it) => it.status === "pending" || it.status === "machine" || it.status === "failed" || (it.flags || []).some((f) => f !== "machine");
  const counts = useMemo(() => {
    const c = { claude: 0, human: 0, machine: 0, pending: 0, review: 0 };
    items.forEach((it) => { c[it.status] = (c[it.status] || 0) + 1; if (needsReview(it)) c.review++; });
    return c;
  }, [items]);
  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const base = view === "review" ? items.filter(needsReview) : items;
    return nq ? base.filter((it) => String(it.id) === nq || it.ar.toLowerCase().includes(nq) || (it.en || "").toLowerCase().includes(nq)) : base;
  }, [items, view, q]);
  const termList = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const missing = (pend.terms || []).filter((p) => !terms.some((t) => t.ar === p.ar)).map((p) => ({ ar: p.ar, en: "", kind: p.kind, engine: "pending", flags: [] }));
    const rank = (t) => (t.engine === "pending" ? 0 : t.engine === "machine" || t.engine === "failed" ? 1 : (t.flags || []).some((f) => f !== "machine") ? 2 : staticEnFor(t.ar) ? 4 : 3);
    const all = [...missing, ...terms].sort((a, b) => rank(a) - rank(b));
    return nq ? all.filter((t) => t.ar.toLowerCase().includes(nq) || (t.en || "").toLowerCase().includes(nq)) : all;
  }, [terms, pend, q]);

  const sweep = async () => {
    setBusy(true);
    const r = await runTranslationSweep(supabase, "panel");
    setBusy(false);
    if (!r?.ok) { flashToast("تعذّر تشغيل الترجمة: " + (r?.error || "")); return; }
    if (r.busy) { flashToast("الترجمة شغّالة الحين من مكان ثاني — حدّث بعد دقيقة"); return; }
    const n = (r.fields || 0) + (r.terms || 0);
    flashToast(n ? `تُرجم ${n} نص${r.remaining ? ` — المتبقي ${r.remaining} يكمل تلقائيًا` : ""}` : "ما فيه شي ينتظر الترجمة");
    if (n) log("تشغيل الترجمة يدويًا", `${r.fields || 0} نص + ${r.terms || 0} اسم/قيمة — ${engAr(r.engine)}`);
    load();
  };
  const saveField = async (it, en) => {
    /* نص معدّل ← يُحفظ والإنجليزي الجديد يُعتمد «مراجَع» تلقائيًا (تريقر القاعدة).
       اعتماد كما هي ← نعلّم المصدر «مراجَع» ونمسح ملاحظات الجودة مع إبقاء بصمة العربي (لو تغيّر العربي لاحقًا تُعاد الترجمة) */
    const same = en.trim() === (it.en || "").trim() && it.meta && it.meta.h;
    const patch = same
      ? { i18n: { ...(it.rowI18n || {}), [it.field]: { ...it.meta, e: "human", f: [], t: new Date().toISOString() } } }
      : { [it.field + "_en"]: en };
    const { error } = await supabase.from("inquiries").update(patch).eq("id", it.id);
    if (error) { flashToast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return; }
    log("اعتماد ترجمة", `استفسار #${it.id} — ${FIELD_AR[it.field]}`);
    flashToast("انحفظت الترجمة واعتُمدت"); load();
  };
  const retranslate = async (it) => {
    const { error } = await supabase.from("inquiries").update({ [it.field + "_en"]: null }).eq("id", it.id);
    if (error) { flashToast("تعذّر: " + (error.message || "")); return; }
    log("إعادة ترجمة", `استفسار #${it.id} — ${FIELD_AR[it.field]}`);
    await runTranslationSweep(supabase, "retranslate");
    flashToast("أُعيدت الترجمة"); load();
  };
  const saveTerm = async (t, en) => {
    const { error } = t.engine === "pending" && !terms.some((x) => x.ar === t.ar)
      ? await supabase.from("i18n_memory").insert({ ar: t.ar, en, kind: t.kind || "label" })
      : await supabase.from("i18n_memory").update({ en }).eq("ar", t.ar);
    if (error) { flashToast("تعذّر الحفظ: " + (error.message || "تأكد من صلاحيتك")); return; }
    log("اعتماد ترجمة قيمة", `${t.ar} → ${en}`);
    flashToast("انحفظت"); load();
  };
  const deleteTerm = async (t) => {
    if (!terms.some((x) => x.ar === t.ar)) return;
    const { error } = await supabase.from("i18n_memory").delete().eq("ar", t.ar);
    if (error) { flashToast("تعذّر: " + (error.message || "")); return; }
    await runTranslationSweep(supabase, "retranslate");
    flashToast("أُعيدت ترجمتها"); load();
  };

  if (rows === null) return <div style={{ padding: 24, opacity: 0.6 }}>يحمّل…</div>;
  if (notReady) return (
    <div style={S.wrap}><div style={{ ...S.card, borderColor: "#E8C9A0", background: "#FFF9F0" }}>
      <b>نظام الترجمة يحتاج تجهيز قاعدة البيانات</b>
      <p style={S.hint}>شغّل ملف <span dir="ltr">migration-i18n-pro.sql</span> مرة وحدة من محرر SQL في Supabase، وبعدها ارجع لهالصفحة.</p>
    </div></div>
  );

  const hasKey = fn ? !!fn.has_key : !!st?.has_key;
  const lastRes = st?.last_result || null;
  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.row}>
          <Languages size={18} color="#1B7F8E" />
          <b style={{ fontSize: 15 }}>الترجمة الإنجليزية</b>
          <button disabled={busy} onClick={sweep} style={{ ...S.btn, ...S.pri, marginInlineStart: "auto", opacity: busy ? 0.6 : 1 }}>
            <RefreshCw size={14} className={busy ? "spin" : ""} /> {busy ? "يترجم…" : "ترجم الآن"}
          </button>
        </div>
        {hasKey ? (
          <p style={S.hint}><span style={S.chip("#1B7F8E")}>Claude مفعّل</span> كل نص جديد أو معدّل يترجمه Claude تلقائيًا بسياق المشروع ومعجمه، مع فحص آلي للأرقام والمصطلحات{fn?.model ? <> — النموذج: <span dir="ltr">{fn.model}</span></> : null}.</p>
        ) : (
          <div style={{ background: "#FFF9F0", border: "1px solid #E8C9A0", borderRadius: 12, padding: "10px 12px", marginTop: 10 }}>
            <div style={{ ...S.row, fontWeight: 700, fontSize: 13 }}><AlertTriangle size={15} color="#8A6318" /> المحرّك الحالي: مترجم آلي مجاني (يحتاج مراجعة)</div>
            <p style={S.hint}>للترجمة الاحترافية: أنشئ مفتاح API من <span dir="ltr">platform.claude.com</span> (حساب الـ API منفصل عن اشتراك Claude)، ثم بلوحة Supabase: Edge Functions ← Secrets أضف <b dir="ltr">ANTHROPIC_API_KEY</b>. بعدها كل الترجمات الآلية تُعاد بـ Claude تلقائيًا خلال دقائق.</p>
          </div>
        )}
        <div style={{ ...S.row, marginTop: 12, alignItems: "stretch" }}>
          {[["Claude", counts.claude, "#1B7F8E"], ["مراجَعة يدويًا", counts.human, "#2E7D4F"], ["آلية", counts.machine, "#A8443C"], ["بانتظار الترجمة", counts.pending, "#8A6318"]].map(([t, n, c]) => (
            <div key={t} style={S.stat}><div style={{ fontSize: 11.5, color: "#5F7280" }}>{t}</div><div style={{ fontSize: 20, fontWeight: 800, color: c }}>{n}</div></div>
          ))}
        </div>
        {st?.last_run_at && (
          <p style={S.hint}>آخر تشغيل: {fmt(st.last_run_at)}{lastRes ? ` — ${(lastRes.fields || 0) + (lastRes.terms || 0)} نص${lastRes.engine ? ` (${engAr(lastRes.engine)})` : ""}` : ""}. يشتغل تلقائيًا كل ٥ دقائق وبعد أي حفظ.</p>
        )}
        {st?.last_error && <p style={{ ...S.hint, color: "#A8443C" }}>آخر ملاحظة من المحرّك: <span dir="ltr">{st.last_error}</span></p>}
      </div>

      <div style={{ ...S.row, margin: "6px 0 12px" }}>
        {[["review", `تحتاج مراجعة (${counts.review})`], ["all", `كل الترجمات (${items.length})`], ["terms", `الأسماء والقيم (${termList.length})`], ["glossary", `المعجم (${GLOSSARY.length})`]].map(([k, t]) => (
          <button key={k} style={S.tab(view === k)} onClick={() => setView(k)}>{t}</button>
        ))}
        {view !== "glossary" && (
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
            <Search size={14} style={{ position: "absolute", insetInlineStart: 10, top: 11, color: "#5F7280" }} />
            <input style={{ ...S.inp, paddingInlineStart: 30 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم أو نص…" />
          </div>
        )}
      </div>

      {(view === "review" || view === "all") && (
        list.length === 0
          ? <div style={{ ...S.card, textAlign: "center", color: "#5F7280" }}>{view === "review" ? "كل الترجمات سليمة — ما فيه شي يحتاج مراجعة." : "ما فيه نتائج."}</div>
          : list.slice(0, 120).map((it) => <FieldCard key={it.key} it={it} canEdit={canEditInq} onSave={saveField} onRetranslate={retranslate} />)
      )}
      {view === "terms" && (
        <>
          <p style={{ ...S.hint, marginBottom: 10 }}>كل اسم أو منصب أو قيمة فلتر أو إشعار أو ملاحظة شهر جديدة تُترجم هنا تلقائيًا وتُستخدم بكل الموقع. التعديل اليدوي يُعتمد ولا يكتب عليه المحرّك.</p>
          {termList.length === 0 ? <div style={{ ...S.card, textAlign: "center", color: "#5F7280" }}>ما فيه قيم.</div>
            : termList.slice(0, 200).map((t) => <TermRow key={t.ar} t={t} canEdit={canEditTerms} onSave={saveTerm} onDelete={deleteTerm} />)}
        </>
      )}
      {view === "glossary" && (
        <div style={S.card}>
          <p style={{ ...S.hint, marginTop: 0 }}>المصطلحات المثبّتة اللي يلتزم فيها المحرّك (Claude والمترجم الآلي). تعديلها يكون بملف <span dir="ltr">translation-glossary.js</span>.</p>
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
