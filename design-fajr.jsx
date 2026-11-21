import React, { useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   طبقة التصميم «فجر» — التصميم الرابع للموقع العام (7.11.0).

   الفكرة: «ألبورادا» يعني الفجر. الموقع لوحة مخطط معماري ساعة الفجر:
     • ترويسة سماء فجر يطلع منها قرص الشمس خلف صف فلل المشروع
       (أربعة نماذج A1 · A2 · B · C) وتنوّر نوافذها وحدة وحدة،
       وفوقها محاور المخطط (دوائر الترقيم وخطوطها المتقطعة).
     • كل قسم «لوحة» من لوحات المخطط: إطار رفيع بعلامات زوايا،
       ورقم لوحة (A-01 …) جالس على خط الإطار.
     • الرقم الكبير تحته خط أبعاد، ورقم كل استفسار بدائرة مثل
       دوائر الإشارة في المخططات.
     • الخلفية شبكة مخطط باهتة تذوب للأسفل، وتوهّج فجر خفيف أعلى الصفحة.

   نفس معمارية «نوفا» و«بنّاء»: CSS تحت .dash[data-design="fajr"] يُلحق بآخر الأنماط،
   وعنصر واحد جديد (FajrHorizon) داخل الترويسة. ما يلمس أي منطق بيانات.
   الألوان: درجات الفجر ثابتة، والباقي من طقم الألوان المعتمد — يشتغل مع كل الأطقم.
   ═══════════════════════════════════════════════════════════ */

export const FAJR_FONT = "https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400..700&display=swap";

/* ── الفلل: أشكال مبسطة أصلية لكل نموذج (عرض، طابق أرضي، أول، غرفة سطح، نوافذ) ── */
const VILLA = {
  A1: { w: 124, g: 62, u: { x: 34, w: 84, h: 44 }, r: { x: 52, w: 26, h: 15 },
    uw: [[10, 7, 7, 26], [24, 7, 7, 26], [52, 9, 20, 13]], gw: [[8, 20, 30, 12], [52, 16, 10, 30], [86, 20, 26, 12]] },
  A2: { w: 116, g: 58, u: { x: 8, w: 100, h: 42 }, r: { x: 6, w: 24, h: 14 },
    uw: [[10, 9, 20, 12], [40, 9, 20, 12], [70, 9, 20, 12]], gw: [[12, 18, 9, 26], [32, 22, 40, 12], [94, 18, 9, 26]] },
  B: { w: 132, g: 56, u: { x: 6, w: 72, h: 50 }, r: { x: 40, w: 24, h: 14 }, slab: { x: 0, w: 92 },
    uw: [[10, 11, 12, 22], [30, 11, 12, 22], [52, 11, 10, 22]], gw: [[12, 22, 22, 12], [44, 22, 22, 12], [88, 18, 30, 16]] },
  C: { w: 146, g: 60, u: { x: 40, w: 92, h: 46 }, r: { x: 62, w: 24, h: 15 }, pool: true,
    uw: [[8, 9, 22, 14], [38, 9, 22, 14], [70, 9, 14, 24]], gw: [[8, 18, 8, 28], [22, 18, 8, 28], [52, 22, 30, 12], [98, 22, 36, 12]] },
};
const ROW = ["A1", "palm", "A2", "B", "palm", "C", "A1", "A2", "palm", "B", "C"];
const VH = 440;                 /* ارتفاع اللوحة — نسبة قريبة من الترويسة على الكمبيوتر فالفلل ما تتضخم */
const GROUND = 404;

function layout() {
  const out = []; let x = 18;
  ROW.forEach((k) => {
    if (k === "palm") { out.push({ k, x: x + 6 }); x += 40; return; }
    out.push({ k, x }); x += VILLA[k].w + 26;
  });
  return { items: out, width: x };
}

function Palm({ x }) {
  const b = GROUND, t = GROUND - 74;
  return (
    <g className="fj-palm">
      <path d={`M${x} ${b} C ${x - 3} ${b - 30}, ${x + 4} ${t + 26}, ${x + 1} ${t}`} fill="none" strokeWidth="3.2" strokeLinecap="round" />
      {[[-26, 8], [-18, -10], [0, -16], [18, -10], [26, 8], [10, 16], [-10, 16]].map(([dx, dy], i) => (
        <path key={i} d={`M${x + 1} ${t} Q ${x + 1 + dx * 0.5} ${t + dy - 10} ${x + 1 + dx} ${t + dy}`} fill="none" strokeWidth="2.6" strokeLinecap="round" />
      ))}
    </g>
  );
}

function Villa({ k, x, i }) {
  const v = VILLA[k];
  const gy = GROUND - v.g, uy = gy - v.u.h, ry = uy - v.r.h;
  return (
    <g className="fj-villa">
      <rect x={x} y={gy} width={v.w} height={v.g} />
      <rect x={x + v.u.x} y={uy} width={v.u.w} height={v.u.h + 1} />
      <rect x={x + v.r.x} y={ry} width={v.r.w} height={v.r.h + 1} />
      <rect x={x + v.u.x - 3} y={uy - 3} width={v.u.w + 6} height={3.5} />
      <rect x={x - 3} y={gy - 3} width={v.w + 6} height={3.5} />
      {v.slab && <rect x={x + v.slab.x - 8} y={gy - 4} width={v.slab.w + 8} height={4} />}
      {[...v.uw.map((w) => [x + v.u.x + w[0], uy + w[1], w[2], w[3]]), ...v.gw.map((w) => [x + w[0], gy + w[1], w[2], w[3]])].map(([wx, wy, ww, wh], j) => (
        <rect key={j} className={(i + j) % 3 === 2 ? "fj-win fj-off" : "fj-win"} x={wx} y={wy} width={ww} height={wh} style={{ "--d": `${(i * 0.23 + j * 0.37) % 2.6}s` }} />
      ))}
      {v.pool && <rect className="fj-pool" x={x + 8} y={GROUND + 3} width={58} height={5} rx="1.5" />}
    </g>
  );
}

/* نجوم آخر الليل — ثابتة (مولّد بسيط بذرة ثابتة) عشان ما تتغير مع كل رسمة */
function stars(n) {
  let s = 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => ({ x: r() * 1200, y: 8 + r() * 250, r: 0.6 + r() * 1.1, d: r() * 4 }));
}

