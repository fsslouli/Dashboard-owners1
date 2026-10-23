/* ═══════════════════════════════════════════════════════════
   local-mt.js (6.8.0) — واجهة محرّك الترجمة الداخلي للوحة الإدارة.
   translateLocal([{ ar, kind }]) ← [{ en, flags }]  (kind: text | label | person | title | heading)
   الموديل يشتغل بـ Web Worker مستقل فما يعلّق الواجهة، ويتحمّل أول مرة فقط (≈140MB) ثم ينحفظ بالجهاز.
   التشغيل التلقائي (بعد الحفظ، عند فتح اللوحة، تعبئة الحقول) ما ينزّل المحرّك من نفسه:
   يشتغل بس لو المحرّك متحمّل بهالجهاز (engineAvailable) — والتحميل الأول يكون بزر من تبويب «الترجمة».
   ═══════════════════════════════════════════════════════════ */
import { BROWSER_CACHE, ENGINE_PATH, MODEL_FILES, MODEL_ID } from "./local-mt-config.js";

let worker = null, seq = 0;
const pending = new Map();
let status = { state: "idle", loaded: 0, total: 0, error: "" };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(status); } catch (_) { /* تجاهل */ } });

export function localSupported() {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
}
export function engineStatus() { return status; }
export function onEngineStatus(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); }

/* هل ملفات الموديل محفوظة بذاكرة هالمتصفح؟ (أو المحرّك شغّال أصلًا بهالجلسة) */
export async function engineCached() {
  if (status.state === "ready") return true;
  try {
    if (typeof caches === "undefined") return false;
    const c = await caches.open(BROWSER_CACHE);
    const base = new URL(ENGINE_PATH + "models/" + MODEL_ID + "/", window.location.origin).href;
    for (const f of MODEL_FILES) { if (!(await c.match(base + f))) return false; }
    return true;
  } catch (_) {
    return false;
  }
}
/* يقدر يشتغل الحين بدون تحميل كبير؟ */
export async function engineAvailable() {
  return localSupported() && (status.state === "ready" || status.state === "loading" || (await engineCached()));
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./local-mt-worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === "status") { status = { ...status, state: m.state, loaded: m.loaded ?? status.loaded, total: m.total ?? status.total, error: "" }; emit(); return; }
    const p = pending.get(m.id);
    if (!p) return;
    if (m.type === "item") { if (p.onItem) p.onItem(m.i, m.n); return; }
    pending.delete(m.id);
    if (m.type === "done") p.resolve(m.out || []);
    else { status = { ...status, state: "error", error: m.error || "تعذّر تشغيل المحرك" }; emit(); p.reject(new Error(m.error || "engine error")); }
  };
  worker.onerror = (e) => {
    status = { ...status, state: "error", error: String((e && e.message) || "worker error") }; emit();
    pending.forEach((p) => p.reject(new Error(status.error))); pending.clear();
    try { worker.terminate(); } catch (_) { /* تجاهل */ }
    worker = null;
  };
  return worker;
}

function call(type, items, onItem) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, onItem });
    if (status.state === "idle" || status.state === "error") { status = { ...status, state: "loading", error: "" }; emit(); }
    getWorker().postMessage({ id, type, items });
  });
}

/* تجهيز المحرّك (تحميل الملفات أول مرة + تشغيل الموديل) */
export function warmupLocal() { return localSupported() ? call("warmup", []) : Promise.reject(new Error("unsupported")); }

/* ترجمة مجموعة نصوص — يرجّع لكل نص { en, flags } (en فاضي لو تعذّر) */
export function translateLocal(items, { onItem } = {}) {
  if (!localSupported()) return Promise.reject(new Error("unsupported"));
  const list = (items || []).map((x) => ({ ar: String((x && x.ar) || "").trim(), kind: (x && x.kind) || "text" }));
  if (!list.length) return Promise.resolve([]);
  return call("translate", list, onItem);
}
