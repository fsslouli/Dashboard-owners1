import React, { useEffect } from "react";

/* ═══════════════════════════════════════════════════════════
   طبقة التصميم «نوفا» — إعادة تصميم كاملة للموقع العام.

   الفكرة المعمارية:
   الملف هذا طبقة مستقلة تمامًا. ما يعرف شيء عن منطق البيانات، وما يعدّل
   أي مكوّن. يشتغل بالكامل عبر:
     ١) CSS بأسبقية أعلى تحت المُحدِّد .dash[data-design="nova"]
     ٢) طبقات خلفية متحركة تُركَّب فوق الصفحة
     ٣) خطّاف صغير يضيف كشف التمرير وتتبّع المؤشر

   يعني: التصميم القديم يبقى كما هو حرفيًا، والجديد يُركَّب/يُفصل بمفتاح
   واحد من لوحة الإدارة (عمود active_design بجدول site_settings).
   ═══════════════════════════════════════════════════════════ */

export const DESIGN_KEYS = ["classic", "nova"];
export const DEFAULT_DESIGN_KEY = "classic";

export const DESIGNS = {
  classic: {
    label: "الكلاسيكي",
    labelEn: "Classic",
    note: "التصميم الحالي — بطاقات مصمتة، فصل بالمسافات، حركة هادئة.",
  },
  nova: {
    label: "نوفا",
    labelEn: "Nova",
    note: "تصميم جديد كليًا — خلفية شفقية متحركة، ألواح زجاجية، ظهور تدريجي مع التمرير، وإضاءة تتبع المؤشر.",
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
        const t = ev.target instanceof Element ? ev.target.closest(".card,.surf,.doc-card,.lrow") : null;
        hot = t;
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
${D} > *:not(.nv-bg):not(.nv-grain):not(.nv-glow){position:relative;z-index:1;}

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

/* حبيبات ناعمة تكسر تدرّج الألوان */
${D} .nv-grain{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:${dark ? ".05" : ".035"};
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");}

/* هالة تتبع المؤشر (سطح المكتب فقط) */
${D} .nv-glow{display:none;}
@media(hover:hover) and (pointer:fine){
  ${D}.nv-js .nv-glow{display:block;position:fixed;inset:0;z-index:0;pointer-events:none;
    background:radial-gradient(420px circle at var(--nv-gx) var(--nv-gy),${mix(A, dark ? 13 : 9)},transparent 62%);
    transition:opacity .4s ease;}
}

/* ── ٢. الألواح الزجاجية ── */
${D} .surf,${D} .stats{background:${glassBg};
  -webkit-backdrop-filter:blur(18px) saturate(165%);backdrop-filter:blur(18px) saturate(165%);
  border:1px solid var(--nv-hair);border-radius:24px;box-shadow:${lift};position:relative;}
/* خيط ضوئي علوي */
${D} .surf::after{content:"";position:absolute;top:0;inset-inline:14%;height:1px;
  background:linear-gradient(90deg,transparent,${mix(A, 55)},transparent);pointer-events:none;}

/* ── ٣. الترويسة ── */
${D} .h1{background:var(--nv-grad);-webkit-background-clip:text;background-clip:text;color:transparent;
  letter-spacing:-.01em;filter:saturate(1.1);}
${D} .head{padding-bottom:6px;}
${D} .stamp,${D} .meta-line{color:${T.muted};}

/* ── ٤. الأزرار والرقاقات: لمعة تمر عند التحويم ── */
${D} .icon-btn,${D} .chip,${D} .fchip,${D} .wide-btn,${D} .big-btn,${D} .ff{
  position:relative;overflow:hidden;border-radius:14px;
  border:1px solid var(--nv-hair);background:${mix(T.surface, dark ? 62 : 78)};
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  transition:transform .2s cubic-bezier(.22,1,.36,1),border-color .2s ease,color .2s ease,box-shadow .25s ease;}
${D} .chip,${D} .fchip{border-radius:999px;}
${D} .icon-btn::before,${D} .chip::before,${D} .wide-btn::before,${D} .big-btn::before{
  content:"";position:absolute;inset:0;transform:translateX(-120%);pointer-events:none;
  background:linear-gradient(105deg,transparent 30%,${mix(A, 26)} 50%,transparent 70%);}
${D} .icon-btn:hover::before,${D} .chip:hover::before,${D} .wide-btn:hover::before,${D} .big-btn:hover::before{
  transform:translateX(120%);transition:transform .72s cubic-bezier(.22,1,.36,1);}
${D} .icon-btn:hover,${D} .chip:hover,${D} .fchip:hover,${D} .ff:hover{
  transform:translateY(-2px);border-color:${mix(A, 55)};box-shadow:0 10px 24px -16px ${mix(A, 80)};}
${D} .icon-btn:active,${D} .chip:active,${D} .wide-btn:active{transform:translateY(0) scale(.97);}
${D} .icon-btn[data-primary="1"]{background:var(--nv-grad);border-color:transparent;color:${T.onAccent};
  box-shadow:0 10px 26px -14px ${mix(A, 90)};}
${D} .fchip[data-on="1"],${D} .chip[data-on="1"]{background:var(--nv-grad);color:${T.onAccent};border-color:transparent;
  box-shadow:0 8px 22px -12px ${mix(A, 90)};}
${D} .wide-btn,${D} .big-btn{border-radius:16px;}

/* رقاقات التنبيه: نبض هادئ */
${D} .chip-urgent{border-color:${mix(T.pri["عالية جدًا"], 60)};}
${D} .chip-urgent.chip-glow{animation:nvpulse 2.8s ease-in-out infinite;}
@keyframes nvpulse{0%,100%{box-shadow:0 0 0 0 ${mix(T.pri["عالية جدًا"], 42)};}
  55%{box-shadow:0 0 0 9px ${mix(T.pri["عالية جدًا"], 0)};}}

/* ── ٥. شريط التبويبات: حبّة عائمة ── */
${D} .tabs{margin-inline:0;padding:8px;border-radius:20px;gap:5px;
  background:${mix(T.surface, dark ? 55 : 70)};border:1px solid var(--nv-hair);
  -webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);
  box-shadow:${lift};}
@media(min-width:768px){${D} .tabs{margin-inline:0;padding:8px;}}
${D} .tabs.tabs-glass{background:${mix(T.surface, dark ? 70 : 82)};box-shadow:${liftUp};}
${D} .tab{border:none;background:transparent;border-radius:14px;padding:11px 16px;
  transition:color .22s ease,background .28s cubic-bezier(.22,1,.36,1),transform .2s ease;}
${D} .tab:hover{background:${mix(A, 10)};}
${D} .tab[data-on="1"]{background:var(--nv-grad);color:${T.onAccent};box-shadow:0 10px 24px -14px ${mix(A, 95)};}
${D} .tab[data-on="1"] .tab-n{background:${mix("#ffffff", 22)};color:inherit;}
${D} .tab-indicator{display:none;}
${D} .mini-bar{border-radius:0 0 18px 18px;background:${mix(T.surface, dark ? 62 : 80)};
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid var(--nv-hair);border-top:none;}

/* شريط تقدّم التمرير */
${D} .scroll-progress{height:2.5px;background:var(--nv-grad);
  box-shadow:0 0 14px ${mix(A, 85)},0 0 4px ${mix(A, 95)};}

/* ── ٦. الرقم البطل: تدرّج + لمعة تمرّ ── */
${D} .hero-n{background:var(--nv-grad);-webkit-background-clip:text;background-clip:text;color:transparent;
  font-size:52px;letter-spacing:-.02em;position:relative;}
${D} .stats{padding:26px 22px;}
${D} .bar{height:14px;border-radius:999px;background:${mix(T.sunken, 70)};padding:2px;gap:3px;}
${D} .bar-s{border-radius:999px;position:relative;overflow:hidden;}
${D} .bar-s::after{content:"";position:absolute;inset:0;
  background:linear-gradient(100deg,transparent 20%,${mix("#ffffff", 32)} 50%,transparent 80%);
  transform:translateX(-100%);animation:nvsheen 3.4s ease-in-out infinite;}
@keyframes nvsheen{0%{transform:translateX(-100%);}55%,100%{transform:translateX(100%);}}
${D} .lg{border-radius:14px;transition:background .2s ease,transform .2s ease;}
${D} .lg:hover{background:${mix(A, 9)};transform:translateX(-3px);}
${D} .zbar{border-radius:999px;overflow:hidden;background:${mix(T.sunken, 70)};}
${D} .zrow{border-radius:14px;transition:background .2s ease,transform .22s cubic-bezier(.22,1,.36,1);}
${D} .zrow:hover{background:${mix(A, 9)};transform:translateY(-2px);}

/* ── ٧. البطاقات: زجاج + إضاءة تتبع + دخول متدرّج ── */
${D} .cards{gap:13px;}
${D} .card{background:${glassBg};-webkit-backdrop-filter:blur(16px) saturate(160%);
  backdrop-filter:blur(16px) saturate(160%);border:1px solid var(--nv-hair);
  border-radius:20px;box-shadow:${lift};padding:18px 19px;
  transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s ease,border-color .28s ease;}
${D} .card::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;
  transition:opacity .3s ease;border-radius:inherit;
  background:radial-gradient(360px circle at var(--mx,50%) var(--my,50%),${mix(A, dark ? 16 : 11)},transparent 60%);}
${D} .card:hover::before{opacity:1;}
${D} .card::after{content:"";position:absolute;inset-inline-start:0;inset-block:0;width:3px;
  background:var(--nv-grad);opacity:0;transform:scaleY(.2);transform-origin:center;
  transition:opacity .3s ease,transform .4s cubic-bezier(.22,1,.36,1);border-radius:inherit;}
${D} .card:hover::after{opacity:1;transform:scaleY(1);}
${D} .card:hover{transform:translateY(-5px);box-shadow:${liftUp};border-color:${mix(A, 42)};}
${D} .card:active{transform:translateY(-1px) scale(.985);}
${D} .cat-pill{border-radius:999px;}
${D} .tag{border-radius:999px;}

/* دخول البطاقات متتاليًا */
${D}.nv-js .cards > .card{animation:nvrise .55s cubic-bezier(.22,1,.36,1) both;}
${D}.nv-js .cards > .card:nth-child(1){animation-delay:.02s;}
${D}.nv-js .cards > .card:nth-child(2){animation-delay:.06s;}
${D}.nv-js .cards > .card:nth-child(3){animation-delay:.1s;}
${D}.nv-js .cards > .card:nth-child(4){animation-delay:.14s;}
${D}.nv-js .cards > .card:nth-child(5){animation-delay:.18s;}
${D}.nv-js .cards > .card:nth-child(6){animation-delay:.22s;}
${D}.nv-js .cards > .card:nth-child(n+7){animation-delay:.26s;}
@keyframes nvrise{from{opacity:0;transform:translateY(18px) scale(.985);}to{opacity:1;transform:none;}}

/* ── ٨. ظهور الأقسام مع التمرير ── */
${D}.nv-js .surf,${D}.nv-js .doc-card{opacity:0;transform:translateY(26px);
  transition:opacity .6s cubic-bezier(.22,1,.36,1),transform .6s cubic-bezier(.22,1,.36,1);}
${D}.nv-js .surf.nv-in,${D}.nv-js .doc-card.nv-in,
${D}.nv-all-in .surf,${D}.nv-all-in .doc-card{opacity:1;transform:none;}

/* ── ٩. صفوف «أحدث الملاحظات» ── */
${D} .lrow{border-radius:14px;position:relative;overflow:hidden;
  transition:background .2s ease,transform .24s cubic-bezier(.22,1,.36,1),padding .24s ease;}
${D} .lrow:hover{background:${mix(A, 9)};transform:translateX(-4px);}
${D} .lrow-d{box-shadow:0 0 10px currentColor;}

/* ── ١٠. الجدول ── */
${D} .tbl-wrap{border-radius:20px;border:1px solid var(--nv-hair);
  background:${glassBg};-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);}
