/* ═══════════════════════════════════════════════════════════
   engine.ts (6.8.0) — منطق الترجمة نفسه، بدون أي اتصال بقاعدة البيانات (يُختبر محليًا):
   • Claude (لو ANTHROPIC_API_KEY مضبوط): برومبت بسياق المشروع + المعجم + أمثلة معتمدة،
     ومخرجات مُهيكلة (tool) — ثم فحص جودة آلي لكل بند وإعادة محاولة واحدة بملاحظة الخطأ.
   • البديل الآلي المجاني (MyMemory) لو ما فيه مفتاح أو تعطّل Claude: بالمعجم وتقطيع النص،
     ونتيجته تُوسَم «آلية» فتُعاد ترجمتها بـ Claude تلقائيًا أول ما يتوفر المفتاح.
   ═══════════════════════════════════════════════════════════ */
import { GLOSSARY, applyGlossary, splitForTranslation } from "./glossary.js";

export type Kind = "text" | "label" | "person" | "title" | "heading";
export type Item = { id: string; ar: string; kind: Kind };
export type Out = { id: string; en: string; engine: "claude" | "machine"; flags: string[] };
export const KINDS: Kind[] = ["text", "label", "person", "title", "heading"];

/* ── فحص الجودة ── */
const AR_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const latinDigits = (s: string) =>
  s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/\u066B/g, ".").replace(/\u066C/g, ",").replace(/²/g, "2").replace(/³/g, "3");
