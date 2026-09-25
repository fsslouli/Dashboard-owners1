import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════
   طبقة التصميم «بنّاء» — التصميم الثالث للموقع العام.

   الفكرة: كل استفسار لبنة. سجل الملاك جدار يُبنى صفًّا فوق صف —
   الأقدم في الأسفل والأحدث في الأعلى — ولون كل لبنة لون قرارها،
   واللبنة المفرّغة ما زالت مفتوحة. تضغط أي لبنة فتنفتح ملاحظتها.

   حوله كل شي هادئ ومصمت: أسطح بلا زجاج ولا تدرّج ولا ظلال، مفصولة
   بفواصل ضيقة زي الملاط بين الحجر، وعناوين وأرقام بخط كوفي ثقيل (Kufam).

   نفس معمارية «نوفا» بالضبط:
     ١) CSS تحت المُحدِّد .dash[data-design="bannaa"] يُلحق بآخر الأنماط
     ٢) عنصر واحد جديد (BrickWall) يُركَّب داخل «حالة السجل» فقط
   الألوان كلها من طقم الألوان المعتمد — يشتغل مع الأطقم الخمسة.
   ═══════════════════════════════════════════════════════════ */

export const BANNAA_FONT = "https://fonts.googleapis.com/css2?family=Kufam:wght@500..800&display=swap";