${D} .tbl th{background:${mix(T.sunken, 60)};-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);}
${D} .trow{transition:background .18s ease;}
${D} .trow:hover{background:${mix(A, 8)};}

/* ── ١١. لوحة التفاصيل: دخول نابض ── */
${D} .ovl{-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
  background:${dark ? "rgba(4,10,14,.62)" : "rgba(16,32,44,.34)"};animation:nvfade .3s ease both;}
${D} .sheet{border-radius:26px 26px 0 0;background:${glassBg};
  -webkit-backdrop-filter:blur(26px) saturate(180%);backdrop-filter:blur(26px) saturate(180%);
  border:1px solid var(--nv-hair);border-bottom:none;box-shadow:${liftUp};
  animation:nvsheet .46s cubic-bezier(.22,1,.36,1) both;}
@media(min-width:768px){${D} .sheet{border-radius:26px;border-bottom:1px solid var(--nv-hair);}}
@keyframes nvsheet{from{opacity:0;transform:translateY(34px) scale(.985);}to{opacity:1;transform:none;}}
@keyframes nvfade{from{opacity:0;}to{opacity:1;}}
${D} .sheet-nav-b,${D} .fb-btn{border-radius:13px;border:1px solid var(--nv-hair);
  transition:transform .2s cubic-bezier(.22,1,.36,1),border-color .2s ease;}
