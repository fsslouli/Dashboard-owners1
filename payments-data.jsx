/* جدول الدفعات — الملحق (3)، خيار 1: عملاء الجهات التمويلية.
   thr = نسبة إنجاز البلوك التي تُستحق عندها الدفعة. الدفعة 7 عند الإفراغ/التسليم فلا تُحسب من النسبة.
   «مستحقة» = تحقق شرط النسبة فقط؛ الصرف الفعلي من البنك لا يعرفه الموقع. */
export const PAYMENTS = [
  { n: 1, pct: 20, cum: 20, thr: 0 },
  { n: 2, pct: 20, cum: 40, thr: 10 },
  { n: 3, pct: 20, cum: 60, thr: 45 },
  { n: 4, pct: 20, cum: 80, thr: 65 },
  { n: 5, pct: 10, cum: 90, thr: 85 },
  { n: 6, pct: 5, cum: 95, thr: 100 },
  { n: 7, pct: 5, cum: 100, thr: null },
];
export const PAY_NEAR = 8; /* «قريبة»: باقي هذا العدد من النقاط أو أقل */

/* حالة كل دفعة لنسبة إنجاز واحدة: due | near | next | lock */
export function payStates(p) {
  let nextSet = false;
  return PAYMENTS.map((y) => {
    if (y.thr !== null && p >= y.thr) return { y, s: "due", gap: 0 };
    if (!nextSet) {
      nextSet = true;
      const gap = y.thr === null ? null : +(y.thr - p).toFixed(2);
      return { y, s: gap !== null && gap <= PAY_NEAR ? "near" : "next", gap };
    }
    return { y, s: "lock", gap: y.thr === null ? null : +(y.thr - p).toFixed(2) };
  });
}
