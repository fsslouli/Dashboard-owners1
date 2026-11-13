/* ═══════════════════════════════════════════════════════════
   admin-owner-login.jsx — تبويب «دخول الملاك» (6.12.0)
   • زر تفعيل تسجيل الدخول للموقع العام بثلاثة أوضاع (مقفول / قفل كامل / قفل مع أقسام مفتوحة للزائر)
   • حسابات الفلل: إنشاء الكل دفعة واحدة، كشف الأرقام السرية، إعادة تعيين، تعطيل، فك قفل، تصدير إكسل
   الصلاحية: manage_owner_login — الجداول والدوال: migration-owner-login.sql
   الأرقام السرية ما تُكتب أبدًا في سجل النشاط.
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Copy, Download, Eye, EyeOff, KeyRound, Lock, LockOpen, RefreshCw, Search, ShieldCheck, Unlock, Users } from "lucide-react";
import { supabase } from "./app-bootstrap.jsx";
import { GATE_TABS, VILLA_MAX, latinDigits } from "./gate-kit.jsx";
import { THEMES } from "./site-data.jsx";
import { WM_DEFAULTS, WmControls, sanitizeWm } from "./share-wm-kit.jsx";
import { STAMP_LEVEL_AR, StampReveal, sanitizeProtect } from "./protect-kit.jsx";

const S = {
  wrap: { maxWidth: 820, margin: "0 auto", padding: "4px 0", color: "#1F2C35" },
  card: { background: "#fff", border: "1px solid #E1E8EC", borderRadius: 14, padding: 16, marginBottom: 14 },
  h: { fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 12.5, color: "#5F7280", margin: "0 0 14px", lineHeight: 1.8 },
  btn: { border: "1px solid #E1E8EC", background: "#fff", borderRadius: 10, padding: "8px 13px", fontWeight: 500, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", font: "inherit", fontSize: 13, color: "#1F2C35" },
  pri: { background: "#1B7F8E", borderColor: "#1B7F8E", color: "#fff" },
  danger: { borderColor: "#E7C4C0", color: "#A8443C" },
  ib: { width: 32, height: 32, display: "grid", placeItems: "center", border: 0, background: "none", borderRadius: 8, color: "#5F7280", cursor: "pointer" },
  inp: { boxSizing: "border-box", border: "1px solid #E1E8EC", background: "#F7F9FB", borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 14, color: "#1F2C35" },
  chip: (c) => ({ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: c + "1A", color: c, whiteSpace: "nowrap" }),
  hint: { fontSize: 11.5, color: "#5F7280", margin: "6px 0 0", lineHeight: 1.8 },
};

const MODES = [
  { key: "off", title: "مقفول (الموقع مفتوح)", desc: "أي أحد يفتح الموقع بدون دخول — الوضع الحالي.", color: "#5F7280", Icon: LockOpen },
  { key: "full", title: "قفل كامل", desc: "ما ينفتح الموقع إلا برقم الفيلا والرقم السري.", color: "#1B7F8E", Icon: Lock },
  { key: "partial", title: "قفل مع دخول زائر محدود", desc: "شاشة الدخول فيها زر «دخول كزائر»، والزائر يشوف الأقسام اللي تحددها فقط.", color: "#B7791F", Icon: ShieldCheck },
];
const TAB_AR = { overview: "نظرة عامة", notes: "الاستفسارات", progress: "تقدّم التنفيذ", docs: "المستندات والنماذج", gallery: "المكتبة" };
const fmt = (v) => (v ? new Date(v).toLocaleString("ar-SA-u-nu-latn", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const isLocked = (r) => r.locked_until && new Date(r.locked_until).getTime() > Date.now();
const messageFor = (r) => [
  "السلام عليكم ورحمة الله،",
  "بيانات دخولك لموقع ملاك ألبورادا:",
  `الرابط: ${window.location.origin}`,
  `رقم الفيلا: ${r.villa}`,
  `الرقم السري: ${r.pin}`,
  "الرقم خاص بفيلتك، نرجو عدم مشاركته.",
  "فريق تمثيل الملاك",
].join("\n");
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
}

export function AOwnerLoginTab({ flashToast, log, canManage }) {
  const [cfg, setCfg] = useState(null);          // { mode, tabs } | "missing" (الهجرة ما اشتغلت)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [reveal, setReveal] = useState(false);
  const [shown, setShown] = useState({});        // كشف رقم فيلا واحدة
  const [limit, setLimit] = useState(40);
  const [only, setOnly] = useState("all");       // all | never | locked | off
  const [wm, setWm] = useState(null);            // إعدادات العلامة المائية (مسودة لحد ما تضغط حفظ)
  const [wmSaved, setWmSaved] = useState("null");

  /* 7.5.0 — حماية المحتوى (site_settings.protect) */
  const [prot, setProt] = useState(null);
  const [protSaved, setProtSaved] = useState("");
  const [protMissing, setProtMissing] = useState(false);
  const loadProt = async () => {
    const { data, error } = await supabase.from("site_settings").select("protect").eq("id", 1).single();
    if (error) { setProtMissing(true); return; }
    const v = sanitizeProtect(data && data.protect); setProt(v); setProtSaved(JSON.stringify(v));
  };
  useEffect(() => { loadProt(); }, []);
  const protDirty = !!prot && JSON.stringify(prot) !== protSaved;
  const saveProt = async () => {
    setBusy("prot");
    const { error } = await supabase.from("site_settings").update({ protect: prot }).eq("id", 1);
    setBusy("");
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); return; }
    setProtSaved(JSON.stringify(prot)); flashToast("تم حفظ حماية المحتوى — تسري على الجميع فورًا");
    const AR = { copy: "قفل النسخ", blur: "التغبيش", guest: "علامة الزائر", stamp: "الختم الخفي" };
    log("حماية المحتوى", Object.keys(AR).filter((k) => prot[k]).map((k) => AR[k]).join("، ") || "كلها مقفولة");
  };

  const loadCfg = async () => {
    const { data, error } = await supabase.from("site_settings").select("gate_mode,gate_guest_tabs,gate_wm").eq("id", 1).single();
    if (error || !data) { setCfg("missing"); return; }
    setCfg({ mode: data.gate_mode || "off", tabs: data.gate_guest_tabs || [] });
    setWm((cur) => cur ?? { on: false, ...WM_DEFAULTS, sid: false, ...(data.gate_wm || {}) });
    setWmSaved(JSON.stringify(data.gate_wm || null));
  };
  const loadRows = async () => {
    const { data, error } = await supabase.from("villa_accounts").select("villa,pin,enabled,fails_total,locked_until,last_login_at,login_count,pin_set_at").order("villa");
    if (!error) setRows(data || []);
    setLoading(false);
  };
  useEffect(() => {
    loadCfg(); loadRows();
    const ch = supabase.channel("admin-owner-login")
      .on("postgres_changes", { event: "*", schema: "public", table: "villa_accounts" }, () => loadRows())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "site_settings" }, () => loadCfg())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    used: rows.filter((r) => r.login_count > 0).length,
    locked: rows.filter(isLocked).length,
    off: rows.filter((r) => !r.enabled).length,
  }), [rows]);

  const list = useMemo(() => {
    const t = latinDigits(q).trim();
    return rows.filter((r) => (!t || String(r.villa).startsWith(t))
      && (only === "all" || (only === "never" && !r.login_count) || (only === "locked" && isLocked(r)) || (only === "off" && !r.enabled)));
  }, [rows, q, only]);

  if (!canManage) return <div style={S.wrap}><div style={S.card}>هذا القسم يحتاج صلاحية «إدارة دخول الملاك».</div></div>;
  if (cfg === "missing") {
    return (
      <div style={S.wrap} dir="rtl">
        <div style={S.card}>
          <h3 style={S.h}><KeyRound size={17} />دخول الملاك</h3>
          <p style={{ ...S.sub, margin: 0 }}>الخاصية تحتاج تجهيز قاعدة البيانات مرة واحدة: شغّل ملف <b>migration-owner-login.sql</b> من Supabase ← SQL Editor، ثم حدّث الصفحة. الموقع يبقى مفتوحًا كما هو لحد ما تفعّل الخاصية من هنا.</p>
        </div>
      </div>
    );
  }
  if (!cfg) return <div style={S.wrap}>جارٍ التحميل…</div>;

  const saveCfg = async (next, label) => {
    setBusy("cfg");
    const { error } = await supabase.from("site_settings").update({ gate_mode: next.mode, gate_guest_tabs: next.tabs }).eq("id", 1);
    setBusy("");
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); return; }
    setCfg(next); flashToast("تم الحفظ — يسري على كل الزوّار فورًا");
    log("دخول الملاك", label);
  };
  const pickMode = (m) => {
    if (m === cfg.mode) return;
    if (m !== "off" && !stats.total) { flashToast("أنشئ حسابات الفلل أولًا (الزر بالأسفل) قبل تفعيل القفل"); return; }
    if (m === "partial" && !cfg.tabs.length) { flashToast("حدّد قسمًا واحدًا على الأقل للزائر ثم اختر هذا الوضع"); return; }
    const title = MODES.find((x) => x.key === m).title;
    if (m !== "off" && !window.confirm(`تفعيل «${title}»؟\nالزوّار اللي ما سجلوا دخول بينقفل عليهم الموقع فورًا. حسابك كإدارة يبقى يفتح الموقع عادي.`)) return;
    saveCfg({ ...cfg, mode: m }, `تغيير وضع الدخول إلى: ${title}`);
  };
  const toggleTab = (k) => {
    const tabs = cfg.tabs.includes(k) ? cfg.tabs.filter((x) => x !== k) : GATE_TABS.filter((x) => x === k || cfg.tabs.includes(x));
    if (cfg.mode === "partial" && !tabs.length) { flashToast("لازم يبقى قسم واحد على الأقل، أو غيّر الوضع إلى «قفل كامل»"); return; }
    saveCfg({ ...cfg, tabs }, `أقسام الزائر بلا دخول: ${tabs.map((x) => TAB_AR[x]).join("، ") || "لا شيء"}`);
  };

  const wmClean = wm ? { on: !!wm.on, ...sanitizeWm(wm), who: "" } : null;
  const wmDirty = !!wmClean && JSON.stringify(wmClean) !== wmSaved;
  const saveWm = async () => {
    setBusy("wm");
    const { error } = await supabase.from("site_settings").update({ gate_wm: wmClean }).eq("id", 1);
    setBusy("");
    if (error) { flashToast(`تعذّر الحفظ: ${error.message}`); return; }
    setWmSaved(JSON.stringify(wmClean)); flashToast("تم حفظ العلامة المائية — تسري على كل الملاك فورًا");
    log("دخول الملاك", `العلامة المائية برقم الفيلا: ${wmClean.on ? `مفعّلة (سواد ${wmClean.opacity}% · خط ${wmClean.size})` : "مقفولة"}`);
  };

  const generate = async (resetAll) => {
    if (resetAll) {
      const a = window.prompt(`هذا يغيّر الأرقام السرية لكل الفلل (${stats.total}) ويخرّج كل الملاك من أجهزتهم، وتحتاج توزّع الأرقام من جديد.\nللتأكيد اكتب: تغيير الكل`);
      if (a !== "تغيير الكل") return;
    }
    setBusy("gen");
    const { data, error } = await supabase.rpc("villa_accounts_generate", { p_reset_all: !!resetAll });
    setBusy("");
    if (error) { flashToast(`تعذّر: ${error.message}`); return; }
    await loadRows();
    flashToast(resetAll ? `تم تغيير ${data?.reset ?? 0} رقم سري` : `تم إنشاء ${data?.created ?? 0} حساب`);
    log("دخول الملاك", resetAll ? "تغيير الأرقام السرية لكل الفلل" : `إنشاء حسابات الفلل (${data?.created ?? 0} جديد)`);
  };
  const resetOne = async (r, custom) => {
    let pin = null;
    if (custom) {
      const a = window.prompt(`رقم سري جديد لفيلا ${r.villa} (6 أرقام):`);
      if (a == null) return;
      pin = latinDigits(a).trim();
      if (!/^[0-9]{6}$/.test(pin)) { flashToast("الرقم السري لازم يكون 6 أرقام"); return; }
    } else if (!window.confirm(`تغيير الرقم السري لفيلا ${r.villa} برقم عشوائي جديد؟\nكل أجهزة هذه الفيلا بتطلع من الموقع وتحتاج الرقم الجديد.`)) return;
    setBusy(`r${r.villa}`);
    const { error } = await supabase.rpc("villa_account_reset", { p_villa: r.villa, p_pin: pin });
    setBusy("");
    if (error) { flashToast(`تعذّر: ${error.message}`); return; }
    await loadRows(); setShown((s) => ({ ...s, [r.villa]: true }));
    flashToast(`تم تغيير الرقم السري لفيلا ${r.villa}`);
    log("دخول الملاك", `إعادة تعيين الرقم السري لفيلا ${r.villa}`);
  };
  const setEnabled = async (r, en) => {
    if (!en && !window.confirm(`إيقاف حساب فيلا ${r.villa}؟ ما يقدر يدخل الموقع لحد ما تفعّله.`)) return;
    const { error } = await supabase.rpc("villa_account_set_enabled", { p_villa: r.villa, p_enabled: en });
    if (error) { flashToast(`تعذّر: ${error.message}`); return; }
    await loadRows(); flashToast(en ? `تم تفعيل فيلا ${r.villa}` : `تم إيقاف فيلا ${r.villa}`);
    log("دخول الملاك", `${en ? "تفعيل" : "إيقاف"} حساب فيلا ${r.villa}`);
  };
  const unlock = async (r) => {
    const { error } = await supabase.rpc("villa_account_unlock", { p_villa: r.villa });
    if (error) { flashToast(`تعذّر: ${error.message}`); return; }
    await loadRows(); flashToast(`تم فك قفل فيلا ${r.villa}`);
    log("دخول الملاك", `فك القفل المؤقت لفيلا ${r.villa}`);
  };
  const exportXlsx = () => {
    const data = rows.map((r) => ({ "رقم الفيلا": r.villa, "الرقم السري": r.pin, "الحالة": r.enabled ? "مفعّل" : "موقوف", "عدد مرات الدخول": r.login_count, "آخر دخول": r.last_login_at ? fmt(r.last_login_at) : "" }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    if (!wb.Workbook) wb.Workbook = {};
    wb.Workbook.Views = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, "دخول الملاك");
    XLSX.writeFile(wb, `alborada_owner_logins_${new Date().toISOString().slice(0, 10)}.xlsx`);
    log("دخول الملاك", "تصدير كشف الأرقام السرية (إكسل)");
  };

  return (
    <div style={S.wrap} dir="rtl">
      {/* ── ١) زر التفعيل ── */}
      <div style={S.card}>
        <h3 style={S.h}><KeyRound size={17} />تسجيل الدخول للموقع العام</h3>
        <p style={S.sub}>اسم الحساب رقم الفيلا، والرقم السري 6 أرقام. التغيير يسري على كل الزوّار فورًا، والقفل من قاعدة البيانات نفسها. حسابات الإدارة تفتح الموقع بدون رقم فيلا.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          {MODES.map((m) => {
            const on = cfg.mode === m.key;
            return (
              <button key={m.key} type="button" disabled={busy === "cfg"} onClick={() => pickMode(m.key)} aria-pressed={on}
                style={{ textAlign: "start", border: `2px solid ${on ? m.color : "#E1E8EC"}`, background: on ? m.color + "0F" : "#fff", borderRadius: 12, padding: 12, cursor: "pointer", font: "inherit", color: "#1F2C35" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13.5, color: on ? m.color : "#1F2C35" }}>
                  <m.Icon size={16} />{m.title}{on && <span style={S.chip(m.color)}>الحالي</span>}
                </div>
                <div style={{ fontSize: 12, color: "#5F7280", lineHeight: 1.7, marginTop: 6 }}>{m.desc}</div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E1E8EC" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>وش يشوف الزائر (تُستخدم في وضع «قفل مع دخول زائر محدود»)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GATE_TABS.map((k) => {
              const on = cfg.tabs.includes(k);
              return (
                <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${on ? "#1B7F8E" : "#E1E8EC"}`, background: on ? "#1B7F8E12" : "#fff", borderRadius: 10, padding: "7px 12px", fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={on} disabled={busy === "cfg"} onChange={() => toggleTab(k)} />{TAB_AR[k]}
                </label>
              );
            })}
          </div>
          <p style={S.hint}>«نظرة عامة» تعرض ملخص الاستفسارات والتقدّم، فلو فتحتها للزائر تنفتح له أرقام الملخص. ملفات المكتبة والمرفقات روابطها المباشرة تبقى تفتح للي عنده الرابط نفسه.</p>
        </div>
      </div>

      {/* ── العلامة المائية برقم الفيلا ── */}
      {wm && (
        <div style={S.card}>
          <h3 style={S.h}><ShieldCheck size={17} />العلامة المائية برقم الفيلا</h3>
          <p style={S.sub}>تظهر فوق الموقع كله لكل مالك مسجّل دخول وفيها رقم فيلته، فأي لقطة شاشة تنعرف من أي فيلا طلعت. ما تظهر للإدارة ولا للزائر.</p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, marginBottom: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={!!wm.on} onChange={(e) => setWm({ ...wm, on: e.target.checked })} />تفعيل العلامة المائية
          </label>
          {wm.on && <WmControls T={THEMES.light} value={wm} onChange={setWm} title="شكل العلامة (معاينة حيّة)" fixedName="فيلا 120" />}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" style={{ ...S.btn, ...S.pri, opacity: wmDirty ? 1 : 0.5 }} disabled={!wmDirty || busy === "wm"} onClick={saveWm}>{busy === "wm" ? "جارٍ الحفظ…" : "حفظ العلامة المائية"}</button>
            {wmDirty && <span style={{ fontSize: 12, color: "#B7791F" }}>تغييرات غير محفوظة</span>}
          </div>
        </div>
      )}

      {/* ── حماية المحتوى (7.5.0) ── */}
      {(prot || protMissing) && (
        <div style={S.card}>
          <h3 style={S.h}><ShieldCheck size={17} />حماية المحتوى من النسخ ولقطات الشاشة</h3>
          {protMissing ? <p style={S.sub}>تحتاج تجهيز قاعدة البيانات (عمود protect) — لم يُطبَّق بعد.</p> : (
            <>
              <p style={S.sub}>لا يوجد موقع يستطيع منع لقطة الشاشة نفسها على الجوال. هذه الخيارات تصعّب النسخ وتجعل أي لقطة تدل على صاحبها. الإدارة مستثناة منها.</p>
              {[
                ["stamp", "الختم الخفي", "نقش شبه غير مرئي فوق الصفحة فيه رقم الفيلا (أو رمز جهاز الزائر) والتاريخ — يُكشف من «كاشف الختم» تحت."],
                ["copy", "قفل النسخ", "يمنع تحديد النص والنسخ والقائمة اليمنى والطباعة والحفظ."],
                ["guest", "علامة مائية للزائر بلا دخول", "علامة ظاهرة خفيفة فيها رمز جهاز الزائر والتاريخ (المالك المسجّل له علامته برقم الفيلا فوق)."],
                ["blur", "تغبيش عند مغادرة الصفحة", "يغبّش المحتوى عند فقدان التركيز أو مفاتيح لقطة الشاشة — ينفع على الكمبيوتر، وأثره ضعيف على الجوال."],
              ].map(([k, t, d]) => (
                <label key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: "1px solid #EEF2F4", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!prot[k]} onChange={(e) => setProt({ ...prot, [k]: e.target.checked })} style={{ marginTop: 4 }} />
                  <span><b style={{ fontSize: 13.5 }}>{t}</b><span style={{ display: "block", fontSize: 12, color: "#5F7280", lineHeight: 1.7 }}>{d}</span></span>
                </label>
              ))}
              {prot.stamp && (
                <div style={{ padding: "10px 0", borderTop: "1px solid #EEF2F4" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <b style={{ whiteSpace: "nowrap" }}>وضوح الختم</b>
                    <input type="range" min="1" max="5" step="1" value={prot.level} onChange={(e) => setProt({ ...prot, level: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 76, textAlign: "center", fontWeight: 700, color: "#1B7F8E" }}>{STAMP_LEVEL_AR[prot.level - 1]}</span>
                  </label>
                  <p style={S.hint}>كل ما أخفيته أكثر صعب على العين وصعب على «كاشف الختم» معًا — خصوصًا مع لقطة مضغوطة (واتساب). «مخفي جدًا» قد لا يُكشف إلا من لقطة أصلية غير مضغوطة.</p>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 14px" }}>
                <button type="button" style={{ ...S.btn, ...S.pri, opacity: protDirty ? 1 : 0.5 }} disabled={!protDirty || busy === "prot"} onClick={saveProt}>{busy === "prot" ? "جارٍ الحفظ…" : "حفظ الحماية"}</button>
                {protDirty && <span style={{ fontSize: 12, color: "#B7791F" }}>تغييرات غير محفوظة</span>}
              </div>
              <h3 style={{ ...S.h, fontSize: 14 }}>كاشف الختم</h3>
              <StampReveal S={S} />
            </>
          )}
        </div>
      )}

      {/* ── ٢) حسابات الفلل ── */}
      <div style={S.card}>
        <h3 style={S.h}><Users size={17} />حسابات الفلل والأرقام السرية</h3>
        <p style={S.sub}>
          {stats.total ? `${stats.total} حساب من ${VILLA_MAX} · دخل منهم ${stats.used} · مقفل مؤقتًا ${stats.locked} · موقوف ${stats.off}` : "ما في حسابات بعد — أنشئها دفعة واحدة، وكل فيلا يطلع لها رقم سري عشوائي."}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {stats.total < VILLA_MAX && (
            <button type="button" style={{ ...S.btn, ...S.pri }} disabled={busy === "gen"} onClick={() => generate(false)}>
              <KeyRound size={15} />{busy === "gen" ? "جارٍ الإنشاء…" : stats.total ? "إنشاء حسابات الفلل الناقصة" : `إنشاء حسابات كل الفلل (${VILLA_MAX})`}
            </button>
          )}
          {!!stats.total && (
            <>
              <button type="button" style={S.btn} onClick={() => setReveal((v) => !v)}>{reveal ? <EyeOff size={15} /> : <Eye size={15} />}{reveal ? "إخفاء الأرقام" : "إظهار كل الأرقام"}</button>
              <button type="button" style={S.btn} onClick={exportXlsx}><Download size={15} />تصدير الكشف (إكسل)</button>
              <button type="button" style={{ ...S.btn, ...S.danger }} disabled={busy === "gen"} onClick={() => generate(true)}><RefreshCw size={15} />تغيير كل الأرقام</button>
            </>
          )}
        </div>

        {!!stats.total && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <div style={{ position: "relative", flex: "1 1 170px" }}>
                <Search size={15} style={{ position: "absolute", insetInlineStart: 10, top: 11, color: "#5F7280" }} />
                <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(40); }} inputMode="numeric" placeholder="ابحث برقم الفيلا" style={{ ...S.inp, width: "100%", paddingInlineStart: 32 }} />
              </div>
              {[["all", "الكل"], ["never", "ما دخل بعد"], ["locked", "مقفل مؤقتًا"], ["off", "موقوف"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setOnly(k); setLimit(40); }} style={{ ...S.btn, padding: "7px 11px", ...(only === k ? S.pri : {}) }}>{l}</button>
              ))}
            </div>

            {loading ? <div style={S.sub}>جارٍ التحميل…</div> : !list.length ? <div style={S.sub}>لا نتائج.</div> : (
              <div style={{ border: "1px solid #E1E8EC", borderRadius: 12, overflow: "hidden" }}>
                {list.slice(0, limit).map((r, i) => {
                  const vis = reveal || shown[r.villa];
                  const locked = isLocked(r);
                  return (
                    <div key={r.villa} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: i ? "1px solid #EEF2F5" : 0, background: r.enabled ? "#fff" : "#FAF3F2" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, minWidth: 74 }}>فيلا {r.villa}</div>
                      <button type="button" onClick={() => setShown((s) => ({ ...s, [r.villa]: !s[r.villa] }))} title={vis ? "إخفاء" : "إظهار"}
                        style={{ ...S.btn, padding: "5px 10px", fontFamily: "ui-monospace, monospace", fontSize: 15, letterSpacing: 2, minWidth: 104, justifyContent: "center", direction: "ltr" }}>
                        {vis ? r.pin : "••••••"}
                      </button>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "1 1 120px" }}>
                        {!r.enabled && <span style={S.chip("#A8443C")}>موقوف</span>}
                        {locked && <span style={S.chip("#B7791F")}>مقفل مؤقتًا</span>}
                        {r.login_count ? <span style={S.chip("#2E7D5B")} title={`آخر دخول: ${fmt(r.last_login_at)}`}>دخل {r.login_count} مرة</span> : <span style={S.chip("#5F7280")}>ما دخل بعد</span>}
                        {r.fails_total > 0 && <span style={S.chip("#5F7280")} title="إجمالي المحاولات الخاطئة">{r.fails_total} محاولة خاطئة</span>}
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        <button type="button" style={S.ib} title="نسخ رسالة جاهزة للمالك" onClick={async () => flashToast((await copyText(messageFor(r))) ? `نُسخت رسالة فيلا ${r.villa}` : "تعذّر النسخ")}><Copy size={16} /></button>
                        <button type="button" style={S.ib} title="رقم سري عشوائي جديد" disabled={busy === `r${r.villa}`} onClick={() => resetOne(r, false)}><RefreshCw size={16} /></button>
                        <button type="button" style={S.ib} title="تحديد رقم سري يدويًا" onClick={() => resetOne(r, true)}><KeyRound size={16} /></button>
                        {locked && <button type="button" style={S.ib} title="فك القفل المؤقت" onClick={() => unlock(r)}><Unlock size={16} /></button>}
                        <button type="button" style={{ ...S.ib, color: r.enabled ? "#A8443C" : "#2E7D5B" }} title={r.enabled ? "إيقاف الحساب" : "تفعيل الحساب"} onClick={() => setEnabled(r, !r.enabled)}>{r.enabled ? <Lock size={16} /> : <LockOpen size={16} />}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {list.length > limit && <button type="button" style={{ ...S.btn, marginTop: 10 }} onClick={() => setLimit((n) => n + 80)}>عرض المزيد ({list.length - limit} باقي)</button>}
            <p style={S.hint}>بعد 5 محاولات خاطئة متتالية ينقفل حساب الفيلا 15 دقيقة تلقائيًا. تغيير الرقم السري أو إيقاف الحساب يخرّج كل أجهزة الفيلا فورًا.</p>
          </>
        )}
      </div>
    </div>
  );
}