/* ── أدوات لون صغيرة (الأطقم كلها hex) ── */
function hx(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, t) {
  const A = hx(a), B = hx(b);
  if (!A || !B) return a;
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
function lum(c) {
  const A = hx(c);
  if (!A) return 0;
  const [r, g, b] = A.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* أرضية الصفحة (الملاط): بالفاتح خلفية الطقم مع لمسة من لون الحبر،
   وبالداكن أغمق درجة بالطقم — فتبان الأسطح فوقها كتلًا بدون ظلال. */
export function bannaaGround(T, resolved) {
  if (!T) return undefined;
  if (resolved === "dark") return lum(T.sunken) < lum(T.bg) ? T.sunken : T.bg;
  return mixHex(T.bg, T.paper, 0.075);
}
function bannaaBlock(T, resolved) {
  return resolved === "dark" ? mixHex(T.surface, T.paper, 0.03) : T.surface;
}

/* خط التصميم يُحمَّل فقط لما يكون «بنّاء» معتمدًا */
export function useDesignFont(href, key) {
  useEffect(() => {
    if (!href || typeof document === "undefined") return;
    if (document.querySelector(`link[data-design-font="${key}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.dataset.designFont = key;
    document.head.appendChild(l);
  }, [href, key]);
}

/* ═══════════════════════════════════════════════════════════
   جدار الملاحظات
   ═══════════════════════════════════════════════════════════ */
let WALL_BUILT = false;   /* حركة البناء مرة وحدة لكل زيارة، مو مع كل رجوع للتبويب */

export function BrickWall({ rows, staC, trSta, trNote, lang, L, onOpen, reduced }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  const [hot, setHot] = useState(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [anim] = useState(() => !WALL_BUILT && !reduced);
  useEffect(() => { WALL_BUILT = true; }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ترتيب زمني: رقم الملاحظة تصاعديًا — أول صف بالأسفل */
  const list = useMemo(
    () => [...(rows || [])].sort((a, b) => (Number(a.id) - Number(b.id)) || String(a.id).localeCompare(String(b.id))),
    [rows]
  );
  const total = list.length;

  /* عدد اللبنات بالصف من عرض الجدار: لبنة ~60px بالشاشات الكبيرة و~42px بالجوال،
     وبحد أقصى ١٢ صفًا — لو زاد السجل كثير تصغر اللبنات بدل ما يطول الجدار */
  const N = useMemo(() => {
    if (!w || !total) return 0;
    const gap = 3;
    let n = Math.max(5, Math.floor((w + gap) / (w < 520 ? 42 : 60)));
    if (Math.ceil(total / n) > 12) n = Math.max(n, Math.min(Math.floor((w + gap) / 26), Math.ceil(total / 12)));
    return n;
  }, [w, total]);

  const courses = useMemo(() => {
    const out = [];
    if (!N) return out;
    for (let i = 0; i < total; i += N) out.push(list.slice(i, i + N));
    return out;
  }, [list, N, total]);

  if (!total) return null;

  const rtl = lang !== "en";
  const move = (to) => {
    const t = Math.max(0, Math.min(total - 1, to));
    setFocusIdx(t);
    const b = ref.current && ref.current.querySelector(`[data-i="${t}"]`);
    if (b) b.focus();
  };
  const onKey = (e) => {
    const i = Number(e.target && e.target.dataset ? e.target.dataset.i : NaN);
    if (Number.isNaN(i)) return;
    const k = e.key;
    let to = null;
    if (k === "ArrowRight") to = i + (rtl ? -1 : 1);
    else if (k === "ArrowLeft") to = i + (rtl ? 1 : -1);
    else if (k === "ArrowUp") to = i + N;
    else if (k === "ArrowDown") to = i - N;
    else if (k === "Home") to = 0;
    else if (k === "End") to = total - 1;
    if (to === null) return;
    e.preventDefault();
    move(to);
  };

  const cols = { gridTemplateColumns: `repeat(${N * 2 + 1},minmax(0,1fr))` };

  return (
    <div className="bn-wall no-print" data-anim={anim ? "1" : "0"}>
      <div
        className="bn-courses"
        ref={ref}
        role="group"
        aria-label={L(
          `جدار الملاحظات: ${total} لبنة، كل لبنة ملاحظة، والأحدث في الأعلى`,
          `Notes wall: ${total} bricks, one per note, newest on top`
        )}
        onKeyDown={onKey}
        onMouseLeave={() => setHot(null)}
      >
        {courses.map((c, ci) => {
          const odd = ci % 2 === 1;
          const full = c.length === N;
          return (
            <div key={ci} className="bn-course" style={{ ...cols, "--ci": ci }}>
              {odd && <i className="bn-half" aria-hidden="true" />}
              {c.map((r, k) => {
                const idx = ci * N + k;
                const open = !r.closed;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="bn-brick"
                    data-i={idx}
                    data-open={open ? "1" : "0"}
                    tabIndex={idx === focusIdx ? 0 : -1}
                    aria-label={`${L("ملاحظة", "Note")} ${r.id}: ${trSta(lang, r.sta)}${open ? L("، مفتوحة", ", open") : ""}`}
                    style={{ "--c": staC(r.sta), "--k": k }}
                    onClick={() => onOpen(r, list)}
                    onMouseEnter={() => setHot(r)}
                    onFocus={() => { setHot(r); setFocusIdx(idx); }}
                  />
                );
              })}
              {!odd && full && <i className="bn-half" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      <p className="bn-read" aria-live="polite">
        {hot ? (
          <>
            <b>{`${L("ملاحظة", "Note")} ${hot.id} · ${trSta(lang, hot.sta)}${hot.closed ? "" : L(" · مفتوحة", " · open")}`}</b>
            {"  "}
            {trNote(lang, hot)}
          </>
        ) : (
          L(
            "كل لبنة ملاحظة بلون قرارها، والأحدث في أعلى الجدار. اللبنة المفرّغة ما زالت مفتوحة. اضغط أي لبنة لقراءتها.",
            "Each brick is one note, colored by its decision; newest on top. Hollow bricks are still open. Tap a brick to read it."
          )
        )}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ورقة أنماط «بنّاء» — تُلحق بآخر أنماط الموقع فتغلب عليها.
   T: ألوان الطقم الحالي، resolved: light|dark
   ═══════════════════════════════════════════════════════════ */
export function bannaaCss(T, resolved, reduced) {
  const D = '.dash[data-design="bannaa"]';
  const dark = resolved === "dark";
  const ink = T.paper;
  const ground = bannaaGround(T, resolved);
  const block = bannaaBlock(T, resolved);
  const onInk = dark ? ground : T.surface;
  const mix = (c, p) => `color-mix(in srgb,${c} ${p}%,transparent)`;
  const K = `'Kufam','IBM Plex Sans Arabic',system-ui,sans-serif`;
  const B = `'IBM Plex Sans Arabic',system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif`;

  return `
/* ══════════ تصميم «بنّاء» ══════════ */
${D}{--bn-ink:${ink};--bn-ground:${ground};--bn-block:${block};--bn-sunk:${T.sunken};--bn-on-ink:${onInk};
  --bn-acc:${T.brass};--bn-rule:${mix(ink, dark ? 18 : 15)};--bn-rule2:${mix(ink, dark ? 10 : 8)};--bn-hover:${mix(ink, dark ? 6 : 4)};
  --bn-j:6px;--bn-bh:20px;
  background:var(--bn-ground);color:var(--bn-ink);font-family:${B};}
@media(min-width:900px){${D}{--bn-j:8px;--bn-bh:24px;}}
${D} ::selection{background:${mix(T.brass, 28)};}

/* زخارف الأطقم (شفق، شبكة، ورق، عمود «المسار»، خطوط «المحضر») تُطفأ — «بنّاء» له لغته */
${D} .skin-aurora,${D} .skin-grid,${D} .skin-paper{display:none!important;}

/* الأرقام: نفس خط النص بأرقام متساوية العرض — بدل الخط المونو */
${D} .mono{font-family:${B};font-variant-numeric:tabular-nums;letter-spacing:0;font-weight:inherit;}

/* ═══ ١. الترويسة ═══ */
${D} .wrap{max-width:1180px;}
${D} header{padding-top:4px;}
${D} .head{align-items:flex-start;gap:14px 20px;}
${D} .disp{font-family:${K};}
${D} .h1{font-family:${K};font-weight:800;font-size:clamp(32px,8vw,60px);line-height:1.12;letter-spacing:0;word-spacing:normal;
  margin:0;color:var(--bn-ink);}
${D} .meta-line{margin-top:12px;font-size:13px;color:${T.muted};}
${D} .dot{width:4px;height:4px;border-radius:0;background:${T.faint};}
${D} .stamp{background:none;border-radius:0;padding:14px 0 0;margin-top:20px;border-top:3px solid var(--bn-ink);
  font-size:12.5px;color:${T.muted};}

${D} .seg{border-radius:4px;background:var(--bn-block);padding:3px;gap:2px;box-shadow:inset 0 0 0 1px var(--bn-rule2);}
${D} .seg-b{border-radius:2px;width:32px;height:28px;color:${T.muted};}
${D} .seg-b-txt{width:auto;padding:0 11px;}
${D} .seg-b[data-on="1"]{background:var(--bn-ink)!important;color:var(--bn-on-ink)!important;}

/* ═══ ٢. الأزرار والحقول ═══ */
${D} .icon-btn,${D} .chip,${D} .mini-bar-jump,${D} .fb-btn{border-radius:3px;box-shadow:none;}
${D} .icon-btn,${D} .chip:not(.chip-urgent):not(.chip-important),${D} .mini-bar-jump{
  border:1.5px solid var(--bn-rule);background:var(--bn-block);color:var(--bn-ink);}
${D} .icon-btn:hover,${D} .chip:not(.chip-urgent):not(.chip-important):hover,${D} .mini-bar-jump:hover{border-color:var(--bn-ink);color:var(--bn-ink);}
${D} .icon-btn[data-primary="1"]{background:var(--bn-ink);border-color:var(--bn-ink);color:var(--bn-on-ink);}
${D} .icon-btn[data-primary="1"]:hover{color:var(--bn-on-ink);filter:none;}
${D} .chip[data-on="1"]{transform:none;}
${D} .big-btn{border-radius:3px;background:var(--bn-acc);color:${T.onAccent};font-weight:600;font-size:14.5px;min-height:48px;}
${D} .wide-btn{border-radius:3px;border:1.5px solid var(--bn-ink);background:transparent;color:var(--bn-ink);
  font-weight:600;font-size:14px;min-height:48px;margin-top:16px;}
${D} .wide-btn:hover{background:var(--bn-ink);color:var(--bn-on-ink);border-color:var(--bn-ink);}
${D} .fchip,${D} .mini-bar-clear,${D} .mini-bar-n,${D} .tag-important,${D} .cat-pill{border-radius:2px;}
${D} .tag{font-family:inherit;letter-spacing:0;}
${D} .srch{border-radius:3px;border:1.5px solid var(--bn-rule);background:var(--bn-ground);}
${D} .srch:focus{border-color:var(--bn-ink);box-shadow:none;}
${D} .sel{border-radius:3px;border:1.5px solid var(--bn-rule);background:var(--bn-block);}
${D} .sel:focus{outline:none;border-color:var(--bn-ink);}
${D} .mseg,${D} .sheet-nav{border-radius:4px;}
${D} .mseg-b,${D} .sheet-nav-b{border-radius:2px;}
${D} :is(.tab,.icon-btn,.chip,.seg-b,.wide-btn,.big-btn,.lg,.lrow,.zrow,.prow,.doc-card,.card,.fb-btn,.mseg-b):focus-visible{
  outline:2px solid ${T.brass};outline-offset:2px;}

/* ═══ ٣. التبويبات: صف لبنات متلاصقة، والمفتوح مصمت بلون الحبر ═══ */
${D} .tabs{gap:3px;background:var(--bn-ground);margin-top:22px;margin-bottom:var(--bn-j);flex-wrap:nowrap;}
${D} .tabs.tabs-glass{background:var(--bn-ground);-webkit-backdrop-filter:none;backdrop-filter:none;
  box-shadow:0 1px 0 var(--bn-rule);}
${D} .tab{flex:1 1 0;min-height:50px;border:0;border-radius:0;background:var(--bn-block);color:${T.muted};
  font-family:${K};font-weight:600;font-size:14.5px;padding:12px 14px;box-shadow:none;white-space:nowrap;}
${D} .tab:hover{color:var(--bn-ink);background:${mix(ink, dark ? 9 : 5)};}
${D} .tab:first-child{border-start-start-radius:4px;border-end-start-radius:4px;}
${D} .tab:nth-last-child(2){border-start-end-radius:4px;border-end-end-radius:4px;}
${D} .tab[data-on="1"]{background:var(--bn-ink);color:var(--bn-on-ink);box-shadow:none;}
${D} .tab-n{font-family:${B};font-weight:500;border-radius:2px;background:var(--bn-ground);color:${T.muted};}
${D} .tab[data-on="1"] .tab-n{background:color-mix(in srgb,var(--bn-on-ink) 18%,transparent);color:var(--bn-on-ink);}
${D} .tab-indicator{display:none!important;}
@media(max-width:767.98px){
  ${D} .tabs{overflow-x:auto;scrollbar-width:none;scroll-snap-type:x proximity;padding-top:8px;padding-bottom:8px;}
  ${D} .tabs::-webkit-scrollbar{display:none;}
  ${D} .tab{flex:none;min-height:46px;padding:10px 16px;scroll-snap-align:start;font-size:14px;}
}
${D} .mini-bar{background:var(--bn-ground);border-bottom:1px solid var(--bn-rule);}
${D} .scroll-progress{background:var(--bn-acc);height:3px;}

/* ═══ ٤. الأسطح: كتل مصمتة مرصوصة بفواصل ضيقة ═══ */
${D} .surf,${D} .stats{background:var(--bn-block);border:0;border-radius:4px;box-shadow:none;
  -webkit-backdrop-filter:none;backdrop-filter:none;}
${D} .sec-t{font-family:${K};font-weight:700;font-size:19px;line-height:1.4;letter-spacing:0;color:var(--bn-ink);}
${D} .eyebrow{font-size:12.5px;color:${T.muted};}
${D} .sec-lbl{font-size:12px;color:${T.muted};}
${D} .tab-panel > section.surf{margin-bottom:var(--bn-j)!important;}

${D} .tab-panel[data-tab="overview"]{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--bn-j);align-items:start;}
${D} .tab-panel[data-tab="overview"] > section{margin:0!important;}
${D} [data-sec="charts"]{gap:var(--bn-j)!important;}
@media(min-width:1040px){
  ${D} .tab-panel[data-tab="overview"]{grid-template-columns:repeat(12,minmax(0,1fr));align-items:stretch;}
  ${D} [data-sec="status"]{grid-column:1/-1;}
  ${D} [data-sec="latest"]{grid-column:span 7;order:2;}
  ${D} [data-sec="cats"]{grid-column:span 5;order:3;}
  ${D} [data-sec="where"]{grid-column:1/-1;order:4;}
  ${D} [data-sec="charts"]{grid-column:1/-1;order:5;}
  ${D} .tab-panel[data-tab="overview"]:not(:has([data-sec="cats"])) [data-sec="latest"]{grid-column:1/-1;}
  ${D} .tab-panel[data-tab="overview"] > .surf{padding:26px 26px!important;}
}

/* ═══ ٥. حالة السجل + الجدار ═══ */
${D} .stats{padding:22px 18px 18px;}
${D} .bar{display:none;}
${D} .hero{gap:10px;}
${D} .hero-n{font-family:${K};font-weight:800;font-size:clamp(54px,13vw,78px);line-height:.95;color:var(--bn-ink);}
${D} .hero-k{font-size:14px;color:${T.muted};}
${D} .legend{gap:2px;margin-top:14px;}
@media(min-width:620px) and (max-width:1039.98px){${D} .legend{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));}}
${D} .lg{border-radius:3px;padding:10px 8px;}
${D} .lg:hover{background:var(--bn-hover);}
${D} .lg-d{width:18px;height:10px;border-radius:1.5px;}
${D} .lg-l{font-size:13.5px;}
${D} .lg-n{font-family:${K};font-weight:700;font-size:18px;color:var(--bn-ink);}
${D} .lg-p{font-size:12px;color:${T.muted};}
${D} .stats-foot{border-top:1px solid var(--bn-rule2);font-size:12.5px;}
@media(min-width:1040px){
  ${D} .stats{display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr);
    grid-template-areas:"top wall" "leg wall" "foot foot";column-gap:44px;row-gap:14px;padding:28px 28px 20px;}
  ${D} .stats-top{grid-area:top;flex-direction:column;align-items:flex-start;gap:20px;margin:0;}
  ${D} .bn-wall{grid-area:wall;align-self:end;margin:0;}
  ${D} .legend{grid-area:leg;grid-template-columns:1fr;margin:0;align-self:end;}
  ${D} .stats-foot{grid-area:foot;margin-top:6px;}
}

${D} .bn-wall{margin:22px 0 6px;}
${D} .bn-courses{display:flex;flex-direction:column-reverse;gap:3px;padding-bottom:4px;border-bottom:3px solid var(--bn-ink);
  min-height:calc(var(--bn-bh) * 3);}
${D} .bn-course{display:grid;column-gap:3px;height:var(--bn-bh);}
${D} .bn-brick{grid-column:span 2;display:block;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:2px;
  background:var(--c);cursor:pointer;position:relative;
  transition:transform .14s cubic-bezier(.2,.8,.2,1),filter .14s ease;}
${D} .bn-brick[data-open="1"]{background:color-mix(in srgb,var(--c) 16%,var(--bn-block));box-shadow:inset 0 0 0 1.5px var(--c);}
${D} .bn-brick:hover{transform:translateY(-3px);filter:brightness(1.1);}
${D} .bn-brick:focus-visible{outline:2px solid var(--bn-ink);outline-offset:2px;transform:translateY(-3px);z-index:1;}
${D} .bn-half{grid-column:span 1;display:block;height:100%;border-radius:2px;background:${mix(ink, dark ? 13 : 9)};}
${D} .bn-read{margin:12px 0 0;font-size:13px;line-height:1.75;color:${T.muted};min-height:3.5em;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
${D} .bn-read b{color:var(--bn-ink);font-weight:600;}
${D} .bn-wall[data-anim="1"] .bn-brick,${D} .bn-wall[data-anim="1"] .bn-half{
  animation:bnLay .46s cubic-bezier(.2,.75,.25,1) backwards;animation-delay:calc(var(--ci) * 90ms + var(--k, 0) * 16ms);}
@keyframes bnLay{from{opacity:0;transform:translateY(-12px);}to{opacity:1;transform:none;}}

/* ═══ ٦. أحدث الملاحظات، المواقع، الفئات، الأولوية ═══ */
${D} .latest{gap:0;}
${D} .lrow{border-radius:3px;padding:13px 8px;gap:12px;}
${D} .lrow+.lrow{border-top:1px solid var(--bn-rule2);}
${D} .lrow:hover{background:var(--bn-hover);}
${D} .lrow-d{width:16px;height:9px;border-radius:1.5px;margin-top:8px;}
${D} .lrow-n{font-size:14px;line-height:1.8;}
${D} .lrow-m{font-size:12px;}
${D} .zrow,${D} .prow{border-radius:3px;}
${D} .zrow:hover,${D} .prow:hover{background:var(--bn-hover);}
${D} .zbar,${D} .pbar{border-radius:0;background:${mix(ink, dark ? 12 : 8)};}
${D} .zbar{height:5px;margin-top:8px;}
${D} .pbar{height:8px;}
${D} .zbar > div,${D} .pbar > div{border-radius:0;opacity:.9!important;}
${D} .prow-n{font-family:${K};font-weight:700;font-size:15px;color:var(--bn-ink)!important;}
${D} .tip{border-radius:3px;}

/* ═══ ٧. لوحة المتابعة: البطاقات لبنات، والجدول مسطّر ═══ */
${D} .cards{gap:var(--bn-j);padding-inline-end:0!important;}
@media(min-width:900px){${D} .cards{grid-template-columns:repeat(2,minmax(0,1fr));}}
${D} .cards::before{display:none!important;}
${D} .card{border:0!important;border-radius:4px;background:var(--bn-block)!important;box-shadow:none!important;
  -webkit-backdrop-filter:none!important;backdrop-filter:none!important;animation:none!important;
  padding:17px 18px 16px;transition:box-shadow .15s ease;}
${D} .card:hover{transform:none;box-shadow:inset 0 0 0 1.5px var(--bn-ink)!important;}
${D} .card:active{transform:scale(.99);}
${D} .card::before,${D} .cards > .card::before{display:none!important;}
/* ::after يبقى لومضة الفتح فقط — نلغي عنه أي زخرفة من الأطقم */
${D} .cards > .card::after,${D} .card::after{content:"";position:absolute;inset:0;width:auto;height:auto;border:0;
  border-radius:inherit;background:${T.brass};opacity:0;box-shadow:none;transform:none;pointer-events:none;}
${D} .cards > .card:hover::after,${D} .card:hover::after{opacity:0;box-shadow:none;background:${T.brass};}
${D} .card-wm{display:none;}
${D} .card-top{gap:8px 10px;margin-bottom:10px;}
${D} .card-sta{order:-1;margin:0;font-weight:600;font-size:12.5px;gap:7px;}
${D} .card-sta svg{display:none;}
${D} .card-sta::before{content:"";width:18px;height:10px;border-radius:1.5px;background:currentColor;flex:none;}
${D} .card:has(.tag-open) .card-sta::before{background:transparent;box-shadow:inset 0 0 0 1.5px currentColor;}
/* .mono يفرض اتجاه ltr على العنصر نفسه، فالهامش المنطقي ينقلب — نستخدم الفعلي حسب اتجاه الصفحة */
${D}[dir="rtl"] .card-id{margin-right:auto;}
${D}[dir="ltr"] .card-id{margin-left:auto;}
${D} .card-id{order:99;font-family:${K};font-weight:700;font-size:16px;color:var(--bn-ink);}
${D} .card-note{font-size:15px;line-height:1.9;}
${D} .tag{font-size:11.5px;}

${D} .tbl-wrap{border-radius:4px;background:var(--bn-block);}
${D} .tbl th{font-weight:600;font-size:12px;color:${T.muted};border-bottom:2px solid var(--bn-ink);}
${D} .trow td{border-bottom:1px solid var(--bn-rule2);}
${D} .trow:hover{background:var(--bn-hover);}
${D} .tbl td.td-id{font-family:${K};font-weight:700;font-size:13.5px;color:var(--bn-ink);}
${D} .td-sta{font-weight:600;gap:7px;}
${D} .td-sta svg{display:none;}
${D} .td-sta::before{content:"";width:16px;height:9px;border-radius:1.5px;background:currentColor;flex:none;}
${D} .trow:has(.tag-open) .td-sta::before{background:transparent;box-shadow:inset 0 0 0 1.5px currentColor;}

/* ═══ ٨. النوافذ ولوحة التفاصيل ═══ */
${D} .ovl{-webkit-backdrop-filter:none;backdrop-filter:none;background:${dark ? "rgba(2,5,8,.74)" : "rgba(16,24,30,.5)"};}
${D} .sheet{border:0;border-radius:10px 10px 0 0;background:var(--bn-block);-webkit-backdrop-filter:none;backdrop-filter:none;
  box-shadow:0 -1px 0 var(--bn-rule2),0 -30px 60px -40px rgba(0,0,0,.6);}
@media(min-width:640px){${D} .sheet{border-radius:6px;}}
${D} .sheet-top{border-bottom:1px solid var(--bn-rule2);}
${D} .sheet-id{font-family:${K};font-weight:700;font-size:14px;color:var(--bn-ink);}
${D} .sheet-note{font-size:16px;line-height:2.05;}
${D} .reply-box,${D} .note-box{border-radius:3px;background:var(--bn-sunk);}
${D} .meta-row+.meta-row{border-top:1px solid var(--bn-rule2);}
${D} .sheet-foot,${D} .lgl-foot{background:var(--bn-block)!important;border-top:1px solid var(--bn-rule)!important;}
${D} .lgl{border-radius:6px;overflow:hidden;}
${D} .lgl-top{background:var(--bn-block);}
${D} .lgl-pt{border-radius:3px;background:var(--bn-sunk);padding:14px 15px;}

/* ═══ ٩. تقدّم التنفيذ: أشرطة مقاطع حادة، والهدف علامة حبر بارزة ═══ */
${D} .gbar{height:14px;border-radius:0;background:${mix(ink, dark ? 12 : 8)};overflow:visible;}
${D} .gbar-f{border-radius:0;}
${D} .gbar-f::after{display:none;}
${D} .gbar-t{top:-5px;height:24px;width:3px;border-radius:0;opacity:1;background:var(--bn-ink)!important;}
${D} .grow+.grow,${D} .brow+.brow{border-top:1px solid var(--bn-rule2);}
${D} .grow-v,${D} .brow-v{font-family:${K};font-weight:700;}
${D} .plan-now{border-inline-start:0!important;border-radius:3px!important;box-shadow:inset 0 3px 0 var(--bn-acc);}
${D} .rings{border-bottom:1px solid var(--bn-rule2);}

/* ═══ ١٠. المخططات والمستندات ═══ */
${D} .doc-intro{margin-bottom:var(--bn-j);}
${D} .doc-disclaimer{border:0;border-radius:3px;background:${mix(T.brass, dark ? 14 : 9)};margin-bottom:var(--bn-j);}
${D} .doc-list{gap:var(--bn-j);}
@media(min-width:900px){${D} .doc-list{grid-template-columns:repeat(2,minmax(0,1fr));}}
${D} .doc-card{border:0;border-radius:4px;background:var(--bn-block);box-shadow:none;padding:12px;gap:14px;
  -webkit-backdrop-filter:none;backdrop-filter:none;}
${D} .doc-card:hover{box-shadow:inset 0 0 0 1.5px var(--bn-ink);transform:none;}
${D} .doc-thumb{width:84px;height:84px;border-radius:3px;border:0;background:var(--bn-sunk);}
${D} .doc-name{font-family:${K};font-weight:700;font-size:16px;}
${D} .dvw-chip,${D} .dvw-ico,${D} .dvw-foot a{border-radius:3px;}

/* ═══ ١١. زر العودة للأعلى ═══ */
${D} .top-fab{border-radius:4px;border:0;background:var(--bn-ink);color:var(--bn-on-ink);box-shadow:none;}

/* ═══ ١٢. تقليل الحركة والطباعة ═══ */
@media(prefers-reduced-motion:reduce){${D} .bn-brick,${D} .bn-half{animation:none!important;transition:none!important;}}
${reduced ? `${D} .bn-brick,${D} .bn-half{animation:none!important;}` : ""}
@media print{
  ${D}{background:#fff!important;}
  ${D} .bar{display:flex!important;}
  ${D} .surf,${D} .card,${D} .stats{border:1px solid #ccc!important;}
}
`;
}