export function FajrHorizon({ lang }) {
  const { items, width } = useMemo(layout, []);
  const st = useMemo(() => stars(34), []);
  const vw = width + 10;
  /* محاور المخطط: محور فوق منتصف كل فيلا */
  const axes = items.filter((it) => it.k !== "palm").map((it) => it.x + VILLA[it.k].w / 2);
  return (
    <div className="fj-sky no-print" aria-hidden="true">
      <svg viewBox={`0 0 ${vw} ${VH}`} preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
        <defs>
          <radialGradient id="fjSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--fj-sun)" stopOpacity="1" />
            <stop offset="38%" stopColor="var(--fj-sun)" stopOpacity=".95" />
            <stop offset="40%" stopColor="var(--fj-glow)" stopOpacity=".55" />
            <stop offset="100%" stopColor="var(--fj-glow)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fjHaze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fj-glow)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--fj-glow)" stopOpacity=".45" />
          </linearGradient>
        </defs>
        <g className="fj-stars">
          {st.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} style={{ "--d": `${p.d}s` }} />)}
        </g>
        <rect x="0" y={GROUND - 150} width={vw} height="150" fill="url(#fjHaze)" />
        <g className="fj-sun"><circle cx={vw * 0.56} cy={GROUND - 6} r="190" fill="url(#fjSun)" /></g>
        <g className="fj-axes">
          {axes.map((ax, i) => (
            <g key={i}>
              <line x1={ax} y1={GROUND - 146} x2={ax} y2={GROUND} />
              <circle cx={ax} cy={GROUND - 158} r="11" />
              <text x={ax} y={GROUND - 154} textAnchor="middle">{i + 1}</text>
            </g>
          ))}
        </g>
        <g className="fj-sil">
          {items.map((it, i) => (it.k === "palm" ? <Palm key={i} x={it.x} /> : <Villa key={i} k={it.k} x={it.x} i={i} />))}
          <rect x="0" y={GROUND} width={vw} height={VH - GROUND} />
        </g>
        <g className="fj-dim">
          <line x1="18" y1={GROUND + 20} x2={width - 8} y2={GROUND + 20} />
          {items.filter((it) => it.k !== "palm").map((it, i) => (
            <g key={i}>
              <line x1={it.x} y1={GROUND + 14} x2={it.x} y2={GROUND + 26} />
              <line x1={it.x + VILLA[it.k].w} y1={GROUND + 14} x2={it.x + VILLA[it.k].w} y2={GROUND + 26} />
              <text x={it.x + VILLA[it.k].w / 2} y={GROUND + 16} textAnchor="middle">{it.k}</text>
            </g>
          ))}
        </g>
      </svg>
      <div className="fj-kicker" dir={lang === "en" ? "ltr" : "rtl"}>
        {lang === "en" ? "ALBORADA · DAHOM — AL-FURSAN" : "ألبورادا داهوم · حي الفرسان"}
      </div>
    </div>
  );
}

