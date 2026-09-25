/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: progress-tab */
import { PhaseRings } from "./public-sheets.jsx";
import { PG_NOTE, PG_NOTE_EN, PG_PHASE_NAME, PG_PHASE_NAME_EN, extendPlan, fmtDate, trPGLabel, trPGMonth, trPGPNote, trYear, useLang, useT } from "./site-data.jsx";
import { useInView } from "./site-hooks.jsx";
import { ChartTip } from "./ui-atoms.jsx";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw, ShieldAlert } from "lucide-react";

export function ProgressTab({ reduced, data, loading }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const D = useMemo(() => extendPlan(data, new Date()), [data]);
  const MONTHS = D.months, TARGET = D.target, PHASES = D.phases, BLOCKS = D.blocks, NOTE = D.note;
  const MONTH_KEYS = D.monthKeys || [], MONTH_NOTES = D.monthNotes || {};
  const noteFor = (i) => MONTH_NOTES[MONTH_KEYS[i]] || null;
  const YEARS = D.years, ADDED = D.added || 0;
  const PHASE_NAME = data.phaseName || (lang === "en" ? PG_PHASE_NAME_EN : PG_PHASE_NAME);
  const last = MONTHS.length - 1;

  const ahead = T.sta["معتمدة"], behind = T.sta["تم الرفض"];
  const total = PHASES.find((p) => p.key === "total") || { v: MONTHS.map(() => null) };

  /* آخر شهر وصلت فيه قراءة فعلية من المطور */
  const lastData = useMemo(() => {
    for (let i = total.v.length - 1; i >= 0; i--) if (total.v[i] != null) return i;
    return -1;
  }, [total]);

  const [mi, setMi] = useState(lastData >= 0 ? lastData : last);
  useEffect(() => { setMi(lastData >= 0 ? lastData : MONTHS.length - 1); }, [lastData, MONTHS.length]);

  const yearOf = (i) => (YEARS ? YEARS[i] : null);
  const multiYear = YEARS ? new Set(YEARS).size > 1 : false;
  const mLabel = (i) => trPGMonth(lang, MONTHS[i]) + (multiYear ? ` ${trYear(lang, yearOf(i))}` : "");
  const mFull = (i) => `${trPGMonth(lang, MONTHS[i])} ${trYear(lang, yearOf(i))}`.trim();

  const cur = total.v[mi], tgt = TARGET[mi];
  const hasCur = cur != null && tgt != null;
  const gap = hasCur ? +(cur - tgt).toFixed(2) : null;
  const gapColor = gap == null ? T.muted : gap >= 0 ? ahead : behind;
  const scale = 60; /* أقصى نسبة على مقياس الأشرطة — يمنح الأشرطة مدى مقروءًا */

  /* هدف الشهر الحالي مقابل آخر قراءة وصلت */
  const nowGap = (ADDED > 0 && lastData >= 0 && TARGET[last] != null)
    ? +(total.v[lastData] - TARGET[last]).toFixed(2) : null;

  /* الرسم يعرض آخر ١٢ شهرًا كحد أقصى حتى لا تتراكم التسميات مع مرور الوقت */
  const chartFrom = Math.max(0, MONTHS.length - 12);
  const trend = useMemo(() => MONTHS.slice(chartFrom).map((m, k) => {
    const i = chartFrom + k;
    return {
      m: mLabel(i), "الإنجاز": total.v[i], "الهدف": TARGET[i],
      "الفجوة": total.v[i] == null || TARGET[i] == null ? null : +(total.v[i] - TARGET[i]).toFixed(2),
    };
  }), [total, MONTHS, TARGET, YEARS, lang, chartFrom]);

  const delta = (v, i) => (i === 0 || v[i] == null || v[i - 1] == null ? null : +(v[i] - v[i - 1]).toFixed(2));
  const dColor = (d) => (d === null ? T.muted : d > 0.05 ? ahead : d < -0.05 ? behind : T.muted);
  const dText = (d) => (d === null ? "—" : d > 0.05 ? `+${d.toFixed(2)}` : d < -0.05 ? d.toFixed(2) : L("متوقف", "Stalled"));

  const blocks = useMemo(() =>
    [...BLOCKS].sort((a, b) => (b.v[mi] == null ? -1 : b.v[mi]) - (a.v[mi] == null ? -1 : a.v[mi])), [mi, BLOCKS]);

  const stalled = blocks.filter((r) => mi > 0 && r.v[mi] != null && r.v[mi - 1] != null && Math.abs(r.v[mi] - r.v[mi - 1]) < 0.2);
  const grouped = ["p1", "p2", "p3", "p4", "p_unassigned"].map((k) => ({ k, rows: blocks.filter((r) => r.ph === k) }));

  const Bar = ({ val, color, target }) => {
    const [ref, inView] = useInView(0.35);
    const show = reduced || inView; /* بدون حركة النظام: يظهر مباشرة بدون انتظار السكرول */
    const w = val != null ? `${Math.min(100, (val / scale) * 100)}%` : "0%";
    return (
      <div className="gbar" ref={ref}>
        {val != null && (
          <div className={`gbar-f${!reduced && inView ? " in-view" : ""}`}
            style={{ width: show ? w : "0%", background: color }} />
        )}
        {target != null && (
          <span className="gbar-t" style={{
            [lang === "en" ? "left" : "right"]: `${Math.min(100, (target / scale) * 100)}%`,
            background: T.paper,
          }} />
        )}
      </div>
    );
  };

  return (
    <>
      {loading ? (
        <div className="skel skel-line" style={{ width: 210, height: 14, marginBottom: 16 }} />
      ) : data.updatedAt ? (
        <div className="stamp" style={{ marginBottom: 14 }}>
          <RefreshCw size={13} />
          {L("آخر تحديث:", "Last updated:")} <span className="mono">{fmtDate(data.updatedAt)}</span>{data.label ? ` — ${data.label}` : ""}
        </div>
      ) : null}

      {/* الحالة العامة مقابل الهدف */}
      <section className="surf" style={{ padding: "22px 20px", marginBottom: 14 }}>
        <div className="stats-top">
          <div>
            <div className="sec-t">{L("تقدم المشروع مقابل الهدف", "Project Progress vs. Target")}</div>
            <div className="eyebrow" style={{ marginTop: 4 }}>{L("متوسط الإنجاز لكل البلوكات", "Average completion across all blocks")} · {mFull(mi)}</div>
          </div>
          <div className="hero">
            <span className="hero-n mono">{hasCur ? `${cur.toFixed(2)}٪` : "—"}</span>
          </div>
        </div>

        <Bar val={cur} color={gapColor} target={tgt} />

        <div className="gmeta">
          <span className="gm"><span className="gm-k">{L("الهدف", "Target")}</span> <span className="mono">{tgt != null ? `${tgt.toFixed(2)}٪` : "—"}</span></span>
          {hasCur ? (
            <>
              <span className="dot" />
              <span className="gm" style={{ color: gapColor }}>
                {gap >= 0 ? L("متقدّم", "Ahead") : L("متأخّر", "Behind")} <span className="mono">{Math.abs(gap).toFixed(2)}</span> {L("نقطة", "pts")}
              </span>
              <span className="dot" />
              <span className="gm"><span className="gm-k">{L("التغيّر عن الشهر السابق", "Change vs. previous month")}</span>{" "}
                <span className="mono" style={{ color: dColor(delta(total.v, mi)) }}>{dText(delta(total.v, mi))}</span>
              </span>
            </>
          ) : (
            <>
              <span className="dot" />
              <span className="gm" style={{ color: T.muted }}>{L("بانتظار قراءة المطور لهذا الشهر", "Awaiting the developer's reading for this month")}</span>
            </>
          )}
        </div>

        {ADDED > 0 && lastData >= 0 && TARGET[last] != null && (
          <div className="note-box plan-now" style={{ marginTop: 14 }}>
            <div style={{ color: T.paper }}>
              {L("هدف هذا الشهر", "This month's target")} — {mFull(last)}: <span className="mono" style={{ color: T.brass }}>{TARGET[last].toFixed(2)}٪</span>
            </div>
            <div style={{ marginTop: 6 }}>
              {L("آخر قراءة وصلت من المطور:", "Latest reading received from the developer:")} {mFull(lastData)}{" "}
              <span className="mono">{total.v[lastData].toFixed(2)}٪</span>
              {nowGap != null && (
                <> — {L("الفارق عن هدف هذا الشهر", "difference from this month's target")}{" "}
                  <span className="mono" style={{ color: nowGap >= 0 ? ahead : behind }}>
                    {nowGap >= 0 ? `+${nowGap.toFixed(2)}` : nowGap.toFixed(2)}
                  </span> {L("نقطة", "pts")}</>
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              {L("الهدف خطة خطّية ثابتة ٣٫١٢٥ نقطة شهريًا (١٠٠٪ خلال ٣٢ شهرًا حتى ديسمبر ٢٠٢٧)، ويتقدّم تلقائيًا مع التقويم سواء وصلت قراءة المطور أو لا. الإنجاز الفعلي يبقى فارغًا حتى تصل القراءة.",
                 "The target is a fixed linear plan of 3.125 points per month (100% over 32 months, through December 2027) and advances automatically with the calendar whether or not the developer's reading has arrived. Actual progress stays empty until the reading arrives.")}
            </div>
          </div>
        )}

        {(() => {
          const idx = MONTHS.map((_, i) => i).filter((i) => total.v[i] != null && TARGET[i] != null);
          if (idx.length < 2) return null;
          const i0 = idx[0], i1 = idx[idx.length - 1], span = idx.length - 1;
          const g0 = +(total.v[i0] - TARGET[i0]).toFixed(2);
          const g1 = +(total.v[i1] - TARGET[i1]).toFixed(2);
          const targetStep = (TARGET[i1] - TARGET[i0]) / span;
          const actualStep = (total.v[i1] - total.v[i0]) / span;
          const crossAt = idx.find((i) => total.v[i] - TARGET[i] < 0);
          return (
            <div className="note-box" style={{ marginTop: 16 }}>
              {L("الفجوة عن الهدف", "The gap to target")} {g1 <= g0 ? L("تتقلّص", "is narrowing") : L("تتّسع", "is widening")} {span > 0 ? L("شهرًا بعد شهر", "month over month") : ""}{L(": من", ": from")}{" "}
              <span className="mono" style={{ color: g0 >= 0 ? ahead : behind }}>{g0 >= 0 ? `+${g0.toFixed(2)}` : g0.toFixed(2)}</span>{" "}
              {L("في", "in")} {mFull(i0)} {L("إلى", "to")} <span className="mono" style={{ color: g1 >= 0 ? ahead : behind }}>{g1 >= 0 ? `+${g1.toFixed(2)}` : g1.toFixed(2)}</span>{" "}
              {L("في", "in")} {mFull(i1)}
              {crossAt != null && crossAt > i0 ? L(` — أول شهر يقع فيه المشروع خلف الهدف هو ${mFull(crossAt)}.`, ` — the first month the project fell behind target was ${mFull(crossAt)}.`) : "."}{" "}
              {L("الهدف يتطلّب تقدّمًا بنحو", "The target requires progress of about")} <span className="mono">{targetStep.toFixed(2)}</span> {L("نقطة شهريًا،", "points/month,")}
              {" "}{L("والمتحقّق فعليًا نحو", "while actual progress is about")} <span className="mono">{actualStep.toFixed(2)}</span>.
            </div>
          );
        })()}
      </section>

      {/* المسار الزمني */}
      <section className="surf" style={{ padding: "20px 16px 14px", marginBottom: 14 }}>
        <div style={{ paddingRight: 4 }}>
          <div className="sec-t">{L("المسار الزمني", "Timeline")}</div>
          <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>
            {L("الإنجاز مقابل الهدف", "Progress vs. target")} · {mFull(chartFrom)} — {mFull(last)}
          </div>
        </div>
        <div style={{ height: 230, width: "100%" }}>
          <ResponsiveContainer>
            <ComposedChart data={trend} margin={{ top: 6, right: 4, left: -20, bottom: 4 }}>
              <CartesianGrid stroke={T.lineSoft} vertical={false} />
              <XAxis dataKey="m" reversed={lang === "ar"} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false}
                interval="preserveStartEnd" minTickGap={12} />
              <YAxis orientation="right" domain={[20, 60]} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={36}
                tickFormatter={(v) => `${v}٪`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: T.brass + "12" }} />
              <Line type="monotone" dataKey="الهدف" name={L("الهدف", "Target")} stroke={T.muted} strokeWidth={2} strokeDasharray="5 4"
                dot={{ r: 2.5, fill: T.surface, stroke: T.muted, strokeWidth: 2 }} isAnimationActive={!reduced} />
              <Line type="monotone" dataKey="الإنجاز" name={L("الإنجاز", "Progress")} stroke={T.brass} strokeWidth={2.6}
                dot={{ r: 3.5, fill: T.surface, stroke: T.brass, strokeWidth: 2 }} isAnimationActive={!reduced} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 16, padding: "4px 4px 0" }}>
          <span className="flex items-center" style={{ gap: 7, fontSize: 11.5, color: T.muted }}>
            <span style={{ width: 14, height: 2.6, background: T.brass, display: "inline-block", borderRadius: 2 }} /> {L("الإنجاز الفعلي", "Actual progress")}
          </span>
          <span className="flex items-center" style={{ gap: 7, fontSize: 11.5, color: T.muted }}>
            <span style={{ width: 14, height: 0, borderTop: `2px dashed ${T.muted}`, display: "inline-block" }} /> {L("الهدف المخطَّط", "Planned target")}
          </span>
        </div>
      </section>

      {/* المراحل */}
      <section className="surf" style={{ padding: "20px 18px", marginBottom: 14 }}>
        <div className="sec-t">{L("المراحل", "Phases")}</div>
        <div className="eyebrow" style={{ marginTop: 4, marginBottom: 16 }}>
          {L("مقابل هدف", "Against")} {mFull(mi)} {L("", "target")} <span className="mono">{tgt != null ? `${tgt.toFixed(2)}٪` : "—"}</span> — {L("الخط الرأسي يمثّل الهدف", "the vertical line marks the target")}
        </div>
        <PhaseRings phases={PHASES.filter((p) => p.key !== "total")} mi={mi} tgt={tgt}
          ahead={ahead} behind={behind} muted={T.muted} sunken={T.sunken} lang={lang} />
        {PHASES.filter((p) => p.key !== "total").map((p) => {
          const v = p.v[mi];
          const g = v == null || tgt == null ? null : +(v - tgt).toFixed(2);
          const d = delta(p.v, mi);
          const col = g == null ? T.muted : g >= 0 ? ahead : behind;
          return (
            <div key={p.key} className="grow">
              <div className="grow-top">
                <span className="grow-l">{trPGLabel(lang, p.label)} <span className="grow-note">{trPGPNote(lang, p.note)}</span></span>
                <span className="grow-r">
                  <span className="mono grow-v">{v == null ? "—" : `${v.toFixed(2)}٪`}</span>
                  <span className="mono grow-g" style={{ color: col }}>{g == null ? "—" : g >= 0 ? `+${g.toFixed(2)}` : g.toFixed(2)}</span>
                </span>
              </div>
              <Bar val={v} color={col} target={tgt} />
              <div className="grow-d">{L("التغيّر عن الشهر السابق", "Change vs. previous month")} <span className="mono" style={{ color: dColor(d) }}>{dText(d)}</span></div>
            </div>
          );
        })}
      </section>

      {/* البلوكات */}
      <section className="surf" style={{ padding: "20px 18px" }}>
        <div className="gb-head">
          <div>
            <div className="sec-t">{L("البلوكات", "Blocks")}</div>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              <span className="mono">{BLOCKS.length}</span> {L("بلوك · مرتّبة من الأعلى إنجازًا", "blocks · sorted by highest progress")}
            </div>
          </div>
          <div className="mseg no-print">
            {MONTHS.map((m, i) => {
              const empty = total.v[i] == null;
              const note = empty ? noteFor(i) : null;
              return (
                <button key={`${m}-${i}`} className="mseg-b" data-on={mi === i ? "1" : "0"} onClick={() => setMi(i)}
                  title={empty ? (note || L("بانتظار بيانات المطور", "Awaiting developer data")) : undefined}
                  style={{
                    ...(mi === i ? { background: T.brass, color: T.onAccent } : null),
                    ...(empty && mi !== i ? { opacity: 0.5 } : null),
                    ...(note ? { borderBottom: `2px dotted ${T.muted}` } : null),
                  }}>{mLabel(i)}</button>
              );
            })}
          </div>
        </div>

        {mi != null && total.v[mi] == null && noteFor(mi) && (
          <div className="note-box" style={{ marginTop: 10 }}>
            <ShieldAlert size={13} style={{ verticalAlign: "-2px", marginLeft: 5 }} />
            {L(`${mFull(mi)}: `, `${mFull(mi)}: `)}{noteFor(mi)}
          </div>
        )}

        {(ADDED > 0 || total.v.some((v) => v == null)) && (
          <div className="eyebrow" style={{ marginTop: 10 }}>
            {L("الأشهر الباهتة لم تصل قراءتها بعد — الهدف فيها محسوب من الخطة والإنجاز بانتظار المطور. مرّر المؤشر على الشهر لمعرفة السبب إن وُجد.",
               "Faded months have no reading yet — their target comes from the plan and actual progress awaits the developer. Hover a month for the specific reason, if noted.")}
          </div>
        )}

        {mi > 0 && stalled.length > 0 && (
          <div className="note-box" style={{ marginTop: 14, marginBottom: 4 }}>
            {L("لم تتحرّك في", "No movement in")} {mFull(mi)}:{" "}
            <span style={{ color: T.paper }}>{stalled.map((r) => `${L("بلوك", "Block")} ${r.b}`).join(" · ")}</span>
          </div>
        )}

        {grouped.map(({ k, rows }) => rows.length > 0 && (
          <div key={k} className="gb-group">
            <div className="gb-gt">{PHASE_NAME[k] || k}</div>
            {rows.map((r) => {
              const v = r.v[mi], d = delta(r.v, mi);
              const g = v == null || tgt == null ? null : v - tgt;
              return (
                <div key={r.b} className="brow">
                  <span className="brow-b mono">{r.b}</span>
                  <div className="brow-bar">
                    <Bar val={v} color={g == null ? T.muted : g >= 0 ? ahead : behind} target={tgt} />
                  </div>
                  <span className="brow-v mono">{v == null ? "—" : `${v.toFixed(2)}٪`}</span>
                  <span className="brow-d mono" style={{ color: dColor(d) }}>{dText(d)}</span>
                </div>
              );
            })}
          </div>
        ))}

        {NOTE && <div className="note-box" style={{ marginTop: 16 }}>{lang === "en" && NOTE === PG_NOTE ? PG_NOTE_EN : NOTE}</div>}
        {(() => {
          const drops = BLOCKS.map((r) => {
            let worst = null;
            for (let i = 1; i < r.v.length; i++) {
              if (r.v[i] == null || r.v[i - 1] == null) continue;
              const d = r.v[i] - r.v[i - 1];
              if (d < -1 && (!worst || d < worst.d)) worst = { i, d };
            }
            return worst ? { b: r.b, from: r.v[worst.i - 1], to: r.v[worst.i], m0: worst.i - 1, m1: worst.i, d: worst.d } : null;
          }).filter(Boolean);
          if (!drops.length) return null;
          return (
            <div className="note-box" style={{ marginTop: 8 }}>
              {drops.map((r) => (
                <div key={r.b}>
                  {L("بلوك", "Block")} {r.b} {L("سجّل تراجعًا من", "recorded a drop from")} <span className="mono">{r.from.toFixed(2)}٪</span> {L("في", "in")} {mFull(r.m0)}{" "}
                  {L("إلى", "to")} <span className="mono">{r.to.toFixed(2)}٪</span> {L("في", "in")} {mFull(r.m1)} — {L("يُرجَّح أنه تصحيح لقياس سابق، وليس تراجعًا فعليًا في التنفيذ.", "likely a correction of an earlier reading, not an actual execution setback.")}
                </div>
              ))}
            </div>
          );
        })()}
      </section>
    </>
  );
}