${D} .sheet-nav-b:hover,${D} .fb-btn:hover{transform:translateY(-2px);border-color:${mix(A, 55)};}
${D} .note-box,${D} .reply-box{border-radius:16px;border:1px solid var(--nv-hair);
  background:${mix(T.sunken, dark ? 55 : 72)};}

/* ── ١٢. المخططات والمستندات ── */
${D} .doc-card{border-radius:20px;border:1px solid var(--nv-hair);background:${glassBg};
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);overflow:hidden;
  transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s ease,border-color .3s ease;}
${D} .doc-card:hover{transform:translateY(-4px);box-shadow:${liftUp};border-color:${mix(A, 42)};}
${D} .doc-thumb img{transition:transform .55s cubic-bezier(.22,1,.36,1);}
${D} .doc-card:hover .doc-thumb img{transform:scale(1.06);}
${D} .dvw{background:${dark ? "rgba(4,10,14,.92)" : "rgba(246,249,251,.96)"};
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);}
${D} .dvw-chip{border-radius:999px;transition:transform .2s ease;}
${D} .dvw-chip.on{background:var(--nv-grad);color:${T.onAccent};}

/* ── ١٣. حلقات المراحل وأشرطة التقدّم ── */
${D} .ring-fg{filter:drop-shadow(0 0 6px ${mix(A, 55)});}
${D} .gbar{border-radius:999px;overflow:hidden;background:${mix(T.sunken, 70)};}
${D} .gbar-f{border-radius:999px;}
${D} .pbar{border-radius:999px;overflow:hidden;background:${mix(T.sunken, 70)};}
${D} .prow,${D} .grow{border-radius:14px;transition:background .2s ease,transform .22s ease;}
${D} .prow:hover,${D} .grow:hover{background:${mix(A, 8)};transform:translateY(-2px);}