/* ── رقم اللوحة لكل قسم ── */
const SHEETS = { status: "A-01", where: "A-02", cats: "A-03" };

export function fajrCss(T, resolved, reduced) {
  const D = '.dash[data-design="fajr"]';
  const dark = resolved === "dark";
  const ink = T.paper;
  const mix = (c, p, b = "transparent") => `color-mix(in srgb,${c} ${p}%,${b})`;
  const K = `'Reem Kufi','IBM Plex Sans Arabic',system-ui,sans-serif`;
  const B = `'IBM Plex Sans Arabic',system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif`;
  const sun = dark ? "#FFC98A" : "#F7A866";
  const glow = dark ? "#FF8F57" : "#F59A62";
  const dawn = dark ? "#F2A15F" : "#D9773F";             /* لون الفجر للعناصر (مقروء على الخلفية) */
  const sky = dark
    ? "linear-gradient(180deg,#0A0F2A 0%,#1C2150 34%,#4A3363 58%,#9A4F5E 76%,#E0855A 91%,#F4B26C 100%)"
    : "linear-gradient(180deg,#C9D8EA 0%,#DCDDEB 30%,#EFD9D6 56%,#F5C9A9 78%,#F4AE7D 94%,#F29F68 100%)";
  const sil = dark ? "#090C1C" : mix(ink, 86, "#3B2433");
  const corner = mix(ink, dark ? 46 : 40);
  const L = (pos) => `linear-gradient(${corner},${corner}) ${pos}`;
  const corners = [
    L("left 9px top 9px/14px 1.5px"), L("left 9px top 9px/1.5px 14px"),
    L("right 9px top 9px/14px 1.5px"), L("right 9px top 9px/1.5px 14px"),
    L("left 9px bottom 9px/14px 1.5px"), L("left 9px bottom 9px/1.5px 14px"),
    L("right 9px bottom 9px/14px 1.5px"), L("right 9px bottom 9px/1.5px 14px"),
  ].map((s) => s + " no-repeat").join(",");
  const motion = !reduced;

  return `
/* ══════════ تصميم «فجر» ══════════ */
${D}{--fj-sun:${sun};--fj-glow:${glow};--fj-dawn:${dawn};--fj-sil:${sil};--fj-ink:${ink};
  --fj-rule:${mix(ink, dark ? 16 : 13)};--fj-rule2:${mix(ink, dark ? 9 : 7)};--fj-hover:${mix(dawn, dark ? 9 : 7)};
  --fj-h:236px;background:${T.bg};color:${ink};font-family:${B};}
@media(min-width:900px){${D}{--fj-h:300px;}}
${D} ::selection{background:${mix(dawn, 30)};}
${D} .skin-aurora,${D} .skin-grid,${D} .skin-paper,${D} .skin-najd,${D} .skin-andalus-bg,${D} .skin-andalus-top{display:none!important;}

/* الخلفية: توهّج فجر أعلى الصفحة + شبكة مخطط باهتة تذوب للأسفل */
${D}::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse 70% 38% at 70% 0%,${mix(glow, dark ? 16 : 20)},transparent 70%),
    linear-gradient(${mix(ink, dark ? 6 : 5)} 1px,transparent 1px) 0 0/28px 28px,
    linear-gradient(90deg,${mix(ink, dark ? 6 : 5)} 1px,transparent 1px) 0 0/28px 28px,
    linear-gradient(${mix(ink, dark ? 9 : 8)} 1px,transparent 1px) 0 0/140px 140px,
    linear-gradient(90deg,${mix(ink, dark ? 9 : 8)} 1px,transparent 1px) 0 0/140px 140px;
  -webkit-mask-image:linear-gradient(180deg,#000 0%,rgba(0,0,0,.55) 40%,transparent 85%);
  mask-image:linear-gradient(180deg,#000 0%,rgba(0,0,0,.55) 40%,transparent 85%);}
${D} > .wrap{position:relative;z-index:1;}
${D} .mono{font-variant-numeric:tabular-nums;}

/* ═══ ١. الترويسة: سماء الفجر ═══ */
${D} .wrap{max-width:1180px;}
${D} header{position:relative;padding-top:10px;}
${D} .fj-sky{position:absolute;top:10px;inset-inline:0;height:var(--fj-h);border-radius:20px;overflow:hidden;background:${sky};
  box-shadow:0 1px 0 ${mix(ink, 10)},0 30px 60px -40px ${mix(glow, dark ? 60 : 50)};}
${D} .fj-sky svg{position:absolute;inset:0;display:block;}
${D} .fj-sil rect,${D} .fj-sil{fill:var(--fj-sil);}
${D} .fj-palm path{stroke:var(--fj-sil);}
${D} .fj-sil .fj-win{fill:${dark ? "#FFD08C" : "#FFE9CF"};opacity:${dark ? ".9" : ".6"};}
${D} .fj-sil .fj-off{fill:${dark ? "#262B4A" : "#6A5562"};opacity:1;}
${D} .fj-pool{fill:${dark ? "#F4B26C" : "#FFF1DE"}!important;opacity:.8;}
${D} .fj-stars circle{fill:#fff;opacity:${dark ? ".75" : "0"};}
${D} .fj-axes line{stroke:${dark ? "rgba(255,255,255,.22)" : mix(ink, 22)};stroke-width:1;stroke-dasharray:2 5;}
${D} .fj-axes circle{fill:none;stroke:${dark ? "rgba(255,255,255,.42)" : mix(ink, 38)};stroke-width:1.2;}
${D} .fj-axes text{fill:${dark ? "rgba(255,255,255,.7)" : mix(ink, 60)};font:600 12px ${B};}
${D} .fj-dim line{stroke:${dark ? "rgba(255,210,160,.55)" : "rgba(255,240,225,.75)"};stroke-width:1;}
${D} .fj-dim text{fill:${dark ? "rgba(255,214,170,.8)" : "rgba(255,244,232,.92)"};font:600 12px ${B};letter-spacing:.08em;}
${D} .fj-kicker{position:absolute;top:22px;inset-inline-start:24px;font:600 11.5px/1 ${B};letter-spacing:.06em;
  color:${dark ? "rgba(255,255,255,.72)" : mix(ink, 62)};display:flex;align-items:center;gap:9px;}
${D} .fj-kicker::before{content:"";width:22px;height:1.5px;background:var(--fj-dawn);}
${D} .head{position:relative;z-index:1;min-height:var(--fj-h);padding:50px 24px 24px;align-items:flex-start;gap:14px 20px;}
@media(max-width:767.98px){
  ${D}{--fj-h:300px;}
  ${D} .head{padding:84px 18px 20px;}
  ${D} .fj-kicker{top:62px;inset-inline-start:18px;font-size:11px;}
  ${D} .acts{position:absolute;top:12px;inset-inline-end:12px;}
}
${D} .disp,${D} .h1{font-family:${K};}
${D} .h1{font-weight:700;font-size:clamp(30px,7.4vw,58px);line-height:1.15;letter-spacing:0;margin:0;
  color:${dark ? "#FFF7EE" : ink};text-shadow:${dark ? "0 2px 24px rgba(10,15,42,.55)" : "0 1px 0 rgba(255,255,255,.4)"};max-width:14ch;}
${D} .acts .seg{background:${dark ? "rgba(10,15,42,.45)" : "rgba(255,255,255,.55)"};-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  border-radius:10px;box-shadow:inset 0 0 0 1px ${dark ? "rgba(255,255,255,.14)" : mix(ink, 12)};}
${D} .acts .seg-b{color:${dark ? "rgba(255,255,255,.75)" : mix(ink, 70)};border-radius:7px;}
${D} .acts .seg-b[data-on="1"]{background:${dark ? "rgba(255,255,255,.92)" : ink}!important;color:${dark ? "#141833" : T.bg}!important;}
${D} .stamp{background:none;border-radius:0;padding:16px 4px 0;margin-top:14px;font-size:12.5px;color:${T.muted};}
${D} .join-btn{border-radius:10px;background:linear-gradient(135deg,var(--fj-dawn),${mix(T.brass, 70, dawn)});color:#fff;
  box-shadow:0 8px 22px -12px ${mix(glow, 80)};}
${D} .dot{background:${T.faint};}

${motion ? `
${D} .fj-sun{animation:fjRise 2.6s cubic-bezier(.2,.7,.2,1) both;transform-box:fill-box;}
${D} .fj-sky{animation:fjSky 2.6s ease-out both;}
${D} .fj-win{animation:fjLight .9s ease-out both;animation-delay:calc(1.1s + var(--d));}
${D} .fj-stars circle{animation:fjTw 4s ease-in-out infinite;animation-delay:var(--d);}
${D} .fj-axes{animation:fjFade 1.4s .9s ease-out both;}
${D} .fj-dim{animation:fjFade 1.4s 1.6s ease-out both;}
@keyframes fjRise{from{transform:translateY(70px);opacity:.3;}to{transform:none;opacity:1;}}
@keyframes fjSky{from{filter:brightness(.62) saturate(.8);}to{filter:none;}}
@keyframes fjLight{from{opacity:0;}}
@keyframes fjTw{0%,100%{opacity:${dark ? ".75" : "0"};}50%{opacity:${dark ? ".25" : "0"};}}
@keyframes fjFade{from{opacity:0;}to{opacity:1;}}` : ""}

/* ═══ ٢. التبويبات: مسطرة مقياس ═══ */
${D} .tabs{gap:2px;margin-top:20px;margin-bottom:14px;padding:5px;border-radius:14px;background:${T.surface};
  box-shadow:inset 0 0 0 1px var(--fj-rule);flex-wrap:nowrap;position:relative;}
${D} .tabs.tabs-glass{background:${mix(T.surface, 88)};-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);}
${D} .tabs::after{content:"";position:absolute;inset-inline:14px;bottom:2px;height:4px;pointer-events:none;opacity:.5;
  background:repeating-linear-gradient(90deg,var(--fj-rule) 0 1px,transparent 1px 12px);}
${D} .tab{flex:1 1 0;min-height:48px;border:0;border-radius:10px;background:transparent;color:${T.muted};
  font-family:${K};font-weight:500;font-size:15px;padding:11px 14px;box-shadow:none;white-space:nowrap;position:relative;}
${D} .tab:hover{color:${ink};background:var(--fj-hover);}
${D} .tab[data-on="1"]{color:${ink};background:${mix(dawn, dark ? 16 : 12)};box-shadow:inset 0 -2.5px 0 var(--fj-dawn);font-weight:700;}
${D} .tab[data-on="1"] .tab-ic{color:var(--fj-dawn);}
${D} .tab-n{border-radius:999px;background:${mix(ink, 8)};color:${T.muted};font-family:${B};}
${D} .tab[data-on="1"] .tab-n{background:var(--fj-dawn);color:#fff;}
${D} .tab-indicator{display:none!important;}
@media(max-width:767.98px){
  ${D} .tabs{overflow-x:auto;scrollbar-width:none;scroll-snap-type:x proximity;}
  ${D} .tabs::-webkit-scrollbar{display:none;}
  ${D} .tab{flex:none;min-height:44px;padding:9px 15px;scroll-snap-align:start;font-size:14px;}
}
${D} .scroll-progress{background:linear-gradient(90deg,var(--fj-dawn),var(--fj-sun));height:3px;}
${D} .mini-bar{background:${mix(T.bg, 92)};-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--fj-rule);}

/* ═══ ٣. الأقسام: لوحات مخطط ═══ */
${D} .surf,${D} .stats{position:relative;border:1px solid var(--fj-rule)!important;border-radius:12px;box-shadow:none;
  background:${corners},${T.surface};-webkit-backdrop-filter:none;backdrop-filter:none;}
${D} .tab-panel > section.surf{margin-bottom:14px!important;}
${D} section.surf[data-sec]::after{position:absolute;top:-9px;inset-inline-end:20px;padding:1px 8px;border-radius:5px;
  font:600 10.5px/16px ${B};letter-spacing:.08em;color:${T.muted};background:${T.bg};
  box-shadow:inset 0 0 0 1px var(--fj-rule);direction:ltr;}
${Object.entries(SHEETS).map(([k, v]) => `${D} section.surf[data-sec="${k}"]::after{content:"${v}";}`).join("\n")}
${D} .sec-t{font-family:${K};font-weight:700;font-size:20px;line-height:1.45;letter-spacing:0;color:${ink};}
${D} .eyebrow{font-size:12.5px;color:${T.muted};}
${D} .sec-lbl{font-size:12px;color:${T.muted};}

@media(min-width:1040px){${D} .tab-panel[data-tab="overview"] > .surf{padding:26px 28px!important;}}
}

/* ═══ ٤. حالة السجل: الرقم الكبير بخط أبعاد ═══ */
${D} .stats{padding:24px 20px 18px;}
${D} .hero{position:relative;padding-bottom:12px;gap:10px;}
${D} .hero::after{content:"";position:absolute;bottom:0;inset-inline:0;height:9px;
  border-inline:1.5px solid var(--fj-dawn);background:linear-gradient(var(--fj-dawn),var(--fj-dawn)) center/100% 1.5px no-repeat;}
${D} .hero-n{font-family:${K};font-weight:700;font-size:clamp(52px,12vw,76px);line-height:1;color:${ink};}
${D} .hero-k{font-size:14px;color:${T.muted};}
${D} .bar{border-radius:4px;height:12px;}
${D} .legend{gap:4px;margin-top:16px;}
${D} .lg{border-radius:8px;padding:10px 9px;}
${D} .lg:hover{background:var(--fj-hover);}
${D} .lg-d{width:11px;height:11px;border-radius:2px;transform:rotate(45deg);}
${D} .lg-n{font-family:${K};font-weight:700;font-size:18px;color:${ink};}
${D} .lg-p{font-size:12px;color:${T.muted};}
${D} .stats-foot{border-top:1px dashed var(--fj-rule);font-size:12.5px;}

/* ═══ ٥. القوائم ═══ */
${D} .lrow{border-radius:8px;padding:12px 8px;}
${D} .lrow+.lrow{border-top:1px dashed var(--fj-rule2);}
${D} .lrow:hover,${D} .zrow:hover,${D} .prow:hover{background:var(--fj-hover);}
${D} .zbar,${D} .pbar{border-radius:2px;background:${mix(ink, dark ? 10 : 7)};}
${D} .zbar > div,${D} .pbar > div{border-radius:2px;background:var(--fj-dawn)!important;opacity:.85!important;}
${D} .prow-n{font-family:${K};font-weight:700;}
${D} .chip,${D} .fchip,${D} .cat-pill,${D} .tag{border-radius:999px;}
${D} .icon-btn,${D} .mini-bar-jump,${D} .srch,${D} .sel{border-radius:10px;}
${D} .srch:focus,${D} .sel:focus{border-color:var(--fj-dawn);box-shadow:0 0 0 3px ${mix(dawn, 18)};outline:none;}
${D} .big-btn{border-radius:10px;background:var(--fj-dawn);color:#fff;}
${D} .wide-btn{border-radius:10px;}
${D} :is(.tab,.icon-btn,.chip,.seg-b,.wide-btn,.big-btn,.lg,.lrow,.zrow,.prow,.doc-card,.card,.mseg-b):focus-visible{
  outline:2px solid var(--fj-dawn);outline-offset:2px;}

/* ═══ ٦. بطاقات الاستفسارات: رقم البند بدائرة إشارة ═══ */
${D} .card{border:1px solid var(--fj-rule)!important;border-radius:12px;background:${T.surface}!important;box-shadow:none!important;
  -webkit-backdrop-filter:none!important;backdrop-filter:none!important;transition:border-color .2s ease,transform .2s ease;}
${D} .card:hover{border-color:${mix(dawn, 70)}!important;transform:translateY(-2px);}
${D} .card::before,${D} .cards > .card::before{display:none!important;}
${D} .card-wm{display:none;}
${D} .card-id{display:inline-grid;place-items:center;min-width:34px;height:34px;padding:0 6px;border-radius:999px;
  box-shadow:inset 0 0 0 1.5px ${ink};font-family:${K};font-weight:700;font-size:13px;color:${ink};}
${D} .card-note{font-size:15px;line-height:1.9;}
${D} .tbl-wrap{border-radius:12px;border:1px solid var(--fj-rule);background:${T.surface};}
${D} .tbl th{font-weight:600;font-size:12px;color:${T.muted};border-bottom:1.5px solid ${ink};}
${D} .trow td{border-bottom:1px dashed var(--fj-rule2);}
${D} .trow:hover{background:var(--fj-hover);}
${D} .tbl td.td-id{font-family:${K};font-weight:700;}

/* ═══ ٧. النوافذ ═══ */
${D} .sheet{border-radius:18px 18px 0 0;background:${T.surface};border:1px solid var(--fj-rule);}
@media(min-width:640px){${D} .sheet{border-radius:16px;}}
${D} .sheet-id{font-family:${K};font-weight:700;}
${D} .reply-box,${D} .note-box{border-radius:10px;}

/* ═══ ٨. التقدّم والمخططات ═══ */
${D} .gbar{border-radius:3px;}
${D} .gbar-f{border-radius:3px;}
${D} .grow-v,${D} .brow-v{font-family:${K};font-weight:700;}
${D} .doc-card{border:1px solid var(--fj-rule);border-radius:12px;background:${corners},${T.surface};box-shadow:none;}
${D} .doc-card:hover{border-color:${mix(dawn, 70)};}
${D} .doc-name{font-family:${K};font-weight:700;}
${D} .top-fab{border-radius:12px;background:var(--fj-dawn);color:#fff;border:0;}

@media(prefers-reduced-motion:reduce){${D} .fj-sun,${D} .fj-sky,${D} .fj-win,${D} .fj-stars circle,${D} .fj-axes,${D} .fj-dim{animation:none!important;}}
@media print{${D}::before{display:none;}${D} .head{min-height:0;padding:0;}${D} .h1{color:#000;text-shadow:none;}}
`;
}
