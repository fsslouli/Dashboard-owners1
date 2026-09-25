/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: ui-atoms */
import { logEvent } from "./app-bootstrap.jsx";
import { catColor, hashPick, trCat, trLoc, trMeeting, trMonth, trNote, trPri, trScope, trSta, trZone, useLang, useT } from "./site-data.jsx";
import { useInView, usePrefersReduced } from "./site-hooks.jsx";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, LayoutGrid, Monitor, Moon, Sparkles, Sun, Table, Users, XCircle } from "lucide-react";

/* ── ٩. عناصر صغيرة قابلة لإعادة الاستخدام ── */
export function CountUp({ value, dur = 850, suffix = "", onScroll = false }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.35);
  const [n, setN] = useState(onScroll && !reduced ? 0 : value);
  const prev = useRef(onScroll && !reduced ? 0 : value);
  useEffect(() => {
    if (reduced) { setN(value); prev.current = value; return; }
    /* وضع السكرول: يبدأ من صفر عند كل ظهور، ويعود لصفر عند الخروج من الشاشة */
    if (onScroll && !inView) { setN(0); prev.current = 0; return; }
    const from = onScroll ? 0 : prev.current, to = value, t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur, reduced, onScroll, inView]);
  return <span className="mono" ref={onScroll ? ref : undefined}>{n}{suffix}</span>;
}

/* ── رقم يقفز قفزة صغيرة عند تغيّر قيمته — لتوضيح تغيّر عدد النتائج بعد الفلترة ── */
export function TickNum({ value }) {
  const reduced = usePrefersReduced();
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;
    if (reduced) { setShown(value); return; }
    setBump(true);
    const t1 = setTimeout(() => setShown(value), 150);
    const t2 = setTimeout(() => setBump(false), 460);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [value, reduced]);
  return <span className={`mono tick-n${bump ? " bump" : ""}`}>{shown}</span>;
}