/* ── ١٤. حقول الإدخال ── */
${D} .srch,${D} .sel{border-radius:14px;border:1px solid var(--nv-hair);
  background:${mix(T.surface, dark ? 62 : 80)};
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  transition:border-color .22s ease,box-shadow .22s ease,transform .22s ease;}
${D} .srch:focus,${D} .sel:focus{border-color:${mix(A, 70)};
  box-shadow:0 0 0 4px ${mix(A, 16)};transform:translateY(-1px);}
${D} .seg{border-radius:14px;background:${mix(T.sunken, 70)};border:1px solid var(--nv-hair);}
${D} .seg-b[data-on="1"],${D} .mseg-b[data-on="1"]{background:var(--nv-grad);color:${T.onAccent};}

/* ── ١٥. زر العودة للأعلى ── */
${D} .top-fab{border-radius:18px;background:var(--nv-grad);color:${T.onAccent};border:none;
  box-shadow:0 14px 34px -14px ${mix(A, 95)};
  transition:transform .26s cubic-bezier(.22,1,.36,1),box-shadow .26s ease;}
${D} .top-fab:hover{transform:translateY(-4px) rotate(-6deg);filter:none;
  box-shadow:0 20px 42px -14px ${mix(A, 95)};}

/* ── ١٦. مخطط الفيلا ── */
${D} .villa-blk{transition:opacity .3s ease,transform .3s cubic-bezier(.22,1,.36,1);}

/* ── ١٧. احترام تقليل الحركة ── */
@media(prefers-reduced-motion:reduce){
  ${D} .nv-bg i,${D} .bar-s::after,${D} .chip-urgent.chip-glow{animation:none!important;}
  ${D}.nv-js .cards > .card{animation:none!important;}
  ${D}.nv-js .surf,${D}.nv-js .doc-card{opacity:1!important;transform:none!important;}
}
${reduced ? `${D} .nv-bg i,${D} .bar-s::after{animation:none;}
${D}.nv-js .surf,${D}.nv-js .doc-card{opacity:1;transform:none;}
${D}.nv-js .cards > .card{animation:none;}` : ""}

/* ── ١٨. الطباعة: نوفا يرجع مسطّح ── */
@media print{
  ${D} .nv-bg,${D} .nv-grain,${D} .nv-glow{display:none!important;}
  ${D} .surf,${D} .card{background:#fff!important;backdrop-filter:none!important;box-shadow:none!important;}
}
`;
}
