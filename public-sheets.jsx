/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: public-sheets */
import { logEvent } from "./app-bootstrap.jsx";
import { CHANGELOG, LEGAL_COPY } from "./changelog-legal-data.jsx";
import { EMPTY_F, passesFilters } from "./public-site.jsx";
import { DOC_BASE, DOC_COLORS, ZONES, hashPick, trCat, trLoc, trMeeting, trModel, trMonth, trNote, trOwn, trPGLabel, trPri, trReply, trScope, trSta, trZone, useLang, useT } from "./site-data.jsx";
import { useBackClose, useInView, usePrefersReduced } from "./site-hooks.jsx";
import { CatPill, Chip, LangToggle, Select } from "./ui-atoms.jsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { bestYtPoster, createYtPlayer, fmtDuration, loadYouTubeApi, warmYouTube, ytPlainIframe, ytThumb, ytWatchUrl } from "./youtube-kit.js";
import { AlertTriangle, Calendar, Check, ChevronLeft, ChevronRight, Droplet, ExternalLink, Hash, History, Home, Layers, Play, RotateCcw, Ruler, Search, Share2, ShieldAlert, Sparkles, Tag, ThumbsDown, ThumbsUp, User, X } from "lucide-react";

/* ── ١١. الإقرار القانوني ولوحة سجل التحديثات ── */
export function LegalDisclaimer({ onAgree: onAgreeParent }) {
  const { T } = useT();
  const { lang } = useLang();
  const [agreed, setAgreed] = useState(false);
  if (agreed) return null;
  const c = LEGAL_COPY[lang];
  const onAgree = () => { setAgreed(true); onAgreeParent?.(); };
  return (
    <div className="ovl lgl-ovl" data-modal="legal" style={{ zIndex: 90 }}>
      <div className="sheet lgl" data-sheet="legal" style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <div className="sheet-top lgl-top" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-2">
            <span style={{
              width: 36, height: 36, borderRadius: 11, background: T.brass + "14",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            }}>
              <ShieldAlert size={17} color={T.brass} />
            </span>
            <div>
              <div className="eyebrow">{c.eyebrow}</div>
              <div className="sec-t" style={{ marginTop: 2 }}>{c.title}</div>
            </div>
          </div>
          <LangToggle />
        </div>
        <div className="sheet-body lgl-body">
          {c.points.map(([label, body], i) => (
            <div className="lgl-pt" key={i} style={{ marginBottom: i < c.points.length - 1 ? 18 : 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.paper, marginBottom: 5 }}>{label}</div>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: T.muted, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
        <div className="lgl-foot" style={{ padding: "18px 19px 22px", borderTop: `1px solid ${T.line}`, background: T.sunken }}>
          <p style={{ fontSize: 11.5, lineHeight: 1.8, color: T.faint, margin: "0 0 14px" }}>{c.consent}</p>
          <button onClick={onAgree} className="big-btn lgl-agree" style={{ marginTop: 0 }}>{c.agree}</button>
        </div>
      </div>
    </div>
  );
}

export function ChangelogSheet({ open, onClose }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  useBackClose(open, onClose);
  if (!open) return null;
  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <div className="sheet-top">
          <div className="flex items-center gap-2">
            <span style={{
              width: 36, height: 36, borderRadius: 11, background: T.brass + "14",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            }}>
              <History size={17} color={T.brass} />
            </span>
            <div className="sec-t">{L("سجل إصدارات الموقع", "Site Update Log")}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={L("إغلاق", "Close")}><X size={16} /></button>
        </div>
        <div className="sheet-body">
          {CHANGELOG.map((entry, i) => (
            <div key={i} style={{ marginBottom: i < CHANGELOG.length - 1 ? 22 : 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: T.brass }}>v{entry.version}</span>
                <span className="mono" style={{ fontSize: 12, color: T.muted }}>
                  {lang === "en" ? entry.dateEn : entry.dateAr}
                </span>
              </div>
              <ul style={{
                margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.9, color: T.paper,
              }}>
                {(lang === "en" ? entry.en : entry.ar).map((line, j) => (<li key={j}>{line}</li>))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── لوحة "الفلاتر والترتيب" — كل معايير التصفية بمكان واحد بدل صندوق طويل فوق
   لوحة المتابعة. الاختيارات هنا مسودة محلية ولا تُطبَّق على النتائج الفعلية إلا
   بالضغط على "عرض النتائج"، فتقدر تجرّب عدة خيارات مرة وحدة بدل ما تعيد القائمة
   رسم نفسها مع كل ضغطة. نص البحث يبقى خارج اللوحة ويشتغل فورًا كالمعتاد. ── */
export function FiltersSheet({ open, onClose, f, sort, onApply, cats, ALL, nq, nqId, urgentCount, importantCount, newCount, openCount }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const staC = (s) => T.sta[s] || hashPick(s, T.extra);
  const [draft, setDraft] = useState(f);
  const [draftSort, setDraftSort] = useState(sort);
  const [scrolled, setScrolled] = useState(false);

  useBackClose(open, onClose);
  /* مزامنة المسودة من الفلاتر الفعلية المطبّقة في كل مرة تُفتح فيها اللوحة —
     عشان لو انفتحت بعد تغيّر الفلاتر من مكان ثاني (مثل روابط النظرة العامة) تبدأ صح */
  useEffect(() => {
    if (!open) return;
    setDraft(f); setDraftSort(sort); setScrolled(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const dtoggle = (k, v) => setDraft((p) => ({ ...p, [k]: p[k] === v ? (typeof v === "boolean" ? !v : null) : v }));
  const dval = (k, v) => setDraft((p) => ({ ...p, [k]: v }));
  const draftCount = Object.entries(draft).filter(([k, v]) => k !== "q" && (typeof v === "boolean" ? v : v != null)).length;
  const previewCount = ALL.filter((r) => passesFilters(r, draft, nq, nqId)).length;

  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }} role="dialog" aria-modal="true">
        <div className="sheet-top" data-scrolled={scrolled ? "1" : "0"}>
          <div>
            <div className="sec-t">{L("تخصيص البحث", "Customize Search")}</div>
            <div className="eyebrow" style={{ marginTop: 3 }}>{L("اختر المعايير ثم اعرض النتيجة", "Pick your criteria, then show the results")}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={L("إغلاق", "Close")}><X size={16} /></button>
        </div>

        <div className="sheet-body" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
          <div className="sec-lbl">{L("الحالة", "Status")}</div>
          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            {cats.sta.map((s) => (
              <Chip key={s} on={draft.sta === s} onClick={() => dtoggle("sta", s)} color={staC(s)}
                count={ALL.filter((r) => r.sta === s).length}>{trSta(lang, s)}</Chip>
            ))}
          </div>

          <div className="sec-lbl" style={{ marginTop: 24 }}>{L("تمييز", "Flags")}</div>
          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            <Chip on={draft.open} onClick={() => dtoggle("open", true)} color={T.brass} count={openCount}>{L("مفتوحة", "Open")}</Chip>
            <Chip on={draft.fresh} onClick={() => dtoggle("fresh", true)} color={T.sta["معتمدة"]} count={newCount}>{L("الجديد", "New")}</Chip>
            {importantCount > 0 && (
              <Chip on={draft.important} onClick={() => dtoggle("important", true)} color="#C0392B" count={importantCount}>{L("مهم", "Important")}</Chip>
            )}
            {urgentCount > 0 && (
              <Chip on={draft.urgent} onClick={() => dtoggle("urgent", true)} color="#B8790F" count={urgentCount}>{L("يجب الاطلاع", "Needs review")}</Chip>
            )}
          </div>

          <div className="sec-lbl" style={{ marginTop: 24 }}>{L("الأولوية", "Priority")}</div>
          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            {cats.pri.map((p) => (
              <Chip key={p} on={draft.pri === p} onClick={() => dtoggle("pri", p)}
                count={ALL.filter((r) => r.pri === p).length}>{trPri(lang, p)}</Chip>
            ))}
          </div>

          <div className="sec-lbl" style={{ marginTop: 24 }}>{L("الترتيب", "Sort")}</div>
          <Select block value={draftSort} onChange={(v) => setDraftSort(v || "id")} placeholder={L("ترتيب", "Sort")} icon={Hash}
            options={[
              { v: "id", l: L("الأرقام: الأحدث أولاً", "Number: newest first") },
              { v: "date", l: L("الأحدث أولاً (بالتاريخ)", "Newest first (by date)") },
              { v: "new", l: L("الجديد أولاً", "New first") },
              { v: "pri", l: L("الأولوية أولاً", "Priority first") },
              { v: "open", l: L("المفتوحة أولاً", "Open first") },
            ]} />

          <div className="sec-lbl" style={{ marginTop: 24 }}>{L("التصنيف والنموذج", "Category & Model")}</div>
          <div className="filt-grid">
            <Select block value={draft.cat} onChange={(v) => dval("cat", v)} placeholder={L("كل الفئات", "All categories")} icon={Tag}
              options={cats.cat.map((c) => ({ v: c, l: `${trCat(lang, c)} (${ALL.filter((r) => r.cat === c).length})` }))} />
            <Select block value={draft.model} onChange={(v) => dval("model", v)} placeholder={L("كل النماذج", "All models")} icon={Home}
              options={cats.models.map((m) => ({ v: m, l: `${trModel(lang, m)} (${ALL.filter((r) => r.models.includes(m)).length})` }))} />
          </div>

          <div className="sec-lbl" style={{ marginTop: 24 }}>{L("الموقع والمجيب", "Location & Engineer")}</div>
          <div className="filt-grid">
            <Select block value={draft.zone} onChange={(v) => dval("zone", v)} placeholder={L("كل المواقع", "All locations")} icon={Layers}
              options={ZONES.filter((z) => ALL.some((r) => r.zone === z.key)).map((z) => ({ v: z.key, l: trZone(lang, z.key) }))} />
            <Select block value={draft.own} onChange={(v) => dval("own", v)} placeholder={L("كل المجيبين", "All engineers")} icon={User}
              options={cats.owners.map((m) => ({ v: m, l: trOwn(lang, m) }))} />
          </div>

          <div className="sec-lbl" style={{ marginTop: 24 }}>{L("التوقيت", "Timing")}</div>
          <Select block value={draft.mon} onChange={(v) => dval("mon", v)} placeholder={L("كل الأشهر", "All months")} icon={Calendar}
            options={cats.months.map((m) => ({ v: m, l: trMonth(lang, m) }))} />
          {cats.meetings.length > 0 && (
            <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 10 }}>
              {cats.meetings.map((m) => (
                <Chip key={m} on={draft.meeting === m} onClick={() => dtoggle("meeting", m)} color={T.zone}>
                  {`${trMeeting(lang, m)} (${ALL.filter((r) => (r.meetings && r.meetings.length ? r.meetings : [r.meeting]).includes(m)).length})`}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="sheet-foot">
          <button className="wide-btn" style={{ margin: 0, flex: 1 }} onClick={() => { setDraft(EMPTY_F); setDraftSort("id"); }}>
            <RotateCcw size={13} /> {L("مسح الكل", "Clear all")}{draftCount > 0 ? ` (${draftCount})` : ""}
          </button>
          <button className="big-btn" style={{ margin: 0, flex: 2 }} onClick={() => { onApply(draft, draftSort); onClose(); }}>
            <Search size={15} /> {L(`عرض ${previewCount} نتيجة`, `Show ${previewCount} results`)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── v2.9.0 — مقطع النموذج داخل عارض المستندات ──
   قبل الضغط: صورة المقطع فقط — صفر سكربتات من يوتيوب وصفر كوكيز. عند الضغط يُحمَّل
   مشغّل يوتيوب الرسمي ويبدأ التشغيل بضغطة وحدة (حتى على سفاري والجوال). بعد بدء
   التشغيل ما يغطي المشغّل أي عنصر — شرط من شروط يوتيوب للتضمين. */
function VideoStage({ video, docId, docName, accent, lang }) {
  const L = (ar, en) => (lang === "en" ? en : ar);
  const yid = video.youtube_id;
  const start = Number(video.start_s) || 0;
  const [on, setOn] = useState(false);
  const [err, setErr] = useState(null);
  const [poster, setPoster] = useState(null);
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const loggedRef = useRef(false);
  const title = (lang === "en" ? video.title_en : video.title_ar) || video.yt_title
    || L(`جولة مرئية — ${docName}`, `Video tour — ${docName}`);

  /* صورة hqdefault تظهر فورًا، وتُستبدل بأعلى دقة متوفرة لهذا المقطع لما توصل */
  useEffect(() => bestYtPoster(yid, setPoster), [yid]);
  /* فتح صفحة المقطع = غالبًا بيشغّله — نسخّن الاتصالات (DNS/TLS فقط، بدون تحميل شي) */
  useEffect(() => { warmYouTube(); }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!on || !host) return;
    let alive = true;
    const markPlay = () => {
      if (loggedRef.current) return;
      loggedRef.current = true;
      logEvent("nav", "video_play", docId, yid);
    };
    const frameTitle = `${title} — YouTube`;
    loadYouTubeApi().then((YT) => {
      if (!alive) return;
      const mount = document.createElement("div");
      host.appendChild(mount);
      playerRef.current = createYtPlayer(YT, mount, {
        id: yid, start, autoplay: true, lang, title: frameTitle,
        onReady: (e) => { try { e.target.playVideo(); } catch (_) {} },
        onState: (e) => { if (e.data === 1) markPlay(); },
        onError: (e) => { if (alive) setErr(e.data); },
      });
    }).catch(() => {
      /* مشغّل يوتيوب الرسمي محجوب أو تأخّر (إضافة/شبكة): نضمّن مباشرة — يشتغل،
         لكن على بعض الجوالات قد يحتاج ضغطة ثانية */
      if (!alive) return;
      host.appendChild(ytPlainIframe(yid, { start, autoplay: true, lang, title: frameTitle }));
      markPlay();
    });
    return () => {
      alive = false;
      try { if (playerRef.current) playerRef.current.destroy(); } catch (_) {}
      playerRef.current = null;
      host.innerHTML = "";
    };
  }, [on, yid]);

  return (
    <div className={`vs ${video.vertical ? "vs-v" : "vs-h"}`}>
      <div className="vs-frame" style={{ backgroundImage: `url("${poster || ytThumb(yid)}")` }}>
        <div className="vs-host" ref={hostRef} />
        {!on && (
          <button
            type="button" className="vs-poster"
            onClick={() => setOn(true)}
            onPointerEnter={warmYouTube} onFocus={warmYouTube}
            aria-label={L(`تشغيل: ${title}`, `Play: ${title}`)}
          >
            <span className="vs-play" style={{ color: accent }}>
              <Play size={30} fill="currentColor" strokeWidth={0} />
            </span>
            <span className="vs-cap">
              <span className="vs-kicker">{L("جولة مرئية", "Video tour")}</span>
              <span className="vs-title">{title}</span>
            </span>
            {video.duration_s > 0 && <span className="vs-dur mono">{fmtDuration(video.duration_s)}</span>}
          </button>
        )}
      </div>
      {err != null && (
        <div className="vs-err" role="status">
          <AlertTriangle size={14} />
          <span>{L("تعذّر تشغيل المقطع داخل الموقع.", "This video can't play here.")}</span>
          <a href={ytWatchUrl(yid, start)} target="_blank" rel="noopener">
            {L("شاهده على يوتيوب", "Watch on YouTube")} <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}

/* ── عارض المخططات — ملء الشاشة، تكبير بالإصبعين/نقرتين، تنقّل بين الصفحات ── */
export function DocViewerSheet({ doc, videos, onClose }) {
  const { T, resolved } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const stageRef = useRef(null);
  const chipsRef = useRef(null);
  const natRef = useRef({ w: 4, h: 3 });
  const ptrs = useRef(new Map());
  const ges = useRef(null);
  const lastTap = useRef(0);
  useBackClose(!!doc, onClose);

  useEffect(() => {
    if (!doc) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [doc]);

  const docId = doc ? doc.id : null;
  /* v2.9.0 (وسّعناها v2.9.2 لأكثر من مقطع) — لو للنموذج مقاطع منشورة، تصير أول
     «صفحات» بالعارض بترتيبها (قبل الواجهة والمخططات)، وبقية الصفحات كما هي بالضبط.
     المقطع مو صورة: ما عليه تكبير ولا سحب. */
  const vidList = doc && videos ? videos : [];
  const vidCount = vidList.length;
  const pages = !doc ? [] : [
    ...vidList.map((v, i) => ({
      f: `video:${v.id}`, video: true, v,
      ar: vidCount > 1 ? `جولة مرئية ${i + 1}` : "جولة مرئية",
      en: vidCount > 1 ? `Video tour ${i + 1}` : "Video tour",
    })),
    ...doc.pages,
  ];
  const page = pages[idx] || null;
  const isVid = !!(page && page.video);

  const hadVidCount = useRef(vidCount);
  useEffect(() => { setIdx(0); hadVidCount.current = vidCount; }, [docId]);
  /* انضاف أو انشال مقطع والعارض مفتوح (تحديث لحظي من الإدارة): نزيح المؤشر
     عشان تبقى نفس اللوحة المعروضة قدام الزائر بدل ما تقفز لغيرها */
  useEffect(() => {
    if (hadVidCount.current === vidCount) return;
    setIdx((i) => Math.max(0, i + (vidCount - hadVidCount.current)));
    hadVidCount.current = vidCount;
  }, [vidCount]);
  useEffect(() => { setZ({ s: 1, x: 0, y: 0 }); setLoaded(false); }, [docId, idx]);

  useEffect(() => {
    if (!docId || !pages[idx]) return;
    /* ترقيم اللوحات في السجل يبقى كما كان قبل المقاطع (١ = الواجهة دائمًا) —
       عشان تحليلات الزيارات السابقة واللاحقة تبقى قابلة للمقارنة */
    logEvent("nav", "doc_page", pages[idx].video ? `${docId}:video` : `${docId}:${idx + 1 - vidCount}`, null);
    [idx - 1, idx + 1].forEach((i) => {
      if (i >= 0 && i < pages.length && !pages[i].video) { const im = new window.Image(); im.src = DOC_BASE + pages[i].f; }
    });
    const el = chipsRef.current && chipsRef.current.querySelector(".dvw-chip.on");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [docId, idx]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(pages.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    if (doc) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, pages.length]);

  if (!doc || !page) return null;

  const box = () => {
    const el = stageRef.current;
    const cw = el ? el.clientWidth : 1, ch = el ? el.clientHeight : 1;
    const n = natRef.current;
    const k = Math.min(cw / n.w, ch / n.h);
    return { w: n.w * k, h: n.h * k, cw, ch };
  };
  const clamp = (st) => {
    const b = box();
    const mx = Math.max(0, (b.w * st.s - b.cw) / 2);
    const my = Math.max(0, (b.h * st.s - b.ch) / 2);
    return { s: st.s, x: Math.min(mx, Math.max(-mx, st.x)), y: Math.min(my, Math.max(-my, st.y)) };
  };
  const rel = (e) => {
    const el = stageRef.current; if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };
  const zoomAt = (p, target) => {
    if (target <= 1) return setZ({ s: 1, x: 0, y: 0 });
    const u = { x: (p.x - z.x) / z.s, y: (p.y - z.y) / z.s };
    setZ(clamp({ s: target, x: p.x - target * u.x, y: p.y - target * u.y }));
  };
  const go = (d) => setIdx((i) => Math.max(0, Math.min(pages.length - 1, i + d)));

  const onDown = (e) => {
    if (stageRef.current && stageRef.current.setPointerCapture) {
      try { stageRef.current.setPointerCapture(e.pointerId); } catch (_) {}
    }
    ptrs.current.set(e.pointerId, rel(e));
    if (ptrs.current.size === 1) {
      const p = rel(e);
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0; ges.current = null;
        zoomAt(p, z.s > 1.2 ? 1 : 2.6);
        return;
      }
      lastTap.current = now;
      ges.current = { mode: "pan", p0: p, t0: { ...z }, swipe: 0 };
    } else if (ptrs.current.size === 2) {
      const v = [...ptrs.current.values()];
      ges.current = {
        mode: "pinch",
        d0: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1,
        m0: { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 },
        t0: { ...z },
      };
    }
  };
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, rel(e));
    const g = ges.current; if (!g) return;
    if (g.mode === "pinch" && ptrs.current.size >= 2) {
      const v = [...ptrs.current.values()];
      const d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1;
      const m = { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 };
      const s = Math.min(6, Math.max(1, g.t0.s * (d / g.d0)));
      const k = s / g.t0.s;
      setZ(clamp({ s, x: m.x - k * (g.m0.x - g.t0.x), y: m.y - k * (g.m0.y - g.t0.y) }));
    } else if (g.mode === "pan") {
      const p = rel(e);
      const dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      if (g.t0.s > 1.01) setZ(clamp({ s: g.t0.s, x: g.t0.x + dx, y: g.t0.y + dy }));
      else g.swipe = dx;
    }
  };
  const onUp = (e) => {
    ptrs.current.delete(e.pointerId);
    const g = ges.current;
    if (g && g.mode === "pan" && ptrs.current.size === 0 && g.t0.s <= 1.01 && Math.abs(g.swipe) > 55) {
      go(g.swipe < 0 ? 1 : -1);
    }
    if (ptrs.current.size === 0) ges.current = null;
    else if (ptrs.current.size === 1) {
      const v = [...ptrs.current.values()];
      ges.current = { mode: "pan", p0: v[0], t0: { ...z }, swipe: 0 };
    }
  };
  const onWheel = (e) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 4) return;
    if (e.cancelable) e.preventDefault();
    zoomAt(rel(e), Math.min(6, Math.max(1, z.s * (e.deltaY < 0 ? 1.15 : 0.87))));
  };

  const zoomed = z.s > 1.01;
  const Prev = lang === "en" ? ChevronLeft : ChevronRight;
  const Next = lang === "en" ? ChevronRight : ChevronLeft;

  return (
    <div className="dvw" role="dialog" aria-modal="true">
      <div className="dvw-top">
        <button onClick={onClose} className="dvw-ico" aria-label={L("إغلاق", "Close")}><X size={17} /></button>
        <div className="dvw-title">
          <div className="dvw-name">{L(doc.nameAr, doc.nameEn)}</div>
          <div className="dvw-page">{L(page.ar, page.en)} · {idx + 1}/{pages.length}</div>
        </div>
        {zoomed && (
          <button onClick={() => setZ({ s: 1, x: 0, y: 0 })} className="dvw-ico" aria-label={L("إعادة الضبط", "Reset")}>
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      {isVid ? (
        <div className="dvw-stage is-video" ref={stageRef}>
          <VideoStage
            key={`${doc.id}:${page.v.id}`}
            video={page.v} docId={doc.id} lang={lang}
            docName={L(doc.nameAr, doc.nameEn)}
            accent={doc.color ? DOC_COLORS.light[doc.color] : "#0C1519"}
          />
        </div>
      ) : (
      <div
        className="dvw-stage" ref={stageRef}
        onPointerDown={onDown} onPointerMove={onMove}
        onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
      >
        {!loaded && <span className="dvw-spin" />}
        <img
          key={page.f}
          className="dvw-img"
          src={DOC_BASE + page.f}
          alt={L(page.ar, page.en)}
          draggable={false}
          onLoad={(e) => {
            natRef.current = { w: e.target.naturalWidth || 4, h: e.target.naturalHeight || 3 };
            setLoaded(true);
          }}
          style={{
            transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`,
            transition: ges.current ? "none" : "transform .2s ease-out",
            opacity: loaded ? 1 : 0,
          }}
        />
      </div>
      )}

      <div className="dvw-bot">
        {pages.length > 1 && (
          <div className="dvw-nav">
            <button className="dvw-ico" onClick={() => go(-1)} disabled={idx === 0} aria-label={L("السابق", "Previous")}>
              <Prev size={16} />
            </button>
            <div className="dvw-chips" ref={chipsRef}>
              {pages.map((p, i) => (
                <button key={p.f} className={`dvw-chip${i === idx ? " on" : ""}${p.video ? " is-video" : ""}`} onClick={() => setIdx(i)}>
                  {p.video && <Play size={10} fill="currentColor" strokeWidth={0} />}
                  {L(p.ar, p.en)}
                </button>
              ))}
            </div>
            <button className="dvw-ico" onClick={() => go(1)} disabled={idx === pages.length - 1} aria-label={L("التالي", "Next")}>
              <Next size={16} />
            </button>
          </div>
        )}
        <div className="dvw-foot">
          <span>{isVid
            ? L("يُعرض عبر يوتيوب داخل الموقع", "Plays via YouTube, right here")
            : L("قرّب بإصبعين أو انقر مرتين للتكبير", "Pinch or double-tap to zoom")}</span>
          <span className="dvw-links">
            {isVid && (
              <a
                href={ytWatchUrl(page.v.youtube_id, page.v.start_s)} target="_blank" rel="noopener"
                onClick={() => logEvent("nav", "video_external", doc.id, page.v.youtube_id)}
              >
                <ExternalLink size={12} /> YouTube
              </a>
            )}
            <a
              href={DOC_BASE + doc.pdf} target="_blank" rel="noopener noreferrer"
              onClick={() => logEvent("nav", "doc_open_external", doc.id, null)}
            >
              <ExternalLink size={12} /> {L("الملف الأصلي PDF", "Original PDF")}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── ١٢. لوحة تفاصيل الاستفسار (Sheet) ── */
export function Sheet({ r, navList, onJump, onClose }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const [shareCopied, setShareCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // "up" | "down" | null — محلي فقط للعرض، لا يُقرأ من القاعدة
  useBackClose(!!r, onClose);

  /* يقفل تمرير الصفحة الخلفية أثناء فتح اللوحة — يمنع تمرير الصفحة الأصلية بالتوازي مع
     تمرير محتوى اللوحة، وهو سبب ظهور شريط الأزرار العلوي (X، التنقّل) بموضع غير متزامن
     ويصعّب الوصول له على الجوال (خصوصًا سفاري).
     ملاحظة v2.8.2: السبب الأساسي لاختفاء الرأس كان ارتفاع اللوحة المحسوب بـ vh — عولج بالـ CSS
     (.sheet و .sheet-detail)؛ هذا القفل يبقى كطبقة حماية إضافية. */
  useEffect(() => {
    if (!r) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [!!r]);

  const idx = r && navList ? navList.findIndex((x) => x.id === r.id) : -1;
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < (navList ? navList.length - 1 : -1);
  /* تتبع صامت: التنقّل سابق/تالي بين الاستفسارات (بالزر أو بالسحب أو بالسهم) */
  const goPrev = () => {
    if (!hasPrev) return;
    logEvent("nav", r.id, "prev", navList[idx - 1]?.id ?? null);
    onJump(navList[idx - 1]);
  };
  const goNext = () => {
    if (!hasNext) return;
    logEvent("nav", r.id, "next", navList[idx + 1]?.id ?? null);
    onJump(navList[idx + 1]);
  };

  useEffect(() => {
    if (!r) return;
    const h = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowUp") goPrev();
      else if (e.key === "ArrowDown") goNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [r, onClose, idx, navList]);
  useEffect(() => { setShareCopied(false); setFeedback(null); }, [r]);

  /* ثبات الرأس أثناء التنقّل: كل استفسار يفتح من أعلاه بدل ما يرث موضع تمرير الاستفسار السابق،
     وخط خفيف أسفل الرأس يظهر لما يتمرّر المحتوى تحته */
  const bodyRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setScrolled(false);
  }, [r ? r.id : null]);

  /* سحب أفقي فوق اللوحة للتنقّل للاستفسار السابق/التالي بنفس ترتيب القائمة المفتوحة منها */
  const touchRef = useRef(null);
  const onTouchStart = (e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0) goNext(); else goPrev();
  };

  if (!r) return null;
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?note=${r.id}`;
    const shareData = { title: L("استفسارات الملاك", "Owner Inquiries"), text: trNote(lang, r), url };
    if (navigator.share) {
      try {
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          logEvent("share", r.id, r.pri, `${r.model || ""} / ${r.zone || r.loc || ""}`);
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return; // المستخدم أغلق نافذة المشاركة — لا حاجة لأي إجراء إضافي
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      /* بيئات بدون Clipboard API (نادر) — نتجاهل بصمت، النسخ اليدوي يبقى ممكنًا من شريط العنوان */
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1650);
    logEvent("share", r.id, r.pri, `${r.model || ""} / ${r.zone || r.loc || ""}`);
  };

  /* لايك/ديسلايك — تُسجَّل بصمت في Supabase (event_type = "feedback")، بدون عرض أي عدّاد
     بالواجهة؛ تُستخرج لاحقًا عند الحاجة عبر استعلام على جدول public.logs */
  const handleFeedback = (dir) => {
    const next = feedback === dir ? null : dir; // ضغطة ثانية على نفس الاختيار تلغيه محليًا فقط
    setFeedback(next);
    if (next) logEvent("feedback", r.id, dir, `${r.model || ""} / ${r.zone || r.loc || ""}`);
  };

  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet sheet-detail" onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} role="dialog" aria-modal="true">
        <div className="sheet-top" data-scrolled={scrolled ? "1" : "0"}>
          <div className="sheet-tags">
            <span className="mono sheet-id">{L("ملاحظة", "Note")} {String(r.id).padStart(2, "0")}</span>
            <span className="tag" style={{ color: T.pri[r.pri] || T.muted }}>{trPri(lang, r.pri)}</span>
            <CatPill cat={r.cat} />
            {r.isImportantActive && <span className="tag tag-important"><AlertTriangle size={9} /> {L("مهم", "Important")}</span>}
            {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {L("جديد", "New")}</span>}
          </div>
          <div className="sheet-acts">
            {navList && (
              <div className="sheet-nav">
                <button onClick={goPrev} disabled={!hasPrev} className="icon-btn sheet-nav-b" aria-label={L("السابق", "Previous")}>
                  {lang === "ar" ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                </button>
                <button onClick={goNext} disabled={!hasNext} className="icon-btn sheet-nav-b" aria-label={L("التالي", "Next")}>
                  {lang === "ar" ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
                </button>
              </div>
            )}
            <button onClick={onClose} className="icon-btn" aria-label={L("إغلاق", "Close")}><X size={16} /></button>
          </div>
        </div>
        <div className="sheet-body" ref={bodyRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
          <div className="sec-lbl">{L("الملاحظة والحل المقترح", "Note & Proposed Solution")}</div>
          <p className="sheet-note">{trNote(lang, r)}</p>

          <div className="sec-lbl" style={{ marginTop: 24 }}>
            {L("الرد", "Reply")} <span style={{ color: sc }}>· {trSta(lang, r.sta)}</span>
          </div>
          <div className="reply-box" style={{ borderRightColor: sc }}>
            <p className="sheet-reply">{trReply(lang, r) || L("لا يوجد رد مسجّل.", "No reply recorded yet.")}</p>
          </div>

          <div className="meta-list">
            {[[Tag, L("الفئة", "Category"), r.cat ? trCat(lang, r.cat) : L("غير مصنّف", "Uncategorized")],
              [Layers, L("الموقع", "Location"), trLoc(lang, r.loc)], [Home, L("النموذج", "Model"), trScope(lang, r.model)], [User, L("صاحب الرد", "Engineer"), trOwn(lang, r.owner)],
              [Calendar, L("شهر الرد", "Reply Month"), trMonth(lang, r.month)], [Ruler, L("حالة الإغلاق", "Closure Status"), r.closed ? L("مقفل", "Closed") : L("مفتوح", "Open")],
              [Droplet, L("حالة الرد", "Reply Status"), r.answered ? L("تم الرد", "Replied") : L("بانتظار الرد", "Awaiting reply")]].map(([Ic, k, v]) => (
              <div key={k} className="meta-row">
                <span className="meta-k"><Ic size={12} /> {k}</span>
                <span className="meta-v">{v}</span>
              </div>
            ))}
          </div>

          <div className="sheet-fb-row">
            <button
              className="fb-btn fb-up"
              data-on={feedback === "up" ? "1" : "0"}
              onClick={() => handleFeedback("up")}
              aria-pressed={feedback === "up"}
              aria-label={L("مفيد", "Helpful")}
            >
              <ThumbsUp size={19} strokeWidth={2.3} />
            </button>
            <button
              className="fb-btn fb-down"
              data-on={feedback === "down" ? "1" : "0"}
              onClick={() => handleFeedback("down")}
              aria-pressed={feedback === "down"}
              aria-label={L("غير مفيد", "Not helpful")}
            >
              <ThumbsDown size={19} strokeWidth={2.3} />
            </button>

            <button className="wide-btn share-host" style={{ margin: 0, flex: 1 }} onClick={handleShare}>
              <Share2 size={14} /> {L("مشاركة الاستفسار", "Share Inquiry")}
              {shareCopied && (
                <span className="copy-ok show">
                  <Check size={13} /> {L("تم نسخ الرابط", "Link copied")}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ١٣. تبويب تقدّم التنفيذ (ProgressTab) ── */
/* ── حلقات المراحل — ملخص بصري سريع، ترتسم تدريجيًا عند دخولها الشاشة ── */
export function PhaseRings({ phases, mi, tgt, ahead, behind, muted, sunken, lang }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.3);
  const draw = reduced || inView;
  const R = 26, C = 2 * Math.PI * R;
  return (
    <div className="rings" ref={ref}>
      {phases.map((p) => {
        const v = p.v[mi];
        const g = v == null || tgt == null ? null : v - tgt;
        const col = g == null ? muted : g >= 0 ? ahead : behind;
        const pct = v == null ? 0 : Math.max(0, Math.min(100, v));
        return (
          <div key={p.key} className="ring-i">
            <svg width="62" height="62" viewBox="0 0 62 62" className="ring-s">
              <circle cx="31" cy="31" r={R} fill="none" strokeWidth="6" stroke={sunken} />
              <circle cx="31" cy="31" r={R} fill="none" strokeWidth="6" stroke={col} strokeLinecap="round"
                className="ring-fg" strokeDasharray={C}
                strokeDashoffset={draw ? C * (1 - pct / 100) : C} />
              <text x="31" y="31" textAnchor="middle" dominantBaseline="central"
                fontSize="12.5" fill={col} className="mono" transform="rotate(90 31 31)">
                {v == null ? "—" : Math.round(v)}
              </text>
            </svg>
            <div className="ring-l">{trPGLabel(lang, p.label)}</div>
          </div>
        );
      })}
    </div>
  );
}