/* ═══ مخطط الفيلا — كتل مصمتة بلا خطوط أو نقوش ═══ */
export function VillaPlan({ counts, active, onPick, built }) {
  const { T } = useT();
  const { lang } = useLang();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...Object.values(counts));

  const on = (k) => active === k || hover === k;
  const zone = (k, delay) => ({
    onClick: () => onPick(active === k ? null : k),
    onMouseEnter: () => setHover(k),
    onMouseLeave: () => setHover(null),
    fill: on(k) ? T.zoneOn : T.zone,
    fillOpacity: on(k) ? 0.3 : (counts[k] || 0) === 0 ? 0.06 : 0.1 + ((counts[k] || 0) / max) * 0.26,
    stroke: on(k) ? T.zoneOn : "transparent",
    strokeWidth: on(k) ? 1.6 : 0,
    style: {
      cursor: "pointer",
      opacity: built ? (active && active !== k ? 0.3 : 1) : 0,
      transition: `opacity .45s ease ${delay}ms, fill-opacity .2s ease, stroke .2s ease`,
    },
  });

  const pos = (x, y) => ({
    position: "absolute", left: `${(x / 560) * 100}%`, top: `${(y / 430) * 100}%`,
    transform: "translate(-50%,-50%)", whiteSpace: "nowrap", textAlign: "center",
  });
  const lbl = (k, delay) => ({
    opacity: built ? (active && active !== k ? 0.3 : 1) : 0,
    transition: `opacity .45s ease ${delay}ms`,
  });

  const Tag = ({ x, y, name, k, delay, big }) => (
    <div style={{ ...pos(x, y), ...lbl(k, delay) }}>
      <div style={{ fontSize: big ? 12.5 : 11, color: on(k) ? T.zoneOn : T.paper, fontFamily: big ? "'Reem Kufi',sans-serif" : "inherit" }}>{name}</div>
      <div className="mono" style={{ fontSize: big ? 19 : 14, fontWeight: 600, color: on(k) ? T.zoneOn : T.brass, marginTop: 2 }}>{counts[k] || 0}</div>
    </div>
  );

  const archOp = built ? 0.55 : 0;
  const archStyle = { transition: "opacity .6s ease", pointerEvents: "none" };
  const partyClip = "villaPartyHatch";
  const groundClip = "villaGroundHatch";

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="0 0 560 430" className="w-full" style={{ height: "auto", display: "block" }}
        role="group" aria-label={lang === "en" ? "Interactive villa plan" : "مخطط الفيلا التفاعلي"}>
        <defs>
          <clipPath id={partyClip}><rect x="124" y="58" width="10" height="292" /></clipPath>
          <clipPath id={groundClip}><rect x="112" y="350" width="336" height="14" /></clipPath>
        </defs>

        {/* جسم الفيلا = كامل الفيلا */}
        <rect x="140" y="58" width="292" height="292" rx="10" {...zone("whole", 560)} />

        {/* جدار الفلل المتلاصقة */}
        <rect x="124" y="58" width="10" height="292" rx="4" {...zone("party", 520)} />

        {/* السطح */}
        <rect x="150" y="66" width="272" height="38" rx="7" {...zone("roof", 420)} />

        {/* الدور الأول */}
        <rect x="150" y="112" width="272" height="96" rx="7" {...zone("first", 340)} />

        {/* بلاطة الفصل */}
        <rect x="150" y="214" width="272" height="10" rx="4" {...zone("slab", 300)} />

        {/* الدور الأرضي */}
        <rect x="150" y="230" width="272" height="112" rx="7" {...zone("ground", 160)} />

        {/* المطبخ ودورات المياه — كتلة داخل الدورين */}
        <rect x="158" y="120" width="76" height="80" rx="6" {...zone("wet", 240)} />
        <rect x="158" y="240" width="76" height="94" rx="6" {...zone("wet", 240)} />

        {/* الدرج */}
        <rect x="352" y="120" width="62" height="214" rx="6" {...zone("stairs", 260)} />

        {/* منسوب الأرض + تهشير التأسيس */}
        <rect x="112" y="350" width="336" height="2" rx="1" fill={T.muted}
          opacity={built ? 0.28 : 0} style={{ transition: "opacity .5s ease" }} />
        <g clipPath={`url(#${groundClip})`} stroke={T.muted} strokeOpacity={archOp * 0.4} strokeWidth="0.6" style={archStyle}>
          <line x1="118" y1="362" x2="130" y2="350" /><line x1="140" y1="362" x2="152" y2="350" />
          <line x1="162" y1="362" x2="174" y2="350" /><line x1="308" y1="362" x2="320" y2="350" />
          <line x1="330" y1="362" x2="342" y2="350" /><line x1="352" y1="362" x2="364" y2="350" />
          <line x1="374" y1="362" x2="386" y2="350" /><line x1="396" y1="362" x2="408" y2="350" />
          <line x1="418" y1="362" x2="430" y2="350" /><line x1="440" y1="362" x2="452" y2="350" />
        </g>

        {/* الخزان الأرضي */}
        <rect x="176" y="360" width="120" height="32" rx="7" {...zone("tank", 100)} />

        {/* الشارع */}
        <rect x="446" y="352" width="96" height="26" rx="7" {...zone("street", 60)} />
        <line x1="452" y1="365" x2="536" y2="365" stroke={T.zoneOn} strokeOpacity={archOp * 0.5}
          strokeWidth="1" strokeDasharray="6 5" style={archStyle} />

        {/* غير محدد */}
        <rect x="470" y="72" width="76" height="30" rx="8" {...zone("na", 600)} />

        {/* ── خط معماري زخرفي فوق الكتل: سماكة الجدران، البروة، النوافذ، الباب، قلبات الدرج ──
           مرسوم بعد كل مناطق النقر عشان يظهر فوقها لا تحته، وبدون ما يعترض النقر */}
        <g style={{ ...archStyle, opacity: archOp }} fill="none" stroke={T.brass} strokeWidth="1.1">
          {/* بروة السطح */}
          <rect x="146" y="58" width="280" height="8" rx="3" strokeOpacity="0.9" />
          {/* الخط الداخلي لسماكة الجدار الخارجي */}
          <rect x="148" y="66" width="276" height="276" rx="7" strokeOpacity="0.85" />
          {/* خط البلاطة بين السطح والأول */}
          <line x1="150" y1="104" x2="422" y2="104" strokeOpacity="0.6" />
          {/* نوافذ على الواجهة الجانبية */}
          <rect x="404" y="128" width="10" height="26" rx="1.5" strokeOpacity="0.85" />
          <rect x="404" y="252" width="10" height="30" rx="1.5" strokeOpacity="0.85" />
          <rect x="158" y="128" width="10" height="26" rx="1.5" strokeOpacity="0.6" />
          {/* باب المدخل من جهة الشارع */}
          <rect x="398" y="316" width="8" height="26" rx="1.5" fill={T.bg || T.sunken || "none"} fillOpacity="0.9" strokeOpacity="0.9" />
          {/* قلبات الدرج */}
          <polyline points="358,330 358,308 376,308 376,286 358,286 358,264 376,264 376,242 358,242 358,220 376,220 376,198 358,198 358,176 376,176 358,154 376,154 358,132"
            strokeOpacity="0.65" strokeLinejoin="round" />
        </g>

        {/* تهشير الجدار المشترك (قطاع مايل) — فوق كتلة party */}
        <g clipPath={`url(#${partyClip})`} stroke={T.brass} strokeOpacity={archOp * 0.75} strokeWidth="0.7" style={archStyle}>
          <line x1="114" y1="70" x2="134" y2="50" /><line x1="114" y1="100" x2="134" y2="80" />
          <line x1="114" y1="130" x2="134" y2="110" /><line x1="114" y1="160" x2="134" y2="140" />
          <line x1="114" y1="190" x2="134" y2="170" /><line x1="114" y1="220" x2="134" y2="200" />
          <line x1="114" y1="250" x2="134" y2="230" /><line x1="114" y1="280" x2="134" y2="260" />
          <line x1="114" y1="310" x2="134" y2="290" /><line x1="114" y1="340" x2="134" y2="320" />
        </g>

        {/* علامات مناسيب على الحافة اليمنى */}
        <g fill={T.brass} fillOpacity={archOp * 0.7} style={archStyle}>
          <polygon points="428,60 438,60 433,68" />
          <polygon points="428,102 438,102 433,110" />
          <polygon points="428,212 438,212 433,220" />
          <polygon points="428,340 438,340 433,348" />
        </g>
      </svg>

      {/* النصوص العربية كطبقة HTML — عنصر SVG text لا يُشكّل العربية بشكل موثوق */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <Tag x={330} y={278} name={trZone(lang, "ground")} k="ground" delay={160} big />
        <Tag x={330} y={152} name={trZone(lang, "first")} k="first" delay={340} big />
        <Tag x={286} y={84} name={trZone(lang, "roof")} k="roof" delay={420} />
        <Tag x={196} y={288} name={trZone(lang, "wet")} k="wet" delay={240} />
        <Tag x={383} y={220} name={trZone(lang, "stairs")} k="stairs" delay={260} />
        <Tag x={236} y={376} name={trZone(lang, "tank")} k="tank" delay={100} />
        <Tag x={494} y={365} name={trZone(lang, "street")} k="street" delay={60} />
        <Tag x={508} y={87} name={trZone(lang, "na")} k="na" delay={600} />

        <div style={{ ...pos(129, 204), ...lbl("party", 520), transform: "translate(-50%,-50%) rotate(180deg)", writingMode: "vertical-rl" }}>
          <span style={{ fontSize: 10, color: on("party") ? T.zoneOn : T.muted }}>{lang === "en" ? "Party Wall" : "جدار الفلل"}</span>
          <span className="mono" style={{ fontSize: 12, color: on("party") ? T.zoneOn : T.brass, marginTop: 4 }}>{counts.party || 0}</span>
        </div>

        <div style={{ ...pos(286, 219), ...lbl("slab", 300), fontSize: 9.5, color: on("slab") ? T.zoneOn : T.muted }}>
          {lang === "en" ? "Ground + First" : "الأرضي + الأول"} <span className="mono" style={{ color: on("slab") ? T.zoneOn : T.brass }}>{counts.slab || 0}</span>
        </div>

        <div style={{ ...pos(286, 46), ...lbl("whole", 560), fontSize: 10.5, color: on("whole") ? T.zoneOn : T.muted }}>
          {lang === "en" ? "Whole Villa" : "كامل الفيلا"} <span className="mono" style={{ color: on("whole") ? T.zoneOn : T.brass }}>{counts.whole || 0}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ عناصر ═══ */
export function Chip({ on, onClick, children, color, count }) {
  const { T } = useT();
  return (
    <button onClick={onClick} className="chip" data-on={on ? "1" : "0"}
      style={on ? { borderColor: (color || T.brass) + "00", color: T.onAccent, background: color || T.brass } : undefined}>
      {children}{count != null && <span className="mono chip-n">{count}</span>}
    </button>
  );
}

export function Select({ value, onChange, options, placeholder, icon: Icon, block }) {
  return (
    <div className={block ? "sel-wrap sel-wrap-block" : "sel-wrap"}>
      {Icon && <Icon size={13} className="sel-ic" />}
      <select className="sel" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronDown size={13} className="sel-ch" />
    </div>
  );
}

export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div className="tip-h">{label}</div>
      {payload.filter((p) => p.value > 0).map((p) => (
        <div key={p.dataKey} className="tip-r">
          <span className="tip-d" style={{ background: p.color }} />
          <span className="tip-l">{p.name}</span><span className="mono tip-v">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function StaIcon({ s, size = 13 }) {
  const { T } = useT();
  const p = { size, style: { color: T.sta[s] || hashPick(s, T.extra) }, strokeWidth: 2.1 };
  if (s === "معتمدة") return <CheckCircle2 {...p} />;
  if (s === "تم الرفض") return <XCircle {...p} />;
  if (s === "قيد الدراسة") return <Clock {...p} />;
  return <Users {...p} />;
}

export function ThemeToggle() {
  const { mode, setMode, T } = useT();
  const { lang } = useLang();
  const opts = lang === "en"
    ? [["auto", Monitor, "Auto"], ["light", Sun, "Light"], ["dark", Moon, "Dark"]]
    : [["auto", Monitor, "تلقائي"], ["light", Sun, "فاتح"], ["dark", Moon, "داكن"]];
  return (
    <div className="seg" role="group" aria-label={lang === "en" ? "Dashboard appearance" : "مظهر اللوحة"}>
      {opts.map(([m, Ic, title]) => (
        <button key={m} onClick={() => { if (m !== mode) logEvent("filter", "theme", m, null); setMode(m); }} title={title} aria-label={title}
          className="seg-b" data-on={mode === m ? "1" : "0"}
          style={mode === m ? { background: T.brass, color: T.onAccent } : undefined}>
          <Ic size={13} />
        </button>
      ))}
    </div>
  );
}

export function LangToggle() {
  const { T } = useT();
  const { lang, setLang } = useLang();
  return (
    <div className="seg" role="group" aria-label="Language / اللغة">
      {[["ar", "ع"], ["en", "EN"]].map(([l, label]) => (
        <button key={l} onClick={() => { if (l !== lang) logEvent("filter", "lang", l, null); setLang(l); }} title={l === "ar" ? "العربية" : "English"}
          className="seg-b seg-b-txt" data-on={lang === l ? "1" : "0"}
          style={lang === l ? { background: T.brass, color: T.onAccent } : undefined}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function ViewToggle({ view, setView }) {
  const { T } = useT();
  const { lang } = useLang();
  const opts = lang === "en"
    ? [["cards", LayoutGrid, "Card view"], ["table", Table, "Table view"]]
    : [["cards", LayoutGrid, "عرض بطاقات"], ["table", Table, "عرض جدول"]];
  return (
    <div className="seg view-seg no-print" role="group" aria-label={lang === "en" ? "Results layout" : "شكل عرض النتائج"}>
      {opts.map(([v, Ic, title]) => (
        <button key={v} onClick={() => setView(v)} title={title} aria-label={title}
          className="seg-b" data-on={view === v ? "1" : "0"}
          style={view === v ? { background: T.brass, color: T.onAccent } : undefined}>
          <Ic size={13} />
        </button>
      ))}
    </div>
  );
}

/* شارة فئة البند — عنصر واحد مشترك بين البطاقة والجدول ولوحة التفاصيل،
   عشان أي تعديل مستقبلي على شكل الشارة يصير بمكان واحد فقط */
export function CatPill({ cat }) {
  const { T } = useT();
  const { lang } = useLang();
  if (!cat) return null;
  const cc = catColor(T, cat);
  return (
    <span className="cat-pill" style={{ color: cc, background: `${cc}16`, borderColor: `${cc}33` }}>
      {trCat(lang, cat)}
    </span>
  );
}

export function Row({ r, onOpen }) {
  const { T } = useT();
  const { lang } = useLang();
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);
  const pc = T.pri[r.pri] || T.muted;
  const open = () => onOpen(r);
  return (
    <tr className="trow" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <td className="mono td-id">{String(r.id).padStart(2, "0")}</td>
      <td className="td-nw">
        <span className="td-sta" style={{ color: sc }}><StaIcon s={r.sta} />{trSta(lang, r.sta)}</span>
      </td>
      <td className="td-nw" style={{ color: pc }}>{trPri(lang, r.pri)}</td>
      <td className="td-note">
        <span className="td-note-t">{trNote(lang, r)}</span>
        {(r.isImportantActive || r.isNew || !r.closed) && (
          <span className="td-tags">
            {r.isImportantActive && <span className="tag tag-important"><AlertTriangle size={9} /> {lang === "en" ? "Important" : "مهم"}</span>}
            {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {lang === "en" ? "New" : "جديد"}</span>}
            {!r.closed && <span className="tag tag-open">{lang === "en" ? "Open" : "مفتوح"}</span>}
          </span>
        )}
      </td>
      <td className="td-cat">{r.cat ? <CatPill cat={r.cat} /> : <span className="td-m">—</span>}</td>
      <td className="td-m">{trLoc(lang, r.loc)}</td>
      <td className="td-m">{trScope(lang, r.model)}</td>
      <td className="td-m">{trMonth(lang, r.month)}</td>
    </tr>
  );
}

/* ── شريط توزيع الحالات — ينمو من صفر عند دخوله الشاشة ── */
export function StatusBar({ cats, overview, staC, trSta, lang, openBoard, L }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.4);
  const grow = reduced || inView;
  return (
    <div className="bar" ref={ref} role="img" aria-label={L("توزيع القرارات", "Decision breakdown")}>
      {cats.sta.map((s) => {
        const n = overview.byS[s] || 0;
        if (!n) return null;
        return <div key={s} className="bar-s" title={`${trSta(lang, s)} — ${n}`} onClick={() => openBoard({ sta: s })}
          style={{ flex: grow ? n : 0, background: staC(s) }} />;
      })}
    </div>
  );
}

export function Card({ r, i, onOpen, reduced }) {
  const { T } = useT();
  const { lang } = useLang();
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);
  const pc = T.pri[r.pri] || T.muted;
  const [pulsed, setPulsed] = useState(false);
  const open = () => {
    if (!reduced) { setPulsed(false); requestAnimationFrame(() => setPulsed(true)); }
    onOpen(r);
  };
  return (
    <div role="button" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      onAnimationEnd={(e) => { if (e.animationName === "pulseFlash") setPulsed(false); }}
      className={`card pulse-host${pulsed ? " pulsed" : ""}`} style={{
        animation: reduced ? "none" : `rise .4s cubic-bezier(.2,.7,.3,1) ${Math.min(i, 12) * 45}ms both`,
        borderRightColor: pc,
      }}>
      <span className="card-wm mono" aria-hidden="true">{r.id}</span>
      {r.isUrgentActive && (
        <span className="card-wm-urgent" aria-hidden="true">{lang === "en" ? "Needs review" : "يلزم الاطلاع"}</span>
      )}
      <div className="card-top">
        <span className="mono card-id">{String(r.id).padStart(2, "0")}</span>
        <span className="tag" style={{ color: pc }}>{trPri(lang, r.pri)}</span>
        <CatPill cat={r.cat} />
        {r.isImportantActive && <span className="tag tag-important"><AlertTriangle size={9} /> {lang === "en" ? "Important" : "مهم"}</span>}
        {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {lang === "en" ? "New" : "جديد"}</span>}
        {!r.closed && <span className="tag tag-open">{lang === "en" ? "Open" : "مفتوح"}</span>}
        <span className="card-sta" style={{ color: sc }}>
          <StaIcon s={r.sta} />{trSta(lang, r.sta)}
        </span>
      </div>
      <div className="card-note">{trNote(lang, r)}</div>
      <div className="card-foot">
        <span className="fm">{trLoc(lang, r.loc)}</span>
        <span className="dot" />
        <span className="fm">{trScope(lang, r.model)}</span>
        <span className="dot" />
        <span className="fm">{trMonth(lang, r.month)}</span>
        {r.meeting && <><span className="dot" /><span className="fm">{trMeeting(lang, r.meeting)}</span></>}
      </div>
    </div>
  );
}
