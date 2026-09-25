/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: public-site */
import { TELEGRAM_URL, TelegramIcon, debounceLive, logEvent, supabase } from "./app-bootstrap.jsx";
import { CURRENT_VERSION } from "./changelog-legal-data.jsx";
import { ProgressTab } from "./progress-tab.jsx";
import { ChangelogSheet, DocViewerSheet, FiltersSheet, LegalDisclaimer, Sheet } from "./public-sheets.jsx";
import { AR_DIGITS, BASE, CAT_ORDER, DEFAULT_THEME_KEY, DOCS, DOC_BASE, DOC_COLORS, LangCtx, MEETING_ORDER, MODEL_LIST, PG_BASE, PRI_ORDER, STA_ORDER, THEME_SETS, ThemeCtx, ZONES, buildPgFromRows, catColor, fmtDate, hashPick, hideBoot, isFlagLive, isRecentlyChanged, modelsOf, norm, rank, trCat, trLoc, trMeeting, trModel, trMonth, trNote, trOwn, trPri, trSta, trZone, uniqSorted, useLang, useSiteConfig, useSkinFont, useT, zoneOf } from "./site-data.jsx";
import { useBackClose, useDesktopView, useLangMode, usePrefersReduced, useThemeMode, useViewMode } from "./site-hooks.jsx";
import { Card, ChartTip, CountUp, LangToggle, Row, StatusBar, ThemeToggle, TickNum, ViewToggle, VillaPlan } from "./ui-atoms.jsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BANNAA_FONT, bannaaCss, bannaaGround, BrickWall, useDesignFont } from "./design-bannaa.jsx";
import { novaCss, NovaLayers, useNovaRuntime } from "./design-nova.jsx";
import { GallerySection } from "./gallery-kit.jsx";
import { isHidden, NL, useNavLabels } from "./nav-labels-kit.jsx";
import { fmtDuration, isYouTubeId } from "./youtube-kit.js";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowLeft, ArrowUp, ChevronLeft, ChevronRight, FileText, History, Laptop, Play, RefreshCw, RotateCcw, Search, ShieldAlert, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, ThumbsUp, X } from "lucide-react";

/* ── ١٤. المكوّن الرئيسي (Dashboard) — التجميع والعرض النهائي ── */
export const EMPTY_F = { q: "", zone: null, pri: null, cat: null, sta: null, model: null, own: null, mon: null, meeting: null, open: false, fresh: false, important: false, urgent: false };

/* ═══ v2.8.4 — منطق التصفية مستقل عن حالة اللوحة ═══
   استُخرج من useMemo الخاص بـ match() عشان تقدر لوحة "الفلاتر" تحسب عدد نتائج
   المسودة (قبل تطبيقها فعليًا) بنفس المنطق تمامًا، بدون أي احتمال تكرار أو تعارض. */
export function passesFilters(r, f, nq, nqId) {
  if (f.zone && r.zone !== f.zone) return false;
  if (f.pri && r.pri !== f.pri) return false;
  if (f.cat && r.cat !== f.cat) return false;
  if (f.sta && r.sta !== f.sta) return false;
  if (f.model && !r.models.includes(f.model)) return false;
  if (f.own && r.owner !== f.own) return false;
  if (f.mon && r.month !== f.mon) return false;
  if (f.meeting && !((r.meetings && r.meetings.length ? r.meetings : [r.meeting]).includes(f.meeting))) return false;
  if (f.open && r.closed) return false;
  if (f.fresh && !r.isNew) return false;
  if (f.important && !r.isImportantActive) return false;
  if (f.urgent && !r.isUrgentActive) return false;
  if (nq && !(nqId != null && r.id === nqId) && !norm(`${r.note} ${r.reply} ${r.loc} ${r.model} ${r.owner} ${r.pri} ${r.cat} ${r.sta}`).includes(nq)) return false;
  return true;
}

/* ── معرّف جهاز ثابت — لمنع التصويت المتكرر على نفس الإشعار ── */
function getDeviceId() {
  try {
    let id = localStorage.getItem("alborada_device_id");
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem("alborada_device_id", id); }
    return id;
  } catch { return "anon"; }
}

/* ── نافذة الإشعارات المنبثقة — تظهر مرة عند دخول الموقع (بعد الإقرار القانوني)
   بدل الشريط الثابت أعلى الصفحة، بنفس أسلوب نافذة "الإقرار القانوني". يبقى فيها
   خروج عادي وواضح: زر X بالأعلى، زر "إغلاق" بالأسفل، أو النقر خارج النافذة ── */
