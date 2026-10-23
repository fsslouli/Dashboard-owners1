/* local-mt-config.js (6.8.0) — ثوابت محرّك الترجمة الداخلي (مشتركة بين الواجهة والـ Worker، بدون أي كود ثقيل) */
export const ENGINE_ID = "local";
export const MODEL_ID = "opus-mt-ar-en";
/* كل ملفات المحرّك من نفس الموقع (public/i18n-engine) */
export const ENGINE_PATH = "/i18n-engine/";
/* ملفات الموديل الكبيرة — وجودها بذاكرة المتصفح = المحرّك متحمّل بهالجهاز */
export const MODEL_FILES = ["onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"];
/* اسم ذاكرة المتصفح اللي تحفظ فيها مكتبة التشغيل ملفات الموديل */
export const BROWSER_CACHE = "transformers-cache";
/* الحجم التقريبي لأول تحميل بكل جهاز (موديل + محرّك تشغيل) */
export const ENGINE_SIZE_MB = 140;