const normNum = (x: string) => x.replace(/,/g, "").replace(/^0+(?=\d)/, "");
export function numbersOf(s: string): string[] {
  return (latinDigits(String(s || "")).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(normNum).filter(Boolean);
}
/* يرجّع قائمة مشاكل؛ الفاضية = سليمة. الصلبة (HARD) تستدعي إعادة محاولة. */
export function validate(it: Item, en: string): string[] {
  const t = String(en || "").trim();
  if (!t) return ["empty"];
  const issues: string[] = [];
  if (AR_SCRIPT.test(t)) issues.push("arabic_left");
  const have = new Set(numbersOf(t));
  const missing = [...new Set(numbersOf(it.ar))].filter((n) => !have.has(n));
  if (missing.length) issues.push("numbers:" + missing.slice(0, 6).join(","));
  if (it.kind === "text" && it.ar.length >= 80) {
    const r = t.length / it.ar.length;
    if (r < 0.6 || r > 3.2) issues.push("length");
  }
  if (/[اأآ]مانيثير/.test(it.ar) && !/Amanecer/.test(t)) issues.push("model_name");
  return issues;
}
export const isHard = (s: string) => s === "empty" || s === "arabic_left" || s === "length" || s.startsWith("numbers:");
const describe = (issues: string[]) => issues.map((x) =>
  x === "empty" ? "the translation was empty"
  : x === "arabic_left" ? "it still contained Arabic script; translate or transliterate every word"
  : x.startsWith("numbers:") ? `it dropped or changed these source numbers: ${x.slice(8)}; keep every number exactly`
  : x === "length" ? "its length does not match the source; translate the complete text with nothing omitted or added"
  : x === "model_name" ? "the villa model name must be the official English name (Amanecer)"
  : x).join("; ");

/* ── تجهيز الدُفعات ── */
export function makeBatches(items: Item[], maxItems = 30, maxChars = 4500): Item[][] {
  const out: Item[][] = [];
  let cur: Item[] = [], chars = 0;
  for (const it of items) {
    const n = it.ar.length;
    if (cur.length && (cur.length >= maxItems || chars + n > maxChars)) { out.push(cur); cur = []; chars = 0; }
    cur.push(it); chars += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/* ── البرومبت ── */
/* صيغ القرار بالمعجم (تم اعتماد/بارد…) وُضعت للمترجم الآلي الحرفي؛ Claude يفهم السياق فلا نقيّده بها */
const MACHINE_ONLY = new Set(["تم اعتماد", "تم الاعتماد", "تم رفض", "لن يتم", "سوف يتم", "قيد الدراسة", "قيد المراجعة", "بارد", "حار"]);
export const KNOWN_NAMES = [
  "م/محمد عبدالمعطي = Eng. Mohammed Abdulmuti", "م/أحمد ملحم = Eng. Ahmed Malham", "م/رواحه = Eng. Rawaha",
  "م/إبراهيم = Eng. Ibrahim", "وديان = Wedyan", "وديان الثميري = Wedyan Althumairi", "أبو سلطان = Abu Sultan", "أبو علي = Abu Ali", "أدولفو = Adolfo",
];
export function buildSystemPrompt(): string {
  const gl = (GLOSSARY as string[][]).filter((g) => !MACHINE_ONLY.has(g[0])).map((g) => `${g[0]} → ${g[1]}`).join("\n");
  return `You are the professional Arabic-to-English translator for the owners' dashboard of Villas Alborada, a residential villa project in Al Fursan, Riyadh, Saudi Arabia. The dashboard tracks the owners' inquiries and remarks about their villas under construction (finishes, MEP, waterproofing, structure, handover) and the replies of the developer and its engineers. English readers include the developer's executive management, who do not read Arabic and make decisions based on your English, so it must be exact, complete and professional.

Rules
1. Fidelity first. Translate the complete meaning. Never summarize, omit, soften, embellish or explain. Keep the tone and certainty of the source (a request stays a request, a firm refusal stays firm, "may" stays "may"). Render Gulf colloquial or loosely written Arabic as its intended meaning in clean professional English.
2. Terminology. Use the project glossary below for its terms, inflecting naturally (plural, articles). Otherwise use standard construction and MEP terminology. Use American spelling.
3. Numbers. Keep every number exactly as in the source: dates (17-10-2026 stays 17-10-2026), sizes, quantities, percentages, inquiry and block numbers. Write digits as 0-9. Units: سم = cm, مم = mm, م (length) = m, م² or م2 = m², لتر = liters, ريال = SAR, بوصة or إنش = inch.
4. Structure. Keep line breaks, numbering and sentence order. The pattern "… — الحل المقترح: …" becomes "… — proposed solution: …"; at the start of a line use "Proposed solution:". "الوضع الحالي:" = "Current situation:". "استفسار:" = "Inquiry:". Keep Latin-script text (codes, brands, SBC references) unchanged.
5. Names. Transliterate personal names with standard English spellings; "م/" = "Eng.", "د/" = "Dr.", "أبو X" = "Abu X". Established spellings: ${KNOWN_NAMES.join("; ")}.
6. Villa models (official English names): أمانيثير / آمانيثير / امانيثير = Amanecer; ألبا / البا = Alba; أورورا / اورورا = Aurora; البادا / البدا = Albada. "جميع النماذج" = "all models".
7. Item kinds:
   - text: sentences or paragraphs; normal sentence case and punctuation.
   - label: a short interface label (location, category, status, priority, meeting, model scope); concise Title Case, no final period.
   - person: a person's name with an optional honorific; transliterate only, never translate the meaning of a name.
   - title: a job title in Title Case.
   - heading: the title of a document, video, photo album or page; Title Case, no final period.
8. Output English only. Never include Arabic script, alternatives, notes, the source text, or quotation marks around the whole translation.
9. Uncertainty. If a word is ambiguous, misspelled, dialectal or site jargon, choose the most likely meaning from the context and report it in "uncertain" as "<Arabic> → <English> (<short reason>)". Leave "uncertain" empty when you are confident.
10. If an item has a "fix" field, your previous translation of it failed an automatic quality check; return a corrected, complete translation.

Examples
ar: سوف يتم تنبيه المقاولين بذلك
en: Contractors will be notified of this.
ar (a reply about a hot-water bidet line): تم اعتماد بارد فقط
en: Cold water only was approved.
ar: التبليط فوق بقايا أخشاب ومسامير في المشروع مما قد يتسبب بالنمل الأبيض وهبوط الارضيه — الحل المقترح: إلزام المقاولين بتنظيف الارضيه قبل البدء بأعمال التبليط في المشروع
en: Tiling over leftover wood and nails in the project, which may cause termites and floor settlement — proposed solution: require contractors to clean the floor before starting tiling work in the project.
ar: تمت الترقيه إلى جبس بورد في جميع غرف النوم بدون الاسياب
en: Upgraded to gypsum board in all bedrooms, excluding the corridors.
ar (label): الحوش الخلفي (الأرضي)
en: Backyard (Ground Floor)
ar (person): م/محمد عبدالمعطي
en: Eng. Mohammed Abdulmuti

Project glossary (Arabic → English)
${gl}`;
}

const TOOL = {
  name: "submit_translations",
  description: "Return the English translation of every input item, using the same id.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            en: { type: "string", description: "The complete English translation." },
            uncertain: { type: "array", items: { type: "string" }, description: "Ambiguous terms as '<Arabic> → <English> (reason)'. Empty if none." },
          },
          required: ["id", "en"],
        },
      },
    },
    required: ["items"],
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export class EngineError extends Error { constructor(msg: string, public fatal = false) { super(msg); } }