function NoticesModal({ enabled }) {
  const { T } = useT();
  const { lang } = useLang();
  const [notices, setNotices] = useState([]);
  const [voted, setVoted] = useState({});
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    supabase.from("notices").select("*").order("created_at", { ascending: false }).then(({ data }) => setNotices(data || []));
  }, []);
  useEffect(() => {
    if (!notices.length) return;
    /* عبر دالة تُرجّع أصوات هذا الجهاز فقط — جدول الأصوات نفسه صار مقفلًا على
       الزوار، فما عاد أحد يقدر يقرأ أصوات بقية الأجهزة أو يحصي التصويت من الخارج. */
    supabase.rpc("my_notice_votes", { p_device: getDeviceId() }).then(({ data }) => {
      const v = {}; (data || []).forEach((row) => { v[typeof row === "object" ? row.my_notice_votes : row] = true; });
      setVoted(v);
    });
  }, [notices]);

  const vote = async (n) => {
    const { error } = await supabase.from("notice_votes").insert({ notice_id: n.id, device_id: getDeviceId() });
    if (!error) setVoted((v) => ({ ...v, [n.id]: true }));
    else if (String(error.code) === "23505") setVoted((v) => ({ ...v, [n.id]: true })); // صوّت من قبل بنفس الجهاز
  };

  const onClose = () => setClosed(true);
  useBackClose(enabled && !closed && notices.length > 0, onClose);

  if (!enabled || closed || !notices.length) return null;
  return (
    <div className="ovl no-print" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <div className="sheet-top">
          <div className="flex items-center gap-2">
            <span style={{ width: 36, height: 36, borderRadius: 11, background: T.brass + "14", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Sparkles size={17} color={T.brass} />
            </span>
            <div className="sec-t">{lang === "en" ? "Notices" : "الإشعارات"}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={lang === "en" ? "Close" : "إغلاق"}><X size={16} /></button>
        </div>
        <div className="sheet-body">
          {notices.map((n, i) => (
            <div key={n.id} style={{ marginBottom: i < notices.length - 1 ? 18 : 0, paddingBottom: i < notices.length - 1 ? 18 : 0, borderBottom: i < notices.length - 1 ? `1px solid ${T.lineSoft}` : "none" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Sparkles size={15} color={n.kind === "important" ? "#C0392B" : T.brass} style={{ flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.paper }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{n.body}</div>
                  {n.votes_enabled && (
                    <button onClick={() => vote(n)} disabled={voted[n.id]} style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 6, background: voted[n.id] ? T.brass + "18" : T.brass, color: voted[n.id] ? T.brass : "#fff", border: "none", borderRadius: 9, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: voted[n.id] ? "default" : "pointer" }}>
                      <ThumbsUp size={12} /> {voted[n.id] ? (lang === "ar" ? "تم التأييد، شكرًا" : "Voted, thanks") : (lang === "ar" ? "أؤيد" : "Support")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 19px 20px", borderTop: `1px solid ${T.line}`, background: T.sunken }}>
          <button onClick={onClose} className="big-btn" style={{ marginTop: 0 }}>{lang === "en" ? "Close" : "إغلاق"}</button>
        </div>
      </div>
    </div>
  );
}

export function PublicSite() {
  const reduced = usePrefersReduced();
  const { mode, setMode, resolved } = useThemeMode();
  const { lang, setLang } = useLangMode();
  const { view, setView } = useViewMode();
  const { deskOn, toggleDesk, smallDevice } = useDesktopView();
  const L = (ar, en) => (lang === "en" ? en : ar);
  /* الطقم والتصميم المعتمدان من لوحة الإدارة — يسريان على كل الزوّار لحظيًا */
  const { theme: themeKey, design: designKey, ready: cfgReady } = useSiteConfig();
  const navLabels = useNavLabels(supabase);
  useSkinFont(themeKey);
  const nova = designKey === "nova";
  useNovaRuntime(nova, reduced);
  const bannaa = designKey === "bannaa";
  useDesignFont(bannaa ? BANNAA_FONT : null, "bannaa");

  /* رفع شاشة الإقلاع: الموقع يشتغل ويجيب بياناته من أول لحظة تحت الغطاء، والغطاء
     ما يُرفع إلا والتصميم المعتمد جاهز. النتيجة: الزائر يشوف تصميمًا واحدًا فقط.
     useLayoutEffect عشان الرفع يصير قبل رسمة المتصفح مباشرة بلا وميض بينهما. */
  const firstPaintRef = useRef(true);
  useLayoutEffect(() => {
    if (!cfgReady) return;
    hideBoot(firstPaintRef.current);   /* المخبّأ كان صحيحًا → رفع فوري بلا تلاشٍ */
  }, [cfgReady]);
  useEffect(() => { firstPaintRef.current = false; }, []);
  const SET = THEME_SETS[themeKey] || THEME_SETS[DEFAULT_THEME_KEY];
  const SKIN = SET.skin;
  const T = SET[resolved] || SET.dark || SET.light;
  const pageBg = bannaa ? bannaaGround(T, resolved) : T.bg;

  /* لون خلفية الصفحة نفسها (وسم html) يمشي مع الطقم الحالي — يخدم حالتين:
     منطقة السحب الزائد بالجوال ما تبين بلون غريب، وشريط المتصفح يتلوّن صح.
     نضبط كذلك color-scheme عشان عناصر المتصفح الافتراضية تتبع نفس الوضع. */
  useLayoutEffect(() => {
    if (!cfgReady) return;   /* لسه ما نعرف الطقم المعتمد — نخلي شاشة الإقلاع بلونها */
    const d = document.documentElement;
    d.style.setProperty("--boot-bg", pageBg);
    d.style.setProperty("--boot-fg", T.muted);
    d.style.colorScheme = resolved === "dark" ? "dark" : "light";
  }, [cfgReady, pageBg, T.muted, resolved]);

  const [tab, setTab] = useState("overview");
  useEffect(() => {
    if (!isHidden(navLabels, tab)) return;
    const order = ["overview", "notes", "progress", "docs", "gallery"];
    const next = order.find((k) => !isHidden(navLabels, k));
    if (next) setTab(next);
  }, [navLabels, tab]);
  const [docView, setDocView] = useState(null);
  const [built, setBuilt] = useState(false);
  const [data, setData] = useState({ records: BASE, newKeys: [], updatedAt: null, label: "" });

  /* تحديث لحظي: يجيب البيانات الحية من قاعدة البيانات، ويشترك بالتغييرات الفورية
     (Supabase Realtime) — أي تعديل يسويه الأدمن (مزامنة إكسل أو يدوي) ينعكس هنا
     تلقائيًا بدون ما يحتاج الزائر يحدّث الصفحة. لو فشل الاتصال أو الجدول فاضي،
     يبقى الموقع شغّال بالنسخة الأساسية (BASE) بدون أي انقطاع. */
  useEffect(() => {
    const mapRow = (r) => ({
      id: r.id, model: r.model, loc: r.loc, pri: r.pri, cat: r.cat || "", sta: r.status,
      answered: !!r.answered, owner: r.owner, month: r.month,
      closed: r.closed === "نعم" || r.closed === true,
      meeting: Array.isArray(r.meetings) && r.meetings.length ? r.meetings[0] : null,
      meetings: Array.isArray(r.meetings) ? r.meetings : [],
      note: r.note, reply: r.reply, note_en: r.note_en, reply_en: r.reply_en,
      last_modified: r.last_modified,
      urgent: !!r.urgent, important: !!r.important, urgent_until: r.urgent_until || null, important_until: r.important_until || null,
    });
    const fetchLive = async () => {
      try {
        /* أعمدة محدّدة لا select("*") — أسماء من أدخل البند وعدّله بيانات داخلية
           ما تنزل للزائر أصلاً (وقاعدة البيانات تمنعها عنه بصلاحية عمود مستقلة). */
        const PUBLIC_COLS = "id,model,loc,pri,cat,status,owner,month,note,note_en,reply,reply_en," +
          "closed,urgent,answered,meetings,updated_at,last_modified,important,created_at,urgent_until,important_until";
        const { data: rows, error } = await supabase.from("inquiries").select(PUBLIC_COLS).order("id");
        if (!error && rows && rows.length) setData((d) => ({ ...d, records: rows.map(mapRow) }));
      } catch {}
      finally { setLoading(false); }
    };
    fetchLive();
    const onLive = debounceLive(fetchLive);
    const channel = supabase
      .channel("public-inquiries-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, onLive)
      .subscribe();
    return () => { onLive.cancel(); supabase.removeChannel(channel); };
  }, []);

  /* ═══ v2.8.5 — فئات الفلترة الحية من لوحة الإدارة ═══
     يجيب مصفوفة القيم لكل فئة (الأولوية، الفئة، الحالة، الجهة المجيبة، الاجتماع)
     من نفس جدول filter_categories اللي تديره لوحة الإدارة، ويشترك بتحديثاتها
     الفورية — أي تعديل/إضافة/حذف/ترتيب يسويه الأدمن ينعكس هنا مباشرة بدون
     إعادة نشر. لو الجدول فاضي أو الاتصال فشل، تُستخدم القوائم الأساسية
     المدمجة بالكود (PRI_ORDER/STA_ORDER/...) كخط رجوع آمن. */
  const [liveCats, setLiveCats] = useState({});
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const { data: rows, error } = await supabase.from("filter_categories").select("key,values");
        if (!error && rows && rows.length) {
          const m = {};
          rows.forEach((r) => { m[r.key] = (r.values || []).filter((v) => v != null && v !== ""); });
          setLiveCats(m);
        }
      } catch {}
    };
    fetchCats();
    const onLive = debounceLive(fetchCats);
    const channel = supabase
      .channel("public-filter-categories-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "filter_categories" }, onLive)
      .subscribe();
    return () => { onLive.cancel(); supabase.removeChannel(channel); };
  }, []);
  /* ═══ v2.9.0 (وسّعناها v2.9.2 لأكثر من مقطع لكل نموذج) — مقاطع النماذج من لوحة الإدارة ═══
     الزائر يقرأ المقاطع «الظاهرة» فقط (RLS بقاعدة البيانات)، بترتيبها الإداري.
     والاستماع اللحظي على جدول الإشارة model_videos_rev لا على جدول المقاطع نفسه:
     لما ينخفى مقطع يطلع صفّه من صلاحية الزائر فما يوصله حدثه أصلًا — الإشارة توصل للكل دائمًا. */
  const [videos, setVideos] = useState({});   /* doc_id ← [مقاطعه الظاهرة بالترتيب] */
  useEffect(() => {
    let alive = true, seq = 0;
    const fetchVids = async () => {
      const my = ++seq;
      try {
        const { data: rows, error } = await supabase.from("model_videos")
          .select("id,doc_id,sort_order,youtube_id,title_ar,title_en,yt_title,duration_s,start_s,vertical,published,updated_at")
          .eq("published", true).order("sort_order").order("id");
        if (!alive || my !== seq || error) return;
        const m = {};
        (rows || []).forEach((r) => { if (r && isYouTubeId(r.youtube_id)) (m[r.doc_id] || (m[r.doc_id] = [])).push(r); });
        setVideos(m);
      } catch {}
    };
    fetchVids();
    const channel = supabase
      .channel("public-model-videos-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "model_videos_rev" }, fetchVids)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  const priOrder = liveCats.pri && liveCats.pri.length ? liveCats.pri : PRI_ORDER;
  const staOrder = liveCats.status && liveCats.status.length ? liveCats.status : STA_ORDER;
  const catOrder = liveCats.cat && liveCats.cat.length ? liveCats.cat : CAT_ORDER;
  const meetingOrder = liveCats.meeting && liveCats.meeting.length ? liveCats.meeting : MEETING_ORDER;

  const [loading, setLoading] = useState(true);
  const [pg, setPg] = useState(PG_BASE);
  const [pgLoading, setPgLoading] = useState(true);
  const [f, setF] = useState(EMPTY_F);
  const [sort, setSort] = useState("id");
  const [sel, setSel] = useState(null);
  const [navList, setNavList] = useState(null);
  const openRecord = (r, list) => { setSel(r); setNavList(list || null); };
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [limit, setLimit] = useState(12);
  const tabsRef = useRef(null);
  const indicatorRef = useRef(null);
  const [scrollPending, setScrollPending] = useState(false);
  const [tabsH, setTabsH] = useState(0);
  const filtersRef = useRef(null);
  const [stickyBar, setStickyBar] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const loadMoreRef = useRef(null);
  const progressRef = useRef(null);

  /* موضع مؤشر التبويب النشط المتحرك — يُحدَّث عند تبديل التبويب أو اللغة أو تغيّر حجم الشاشة */
  useLayoutEffect(() => {
    const position = () => {
      const nav = tabsRef.current, ind = indicatorRef.current;
      if (!nav || !ind) return;
      setTabsH(nav.offsetHeight);
      const active = nav.querySelector('.tab[data-on="1"]');
      if (!active) return;
      ind.style.width = `${active.offsetWidth}px`;
      ind.style.left = `${active.offsetLeft}px`;
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [tab, lang]);

  /* شريط الفلاتر المصغّر: يظهر بعد تجاوز صندوق الفلاتر الكامل أثناء التمرير لأسفل في لوحة المتابعة */
  useEffect(() => {
    if (tab !== "notes") { setStickyBar(false); return; }
    const el = filtersRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      setStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab]);

  /* زر "رجوع للأعلى" العائم، خط تقدّم التمرير، وزجاجية شريط الخانات — كلها من نفس مستمع التمرير لتفادي إعادة رسم زائدة */
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setShowTop(y > 520);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (progressRef.current) progressRef.current.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
        if (tabsRef.current) tabsRef.current.classList.toggle("tabs-glass", y > 8);
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => { const t = setTimeout(() => setBuilt(true), reduced ? 0 : 100); return () => clearTimeout(t); }, [reduced]);

  /* تتبع صامت: زيارة عند التحميل */
  useEffect(() => { logEvent("visit", null, null, null); }, []);

  /* عنوان تبويب المتصفح — يتبع اللغة المختارة بدل الاسم الافتراضي للمشروع */
  useEffect(() => {
    if (typeof document !== "undefined") document.title = L("استفسارات الملاك", "Owner Inquiries");
  }, [lang]);

  /* تتبع صامت: تبديل التبويب (يتجاهل التبويب الأول عند التحميل) */
  const firstTabRef = useRef(true);
  useEffect(() => {
    if (firstTabRef.current) { firstTabRef.current = false; return; }
    logEvent("tab", tab, null, null);
  }, [tab]);

  /* تتبع صامت: استخدام الفلاتر (يسجّل فقط الحقل الذي تغيّر فعليًا إلى قيمة) */
  const prevFRef = useRef(EMPTY_F);
  useEffect(() => {
    Object.keys(f).forEach((k) => {
      if (k === "q" || k === "fresh") return;
      const v = f[k];
      if (v !== prevFRef.current[k] && v !== null && v !== false && v !== "") {
        logEvent("filter", k, v, null);
      }
    });
    prevFRef.current = f;
  }, [f]);

  /* تتبع صامت: فتح تفاصيل استفسار */
  useEffect(() => {
    if (sel) logEvent("inquiry_open", sel.id, sel.pri, `${sel.model || ""} / ${sel.zone || sel.loc || ""}`);
  }, [sel]);

  useEffect(() => {
    if (tab !== "notes" || !scrollPending) return;
    tabsRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setScrollPending(false);
  }, [tab, scrollPending, reduced]);

  useEffect(() => {
    let alive = true;
    const fetchPg = async () => {
      try {
        /* progress_matrix_v = عرض (view) محسوب آليًا من progress_readings —
           نفس شكل progress_matrix القديم حرفيًا، فـ buildPgFromRows ما تغيّرت. */
        const [{ data: rows, error }, { data: noteRows }] = await Promise.all([
          supabase.from("progress_matrix_v").select("*").order("month"),
          supabase.from("progress_month_notes").select("*"),
        ]);
        if (!alive) return;
        if (!error && rows && rows.length) {
          const built = buildPgFromRows(rows);
          if (built) {
            built.monthNotes = Object.fromEntries((noteRows || []).map((n) => [n.month, n.note]));
            setPg(built);
          }
        }
      } catch {}
      if (alive) setPgLoading(false);
    };
    fetchPg();
    /* الاستماع الحي على الجداول الأساسية (الـ views ما ترسل أحداث Realtime
       مباشرة) — أي تغيير بأي منهم يُعيد قراءة العرض المحسوب فورًا. */
    /* v2.9.1 — نسب المراحل المعتمدة (progress_phase_overrides) تدخل بالعرض المحسوب
       أيضًا، فصارت تُسمع مثل القراءات والملاحظات */
    const onLive = debounceLive(fetchPg);
    const channel = supabase
      .channel("public-progress-readings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "progress_readings" }, onLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "progress_month_notes" }, onLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "progress_phase_overrides" }, onLive)
      .subscribe();
    return () => { alive = false; onLive.cancel(); supabase.removeChannel(channel); };
  }, []);

  const ALL = useMemo(() => {
    return data.records.map((r) => ({ ...r, zone: zoneOf(r.loc), models: modelsOf(r.model), isNew: isRecentlyChanged(r.last_modified),
      isUrgentActive: isFlagLive(r.urgent, r.urgent_until), isImportantActive: isFlagLive(r.important, r.important_until) }));
  }, [data]);

  /* فتح استفسار محدد تلقائيًا عند الوصول عبر رابط مشاركة (?note=ID) — مرة واحدة فقط بعد اكتمال تحميل البيانات */
  const deepLinkRef = useRef(false);
  useEffect(() => {
    if (deepLinkRef.current || loading || !ALL.length) return;
    const noteId = new URLSearchParams(window.location.search).get("note");
    if (!noteId) return;
    deepLinkRef.current = true;
    const found = ALL.find((r) => String(r.id) === String(noteId));
    if (found) setSel(found);
  }, [ALL, loading]);

  const cats = useMemo(() => ({
    pri: uniqSorted(ALL.map((r) => r.pri), priOrder),
    cat: uniqSorted(ALL.map((r) => r.cat), catOrder),
    sta: uniqSorted(ALL.map((r) => r.sta), staOrder),
    models: MODEL_LIST.filter((m) => ALL.some((r) => r.models.includes(m))),
    owners: uniqSorted(ALL.map((r) => r.owner), liveCats.owner || []),
    months: [...new Set(ALL.map((r) => r.month))].filter(Boolean).sort(),
    /* v2.8.6 — قائمة الاجتماعات = كل القيم المعرّفة بلوحة الإدارة + أي اجتماع مرتبط ببند.
       قبل كذا كانت تُبنى من البنود فقط، فأي اجتماع جديد يُضاف من "الفلاتر" ما يظهر
       إطلاقًا لين يُربط به بند واحد على الأقل */
    meetings: uniqSorted([...(liveCats.meeting || []), ...ALL.flatMap((r) => (r.meetings && r.meetings.length ? r.meetings : [r.meeting]))], meetingOrder),
  }), [ALL, priOrder, catOrder, staOrder, liveCats.owner, liveCats.meeting, meetingOrder]);

  const newCount = ALL.filter((r) => r.isNew).length;
  const openCount = ALL.filter((r) => !r.closed).length;
  const importantCount = ALL.filter((r) => r.isImportantActive).length;
  const urgentCount = ALL.filter((r) => r.isUrgentActive).length;
  const staC = (s) => T.sta[s] || hashPick(s, T.extra);
  const monthValue = (r) => (/^\d{4}-\d{2}$/.test(r.month || "") ? r.month : "9999-99");

  /* الانتقال من النظرة العامة إلى لوحة المتابعة مع تطبيق تصفية */
  const openBoard = (patch = {}) => {
    const { __sort, ...filters } = patch;
    setF({ ...EMPTY_F, ...filters });
    setSort(__sort || "id");
    setLimit(12);
    setTab("notes");
    setScrollPending(true);
  };
  const set = (k, v) => { setF((p) => ({ ...p, [k]: p[k] === v ? (typeof v === "boolean" ? !v : null) : v })); setLimit(12); };
  const reset = () => { setF(EMPTY_F); setLimit(12); };
  const clearFiltersOnly = () => { setF((p) => ({ ...EMPTY_F, q: p.q })); setLimit(12); };
  const nq = useMemo(() => norm(f.q.trim()), [f.q]);
  /* رقم الاستفسار: يقبل أرقامًا عربية أو إنجليزية، مع أو بدون # — يبحث بالتطابق التام على المعرّف */
  const nqId = useMemo(() => {
    const raw = f.q.trim().replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/^#/, "");
    return /^\d+$/.test(raw) ? Number(raw) : null;
  }, [f.q]);

  const match = useMemo(() => (r) => passesFilters(r, f, nq, nqId), [f, nq, nqId]);

  const rows = useMemo(() => ALL.filter((r) => match(r)), [ALL, match]);

  const sorted = useMemo(() => {
    const a = [...rows];
    if (sort === "pri") a.sort((x, y) => rank(priOrder)(x.pri) - rank(priOrder)(y.pri) || x.id - y.id);
    else if (sort === "date") a.sort((x, y) => monthValue(y).localeCompare(monthValue(x)) || y.id - x.id);
    else if (sort === "open") a.sort((x, y) => x.closed - y.closed || rank(priOrder)(x.pri) - rank(priOrder)(y.pri));
    else if (sort === "new") a.sort((x, y) => (y.isNew ? 1 : 0) - (x.isNew ? 1 : 0) || x.id - y.id);
    else a.sort((x, y) => y.id - x.id);
    return a;
  }, [rows, sort, priOrder]);

  /* تحميل تلقائي: يزيد الحد المعروض عند اقتراب نهاية القائمة من الشاشة أثناء التمرير */
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || tab !== "notes") return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setLimit((l) => (l < sorted.length ? l + 16 : l));
    }, { rootMargin: "700px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, sorted.length, limit]);

  /* النظرة العامة تعرض السجل كامل دائمًا — بلا تأثير من فلاتر لوحة المتابعة */
  const overview = useMemo(() => {
    const tot = ALL.length;
    const byS = {}; cats.sta.forEach((s) => (byS[s] = ALL.filter((r) => r.sta === s).length));
    const byP = {}; cats.pri.forEach((p) => (byP[p] = ALL.filter((r) => r.pri === p).length));
    const byC = {}; cats.cat.forEach((c) => (byC[c] = ALL.filter((r) => r.cat === c).length));
    const noCat = ALL.filter((r) => !r.cat).length;
    const zc = {}; ZONES.forEach((z) => (zc[z.key] = 0));
    ALL.forEach((r) => (zc[r.zone] = (zc[r.zone] || 0) + 1));
    const ok = byS["معتمدة"] || 0, no = byS["تم الرفض"] || 0;
    let cum = 0;
    const tl = cats.months.map((m) => {
      const inM = ALL.filter((r) => r.month === m);
      cum += inM.length;
      const o = { m: trMonth(lang, m), "تراكمي": cum };
      cats.sta.forEach((s) => (o[s] = inM.filter((r) => r.sta === s).length));
      return o;
    });
    return { tot, byS, byP, byC, noCat, zc, rate: ok + no ? Math.round((ok / (ok + no)) * 100) : 0, tl };
  }, [ALL, cats, lang]);

  const latest = useMemo(() =>
    [...ALL].sort((a, b) => monthValue(b).localeCompare(monthValue(a)) || b.id - a.id).slice(0, 3), [ALL]);

  const activeChips = useMemo(() => {
    const out = [];
    if (f.q) out.push({ k: "q", l: `${L("بحث:", "Search:")} ${f.q}` });
    if (f.zone) out.push({ k: "zone", l: trZone(lang, f.zone) });
    if (f.sta) out.push({ k: "sta", l: trSta(lang, f.sta) });
    if (f.pri) out.push({ k: "pri", l: trPri(lang, f.pri) });
    if (f.cat) out.push({ k: "cat", l: trCat(lang, f.cat) });
    if (f.model) out.push({ k: "model", l: trModel(lang, f.model) });
    if (f.own) out.push({ k: "own", l: trOwn(lang, f.own) });
    if (f.mon) out.push({ k: "mon", l: trMonth(lang, f.mon) });
    if (f.meeting) out.push({ k: "meeting", l: trMeeting(lang, f.meeting) });
    if (f.open) out.push({ k: "open", l: L("مفتوحة فقط", "Open only") });
    if (f.fresh) out.push({ k: "fresh", l: L("الجديد فقط", "New only") });
    if (f.important) out.push({ k: "important", l: L("مهم فقط", "Important only") });
    if (f.urgent) out.push({ k: "urgent", l: L("يجب الاطلاع فقط", "Needs review only") });
    return out;
  }, [f, lang]);
  /* عدد الفلاتر النشطة بدون نص البحث — يُعرض كشارة على زر "الفلاتر" نفسه،
     منفصل عن نص البحث لأن مربع البحث ظاهر دائمًا وله مؤشره الخاص أصلًا */
  const filterOnlyCount = activeChips.filter((c) => c.k !== "q").length;

  return (
    <ThemeCtx.Provider value={{ T, mode, setMode, resolved }}>
      <LangCtx.Provider value={{ lang, setLang }}>
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="dash" data-design={designKey} style={{ minHeight: "100%" }}>
        <style>{`
@import url('https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400..600&display=block');
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.dash{font-family:'IBM Plex Sans Arabic',system-ui,'Segoe UI',Tahoma,sans-serif;-webkit-font-smoothing:antialiased;
  background:${T.bg};color:${T.paper};transition:background .3s ease,color .3s ease;}
.dash ::selection{background:${T.brass}33;}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;direction:ltr;display:inline-block;}
.disp{font-family:'Reem Kufi','IBM Plex Sans Arabic',sans-serif;}
.wrap{max-width:1120px;margin:0 auto;padding:18px 16px 40px;}
@media(min-width:768px){.wrap{padding:30px 28px 56px;}}

.surf{background:${T.surface};border-radius:18px;box-shadow:${T.shadow};}
.eyebrow{font-size:11.5px;color:${T.muted};}
.sec-t{font-family:'Reem Kufi',sans-serif;font-size:16.5px;color:${T.paper};}
.sec-lbl{font-size:11.5px;color:${T.muted};margin-bottom:9px;}

.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.h1{font-size:clamp(23px,5.2vw,33px);line-height:1.3;margin:6px 0 0;word-spacing:.22em;}
.meta-line{display:flex;flex-wrap:wrap;align-items:center;gap:9px;font-size:12px;color:${T.muted};margin-top:14px;}
.dot{width:3px;height:3px;border-radius:50%;background:${T.faint};display:inline-block;flex:none;}
.acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

.seg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:${T.sunken};}
.seg-b{display:inline-flex;align-items:center;justify-content:center;width:30px;height:26px;border:none;border-radius:8px;
  background:transparent;color:${T.muted};cursor:pointer;transition:.18s;}
.seg-b:hover{color:${T.paper};}
.seg-b-txt{width:auto;padding:0 10px;font-size:11.5px;font-weight:600;font-family:inherit;}

/* خانات التنقّل */
.tabs{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;margin:18px -16px 16px;
  background:${T.bg};transition:background .25s ease,backdrop-filter .25s ease,box-shadow .25s ease;}
.tabs.tabs-glass{background:${T.bg}CC;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:${T.shadow};}
@media(min-width:768px){.tabs{padding:10px 28px;margin:18px -28px 16px;flex-wrap:nowrap;}}
.scroll-progress{position:fixed;top:0;right:0;left:0;height:3px;width:0%;background:${T.brass};z-index:70;pointer-events:none;}
.tab{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:13px;border:1px solid ${T.line};
  background:${T.surface};color:${T.muted};font-family:inherit;font-size:14px;cursor:pointer;transition:.18s;
  flex:1 1 calc(50% - 3px);text-align:center;}
@media(min-width:768px){.tab{flex:none;}}
.tab:hover{color:${T.paper};}
.tab[data-on="1"]{background:${T.brass};border-color:${T.brass};color:${T.onAccent};box-shadow:${T.shadow};}
.tab-n{font-size:11.5px;padding:2px 8px;border-radius:999px;background:${T.sunken};color:${T.muted};}
.tab[data-on="1"] .tab-n{background:rgba(255,255,255,.22);color:${T.onAccent};}
.tab-indicator{display:none;position:absolute;bottom:4px;height:3px;border-radius:3px;background:${T.brass};
  transition:left .32s cubic-bezier(.22,.9,.34,1),width .32s cubic-bezier(.22,.9,.34,1);pointer-events:none;}
@media(min-width:768px){.tab-indicator{display:block;}}

/* تلاشي هادئ عند تبديل محتوى التبويب */
.tab-panel{animation:tabFadeIn .3s ease both;}
@keyframes tabFadeIn{from{opacity:0;}to{opacity:1;}}

/* ═══ إيفكتات v1.5.0 ═══ */

/* نبضة عند فتح استفسار — وميض لوني خفيف يمر على البطاقة */
.pulse-host{position:relative;overflow:hidden;}
.pulse-host::after{content:"";position:absolute;inset:0;background:${T.brass};opacity:0;
  pointer-events:none;border-radius:inherit;}
.pulse-host.pulsed::after{animation:pulseFlash .55s ease-out;}
@keyframes pulseFlash{0%{opacity:.16;}100%{opacity:0;}}

/* توهج شارة "الجديد" */
.chip-glow{animation:badgeGlow 2.6s ease-in-out infinite;}
@keyframes badgeGlow{
  0%,100%{box-shadow:0 0 0 0 transparent;}
  50%{box-shadow:0 0 0 4px ${T.brass}26;}
}
/* توهج شارة "مهم" — أحمر وأسرع من توهج "الجديد" حتى يُلاحظ فورًا */
.chip-important{color:#C0392B;border-color:#C0392B99;background:#C0392B14;}
.chip-important.chip-glow{animation:badgeGlowImportant 1.5s ease-in-out infinite;}
@keyframes badgeGlowImportant{
  0%,100%{box-shadow:0 0 0 0 transparent;}
  50%{box-shadow:0 0 0 5px #C0392B40;}
}
/* توهج شارة "يجب الاطلاع" — كهرماني/ذهبي حتى يتميّز عن "مهم" الأحمر */
.chip-urgent{color:#B8790F;border-color:#B8790F99;background:#B8790F14;}
.chip-urgent.chip-glow{animation:badgeGlowUrgent 1.5s ease-in-out infinite;}
@keyframes badgeGlowUrgent{
  0%,100%{box-shadow:0 0 0 0 transparent;}
  50%{box-shadow:0 0 0 5px #B8790F40;}
}

/* انتقال بطاقات ↔ جدول */
.view-swap{animation:viewIn .3s cubic-bezier(.22,.9,.34,1) both;}
@keyframes viewIn{from{opacity:0;transform:scale(.985);}to{opacity:1;transform:scale(1);}}

/* هيكل تحميل (Skeleton) */
.skel{background:linear-gradient(90deg,${T.sunken} 25%,${T.surface} 50%,${T.sunken} 75%);
  background-size:200% 100%;animation:skelSlide 1.3s infinite;border-radius:8px;}
@keyframes skelSlide{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.skel-line{height:12px;margin-bottom:9px;}

/* رسم الحلقات تدريجيًا (الدائرة + حلقات المراحل) */
.ring-fg{transition:stroke-dashoffset 1.25s cubic-bezier(.22,.9,.34,1);}
.rings{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:20px;
  padding-bottom:18px;border-bottom:1px solid ${T.lineSoft};}
.ring-i{text-align:center;flex:0 0 auto;width:74px;}
.ring-s{transform:rotate(-90deg);}
.ring-l{font-size:10.5px;color:${T.muted};margin-top:2px;line-height:1.4;}

/* تأكيد النسخ — شريط ينزلق داخل الزر */
.copy-host{position:relative;overflow:hidden;}
.share-host{position:relative;overflow:hidden;}

/* صف لايك/ديسلايك + مشاركة أسفل تفاصيل الاستفسار */
.sheet-fb-row{display:flex;align-items:stretch;gap:8px;margin-top:16px;}
.fb-btn{flex:none;width:46px;display:flex;align-items:center;justify-content:center;
  border-radius:11px;border:1px solid ${T.line};background:${T.sunken};color:${T.muted};
  cursor:pointer;transition:.18s;}
.fb-btn:hover{color:${T.paper};border-color:${T.faint};}
.fb-up[data-on="1"]{background:${T.sta["معتمدة"]}29;border-color:${T.sta["معتمدة"]};color:${T.sta["معتمدة"]};}
.fb-down[data-on="1"]{background:${T.sta["تم الرفض"]}29;border-color:${T.sta["تم الرفض"]};color:${T.sta["تم الرفض"]};}
.copy-ok{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;
  background:${T.sta["معتمدة"]};color:#fff;font-size:12.5px;transform:translateY(100%);pointer-events:none;}
.copy-ok.show{animation:copyUp 1.6s cubic-bezier(.22,.9,.34,1) both;}
@keyframes copyUp{
  0%{transform:translateY(100%);}
  14%,78%{transform:translateY(0);}
  100%{transform:translateY(-100%);}
}

/* نبض الفلتر المختار */
.chip{transition:all .22s cubic-bezier(.22,.9,.34,1);}
.chip[data-on="1"]{transform:scale(1.04);}

/* قفزة الرقم عند تغيّره */
.tick-n{display:inline-block;}
.tick-n.bump{animation:tickBump .45s cubic-bezier(.22,.9,.34,1);}
@keyframes tickBump{0%{transform:translateY(0);}35%{transform:translateY(-6px);opacity:.5;}100%{transform:translateY(0);}}

/* حالة السجل */
.stats{padding:22px 20px;margin-bottom:14px;}
.stats-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px;}
.hero{display:flex;align-items:baseline;gap:8px;}
.hero-n{font-size:44px;font-weight:600;line-height:1;color:${T.paper};}
.hero-k{font-size:13px;color:${T.muted};}
.bar{display:flex;height:12px;border-radius:999px;overflow:hidden;gap:2px;background:${T.sunken};}
.bar-s{cursor:pointer;transition:opacity .2s ease,flex 1.1s cubic-bezier(.22,.9,.34,1);}
.legend{display:grid;grid-template-columns:1fr;gap:2px;margin-top:16px;}
@media(min-width:620px){.legend{grid-template-columns:repeat(2,1fr);gap:2px 20px;}}
.lg{display:flex;align-items:center;gap:10px;padding:9px 10px;border:none;background:transparent;border-radius:10px;
  cursor:pointer;font-family:inherit;text-align:start;transition:background .16s;}
.lg:hover{background:${T.sunken};}
.lg-d{width:9px;height:9px;border-radius:3px;flex:none;}
.lg-l{flex:1;font-size:13px;color:${T.paper};}
.lg-n{font-size:14px;font-weight:600;color:${T.paper};}
.lg-p{font-size:11.5px;color:${T.faint};min-width:34px;text-align:left;}
.stats-foot{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:18px;padding-top:16px;
  border-top:1px solid ${T.lineSoft};font-size:12px;color:${T.muted};}
.ff{background:none;border:none;font-family:inherit;font-size:12px;color:${T.muted};cursor:pointer;padding:0;}
.ff:hover{color:${T.brass};}
.ff-static{color:${T.muted};}

.prow{display:block;width:100%;text-align:start;padding:10px 11px;border:none;background:transparent;border-radius:11px;
  cursor:pointer;font-family:inherit;transition:background .16s;}
.prow:hover{background:${T.sunken};}
.prow-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
.prow-l{font-size:13px;}
.prow-n{font-size:14px;font-weight:600;}
.pbar{height:6px;border-radius:999px;background:${T.sunken};overflow:hidden;}
.pbar>div{height:100%;border-radius:999px;transition:width .55s cubic-bezier(.2,.7,.3,1),opacity .2s;}

/* أحدث الملاحظات في النظرة العامة */
.latest{display:grid;grid-template-columns:1fr;gap:2px;}
.lrow{display:flex;align-items:flex-start;gap:11px;padding:13px 11px;border:none;background:transparent;
  border-radius:12px;cursor:pointer;font-family:inherit;text-align:start;transition:background .16s;}
.lrow:hover{background:${T.sunken};}
.lrow+.lrow{border-top:1px solid ${T.lineSoft};}
.lrow-d{width:8px;height:8px;border-radius:3px;margin-top:6px;flex:none;}
.lrow-t{flex:1;min-width:0;}
.lrow-n{font-size:13.5px;line-height:1.75;color:${T.paper};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.lrow-m{font-size:11.5px;color:${T.muted};margin-top:5px;}

.chip{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;font-size:12px;
  border:1px solid ${T.line};background:${T.surface};color:${T.muted};transition:all .18s ease;cursor:pointer;font-family:inherit;}
.chip:hover{color:${T.paper};border-color:${T.faint};}
.chip-n{font-size:10.5px;opacity:.9;}
.fchip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;font-size:12px;
  background:${T.brass}1A;color:${T.brass};border:none;font-family:inherit;cursor:pointer;}
.fchip:hover{background:${T.brass}2E;}

.sel-wrap{position:relative;display:inline-flex;align-items:center;}
.sel{appearance:none;background:${T.surface};border:1px solid ${T.line};color:${T.paper};font-size:12px;
  padding:8px 30px 8px 26px;border-radius:11px;font-family:inherit;cursor:pointer;max-width:210px;}
.sel:focus{outline:2px solid ${T.brass}66;outline-offset:1px;}
.sel option{background:${T.surface};color:${T.paper};}
.sel-ic{position:absolute;right:10px;color:${T.muted};pointer-events:none;}
.sel-ch{position:absolute;left:8px;color:${T.muted};pointer-events:none;}
.sel-wrap-block{display:flex;width:100%;}
.sel-wrap-block .sel{width:100%;max-width:none;}
/* v2.8.4 — لوحة "الفلاتر": شبكة عمودين للحقول المزدوجة تنكسر لعمود واحد على الجوال،
   وذيل ثابت أسفل اللوحة لزرّي "مسح الكل" و"عرض النتائج" فوق أي محتوى قابل للتمرير */
.filt-grid{display:grid;grid-template-columns:1fr;gap:12px;}
@media(min-width:520px){.filt-grid{grid-template-columns:1fr 1fr;}}
.sheet-foot{display:flex;gap:10px;flex:none;padding:14px 19px calc(14px + env(safe-area-inset-bottom));
  border-top:1px solid ${T.line};background:${T.sunken};}

.srch{width:100%;background:${T.surface};border:1px solid ${T.line};border-radius:13px;
  padding:13px 40px 13px 36px;color:${T.paper};font-size:14.5px;font-family:inherit;}
.srch::placeholder{color:${T.faint};}
.srch:focus{outline:none;border-color:${T.brass}88;box-shadow:0 0 0 3px ${T.brass}1A;}

.icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;border-radius:11px;
  border:1px solid ${T.line};background:${T.surface};color:${T.muted};font-size:12px;cursor:pointer;transition:.18s;font-family:inherit;}
.icon-btn:hover{color:${T.paper};border-color:${T.faint};}
.icon-btn[data-primary="1"]{color:${T.onAccent};background:${T.brass};border-color:${T.brass};}
.icon-btn[data-primary="1"]:hover{color:${T.onAccent};filter:brightness(1.07);}
.big-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:16px;padding:14px;
  border-radius:13px;border:none;background:${T.brass};color:${T.onAccent};font-size:14px;font-family:inherit;cursor:pointer;transition:.18s;}
.big-btn:hover{filter:brightness(1.07);}
.wide-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;padding:13px;
  border-radius:13px;border:1px solid ${T.line};background:${T.surface};color:${T.brass};font-size:13.5px;font-family:inherit;cursor:pointer;transition:.18s;}
.wide-btn:hover{border-color:${T.brass};background:${T.brass}0F;}

.note-box{margin-top:14px;padding:12px 14px;border-radius:12px;background:${T.sunken};color:${T.muted};font-size:12px;line-height:1.85;}

.stamp{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;color:${T.muted};
  background:${T.sunken};border-radius:13px;padding:11px 15px;margin-top:16px;}

.cards{display:grid;grid-template-columns:1fr;gap:11px;}
@media(min-width:900px){.cards{grid-template-columns:repeat(2,1fr);}}
.card{position:relative;overflow:hidden;text-align:start;padding:17px 18px;border-radius:16px;background:${T.surface};box-shadow:${T.shadow};
  border-right:3px solid transparent;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;}
.card:hover{transform:translateY(-2px);box-shadow:${T.shadowUp};}
.card:active{transform:scale(.97);box-shadow:${T.shadowUp};}
.card:focus-visible{outline:2px solid ${T.brass};outline-offset:2px;}
.card-wm{position:absolute;bottom:-16px;inset-inline-start:10px;font-size:64px;font-weight:700;line-height:1;
  color:${T.paper};opacity:${resolved === "dark" ? 0.05 : 0.045};pointer-events:none;z-index:0;}
/* علامة مائية إضافية وواضحة لعلامة "يلزم الاطلاع" — نفس أسلوب العلامة المائية أعلاه
   (موضع مطلق، بلا تفاعل، خلف محتوى البطاقة) لكن بشفافية أعلى بكثير عشان تكون لافتة،
   وبلون الأولوية "عالية جدًا" حتى تدل بصريًا على الاستعجال. تُفعَّل من لوحة الإدارة. */
.card-wm-urgent{position:absolute;bottom:-8px;inset-inline-end:14px;max-width:62%;font-size:19px;font-weight:800;
  line-height:1.15;text-align:end;letter-spacing:.2px;color:${T.pri["عالية جدًا"]};
  opacity:${resolved === "dark" ? 0.55 : 0.46};pointer-events:none;z-index:0;}
.card-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:11px;position:relative;z-index:1;}
.card-id{font-size:11.5px;color:${T.faint};}
.card-sta{display:inline-flex;align-items:center;gap:5px;font-size:12px;margin-right:auto;}
.tag{font-size:11px;color:${T.muted};}
.tag-new{display:inline-flex;align-items:center;gap:3px;color:${T.sta["معتمدة"]};animation:${reduced ? "none" : "tagPulse 2.4s ease-in-out infinite"};}
@keyframes tagPulse{0%,100%{opacity:1;}50%{opacity:.45;}}
/* شارة "مهم" — إطار أحمر واضح مع وميض أقوى وأبطأ من "جديد" حتى تُميَّز فورًا بالعين،
   تُفعَّل وتُلغى يدويًا من لوحة الإدارة بدون أي مدة انتهاء تلقائية */
.tag-important{display:inline-flex;align-items:center;gap:4px;font-weight:700;color:#C0392B;
  border:1.4px solid #C0392B;background:#C0392B14;border-radius:999px;padding:2px 9px 2px 7px;
  animation:${reduced ? "none" : "importantBlink 1.3s ease-in-out infinite"};}
@keyframes importantBlink{0%,100%{opacity:1;box-shadow:0 0 0 0 #C0392B4D;}50%{opacity:.55;box-shadow:0 0 7px 1px #C0392B4D;}}
.tag-open{color:${T.brass};}
/* شارة فئة البند — تظهر عند كل استفسار بالبطاقة والجدول ولوحة التفاصيل، بلون خاص لكل فئة */
.cat-pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;line-height:1;
  padding:4px 9px;border-radius:999px;white-space:nowrap;border:1px solid transparent;}
.cat-pill::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;flex:none;}
.tbl td.td-cat{white-space:nowrap;}
.card-note{position:relative;z-index:1;font-size:14.5px;line-height:1.95;color:${T.paper};margin-bottom:12px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.card-foot{position:relative;z-index:1;display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
.fm{font-size:11.5px;color:${T.muted};}

/* لوحة هدف الشهر الحالي — تتقدّم مع التقويم */
.plan-now{border-inline-start:3px solid ${T.brass};}

/* زر وضع سطح المكتب — يبقى واضحًا وسهل الوصول والصفحة مصغّرة */
.desk-btn{white-space:nowrap;flex:none;}
.desk-btn[data-primary="1"]{box-shadow:${T.shadowUp};}

/* عرض الجدول — الزر يجلس في نهاية سطر النتائج على كل الأجهزة */
.res-row{min-height:34px;}
.view-seg{margin-inline-start:auto;align-self:center;flex:none;}
.tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.tbl-wrap::-webkit-scrollbar{height:8px;}
.tbl-wrap::-webkit-scrollbar-track{background:transparent;}
.tbl-wrap::-webkit-scrollbar-thumb{background:${T.faint}55;border-radius:4px;}
.tbl{width:100%;min-width:880px;border-collapse:collapse;font-family:inherit;}
.tbl th{text-align:start;font-weight:500;font-size:11.5px;color:${T.muted};
  padding:14px 14px;border-bottom:1px solid ${T.line};white-space:nowrap;}
.trow{cursor:pointer;transition:background .16s;}
.trow:hover{background:${T.sunken};}
.trow:focus-visible{outline:2px solid ${T.brass};outline-offset:-2px;}
.trow td{padding:13px 14px;border-bottom:1px solid ${T.lineSoft};vertical-align:top;font-size:13px;}
.tbl tbody tr:last-child td{border-bottom:none;}
.td-id{width:46px;}
.tbl td.td-id{font-size:11.5px;color:${T.faint};}
.td-nw{white-space:nowrap;}
.td-sta{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;}
.tbl td.td-note{min-width:300px;color:${T.paper};line-height:1.85;}
.td-note-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.td-tags{display:flex;align-items:center;gap:8px;margin-top:7px;}
.tbl td.td-m{font-size:11.5px;color:${T.muted};white-space:nowrap;}

.zrow{display:block;width:100%;text-align:start;padding:9px 11px;border-radius:11px;cursor:pointer;
  font-family:inherit;background:transparent;border:none;transition:background .16s;}
.zrow:hover{background:${T.sunken};}
.zbar{height:3px;border-radius:2px;background:${T.sunken};overflow:hidden;margin-top:7px;}
.cat-grid{display:grid;grid-template-columns:1fr;gap:2px;}
@media(min-width:760px){.cat-grid{grid-template-columns:repeat(2,1fr);gap:2px 18px;}}

.tip{background:${T.surface};border-radius:12px;padding:10px 13px;font-size:12px;box-shadow:${T.shadowUp};}
.tip-h{color:${T.muted};margin-bottom:6px;font-size:11.5px;}
.tip-r{display:flex;align-items:center;gap:8px;padding:2px 0;}
.tip-d{width:8px;height:8px;border-radius:3px;}
.tip-l{color:${T.muted};flex:1;}
.tip-v{color:${T.paper};}

.ovl{position:fixed;inset:0;background:${resolved === "dark" ? "rgba(4,10,14,.7)" : "rgba(30,45,58,.34)"};
  backdrop-filter:blur(6px);z-index:60;display:flex;align-items:flex-end;justify-content:center;animation:fade .2s ease;overscroll-behavior:contain;}
@media(min-width:640px){.ovl{align-items:center;padding:24px;}}
.sheet{background:${T.surface};border-radius:22px 22px 0 0;width:100%;max-width:680px;max-height:88vh;max-height:min(88vh,calc(100% - 24px));
  display:flex;flex-direction:column;box-shadow:${T.shadowUp};animation:up .3s cubic-bezier(.2,.7,.3,1);}
@media(min-width:640px){.sheet{border-radius:20px;max-height:min(88vh,100%);}}
.sheet-top{display:flex;align-items:center;justify-content:space-between;padding:17px 19px 15px;
  flex:none;position:relative;z-index:1;transition:box-shadow .2s ease;}
/* ═══ v2.8.2 — رأس لوحة تفاصيل الاستفسار ثابت على الجوال ═══
   ارتفاع اللوحة يُحسب من المساحة الظاهرة فعلًا (100% من طبقة .ovl الثابتة) بدل vh وحدها:
   بسفاري الآيفون vh = ارتفاع الشاشة وأشرطة المتصفح مخفية، فكانت اللوحة أطول من المساحة
   الظاهرة ويختفي رأسها (الإغلاق والتنقّل) فوق حافة الشاشة. وعلى الجوال ارتفاع لوحة
   التفاصيل ثابت، فأزرار التنقّل تبقى بنفس المكان مهما اختلف طول الاستفسار. */
@media(max-width:639.98px){.sheet-detail{height:88vh;height:min(88vh,calc(100% - 24px));}}
.sheet-detail .sheet-top{align-items:flex-start;gap:10px;}
.sheet-top[data-scrolled="1"]{box-shadow:0 1px 0 ${T.lineSoft},0 10px 16px -14px ${resolved === "dark" ? "rgba(0,0,0,.6)" : "rgba(30,45,58,.28)"};}
.sheet-tags{display:flex;align-items:center;align-content:center;flex-wrap:wrap;gap:6px 8px;min-width:0;min-height:35px;}
.sheet-acts{display:flex;align-items:center;gap:8px;flex:none;}
.sheet-id{font-size:12.5px;color:${T.muted};}
.sheet-body{padding:4px 19px 24px;overflow-y:auto;flex:1 1 auto;min-height:0;overscroll-behavior:contain;}
.sheet-body::-webkit-scrollbar{width:8px;}
.sheet-body::-webkit-scrollbar-track{background:transparent;}
.sheet-body::-webkit-scrollbar-thumb{background:${T.faint}66;border-radius:4px;}
.sheet-note{font-size:15.5px;line-height:2.1;margin:0;color:${T.paper};}
.reply-box{background:${T.sunken};border-radius:13px;border-right:3px solid transparent;padding:14px 16px;}
.sheet-reply{font-size:14.5px;line-height:2.1;margin:0;color:${T.paper};}
.meta-list{margin-top:24px;}
.meta-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 2px;}
.meta-row+.meta-row{border-top:1px solid ${T.lineSoft};}
.meta-k{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:${T.muted};}
.meta-v{font-size:13px;color:${T.paper};text-align:left;}

/* تقدم التنفيذ */
.gbar{position:relative;height:10px;border-radius:999px;background:${T.sunken};overflow:hidden;}
.gbar-f{height:100%;border-radius:999px;transition:width 1.1s cubic-bezier(.22,.9,.34,1);position:relative;overflow:hidden;}
.gbar-f::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:40%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);opacity:0;}
.gbar-f.in-view::after{animation:gbarShimmer 1.1s ease-in-out .35s 1;}
@keyframes gbarShimmer{0%{left:-40%;opacity:1;}90%{opacity:1;}100%{left:110%;opacity:0;}}
.gbar-t{position:absolute;top:-3px;width:2px;height:16px;border-radius:1px;opacity:.55;}
.gmeta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px;font-size:12.5px;color:${T.muted};}
.gm{display:inline-flex;align-items:baseline;gap:5px;}
.gm-k{color:${T.faint};}
.grow{padding:13px 0;}
.grow+.grow{border-top:1px solid ${T.lineSoft};}
.grow-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px;}
.grow-l{font-size:13.5px;color:${T.paper};}
.grow-note{font-size:11px;color:${T.faint};margin-right:6px;}
.grow-r{display:inline-flex;align-items:baseline;gap:10px;}
.grow-v{font-size:14.5px;font-weight:600;color:${T.paper};}
.grow-g{font-size:12px;}
.grow-d{font-size:11px;color:${T.faint};margin-top:8px;}
.gb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.mseg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:${T.sunken};flex-wrap:wrap;}
.mseg-b{padding:6px 11px;border:none;border-radius:8px;background:transparent;color:${T.muted};
  font-family:inherit;font-size:11.5px;cursor:pointer;transition:.18s;}
.mseg-b:hover{color:${T.paper};}
.gb-group{margin-top:18px;}
.gb-gt{font-size:11.5px;color:${T.faint};margin-bottom:8px;}
.brow{display:flex;align-items:center;gap:12px;padding:9px 2px;}
.brow+.brow{border-top:1px solid ${T.lineSoft};}
.brow-b{width:26px;flex:none;text-align:center;font-size:12px;color:${T.muted};}
.brow-bar{flex:1;min-width:60px;}
.brow-v{width:58px;flex:none;text-align:left;font-size:13px;font-weight:600;color:${T.paper};}
.brow-d{width:56px;flex:none;text-align:left;font-size:11.5px;}

/* ═══ إيفكتات v1.6.0 ═══ */

/* تنقّل سابق/تالي أعلى لوحة تفاصيل الاستفسار */
.sheet-nav{display:inline-flex;align-items:center;gap:4px;padding:2px;border-radius:11px;background:${T.sunken};}
.sheet-nav-b{border:none;background:transparent;padding:7px;}
.sheet-nav-b:disabled{opacity:.32;cursor:default;}
.sheet-nav-b:disabled:hover{color:${T.muted};}

/* شريط الفلاتر المصغّر — يلتصق أسفل شريط الخانات عند تجاوز صندوق الفلاتر الكامل */
.mini-bar{position:sticky;z-index:19;display:flex;align-items:center;gap:10px;padding:10px 16px;margin:0 -16px 16px;
  background:${T.bg};border-bottom:1px solid ${T.lineSoft};animation:stickIn .22s cubic-bezier(.22,.9,.34,1) both;}
@media(min-width:768px){.mini-bar{padding:10px 28px;margin:0 -28px 16px;}}
.mini-bar-jump{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;border:1px solid ${T.line};
  background:${T.surface};color:${T.paper};font-size:12px;font-family:inherit;cursor:pointer;flex:none;}
.mini-bar-jump:hover{border-color:${T.brass};}
.mini-bar-n{background:${T.brass};color:${T.onAccent};font-size:10px;padding:1px 6px;border-radius:999px;}
.mini-bar-res{font-size:12px;color:${T.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mini-bar-clear{display:inline-flex;align-items:center;gap:5px;margin-inline-start:auto;padding:7px 12px;border-radius:999px;
  border:none;background:${T.brass}1A;color:${T.brass};font-size:12px;font-family:inherit;cursor:pointer;flex:none;}
.mini-bar-clear:hover{background:${T.brass}2E;}
@keyframes stickIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}

/* تحميل تلقائي عند نهاية القائمة */
.load-sentinel{height:1px;}
.all-shown{text-align:center;margin-top:20px;font-size:12px;color:${T.faint};}

/* زر "رجوع للأعلى" العائم */
.top-fab{position:fixed;bottom:22px;inset-inline-end:18px;width:44px;height:44px;border-radius:50%;border:1px solid ${T.line};
  background:${T.surface};color:${T.brass};box-shadow:${T.shadowUp};display:flex;align-items:center;justify-content:center;
  cursor:pointer;z-index:40;animation:fade .2s ease both;}
.top-fab:hover{filter:brightness(1.05);}
@media(min-width:640px){.top-fab{bottom:28px;}}

/* ═══ إيفكتات v1.7.4 — تبويب المخططات والمستندات ═══ */
.doc-intro{padding:18px;margin-bottom:14px;}
.doc-disclaimer{display:flex;gap:9px;align-items:flex-start;background:${T.brass}0F;border:1px solid ${T.brass}33;
  border-radius:13px;padding:11px 13px;margin-bottom:16px;font-size:12px;color:${T.muted};line-height:1.8;}
.doc-disclaimer svg{flex-shrink:0;margin-top:1px;color:${T.brass};}
.doc-list{display:grid;grid-template-columns:1fr;gap:11px;}
.doc-card{display:flex;align-items:center;gap:13px;width:100%;text-align:start;background:${T.surface};
  border:1px solid ${T.line};border-inline-start:4px solid ${T.brass};border-radius:16px;padding:11px 13px;
  box-shadow:${T.shadow};font-family:inherit;cursor:pointer;transition:transform .15s ease, box-shadow .15s ease;}
.doc-card:active{transform:scale(.985);}
.doc-thumb{width:62px;height:62px;border-radius:13px;overflow:hidden;flex:none;background:${T.sunken};
  border:1px solid ${T.line};}
.doc-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
.doc-info{flex:1;min-width:0;display:block;}
.doc-name{display:block;font-size:14.5px;font-weight:600;color:${T.paper};}
.doc-sub{display:block;font-size:11.5px;color:${T.muted};margin-top:3px;}
.doc-meta{font-size:11px;color:${T.faint};margin-top:5px;display:flex;align-items:center;gap:5px;}
.doc-go{flex:none;color:${T.faint};display:flex;align-items:center;}

.dvw{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;
  background:${resolved === "dark" ? "#050C10" : "#0C1519"};animation:fade .18s ease;}
.dvw-top{display:flex;align-items:center;gap:11px;padding:calc(9px + env(safe-area-inset-top)) 12px 9px;
  background:rgba(0,0,0,.34);flex:none;}
.dvw-title{flex:1;min-width:0;}
.dvw-name{font-size:14px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dvw-page{font-size:11.5px;color:rgba(255,255,255,.6);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dvw-ico{border:none;background:rgba(255,255,255,.13);color:#fff;width:35px;height:35px;border-radius:11px;
  display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;font-family:inherit;}
.dvw-ico:disabled{opacity:.28;cursor:default;}
.dvw-stage{flex:1;min-height:0;position:relative;overflow:hidden;touch-action:none;
  display:flex;align-items:center;justify-content:center;}
.dvw-img{width:100%;height:100%;object-fit:contain;display:block;transform-origin:center center;
  user-select:none;-webkit-user-select:none;-webkit-user-drag:none;}
.dvw-spin{position:absolute;width:26px;height:26px;border-radius:50%;border:2.5px solid rgba(255,255,255,.22);
  border-top-color:#fff;animation:dvwspin .8s linear infinite;}
@keyframes dvwspin{to{transform:rotate(360deg);}}
.dvw-bot{background:rgba(0,0,0,.34);padding:9px 10px calc(9px + env(safe-area-inset-bottom));flex:none;}
.dvw-nav{display:flex;align-items:center;gap:8px;}
.dvw-chips{flex:1;min-width:0;display:flex;gap:6px;overflow-x:auto;padding:2px 0;scrollbar-width:none;}
.dvw-chips::-webkit-scrollbar{display:none;}
.dvw-chip{flex:none;border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.07);
  color:rgba(255,255,255,.72);font-family:inherit;font-size:11.5px;padding:7px 12px;border-radius:999px;
  cursor:pointer;white-space:nowrap;}
.dvw-chip.on{background:#fff;color:#0C1519;border-color:#fff;font-weight:600;}
.dvw-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px;
  font-size:11px;color:rgba(255,255,255,.5);}
.dvw-foot a{display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,.72);text-decoration:none;
  border:1px solid rgba(255,255,255,.17);border-radius:999px;padding:5px 11px;flex:none;}

/* ═══ v2.9.0 — مقطع النموذج داخل العارض ═══
   الإطار يُحسب من مساحة المسرح نفسها (وحدات الحاوية cq): أكبر ١٦:٩ يدخل بالمساحة.
   على الجوال عرض كامل بلا حواف لأن يوتيوب يشترط ألا يقل المشغّل عن 200 بكسل. */
.dvw-stage.is-video{touch-action:auto;container-type:size;}
.vs{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px 0;}
.vs-frame{position:relative;flex:none;width:100%;aspect-ratio:16/9;min-height:200px;overflow:hidden;
  background:#000 center/cover no-repeat;width:min(100cqw, (100cqh - 40px) * 16 / 9);}
@media(min-width:640px){.vs-h .vs-frame{border-radius:18px;width:min(100cqw - 56px, (100cqh - 56px) * 16 / 9, 1280px);}}
.vs-v .vs-frame{aspect-ratio:9/16;min-height:0;border-radius:18px;width:min(100cqw - 32px, (100cqh - 40px) * 9 / 16);}
.vs-host{position:absolute;inset:0;}
.vs-host iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;}
.vs-poster{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;cursor:pointer;
  background:linear-gradient(180deg,rgba(0,0,0,0) 42%,rgba(0,0,0,.76) 100%);color:#fff;font-family:inherit;text-align:start;}
.vs-play{position:absolute;inset:0;margin:auto;width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.95);
  display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:transform .18s ease;}
.vs-play svg{transform:translateX(2px);}
.vs-poster:hover .vs-play{transform:scale(1.06);}
.vs-poster:focus-visible{outline:none;}
.vs-poster:focus-visible .vs-play{box-shadow:0 0 0 4px rgba(255,255,255,.55),0 10px 30px rgba(0,0,0,.35);}
.vs-cap{position:absolute;inset-inline-start:16px;inset-inline-end:88px;bottom:14px;display:flex;flex-direction:column;gap:3px;}
.vs-kicker{font-size:11.5px;opacity:.78;}
.vs-title{font-size:15px;font-weight:600;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.vs-v .vs-cap{inset-inline-end:16px;bottom:44px;}
.vs-dur{position:absolute;inset-inline-end:14px;bottom:16px;background:rgba(0,0,0,.72);color:#fff;font-size:12px;
  padding:3px 8px;border-radius:7px;direction:ltr;}
.vs-err{display:flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:8px;background:rgba(0,0,0,.64);color:#fff;
  font-size:12.5px;padding:8px 14px;border-radius:12px;max-width:calc(100% - 24px);}
.vs-err a{color:#fff;font-weight:600;display:inline-flex;align-items:center;gap:4px;}
.dvw-chip{display:inline-flex;align-items:center;gap:5px;}
.dvw-links{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
.doc-thumb{position:relative;}
.doc-vbadge{position:absolute;inset-block-end:5px;inset-inline-end:5px;height:20px;min-width:20px;padding:0 5px;border-radius:10px;
  background:rgba(8,12,16,.74);color:#fff;display:flex;align-items:center;gap:2px;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.3);}
.doc-vbadge svg{transform:translateX(1px);flex-shrink:0;}
.doc-vbadge b{font-size:10px;font-weight:700;}
.doc-vid{display:inline-flex;align-items:center;gap:4px;}

@keyframes rise{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes fade{from{opacity:0;}to{opacity:1;}}
@keyframes up{from{opacity:0;transform:translateY(100%);}to{opacity:1;transform:translateY(0);}}
@media(min-width:640px){@keyframes up{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
@media print{.no-print{display:none!important;}.dash{background:#fff;color:#000;}.card,.surf,.stats{box-shadow:none!important;}.tabs{position:static;}
  .tbl{min-width:0!important;}.tbl-wrap{overflow:visible!important;}.cat-pill{border-color:currentColor!important;background:none!important;}}

/* ══ طبقة الهوية البصرية للطقم المعتمد — تُضاف فوق الأساس ولا تستبدله ══ */
${SKIN.body ? `.dash{font-family:${SKIN.body},system-ui,-apple-system,sans-serif;}` : ""}
${SKIN.display ? `.dash h1,.dash h2,.dash .hero-t,.dash .sec-t{font-family:${SKIN.display},Georgia,serif;font-weight:400;letter-spacing:-.005em;}` : ""}
${SKIN.radius !== 16 ? `.dash .card,.dash .surf,.dash .stats,.dash .sheet,.dash .note-box{border-radius:${SKIN.radius}px;}` : ""}
${SKIN.glass ? `.dash .card,.dash .surf,.dash .stats{background:color-mix(in srgb,${T.surface} 74%,transparent);
  -webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);}
.dash .tabs-glass{-webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);}` : ""}
${SKIN.rule ? `.dash .card,.dash .surf{box-shadow:none;border:1px solid ${T.line};}
.dash .card{position:relative;}
.dash .card::before{content:"";position:absolute;top:0;bottom:0;right:0;width:2px;background:${T.brass};
  transform:scaleY(0);transform-origin:top;transition:transform .4s cubic-bezier(.16,1,.3,1);}
.dash .card:hover::before{transform:scaleY(1);}
.dash .tag,.dash .chip{border-radius:3px;}
.dash .mono{font-variant-numeric:tabular-nums;font-weight:300;}` : ""}
${SKIN.aurora ? `.skin-aurora{position:fixed;inset:-25%;z-index:0;filter:blur(72px);opacity:${resolved === "dark" ? ".46" : ".26"};pointer-events:none;}
.skin-aurora i{position:absolute;display:block;border-radius:50%;animation:skindrift 28s cubic-bezier(.22,1,.36,1) infinite alternate;}
.skin-aurora i:nth-child(1){width:52vw;height:52vw;top:1%;right:-7%;background:radial-gradient(circle,${T.brass} 0%,transparent 68%);}
.skin-aurora i:nth-child(2){width:46vw;height:46vw;top:33%;left:-11%;background:radial-gradient(circle,#1E6E8C 0%,transparent 70%);animation-delay:-10s;}
.skin-aurora i:nth-child(3){width:40vw;height:40vw;bottom:-5%;right:13%;background:radial-gradient(circle,${T.sta["معتمدة"]} 0%,transparent 72%);animation-delay:-18s;}
@keyframes skindrift{to{transform:translate3d(-7%,9%,0) scale(1.16);}}` : ""}
${SKIN.spine ? `.dash .cards{position:relative;padding-inline-end:38px;}
@media(min-width:900px){.dash .cards{grid-template-columns:1fr;}}
.dash .cards::before{content:"";position:absolute;top:6px;bottom:6px;inset-inline-end:12px;width:1px;background:${T.line};}
.dash .cards > .card{position:relative;}
.dash .cards > .card::after{content:"";position:absolute;inset-inline-end:-32px;top:24px;width:7px;height:7px;
  border-radius:50%;background:${T.line};transition:background .3s cubic-bezier(.2,.9,.3,1),box-shadow .3s;}
.dash .cards > .card::before{content:"";position:absolute;inset-inline-end:-25px;top:27px;width:25px;height:1px;background:${T.line};}
.dash .cards > .card:hover::after{background:${T.brass};box-shadow:0 0 0 4px ${T.brass}38;}
@media(max-width:520px){.dash .cards{padding-inline-end:26px;}
  .dash .cards::before{inset-inline-end:8px;}
  .dash .cards > .card::after{inset-inline-end:-22px;}
  .dash .cards > .card::before{inset-inline-end:-16px;width:16px;}}` : ""}
${SKIN.draft ? `.skin-paper{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.55;
  background-image:linear-gradient(${T.line} 1px,transparent 1px),linear-gradient(90deg,${T.line} 1px,transparent 1px),
    linear-gradient(${T.lineSoft} 1px,transparent 1px),linear-gradient(90deg,${T.lineSoft} 1px,transparent 1px);
  background-size:88px 88px,88px 88px,11px 11px,11px 11px;}
.dash .card,.dash .surf,.dash .stats,.dash .sheet{box-shadow:none;border:1px solid ${T.line};background:${T.surface};}
.dash .card{position:relative;}
.dash .card::after{content:"";position:absolute;inset:0;border:1px dashed ${T.brass};
  opacity:0;transition:opacity .3s cubic-bezier(.2,.9,.3,1);pointer-events:none;}
.dash .card:hover::after{opacity:.55;}
.dash .tag,.dash .chip,.dash .cat-pill,.dash .icon-btn,.dash .big-btn{border-radius:0;}
.dash .tag{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.1em;}
.dash .mono{font-variant-numeric:tabular-nums;}` : ""}
${SKIN.grid ? `.skin-grid{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background-image:linear-gradient(${T.lineSoft} 1px,transparent 1px),linear-gradient(90deg,${T.lineSoft} 1px,transparent 1px);
  background-size:46px 46px;
  -webkit-mask-image:radial-gradient(ellipse 78% 52% at 50% 0%,#000 8%,transparent 78%);
  mask-image:radial-gradient(ellipse 78% 52% at 50% 0%,#000 8%,transparent 78%);}` : ""}
${(SKIN.aurora || SKIN.grid || SKIN.draft) ? `.dash > *:not(.skin-aurora):not(.skin-grid):not(.skin-paper):not(.ovl):not(.top-fab):not(.dvw):not(.scroll-progress){position:relative;z-index:1;}` : ""}
${nova ? novaCss(T, resolved, reduced) : ""}
${bannaa ? bannaaCss(T, resolved, reduced) : ""}
        `}</style>
        {nova && <NovaLayers />}
        {SKIN.aurora && <div className="skin-aurora no-print" aria-hidden="true"><i /><i /><i /></div>}
        {SKIN.grid && <div className="skin-grid no-print" aria-hidden="true" />}
        {SKIN.draft && <div className="skin-paper no-print" aria-hidden="true" />}

        <div ref={progressRef} className="scroll-progress no-print" aria-hidden="true" />

        <LegalDisclaimer onAgree={() => setLegalAgreed(true)} />
        <NoticesModal enabled={legalAgreed} />

        <div className="wrap">
          <header>
            <div className="head">
              <div className="min-w-0">
                <h1 className="disp h1">{L("استفسارات الملاك", "Owner Inquiries")}</h1>
              </div>
              <div className="acts no-print">
                <LangToggle />
                <ThemeToggle />
                {smallDevice && (
                  <button className="icon-btn desk-btn" onClick={toggleDesk}
                    data-primary={deskOn ? "1" : undefined}
                    aria-pressed={deskOn ? "true" : "false"}>
                    {deskOn ? <Smartphone size={13} /> : <Laptop size={13} />}
                    {deskOn ? L("عرض الجوال", "Mobile view") : L("سطح المكتب", "Desktop")}
                  </button>
                )}
                <button className="icon-btn" onClick={() => { logEvent("click", "changelog", null, null); setChangelogOpen(true); }}><History size={13} /> <span className="mono">{`v${CURRENT_VERSION}`}</span></button>
              </div>
            </div>

            <div className="meta-line">
              <span>{cats.months.length ? `${trMonth(lang, cats.months[0])} — ${trMonth(lang, cats.months[cats.months.length - 1])}` : "—"}</span>
              <span className="dot" />
              <span>{cats.models.map((m) => trModel(lang, m)).join(L("، ", ", "))}</span>
            </div>

            <div className="stamp">
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="chip" style={{ textDecoration: "none" }} onClick={() => logEvent("click", "telegram", null, null)}>
                <TelegramIcon size={13} /> {L("مجتمع الملاك", "Owners Community")}
              </a>
              {loading ? (
                <span className="skel skel-line" style={{ width: 190, height: 13, margin: 0, display: "inline-block" }} />
              ) : data.updatedAt ? (
                <>
                  <RefreshCw size={13} />
                  {L("آخر تحديث:", "Last updated:")} <span className="mono">{fmtDate(data.updatedAt)}</span>{data.label ? ` — ${data.label}` : ""}
                </>
              ) : null}
              {(urgentCount > 0 || importantCount > 0 || newCount > 0) && (
                <div style={{ display: "flex", gap: 9, marginRight: "auto" }}>
                  {urgentCount > 0 && (
                    <button className="chip chip-glow chip-urgent" onClick={() => openBoard({ urgent: true })}>
                      <ShieldAlert size={11} /> {L("يجب الاطلاع", "Needs review")} <span className="mono chip-n">{urgentCount}</span>
                    </button>
                  )}
                  {importantCount > 0 && (
                    <button className="chip chip-glow chip-important" onClick={() => openBoard({ important: true })}>
                      <AlertTriangle size={11} /> {L("مهم", "Important")} <span className="mono chip-n">{importantCount}</span>
                    </button>
                  )}
                  {newCount > 0 && (
                    <button className="chip chip-glow" onClick={() => openBoard({ fresh: true, __sort: "new" })}>
                      <Sparkles size={11} /> {L("الجديد", "New")} <span className="mono chip-n">{newCount}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* الخانات */}
          <nav className="tabs no-print" role="tablist" ref={tabsRef}>
            {!isHidden(navLabels, "overview") && (
              <button className="tab" role="tab" aria-selected={tab === "overview"} data-on={tab === "overview" ? "1" : "0"}
                onClick={() => setTab("overview")}>
                {NL(navLabels, "overview", "نظرة عامة", "Overview", lang)}
              </button>
            )}
            {!isHidden(navLabels, "notes") && (
              <button className="tab" role="tab" aria-selected={tab === "notes"} data-on={tab === "notes" ? "1" : "0"}
                onClick={() => setTab("notes")}>
                {NL(navLabels, "notes", "متابعة الملاحظات", "Notes Board", lang)}
                <span className="tab-n mono">{ALL.length}</span>
              </button>
            )}
            {!isHidden(navLabels, "progress") && (
              <button className="tab" role="tab" aria-selected={tab === "progress"} data-on={tab === "progress" ? "1" : "0"}
                onClick={() => setTab("progress")}>
                {NL(navLabels, "progress", "تقدم التنفيذ", "Progress", lang)}
              </button>
            )}
            {!isHidden(navLabels, "docs") && (
              <button className="tab" role="tab" aria-selected={tab === "docs"} data-on={tab === "docs" ? "1" : "0"}
                onClick={() => setTab("docs")}>
                <FileText size={13} /> {NL(navLabels, "docs", "المخططات والمستندات", "Plans & Documents", lang)}
              </button>
            )}
            {!isHidden(navLabels, "gallery") && (
              <button className="tab" role="tab" aria-selected={tab === "gallery"} data-on={tab === "gallery" ? "1" : "0"}
                onClick={() => setTab("gallery")}>
                {NL(navLabels, "gallery", "الصور والمقاطع", "Photos & Videos", lang)}
              </button>
            )}
            <span className="tab-indicator" ref={indicatorRef} />
          </nav>

          {tab === "notes" && stickyBar && (
            <div className="mini-bar no-print" style={{ top: tabsH }}>
              <button className="mini-bar-jump" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal size={13} />
                <span>{L("الفلاتر", "Filters")}</span>
                {activeChips.length > 0 && <span className="mono mini-bar-n">{activeChips.length}</span>}
              </button>
              <span className="mini-bar-res">
                <TickNum value={rows.length} /> {rows.length !== ALL.length ? L(`من ${ALL.length}`, `of ${ALL.length}`) : L("نتيجة", "results")}
              </span>
              {activeChips.length > 0 && (
                <button className="mini-bar-clear" onClick={reset}><RotateCcw size={12} /> {L("مسح", "Clear")}</button>
              )}
            </div>
          )}

          {tab === "overview" && (
            <div className="tab-panel" data-tab="overview">
              {/* حالة السجل */}
              <section className="surf stats" data-sec="status">
                <div className="stats-top">
                  <div>
                    <div className="sec-t">{L("حالة السجل", "Record Status")}</div>
                    <div className="eyebrow" style={{ marginTop: 4 }}>{L("توزيع القرارات على كامل السجل", "Decision breakdown across the full record")}</div>
                  </div>
                  <div className="hero">
                    <span className="hero-n mono"><CountUp value={overview.tot} onScroll /></span>
                    <span className="hero-k">{L("ملاحظة", "notes")}</span>
                  </div>
                </div>

                <StatusBar cats={cats} overview={overview} staC={staC} trSta={trSta} lang={lang} openBoard={openBoard} L={L} />
                {bannaa && <BrickWall rows={ALL} staC={staC} trSta={trSta} trNote={trNote} lang={lang} L={L} reduced={reduced} onOpen={openRecord} />}

                <div className="legend">
                  {cats.sta.map((s) => {
                    const n = overview.byS[s] || 0;
                    const pct = overview.tot ? Math.round((n / overview.tot) * 100) : 0;
                    return (
                      <button key={s} className="lg" onClick={() => openBoard({ sta: s })}>
                        <span className="lg-d" style={{ background: staC(s) }} />
                        <span className="lg-l">{trSta(lang, s)}</span>
                        <span className="lg-n mono"><CountUp value={n} onScroll dur={900} /></span>
                        <span className="lg-p mono"><CountUp value={pct} onScroll dur={900} suffix="٪" /></span>
                      </button>
                    );
                  })}
                </div>

                <div className="stats-foot">
                  <button className="ff" onClick={() => openBoard({ open: true })}>
                    <CountUp value={openCount} onScroll dur={900} /> {L("ما زالت مفتوحة", "still open")}
                  </button>
                  <span className="dot" />
                  <span className="ff-static"><CountUp value={overview.tot - openCount} onScroll dur={900} /> {L("مقفلة", "closed")}</span>
                  <span className="dot" />
                  <span className="ff-static">{L("نسبة الاعتماد من المحسوم", "Approval rate of decided items")} <CountUp value={overview.rate} onScroll dur={900} suffix="٪" /></span>
                </div>
              </section>

              {/* أحدث الملاحظات */}
              <section className="surf" data-sec="latest" style={{ padding: "20px 18px", marginBottom: 14 }}>
                <div className="sec-t">{L("أحدث الملاحظات", "Latest Notes")}</div>
                <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>{L("آخر ما أُضيف أو جرى عليه رد", "Most recently added or replied to")}</div>
                <div className="latest">
                  {latest.map((r) => (
                    <button key={r.id} className="lrow" onClick={() => openRecord(r, latest)}>
                      <span className="lrow-d" style={{ background: staC(r.sta) }} />
                      <span className="lrow-t">
                        <span className="lrow-n">{trNote(lang, r)}</span>
                        <span className="lrow-m">
                          {trSta(lang, r.sta)} · {trLoc(lang, r.loc)} · {trMonth(lang, r.month)}
                          {r.isNew ? ` · ${L("جديد", "New")}` : ""}{!r.closed ? ` · ${L("مفتوح", "Open")}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <button className="wide-btn" onClick={() => openBoard()}>
                  {L("فتح لوحة المتابعة — كل الملاحظات", "Open Notes Board — All Notes")} <ArrowLeft size={14} />
                </button>
              </section>

              {/* المخطط + المواقع */}
              <section className="surf" data-sec="where" style={{ padding: "20px 18px", marginBottom: 14 }}>
                <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 18 }}>
                  <div className="lg:col-span-2">
                    <div className="sec-t">{L("أين ظهرت الملاحظات؟", "Where did the notes come from?")}</div>
                    <div className="eyebrow" style={{ marginTop: 4 }}>{L("اضغط أي منطقة لعرض ملاحظاتها", "Tap any area to view its notes")}</div>
                    <VillaPlan counts={overview.zc} active={null} onPick={(z) => z && openBoard({ zone: z })} built={built} />
                  </div>
                  <div>
                    <div className="sec-lbl" style={{ marginTop: 4 }}>{L("كل المواقع", "All Locations")}</div>
                    {[...ZONES].sort((a, b) => (overview.zc[b.key] || 0) - (overview.zc[a.key] || 0)).map((z) => {
                      const n = overview.zc[z.key] || 0;
                      const pct = Math.round((n / Math.max(1, overview.tot)) * 100);
                      return (
                        <div key={z.key} role="button" tabIndex={0} className="zrow"
                          onClick={() => n && openBoard({ zone: z.key })}
                          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && n) { e.preventDefault(); openBoard({ zone: z.key }); } }}
                          style={{ opacity: n === 0 ? 0.45 : 1, cursor: n === 0 ? "default" : "pointer" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ fontSize: 12.5 }}>{trZone(lang, z.key)}</span>
                            <span className="mono" style={{ fontSize: 12.5, color: T.muted }}>{n}</span>
                          </div>
                          <div className="zbar">
                            <div style={{ width: `${pct}%`, height: "100%", background: T.zone, opacity: .55, transition: "width .5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* فئات البنود — طبيعة كل استفسار: عيب تنفيذي، تحسين تصميمي، ترقية، استفسار… */}
              {cats.cat.length > 0 && (
                <section className="surf" data-sec="cats" style={{ padding: "20px 18px", marginBottom: 14 }}>
                  <div className="sec-t">{L("طبيعة البنود", "Item Categories")}</div>
                  <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>
                    {L("اضغط أي فئة لعرض بنودها", "Tap any category to view its items")}
                  </div>
                  <div className="cat-grid">
                    {cats.cat.map((c) => {
                      const n = overview.byC[c] || 0;
                      const pct = Math.round((n / Math.max(1, overview.tot)) * 100);
                      const cc = catColor(T, c);
                      return (
                        <div key={c} role="button" tabIndex={0} className="zrow"
                          onClick={() => n && openBoard({ cat: c })}
                          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && n) { e.preventDefault(); openBoard({ cat: c }); } }}
                          style={{ opacity: n === 0 ? 0.45 : 1, cursor: n === 0 ? "default" : "pointer" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 7 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 3, background: cc, flex: "none" }} />
                              {trCat(lang, c)}
                            </span>
                            <span className="mono" style={{ fontSize: 12.5, color: T.muted }}>{n} · {pct}٪</span>
                          </div>
                          <div className="zbar">
                            <div style={{ width: `${pct}%`, height: "100%", background: cc, opacity: .6, transition: "width .5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {overview.noCat > 0 && (
                    <div className="eyebrow" style={{ marginTop: 12 }}>
                      {L(`${overview.noCat} بند بلا فئة محددة بعد`, `${overview.noCat} item(s) not categorized yet`)}
                    </div>
                  )}
                </section>
              )}

              {/* الزمن + الأولوية */}
              <section className="grid grid-cols-1 lg:grid-cols-5" data-sec="charts" style={{ gap: 14 }}>
                <div className="surf lg:col-span-3" style={{ padding: "20px 16px 12px" }}>
                  <div style={{ paddingRight: 4 }}>
                    <div className="sec-t">{L("مسار الردود والتراكم", "Reply Trend & Cumulative")}</div>
                    <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>{L("حسب شهر الرد", "By reply month")}</div>
                  </div>
                  <div style={{ height: 250, width: "100%" }}>
                    <ResponsiveContainer>
                      <ComposedChart data={overview.tl} margin={{ top: 6, right: 4, left: -20, bottom: 4 }}>
                        <defs>
                          {cats.sta.map((s, i) => (
                            <linearGradient key={s} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={staC(s)} stopOpacity={0.95} />
                              <stop offset="100%" stopColor={staC(s)} stopOpacity={0.62} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid stroke={T.lineSoft} vertical={false} />
                        <XAxis dataKey="m" reversed={lang === "ar"} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis orientation="right" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: T.brass + "12" }} />
                        {cats.sta.map((s, i) => (
                          <Bar key={s} dataKey={s} name={trSta(lang, s)} stackId="a" fill={`url(#bg${i})`} maxBarSize={44} isAnimationActive={!reduced} />
                        ))}
                        <Line type="monotone" dataKey="تراكمي" name={L("تراكمي", "Cumulative")} stroke={T.brass} strokeWidth={2.2}
                          dot={{ r: 3, fill: T.surface, stroke: T.brass, strokeWidth: 2 }} isAnimationActive={!reduced} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center" style={{ gap: 14, padding: "6px 4px 4px" }}>
                    {cats.sta.map((s) => (
                      <span key={s} className="flex items-center" style={{ gap: 6, fontSize: 11.5, color: T.muted }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: staC(s), display: "inline-block" }} /> {trSta(lang, s)}
                      </span>
                    ))}
                    <span className="flex items-center" style={{ gap: 6, fontSize: 11.5, color: T.muted }}>
                      <span style={{ width: 13, height: 2, background: T.brass, display: "inline-block" }} /> {L("تراكمي", "Cumulative")}
                    </span>
                  </div>
                </div>

                <div className="surf lg:col-span-2" style={{ padding: 20 }}>
                  <div className="sec-t">{L("حسب الأولوية", "By Priority")}</div>
                  <div className="eyebrow" style={{ marginTop: 4, marginBottom: 18 }}>{L("اضغط أي أولوية لعرض ملاحظاتها", "Tap any priority to view its notes")}</div>
                  {cats.pri.map((p) => {
                    const n = overview.byP[p] || 0;
                    const pct = Math.round((n / Math.max(1, overview.tot)) * 100);
                    const col = T.pri[p] || T.muted;
                    return (
                      <button key={p} className="prow" onClick={() => openBoard({ pri: p })}>
                        <div className="prow-top">
                          <span className="prow-l">{trPri(lang, p)}</span>
                          <span className="prow-n mono" style={{ color: T.muted }}>{n}</span>
                        </div>
                        <div className="pbar"><div style={{ width: `${pct}%`, background: col, opacity: .7 }} /></div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {tab === "notes" && (
            <div className="tab-panel">
              {/* أدوات لوحة المتابعة */}
              <section ref={filtersRef} className="surf no-print" style={{ padding: 18, marginBottom: 16 }}>
                <div className="relative" style={{ marginBottom: 12 }}>
                  <Search size={17} style={{ position: "absolute", right: lang === "ar" ? 14 : "auto", left: lang === "ar" ? "auto" : 14, top: 14, color: T.faint }} />
                  <input className="srch" value={f.q} placeholder={L("ابحث في نص الملاحظة أو الرد…", "Search note or reply text…")}
                    onChange={(e) => { setF((p) => ({ ...p, q: e.target.value })); setLimit(12); }} />
                  {f.q && (
                    <button onClick={() => setF((p) => ({ ...p, q: "" }))} aria-label={L("مسح البحث", "Clear search")}
                      style={{ position: "absolute", left: lang === "ar" ? 12 : "auto", right: lang === "ar" ? "auto" : 12, top: 13, color: T.muted, background: "none", border: "none", cursor: "pointer" }}><X size={16} /></button>
                  )}
                </div>

                {/* v2.8.4: بدل صندوق طويل بكل الفلاتر، زر واحد يفتح لوحة "تخصيص البحث" —
                    نفس كل خيارات التصفية والترتيب، بس منظّمة داخل لوحة بدل مبعثرة هنا */}
                <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                  <button className="icon-btn" data-primary={filterOnlyCount > 0 ? "1" : "0"} onClick={() => setFiltersOpen(true)}>
                    <SlidersHorizontal size={14} /> {L("الفلاتر والترتيب", "Filters & sort")}
                    {filterOnlyCount > 0 && <span className="mono mini-bar-n">{filterOnlyCount}</span>}
                  </button>
                  {filterOnlyCount > 0 && (
                    <button className="icon-btn" onClick={clearFiltersOnly}><RotateCcw size={12} /> {L("مسح", "Clear")}</button>
                  )}
                </div>
              </section>

              <div className="flex items-baseline res-row" style={{ gap: 8, marginBottom: 14 }}>
                <span className="sec-t">{L("النتائج", "Results")}</span>
                <span style={{ color: T.brass, fontSize: 15 }}><TickNum value={rows.length} /></span>
                {rows.length !== ALL.length && <span style={{ fontSize: 12, color: T.muted }}>{L(`من ${ALL.length}`, `of ${ALL.length}`)}</span>}
                <ViewToggle view={view} setView={setView} />
              </div>

              {rows.length === 0 ? (
                <div className="surf" style={{ padding: "48px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: 14.5, margin: "0 0 6px" }}>{L("لا توجد ملاحظات مطابقة", "No matching notes")}</p>
                  <p style={{ fontSize: 12.5, color: T.muted, margin: "0 0 18px" }}>{L("أزل أحد الفلاتر لتوسيع النتائج.", "Remove a filter to widen the results.")}</p>
                  <button className="icon-btn" onClick={reset}><RotateCcw size={13} /> {L("مسح كل الفلاتر", "Clear all filters")}</button>
                </div>
              ) : (
                <>
                  {view === "table" ? (
                    <div className="surf tbl-wrap view-swap" key="v-table">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th className="td-id">#</th>
                            <th>{L("الحالة", "Status")}</th>
                            <th>{L("الأولوية", "Priority")}</th>
                            <th>{L("الملاحظة", "Note")}</th>
                            <th>{L("الفئة", "Category")}</th>
                            <th>{L("الموقع", "Location")}</th>
                            <th>{L("النموذج", "Model")}</th>
                            <th>{L("الشهر", "Month")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.slice(0, limit).map((r, i) => <Row key={`${r.id}-${i}`} r={r} onOpen={(rec) => openRecord(rec, sorted)} />)}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="cards view-swap" key="v-cards">
                      {sorted.slice(0, limit).map((r, i) => <Card key={`${r.id}-${i}`} r={r} i={i} onOpen={(rec) => openRecord(rec, sorted)} reduced={reduced} />)}
                    </div>
                  )}
                  {limit < sorted.length ? (
                    <div ref={loadMoreRef} className="no-print load-sentinel" aria-hidden="true" />
                  ) : sorted.length > 12 ? (
                    <div className="no-print all-shown">{L("تم عرض كل النتائج", "All results shown")}</div>
                  ) : null}
                </>
              )}
            </div>
          )}

          {tab === "progress" && (
            <div className="tab-panel">
              <ProgressTab reduced={reduced} data={pg} loading={pgLoading} />
            </div>
          )}

          {tab === "docs" && (
            <div className="tab-panel">
              <section className="surf doc-intro">
                <div className="sec-t">{L("المخططات والمستندات", "Plans & Documents")}</div>
                <p className="eyebrow" style={{ marginTop: 8, lineHeight: 1.8 }}>
                  {L(
                    "هنا تجد المخطط الرئيسي لتوزيع البلوكات، بالإضافة إلى مخطط كل نموذج فيلا على حدة. اضغط \"فتح\" لعرض الملف أو تنزيله.",
                    "Here you'll find the master block-layout plan, along with each villa model's plan. Tap \"Open\" to view or download the file."
                  )}
                  {Object.keys(videos).length > 0 && L(
                    " النماذج اللي تحمل علامة «فيديو» فيها جولة مرئية تُعرض هنا داخل الموقع مباشرة.",
                    " Models marked \"Video\" include a video tour that plays right here."
                  )}
                </p>
              </section>

              <div className="doc-disclaimer">
                <ShieldAlert size={15} />
                <span>
                  {L(
                    "الملفات مرجعية للاطّلاع فقط وقد تخضع لتعديلات من المطوّر. للتأكد من أي تفصيل نهائي يخص وحدتك تواصل عبر قناة الاستفسارات.",
                    "Files are for reference only and may be revised by the developer. For any unit-specific final detail, please reach out via the inquiries channel."
                  )}
                </span>
              </div>

              <div className="doc-list">
                {DOCS.map((doc) => {
                  const accent = doc.color ? DOC_COLORS[resolved][doc.color] : T.brass;
                  const Go = lang === "en" ? ChevronRight : ChevronLeft;
                  const docVids = videos[doc.id] || [];
                  return (
                    <button
                      key={doc.id}
                      className="doc-card"
                      style={{ borderInlineStartColor: accent }}
                      onClick={() => { logEvent("nav", "doc_open", doc.id, docVids.length ? "video" : null); setDocView(doc); }}
                    >
                      <span className="doc-thumb" style={{ borderColor: accent + "55" }}>
                        <img src={DOC_BASE + doc.cover} alt="" loading="lazy" />
                        {docVids.length > 0 && (
                          <span className="doc-vbadge" aria-hidden="true">
                            <Play size={9} fill="currentColor" strokeWidth={0} />
                            {docVids.length > 1 && <b>{docVids.length}</b>}
                          </span>
                        )}
                      </span>
                      <span className="doc-info">
                        <span className="doc-name">{L(doc.nameAr, doc.nameEn)}</span>
                        <span className="doc-sub">{L(doc.subAr, doc.subEn)}</span>
                        <span className="doc-meta" style={{ color: accent }}>
                          <FileText size={11} />
                          {doc.pages.length} {L(doc.pages.length === 1 ? "لوحة" : "لوحات", doc.pages.length === 1 ? "sheet" : "sheets")}
                          {docVids.length > 0 && (
                            <span className="doc-vid">
                              <span aria-hidden="true">·</span>
                              <Play size={10} fill="currentColor" strokeWidth={0} />
                              {docVids.length === 1
                                ? L("فيديو", "Video")
                                : L(`${docVids.length} مقاطع`, `${docVids.length} videos`)}
                              {docVids.length === 1 && docVids[0].duration_s > 0 && <span className="mono">{fmtDuration(docVids[0].duration_s)}</span>}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="doc-go"><Go size={17} /></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "gallery" && (
            <div className="tab-panel">
              <GallerySection supabase={supabase} T={T} L={L} lang={lang} />
            </div>
          )}

          <div className="no-print" style={{ textAlign: "center", marginTop: 28, display: "flex", gap: 14, justifyContent: "center", alignItems: "center" }}>
            <button className="mono" onClick={() => { logEvent("click", "changelog", null, null); setChangelogOpen(true); }} style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: T.faint, padding: 4,
            }}>
              v{CURRENT_VERSION}
            </button>
            <button className="mono" onClick={() => { logEvent("click", "admin_login", null, null); window.location.hash = "admin"; }} style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: T.faint, padding: 4, display: "flex", alignItems: "center", gap: 4,
            }}>
              <ShieldCheck size={12} /> {L("دخول الإدارة", "Admin login")}
            </button>
          </div>
        </div>

        <Sheet r={sel} navList={navList} onJump={setSel} onClose={() => { setSel(null); setNavList(null); }} />
        <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
        <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} f={f} sort={sort} cats={cats} ALL={ALL}
          nq={nq} nqId={nqId} urgentCount={urgentCount} importantCount={importantCount} newCount={newCount} openCount={openCount}
          onApply={(draft, newSort) => { setF((p) => ({ ...draft, q: p.q })); setSort(newSort); setLimit(12); }} />
        <DocViewerSheet doc={docView} videos={docView ? videos[docView.id] || [] : []} onClose={() => setDocView(null)} />

        {showTop && (
          <button
            className="top-fab no-print"
            onClick={() => { logEvent("click", "back_to_top", null, null); window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); }}
            aria-label={L("رجوع للأعلى", "Back to top")}
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  );
}
