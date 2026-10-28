# i18n-engine/ — ملفات محرّك الترجمة الداخلي (6.8.0)

كل اللي يحتاجه المحرّك يتحمّل من نفس الموقع — ما فيه أي اتصال بخدمة خارجية
(`env.allowRemoteModels = false` بملف `local-mt-worker.js`).
يتحمّل مرة وحدة لكل جهاز مشرف (≈140MB) وينحفظ بذاكرة المتصفح، والزوار ما يحمّلونه أبدًا.

| المسار | الوصف | الحجم |
|---|---|---|
| `models/opus-mt-ar-en/` | موديل الترجمة عربي → إنجليزي | ≈118MB |
| `ort/ort-wasm-simd-threaded.jsep.{mjs,wasm}` | محرّك تشغيل ONNX Runtime Web (WebAssembly) 1.22.0-dev.20250409-89f8206ba4 | ≈21.7MB |

## الموديل والترخيص
- الموديل: **Helsinki-NLP/opus-mt-ar-en** (MarianMT، مشروع OPUS-MT — جامعة هلسنكي)، الترخيص **Apache-2.0**.
  https://huggingface.co/Helsinki-NLP/opus-mt-ar-en
- النسخة المحوّلة لـ ONNX والمضغوطة (q8): **Xenova/opus-mt-ar-en** (نفس الترخيص Apache-2.0).
  https://huggingface.co/Xenova/opus-mt-ar-en
- الملفات منسوخة كما هي بدون تعديل. نص ترخيص Apache-2.0 الكامل: `vendor/LICENSE-transformers.js.txt` بالمستودع
  (نفس نص الترخيص)، أو https://www.apache.org/licenses/LICENSE-2.0
- ONNX Runtime Web — Microsoft — ترخيص MIT (نصه في `vendor/README.md`).

SHA-256:
- `onnx/encoder_model_quantized.onnx` — `d9b0d612acff86cf87634b49bda566d1ef39b312837de549786ea18fecefc708`
- `onnx/decoder_model_merged_quantized.onnx` — `cdb25ae736afe9d48035b0ea311ab4b25f315810fab7f3c6f6cb0d8d87af35fa`
- `ort/ort-wasm-simd-threaded.jsep.wasm` — `c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39`
- `ort/ort-wasm-simd-threaded.jsep.mjs` — `08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9`

## ملاحظة للتحديث
الملفات تنخدم بتخزين طويل (`vercel.json`) وتنحفظ بذاكرة المتصفح حسب المسار. لو تغيّر أي ملف هنا
لازم يتغيّر اسم المجلد أو الملف (مثلًا `opus-mt-ar-en-v2`) مع تحديث `MODEL_ID` بـ `local-mt-core.js`
أو المسار بـ `local-mt-worker.js` — وإلا الأجهزة اللي حمّلته قبل تكمل على النسخة القديمة.
