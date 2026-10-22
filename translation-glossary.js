/* ═══════════════════════════════════════════════════════════
   translation-glossary.js (6.8.0) — معجم مصطلحات مشروع ألبورادا (عربي ← إنجليزي).

   لماذا؟ المترجم الآلي المجاني (MyMemory) يترجم مصطلحات البناء حرفيًا وبشكل خاطئ:
   «الأفياش» ← posts/fires، «بارد» ← Bard، «المجلس» ← council، «الكسارات» ← crushers…
   الحل: قبل الإرسال للمترجم تُستبدل المصطلحات المعروفة بمقابلها الإنجليزي الصحيح داخل النص،
   فيبقيها المترجم كما هي ويترجم الباقي حولها. (تجربة حيّة: «عدد الأفياش» ← «Number of fires»
   صارت «Number of outlets» بعد الاستبدال.)

   إضافة مصطلح جديد: سطر واحد [عربي، إنجليزي] بالقائمة — بدون ألـ التعريف ولا حروف الجر؛
   المطابقة تتسامح مع (ال، بال، لل، كال، و، ف) ومع ة/ه وأ/ا/إ وى/ي.
   الترتيب: العبارات الأطول أولًا تلقائيًا (فيلا العرض قبل فيلا).
   المعجم نفسه يستخدمه محرّك الترجمة بالسيرفر (Claude) — بعد أي تعديل: npm run sync:glossary
   ثم أعد نشر دالة i18n-translate عشان يلتزم فيه المحرّك أيضًا.
   ═══════════════════════════════════════════════════════════ */
export const GLOSSARY = [
  /* — أماكن وفراغات — */
  ["فلل", "villas"], ["فيلا", "villa"], ["فلة", "villa"],
  ["فيلا العرض", "show villa"], ["فلة العرض", "show villa"], ["فيلا العينة", "sample villa"], ["فلة العينة", "sample villa"],
  ["مجلس الرجال", "men's majlis"], ["مجلس", "majlis"], ["صالة", "living hall"], ["منور", "light well"],
  ["الحوش الأمامي", "front yard"], ["الحوش الخلفي", "backyard"], ["الحوشين", "yards"], ["حوش", "yard"],
  ["غرفة السطح", "roof room"], ["ملحق", "annex"], ["سطح", "roof"], ["غرفة الغسيل", "laundry room"], ["كراج", "garage"],
  ["الدور الأرضي", "ground floor"], ["الدور الأول", "first floor"], ["الدور الثاني", "second floor"], ["الدور الأخير", "top floor"],
  ["دورات المياه", "bathrooms"], ["دورة المياه", "bathroom"], ["حمامات", "bathrooms"], ["حمام", "bathroom"],
  ["بطن الدرج", "stair soffit"], ["درج", "staircase"], ["سور خارجي", "external fence"], ["سور", "fence wall"],
  ["أسياب", "corridors"], ["سيب", "corridor"], /* السيب بلهجة نجد = الممر بين الغرف */
  /* — تشطيبات ومواد — */
  ["جبس بورد", "gypsum board"], ["جبسون بورد", "gypsum board"], ["سمنت بورد", "cement board"], ["فريم", "frame"],
  ["بيت الستارة", "curtain pocket"], ["بيت ستارة", "curtain pocket"], ["نعلة السيراميك", "ceramic skirting"], ["نعلة", "skirting"],
  ["ميول", "slopes"], ["تبليط", "tiling"], ["بلاط", "tiles"], ["بحص", "gravel"], ["دفان", "backfill"], ["سيراميك", "ceramic"], ["بورسلان", "porcelain"],
  ["الأفرنجي المعلق", "wall-hung toilet"], ["أفرنجي أرضي", "floor-standing Western toilet"], ["أفرنجي", "Western toilet"], ["الأدوات الصحية", "sanitary ware"], ["شطاف", "bidet spray"],
  ["العزل المائي", "waterproofing"], ["العزل الحراري", "thermal insulation"], ["العزل الصوتي", "acoustic insulation"],
  ["الأحواض الزراعية", "planters"], ["الحوض الزراعي", "planter bed"], ["كسارات", "sill flashings"], ["كسارة", "sill flashing"],
  ["دريشة", "sliding window"], ["باب السحب", "sliding door"], ["باب سحب", "sliding door"], ["باب السحاب", "sliding door"], ["درابزين", "handrail"],
  /* — سباكة وصرف — */
  ["الصرف الصحي", "sewage"], ["ماصورة", "pipe"], ["ماسورة", "pipe"], ["مواسير", "pipes"], ["صفايات", "drains"], ["صفاية", "drain"],
  ["رداد", "check valve"], ["محابس", "valves"], ["محبس", "valve"], ["غرفة التفتيش", "inspection chamber"], ["غرف التفتيش", "inspection chambers"],
  ["غرفتي تفتيش", "two inspection chambers"], ["سخان", "water heater"], ["الخزان الأرضي", "ground tank"], ["الخزان العلوي", "upper tank"], ["خزان", "tank"],
  /* — كهرباء وتكييف — */
  ["أفياش", "outlets"], ["فيشة", "outlet"], ["فيش", "outlets"], ["طبلون", "distribution board"], ["قواطع", "breakers"], ["قاطع", "breaker"],
  ["كوابل", "cables"], ["كيبل", "cable"], ["انتركوم", "intercom"], ["كاميرات المراقبة", "surveillance cameras"], ["إنارة", "lighting"], ["إضاءة", "lighting"],
  ["مفاتيح التشغيل", "light switches"], ["تكييف", "air conditioning"], ["مكيفات", "AC units"], ["مكيف", "AC unit"],
  ["اسبليت", "split"], ["اسبيلت", "split"], ["سبليت", "split"], ["كاسيت", "cassette"], ["شفاط", "extractor fan"], ["جرجور", "duct"],
  ["فتحات صيانة", "maintenance access openings"], ["فتحة صيانة", "maintenance access opening"], ["فريون", "refrigerant (freon)"],
  /* — إنشاء — */
  ["كمرات وجسور", "beams and tie beams"], ["كمرات", "beams"], ["مياه الأمطار", "rainwater"], ["المخطط الإنشائي", "structural drawing"], ["المخططات الهندسية", "engineering drawings"], ["المخططات المعتمدة", "approved drawings"],
  ["تأسيس", "rough-in"], ["الصبة الخرسانية", "concrete slab"],
  /* — أطراف المشروع وإجراءاته — */
  ["الملاك", "owners"], ["المالك", "owner"], ["المطور", "developer"], ["المقاولين", "contractors"], ["المقاول", "contractor"],
  ["المهندس المسؤول", "responsible engineer"], ["المكتب الاستشاري", "consulting office"], ["فريق المشروع", "project team"],
  ["إدارة المبيعات", "sales department"], ["التسليم", "handover"], ["الإفراغ", "title transfer"], ["الوحدات", "units"], ["الوحدة", "unit"],
  ["النماذج", "models"], ["نموذج", "model"], ["البلكات", "blocks"], ["بلكات", "blocks"], ["بلك", "block"],
  /* — أسماء النماذج (الإنجليزية الرسمية بالموقع) — */
  ["أمانيثير", "Amanecer"], ["أورورا", "Aurora"], ["البادا", "Albada"], ["البدا", "Albada"], ["ألبا", "Alba"], ["البا", "Alba"],
  /* — صيغ القرار — */
  ["تم اعتماد", "approved"], ["تم الاعتماد", "approved"], ["تم رفض", "rejected"], ["لن يتم", "will not be"], ["سوف يتم", "will be"], ["قيد الدراسة", "under study"], ["قيد المراجعة", "under review"], ["بارد", "cold"], ["حار", "hot"],
];

