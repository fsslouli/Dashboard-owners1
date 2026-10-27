/* ملف مُستخرج تلقائيًا من Dashboard.jsx — قسم: progress-tab */
import { PG_NOTE, PG_NOTE_EN, PG_PHASE_NAME, PG_PHASE_NAME_EN, extendPlan, fmtDate, trPGLabel, trPGMonth, trPGPNote, trText, trYear, useLang, useT } from "./site-data.jsx";
import { useInView } from "./site-hooks.jsx";
import { ChartTip } from "./ui-atoms.jsx";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { payStates } from "./payments-data.jsx";

export function ProgressTab({ reduced, data, loading }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const PCT = lang === "en" ? "%" : "٪";
  const D = useMemo(() => extendPlan(data, new Date()), [data]);
  const MONTHS = D.months, TARGET = D.target, PHASES = D.phases, BLOCKS = D.blocks, NOTE = D.note;
  const MONTH_KEYS = D.monthKeys || [], MONTH_NOTES = D.monthNotes || {};
  const noteFor = (i) => trText(lang, MONTH_NOTES[MONTH_KEYS[i]] || null) || null; /* 6.8.0 — بالإنجليزي من ذاكرة الترجمة */
  const YEARS = D.years, ADDED = D.added || 0;
  const PHASE_NAME = data.phaseName || (lang === "en" ? PG_PHASE_NAME_EN : PG_PHASE_NAME);
  const last = MONTHS.length - 1;

  const ahead = T.sta["معتمدة"], behind = T.sta["قيد الدراسة"] || T.muted;
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
  const scale = 100; /* مقياس الأشرطة 0–100٪ كاملًا — لا يُقتطع حتى لا تبدو نسبة ٦٣٪ شبه مكتملة */

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
  const dText = (d) => (d === null ? "—" : d > 0.05 ? `+${d.toFixed(2)}` : d < -0.05 ? d.toFixed(2) : L("ثابت", "Steady"));

  /* سطر الدفعات تحت كل بلوك — ثانوي: عملات صغيرة وجملة قصيرة، والنسبة تبقى هي البطل */
  const PayLine = ({ p, peak }) => {
    const st = payStates(Math.max(p, peak), p), dd = st.filter((x) => x.s === "due"), nx = st.find((x) => x.s === "near" || x.s === "next");
    const dotCol = { due: ahead, near: behind, next: T.brass, lock: T.line };
    return (
      <div className="brow-pay">
        <span className="pay-dots" aria-hidden="true">
          {st.map((x) => <i key={x.y.n} style={{ background: x.s === "due" ? dotCol[x.s] : "transparent", borderColor: dotCol[x.s], borderStyle: x.s === "next" ? "dashed" : "solid" }} />)}
        </span>
        <span>
          {dd.length > 0 && <b style={{ color: T.paper }}>{L(`مستحق ${dd[dd.length - 1].y.cum}${PCT} من الثمن`, `${dd[dd.length - 1].y.cum}${PCT} of price due`)}</b>}
          {dd.length > 0 && <> ({L(`${dd.length} دفعات`, `${dd.length} payments`)})</>}
          {nx && nx.gap !== null && <> · {L(`القادمة ${nx.y.n} عند ${nx.y.thr}${PCT}`, `next: #${nx.y.n} at ${nx.y.thr}${PCT}`)}{nx.s === "near" && <b style={{ color: behind, whiteSpace: "nowrap" }}> · {L("باقي", "")} {nx.gap.toFixed(1)}{lang === "en" ? " pts left" : ""}</b>}</>}
        </span>
      </div>
    );
  };

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
      </div>
    );
  };

  /* شريط الظل: الهدف لشهر التقرير المختار — نفس المعالجة في البطاقة العامة والمراحل والبلوكات */
  const Ghost = ({ target }) => target == null ? null : (
    <div className="gbar-ghost" title={`${L("هدف", "Target")} ${mFull(mi)}: ${target.toFixed(2)}${PCT}`}>
      <i style={{ width: `${Math.min(100, (target / scale) * 100)}%` }} />
    </div>
  );

  return (
    <>
      {loading ? (
        <div className="skel skel-line" style={{ width: 210, height: 14, marginBottom: 16 }} />
      ) : data.updatedAt ? (
        <div className="stamp" style={{ marginBottom: 14 }}>
          <RefreshCw size={13} />
          {L("آخر تحديث:", "Last updated:")} <span className={lang === "en" ? "mono" : undefined}>{fmtDate(data.updatedAt, lang)}</span>{data.label ? ` — ${trText(lang, data.label)}` : ""}
        </div>
      ) : null}

      {/* الحالة العامة مقابل الهدف */}
      <section className="surf" data-ek="pg-target" style={{ padding: "22px 20px", marginBottom: 14 }}>
        <div className="stats-top">
          <div>
            <div className="sec-t">{L("تقدم المشروع مقابل الهدف", "Project Progress vs. Target")}</div>
            <div className="eyebrow" style={{ marginTop: 4 }}>{L("متوسط الإنجاز لكل البلوكات", "Average completion across all blocks")} · {mFull(mi)}</div>
          </div>
          <div className="hero">
            <span className="hero-n mono">{hasCur ? `${cur.toFixed(2)}${PCT}` : "—"}</span>
          </div>
        </div>

        <Bar val={cur} color={gapColor} />
        <Ghost target={tgt} />
        <div className="gkey"><span><i className="k-f" style={{ background: gapColor }} />{L("الإنجاز الفعلي", "Actual")}</span><span><i className="k-g" />{L("هدف", "Target")} {mFull(mi)} · <b className="mono">{tgt != null ? `${tgt.toFixed(2)}${PCT}` : "—"}</b></span></div>

        <div className="gmeta">
          <span className="gm"><span className="gm-k">{L("الهدف", "Target")}</span> <span className="mono">{tgt != null ? `${tgt.toFixed(2)}${PCT}` : "—"}</span></span>
          {hasCur ? (
            <>
              <span className="dot" />
              <span className="gm" style={{ color: gapColor }}>
                {gap >= 0 ? L("فوق الهدف", "Above target") : L("دون الهدف", "Below target")} <span className="mono">{Math.abs(gap).toFixed(2)}</span> {L("نقطة", "pts")}
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
              {L("هدف هذا الشهر", "This month's target")} — {mFull(last)}: <span className="mono" style={{ color: T.brass }}>{TARGET[last].toFixed(2)}{PCT}</span>
            </div>
            <div style={{ marginTop: 6 }}>
              {L("آخر قراءة وصلت من المطور:", "Latest reading received from the developer:")} {mFull(lastData)}{" "}
              <span className="mono">{total.v[lastData].toFixed(2)}{PCT}</span>
              {nowGap != null && (
                <> — {L("الفارق عن هدف هذا الشهر", "difference from this month's target")}{" "}
                  <span className="mono" style={{ color: nowGap >= 0 ? ahead : behind }}>
                    {nowGap >= 0 ? `+${nowGap.toFixed(2)}` : nowGap.toFixed(2)}
                  </span> {L("نقطة", "pts")}</>
              )}
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
              {L("الفرق عن الهدف", "Difference from target")}: <span className="mono" style={{ color: g0 >= 0 ? ahead : behind }}>{g0 >= 0 ? `+${g0.toFixed(2)}` : g0.toFixed(2)}</span> ({mFull(i0)}) ← <span className="mono" style={{ color: g1 >= 0 ? ahead : behind }}>{g1 >= 0 ? `+${g1.toFixed(2)}` : g1.toFixed(2)}</span> ({mFull(i1)})
              {" · "}{L("الهدف", "Target")} <span className="mono">{targetStep.toFixed(2)}</span> {L("شهريًا", "/mo")} · {L("الفعلي", "Actual")} <span className="mono">{actualStep.toFixed(2)}</span>
            </div>
          );
        })()}
      </section>

      {/* المسار الزمني */}
      <section className="surf" data-ek="pg-timeline" style={{ padding: "20px 16px 14px", marginBottom: 14 }}>
        <div style={{ paddingRight: 4 }}>
          <div className="sec-t">{L("المسار الزمني", "Timeline")}</div>
          <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>
            {L("الإنجاز مقابل الهدف", "Progress vs. target")} · {mFull(chartFrom)} — {mFull(last)}
          </div>
        </div>
        <div style={{ height: 230, width: "100%" }}>
          <ResponsiveContainer>
            <ComposedChart data={trend} margin={{ top: 6, right: 4, left: 8, bottom: 4 }}>
              <CartesianGrid stroke={T.lineSoft} vertical={false} />
              <XAxis dataKey="m" reversed={lang === "ar"} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false}
                interval={0} />
              <YAxis orientation="right" domain={[20, 60]} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={36}
                tickFormatter={(v) => `${v}${PCT}`} />
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
      <section className="surf" data-ek="pg-phases" style={{ padding: "20px 18px", marginBottom: 14 }}>
        <div className="sec-t">{L("المراحل", "Phases")}</div>
        <div className="eyebrow" style={{ marginTop: 4, marginBottom: 6 }}>
          {L("الشريط الرمادي الرفيع تحت كل مرحلة = هدف", "The thin grey bar under each phase = target for")} {mFull(mi)} (<span className="mono">{tgt != null ? `${tgt.toFixed(2)}${PCT}` : "—"}</span>)
        </div>
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
                  <span className="mono grow-v">{v == null ? "—" : `${v.toFixed(2)}${PCT}`}</span>
                  <span className="mono grow-g" style={{ color: col }}>{g == null ? "—" : g >= 0 ? `+${g.toFixed(2)}` : g.toFixed(2)}</span>
                </span>
              </div>
              <Bar val={v} color={col} />
              <Ghost target={tgt} />
              <div className="grow-d">{L("التغيّر عن الشهر السابق", "Change vs. previous month")} <span className="mono" style={{ color: dColor(d) }}>{dText(d)}</span></div>
            </div>
          );
        })}
      </section>

      {/* البلوكات */}
      <section className="surf" data-ek="pg-blocks" style={{ padding: "20px 18px" }}>
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
            {L("الأشهر الباهتة بانتظار قراءة المطور.", "Faded months await developer data.")}
          </div>
        )}

        {mi > 0 && (() => {
          const moved = blocks.filter((r) => !stalled.includes(r)).map((r) => ({ b: r.b, d: delta(r.v, mi) })).filter((x) => x.d != null && x.d > 0);
          if (!moved.length && !stalled.length) return null;
          const top = moved.length ? moved.reduce((m, x) => (x.d > m.d ? x : m)) : null;
          const low = moved.length > 1 ? moved.reduce((m, x) => (x.d < m.d ? x : m)) : null;
          const rowsS = [
            top && [L("الأكثر تقدمًا", "Most progress"), `${L("بلوك", "Block")} ${top.b}`, `+${top.d.toFixed(2)}`, ahead],
            low && [L("الأقل تقدمًا", "Least progress"), `${L("بلوك", "Block")} ${low.b}`, `+${low.d.toFixed(2)}`, T.muted],
            stalled.length > 0 && [L("ثابتة", "Steady"), stalled.map((r) => r.b).join(" · "), `${stalled.length}`, behind],
          ].filter(Boolean);
          return (
            <div className="note-box" style={{ marginTop: 14, marginBottom: 4, display: "flex", flexDirection: "column", gap: 7 }}>
              {rowsS.map(([lbl, who, val, col]) => (
                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <span>{lbl}</span>
                  <span style={{ color: T.paper }}>{who}</span>
                  <span className="mono" style={{ color: col, minWidth: 44, textAlign: "end" }}>{val}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {tgt != null && (
          <div className="eyebrow" style={{ marginTop: 10 }}>
            {L(`الشريط الرمادي الرفيع: هدف ${mFull(mi)} (${tgt.toFixed(2)}${PCT}). العملات: دفعات جدول الدفعات (الملحق 3، خيار العملاء الممولين) المستحقة حسب نسبة إنجاز البلوك، وليست تأكيدًا للصرف.`,
              `Thin grey bar: ${mFull(mi)} target (${tgt.toFixed(2)}${PCT}). Dots: payments from the payment schedule (Annex 3, financed-client option) that are due by block completion, not confirmation of disbursement.`)}
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
                  <span className="brow-b">{L("بلوك", "Block")} <b className="mono">{r.b}</b></span>
                  <div className="brow-bar">
                    <Bar val={v} color={g == null ? T.muted : g >= 0 ? ahead : behind} />
                    {tgt != null && <div className="gbar-ghost" title={L("الهدف", "Target") + " " + mFull(mi)}><i style={{ width: `${Math.min(100, (tgt / scale) * 100)}%` }} /></div>}
                  </div>
                  <span className="brow-v mono">{v == null ? "—" : `${v.toFixed(2)}${PCT}`}</span>
                  <span className="brow-d mono" style={{ color: dColor(d) }}>{dText(d)}</span>
                  {v != null && <PayLine p={v} peak={Math.max(...r.v.slice(0, mi + 1).filter((x) => x != null))} />}
                </div>
              );
            })}
          </div>
        ))}

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
          if (!NOTE && !drops.length) return null;
          return (
            <details className="note-box" style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer" }}>{L("توضيحات على البيانات", "Data clarifications")} ({drops.length + (NOTE ? 1 : 0)})</summary>
              {NOTE && <div style={{ marginTop: 8 }}>{lang === "en" && NOTE === PG_NOTE ? PG_NOTE_EN : trText(lang, NOTE)}</div>}
              {drops.map((r) => (
                <div key={r.b}>
                  {L("بلوك", "Block")} {r.b} {L("تغيّرت قراءته من", "changed from")} <span className="mono">{r.from.toFixed(2)}{PCT}</span> {L("في", "in")} {mFull(r.m0)}{" "}
                  {L("إلى", "to")} <span className="mono">{r.to.toFixed(2)}{PCT}</span> {L("في", "in")} {mFull(r.m1)} — {L("يُرجَّح أنه تحديث لقياس سابق.", "likely an update to an earlier reading.")}
                </div>
              ))}
            </details>
          );
        })()}
      </section>
    </>
  );
}
