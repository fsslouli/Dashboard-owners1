/* ═══════════════════════════════════════════════════════════
   local-mt-worker.js (6.8.0) — يشغّل موديل الترجمة داخل المتصفح (Web Worker) بدون أي خدمة خارجية.
   مكتبة التشغيل محفوظة بالمستودع نفسه (vendor/)، وملفات الموديل ومحرّك ONNX/WebAssembly مستضافة
   داخل الموقع تحت /i18n-engine/، والتنزيل من أي مصدر ثاني مقفول (allowRemoteModels = false).
   أول مرة تتحمّل الملفات (≈140MB) وتنحفظ بذاكرة المتصفح، وبعدها يشتغل فورًا.
   ═══════════════════════════════════════════════════════════ */
import { pipeline, env } from "./vendor/transformers-3.7.5.min.js";
import { translateText } from "./local-mt-core.js";
import { ENGINE_PATH, MODEL_ID } from "./local-mt-config.js";

const BASE = new URL(ENGINE_PATH, self.location.origin).href;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = BASE + "models/";
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = BASE + "ort/";
env.backends.onnx.wasm.proxy = false;

let ready = null;
const files = {};
function load() {
  if (!ready) {
    ready = pipeline("translation", MODEL_ID, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p) => {
        if (p && p.file && typeof p.loaded === "number" && typeof p.total === "number") files[p.file] = { loaded: p.loaded, total: p.total };
        const vals = Object.values(files);
        const loaded = vals.reduce((a, f) => a + f.loaded, 0), total = vals.reduce((a, f) => a + f.total, 0);
        self.postMessage({ type: "status", state: "loading", loaded, total });
      },
    }).then((tr) => { self.postMessage({ type: "status", state: "ready" }); return tr; })
      .catch((e) => { ready = null; throw e; });
  }
  return ready;
}

self.onmessage = async (e) => {
  const { id, type, items } = e.data || {};
  try {
    if (type === "warmup") { await load(); self.postMessage({ id, type: "done", out: [] }); return; }
    if (type !== "translate") return;
    const tr = await load();
    const mt = async (s, o = {}) => (await tr(s, { max_new_tokens: 400, ...o }))[0].translation_text;
    const out = [];
    for (let i = 0; i < (items || []).length; i++) {
      const it = items[i] || {};
      let r;
      try { r = await translateText(String(it.ar || ""), it.kind || "text", mt); }
      catch (err) { r = { en: "", flags: ["error"], error: String((err && err.message) || err) }; }
      out.push(r);
      self.postMessage({ id, type: "item", i, n: items.length });
    }
    self.postMessage({ id, type: "done", out });
  } catch (err) {
    self.postMessage({ id, type: "error", error: String((err && err.message) || err) });
  }
};
