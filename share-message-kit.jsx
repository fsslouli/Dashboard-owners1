/* share-message-kit.jsx — الرسالة الجاهزة بعد إنشاء رابط المشاركة (6.3.0)
   تُبنى من بيانات الرابط نفسها (الرابط، الرمز، الصلاحية، عدد الفتحات، مدة الجلسة) وتُنسخ بضغطة.
   الرمز يُرسل افتراضيًا برسالة منفصلة لأنه الطبقة الثانية: لو وصل مع الرابط وتسرّب الرابط يتسرّب معه.
   النص كله هنا بمكان واحد عشان تعديله مستقبلًا لا يلمس بقية الواجهة. */
import { useState } from "react";
import { Check, Copy } from "lucide-react";

const SITE = "لوحة ملاك مشروع البورادا (الفرسان 2)";

/* opts: { sepPin, instructions, details } — created: { url, pin, durL, opensL, sessL, expiresL } */
export function buildShareMessages(created, opts) {
  const hasPin = !!created.pin;
  const L = ["السلام عليكم ورحمة الله وبركاته", "", `تفضل رابط الاطلاع الخاص بك على ${SITE}:`, "", created.url];
  if (hasPin && !opts.sepPin) L.push("", `رمز الدخول: ${created.pin}`);
  if (opts.details) {
    L.push("", "تفاصيل الرابط:", `- صالح لمدة ${created.durL} من الآن (ينتهي ${created.expiresL})`, `- عدد مرات الفتح: ${created.opensL}`, `- مدة العرض بعد الفتح: ${created.sessL}`);
  }
  if (opts.instructions) {
    let n = 1;
    L.push("", "طريقة الاستخدام:", `${n++}. افتح الرابط، واضغط زر «عرض المحتوى» وأنت جاهز للاطلاع (الفتحة تُحسب عند الضغط).`);
    if (hasPin) L.push(`${n++}. أدخل رمز الدخول.`);
    L.push(`${n++}. تصفّح الأقسام المتاحة لك، وتنتهي الجلسة تلقائيًا بعد المدة المحددة.`);
    L.push(`${n++}. لا تغلق الصفحة قبل ما تنتهي، لأن إعادة الفتح تحتاج فتحة جديدة.`);
    L.push(`${n++}. المحتوى خاص ومحمي بعلامة مائية، فلا يُنسخ ولا يُشارك.`);
  }
  L.push("", "مع التحية");
  const list = [{ title: hasPin && opts.sepPin ? "الرسالة الأولى: الرابط" : "الرسالة", text: L.join("\n") }];
  if (hasPin && opts.sepPin) list.push({ title: "الرسالة الثانية: الرمز (أرسلها بقناة مختلفة عن الرابط)", text: `رمز الدخول: ${created.pin}` });
  return list;
}

export function ShareMessageCard({ T, created, onCopyFail }) {
  const [o, setO] = useState({ sepPin: true, instructions: true, details: true });
  const [done, setDone] = useState(null);
  const msgs = buildShareMessages(created, o);
  const copy = async (i, text) => {
    try { await navigator.clipboard.writeText(text); setDone(i); setTimeout(() => setDone(null), 1800); }
    catch { onCopyFail && onCopyFail(); }
  };
  const chk = (key, text) => (
    <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.paper, cursor: "pointer" }}>
      <input type="checkbox" checked={o[key]} onChange={(e) => setO({ ...o, [key]: e.target.checked })} /> {text}
    </label>
  );
  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>رسالة جاهزة للإرسال</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
        {created.pin && chk("sepPin", "الرمز في رسالة منفصلة (الأكثر أمانًا)")}
        {chk("instructions", "تعليمات الاستخدام")}
        {chk("details", "المدة وعدد مرات الدخول")}
      </div>
      {msgs.map((m, i) => (
        <div key={m.title} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 5 }}>{m.title}</div>
          <div style={{ background: T.sunken, borderRadius: 12, padding: "11px 13px", fontSize: 13, lineHeight: 1.95, whiteSpace: "pre-wrap", wordBreak: "break-word", userSelect: "all", marginBottom: 7 }}>{m.text}</div>
          <button type="button" onClick={() => copy(i, m.text)} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${T.line}`, background: "none", color: T.paper, borderRadius: 9, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {done === i ? <Check size={13} /> : <Copy size={13} />} {done === i ? "تم النسخ" : "نسخ"}
          </button>
        </div>
      ))}
    </div>
  );
}
