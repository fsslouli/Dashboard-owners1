# vendor/ — مكتبة تشغيل محرّك الترجمة الداخلي (6.8.0)

`transformers-3.7.5.min.js` نسخة ثابتة من الملف الجاهز `dist/transformers.min.js` بحزمة
`@huggingface/transformers@3.7.5` كما هو (بدون تعديل، فقط حُذف سطر خريطة المصدر الأخير).
محفوظة داخل المستودع عشان المحرّك ما يعتمد على تنزيل أي شي وقت البناء أو التشغيل،
وعشان ما تنسحب حزم الخادم الثقيلة (onnxruntime-node و sharp ≈ 550MB) ببناء Vercel.

| الملف | المصدر | الترخيص |
|---|---|---|
| `transformers-3.7.5.min.js` | Transformers.js 3.7.5 — Hugging Face | Apache-2.0 (`LICENSE-transformers.js.txt`) |
| ضمنه: ONNX Runtime Web 1.22.0-dev.20250409-89f8206ba4 / onnxruntime-common 1.21.0 | Microsoft | MIT |
| ضمنه: @huggingface/jinja 0.5.x | Hugging Face | MIT |

SHA-256: `e19af6f3717ea4e13eebbdff02cf8e857ec4a3b275c3f6238b1a90aa21fe8204`

ملفات التشغيل (WebAssembly) والموديل نفسه تحت `public/i18n-engine/` — انظر `public/i18n-engine/README.md`.
لو تحدّثت المكتبة لازم يتحدّث معها ملفا `public/i18n-engine/ort/*` من نفس الإصدار (نفس مجلد `dist` بالحزمة).

---

MIT License (ONNX Runtime — Copyright (c) Microsoft Corporation; @huggingface/jinja — Copyright (c) 2023 Hugging Face)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
