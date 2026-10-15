/* share-guard.jsx — حماية خفيفة لصفحة المستلم فقط (رابط المشاركة):
   ١) علامة مائية شبه مخفية (اسم الرابط + معرّف الجلسة + الوقت) تنكشف عند تحليل أي لقطة.
   ٢) تغطية المحتوى لما تضيع الصفحة التركيز (تبديل تطبيق/تبويب، أدوات القص). التركيز داخل إطار المجسم أو الخريطة لا يُعدّ فقدًا.
   ٣) منع النسخ والقص والسحب وقائمة الضغط اليمين خارج حقول الإدخال.
   ما تمنع لقطة الجوال نفسها (المتصفح ما يشوفها): الغرض الردع وتتبّع المصدر. */
import { useEffect, useMemo, useState } from "react";
import { EyeOff } from "lucide-react";

const pad = (n) => (n < 10 ? "0" + n : "" + n);
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isField = (el) => !!el?.closest?.("input,textarea,[contenteditable='true']");

export function ShareGuard({ label, sid }) {
  const [lost, setLost] = useState(false);
  const [minute, setMinute] = useState(stamp);
  useEffect(() => { const t = setInterval(() => setMinute(stamp()), 30000); return () => clearInterval(t); }, []);

  /* فقد التركيز: نتجاهل الانتقال إلى iframe (المجسم والخريطة) لأنه استخدام عادي */
  useEffect(() => {
    let t = null;
    const lose = () => setLost(true);
    const back = () => { clearTimeout(t); setLost(false); };
    const onVis = () => { if (document.hidden) lose(); else back(); };
    const onBlur = () => { clearTimeout(t); t = setTimeout(() => { if (document.activeElement?.tagName === "IFRAME") return; lose(); }, 60); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", back);
    window.addEventListener("pageshow", back);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("blur", onBlur); window.removeEventListener("focus", back); window.removeEventListener("pageshow", back); };
  }, []);

  /* منع النسخ والقائمة */
  useEffect(() => {
    const stop = (e) => { if (!isField(e.target)) e.preventDefault(); };
    const evs = ["contextmenu", "copy", "cut", "dragstart"];
    evs.forEach((n) => document.addEventListener(n, stop, true));
    return () => evs.forEach((n) => document.removeEventListener(n, stop, true));
  }, []);

  const bg = useMemo(() => {
    const who = esc(String(label || "مشاركة").trim().slice(0, 22));
    const id = esc(String(sid || "").slice(-6) || "------");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200"><text x="180" y="105" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#7A8A94" text-anchor="middle" transform="rotate(-24 180 100)">${who} · ${id} · ${minute}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [label, sid, minute]);

  return (
    <>
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 2147483000, pointerEvents: "none", opacity: 0.1, backgroundImage: bg }} />
      {lost && (
        <div role="alert" dir="rtl" onClick={() => setLost(false)} style={{ position: "fixed", inset: 0, zIndex: 2147483001, background: "var(--share-cover-bg, #0F1A20)", color: "#E7EEF2", display: "grid", placeContent: "center", gap: 10, textAlign: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <EyeOff size={30} style={{ margin: "0 auto", opacity: 0.8 }} />
          <b style={{ fontSize: 17 }}>المحتوى مخفي مؤقتًا</b>
          <span style={{ fontSize: 13.5, opacity: 0.75, lineHeight: 1.8 }}>غادرت الصفحة أو فقدت التركيز. اضغط هنا للمتابعة.</span>
        </div>
      )}
    </>
  );
}
