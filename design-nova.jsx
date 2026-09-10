import React, { useEffect } from "react";

/* ═══════════════════════════════════════════════════════════
   طبقة التصميم «نوفا» — إعادة تصميم وترتيب كاملة للموقع العام.

   الفكرة المعمارية:
   الملف هذا طبقة مستقلة تمامًا. ما يعرف شيء عن منطق البيانات، وما يعدّل
   أي مكوّن. يشتغل بالكامل عبر:
     ١) CSS بأسبقية أعلى تحت المُحدِّد .dash[data-design="nova"]
     ٢) طبقات خلفية متحركة تُركَّب فوق الصفحة
     ٣) خطّاف صغير يضيف كشف التمرير وتتبّع المؤشر

   التصميم القديم يبقى كما هو حرفيًا، والجديد يُركَّب/يُفصل بمفتاح واحد
   من لوحة الإدارة (عمود active_design بجدول site_settings).
   ═══════════════════════════════════════════════════════════ */

export const DESIGN_KEYS = ["classic", "nova"];
export const DEFAULT_DESIGN_KEY = "classic";

export const DESIGNS = {
  classic: {
    label: "الكلاسيكي",
    labelEn: "Classic",
    note: "التصميم الأصلي — بطاقات مصمتة، أقسام متتابعة بالطول، حركة هادئة.",
  },
  nova: {
    label: "نوفا",
    labelEn: "Nova",
    note: "تصميم وترتيب جديدان — ترويسة بارزة، تخطيط بعمودين على الشاشات الكبيرة، ألواح زجاجية، خلفية شفقية متحركة، وظهور تدريجي مع التمرير.",
  },
};

/* ── طبقات الخلفية: تُركَّب فقط لما يكون «نوفا» معتمد ── */
export function NovaLayers() {
  return (
    <>
      <div className="nv-bg no-print" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <div className="nv-grain no-print" aria-hidden="true" />
      <div className="nv-glow no-print" aria-hidden="true" />
    </>
  );
}

/* ── الخطّاف: كشف التمرير + إضاءة تتبع المؤشر ──
   كله بمستمع واحد على الجذر (تفويض الأحداث) عشان ما نثقّل الجوال. */
export function useNovaRuntime(on, reduced) {
  useEffect(() => {
    if (!on) return;
    const root = document.querySelector(".dash");
    if (!root) return;

    root.classList.add("nv-js");

    /* ١) الظهور التدريجي عند دخول العنصر للشاشة */
    let io = null;
    let stopMo = () => {};
    if (!reduced && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add("nv-in"); io.unobserve(e.target); }
          });
        },
        { threshold: 0.06, rootMargin: "0px 0px -6% 0px" }
      );
      const watch = () => root.querySelectorAll(".surf:not(.nv-in),.doc-card:not(.nv-in)").forEach((el) => io.observe(el));
      watch();
      /* عناصر تجي متأخّرة (تبديل تبويب، فلترة، تحميل تدريجي) */
      let tick = 0;
      const mo = new MutationObserver(() => {
        if (tick) return;
        tick = requestAnimationFrame(() => { tick = 0; watch(); });
      });
      mo.observe(root, { childList: true, subtree: true });
      stopMo = () => { mo.disconnect(); if (tick) cancelAnimationFrame(tick); };
    } else {
      root.classList.add("nv-all-in");
    }

    /* ٢) إضاءة تتبع المؤشر — لأجهزة المؤشر فقط */
    let stopPtr = () => {};
    if (!reduced && window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
      let raf = 0, lx = 0, ly = 0, hot = null;
      const onMove = (ev) => {
        lx = ev.clientX; ly = ev.clientY;
        hot = ev.target instanceof Element ? ev.target.closest(".card,.surf,.doc-card,.lrow") : null;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          root.style.setProperty("--nv-gx", lx + "px");
          root.style.setProperty("--nv-gy", ly + "px");
          if (hot) {
            const r = hot.getBoundingClientRect();
            hot.style.setProperty("--mx", (lx - r.left) + "px");
            hot.style.setProperty("--my", (ly - r.top) + "px");
          }
        });
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      stopPtr = () => { window.removeEventListener("pointermove", onMove); if (raf) cancelAnimationFrame(raf); };
    }

    return () => {
      root.classList.remove("nv-js", "nv-all-in");
      if (io) io.disconnect();
      stopMo();
      stopPtr();
    };
  }, [on, reduced]);
}

