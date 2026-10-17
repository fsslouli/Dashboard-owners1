/* ═══════════════════════════════════════════════════════════
   schedule-kit.jsx — النشر المجدول (٦.١.٠)

   الفكرة: تسوي التعديل الحين وتحدد متى يظهر للملاك — بعد ساعة، ساعتين، أو بوقت محدد.
   التعديل ينحفظ كـ «تعديل معلّق» بجدول scheduled_changes ويتطبّق تلقائيًا بالوقت المحدد
   (pg_cron كل دقيقة). نفس الزر يشتغل على الاستفسارات والمعرض (صور/مقاطع) ومقاطع النماذج
   والمرفقات والروابط الخارجية، وتبويب «المجدولة» يدير الكل دفعة وحدة.

   يحتاج migration-scheduled-publishing.sql. لو الجدول ما انعمل، كل الأزرار تختفي
   والموقع يشتغل كالعادة (لا شي ينكسر).
   كل الأوقات بتوقيت الرياض (UTC+3).
   ═══════════════════════════════════════════════════════════ */
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlarmClock, CalendarClock, Check, Send, Trash2, X } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";

const RIYADH_MS = 3 * 3600 * 1000;
const TABLE_AR = {
  inquiries: "استفسار", media_items: "عنصر معرض", media_topics: "موضوع معرض",
  model_videos: "مقطع نموذج", inquiry_attachments: "مرفق", external_links: "رابط خارجي",
};

