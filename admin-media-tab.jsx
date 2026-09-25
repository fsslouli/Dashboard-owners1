/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: admin-media-tab */
import { fmtAdminDate, useSystemTheme } from "./admin-core.jsx";
import { ABadge, ALocked, aNoteStyle } from "./admin-excel-utils.jsx";
import { supabase } from "./app-bootstrap.jsx";
import { DOCS } from "./site-data.jsx";
import { useEffect, useRef, useState } from "react";
import { autoTranslateAr } from "./translate-kit.js";
import { createYtPlayer, fmtDuration, loadYouTubeApi, parseYouTube, ytErrorText, ytShortUrl, ytThumb } from "./youtube-kit.js";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, Clapperboard, Eye, EyeOff, Link2, Pencil, Play, PlusCircle, Trash2, XCircle } from "lucide-react";

/* ═══ v2.9.0 — مقاطع النماذج ═══
   لكل نموذج (وللمخطط الرئيسي) مقطع يوتيوب واحد، يظهر أول صفحة بعارض النموذج في
   الموقع العام. التحقق يتم بمشغّل يوتيوب الرسمي نفسه داخل اللوحة — نفس ظروف
   الموقع العام بالضبط: لو اشتغل هنا يشتغل هناك. */
const MEDIA_LINK_HINT = {
  invalid: "ما قدرت أقرأ رقم مقطع من هذا الرابط.",
  not_youtube: "هذا مو رابط يوتيوب.",
  playlist: "هذا رابط قائمة تشغيل — افتح المقطع نفسه وانسخ رابطه.",
  channel: "هذا رابط قناة — افتح المقطع نفسه وانسخ رابطه.",
};
const toWesternDigits = (v) => String(v || "")
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

/* معاينة حيّة + فحص: يحمّل المقطع بمشغّل يوتيوب (بدون تشغيل)، ويقرأ العنوان والمدة،
   ويلتقط رفض يوتيوب (خاص/محذوف/التضمين ممنوع) قبل ما يوصل للزوّار */
function AYtPreview({ id, start, vertical, onCheck }) {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!id || !host) return;
    let alive = true, player = null, poll = null, settled = false;
    const report = (x) => { if (alive) onCheck({ ...x, id }); };
    report({ state: "checking" });
    const guard = setTimeout(() => { if (!settled) { settled = true; report({ state: "warn", reason: "timeout" }); } }, 12000);
    const mount = document.createElement("div");
    host.appendChild(mount);
    loadYouTubeApi().then((YT) => {
      if (!alive) return;
      player = createYtPlayer(YT, mount, {
        id, start, autoplay: false, lang: "ar", title: "معاينة المقطع",
        onReady: (e) => {
          let tries = 0;
          const tick = () => {
            if (!alive || settled) return;
            let title = "", dur = 0;
            try {
              const d = e.target.getVideoData ? e.target.getVideoData() : null;
              title = (d && d.title) || "";
              dur = Math.round(Number(e.target.getDuration ? e.target.getDuration() : 0) || 0);
            } catch (_) {}
            if ((title && dur > 0) || tries >= 14) {
              settled = true; clearTimeout(guard);
              report(title ? { state: "ok", title, duration: dur > 0 ? dur : null } : { state: "warn", reason: "no_meta" });
              return;
            }
            tries += 1; poll = setTimeout(tick, 350);
          };
          tick();
        },
        /* الخطأ يغلب دائمًا — حتى لو وصل بعد قراءة العنوان */
        onError: (e) => { settled = true; clearTimeout(guard); clearTimeout(poll); report({ state: "error", code: e.data }); },
      });
    }).catch(() => { if (!settled) { settled = true; clearTimeout(guard); report({ state: "warn", reason: "api" }); } });
    return () => {
      alive = false; clearTimeout(guard); clearTimeout(poll);
      try { if (player) player.destroy(); } catch (_) {}
      host.innerHTML = "";
    };
  }, [id, start]);
  return <div ref={hostRef} className="amv-prev" data-v={vertical ? "1" : "0"} />;
}

