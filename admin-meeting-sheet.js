/* ═══════════════════════════════════════════════════════════
   ورقة الاجتماع القادم (٥.٣.٠) — لوحة الإدارة فقط.

   تولّد ملف إكسل فيه ورقة واحدة بنفس شكل أوراق الاجتماعات بملف
   «استفسارات الملاك» (مثل «الاجتماع القادم» / «الاجتماع السابع»):
     • صفّا عناوين: مجموعات مدموجة (بيانات التصنيف · الملاحظة والحل المقترح ·
       الحالة والمتابعة) ثم عناوين الأعمدة الـ١٢ (A–L) بنفس الترتيب والعرض
     • من اليمين لليسار، الصفّان الأولان مثبّتان، خط Arial وحدود رمادية D9D9D9
     • ألوان الأولوية وحالة المقترح وحالة الرد والإغلاق + نفس قواعد التنسيق
       الشرطي، فأي تعديل يدوي على الحالة يتلوّن تلقائيًا مثل ملفك
     • «شهر الرد» تاريخ بصيغة yyyy-mm و«شهر الرد (نص)» بنفس معادلة TEXT
   الصفوف = الاستفسارات المفتوحة بالسجل، مرتبة برقمها، و«م» = رقم الاستفسار
   بالسجل (يسهّل الرجوع للسجل بعد الاجتماع). تضيف عليها أي بنود جديدة يدويًا.

   منطق خالص بلا React ولا مكتبات: كاتب xlsx صغير (XML + ZIP بدون ضغط،
   نفس طريقة SheetJS الافتراضية) — فما تكبر حزمة اللوحة بمكتبة جديدة.
   ═══════════════════════════════════════════════════════════ */

const ORDINALS = [
  "", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر",
  "الثامن عشر", "التاسع عشر", "العشرون",
];
const FALLBACK_NAME = "الاجتماع القادم";

