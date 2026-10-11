/* ═══════════════════════════════════════════════════════════
   text-overrides.js — تسمية أي نص بالموقع العام (٦.٠.٠)

   الفكرة: خريطة { "النص الأصلي": "النص الجديد" } محفوظة بعمود nav_labels (المفتاح "_texts")
   فلا تحتاج هجرة. تُطبَّق على كل الزوّار لحظيًا بدون ما نلمس أي مكوّن بالموقع:
   نمشي على عقد النص بالصفحة ونستبدل فقط العقدة اللي نصها كله يطابق مفتاحًا (ما نلمس
   جملة فيها أرقام متغيّرة)، وكذلك placeholder/title/aria-label/alt.

   لو React غيّر العقدة لقيمة جديدة نعتبرها أصلًا جديدًا ونعيد التطبيق عليها.
   مسح المفتاح يرجّع الأصل فورًا. العناصر داخل [data-edit-ui] ما تُمسّ أبدًا.
   ═══════════════════════════════════════════════════════════ */
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT"]);

export const normText = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
/* أرقام/نسب محسوبة تلقائيًا — لا تُسمّى (كانت تغيّر كل رقم مشابه بالصفحة) */
export const isNumericText = (s) => /^[\d\s.,:%+\-/٠-٩٪]+$/.test(normText(s));

const textOrig = new WeakMap();     // text node → الأصل
const textApplied = new WeakMap();  // text node → آخر قيمة وضعناها
const attrState = new WeakMap();    // element → { attr: {orig, applied} }

const skipped = (el) => !el || SKIP_TAGS.has(el.tagName) || !!(el.closest && el.closest("[data-edit-ui]"));

function applyTextNode(node, map) {
  const parent = node.parentElement;
  if (skipped(parent)) return;
  const cur = node.nodeValue;
  let base;
  if (textApplied.has(node) && cur === textApplied.get(node)) base = textOrig.get(node);
  else { base = cur; textOrig.delete(node); textApplied.delete(node); }
  const key = normText(base);
  const rep = key ? map[key] : undefined;
  if (rep != null) {
    const lead = (base.match(/^\s*/) || [""])[0];
    const trail = (base.match(/\s*$/) || [""])[0];
    const out = lead + rep + trail;
    if (cur !== out) node.nodeValue = out;
    textOrig.set(node, base); textApplied.set(node, out);
  } else if (base !== cur) {
    node.nodeValue = base; textOrig.delete(node); textApplied.delete(node);
  }
}

function applyAttrs(el, map) {
  if (skipped(el)) return;
  let st = attrState.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    const s = st && st[a];
    let base;
    if (s && cur === s.applied) base = s.orig; else { base = cur; if (s) delete st[a]; }
    const key = normText(base);
    const rep = key ? map[key] : undefined;
    if (rep != null) {
      if (cur !== rep) el.setAttribute(a, rep);
      if (!st) { st = {}; attrState.set(el, st); }
      st[a] = { orig: base, applied: rep };
    } else if (base !== cur) {
      el.setAttribute(a, base);
    }
  }
}

export function applyTextOverrides(root, map) {
  if (!root) return;
  if (root.nodeType === 3) { applyTextNode(root, map); return; }
  if (root.nodeType !== 1) return;
  if (root.hasAttributes && root.hasAttributes()) applyAttrs(root, map);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === 3) applyTextNode(n, map); else applyAttrs(n, map);
    n = walker.nextNode();
  }
}

/* الأصل الحقيقي لعقدة (حتى لو استُبدلت) — يستخدمه وضع التحرير */
export function originalTextOf(node) {
  if (node && textApplied.has(node) && node.nodeValue === textApplied.get(node)) return textOrig.get(node);
  return node ? node.nodeValue : "";
}

/* يشغّل الطبقة على كل الصفحة ويرجّع دالة إيقاف (ترجّع الأصل) */
export function startTextOverrides(map) {
  if (typeof document === "undefined") return () => {};
  const root = document.body;
  let queued = false;
  const run = () => { queued = false; applyTextOverrides(root, map); };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  run();
  const mo = new MutationObserver(schedule);
  mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  return () => { mo.disconnect(); applyTextOverrides(root, {}); };
}
