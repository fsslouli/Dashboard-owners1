/* admin-share-tab.jsx — تبويب «روابط المشاركة» بلوحة الإدارة (4.0.0)
   تنشئ رابطًا خاصًا لشخص ما: تحدد له الأقسام والمخططات ومواضيع المعرض اللي يشوفها فقط،
   والمدة وعدد مرات الفتح. تقدر تلغيه بأي لحظة. الرمز الكامل (٢٢ حرفًا) يظهر مرة وحدة عند الإنشاء —
   القاعدة تحفظ مفتاح بحث مشتق منه فقط، فما نقدر نعرضه لاحقًا (لو ضاع، ألغِ الرابط وأنشئ غيره). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Check, Clock, Copy, Dices, Link2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { ALocked, aNoteStyle } from "./admin-excel-utils.jsx";
import { useSystemTheme } from "./admin-core.jsx";
import { DOCS } from "./site-data.jsx";
import { SHARE_HOST, SHARE_TABS, buildShareUrl, lookupKey, makeSalt, makeToken, pinHash } from "./share-kit.jsx";
import { ShareReport } from "./admin-share-report.jsx";

const DURATIONS = [
  { v: 60, l: "ساعة" }, { v: 360, l: "٦ ساعات" }, { v: 1440, l: "يوم" },
  { v: 4320, l: "٣ أيام" }, { v: 10080, l: "أسبوع" }, { v: 43200, l: "٣٠ يومًا" },
];
const OPENS = [1, 2, 3, 5, 10];
const SESSIONS = [{ v: 15, l: "١٥ دقيقة" }, { v: 30, l: "٣٠ دقيقة" }, { v: 60, l: "ساعة" }, { v: 120, l: "ساعتان" }];

const fmt = (d) => (d ? new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }) : "—");
function statusOf(r) {
  if (r.revoked_at) return { k: "revoked", l: "ملغي", c: "#C0392B" };
  if (new Date(r.expires_at).getTime() <= Date.now()) return { k: "expired", l: "منتهي", c: "#8A8A8A" };
  if (r.opens >= r.max_opens) return { k: "exhausted", l: "اكتمل استخدامه", c: "#B8790F" };
  return { k: "active", l: "فعّال", c: "#1E8E5A" };
}

export function AShareTab({ supabase, flashToast, log, canManage, by }) {
  const T = useSystemTheme();
  const [rows, setRows] = useState(null);
  const [topics, setTopics] = useState([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // { url, label, pin }
  const [reportFor, setReportFor] = useState(null);
  const [agg, setAgg] = useState({});
  const [copied, setCopied] = useState(false);
  const [f, setF] = useState({
    label: "", note: "", tabs: ["overview", "notes"], allDocs: true, docs: DOCS.map((d) => d.id),
    allTopics: true, topics: [], hideCommunity: true, mins: 1440, opens: 1, session: 30, pin: "",
  });
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("share_links").select("id,label,note,scope,expires_at,max_opens,opens,session_minutes,created_by,created_at,first_opened_at,last_opened_at,revoked_at,has_pin,locked_until").order("created_at", { ascending: false });
    if (error) { setRows(false); return; }
    setRows(data || []);
    const { data: ss } = await supabase.from("share_sessions").select("link_id,active_ms,events").limit(5000);
    const a = {};
    (ss || []).forEach((x) => { const o = (a[x.link_id] ||= { n: 0, ms: 0, ev: 0 }); o.n += 1; o.ms += Number(x.active_ms) || 0; o.ev += x.events || 0; });
    setAgg(a);
  }, [supabase]);
  useEffect(() => {
    load();
    supabase.from("media_topics").select("id,title_ar,published").eq("published", true).order("sort_order").then(({ data }) => setTopics(data || []));
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load, supabase]);

  const create = async () => {
    if (!f.label.trim()) { flashToast("اكتب اسم المستلم أو وصفًا للرابط"); return; }
    if (!f.tabs.length) { flashToast("اختر قسمًا واحدًا على الأقل"); return; }
    if (f.tabs.includes("docs") && !f.allDocs && !f.docs.length) { flashToast("اختر مخططًا واحدًا على الأقل أو فعّل «كل المخططات»"); return; }
    if (f.tabs.includes("gallery") && !f.allTopics && !f.topics.length) { flashToast("اختر موضوعًا واحدًا على الأقل أو فعّل «كل المواضيع»"); return; }
    const pinVal = f.pin.trim();
    if (pinVal && !/^[A-Za-z0-9]{4,12}$/.test(pinVal)) { flashToast("رمز الدخول: ٤ إلى ١٢ خانة (أرقام أو أحرف إنجليزية)"); return; }
    setBusy(true);
    const token = makeToken();
    const token_hash = await lookupKey(token);
    const pin_salt = pinVal ? makeSalt() : null;
    const pin_hash = pinVal ? await pinHash(pinVal, pin_salt) : null;
    const scope = {
      tabs: SHARE_TABS.map((t) => t.key).filter((k) => f.tabs.includes(k)),
      docs: f.tabs.includes("docs") && !f.allDocs ? f.docs : null,
      topics: f.tabs.includes("gallery") && !f.allTopics ? f.topics : null,
      hideCommunity: !!f.hideCommunity,
    };
    const { error } = await supabase.from("share_links").insert({
      token_hash, label: f.label.trim(), note: f.note.trim() || null, scope,
      expires_at: new Date(Date.now() + f.mins * 60000).toISOString(),
      max_opens: f.opens, session_minutes: f.session, created_by: by || null, pin_salt, pin_hash,
    });
    setBusy(false);
    if (error) { flashToast("تعذّر إنشاء الرابط — تأكد من تشغيل migration-share-links.sql"); return; }
    log && log("إنشاء رابط مشاركة", f.label.trim());
    setCreated({ url: buildShareUrl(token), label: f.label.trim(), pin: pinVal || null }); setCopied(false);
    set({ label: "", note: "", pin: "" });
    load();
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { flashToast("المتصفح منع النسخ — انسخ الرابط يدويًا"); }
  };
  const revoke = async (r) => {
    const { error } = await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", r.id).is("revoked_at", null);
    if (error) { flashToast("تعذّر الإلغاء"); return; }
    log && log("إلغاء رابط مشاركة", r.label); flashToast("أُلغي الرابط — يسري خلال دقيقة على أي جلسة مفتوحة"); load();
  };
  const patch = async (r, p, msg) => {
    const { error } = await supabase.from("share_links").update(p).eq("id", r.id);
    if (error) { flashToast("تعذّر التعديل"); return; }
    log && log("تعديل رابط مشاركة", `${r.label} — ${msg}`); flashToast(msg); load();
  };
  const extend = (r, mins) => patch(r, { expires_at: new Date(Math.max(Date.now(), new Date(r.expires_at).getTime()) + mins * 60000).toISOString() }, mins >= 1440 ? "مُدّدت الصلاحية يومًا" : "مُدّدت الصلاحية ساعة");
  const addOpen = (r) => patch(r, { max_opens: Math.min(100, r.max_opens + 1) }, "أُضيفت فتحة");
  const clone = (r) => {
    const sc = r.scope || {};
    setF((x) => ({ ...x, label: `${r.label} (نسخة)`, note: r.note || "", tabs: sc.tabs || x.tabs, allDocs: !Array.isArray(sc.docs), docs: Array.isArray(sc.docs) ? sc.docs : DOCS.map((d) => d.id), allTopics: !Array.isArray(sc.topics), topics: Array.isArray(sc.topics) ? sc.topics : [], hideCommunity: !!sc.hideCommunity, opens: OPENS.includes(r.max_opens) ? r.max_opens : 1, session: r.session_minutes, pin: "" }));
    window.scrollTo?.({ top: 0, behavior: "smooth" });
    flashToast("نُسخت الإعدادات في النموذج — اضغط «إنشاء الرابط» لرابط جديد");
  };
  const randomPin = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); set({ pin: String(100000 + (b[0] % 900000)) }); };
  const remove = async (r) => {
    const { error } = await supabase.from("share_links").delete().eq("id", r.id);
    if (error) { flashToast("تعذّر الحذف"); return; }
    log && log("حذف رابط مشاركة", r.label); load();
  };

  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 15px", marginBottom: 12 };
  const lab = { fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.sunken, color: T.paper, fontFamily: "inherit", outline: "none" };
  const chk = (on, text, onClick, key) => (
    <button key={key} type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "right", background: on ? T.brass + "14" : "transparent", border: `1px solid ${on ? T.brass : T.line}`, color: T.paper, borderRadius: 10, padding: "8px 10px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${on ? T.brass : T.faint}`, background: on ? T.brass : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={11} color="#fff" />}</span>
      {text}
    </button>
  );
  const sel = (value, onChange, opts) => (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={inp}>{opts.map((o) => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}</select>
  );

  const activeCount = useMemo(() => (Array.isArray(rows) ? rows.filter((r) => statusOf(r).k === "active").length : 0), [rows]);
  if (!canManage) return <ALocked text="إنشاء روابط المشاركة يحتاج صلاحية «إدارة الإشعارات والمظهر»." />;
  if (reportFor) return <ShareReport supabase={supabase} link={reportFor} T={T} flashToast={flashToast} log={log} onBack={() => { setReportFor(null); load(); }} />;

  return (
    <div>
      <div style={{ ...aNoteStyle(T), marginBottom: 14 }}>
        رابط خاص ينتهي بالمدة أو بالإلغاء، ويعرض لصاحبه الأقسام التي تحددها فقط — بدون زر الإدارة ولا أي رابط للموقع الرئيسي.
        الرمز يظهر لك مرة واحدة عند الإنشاء فقط. {SHARE_HOST ? <>الروابط تُبنى على الدومين المنفصل: <b dir="ltr">{SHARE_HOST}</b>.</> : <b style={{ color: "#B8790F" }}>تنبيه: ما ضُبط دومين مشاركة منفصل (VITE_SHARE_HOST)، فالرابط سيفتح على نفس دومين الموقع الرئيسي — راجع README.</b>}
        <br />تنبيه صريح: هذا يقيّد ما <b>يُعرض</b> لصاحب الرابط ومدّته، لكنه لا يخفي المحتوى العام عمّن يعرف عنوان الموقع الرئيسي.
      </div>

      {created && (
        <div style={{ ...card, border: `1px solid ${T.brass}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Link2 size={14} color={T.brass} /> رابط «{created.label}» جاهز — انسخه الآن، ما يظهر مرة ثانية</div>
          <div dir="ltr" style={{ fontSize: 12.5, wordBreak: "break-all", background: T.sunken, borderRadius: 10, padding: "10px 12px", marginBottom: 10, userSelect: "all" }}>{created.url}</div>
          {created.pin && <div style={{ fontSize: 12, marginBottom: 10 }}>رمز الدخول (أرسله بقناة مختلفة عن الرابط): <b dir="ltr" style={{ letterSpacing: 2, userSelect: "all" }}>{created.pin}</b></div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => copy(created.url)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: T.brass, color: T.onAccent || "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "تم النسخ" : "نسخ الرابط"}</button>
            <button onClick={() => setCreated(null)} style={{ border: `1px solid ${T.line}`, background: "none", color: T.muted, borderRadius: 10, padding: "9px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>إخفاء</button>
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>إنشاء رابط جديد</div>
        <label style={lab}>اسم المستلم أو وصف الرابط (لك فقط)</label>
        <input value={f.label} onChange={(e) => set({ label: e.target.value })} maxLength={120} placeholder="مثال: المهندس خالد — مراجعة المخططات" style={{ ...inp, marginBottom: 12 }} />
        <label style={lab}>رسالة تظهر للمستلم أعلى الصفحة (اختياري)</label>
        <textarea value={f.note} onChange={(e) => set({ note: e.target.value })} maxLength={500} rows={2} placeholder="مثال: للاطلاع على المخططات والاستفسارات فقط" style={{ ...inp, marginBottom: 14, resize: "vertical" }} />

        <label style={lab}>الأقسام التي يشوفها</label>
        <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>{SHARE_TABS.map((t) => chk(f.tabs.includes(t.key), t.label, () => set({ tabs: toggle(f.tabs, t.key) }), t.key))}</div>

        {f.tabs.includes("docs") && (
          <div style={{ marginBottom: 14 }}>
            <label style={lab}>المخططات والمستندات</label>
            <div style={{ display: "grid", gap: 6 }}>
              {chk(f.allDocs, "كل المخططات والمستندات", () => set({ allDocs: !f.allDocs }), "alldocs")}
              {!f.allDocs && DOCS.map((d) => chk(f.docs.includes(d.id), d.nameAr, () => set({ docs: toggle(f.docs, d.id) }), d.id))}
            </div>
          </div>
        )}
        {f.tabs.includes("gallery") && (
          <div style={{ marginBottom: 14 }}>
            <label style={lab}>مواضيع الصور والمقاطع</label>
            <div style={{ display: "grid", gap: 6 }}>
              {chk(f.allTopics, "كل المواضيع", () => set({ allTopics: !f.allTopics }), "alltopics")}
              {!f.allTopics && topics.map((t) => chk(f.topics.includes(t.id), t.title_ar || `موضوع ${t.id}`, () => set({ topics: toggle(f.topics, t.id) }), t.id))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 14 }}>{chk(f.hideCommunity, "إخفاء زر مجتمع الملاك (رابط تليجرام)", () => set({ hideCommunity: !f.hideCommunity }), "tg")}</div>

        <label style={lab}>رمز دخول PIN (اختياري — طبقة حماية ثانية، يُحفظ مشفّرًا ولا يُعرض لاحقًا)</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={f.pin} onChange={(e) => set({ pin: e.target.value })} maxLength={12} dir="ltr" placeholder="مثال: 482915 — اتركه فارغًا بلا رمز" style={{ ...inp, flex: 1 }} />
          <button type="button" onClick={randomPin} title="رمز عشوائي" style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${T.line}`, background: "none", color: T.muted, borderRadius: 10, padding: "0 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Dices size={14} /> عشوائي</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
          <div><label style={lab}>صلاحية الرابط</label>{sel(f.mins, (v) => set({ mins: v }), DURATIONS)}</div>
          <div><label style={lab}>عدد مرات الفتح</label>{sel(f.opens, (v) => set({ opens: v }), OPENS.map((n) => ({ v: n, l: n === 1 ? "مرة واحدة" : `${n} مرات` })))}</div>
          <div><label style={lab}>مدة العرض بعد الفتح</label>{sel(f.session, (v) => set({ session: v }), SESSIONS)}</div>
        </div>
        <button onClick={create} disabled={busy} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: T.brass, color: T.onAccent || "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}><ShieldCheck size={16} /> {busy ? "جارٍ الإنشاء…" : "إنشاء الرابط"}</button>
        <div style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.8 }}>«مرة واحدة» تعني فتحة واحدة فعلية بضغط الزر في صفحة المستلم (معاينة واتساب لا تستهلكها). بعد الفتح تبقى الجلسة شغالة بمتصفحه طوال «مدة العرض» ولو حدّث الصفحة.</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 2px 8px" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>الروابط {Array.isArray(rows) && <span style={{ color: T.muted, fontWeight: 500, fontSize: 12 }}>({activeCount} فعّال)</span>}</div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${T.line}`, color: T.muted, borderRadius: 9, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><RefreshCw size={12} /> تحديث</button>
      </div>
      {rows === null && <div style={{ ...aNoteStyle(T) }}>جارٍ التحميل…</div>}
      {rows === false && <ALocked text="تعذّرت قراءة الروابط — شغّل migration-share-links.sql من SQL Editor ثم حدّث." />}
      {Array.isArray(rows) && rows.length === 0 && <div style={aNoteStyle(T)}>ما أنشأت أي رابط بعد.</div>}
      {Array.isArray(rows) && rows.map((r) => {
        const s = statusOf(r);
        const tabsTxt = (r.scope?.tabs || []).map((k) => SHARE_TABS.find((t) => t.key === k)?.label.split(" (")[0] || k).join("، ");
        return (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</div>
              <span style={{ background: s.c + "18", color: s.c, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{s.l}</span>
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.9, marginTop: 6 }}>
              الأقسام: {tabsTxt || "—"}<br />
              ينتهي: {fmt(r.expires_at)} · فُتح {r.opens} من {r.max_opens} · آخر فتح: {fmt(r.last_opened_at)}<br />
              أُنشئ: {fmt(r.created_at)}{r.created_by ? ` بواسطة ${r.created_by}` : ""}{r.has_pin ? " · محميّ برمز PIN" : ""}
              {agg[r.id] ? <><br />النشاط: {agg[r.id].n} جلسة · {agg[r.id].ev} حدث · مدة التصفح {Math.round(agg[r.id].ms / 60000)} د</> : <><br />لم يُفتح بعد</>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => setReportFor(r)} style={{ display: "flex", alignItems: "center", gap: 5, border: "none", background: T.brass, color: T.onAccent || "#fff", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Activity size={12} /> تقرير النشاط</button>
              {(s.k === "active" || s.k === "expired" || s.k === "exhausted") && !r.revoked_at && <button onClick={() => extend(r, 1440)} style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${T.line}`, background: "none", color: T.paper, borderRadius: 9, padding: "7px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Clock size={12} /> +يوم</button>}
              {!r.revoked_at && <button onClick={() => addOpen(r)} style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${T.line}`, background: "none", color: T.paper, borderRadius: 9, padding: "7px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Plus size={12} /> فتحة</button>}
              <button onClick={() => clone(r)} style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${T.line}`, background: "none", color: T.paper, borderRadius: 9, padding: "7px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Copy size={12} /> نسخ الإعدادات</button>
              {s.k === "active" && <button onClick={() => revoke(r)} style={{ border: "1px solid #C0392B55", background: "#C0392B10", color: "#C0392B", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>إلغاء الآن</button>}
              <button onClick={() => remove(r)} style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${T.line}`, background: "none", color: T.muted, borderRadius: 9, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Trash2 size={12} /> حذف من السجل</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