const isClosed = (r) => {
  const c = r && r.closed;
  if (c === true) return true;
  if (typeof c === "string") return ["نعم", "مغلقة", "مقفلة", "مغلق", "مقفل"].includes(c.trim());
  return false;
};
const meetingsOf = (r) => {
  const m = r && r.meetings;
  if (Array.isArray(m)) return m;
  if (typeof m === "string") { try { const p = JSON.parse(m); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
  return [];
};
/* رقم الاجتماع من اسمه («الاجتماع السادس (ميداني)» ← ٦) — يبدأ من الأكبر عشان «الثاني عشر» ما تُقرأ «الثاني» */
const meetingNumber = (name) => {
  const s = String(name || "");
  for (let i = ORDINALS.length - 1; i >= 1; i--) if (s.includes(ORDINALS[i])) return i;
  return 0;
};

/* اسم الاجتماع التالي = أكبر اجتماع مذكور بالسجل + ١ */
export function nextMeetingName(inquiries = []) {
  let max = 0;
  (inquiries || []).forEach((r) => meetingsOf(r).forEach((m) => { max = Math.max(max, meetingNumber(m)); }));
  const n = max + 1;
  return n < ORDINALS.length ? `الاجتماع ${ORDINALS[n]}` : FALLBACK_NAME;
}

/* اسم ورقة إكسل صالح: بدون [ ] : * ? / \ وبحد ٣١ حرفًا */
export const safeSheetName = (name) => {
  const s = String(name || "").replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31).trim();
  return s || FALLBACK_NAME;
};

export const openInquiries = (inquiries = []) =>
  (inquiries || []).filter((r) => r && !isClosed(r)).sort((a, b) => (+a.id || 0) - (+b.id || 0));

/* ── المحتوى: صف لكل استفسار مفتوح بنفس أعمدة الورقة ── */
const blank = (v) => v === null || v === undefined || String(v).trim() === "";
const monthSerial = (mk) => {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(mk || "").trim());
  return m ? (Date.UTC(+m[1], +m[2] - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000 : null;
};
function rowValues(r, statusLabel) {
  const answered = r.answered === true || (r.answered == null && !blank(r.reply));
  const owner = blank(r.owner) || String(r.owner).trim() === "غير محدد" ? "" : String(r.owner).trim();
  const mk = String(r.month || "").trim();
  return {
    A: Number.isFinite(+r.id) ? +r.id : String(r.id ?? ""),
    B: r.model || "", C: r.loc || "", D: r.pri || "", E: r.note || "",
    F: statusLabel(r.status || ""),
    G: answered ? "تم الرد" : "بانتظار الرد",
    H: r.reply || "", I: owner,
    J: monthSerial(mk), Jtext: monthSerial(mk) != null ? mk : "",
    K: isClosed(r) ? "مقفل" : "مفتوح",
  };
}

/* ── التنسيق: نفس ألوان ملف الاستفسارات ── */
const TONE = { green: ["FF375623", "FFE2EFDA"], red: ["FFC00000", "FFFCE4E4"], amber: ["FF9C6500", "FFFFF2CC"], blue: ["FF1F4E79", "FFDDEBF7"], grey: ["FF595959", "FFF2F2F2"] };
const TONE_KEYS = ["green", "red", "amber", "blue", "grey"];
const BADGES = {
  D: { "عالية جدًا": "red", "عالية": "amber", "متوسطة": "blue", "عادية": "grey" },
  F: { "معتمدة": "green", "غير معتمدة": "red", "تم الرفض": "red", "قيد الدراسة": "amber", "تم التصويت": "blue" },
  G: { "تم الرد": "green", "بانتظار الرد": "red" },
  K: { "مقفل": "green", "مفتوح": "red" },
};
/* أرقام أنماط الخلايا (cellXfs) بملف styles.xml تحت */
const S = { group: 1, groupBlue: 2, head: 3, num: 4, center: 5, text: 6, date: 7, badge: { green: 8, red: 9, amber: 10, blue: 11, grey: 12 }, badgePlain: 13 };
const COLS = [
  { c: "A", w: 6, head: "م" }, { c: "B", w: 17, head: "نوع النموذج" }, { c: "C", w: 14, head: "موقع الملاحظة" },
  { c: "D", w: 12, head: "درجة الأولوية" }, { c: "E", w: 55, head: "الملاحظة / الحل المقترح" }, { c: "F", w: 13, head: "حالة المقترح" },
  { c: "G", w: 13, head: "حالة الرد" }, { c: "H", w: 45, head: "الرد على المقترح" }, { c: "I", w: 16, head: "صاحب الرد" },
  { c: "J", w: 11, head: "شهر الرد" }, { c: "K", w: 12, head: "حالة الإغلاق" }, { c: "L", w: 11, head: "شهر الرد (نص)" },
];
/* تقدير ارتفاع الصف حسب طول النص (إكسل ما يحسب الارتفاع وحده عند الفتح) — أقلّه ٥٢٫٥ مثل ورقتك */
const LINE_CAP = { B: 15, C: 12, E: 60, H: 48, I: 14 };
const rowHeight = (v) => {
  let lines = 1;
  Object.entries(LINE_CAP).forEach(([c, cap]) => {
    const n = String(v[c] || "").split("\n").reduce((s, part) => s + Math.max(1, Math.ceil(part.length / cap)), 0);
    lines = Math.max(lines, n);
  });
  return Math.min(300, Math.max(52.5, lines * 13 + 10));
};

/* ── XML ── */
const BAD_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const esc = (s) => String(s).replace(BAD_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";

function stylesXml() {
  const font = (sz, color, bold) => `<font>${bold ? "<b/>" : ""}<sz val="${sz}"/><color rgb="${color}"/><name val="Arial"/><family val="2"/></font>`;
  const fonts = [
    font(10, "FF000000", false), font(12, "FFFFFFFF", true), font(11, "FFFFFFFF", true), font(10, "FF1F3864", true),
    ...TONE_KEYS.map((k) => font(10, TONE[k][0], true)), font(10, "FF000000", true),
  ];
  const solid = (rgb) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = [
    '<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
    solid("FF1F3864"), solid("FF2E75B6"), ...TONE_KEYS.map((k) => solid(TONE[k][1])),
  ];
  const side = (n) => `<${n} style="thin"><color rgb="FFD9D9D9"/></${n}>`;
  const borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>", `<border>${side("left")}${side("right")}${side("top")}${side("bottom")}<diagonal/></border>`];
  const al = (h) => `<alignment horizontal="${h}" vertical="center" wrapText="1"/>`;
  const xf = (font, fill, align, numFmt = 0) =>
    `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${numFmt ? ' applyNumberFormat="1"' : ""}>${align}</xf>`;
  const xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    xf(1, 2, al("center")), xf(1, 3, al("center")), xf(2, 3, al("center")), xf(3, 0, al("center")),
    xf(0, 0, al("center")), xf(0, 0, al("right")), xf(0, 0, al("center"), 164),
    ...TONE_KEYS.map((k, i) => xf(4 + i, 4 + i, al("center"))), xf(9, 0, al("center")),
  ];
  const dxfs = TONE_KEYS.map((k) => `<dxf><font><b/><color rgb="${TONE[k][0]}"/></font><fill><patternFill patternType="solid"><fgColor rgb="${TONE[k][1]}"/><bgColor rgb="${TONE[k][1]}"/></patternFill></fill></dxf>`);
  return XML_HEAD + `<styleSheet xmlns="${NS_MAIN}">`
    + '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm"/></numFmts>'
    + `<fonts count="${fonts.length}">${fonts.join("")}</fonts>`
    + `<fills count="${fills.length}">${fills.join("")}</fills>`
    + `<borders count="${borders.length}">${borders.join("")}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + `<dxfs count="${dxfs.length}">${dxfs.join("")}</dxfs>`
    + '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>'
    + "</styleSheet>";
}

function sheetXml(rows, sst) {
  const str = (ref, s, v) => (blank(v) ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}" t="s"><v>${sst(v)}</v></c>`);
  const out = [];
  /* صف ١: عناوين المجموعات (A1:D1 و F1:K1 مدموجة) */
  out.push('<row r="1" spans="1:12" ht="24" customHeight="1">'
    + str("A1", S.group, "بيانات التصنيف") + ["B1", "C1", "D1"].map((r) => `<c r="${r}" s="${S.group}"/>`).join("")
    + str("E1", S.groupBlue, "الملاحظة والحل المقترح")
    + str("F1", S.group, "الحالة والمتابعة") + ["G1", "H1", "I1", "J1", "K1", "L1"].map((r) => `<c r="${r}" s="${S.group}"/>`).join("")
    + "</row>");
  /* صف ٢: عناوين الأعمدة */
  out.push(`<row r="2" spans="1:12" ht="30" customHeight="1">${COLS.map((k) => str(`${k.c}2`, S.head, k.head)).join("")}</row>`);
  rows.forEach((v, i) => {
    const n = i + 3;
    const badge = (c) => { const tone = BADGES[c][v[c]]; return tone ? S.badge[tone] : S.badgePlain; };
    const cells = [
      typeof v.A === "number" ? `<c r="A${n}" s="${S.num}"><v>${v.A}</v></c>` : str(`A${n}`, S.num, v.A),
      str(`B${n}`, S.center, v.B), str(`C${n}`, S.center, v.C), str(`D${n}`, blank(v.D) ? S.center : badge("D"), v.D),
      str(`E${n}`, S.text, v.E), str(`F${n}`, blank(v.F) ? S.center : badge("F"), v.F),
      str(`G${n}`, badge("G"), v.G), str(`H${n}`, S.text, v.H), str(`I${n}`, S.center, v.I),
      v.J != null ? `<c r="J${n}" s="${S.date}"><v>${v.J}</v></c>` : `<c r="J${n}" s="${S.date}"/>`,
      str(`K${n}`, badge("K"), v.K),
      v.J != null
        ? `<c r="L${n}" s="${S.center}" t="str"><f>IF($J${n}="","",TEXT($J${n},"YYYY-MM"))</f><v>${esc(v.Jtext)}</v></c>`
        : `<c r="L${n}" s="${S.center}"/>`,
    ];
    out.push(`<row r="${n}" spans="1:12" ht="${rowHeight(v)}" customHeight="1">${cells.join("")}</row>`);
  });
  const last = Math.max(2, rows.length + 2);
  let prio = 0;
  const cf = (col, map) => `<conditionalFormatting sqref="${col}3:${col}1000">`
    + Object.entries(map).map(([val, tone]) =>
      `<cfRule type="expression" dxfId="${TONE_KEYS.indexOf(tone)}" priority="${++prio}"><formula>${esc(`$${col}3="${val}"`)}</formula></cfRule>`).join("")
    + "</conditionalFormatting>";
  return XML_HEAD + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    + `<dimension ref="A1:L${last}"/>`
    + '<sheetViews><sheetView rightToLeft="1" tabSelected="1" workbookViewId="0">'
    + '<pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A3" sqref="A3"/>'
    + "</sheetView></sheetViews>"
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + `<cols>${COLS.map((k, i) => `<col min="${i + 1}" max="${i + 1}" width="${k.w}" customWidth="1"/>`).join("")}</cols>`
    + `<sheetData>${out.join("")}</sheetData>`
    + '<mergeCells count="2"><mergeCell ref="A1:D1"/><mergeCell ref="F1:K1"/></mergeCells>'
    + cf("F", BADGES.F) + cf("D", BADGES.D) + cf("G", BADGES.G) + cf("K", BADGES.K)
    + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
    + '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    + "</worksheet>";
}

/* ── ZIP بدون ضغط (stored) ── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files, when) {
  const enc = new TextEncoder();
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const dosDate = (Math.max(0, when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const parts = []; const central = []; let offset = 0;
  files.forEach(({ name, text }) => {
    const nameB = enc.encode(name); const data = enc.encode(text); const crc = crc32(data);
    const local = new Uint8Array(30 + nameB.length); const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true); lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameB.length, true); lv.setUint16(28, 0, true);
    local.set(nameB, 30);
    const cen = new Uint8Array(46 + nameB.length); const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, offset, true); cen.set(nameB, 46);
    parts.push(local, data); central.push(cen); offset += local.length + data.length;
  });
  const cenSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true); ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let p = 0; all.forEach((a) => { out.set(a, p); p += a.length; });
  return out;
}

/* ── الواجهة العامة للملف ── */
export function buildMeetingXlsx(inquiries = [], { sheetName, statusLabel = (v) => v, now = new Date() } = {}) {
  const name = safeSheetName(sheetName || nextMeetingName(inquiries));
  const rows = openInquiries(inquiries).map((r) => rowValues(r, statusLabel));
  const strings = []; const index = new Map(); let refs = 0;
  const sst = (v) => { const s = String(v); refs++; if (!index.has(s)) { index.set(s, strings.length); strings.push(s); } return index.get(s); };
  const sheet = sheetXml(rows, sst);
  const quoted = `'${name.replace(/'/g, "''")}'`;
  const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const files = [
    { name: "[Content_Types].xml", text: XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      + "</Types>" },
    { name: "_rels/.rels", text: XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
      + "</Relationships>" },
    { name: "docProps/core.xml", text: XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + `<dc:title>${esc(name)}</dc:title><dc:creator>لوحة متابعة استفسارات الملاك</dc:creator>`
      + `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>`
      + "</cp:coreProperties>" },
    { name: "docProps/app.xml", text: XML_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Excel</Application></Properties>' },
    { name: "xl/workbook.xml", text: XML_HEAD + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
      + '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews>'
      + `<sheets><sheet name="${esc(name)}" sheetId="1" r:id="rId1"/></sheets>`
      + `<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">${esc(quoted)}!$1:$2</definedName></definedNames>`
      + '<calcPr calcId="191029" fullCalcOnLoad="1"/>'
      + "</workbook>" },
    { name: "xl/_rels/workbook.xml.rels", text: XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
      + "</Relationships>" },
    { name: "xl/styles.xml", text: stylesXml() },
    { name: "xl/worksheets/sheet1.xml", text: sheet },
    { name: "xl/sharedStrings.xml", text: XML_HEAD + `<sst xmlns="${NS_MAIN}" count="${refs}" uniqueCount="${strings.length}">`
      + strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("") + "</sst>" },
  ];
  return { bytes: zipStore(files, now), sheetName: name, count: rows.length };
}

/* تنزيل الملف بالمتصفح */
export function downloadMeetingSheet(inquiries, opts = {}) {
  const now = opts.now || new Date();
  const res = buildMeetingXlsx(inquiries, { ...opts, now });
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const blob = new Blob([res.bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${res.sheetName.replace(/\s+/g, "_")}_${day}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return res;
}