/* ═══════════════════════════════════════════════════════════
   ورقة أنماط «نوفا» — تُلحق بآخر أنماط الموقع فتغلب عليها.
   T: كائن الألوان الحالي (نفس مفاتيح الثيم)، resolved: light|dark
   ═══════════════════════════════════════════════════════════ */
export function novaCss(T, resolved, reduced) {
  const D = '.dash[data-design="nova"]';
  const dark = resolved === "dark";
  const A = T.brass;
  const B = T.sta["معتمدة"] || T.zone;
  const C = T.pri["عالية جدًا"] || T.brass;
  const mix = (c, p) => `color-mix(in srgb,${c} ${p}%,transparent)`;
  const glassBg = dark
    ? `linear-gradient(158deg,${mix(T.surface, 82)},${mix(T.surface, 58)})`
    : `linear-gradient(158deg,${mix(T.surface, 92)},${mix(T.surface, 74)})`;
  const hair = dark ? "rgba(255,255,255,.09)" : "rgba(16,42,58,.075)";
  const lift = dark
    ? "0 1px 0 rgba(255,255,255,.04) inset,0 18px 44px -26px rgba(0,0,0,.9)"
    : "0 1px 0 rgba(255,255,255,.75) inset,0 18px 42px -28px rgba(16,42,58,.42)";
  const liftUp = dark
    ? "0 1px 0 rgba(255,255,255,.06) inset,0 30px 62px -28px rgba(0,0,0,.95)"
    : "0 1px 0 rgba(255,255,255,.85) inset,0 30px 58px -30px rgba(16,42,58,.5)";

  return `
/* ══════════ تصميم نوفا ══════════ */
${D}{--nv-a:${A};--nv-b:${B};--nv-c:${C};--nv-hair:${hair};
  --nv-grad:linear-gradient(115deg,${A},${B});
  --nv-gx:50vw;--nv-gy:-20vh;
  background:${T.bg};}

/* أطقم الخلفية القديمة تُطفأ — نوفا له خلفيته */
${D} .skin-aurora,${D} .skin-grid,${D} .skin-paper{display:none!important;}

/* ⚠ العناصر الطافية (النوافذ، عارض المخططات، زر الأعلى، شريط التقدّم) تبقى
   position:fixed كما هي — استثناؤها هنا إلزامي وإلا نزلت داخل مجرى الصفحة. */
${D} > *:not(.nv-bg):not(.nv-grain):not(.nv-glow):not(.ovl):not(.top-fab):not(.dvw):not(.scroll-progress){
  position:relative;z-index:1;}

/* ── ١. الخلفية الشفقية ── */
${D} .nv-bg{position:fixed;inset:-18%;z-index:0;pointer-events:none;overflow:hidden;
  filter:blur(78px);opacity:${dark ? ".52" : ".34"};}
${D} .nv-bg i{position:absolute;display:block;border-radius:50%;will-change:transform;}
${D} .nv-bg i:nth-child(1){width:56vw;height:56vw;top:-6%;inset-inline-end:-10%;
  background:radial-gradient(circle,${A} 0%,transparent 66%);animation:nvdrift 30s ease-in-out infinite alternate;}
${D} .nv-bg i:nth-child(2){width:48vw;height:48vw;top:26%;inset-inline-start:-14%;
  background:radial-gradient(circle,${B} 0%,transparent 68%);animation:nvdrift 38s ease-in-out -12s infinite alternate-reverse;}
${D} .nv-bg i:nth-child(3){width:44vw;height:44vw;bottom:-8%;inset-inline-end:14%;
  background:radial-gradient(circle,${C} 0%,transparent 70%);animation:nvdrift 34s ease-in-out -20s infinite alternate;}
${D} .nv-bg i:nth-child(4){width:38vw;height:38vw;bottom:22%;inset-inline-start:22%;
  background:radial-gradient(circle,${T.zone} 0%,transparent 72%);animation:nvdrift 44s ease-in-out -6s infinite alternate-reverse;}
@keyframes nvdrift{from{transform:translate3d(0,0,0) scale(1);}to{transform:translate3d(-6%,8%,0) scale(1.22);}}

${D} .nv-grain{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:${dark ? ".05" : ".035"};
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");}

${D} .nv-glow{display:none;}
@media(hover:hover) and (pointer:fine){
  ${D}.nv-js .nv-glow{display:block;position:fixed;inset:0;z-index:0;pointer-events:none;
    background:radial-gradient(420px circle at var(--nv-gx) var(--nv-gy),${mix(A, dark ? 13 : 9)},transparent 62%);}
}

/* ═══ ٢. إعادة الترتيب: الترويسة كلوحة بارزة ═══ */
${D} .wrap{max-width:1240px;padding-top:14px;}
@media(min-width:768px){${D} .wrap{padding:22px 28px 60px;}}

${D} header{position:relative;overflow:hidden;padding:22px 18px 20px;margin-bottom:6px;
  border-radius:26px;border:1px solid var(--nv-hair);background:${glassBg};
  -webkit-backdrop-filter:blur(20px) saturate(170%);backdrop-filter:blur(20px) saturate(170%);
  box-shadow:${lift};}
@media(min-width:768px){${D} header{padding:30px 28px 26px;}}
${D} header::before{content:"";position:absolute;inset-inline-end:-70px;top:-110px;width:300px;height:300px;
  border-radius:50%;pointer-events:none;background:radial-gradient(circle,${mix(A, 26)},transparent 66%);}
${D} header::after{content:"";position:absolute;top:0;inset-inline:12%;height:1px;pointer-events:none;
  background:linear-gradient(90deg,transparent,${mix(A, 60)},transparent);}
${D} .head{position:relative;align-items:center;}
${D} .h1{background:var(--nv-grad);-webkit-background-clip:text;background-clip:text;color:transparent;
  font-size:clamp(26px,6vw,40px);letter-spacing:-.015em;filter:saturate(1.1);}
${D} .meta-line{margin-top:16px;}
${D} .stamp{position:relative;}

/* شريط الأدوات: حبّة زجاجية تجمع الأزرار */
@media(min-width:768px){
  ${D} .acts{padding:6px;border-radius:18px;background:${mix(T.sunken, 62)};
    border:1px solid var(--nv-hair);gap:6px;}
}

/* ═══ ٣. إعادة الترتيب: «نظرة عامة» بعمودين على الشاشات الكبيرة ═══
   الأقسام موسومة بـ data-sec، فالترتيب ما يعتمد على موضع العنصر. */
${D} .tab-panel[data-tab="overview"] > section{margin-bottom:0!important;}
${D} .tab-panel[data-tab="overview"]{display:grid;grid-template-columns:1fr;gap:14px;align-items:start;}
@media(min-width:1040px){
  ${D} .tab-panel[data-tab="overview"]{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;}
  ${D} [data-sec="status"],${D} [data-sec="where"],${D} [data-sec="charts"]{grid-column:1/-1;}
  ${D} [data-sec="latest"]{order:3;}
  ${D} [data-sec="cats"]{order:4;}
  ${D} [data-sec="charts"]{order:5;}
}

/* ═══ ٤. الألواح الزجاجية ═══ */
${D} .surf,${D} .stats{background:${glassBg};
  -webkit-backdrop-filter:blur(18px) saturate(165%);backdrop-filter:blur(18px) saturate(165%);
  border:1px solid var(--nv-hair);border-radius:24px;box-shadow:${lift};position:relative;}
${D} .surf::after{content:"";position:absolute;top:0;inset-inline:14%;height:1px;pointer-events:none;
  background:linear-gradient(90deg,transparent,${mix(A, 55)},transparent);}
${D} .sec-t{font-size:17px;letter-spacing:-.005em;}

/* ═══ ٥. الأزرار والرقاقات ═══
   ⚠ الأزرار المملوءة باللون (big-btn، icon-btn الأساسي) لها قاعدتها الخاصة
   بالأسفل — ممنوع تُدرج ضمن مجموعة الزجاج وإلا صار نصها أبيض على أبيض. */
${D} .icon-btn,${D} .chip,${D} .wide-btn,${D} .ff,${D} .sheet-nav-b,${D} .fb-btn{
  position:relative;overflow:hidden;border-radius:14px;
  border:1px solid var(--nv-hair);background:${mix(T.surface, dark ? 62 : 80)};
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  transition:transform .2s cubic-bezier(.22,1,.36,1),border-color .2s ease,color .2s ease,box-shadow .25s ease;}
${D} .chip{border-radius:999px;}
${D} .icon-btn::before,${D} .chip::before,${D} .wide-btn::before,${D} .big-btn::before{
  content:"";position:absolute;inset:0;transform:translateX(-120%);pointer-events:none;
  background:linear-gradient(105deg,transparent 30%,${mix("#ffffff", 30)} 50%,transparent 70%);}
${D} .icon-btn:hover::before,${D} .chip:hover::before,${D} .wide-btn:hover::before,${D} .big-btn:hover::before{
  transform:translateX(120%);transition:transform .72s cubic-bezier(.22,1,.36,1);}
${D} .icon-btn:hover,${D} .chip:hover,${D} .ff:hover,${D} .sheet-nav-b:hover,${D} .fb-btn:hover{
  transform:translateY(-2px);border-color:${mix(A, 55)};box-shadow:0 10px 24px -16px ${mix(A, 80)};}
${D} .icon-btn:active,${D} .chip:active,${D} .wide-btn:active{transform:translateY(0) scale(.97);}
${D} .sheet-nav-b:disabled,${D} .sheet-nav-b:disabled:hover{transform:none;box-shadow:none;}

/* الأزرار المملوءة — تدرّج لوني ونص بلون التباين */
${D} .big-btn,${D} .icon-btn[data-primary="1"],${D} .chip[data-on="1"]{
  background:var(--nv-grad);color:${T.onAccent};border:none;border-radius:15px;
  box-shadow:0 12px 28px -14px ${mix(A, 95)};}
${D} .big-btn{padding:15px;font-weight:600;letter-spacing:.01em;}
${D} .big-btn:hover,${D} .icon-btn[data-primary="1"]:hover{filter:brightness(1.06);
  transform:translateY(-2px);color:${T.onAccent};}
${D} .fchip{border-radius:999px;transition:transform .2s cubic-bezier(.22,1,.36,1),background .2s ease;}
${D} .fchip:hover{transform:translateY(-2px);}

${D} .chip-urgent{border-color:${mix(T.pri["عالية جدًا"], 60)};}
${D} .chip-urgent.chip-glow{animation:nvpulse 2.8s ease-in-out infinite;}
@keyframes nvpulse{0%,100%{box-shadow:0 0 0 0 ${mix(T.pri["عالية جدًا"], 42)};}
  55%{box-shadow:0 0 0 9px ${mix(T.pri["عالية جدًا"], 0)};}}

/* ═══ ٦. شريط التبويبات: حبّة عائمة ═══ */
${D} .tabs{margin-inline:0;padding:8px;border-radius:20px;gap:5px;
  background:${mix(T.surface, dark ? 55 : 72)};border:1px solid var(--nv-hair);
  -webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);
  box-shadow:${lift};}
@media(min-width:768px){${D} .tabs{margin-inline:0;padding:8px;}}
${D} .tabs.tabs-glass{background:${mix(T.surface, dark ? 72 : 84)};box-shadow:${liftUp};}
${D} .tab{border:none;background:transparent;border-radius:14px;padding:11px 16px;
  transition:color .22s ease,background .28s cubic-bezier(.22,1,.36,1),transform .2s ease;}
${D} .tab:hover{background:${mix(A, 10)};}
${D} .tab[data-on="1"]{background:var(--nv-grad);color:${T.onAccent};
  box-shadow:0 10px 24px -14px ${mix(A, 95)};}
${D} .tab[data-on="1"] .tab-n{background:${mix("#ffffff", 24)};color:inherit;}
${D} .tab-indicator{display:none;}
${D} .mini-bar{border-radius:0 0 18px 18px;background:${mix(T.surface, dark ? 62 : 82)};
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
  border:1px solid var(--nv-hair);border-top:none;}
${D} .scroll-progress{height:2.5px;background:var(--nv-grad);
  box-shadow:0 0 14px ${mix(A, 85)},0 0 4px ${mix(A, 95)};}

/* ═══ ٧. لوحة «حالة السجل» — عمودان بدل التتابع الطولي ═══ */
${D} .stats{padding:24px 20px;}
@media(min-width:1040px){
  ${D} .stats{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(0,1.6fr);
    column-gap:32px;row-gap:18px;align-items:start;padding:28px 26px;}
  ${D} .stats-top{grid-column:1;grid-row:1/3;flex-direction:column;align-items:flex-start;
    gap:20px;margin-bottom:0;}
  ${D} .bar{grid-column:2;grid-row:1;align-self:center;}
  ${D} .legend{grid-column:2;grid-row:2;margin-top:0;}
  ${D} .stats-foot{grid-column:1/-1;}
}
${D} .hero-n{background:var(--nv-grad);-webkit-background-clip:text;background-clip:text;color:transparent;
  font-size:56px;letter-spacing:-.03em;}
${D} .bar{height:15px;border-radius:999px;background:${mix(T.sunken, 70)};padding:2px;gap:3px;}
${D} .bar-s{border-radius:999px;position:relative;overflow:hidden;}
${D} .bar-s::after{content:"";position:absolute;inset:0;
  background:linear-gradient(100deg,transparent 20%,${mix("#ffffff", 32)} 50%,transparent 80%);
  transform:translateX(-100%);animation:nvsheen 3.4s ease-in-out infinite;}
@keyframes nvsheen{0%{transform:translateX(-100%);}55%,100%{transform:translateX(100%);}}

/* مفاتيح الحالة صارت بلاطات مستقلة */
${D} .legend{gap:8px;}
@media(min-width:460px){${D} .legend{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}}
${D} .lg{border:1px solid var(--nv-hair);background:${mix(T.surface, dark ? 42 : 62)};
  border-radius:15px;padding:12px 13px;
  transition:background .2s ease,transform .22s cubic-bezier(.22,1,.36,1),border-color .2s ease;}
${D} .lg:hover{background:${mix(A, 11)};border-color:${mix(A, 45)};transform:translateY(-2px);}
${D} .lg-d{box-shadow:0 0 8px currentColor;}
${D} .stats-foot{border-top:1px solid var(--nv-hair);padding-top:14px;margin-top:4px;}

/* ═══ ٨. المواقع والفئات ═══ */
${D} .zbar,${D} .gbar,${D} .pbar{border-radius:999px;overflow:hidden;background:${mix(T.sunken, 70)};}
${D} .zrow{border-radius:15px;padding:11px 12px;border:1px solid transparent;
  transition:background .2s ease,transform .22s cubic-bezier(.22,1,.36,1),border-color .2s ease;}
${D} .zrow:hover{background:${mix(A, 10)};border-color:${mix(A, 40)};transform:translateY(-2px);}
${D} .cat-grid{gap:8px;}

/* ═══ ٩. «أحدث الملاحظات» كخط زمني ═══ */
${D} .latest{position:relative;padding-inline-start:15px;gap:4px;}
${D} .latest::before{content:"";position:absolute;inset-block:14px;inset-inline-start:4px;width:2px;
  border-radius:2px;background:linear-gradient(${mix(A, 60)},${mix(A, 8)});}
${D} .lrow{border-radius:15px;position:relative;
  transition:background .2s ease,transform .24s cubic-bezier(.22,1,.36,1);}
${D} .lrow::before{content:"";position:absolute;inset-inline-start:-15px;top:20px;width:9px;height:9px;
  border-radius:50%;background:${T.surface};border:2px solid ${mix(A, 75)};transition:transform .24s ease;}
${D} .lrow:hover{background:${mix(A, 10)};transform:translateX(-4px);}
${D} .lrow:hover::before{transform:scale(1.35);}
${D} .lrow-d{box-shadow:0 0 10px currentColor;}

/* ═══ ١٠. البطاقات ═══ */
/* تحييد زخارف الأطقم (عمود «المسار»، خطوط «المحضر») — نوفا له لغته الخاصة */
${D} .cards{padding-inline-end:0;}
${D} .cards::before{display:none;}
${D} .cards{gap:13px;}
@media(min-width:1400px){${D} .cards{grid-template-columns:repeat(3,minmax(0,1fr));}}
${D} .card{background:${glassBg};-webkit-backdrop-filter:blur(16px) saturate(160%);
  backdrop-filter:blur(16px) saturate(160%);border:1px solid var(--nv-hair);
  border-radius:20px;box-shadow:${lift};padding:18px 19px;
  transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s ease,border-color .28s ease;}
${D} .card::before{content:"";position:absolute;inset:0;width:auto;height:auto;transform:none;
  pointer-events:none;opacity:0;border-radius:inherit;
  transition:opacity .3s ease;background:radial-gradient(360px circle at var(--mx,50%) var(--my,50%),${mix(A, dark ? 16 : 11)},transparent 60%);}
${D} .card:hover::before{opacity:1;transform:none;}
${D} .card::after{content:"";position:absolute;inset-inline-start:0;inset-inline-end:auto;inset-block:0;
  width:3px;height:auto;background:var(--nv-grad);opacity:0;transform:scaleY(.2);
  border-radius:inherit;box-shadow:none;
  transition:opacity .3s ease,transform .4s cubic-bezier(.22,1,.36,1);}
${D} .card:hover::after{opacity:1;transform:scaleY(1);box-shadow:none;}
${D} .card:hover{transform:translateY(-5px);box-shadow:${liftUp};border-color:${mix(A, 42)};}
${D} .card:active{transform:translateY(-1px) scale(.985);}
${D} .cat-pill,${D} .tag{border-radius:999px;}

${D}.nv-js .cards > .card{animation:nvrise .55s cubic-bezier(.22,1,.36,1) both;}
${D}.nv-js .cards > .card:nth-child(1){animation-delay:.02s;}
${D}.nv-js .cards > .card:nth-child(2){animation-delay:.06s;}
${D}.nv-js .cards > .card:nth-child(3){animation-delay:.1s;}
${D}.nv-js .cards > .card:nth-child(4){animation-delay:.14s;}
${D}.nv-js .cards > .card:nth-child(5){animation-delay:.18s;}
${D}.nv-js .cards > .card:nth-child(6){animation-delay:.22s;}
${D}.nv-js .cards > .card:nth-child(n+7){animation-delay:.26s;}
@keyframes nvrise{from{opacity:0;transform:translateY(18px) scale(.985);}to{opacity:1;transform:none;}}

/* ═══ ١١. ظهور الأقسام مع التمرير ═══ */
${D}.nv-js .surf,${D}.nv-js .doc-card{opacity:0;transform:translateY(26px);
  transition:opacity .6s cubic-bezier(.22,1,.36,1),transform .6s cubic-bezier(.22,1,.36,1);}
${D}.nv-js .surf.nv-in,${D}.nv-js .doc-card.nv-in,
${D}.nv-all-in .surf,${D}.nv-all-in .doc-card{opacity:1;transform:none;}
/* الإقرار نافذة، ما ينتظر التمرير */
${D}.nv-js .ovl .surf{opacity:1;transform:none;}

/* ═══ ١٢. الجدول ═══ */
${D} .tbl-wrap{border-radius:20px;border:1px solid var(--nv-hair);
  background:${glassBg};-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);}
${D} .tbl th{background:${mix(T.sunken, 62)};-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);}
${D} .trow{transition:background .18s ease;}
${D} .trow:hover{background:${mix(A, 8)};}

/* ═══ ١٣. النوافذ ولوحة التفاصيل ═══ */
${D} .ovl{-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);
  background:${dark ? "rgba(4,10,14,.66)" : "rgba(16,32,44,.36)"};}
${D} .sheet{background:${glassBg};
  -webkit-backdrop-filter:blur(26px) saturate(180%);backdrop-filter:blur(26px) saturate(180%);
  border:1px solid var(--nv-hair);border-bottom:none;border-radius:26px 26px 0 0;
  box-shadow:${liftUp};animation:nvsheet .46s cubic-bezier(.22,1,.36,1) both;}
@media(min-width:640px){${D} .sheet{border-radius:24px;border-bottom:1px solid var(--nv-hair);}}
@keyframes nvsheet{from{opacity:0;transform:translateY(34px) scale(.985);}to{opacity:1;transform:none;}}
${D} .note-box,${D} .reply-box{border-radius:16px;border:1px solid var(--nv-hair);
  background:${mix(T.sunken, dark ? 55 : 72)};}

/* ═══ ١٤. الإقرار القانوني — خانة مستقلة بالكامل ═══
   بطاقة واحدة بالنص، رأس ملوّن، كل بند بخانته، وتذييل ثابت فيه زر الموافقة. */
${D} .lgl-ovl{align-items:center;padding:14px;}
@media(min-width:640px){${D} .lgl-ovl{padding:28px;}}
${D} .lgl{border-radius:26px;border:1px solid var(--nv-hair);border-bottom:1px solid var(--nv-hair);
  max-height:86vh;max-height:min(86vh,760px,100%);overflow:hidden;box-shadow:${liftUp};}
${D} .lgl-top{position:relative;padding:20px 20px 17px;border-bottom:1px solid var(--nv-hair)!important;
  background:linear-gradient(150deg,${mix(A, 16)},transparent 70%);}
${D} .lgl-top::after{content:"";position:absolute;bottom:-1px;inset-inline:0;height:1px;
  background:linear-gradient(90deg,transparent,${mix(A, 70)},transparent);}
${D} .lgl-body{padding:18px 20px 20px;overscroll-behavior:contain;}
${D} .lgl-pt{border:1px solid var(--nv-hair);border-radius:17px;padding:15px 16px;
  background:${mix(T.sunken, dark ? 48 : 66)};}
${D} .lgl-pt:hover{border-color:${mix(A, 38)};}
${D} .lgl-foot{background:${mix(T.sunken, dark ? 72 : 86)}!important;
  border-top:1px solid var(--nv-hair)!important;
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  box-shadow:0 -14px 26px -22px ${dark ? "rgba(0,0,0,.9)" : "rgba(16,42,58,.5)"};}
${D} .lgl-agree{font-size:15px;}

/* ═══ ١٥. المخططات والمستندات ═══ */
${D} .doc-list{gap:12px;}
@media(min-width:900px){${D} .doc-list{grid-template-columns:repeat(2,minmax(0,1fr));}}
${D} .doc-card{border-radius:20px;border:1px solid var(--nv-hair);
  border-inline-start:4px solid ${A};background:${glassBg};
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);overflow:hidden;
  transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s ease,border-color .3s ease;}
${D} .doc-card:hover{transform:translateY(-4px);box-shadow:${liftUp};}
${D} .doc-thumb img{transition:transform .55s cubic-bezier(.22,1,.36,1);}
${D} .doc-card:hover .doc-thumb img{transform:scale(1.06);}
${D} .doc-disclaimer{border-radius:16px;}
${D} .dvw{background:${dark ? "rgba(4,10,14,.93)" : "rgba(246,249,251,.96)"};
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);}
${D} .dvw-chip{border-radius:999px;}
${D} .dvw-chip.on{background:var(--nv-grad);color:${T.onAccent};}

/* ═══ ١٦. تقدّم التنفيذ ═══ */
${D} .ring-fg{filter:drop-shadow(0 0 6px ${mix(A, 55)});}
${D} .prow,${D} .grow{border-radius:15px;transition:background .2s ease,transform .22s ease;}
${D} .prow:hover,${D} .grow:hover{background:${mix(A, 9)};transform:translateY(-2px);}

/* ═══ ١٧. حقول الإدخال ═══ */
${D} .srch,${D} .sel{border-radius:14px;border:1px solid var(--nv-hair);
  background:${mix(T.surface, dark ? 62 : 82)};
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  transition:border-color .22s ease,box-shadow .22s ease,transform .22s ease;}
${D} .srch:focus,${D} .sel:focus{border-color:${mix(A, 70)};
  box-shadow:0 0 0 4px ${mix(A, 16)};transform:translateY(-1px);}
${D} .seg,${D} .mseg,${D} .view-seg{border-radius:14px;background:${mix(T.sunken, 70)};
  border:1px solid var(--nv-hair);}
${D} .seg-b[data-on="1"],${D} .mseg-b[data-on="1"]{background:var(--nv-grad);color:${T.onAccent};}

/* ═══ ١٨. زر العودة للأعلى ═══ */
${D} .top-fab{border-radius:18px;background:var(--nv-grad);color:${T.onAccent};border:none;
  box-shadow:0 14px 34px -14px ${mix(A, 95)};
  transition:transform .26s cubic-bezier(.22,1,.36,1),box-shadow .26s ease;}
${D} .top-fab:hover{transform:translateY(-4px) rotate(-6deg);filter:none;
  box-shadow:0 20px 42px -14px ${mix(A, 95)};}

/* ═══ ١٩. احترام تقليل الحركة ═══ */
@media(prefers-reduced-motion:reduce){
  ${D} .nv-bg i,${D} .bar-s::after,${D} .chip-urgent.chip-glow{animation:none!important;}
  ${D}.nv-js .cards > .card,${D} .sheet{animation:none!important;}
  ${D}.nv-js .surf,${D}.nv-js .doc-card{opacity:1!important;transform:none!important;}
}
${reduced ? `${D} .nv-bg i,${D} .bar-s::after{animation:none;}
${D}.nv-js .surf,${D}.nv-js .doc-card{opacity:1;transform:none;}
${D}.nv-js .cards > .card{animation:none;}` : ""}

/* ═══ ٢٠. الطباعة ═══ */
@media print{
  ${D} .nv-bg,${D} .nv-grain,${D} .nv-glow{display:none!important;}
  ${D} header,${D} .surf,${D} .card{background:#fff!important;backdrop-filter:none!important;
    box-shadow:none!important;}
  ${D} .tab-panel[data-tab="overview"]{display:block;}
}
`;
}