/* ── الأوقات ───────────────────────────────────────────── */
export function fmtRiyadh(iso) {
  try {
    return new Date(iso).toLocaleString("ar-SA-u-nu-latn-ca-gregory", {
      timeZone: "Asia/Riyadh", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
  } catch { return String(iso); }
}
export function fmtIn(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "الحين";
  const m = Math.round(ms / 60000);
  if (m < 60) return `بعد ${m} دقيقة`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return r ? `بعد ${h} ساعة و${r} دقيقة` : `بعد ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `بعد ${d} يوم`;
}
const pad = (n) => String(n).padStart(2, "0");
/* قيمة datetime-local (بتوقيت الرياض) من لحظة معيّنة */
const toLocalInput = (ms) => {
  const d = new Date(ms + RIYADH_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(`${v}:00+03:00`).toISOString() : null);
const tomorrowAt = (h) => {
  const d = new Date(Date.now() + RIYADH_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, h - 3, 0);
};

/* ── المخزن ────────────────────────────────────────────── */
let state = { rows: [], ready: false, available: true, targets: {} };
const subs = new Set();
const emit = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
let timer = null, loading = null;

export async function reloadScheduled() {
  if (loading) return loading;
  loading = (async () => {
    const { data, error } = await supabase.from("scheduled_changes").select("*").order("publish_at");
    /* أسماء الأنواع من سجل scheduled_targets — نوع جديد بالقاعدة يظهر هنا تلقائيًا */
    const tg = await supabase.from("scheduled_targets").select("target_table,label_ar");
    if (!tg.error && tg.data) emit({ targets: Object.fromEntries(tg.data.map((x) => [x.target_table, x.label_ar])) });
    if (error) {
      /* الجدول غير موجود أو لا صلاحية → نخفي الميزة */
      emit({ rows: [], ready: true, available: false });
    } else emit({ rows: data || [], ready: true, available: true });
  })().finally(() => { loading = null; });
  return loading;
}
const subscribe = (f) => {
  subs.add(f);
  if (subs.size === 1) { reloadScheduled(); timer = setInterval(() => { if (state.available) reloadScheduled(); }, 30000); }
  return () => { subs.delete(f); if (!subs.size && timer) { clearInterval(timer); timer = null; } };
};
export const useScheduled = () => useSyncExternalStore(subscribe, () => state);

export const pendingOf = (rows, table, id) => rows.find((r) => r.target_table === table && r.op === "update" && String(r.target_id) === String(id));

/* ── استدعاءات الخادم ──────────────────────────────────── */
export async function scheduleChange({ table, id = null, op = "update", patch, at, label }) {
  const { error } = await supabase.rpc("schedule_change", {
    p_table: table, p_id: id, p_op: op, p_patch: patch, p_at: at, p_label: label || null,
  });
  await reloadScheduled();
  return error ? error.message || "تعذّرت الجدولة" : null;
}
export async function reschedule(ids, at) {
  const { error } = await supabase.rpc("reschedule_changes", { p_ids: ids, p_at: at });
  await reloadScheduled();
  return error ? error.message : null;
}
export async function cancelScheduled(ids) {
  const { error } = await supabase.rpc("cancel_changes", { p_ids: ids });
  await reloadScheduled();
  return error ? error.message : null;
}
export async function publishNow(ids) {
  const { error } = await supabase.rpc("publish_changes_now", { p_ids: ids });
  await reloadScheduled();
  return error ? error.message : null;
}

/* ── نافذة اختيار الوقت ───────────────────────────────── */
export function WhenModal({ T, title, sub, confirmText = "جدولة", onPick, onClose }) {
  const [custom, setCustom] = useState("");
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const opts = [
    { k: "1h", t: "بعد ساعة", ms: () => Date.now() + 3600e3 },
    { k: "2h", t: "بعد ساعتين", ms: () => Date.now() + 7200e3 },
    { k: "4h", t: "بعد ٤ ساعات", ms: () => Date.now() + 4 * 3600e3 },
    { k: "t9", t: "بكرة ٩ صباحًا", ms: () => tomorrowAt(9) },
    { k: "t18", t: "بكرة ٦ مساءً", ms: () => tomorrowAt(18) },
  ];
  const at = sel === "custom" ? fromLocalInput(custom) : sel ? new Date(opts.find((o) => o.k === sel).ms()).toISOString() : null;
  const valid = at && new Date(at).getTime() > Date.now() + 30000;
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const go = async () => {
    if (!valid || busy) return;
    setBusy(true); setErr("");
    const e = await onPick(at);
    setBusy(false);
    if (e) setErr(e); else onClose();
  };
  const chip = (on) => ({ border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass : T.surface, color: on ? T.onAccent || "#fff" : T.paper, borderRadius: 999, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
  return createPortal(
    <div dir="rtl" data-edit-ui style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} />
      <div role="dialog" aria-modal="true" style={{ position: "relative", width: "min(440px,100%)", background: T.surface, color: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <AlarmClock size={17} color={T.brass} />
          <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{title || "متى يظهر للملاك؟"}</div>
          <button onClick={onClose} aria-label="إغلاق" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.muted, cursor: "pointer" }}><X size={15} /></button>
        </div>
        {sub && <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.8, marginBottom: 10 }}>{sub}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0" }}>
          {opts.map((o) => <button key={o.k} type="button" style={chip(sel === o.k)} onClick={() => setSel(o.k)}>{o.t}</button>)}
          <button type="button" style={chip(sel === "custom")} onClick={() => { setSel("custom"); if (!custom) setCustom(toLocalInput(Date.now() + 3600e3)); }}>وقت محدد…</button>
        </div>
        {sel === "custom" && (
          <input type="datetime-local" value={custom} min={toLocalInput(Date.now() + 60000)} onChange={(e) => setCustom(e.target.value)} dir="ltr"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", border: `1px solid ${T.line}`, borderRadius: 10, background: T.sunken, color: T.paper, fontSize: 14, fontFamily: "inherit" }} />
        )}
        {at && <div style={{ fontSize: 12.5, color: valid ? T.muted : "#C0392B", marginTop: 8 }}>{valid ? <>يظهر <b>{fmtRiyadh(at)}</b> (توقيت الرياض) — {fmtIn(at)}</> : "اختر وقتًا مستقبليًا"}</div>}
        {err && <div role="alert" style={{ color: "#C0392B", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button type="button" onClick={go} disabled={!valid || busy} style={{ display: "flex", alignItems: "center", gap: 7, background: T.brass, color: T.onAccent || "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: valid && !busy ? 1 : 0.5, fontFamily: "inherit" }}><Check size={15} /> {busy ? "…" : confirmText}</button>
          <button type="button" onClick={onClose} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── زر الجدولة (ساعة) — يجدول patch على صف موجود ───────── */
export function SchedBtn({ T, table, id, patch, getPatch, label, style, text, onDone, flash, op = "update", disabled, title }) {
  const { rows, available } = useScheduled();
  const [open, setOpen] = useState(false);
  if (!available) return null;
  const pend = op === "update" ? pendingOf(rows, table, id) : null;
  const base = style || { width: 30, height: 30, borderRadius: 8, border: `1px solid ${pend ? T.brass : T.line}`, background: pend ? `${T.brass}22` : "none", color: pend ? T.brass : T.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit" };
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} style={base}
        title={title || (pend ? `مجدول: ${fmtRiyadh(pend.publish_at)}` : "جدولة النشر")} aria-label="جدولة النشر">
        <AlarmClock size={text ? 14 : 15} />{text && <span style={{ marginInlineStart: 6 }}>{text}</span>}
      </button>
      {open && (
        <WhenModal T={T} title="جدولة النشر"
          sub={<>{label ? <b>{label}</b> : null}{pend ? <><br />عنده جدولة سابقة ({fmtRiyadh(pend.publish_at)}) — الجديدة تحلّ محلها.</> : null}<br />التعديل ينحفظ الحين ويظهر للملاك بالوقت المحدد.</>}
          onClose={() => setOpen(false)}
          onPick={async (at) => {
            let pt = patch, lb = label;
            if (getPatch) { const g = await getPatch(); if (!g) return "تعذّر تجهيز التعديل"; pt = g.patch; lb = g.label || label; }
            const e = await scheduleChange({ table, id, op, patch: pt, at, label: lb });
            if (!e) { flash && flash(`انجدول — يظهر ${fmtRiyadh(at)}`); onDone && onDone(at); }
            return e;
          }} />
      )}
    </>
  );
}

/* شارة صغيرة تظهر على الصف لو مجدول */
export function SchedBadge({ T, table, id }) {
  const { rows, available } = useScheduled();
  if (!available) return null;
  const p = pendingOf(rows, table, id);
  if (!p) return null;
  return (
    <span title={fmtRiyadh(p.publish_at)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: T.brass, background: `${T.brass}18`, border: `1px solid ${T.brass}55`, borderRadius: 999, padding: "2px 8px" }}>
      <AlarmClock size={11} /> {p.patch && p.patch.published === true ? "يظهر" : p.patch && p.patch.published === false ? "يختفي" : "يتحدّث"} {fmtIn(p.publish_at)}
    </span>
  );
}

/* عدّاد المعلّقات لشارة التبويب */
export const usePendingCount = () => { const s = useScheduled(); return s.available ? s.rows.filter((r) => r.status === "pending").length : 0; };
export const useSchedAvailable = () => useScheduled().available;

/* ── تبويب «المجدولة» ──────────────────────────────────── */
function describe(r, targets = {}) {
  const p = r.patch || {};
  const act = r.op === "insert" ? "إضافة" : p.published === true ? "نشر" : p.published === false ? "إخفاء" : "تعديل";
  return `${act} ${targets[r.target_table] || TABLE_AR[r.target_table] || r.target_table}${r.target_id ? ` #${r.target_id}` : ""}`;
}

export function AScheduledTab({ T, flashToast, log }) {
  const { rows, ready, available, targets } = useScheduled();
  const [sel, setSel] = useState(() => new Set());
  const [modal, setModal] = useState(null); /* "all" | "sel" */
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  if (!ready) return <div style={{ color: T.muted, fontSize: 13, padding: 20 }}>جارٍ التحميل…</div>;
  if (!available) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, fontSize: 13, lineHeight: 1.9, color: T.muted }}>
        ميزة النشر المجدول غير مفعّلة بعد. شغّل <b dir="ltr">migration-scheduled-publishing.sql</b> مرة وحدة بـ Supabase SQL Editor، وبعدها تظهر أزرار الجدولة.
      </div>
    );
  }
  const pend = rows.filter((r) => r.status === "pending");
  const failed = rows.filter((r) => r.status === "failed");
  const ids = (sel.size ? rows.filter((r) => sel.has(r.id)) : pend).map((r) => r.id);
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const run = async (fn, okMsg, logMsg) => {
    setBusy(true);
    const e = await fn();
    setBusy(false);
    if (e) { flashToast("تعذّر: " + e); return; }
    log && log(logMsg, `${ids.length} عنصر`);
    flashToast(okMsg); setSel(new Set());
  };
  const btn = (primary, danger) => ({ display: "inline-flex", alignItems: "center", gap: 6, background: primary ? T.brass : "none", color: primary ? T.onAccent || "#fff" : danger ? "#C0392B" : T.paper, border: primary ? "none" : `1px solid ${danger ? "#C0392B66" : T.line}`, borderRadius: 10, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy || !ids.length ? 0.55 : 1, fontFamily: "inherit" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarClock size={17} color={T.brass} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>المجدولة</span>
          <span style={{ marginInlineStart: "auto", fontSize: 11.5, color: T.muted }}>{pend.length} معلّق{failed.length ? ` · ${failed.length} فشل` : ""}</span>
        </div>
        <p style={{ fontSize: 12, color: T.muted, margin: "8px 0 0", lineHeight: 1.8 }}>
          التعديلات اللي جدولتها من الاستفسارات والمعرض والمقاطع والمرفقات والروابط. تتطبّق تلقائيًا بوقتها (بتوقيت الرياض). حدّد صفوفًا لإدارتها، أو بدون تحديد يشمل الأزرار كل المعلّق.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <button type="button" disabled={busy || !ids.length} style={btn(true)} onClick={() => setModal("all")}><AlarmClock size={14} /> {sel.size ? `وقت واحد للمحدد (${sel.size})` : "وقت واحد للكل"}</button>
          <button type="button" disabled={busy || !ids.length} style={btn()} onClick={() => run(() => publishNow(ids), "تم التطبيق الحين", "تطبيق مجدول فورًا")}><Send size={14} /> انشر الحين</button>
          <button type="button" disabled={busy || !ids.length} style={btn(false, true)} onClick={() => run(() => cancelScheduled(ids), "أُلغيت الجدولة", "إلغاء جدولة")}><Trash2 size={14} /> إلغاء الجدولة</button>
          {pend.length > 0 && <button type="button" style={{ ...btn(), opacity: 1 }} onClick={() => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}>{sel.size === rows.length ? "إلغاء التحديد" : "تحديد الكل"}</button>}
        </div>
      </div>

      {!rows.length && <div style={{ background: T.surface, border: `1px dashed ${T.line}`, borderRadius: 14, padding: 22, fontSize: 13, color: T.muted, textAlign: "center" }}>ما في شي مجدول. استخدم زر الساعة بأي استفسار أو صورة أو مقطع.</div>}

      {rows.map((r) => (
        <label key={r.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: T.surface, border: `1px solid ${r.status === "failed" ? "#C0392B66" : T.line}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer" }}>
          <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} style={{ marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{describe(r, targets)}</div>
            {r.label && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>}
            <div style={{ fontSize: 11.5, color: r.status === "failed" ? "#C0392B" : T.brass, marginTop: 4 }}>
              {r.status === "failed" ? `فشل التطبيق: ${r.error || "—"}` : `${fmtRiyadh(r.publish_at)} · ${fmtIn(r.publish_at)}`}
            </div>
            <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>جدولها: {r.scheduled_by_name || "—"}</div>
          </div>
        </label>
      ))}

      {modal && (
        <WhenModal T={T} title="وقت واحد للكل" confirmText="تطبيق" sub={`${ids.length} عنصر يظهر بنفس الوقت.`} onClose={() => setModal(null)}
          onPick={async (at) => {
            const e = await reschedule(ids, at);
            if (!e) { log && log("تعديل وقت الجدولة", `${ids.length} عنصر`); flashToast(`كلها تظهر ${fmtRiyadh(at)}`); setSel(new Set()); }
            return e;
          }} />
      )}
    </div>
  );
}