/* استدعاء واحد لـ Claude مع إعادة محاولة للأخطاء المؤقتة فقط (429/529/5xx) */
async function callClaude(key: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
    const txt = (await res.text()).slice(0, 300);
    last = `Claude ${res.status}: ${txt}`;
    if (res.status === 400 && /temperature/i.test(txt) && "temperature" in body) { delete body.temperature; continue; }
    if (res.status === 429 || res.status === 529 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
    /* 400/401/403/404: مفتاح غلط، رصيد منتهي، أو اسم نموذج غير صحيح — لا فائدة من التكرار */
    throw new EngineError(last, true);
  }
  throw new EngineError(last);
}

let SYSTEM_CACHE = "";
async function claudeBatch(key: string, model: string, batch: Item[], fix: Record<string, string> = {}) {
  if (!SYSTEM_CACHE) SYSTEM_CACHE = buildSystemPrompt();
  const payload = batch.map((it) => ({ id: it.id, kind: it.kind, ar: it.ar, ...(fix[it.id] ? { fix: fix[it.id] } : {}) }));
  const data = await callClaude(key, {
    model,
    max_tokens: 8192,
    temperature: 0,
    system: [{ type: "text", text: SYSTEM_CACHE, cache_control: { type: "ephemeral" } }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_translations" },
    messages: [{ role: "user", content: "Translate every item from Arabic to English following the rules.\n\n" + JSON.stringify(payload) }],
  });
  const blocks = Array.isArray(data.content) ? data.content as Array<Record<string, unknown>> : [];
  const tu = blocks.find((b) => b.type === "tool_use" && b.name === "submit_translations") as { input?: { items?: unknown } } | undefined;
  const arr = Array.isArray(tu?.input?.items) ? tu!.input!.items as Array<Record<string, unknown>> : [];
  const map = new Map<string, { en: string; uncertain: string[] }>();
  for (const r of arr) {
    const id = String(r?.id ?? "");
    if (!id) continue;
    const unc = Array.isArray(r.uncertain) ? (r.uncertain as unknown[]).map((u) => String(u).slice(0, 200)).filter(Boolean).slice(0, 6) : [];
    map.set(id, { en: String(r.en ?? "").trim(), uncertain: unc });
  }
  return map;
}

/* تنظيف بسيط: علامات تنصيص محيطة، نقطة نهاية للتسميات، حرف أول كبير للتسميات */
export function tidy(en: string, kind: Kind): string {
  let t = String(en || "").replace(/\r/g, "").trim();
  t = t.replace(/^["“'«]+|["”'»]+$/g, "").trim();
  if (kind !== "text") {
    t = t.replace(/[.。]+$/, "").trim();
    if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t;
}

export async function claudeTranslate(
  key: string, model: string, items: Item[], deadline: number,
  onResults: (outs: Out[]) => Promise<void>, attempted: Set<string> = new Set(),
): Promise<number> {
  let done = 0;
  for (const batch of makeBatches(items)) {
    if (Date.now() > deadline) break;
    const res = await claudeBatch(key, model, batch);
    batch.forEach((it) => attempted.add(it.id));
    const fix: Record<string, string> = {};
    const retry = batch.filter((it) => {
      const r = res.get(it.id);
      const issues = r ? validate(it, r.en) : ["empty"];
      if (issues.some(isHard)) { fix[it.id] = describe(issues); return true; }
      return false;
    });
    if (retry.length && Date.now() < deadline) {
      try {
        const res2 = await claudeBatch(key, model, retry, fix);
        for (const it of retry) {
          const r2 = res2.get(it.id);
          if (!r2 || !r2.en) continue;
          const before = res.get(it.id);
          /* نعتمد المحاولة الثانية لو مشاكلها الصلبة أقل */
          const hard1 = before ? validate(it, before.en).filter(isHard).length : 99;
          const hard2 = validate(it, r2.en).filter(isHard).length;
          if (hard2 <= hard1) res.set(it.id, r2);
        }
      } catch (e) { if (e instanceof EngineError && e.fatal) throw e; }
    }
    const outs: Out[] = [];
    for (const it of batch) {
      const r = res.get(it.id);
      const en = r ? tidy(r.en, it.kind) : "";
      if (!en) continue;
      const flags = validate(it, en).filter((x) => x !== "empty");
      (r?.uncertain || []).forEach((u) => flags.push("uncertain: " + u));
      outs.push({ id: it.id, en, engine: "claude", flags });
    }
    if (outs.length) { await onResults(outs); done += outs.length; }
  }
  return done;
}

/* ── البديل الآلي المجاني ── */
export class QuotaError extends Error {}
const MM_FAIL = /MYMEMORY WARNING|QUERY LENGTH LIMIT|WORDS LIMIT EXCEEDED|INVALID (SOURCE|TARGET) LANGUAGE|IS AN INVALID (SOURCE|TARGET) LANGUAGE|PLEASE SELECT TWO DISTINCT LANGUAGES|INVALID EMAIL PROVIDED|NO TRANSLATIONS? (FOUND|AVAILABLE)/i;
const decode = (t: string) => String(t).replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
async function mmOne(q: string): Promise<string> {
  const r = await fetch("https://api.mymemory.translated.net/get?langpair=ar|en&q=" + encodeURIComponent(q));
  const d = await r.json().catch(() => ({}));
  const raw = decode(d?.responseData?.translatedText || "");
  if (/YOU USED ALL AVAILABLE FREE TRANSLATIONS|MYMEMORY WARNING/i.test(raw) || Number(d?.responseStatus) === 429) throw new QuotaError(raw.slice(0, 120) || "quota");
  if (!raw || MM_FAIL.test(raw) || Number(d?.responseStatus) !== 200) return "";
  const letters = raw.replace(/[^A-Za-z]/g, "");
  if (letters.length > 12 && letters === letters.toUpperCase()) return "";
  return raw.replace(/\s{2,}/g, " ").trim();
}
export async function machineOne(it: Item): Promise<string> {
  let prefix = "", rest = it.ar.trim();
  if (it.kind === "person" || it.kind === "title") {
    rest = rest.replace(/^م\s*\/\s*/, () => { prefix = "Eng. "; return ""; }).replace(/^د\s*\/\s*/, () => { prefix = "Dr. "; return ""; });
  }
  const lines: string[][] = splitForTranslation(rest);
  const outLines: string[] = [];
  for (const chunks of lines) {
    const done: string[] = [];
    for (const c of chunks) {
      const body = applyGlossary(c);
      const en = await mmOne(body);
      if (!en || (body.length > 120 && en.length < body.length * 0.3)) return "";
      done.push(en);
    }
    outLines.push(done.join(" "));
  }
  const out = tidy(outLines.join("\n"), it.kind);
  return out ? prefix + out : "";
}
export async function machineTranslate(
  items: Item[], deadline: number, onResults: (outs: Out[]) => Promise<void>, attempted: Set<string> = new Set(),
): Promise<number> {
  let done = 0;
  let buf: Out[] = [];
  const flush = async () => { if (buf.length) { const b = buf; buf = []; await onResults(b); done += b.length; } };
  try {
    for (const it of items) {
      if (Date.now() > deadline) break;
      const en = await machineOne(it); /* QuotaError يطلع للمستدعي ليوقف الدورة ويؤجل */
      attempted.add(it.id);
      if (en) {
        const flags = ["machine", ...validate(it, en).filter((x) => x !== "empty")];
        buf.push({ id: it.id, en, engine: "machine", flags });
      }
      if (buf.length >= 8) await flush();
    }
  } finally {
    await flush(); /* حتى لو انتهت الحصة بالنص، اللي تُرجم ينحفظ */
  }
  return done;
}
