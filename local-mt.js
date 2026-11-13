/* ═══════════════════════════════════════════════════════════
   local-mt.js — (7.4.0) محرّك الترجمة الداخلي أُزيل من الموقع (كان ≈133MB بلا فائدة عملية).
   الترجمة الإنجليزية صارت يدوية: تُكتب بملف الإكسل (عمودا EN) أو من تبويب «الترجمة» مباشرة.
   هذا الملف واجهة فارغة بنفس الأسماء حتى لا ينكسر أي استدعاء قديم: كل شيء يرجّع «غير متوفر» بهدوء.
   ═══════════════════════════════════════════════════════════ */
const IDLE = { state: "idle", loaded: 0, total: 0, error: "" };
export function localSupported() { return false; }
export function engineStatus() { return IDLE; }
export function onEngineStatus(fn) { try { fn(IDLE); } catch (_) { /* تجاهل */ } return () => {}; }
export async function engineCached() { return false; }
export async function engineAvailable() { return false; }
export function warmupLocal() { return Promise.reject(new Error("removed")); }
export function translateLocal() { return Promise.resolve([]); }