/* ة/ه، أ/إ/آ/ا، ى/ي — تسامح إملائي شائع بملاحظات الملاك */
const norm = (t) => t.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const cls = (t) => norm(t).replace(/[^\s]/g, (ch) => (ch === "ا" ? "[اأإآ]" : ch === "ه" ? "[ةه]" : ch === "ي" ? "[ىي]" : ch.replace(/[.*+?^${}()|[\]\\\/'-]/g, "\\$&")));
const AR = "\\u0621-\\u064A";

const RULES = [...GLOSSARY]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([ar, en]) => {
    const base = ar.replace(/^ال/, ""); /* القائمة تقبل بألف ولام أو بدونها */
    const body = base.split(/\s+/).map((w, i) => (i === 0 ? cls(w) : "(?:ال)?" + cls(w))).join("\\s+");
    return { re: new RegExp(`(?<![${AR}])([وف]?)(لل|[بلك]?(?:ال)?)(${body})(?![${AR}])`, "g"), en };
  });

const PREP = { "ب": "in ", "ل": "for ", "لل": "for ", "ك": "as " };
/* يستبدل المصطلحات المعروفة بمقابلها الإنجليزي (مع حفظ «و/ب/ل» كـ and/in/for) */
export function applyGlossary(text) {
  let out = String(text || "");
  for (const { re, en } of RULES) {
    out = out.replace(re, (_m, w, p) => {
      const pre = (w === "و" ? "and " : "") + (PREP[String(p).replace(/ال$/, "")] || "");
      return " " + pre + en + " ";
    });
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/ +([،,.؟?!:؛;)])/g, "$1").replace(/\( +/g, "(").trim();
}

/* يقسّم النص لأسطر ثم لقطع ≤ max حرفًا عند حدود الجُمل (المترجم المجاني يقص ما فوق ~490 حرفًا بصمت).
   الناتج: مصفوفة أسطر، كل سطر مصفوفة قطع — فتُعاد الأسطر والفقرات كما هي بعد الترجمة. */
export function splitForTranslation(text, max = 380) {
  const s = String(text || "").replace(/\r/g, "");
  return s.split("\n").map((line) => {
    if (!line.trim()) return [];
    const parts = line.split(/(?<=[.؟?!؛;—])\s+/);
    const out = []; let cur = "";
    for (const p of parts) {
      if (cur && (cur + " " + p).length > max) { out.push(cur.trim()); cur = p; }
      else cur = cur ? cur + " " + p : p;
      while (cur.length > max) { /* جملة وحدها أطول من الحد: نقطعها عند آخر مسافة */
        const cut = cur.lastIndexOf(" ", max); const at = cut > 40 ? cut : max;
        out.push(cur.slice(0, at).trim()); cur = cur.slice(at).trim();
      }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  });
}