/* ── ملخص الجلسة قبل الخروج ───────────────────────────── */
export function ExitSummary({ T, items, onBack, onGo, onConfirm }) {
  const { rows, available, targets } = useScheduled();
  const pend = available ? rows.filter((r) => r.status === "pending") : [];
  const failed = available ? rows.filter((r) => r.status === "failed") : [];
  const hm = (iso) => new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" });
  const sec = { fontSize: 12, fontWeight: 700, color: T.muted, margin: "14px 0 6px" };
  const row = { fontSize: 12.5, padding: "6px 0", borderTop: `1px solid ${T.line}`, lineHeight: 1.7 };
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onBack(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onBack]);
  return createPortal(
    <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={onBack} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} />
      <div role="dialog" aria-modal="true" style={{ position: "relative", width: "min(520px,100%)", maxHeight: "86vh", overflowY: "auto", background: T.surface, color: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={17} color={T.brass} />
          <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>ملخص قبل الخروج</div>
          <button onClick={onBack} aria-label="إغلاق" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.muted, cursor: "pointer" }}><X size={15} /></button>
        </div>

        <div style={sec}>انحفظ ونُشر بهالجلسة ({items.length})</div>
        {!items.length && <div style={{ ...row, color: T.faint }}>ما في تعديلات مباشرة.</div>}
        {items.map((it, i) => (
          <div key={i} style={row}><b>{it.action}</b>{it.details ? <span style={{ color: T.muted }}> — {it.details}</span> : null} <span style={{ color: T.faint, fontSize: 11 }}>{hm(it.at)}</span></div>
        ))}

        {available && (
          <>
            <div style={sec}>مجدول ولسا ما ظهر ({pend.length})</div>
            {!pend.length && <div style={{ ...row, color: T.faint }}>ما في شي مجدول.</div>}
            {pend.map((r) => (
              <div key={r.id} style={row}><b>{describe(r, targets)}</b>{r.label ? <span style={{ color: T.muted }}> — {r.label}</span> : null}<div style={{ color: T.brass, fontSize: 11.5 }}>{fmtRiyadh(r.publish_at)} · {fmtIn(r.publish_at)}</div></div>
            ))}
            {failed.length > 0 && (
              <div role="alert" style={{ marginTop: 10, border: "1px solid #C0392B66", borderRadius: 10, padding: "8px 10px", fontSize: 12.5, color: "#C0392B" }}>
                {failed.length} تعديل مجدول فشل تطبيقه — راجعه بتبويب «المجدولة».
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onConfirm} style={{ display: "flex", alignItems: "center", gap: 7, background: T.brass, color: T.onAccent || "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Check size={15} /> تمام، اخرج</button>
          <button type="button" onClick={onBack} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>ارجع للوحة</button>
          {available && (pend.length > 0 || failed.length > 0) && <button type="button" onClick={() => onGo("scheduled")} style={{ background: "none", color: T.brass, border: `1px solid ${T.brass}66`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>افتح المجدولة</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