function amvToggle(T, on, onClick, children) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "start", border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass + "0D" : T.surface, borderRadius: 11, padding: "10px 12px", cursor: "pointer", width: "100%", color: T.paper, fontFamily: "inherit" }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${on ? T.brass : T.faint}`, background: on ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={13} color="#fff" />}</span>
      <span style={{ fontSize: 12.5 }}>{children}</span>
    </button>
  );
}

export function AMediaTab({ flashToast, log, canManage, canStats }) {
  const T = useSystemTheme();
  const [rows, setRows] = useState(null);           /* doc_id ← [صفوف مقاطعه بالترتيب] */
  const [plays, setPlays] = useState({});
  const [edit, setEdit] = useState(null);           /* مسودة المحرّر المفتوح: { docId, id|null, ... } */
  const [check, setCheck] = useState({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);   /* id المقطع المطلوب حذفه */
  const [prevKey, setPrevKey] = useState({ id: null, start: 0 });

  const load = async () => {
    const { data, error } = await supabase.from("model_videos").select("*").order("sort_order").order("id");
    if (error) { setRows({}); return; }
    const m = {};
    (data || []).forEach((r) => { (m[r.doc_id] || (m[r.doc_id] = [])).push(r); });
    setRows(m);
  };
  useEffect(() => {
    load();
    /* لو عدّل مشرف ثاني بنفس اللحظة، تتحدّث القائمة هنا بدون تحديث الصفحة */
    const ch = supabase.channel("admin-model-videos-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "model_videos_rev" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* عدد مرات تشغيل كل مقطع — من سجل الزيارات (يحتاج صلاحية التحليلات).
     المفتاح docId:youtubeId عشان يميّز مقطعين لنفس النموذج */
  useEffect(() => {
    if (!canStats || !rows) return;
    const list = Object.values(rows).flat();
    if (!list.length) { setPlays({}); return; }
    let alive = true;
    Promise.all(list.map((r) => supabase.from("logs").select("id", { count: "exact", head: true })
      .eq("category", "video_play").eq("value", r.doc_id).eq("extra", r.youtube_id)
      .then(({ count }) => [`${r.doc_id}:${r.youtube_id}`, count || 0])))
      .then((pairs) => { if (alive) setPlays(Object.fromEntries(pairs)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [rows, canStats]);

  const linkNow = edit ? parseYouTube(edit.link) : null;
  const liveId = linkNow && linkNow.ok ? linkNow.id : null;
  const liveStart = edit ? Math.min(86399, Math.max(0, Math.floor(Number(edit.start_s) || 0))) : 0;
  /* المعاينة تُعاد بعد ما توقف الكتابة — مو مع كل حرف */
  useEffect(() => {
    const t = setTimeout(() => setPrevKey({ id: liveId, start: liveStart }), 450);
    return () => clearTimeout(t);
  }, [liveId, liveStart]);

  if (!canManage) return <ALocked text="حسابك ما عنده صلاحية إدارة مقاطع النماذج." />;
  if (rows === null) return <div style={{ color: T.muted, fontSize: 13, padding: 20 }}>جارٍ التحميل...</div>;

  const docName = (id) => { const d = DOCS.find((x) => x.id === id); return d ? d.nameAr : id; };
  const startAdd = (doc) => {
    setConfirmDel(null);
    setCheck({ state: "idle" });
    setEdit({
      docId: doc.id, id: null,
      link: "", title_ar: "", title_en: "", start_s: "0",
      vertical: false, published: true,
      startTouched: false, verticalTouched: false,
    });
  };
  const openEditor = (doc, r) => {
    setConfirmDel(null);
    setCheck({ state: "idle" });
    setEdit({
      docId: doc.id, id: r.id,
      link: ytShortUrl(r.youtube_id, r.start_s),
      title_ar: r.title_ar || "", title_en: r.title_en || "",
      start_s: String(r.start_s || 0),
      vertical: !!r.vertical, published: !!r.published,
      startTouched: false, verticalTouched: false,
    });
  };
  const closeEditor = () => { setEdit(null); setCheck({ state: "idle" }); };
  /* لصق رابط جديد يعبّي وقت البداية (t=) والإطار الطولي (shorts) تلقائيًا —
     إلا لو المشرف عدّلهم يدويًا */
  const onLink = (v) => setEdit((e) => {
    const p = parseYouTube(v);
    const next = { ...e, link: v };
    if (p.ok) {
      if (!e.startTouched) next.start_s = String(p.start);
      if (!e.verticalTouched) next.vertical = p.vertical;
    }
    return next;
  });

  const verdict = check.id && liveId && check.id === liveId ? check : null;
  const checking = !!liveId && (!verdict || verdict.state === "checking");
  const blocked = !!verdict && verdict.state === "error";

  const save = async (force) => {
    const p = parseYouTube(edit.link);
    if (!p.ok || busy) return;
    if (blocked && !force) return;
    const list = rows[edit.docId] || [];
    const cur = edit.id ? list.find((x) => x.id === edit.id) : null;
    const sameVid = !!cur && cur.youtube_id === p.id;
    const meta = verdict && verdict.state === "ok" ? verdict : null;
    const row = {
      doc_id: edit.docId,
      youtube_id: p.id,
      title_ar: edit.title_ar.trim().slice(0, 140) || null,
      title_en: edit.title_en.trim().slice(0, 140) || null,
      yt_title: meta ? String(meta.title).slice(0, 300) : (sameVid ? cur.yt_title : null),
      duration_s: meta && meta.duration ? meta.duration : (sameVid ? cur.duration_s : null),
      start_s: liveStart,
      vertical: !!edit.vertical,
      published: !!edit.published,
    };
    setBusy(true);
    const { error } = edit.id
      ? await supabase.from("model_videos").update(row).eq("id", edit.id)
      : await supabase.from("model_videos").insert({ ...row, sort_order: list.length ? Math.max(...list.map((x) => x.sort_order || 0)) + 1 : 0 });
    setBusy(false);
    if (error) {
      flashToast(
        error.code === "23505" ? "هذا المقطع مضاف مسبقًا لنفس النموذج"
        : error.code === "42501" ? "حسابك ما عنده صلاحية إدارة المقاطع"
        : "تعذّر الحفظ — حاول مرة ثانية"
      );
      return;
    }
    log(edit.id ? "تعديل مقطع نموذج" : "إضافة مقطع نموذج", `${docName(edit.docId)} — youtu.be/${p.id}${row.published ? "" : " (مخفي)"}`);
    flashToast(row.published ? "انحفظ — ظهر للزوّار فورًا" : "انحفظ كمخفي — ما يظهر للزوّار");
    closeEditor();
    load();
  };
  const togglePub = async (r) => {
    const { error } = await supabase.from("model_videos").update({ published: !r.published }).eq("id", r.id);
    if (error) { flashToast("تعذّر التعديل — تأكد من صلاحيتك"); return; }
    log(r.published ? "إخفاء مقطع نموذج" : "إظهار مقطع نموذج", `${docName(r.doc_id)} — youtu.be/${r.youtube_id}`);
    flashToast(r.published ? "انخفى عن الزوّار" : "ظهر للزوّار");
    load();
  };
  const remove = async (r) => {
    const { error } = await supabase.from("model_videos").delete().eq("id", r.id);
    setConfirmDel(null);
    if (error) { flashToast("تعذّر الحذف — تأكد من صلاحيتك"); return; }
    log("حذف مقطع نموذج", `${docName(r.doc_id)} — youtu.be/${r.youtube_id}`);
    flashToast("انحذف المقطع");
    load();
  };
  /* ترتيب العرض: تبديل موضع مقطعين متجاورين — يعكس مباشرة ترتيبهم بالموقع العام */
  const move = async (list, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length || busy) return;
    const a = list[i], b = list[j];
    setBusy(true);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("model_videos").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("model_videos").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    setBusy(false);
    if (e1 || e2) { flashToast("تعذّر تغيير الترتيب — تأكد من صلاحيتك"); return; }
    load();
  };

  const inp = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, background: T.surface, color: T.paper, fontFamily: "inherit", outline: "none" };
  const lbl = { fontSize: 11.5, color: T.muted, display: "block", marginBottom: 5 };
  const iconBtn = (color, disabled) => ({ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer", color: disabled ? T.faint : (color || T.muted), flexShrink: 0, opacity: disabled ? 0.4 : 1 });
  const allList = Object.values(rows).flat();
  const shown = allList.filter((r) => r.published).length;

  /* نموذج الإضافة/التعديل — واحد فقط، يُستدعى إما لمقطع موجود أو لمقطع جديد */
  const renderEditor = (doc) => (
    <div style={{ marginTop: 10, background: T.sunken, borderRadius: 14, padding: 14, border: `1px solid ${T.brass}33` }}>
      <label style={lbl}>رابط المقطع على يوتيوب</label>
      <div style={{ position: "relative" }}>
        <Link2 size={14} color={T.faint} style={{ position: "absolute", top: 12, left: 12 }} />
        <input value={edit.link} onChange={(e) => onLink(e.target.value)} dir="ltr" autoFocus
          placeholder="https://youtu.be/…" spellCheck={false} autoComplete="off"
          style={{ ...inp, paddingLeft: 34, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }} />
      </div>
      <div style={{ fontSize: 11.5, marginTop: 6, minHeight: 16, lineHeight: 1.7, color: linkNow && !linkNow.ok && linkNow.reason !== "empty" ? "#C0392B" : T.muted }}>
        {!linkNow || linkNow.reason === "empty"
          ? "يقبل أي صيغة: youtu.be · watch · shorts · live · embed — أو كود التضمين كامل."
          : !linkNow.ok
            ? (MEDIA_LINK_HINT[linkNow.reason] || MEDIA_LINK_HINT.invalid)
            : <>رقم المقطع: <span className="mono" dir="ltr">{linkNow.id}</span>{linkNow.kind === "shorts" && " · مقطع عمودي (Shorts)"}</>}
      </div>

      {prevKey.id && (
        <div style={{ marginTop: 12 }}>
          <AYtPreview key={`${prevKey.id}:${prevKey.start}`} id={prevKey.id} start={prevKey.start} vertical={edit.vertical} onCheck={setCheck} />
          {liveId && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, fontSize: 12, lineHeight: 1.75 }}>
              {checking ? (
                <><span className="amv-spin" style={{ color: T.muted, marginTop: 4 }} /><span style={{ color: T.muted }}>جارٍ التحقق إن المقطع يشتغل داخل الموقع…</span></>
              ) : verdict.state === "ok" ? (
                <><CheckCircle2 size={15} color="#1E8E5A" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span><b style={{ color: "#1E8E5A" }}>يشتغل داخل الموقع</b> — {verdict.title}{verdict.duration ? <> · <span dir="ltr">{fmtDuration(verdict.duration)}</span></> : null}</span></>
              ) : verdict.state === "error" ? (
                <><XCircle size={15} color="#C0392B" style={{ flexShrink: 0, marginTop: 2 }} /><span style={{ color: "#C0392B" }}>{ytErrorText(verdict.code)}</span></>
              ) : (
                <><AlertTriangle size={15} color="#B8790F" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: "#B8790F" }}>ما قدرت أتحقق من المقطع الآن{verdict.reason === "api" ? " (مشغّل يوتيوب ما تحمّل — إضافة حجب أو شبكة)" : ""}. تقدر تحفظ، وتأكد من العرض بالموقع بعدها.</span></>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 14 }}>
        <div>
          <label style={lbl}>العنوان للزوّار — عربي (اختياري)</label>
          <input value={edit.title_ar} maxLength={140}
            onChange={(e) => setEdit((x) => ({ ...x, title_ar: e.target.value }))}
            onBlur={async (e) => {
              if (edit.title_en.trim()) return;
              const en = await autoTranslateAr(supabase, e.target.value);
              if (en) setEdit((x) => ({ ...x, title_en: en }));
            }}
            placeholder={(verdict && verdict.title) || `جولة مرئية — ${doc.nameAr}`} style={inp} />
        </div>
        <div>
          <label style={lbl}>Title — English (optional)</label>
          <input value={edit.title_en} maxLength={140} dir="ltr" onChange={(e) => setEdit((x) => ({ ...x, title_en: e.target.value }))}
            placeholder={(verdict && verdict.title) || `Video tour — ${doc.nameEn}`} style={inp} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ width: 150 }}>
          <label style={lbl}>يبدأ من (بالثواني)</label>
          <input value={edit.start_s} inputMode="numeric" dir="ltr"
            onChange={(e) => { const v = toWesternDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 5); setEdit((x) => ({ ...x, start_s: v, startTouched: true })); }}
            style={inp} />
        </div>
        <div style={{ fontSize: 11.5, color: T.faint, paddingBottom: 11 }}>{liveStart > 0 ? <span dir="ltr">= {fmtDuration(liveStart)}</span> : "من البداية"}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {amvToggle(T, edit.vertical, () => setEdit((x) => ({ ...x, vertical: !x.vertical, verticalTouched: true })), "مقطع عمودي (Shorts) — يُعرض بإطار طولي")}
        {amvToggle(T, edit.published, () => setEdit((x) => ({ ...x, published: !x.published })), "ظاهر للزوّار — لو ألغيته ينحفظ المقطع مخفيًا")}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        {blocked ? (
          <button onClick={() => save(true)} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 7, background: "#B8790F", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>
            <AlertTriangle size={15} /> حفظ رغم التحذير
          </button>
        ) : (
          <button onClick={() => save(false)} disabled={busy || !liveId || checking}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "#1E8E5A", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy || !liveId || checking ? 0.55 : 1 }}>
            <Check size={15} /> {busy ? "جارٍ الحفظ…" : edit.published ? "حفظ ونشر" : "حفظ كمخفي"}
          </button>
        )}
        <button onClick={closeEditor} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, cursor: "pointer" }}>إلغاء</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
.amv-prev{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;}
.amv-prev[data-v="1"]{aspect-ratio:9/16;max-width:240px;margin:0 auto;}
.amv-prev iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}
@keyframes amvspin{to{transform:rotate(360deg);}}
.amv-spin{width:12px;height:12px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;display:inline-block;animation:amvspin .8s linear infinite;flex:none;}
      `}</style>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clapperboard size={16} color={T.brass} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>مقاطع النماذج</span>
          <span style={{ marginInlineStart: "auto", fontSize: 11.5, color: T.muted }}>{shown} ظاهر · {allList.length - shown} مخفي</span>
        </div>
        <p style={{ fontSize: 12, color: T.muted, margin: "8px 0 0", lineHeight: 1.8 }}>
          كل نموذج يقدر ياخذ أكثر من مقطع — تظهر بعارض النموذج في الموقع العام بنفس الترتيب اللي تحدده هنا، قبل الواجهة والمخططات والبرشور. الحفظ يوصل لكل الزوّار فورًا.
        </p>
        <div style={{ ...aNoteStyle(T), marginTop: 12 }}>
          ارفع المقطع بخصوصية <b>«غير مدرج» (Unlisted)</b> لو ما تبيه يظهر بقناتك — يشتغل بالموقع عادي.
          أما <b>«خاص» (Private)</b> فما يشتغل خارج يوتيوب. وتأكد إن <b>«السماح بالتضمين»</b> مفعّل بإعدادات المقطع.
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 8 }}>
        {DOCS.map((doc, di) => {
          const list = rows[doc.id] || [];
          const addingHere = !!edit && edit.docId === doc.id && edit.id === null;
          return (
            <div key={doc.id} style={{ borderTop: di ? `1px solid ${T.line}` : "none", padding: "12px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{doc.nameAr} <span style={{ fontSize: 11, color: T.faint, fontWeight: 400 }}>{doc.subAr}</span></div>
                <span style={{ fontSize: 11, color: T.faint }}>{list.length ? `${list.length} مقطع` : "بلا مقاطع"}</span>
                <button onClick={() => startAdd(doc)} style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 5, background: "none", color: T.brass, border: `1px solid ${T.brass}55`, borderRadius: 9, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                  <PlusCircle size={12} /> إضافة مقطع
                </button>
              </div>

              {list.map((r, i) => {
                const editing = !!edit && edit.id === r.id;
                return (
                  <div key={r.id} style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                        <button onClick={() => move(list, i, -1)} disabled={i === 0} title="نقل للأعلى" aria-label="نقل للأعلى" style={{ ...iconBtn(null, i === 0), width: 22, height: 16, border: "none" }}><ChevronUp size={13} /></button>
                        <button onClick={() => move(list, i, 1)} disabled={i === list.length - 1} title="نقل للأسفل" aria-label="نقل للأسفل" style={{ ...iconBtn(null, i === list.length - 1), width: 22, height: 16, border: "none" }}><ChevronDown size={13} /></button>
                      </div>
                      <div style={{ position: "relative", width: 88, height: 50, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: T.sunken, border: `1px solid ${T.line}` }}>
                        <img src={ytThumb(r.youtube_id, "mqdefault")} alt="" loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: r.published ? 1 : 0.45 }} />
                        <span style={{ position: "absolute", inset: 0, margin: "auto", width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Play size={10} fill="currentColor" strokeWidth={0} />
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, color: T.muted, display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center" }}>
                          {r.published ? <ABadge kind="ok">ظاهر للزوّار</ABadge> : <ABadge kind="change">مخفي</ABadge>}
                          {r.duration_s > 0 && <span className="mono" dir="ltr">{fmtDuration(r.duration_s)}</span>}
                          {canStats && plays[`${r.doc_id}:${r.youtube_id}`] != null && <span>{plays[`${r.doc_id}:${r.youtube_id}`]} تشغيل</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title_ar || r.yt_title || "بلا عنوان"}</div>
                        <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>آخر تعديل: {r.updated_by || "—"} · {fmtAdminDate(r.updated_at)}</div>
                      </div>
                      {!editing && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => openEditor(doc, r)} title="تعديل" aria-label="تعديل" style={iconBtn(T.brass)}><Pencil size={13} /></button>
                          <button onClick={() => togglePub(r)} title={r.published ? "إخفاء عن الزوّار" : "إظهار للزوّار"} aria-label={r.published ? "إخفاء عن الزوّار" : "إظهار للزوّار"} style={iconBtn()}>
                            {r.published ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          {confirmDel === r.id ? (
                            <>
                              <button onClick={() => remove(r)} style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "0 10px", fontSize: 11.5, cursor: "pointer" }}>تأكيد</button>
                              <button onClick={() => setConfirmDel(null)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "0 10px", fontSize: 11.5, cursor: "pointer", color: T.muted }}>لا</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDel(r.id)} title="حذف المقطع" aria-label="حذف المقطع" style={iconBtn("#C0392B")}><Trash2 size={13} /></button>
                          )}
                        </div>
                      )}
                    </div>
                    {editing && renderEditor(doc)}
                  </div>
                );
              })}

              {addingHere && renderEditor(doc)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
