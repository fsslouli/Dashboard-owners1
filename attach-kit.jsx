/* ═══════════════════════════════════════════════════════════
   attach-kit.jsx — المرفقات (٢.١١.٠)
   طبقة مستقلة مثل youtube-kit.js و gallery-kit.jsx: كل منطق المرفقات هنا،
   وتُستخدم بمكانين: مرفقات الاستفسارات، وملفات PDF/الفيديو بمعرض الموقع.

     classifyLink          قارئ الروابط: يوتيوب، Drive، مستندات Google، Vimeo،
                           Dropbox، OneDrive، والروابط المباشرة — ويبني رابط العرض
     uploadAttachmentFile  يجهّز الملف بالمتصفح ثم يرفعه: ضغط الصور، غلاف PDF
                           من صفحته الأولى وعدد صفحاته، وغلاف الفيديو ومدته
     AttachmentTiles       بطاقات المرفقات (الموقع العام والمعرض)
     AttachmentViewer      العارض بملء الشاشة: PDF صفحة صفحة مع تكبير، صور،
                           فيديو، يوتيوب، Drive، ومستندات أوفيس
     AAttachmentsPanel     قسم «المرفقات» داخل نموذج تعديل الاستفسار
     useAttachments        خطّاف الموقع العام: المرفقات الظاهرة + تحديث لحظي

   مكتبة PDF.js تتحمّل من CDN فقط لما أحد يفتح ملف PDF أو يرفعه — الزائر
   العادي ما يحمّل شي زيادة، والغلاف محفوظ كصورة صغيرة وقت الرفع.
   يتطلب تشغيل migration-attachments.sql مرة وحدة.
   ═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, Eye, EyeOff,
  File as FileIcon, FileText, Image as ImageIcon, Link2, Paperclip, Play, RotateCcw, Trash2, Upload, Video, X,
} from "lucide-react";
import { logEvent, supabase as sharedSupabase } from "./app-bootstrap.jsx";
import { autoTranslateAr } from "./translate-kit.js";
import { createYtPlayer, loadYouTubeApi, warmYouTube, ytPlainIframe, ytThumb, ytWatchUrl } from "./youtube-kit.js";

/* ── ثوابت ── */
export const ATT_BUCKET = "attachments";
export const MAX_UPLOAD = 50 * 1024 * 1024;          /* سقف الملف بالخطة المجانية */
export const WARN_VIDEO = 20 * 1024 * 1024;
const EGRESS_MONTH = 5 * 1024 * 1024 * 1024;          /* حصة النقل الشهرية بالخطة المجانية */
const STORAGE_QUOTA = 1024 * 1024 * 1024;             /* 1GB */
const PDFJS_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/";
export const ATT_PUBLIC_COLS = "id,inquiry_id,kind,source,provider,title_ar,title_en,storage_path,thumb_path,external_url,embed_url,youtube_id,file_name,mime,ext,size_bytes,pages,duration_s,vertical,sort_order";
export const MEDIA_PUBLIC_COLS = "id,topic_id,kind,source,provider,bucket,title_ar,title_en,storage_path,thumb_path,external_url,embed_url,youtube_id,file_name,mime,ext,size_bytes,pages,duration_s,vertical,sort_order";
export const ACCEPT_ALL = ".pdf,application/pdf,video/*,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.zip";
export const ACCEPT_DOCS = ".pdf,application/pdf,video/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

const EXT = { pdf: ["pdf"], video: ["mp4", "webm", "mov", "m4v"], image: ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"], office: ["doc", "docx", "xls", "xlsx", "ppt", "pptx"] };
const MIME_BY_EXT = {
  pdf: "application/pdf", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
const KIND_AR = { pdf: "ملف PDF", video: "مقطع فيديو", image: "صورة", office: "مستند", file: "ملف", web: "رابط" };
const KIND_EN = { pdf: "PDF file", video: "Video", image: "Photo", office: "Document", file: "File", web: "Link" };
const PROV_AR = { youtube: "يوتيوب", drive: "Google Drive", gdocs: "Google", vimeo: "Vimeo", dropbox: "Dropbox", onedrive: "OneDrive", direct: "رابط مباشر", web: "موقع خارجي" };
const PROV_EN = { youtube: "YouTube", drive: "Google Drive", gdocs: "Google", vimeo: "Vimeo", dropbox: "Dropbox", onedrive: "OneDrive", direct: "Direct link", web: "External site" };
const KIND_NOTE = {
  pdf: "يُعرض داخل الموقع صفحة صفحة مع تكبير.", video: "يُشغَّل داخل الموقع.", image: "تظهر داخل الموقع مع تكبير.",
  office: "يُعرض داخل الموقع عبر عارض مايكروسوفت أوفيس.", file: "يظهر كبطاقة ملف مع زر فتح، لأن المتصفح ما يعرض هذا النوع.",
};
const DIRECT_LABEL = { pdf: "ملف PDF برابط مباشر", video: "ملف فيديو برابط مباشر", image: "صورة برابط مباشر", office: "ملف أوفيس برابط مباشر" };

/* ── أدوات صغيرة ── */
const BIDI = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
export const extOf = (p) => { const m = /\.([a-z0-9]{2,5})$/i.exec(String(p || "").split(/[?#]/)[0]); return m ? m[1].toLowerCase() : ""; };
const kindOfExt = (e) => { for (const k in EXT) if (EXT[k].includes(e)) return k; return e ? "file" : null; };
/* نوع الملف: لا نثق بـ image/* و video/* عمومًا — بعض الأجهزة تعطي ملف AutoCAD (.dwg) النوع image/vnd.dwg،
   والمتصفح ما يفكّه كصورة فيفشل الرفع. نعتمد صورة/فيديو فقط للصيغ اللي يفكّها المتصفح فعلًا، وأي شي ثاني ملف عادي */
const IMG_TYPE = /^image\/(jpe?g|png|webp|gif|avif|heic|heif)$/;
const VID_TYPE = /^video\/(mp4|webm|quicktime|x-m4v)$/;
export function kindOfFile(f) {
  const t = String(f.type || "").toLowerCase(), e = extOf(f.name);
  if (t === "application/pdf" || e === "pdf") return "pdf";
  if (VID_TYPE.test(t) || EXT.video.includes(e)) return "video";
  if (IMG_TYPE.test(t) || EXT.image.includes(e)) return "image";
  if (EXT.office.includes(e)) return "office";
  return "file";
}
export const fmtSize = (b) => { b = Number(b) || 0; if (b >= 1048576) { const m = b / 1048576; return (m >= 10 ? Math.round(m) : m.toFixed(1)) + "MB"; } return Math.max(1, Math.round(b / 1024)) + "KB"; };
export const fmtDur = (s) => { s = Math.round(Number(s) || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const arPlural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
export const pagesLabel = (n, lang) => (lang === "en" ? `${n} ${n === 1 ? "page" : "pages"}` : arPlural(n, "صفحة واحدة", "صفحتان", "صفحات", "صفحة"));
export const attsLabel = (n, lang) => (lang === "en" ? `${n} ${n === 1 ? "attachment" : "attachments"}` : arPlural(n, "مرفق واحد", "مرفقان", "مرفقات", "مرفقًا"));
export const niceTitle = (name) => {
  const n = String(name || "").replace(/\.[^.]+$/, "");
  return /^(img|dsc|pxl|photo|image|whatsapp|screenshot|scan|video|vid|mov|صورة|مقطع|\d)/i.test(n) ? "" : n.replace(/[_-]+/g, " ").trim().slice(0, 140);
};
const userErr = (msg) => Object.assign(new Error(msg), { userMsg: msg });
const newStem = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
const toBlob = (c, type, q) => new Promise((res) => { try { c.toBlob((b) => res(b), type, q); } catch (_) { res(null); } });

function storageErrText(e) {
  const m = String((e && (e.message || e.error)) || "");
  if (/exceed|too large|payload|413|maximum/i.test(m)) return "الملف أكبر من الحد المسموح (50MB).";
  if (/mime|content.?type|not supported|invalid_mime/i.test(m)) return "صيغة الملف غير مسموحة بالتخزين.";
  if (/row-level|policy|unauthori|403/i.test(m)) return "حسابك ما عنده صلاحية الرفع.";
  if (/bucket/i.test(m)) return "حاوية المرفقات غير موجودة — شغّل migration-attachments.sql.";
  return m || "تعذّر الرفع.";
}
function dbErrText(e) {
  const m = String((e && e.message) || "");
  if (/relation|does not exist|schema cache/i.test(m)) return "جداول المرفقات غير موجودة — شغّل migration-attachments.sql.";
  if (/row-level|policy|permission/i.test(m)) return "حسابك ما عنده صلاحية التعديل.";
  if (/check constraint/i.test(m)) return "البيانات ما طابقت شروط الجدول.";
  return m || "تعذّر الحفظ.";
}
const isMissingTable = (e) => /relation|does not exist|schema cache|could not find/i.test(String((e && e.message) || ""));

/* ═══ قارئ الروابط ═══ */
export function classifyLink(raw) {
  let s = String(raw || "").replace(BIDI, "").trim();
  if (!s) return { ok: false, empty: true };
  const fr = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(s);
  if (fr) s = fr[1].replace(/&amp;/g, "&");
  if (/^\/\//.test(s)) s = "https:" + s;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) s = "https://" + s;
  if (/^http:\/\//i.test(s)) return { ok: false, msg: "الرابط يبدأ بـ http:// والموقع يقبل https:// فقط، عشان المتصفح ما يحجبه." };
  let u; try { u = new URL(s); } catch (_) { return { ok: false, msg: "ما قدرت أقرأ الرابط. انسخه كامل من شريط العنوان." }; }
  if (u.protocol !== "https:") return { ok: false, msg: "الرابط لازم يبدأ بـ https://" };
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const path = u.pathname;

  let yid = null;
  if (host === "youtu.be") yid = path.split("/")[1];
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) yid = u.searchParams.get("v") || (/^\/(?:shorts|live|embed|v)\/([^/?#]+)/.exec(path) || [])[1];
  if (yid && /^[A-Za-z0-9_-]{11}$/.test(yid)) {
    return { ok: true, kind: "video", provider: "youtube", ytId: yid, vertical: /^\/shorts\//.test(path), url: `https://youtu.be/${yid}`,
      label: "مقطع يوتيوب", note: "يُشغَّل داخل الموقع وما يستهلك أي مساحة. المقطع «غير المدرج» يشتغل عادي، و«الخاص» ما يشتغل." };
  }
  if (host === "drive.google.com" || (host === "docs.google.com" && /^\/uc/.test(path))) {
    if (/\/folders\//.test(path)) return { ok: false, msg: "هذا رابط مجلد. افتح الملف نفسه وانسخ رابطه." };
    const id = (/\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(path) || [])[1] || u.searchParams.get("id");
    if (id && /^[A-Za-z0-9_-]{10,}$/.test(id)) return { ok: true, kind: null, needsKind: true, defaultKind: "pdf", provider: "drive", url: `https://drive.google.com/file/d/${id}/view`, embed: `https://drive.google.com/file/d/${id}/preview`,
      label: "ملف Google Drive", note: "يُعرض داخل الموقع بعارض Drive. لازم تكون مشاركته «أي شخص معه الرابط»." };
  }
  if (host === "docs.google.com") {
    const m = /^\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]{10,})/.exec(path);
    if (m) return { ok: true, kind: "office", provider: "gdocs", ext: { document: "doc", spreadsheets: "sheet", presentation: "slides" }[m[1]], url: u.href,
      embed: `https://docs.google.com/${m[1]}/d/${m[2]}/preview`, label: { document: "مستند Google", spreadsheets: "جدول Google", presentation: "عرض Google" }[m[1]],
      note: "يُعرض داخل الموقع. لازم تكون مشاركته «أي شخص معه الرابط»." };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /\/(?:video\/)?(\d{6,})(?:\/([a-f0-9]{6,}))?/.exec(path);
    if (m) { const h = m[2] || u.searchParams.get("h"); return { ok: true, kind: "video", provider: "vimeo", url: u.href, embed: `https://player.vimeo.com/video/${m[1]}${h ? `?h=${h}` : ""}`, label: "مقطع Vimeo", note: "يُشغَّل داخل الموقع وما يستهلك أي مساحة." }; }
  }
  if (host === "dropbox.com" || host === "dl.dropboxusercontent.com") {
    const d = new URL(u.href); d.searchParams.delete("dl"); d.searchParams.set("raw", "1");
    const e = extOf(path), k = kindOfExt(e) || "file";
    return { ok: true, kind: k, provider: "dropbox", ext: e, url: d.href, label: "ملف Dropbox", note: `حوّلته لرابط مباشر. ${KIND_NOTE[k]}` };
  }
  if (host === "1drv.ms" || host.endsWith("onedrive.live.com") || host.endsWith("sharepoint.com")) {
    if (/\/embed/i.test(path)) return { ok: true, kind: null, needsKind: true, defaultKind: "file", provider: "onedrive", url: u.href, embed: u.href, label: "ملف OneDrive", note: "رمز تضمين من OneDrive، يُعرض داخل الموقع." };
    return { ok: true, kind: "web", provider: "onedrive", url: u.href, label: "رابط OneDrive", note: "يظهر كبطاقة ويفتح بصفحة جديدة. عشان يُعرض داخل الموقع: من OneDrive اختر «تضمين» والصق الرمز هنا." };
  }
  if (host === "imgur.com") { const m = /^\/([a-zA-Z0-9]{5,7})$/.exec(path); if (m) return { ok: true, kind: "image", provider: "direct", ext: "jpg", url: `https://i.imgur.com/${m[1]}.jpg`, label: "صورة Imgur", note: KIND_NOTE.image }; }
  const e = extOf(path), k = kindOfExt(e);
  if (k && k !== "file") return { ok: true, kind: k, provider: "direct", ext: e, url: u.href, label: DIRECT_LABEL[k], note: KIND_NOTE[k] };
  if (k === "file") return { ok: true, kind: "file", provider: "direct", ext: e, url: u.href, label: `ملف ${e.toUpperCase()}`, note: KIND_NOTE.file };
  return { ok: true, kind: "web", provider: "web", url: u.href, label: "صفحة ويب", note: `تظهر كبطاقة باسم ${host} وتفتح بصفحة جديدة.` };
}
/* حقول صف الرابط بقاعدة البيانات */
export function linkFields(c, kindOverride) {
  const kind = c.needsKind ? (kindOverride || c.defaultKind) : c.kind;
  const ext = c.ext && /^[a-z0-9]{1,8}$/.test(c.ext) ? c.ext : null;
  return { kind, source: "link", provider: c.provider, external_url: c.url, embed_url: c.embed || null, youtube_id: c.ytId || null, vertical: !!c.vertical, ext };
}

/* ═══ PDF.js — يتحمّل عند الحاجة فقط ═══ */
let pdfjsP = null;
export function loadPdfJs() {
  if (!pdfjsP) {
    pdfjsP = import(/* @vite-ignore */ `${PDFJS_CDN}pdf.min.mjs`).then((lib) => { lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}pdf.worker.min.mjs`; return lib; });
    pdfjsP.catch(() => { pdfjsP = null; });
  }
  return pdfjsP;
}
const openPdf = async (src) => { const lib = await loadPdfJs(); return lib.getDocument({ ...src, isEvalSupported: false }).promise; };

/* ═══ تجهيز الملف قبل الرفع ═══ */
async function decodeImage(file) {
  try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (_) {}
  try { return await createImageBitmap(file); } catch (_) {}
  const url = URL.createObjectURL(file);
  try { const im = new Image(); im.src = url; await im.decode(); return im; }
  catch (_) { throw userErr("ما قدر المتصفح يقرأ الصورة."); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 4000); }
}
async function shrinkImage(file) {
  const src = await decodeImage(file);
  const W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
  const draw = (max, type, q) => {
    const s = Math.min(1, max / Math.max(W, H));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(W * s)); c.height = Math.max(1, Math.round(H * s));
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return toBlob(c, type, q);
  };
  let full = await draw(1600, "image/webp", 0.8);
  if (!full || full.type !== "image/webp") full = await draw(1600, "image/jpeg", 0.82);
  const thumb = await draw(480, "image/jpeg", 0.74);
  if (src.close) src.close();
  if (!full || !thumb) throw userErr("ما قدر المتصفح يقرأ الصورة.");
  return { full, thumb };
}
async function pdfMeta(file) {
  const doc = await openPdf({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const page = await doc.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 480 / vp1.width });
    const c = document.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return { pages: doc.numPages, thumb: await toBlob(c, "image/jpeg", 0.8) };
  } finally { try { doc.destroy(); } catch (_) {} }
}
function videoMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto";
    let done = false;
    const finish = (r, err) => { if (done) return; done = true; clearTimeout(t); v.removeAttribute("src"); try { v.load(); } catch (_) {} URL.revokeObjectURL(url); if (err) reject(err); else resolve(r); };
    const t = setTimeout(() => finish(null, new Error("timeout")), 12000);
    v.addEventListener("error", () => finish(null, new Error("media")), { once: true });
    v.addEventListener("loadedmetadata", () => {
      const d = v.duration;
      try { v.currentTime = Math.min(1, isFinite(d) ? d / 3 : 0.5); } catch (_) { finish({ dur: d, w: v.videoWidth, h: v.videoHeight, thumb: null }); }
    }, { once: true });
    v.addEventListener("seeked", async () => {
      const r = { dur: v.duration, w: v.videoWidth, h: v.videoHeight, thumb: null };
      try {
        const W = 480, H = Math.round((W * v.videoHeight) / v.videoWidth) || 270;
        const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(v, 0, 0, W, H);
        r.thumb = await toBlob(c, "image/jpeg", 0.78);
      } catch (_) {}
      finish(r);
    }, { once: true });
    v.src = url;
  });
}
/* يرفع الملف (وغلافه) للحاوية ويرجّع حقول الصف — prefix مثل inq/12 أو gal/t3 */
export async function uploadAttachmentFile(supabase, file, { prefix, only } = {}) {
  const kind = kindOfFile(file);
  if (only && !only.includes(kind)) throw userErr("هذا النوع ما يُقبل هنا.");
  if (kind !== "image" && file.size > MAX_UPLOAD) throw userErr(`حجمه ${fmtSize(file.size)} والحد 50MB للملف. ${kind === "video" ? "ارفعه على يوتيوب «غير مدرج» والصق رابطه." : "ارفعه على Drive والصق رابطه."}`);
  let body = file, ext = extOf(file.name), mime = file.type || MIME_BY_EXT[ext] || "application/octet-stream", thumb = null;
  const meta = { pages: null, duration_s: null, vertical: false };
  if (kind === "image") {
    const r = await shrinkImage(file); body = r.full; thumb = r.thumb; mime = r.full.type; ext = mime === "image/webp" ? "webp" : "jpg";
  } else if (kind === "pdf") {
    mime = "application/pdf"; ext = "pdf";
    try { const r = await pdfMeta(file); meta.pages = r.pages; thumb = r.thumb; }
    catch (e) {
      const n = String((e && e.name) || "");
      if (/Password/i.test(n)) throw userErr("الملف محمي بكلمة مرور. ارفع نسخة بدون حماية.");
      if (/Invalid|Format/i.test(n)) throw userErr("الملف تالف أو مو PDF.");
      /* تعذّر تحميل PDF.js: نرفع الملف بدون غلاف، ويبقى يُعرض عادي */
    }
  } else if (kind === "video") {
    if (!/^video\/(mp4|webm|quicktime)$/.test(mime)) mime = MIME_BY_EXT[ext] || "video/mp4";
    try { const r = await videoMeta(file); meta.duration_s = isFinite(r.dur) ? Math.round(r.dur) : null; meta.vertical = r.h > r.w; thumb = r.thumb; } catch (_) {}
  } else if (kind === "office") {
    mime = MIME_BY_EXT[ext] || mime;
  } else {
    mime = ext === "zip" ? "application/zip" : "application/octet-stream";
  }
  if (body.size > MAX_UPLOAD) throw userErr(`حجمه ${fmtSize(body.size)} والحد 50MB للملف.`);
  const store = supabase.storage.from(ATT_BUCKET);
  const stem = newStem(), safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
  const path = `${prefix}/${stem}.${safeExt}`;
  const up = await store.upload(path, body, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (up.error) throw userErr(storageErrText(up.error));
  let thumb_path = null;
  if (thumb) {
    const tp = `${prefix}/${stem}_thumb.jpg`;
    const t = await store.upload(tp, thumb, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (!t.error) thumb_path = tp;
  }
  return {
    fields: { kind, source: "upload", storage_path: path, thumb_path, file_name: file.name.slice(0, 255), mime, ext: safeExt === "bin" ? null : safeExt, size_bytes: body.size, pages: meta.pages, duration_s: meta.duration_s, vertical: meta.vertical },
    paths: [path, thumb_path].filter(Boolean),
  };
}

/* ═══ تحويل صف قاعدة البيانات لعنصر عرض ═══ */
export function toView(row, supabase = sharedSupabase, bucketDefault = ATT_BUCKET) {
  const bucket = row.bucket || bucketDefault;
  const pub = (p) => (p ? supabase.storage.from(bucket).getPublicUrl(p).data.publicUrl : null);
  const provider = row.provider || (row.youtube_id ? "youtube" : row.source === "link" ? "direct" : null);
  let thumb = pub(row.thumb_path);
  if (!thumb && row.kind === "image") thumb = row.source === "upload" ? pub(bucket === "gallery" ? row.storage_path.replace(/\.webp$/, "_thumb.webp") : row.storage_path) : row.external_url;
  if (!thumb && provider === "youtube" && row.youtube_id) thumb = ytThumb(row.youtube_id);
  if (!thumb && provider === "drive") { const m = /\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(row.embed_url || row.external_url || ""); if (m) thumb = `https://drive.google.com/thumbnail?id=${m[1]}&sz=w640`; }
  return {
    id: row.id, kind: row.kind, source: row.source, provider, ytId: row.youtube_id || null,
    url: row.source === "upload" ? pub(row.storage_path) : row.external_url, embed: row.embed_url || null, thumb,
    title_ar: row.title_ar || null, title_en: row.title_en || null, name: row.file_name || null, ext: row.ext || null,
    size: row.size_bytes || null, pages: row.pages || null, dur: row.duration_s || null, vertical: !!row.vertical,
    published: row.published !== false,
  };
}
export function attTitle(a, lang) {
  const t = lang === "en" ? a.title_en || a.title_ar : a.title_ar;
  if (t) return t;
  if (a.name) { const nt = niceTitle(a.name); if (nt) return nt; }
  const P = lang === "en" ? PROV_EN : PROV_AR, K = lang === "en" ? KIND_EN : KIND_AR;
  if (a.provider === "youtube") return lang === "en" ? "YouTube video" : "مقطع يوتيوب";
  if (a.provider === "vimeo") return lang === "en" ? "Vimeo video" : "مقطع Vimeo";
  if (a.provider === "drive") return lang === "en" ? `${K[a.kind] || "File"} on Google Drive` : `${K[a.kind] || "ملف"} من Google Drive`;
  if (a.provider === "web" || a.provider === "onedrive") { try { return new URL(a.url).hostname.replace(/^www\./, ""); } catch (_) { return P.web; } }
  return K[a.kind] || (lang === "en" ? "Attachment" : "مرفق");
}
const sourceLabel = (a, lang) => (a.source === "upload" ? `${lang === "en" ? "Uploaded" : "مرفوع"}${a.size ? ` · ${fmtSize(a.size)}` : ""}` : (lang === "en" ? PROV_EN : PROV_AR)[a.provider] || (lang === "en" ? "Link" : "رابط"));
function badgeText(a, lang) {
  if (a.kind === "pdf") return a.pages ? `PDF · ${pagesLabel(a.pages, lang)}` : "PDF";
  if (a.kind === "video") return `${a.provider === "youtube" ? "YouTube" : a.provider === "vimeo" ? "Vimeo" : lang === "en" ? "Video" : "فيديو"}${a.dur ? ` ${fmtDur(a.dur)}` : ""}`;
  if (a.kind === "image") return lang === "en" ? "Photo" : "صورة";
  if (a.kind === "web") return lang === "en" ? "Link" : "رابط";
  return String(a.ext || (lang === "en" ? KIND_EN : KIND_AR)[a.kind] || "").toUpperCase();
}
export function KindIcon({ kind, size = 16 }) {
  const I = kind === "pdf" || kind === "office" ? FileText : kind === "video" ? Video : kind === "image" ? ImageIcon : kind === "web" ? Link2 : FileIcon;
  return <I size={size} />;
}
/* سطر وصف مختصر للوحة الإدارة */
export function attMetaLine(a) {
  const bits = [];
  if (a.kind === "pdf") bits.push(a.pages ? `PDF · ${pagesLabel(a.pages)}` : "PDF");
  else if (a.kind === "video") bits.push(a.dur ? `فيديو · ${fmtDur(a.dur)}` : "فيديو");
  else if (a.kind === "image") bits.push("صورة");
  else if (a.kind === "web") bits.push("صفحة ويب");
  else bits.push(String(a.ext || KIND_AR[a.kind] || "ملف").toUpperCase());
  bits.push(a.source === "upload" ? `مرفوع${a.size ? ` · ${fmtSize(a.size)}` : ""}` : PROV_AR[a.provider] || "رابط");
  return bits.join(" · ");
}

/* ═══ الأنماط — تُحقن مرة وحدة، والألوان تجي من الطقم عبر متغيرات ═══ */
const ATK_CSS = `
.atk-sec{margin-top:24px;}
.atk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;}
.atk-grid.big{grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}
.atk-tile{display:flex;flex-direction:column;width:100%;text-align:start;padding:0;margin:0;border:1px solid var(--atk-line,rgba(0,0,0,.1));border-radius:12px;
  background:var(--atk-surface,#fff);color:var(--atk-paper,#1F2C35);overflow:hidden;cursor:pointer;font:inherit;transition:border-color .18s,transform .18s;}
.atk-tile:hover{border-color:var(--atk-accent,#1B7F8E);}
.atk-tile:active{transform:scale(.98);}
.atk-tile:focus-visible{outline:2px solid var(--atk-accent,#1B7F8E);outline-offset:2px;}
.atk-media{position:relative;display:block;aspect-ratio:4/3;background:var(--atk-sunken,#F1F5F8);overflow:hidden;}
.atk-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--atk-faint,#7E8F9A);}
.atk-th{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.atk-media.is-doc .atk-th{object-fit:contain;padding:10px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.22));}
.atk-kind{position:absolute;bottom:7px;inset-inline-start:7px;display:inline-flex;align-items:center;gap:4px;background:rgba(10,13,12,.74);color:#fff;
  font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:6px;line-height:1.6;direction:ltr;unicode-bidi:isolate;}
.atk-play{position:absolute;inset:0;margin:auto;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.94);color:#0E1211;
  display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.3);}
.atk-play svg{transform:translateX(1.5px);}
.atk-cap{display:block;padding:8px 10px 10px;}
.atk-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12.5px;line-height:1.65;}
.atk-grid.big .atk-t{font-size:13.5px;}
.atk-s{display:block;font-size:11px;color:var(--atk-faint,#7E8F9A);margin-top:3px;}
.atk-badge{margin-inline-start:auto;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;border-radius:999px;padding:2px 9px;line-height:1.6;}
.atk-arow{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;border-radius:11px;padding:6px 8px;}
.atk-arow-acts{display:flex;align-items:center;gap:2px;}
@media(max-width:480px){.atk-arow{grid-template-columns:48px minmax(0,1fr);}.atk-arow-acts{grid-column:1/-1;justify-content:flex-end;}}
.atkv{position:fixed;inset:0;z-index:95;display:flex;flex-direction:column;background:#0A1216;color:#fff;animation:atkfade .18s ease;
  font-family:'IBM Plex Sans Arabic',system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;}
@keyframes atkfade{from{opacity:0}to{opacity:1}}
.atkv-top{display:flex;align-items:center;gap:10px;padding:calc(9px + env(safe-area-inset-top)) 12px 9px;background:rgba(0,0,0,.34);flex:none;}
.atkv-title{flex:1;min-width:0;}
.atkv-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.atkv-sub{font-size:11.5px;color:rgba(255,255,255,.62);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.atkv-ico{border:0;background:rgba(255,255,255,.13);color:#fff;width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0;font:inherit;}
.atkv-ico:disabled{opacity:.28;cursor:default;}
.atkv-stage{flex:1;min-height:0;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;container-type:size;}
.atkv-zoom{position:absolute;inset:0;touch-action:none;-webkit-user-select:none;user-select:none;}
.atkv-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform-origin:center center;-webkit-user-drag:none;}
.atkv-canvas{position:absolute;left:50%;top:50%;transform-origin:center center;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.5);}
.atkv-spin{position:absolute;inset:0;margin:auto;width:28px;height:28px;border-radius:50%;border:2.5px solid rgba(255,255,255,.2);border-top-color:#fff;
  animation:atkspin .8s linear infinite;pointer-events:none;}
@keyframes atkspin{to{transform:rotate(360deg)}}
.atkv-bot{background:rgba(0,0,0,.34);padding:9px 10px calc(9px + env(safe-area-inset-bottom));flex:none;}
.atkv-nav{display:flex;align-items:center;gap:8px;margin-bottom:9px;}
.atkv-chips{flex:1;min-width:0;display:flex;gap:6px;overflow-x:auto;padding:2px 0;scrollbar-width:none;}
.atkv-chips::-webkit-scrollbar{display:none;}
.atkv-chip{flex:none;border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.07);color:rgba(255,255,255,.82);font:inherit;font-size:11.5px;
  padding:7px 12px;border-radius:999px;cursor:pointer;white-space:nowrap;}
.atkv-chip.on{background:#fff;color:#0C1519;border-color:#fff;font-weight:600;}
.atkv-pg{margin:auto;font-size:12.5px;color:rgba(255,255,255,.82);}
.atkv-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:rgba(255,255,255,.55);min-height:24px;}
.atkv-foot a{display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,.82);text-decoration:none;border:1px solid rgba(255,255,255,.17);
  border-radius:999px;padding:5px 11px;flex:none;}
.atkv-frame{position:relative;width:min(100% - 24px,1100px);width:min(100cqw - 24px,(100cqh - 24px) * 16 / 9,1280px);aspect-ratio:16/9;
  background:#000 center/cover no-repeat;border-radius:14px;overflow:hidden;}
.atkv-frame.vert{aspect-ratio:9/16;width:min(100% - 24px,420px);width:min(100cqw - 24px,(100cqh - 24px) * 9 / 16);}
.atkv-frame video,.atkv-frame iframe,.atkv-host{position:absolute;inset:0;width:100%;height:100%;border:0;}
.atkv-frame video{background:#000;}
.atkv-host iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}
.atkv-doc{position:absolute;inset:12px;border-radius:10px;overflow:hidden;background:#fff;}
.atkv-doc iframe{width:100%;height:100%;border:0;display:block;}
.atkv-card{max-width:440px;margin:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px 18px;
  text-align:center;font-size:13.5px;line-height:1.95;color:rgba(255,255,255,.86);}
.atkv-card p{margin:6px 0 14px;}
.atkv-card-t{font-size:15px;font-weight:600;color:#fff;}
.atkv-btn{display:inline-flex;align-items:center;gap:7px;border:0;background:#fff;color:#0C1519;font:inherit;font-weight:600;font-size:13px;
  padding:9px 14px;border-radius:10px;text-decoration:none;margin:2px 4px;cursor:pointer;}
.atkv-ext{display:flex;flex-direction:column;align-items:center;gap:4px;color:rgba(255,255,255,.75);font-size:11px;font-weight:700;margin-bottom:6px;}
.atkv-err{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;
  background:rgba(0,0,0,.72);color:#fff;font-size:12.5px;padding:8px 12px;border-radius:12px;max-width:calc(100% - 24px);}
.atkv-err a{color:#fff;font-weight:600;display:inline-flex;align-items:center;gap:4px;}
@media (prefers-reduced-motion:reduce){.atkv,.atkv-spin{animation:none;}}
`;
export function ensureAtkCss() {
  if (typeof document === "undefined" || document.getElementById("atk-css")) return;
  const s = document.createElement("style"); s.id = "atk-css"; s.textContent = ATK_CSS; document.head.appendChild(s);
}
ensureAtkCss();
const tileVars = (T) => (T ? { "--atk-surface": T.surface, "--atk-sunken": T.sunken, "--atk-line": T.line, "--atk-paper": T.paper, "--atk-faint": T.faint, "--atk-accent": T.brass } : undefined);

/* ═══ بطاقات المرفقات ═══ */
export function AttachmentTiles({ items, lang = "ar", onOpen, big, T }) {
  const L = (ar, en) => (lang === "en" ? en : ar);
  return (
    <div className={`atk-grid${big ? " big" : ""}`} style={tileVars(T)}>
      {items.map((a, i) => {
        const title = attTitle(a, lang), src = sourceLabel(a, lang);
        /* شبكة المعرض: الصورة بدون عنوان ما تحتاج سطر «صورة» تحتها */
        const cap = !(big && a.kind === "image" && !(lang === "en" ? a.title_en || a.title_ar : a.title_ar));
        return (
          <button key={a.id} type="button" className="atk-tile" onClick={() => onOpen(i)} aria-label={`${(lang === "en" ? KIND_EN : KIND_AR)[a.kind] || L("مرفق", "Attachment")}: ${title}`}>
            <span className={`atk-media${a.kind === "pdf" ? " is-doc" : ""}`}>
              <span className="atk-ph">{a.kind !== "video" && <KindIcon kind={a.kind} size={28} />}</span>
              {a.thumb && <img className="atk-th" src={a.thumb} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
              {a.kind === "video" && <span className="atk-play"><Play size={18} fill="currentColor" strokeWidth={0} /></span>}
              <span className="atk-kind">{badgeText(a, lang)}</span>
            </span>
            {cap && (
              <span className="atk-cap">
                <span className="atk-t">{title}</span>
                {!title.includes(src) && <span className="atk-s">{src}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══ تكبير بالإصبعين والنقر المزدوج — نفس منطق عارض المخططات ═══ */
class Zoomer {
  constructor(stage, el, o) {
    Object.assign(this, { stage, el, o, z: { s: 1, x: 0, y: 0 }, ptrs: new Map(), g: null, last: 0, t: 0 });
    this.on = { pointerdown: (e) => this.down(e), pointermove: (e) => this.move(e), pointerup: (e) => this.up(e), pointercancel: (e) => this.up(e), wheel: (e) => this.wheel(e) };
    for (const [k, f] of Object.entries(this.on)) stage.addEventListener(k, f, k === "wheel" ? { passive: false } : undefined);
  }
  destroy() { for (const [k, f] of Object.entries(this.on)) this.stage.removeEventListener(k, f); clearTimeout(this.t); }
  clamp(st) { const b = this.o.dims(); const mx = Math.max(0, (b.w * st.s - b.cw) / 2), my = Math.max(0, (b.h * st.s - b.ch) / 2); return { s: st.s, x: Math.min(mx, Math.max(-mx, st.x)), y: Math.min(my, Math.max(-my, st.y)) }; }
  rel(e) { const r = this.stage.getBoundingClientRect(); return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }; }
  paint(anim) { const { s, x, y } = this.z; this.el.style.transition = anim ? "transform .2s ease-out" : "none"; this.el.style.transform = `translate(${x}px,${y}px) scale(${s})`; }
  set(z, anim = true) { this.z = z; this.paint(anim); }
  ended() { clearTimeout(this.t); this.t = setTimeout(() => this.o.onZoomEnd && this.o.onZoomEnd(this.z.s), 160); }
  reset() { this.set({ s: 1, x: 0, y: 0 }); this.ended(); }
  zoomAt(p, target) { if (target <= 1.01) { this.reset(); return; } const z = this.z, u = { x: (p.x - z.x) / z.s, y: (p.y - z.y) / z.s }; this.set(this.clamp({ s: target, x: p.x - target * u.x, y: p.y - target * u.y })); this.ended(); }
  down(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { this.stage.setPointerCapture(e.pointerId); } catch (_) {}
    const p = this.rel(e); this.ptrs.set(e.pointerId, p);
    if (this.ptrs.size === 1) {
      const now = Date.now();
      if (now - this.last < 300) { this.last = 0; this.g = null; this.zoomAt(p, this.z.s > 1.2 ? 1 : 2.6); return; }
      this.last = now; this.g = { m: "pan", p0: p, t0: { ...this.z }, dx: 0 };
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      this.g = { m: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, t0: { ...this.z } };
    }
  }
  move(e) {
    if (!this.ptrs.has(e.pointerId)) return;
    this.ptrs.set(e.pointerId, this.rel(e));
    const g = this.g; if (!g) return;
    if (g.m === "pinch" && this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(6, Math.max(1, g.t0.s * (d / g.d0))), k = s / g.t0.s;
      this.set(this.clamp({ s, x: c.x - k * (g.c0.x - g.t0.x), y: c.y - k * (g.c0.y - g.t0.y) }), false);
    } else if (g.m === "pan") {
      const p = this.rel(e), dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      if (g.t0.s > 1.01) this.set(this.clamp({ s: g.t0.s, x: g.t0.x + dx, y: g.t0.y + dy }), false); else g.dx = dx;
    }
  }
  up(e) {
    this.ptrs.delete(e.pointerId);
    const g = this.g;
    if (g && g.m === "pan" && !this.ptrs.size && g.t0.s <= 1.01 && Math.abs(g.dx) > 55 && this.o.onSwipe) this.o.onSwipe(g.dx < 0 ? 1 : -1);
    if (g && g.m === "pinch") this.ended();
    if (!this.ptrs.size) this.g = null;
    else if (this.ptrs.size === 1) this.g = { m: "pan", p0: [...this.ptrs.values()][0], t0: { ...this.z }, dx: 0 };
  }
  wheel(e) { if (!e.ctrlKey && Math.abs(e.deltaY) < 4) return; e.preventDefault(); this.zoomAt(this.rel(e), Math.min(6, Math.max(1, this.z.s * (e.deltaY < 0 ? 1.15 : 0.87)))); }
}

/* ── عارض PDF: صفحة صفحة، الصفحة ترسم بدقة أعلى لما تكبّر ── */
function pdfController(host, url, cb) {
  let doc = null, canvas = null, disp = null, q = 1, task = null, page = 1, dead = false, rs = 0;
  const z = new Zoomer(host, document.createElement("span"), {
    dims: () => ({ w: disp ? disp.w : 1, h: disp ? disp.h : 1, cw: host.clientWidth, ch: host.clientHeight }),
    onSwipe: (d) => go(page + d),
    onZoomEnd: (s) => { cb.onZoom(s > 1.01); if (s > q + 0.25) draw(page, Math.min(s, 3)); },
  });
  async function draw(p, quality) {
    if (!doc || dead) return;
    const pg = await doc.getPage(p);
    if (dead || p !== page) return;
    const vp1 = pg.getViewport({ scale: 1 }), pad = 14, cw = host.clientWidth, ch = host.clientHeight;
    const k = Math.max(0.05, Math.min((cw - pad * 2) / vp1.width, (ch - pad * 2) / vp1.height));
    const w = vp1.width * k, h = vp1.height * k, dpr = Math.min(window.devicePixelRatio || 1, 3);
    let scale = k * dpr * quality;
    const cap = 14e6; if (vp1.width * vp1.height * scale * scale > cap) scale = Math.sqrt(cap / (vp1.width * vp1.height));
    const vp = pg.getViewport({ scale });
    const c = document.createElement("canvas"); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height); c.className = "atkv-canvas";
    Object.assign(c.style, { width: `${w}px`, height: `${h}px`, marginLeft: `${-w / 2}px`, marginTop: `${-h / 2}px` });
    if (task) { try { task.cancel(); } catch (_) {} }
    const t = pg.render({ canvasContext: c.getContext("2d"), viewport: vp });
    task = t;
    try { await t.promise; } catch (_) { return; }
    if (task === t) task = null;
    if (dead || p !== page) return;
    if (quality > 1 && canvas) c.style.transform = canvas.style.transform;
    if (canvas && canvas.isConnected) canvas.replaceWith(c); else host.appendChild(c);
    canvas = c; disp = { w, h }; q = quality; z.el = c;
    if (quality === 1) z.set({ s: 1, x: 0, y: 0 }, false); else z.paint(false);
  }
  async function go(p) {
    if (!doc) return;
    p = Math.max(1, Math.min(doc.numPages, p));
    if (p === page) return;
    page = p; z.set({ s: 1, x: 0, y: 0 }, false); cb.onZoom(false); cb.onState({ page: p });
    await draw(p, 1);
  }
  const onResize = () => { clearTimeout(rs); rs = setTimeout(() => { if (!doc || dead) return; z.set({ s: 1, x: 0, y: 0 }, false); cb.onZoom(false); q = 1; draw(page, 1); }, 180); };
  window.addEventListener("resize", onResize);
  (async () => {
    try {
      doc = await openPdf({ url });
      if (dead) { doc.destroy(); return; }
      await draw(1, 1);
      if (!dead) cb.onState({ status: "ready", pages: doc.numPages, page: 1 });
    } catch (e) { if (!dead) cb.onState({ status: "error", err: e }); }
  })();
  return {
    isPdf: true, go, step: (d) => go(page + d), reset: () => z.reset(),
    destroy() { dead = true; clearTimeout(rs); window.removeEventListener("resize", onResize); z.destroy(); try { if (task) task.cancel(); } catch (_) {} try { if (doc) doc.destroy(); } catch (_) {} },
  };
}

/* ── زر «رجوع» بالجوال يقفل العارض وحده، مو لوحة الملاحظة اللي تحته ──
   مستمع واحد يُسجَّل مع تحميل الملف، فيسبق مستمعات اللوحات الثانية دائمًا */
const BACK = { stack: [], swallow: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("popstate", (e) => {
    if (BACK.swallow > 0) { BACK.swallow--; e.stopImmediatePropagation(); return; }
    const fn = BACK.stack.pop();
    if (fn) { e.stopImmediatePropagation(); fn(); }
  }, true);
}
function useViewerHistory(onClose) {
  const ref = useRef(onClose); ref.current = onClose;
  useEffect(() => {
    const fn = () => ref.current();
    try { window.history.pushState({ ...(window.history.state || {}), __atk: true }, ""); } catch (_) {}
    BACK.stack.push(fn);
    return () => {
      const i = BACK.stack.indexOf(fn);
      if (i < 0) return;
      BACK.stack.splice(i, 1);
      if (window.history.state && window.history.state.__atk) { BACK.swallow++; window.history.back(); }
    };
  }, []);
}

function Foot({ hint, a, L }) {
  const href = a.provider === "youtube" && a.ytId ? ytWatchUrl(a.ytId) : a.url;
  const label = a.source === "upload" ? L("الملف الأصلي", "Original file") : a.provider === "youtube" ? "YouTube" : L("الرابط الأصلي", "Original link");
  return (
    <div className="atkv-foot">
      <span>{hint}</span>
      {href && <a href={href} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> {label}</a>}
    </div>
  );
}
function FallbackCard({ title, text, a, L, onRetry }) {
  const href = a && (a.provider === "youtube" && a.ytId ? ytWatchUrl(a.ytId) : a.url);
  return (
    <div className="atkv-card" role="status">
      <div className="atkv-card-t">{title}</div>
      <p>{text}</p>
      {onRetry && <button type="button" className="atkv-btn" onClick={onRetry}><RotateCcw size={14} /> {L("إعادة المحاولة", "Try again")}</button>}
      {href && <a className="atkv-btn" href={href} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {L("افتح الملف", "Open file")}</a>}
    </div>
  );
}

function PdfStage({ a, lang, L, setSub, setZoomed, ctrl }) {
  const host = useRef(null), chips = useRef(null);
  const [st, setSt] = useState({ status: "loading", page: 1, pages: a.pages || 0, err: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = pdfController(host.current, a.url, { onState: (s) => setSt((p) => ({ ...p, ...s })), onZoom: setZoomed });
    ctrl.current = c;
    return () => { c.destroy(); if (ctrl.current === c) ctrl.current = null; };
  }, [a.url, attempt]);
  useEffect(() => { if (st.status === "ready") setSub(L(`PDF · صفحة ${st.page} من ${st.pages}`, `PDF · page ${st.page} of ${st.pages}`)); }, [st.status, st.page, st.pages]);
  useEffect(() => { const el = chips.current && chips.current.querySelector(".atkv-chip.on"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center" }); }, [st.page]);
  const Prev = lang === "en" ? ChevronLeft : ChevronRight, Next = lang === "en" ? ChevronRight : ChevronLeft;
  let err = null;
  if (st.status === "error") {
    const n = String((st.err && st.err.name) || "");
    const retry = () => { setSt({ status: "loading", page: 1, pages: a.pages || 0, err: null }); setAttempt((x) => x + 1); };
    err = /Password/i.test(n) ? <FallbackCard title={L("الملف محمي بكلمة مرور", "This PDF is password-protected")} text={L("افتحه من الرابط الأصلي.", "Open it from the original link.")} a={a} L={L} />
      : /Invalid|Format/i.test(n) ? <FallbackCard title={L("ما قدرت أفتح الملف", "Couldn't open this file")} text={L("الملف تالف أو مو PDF.", "The file is damaged or isn't a PDF.")} a={a} L={L} />
      : a.source === "link" ? <FallbackCard title={L("مصدر الملف ما يسمح بعرضه هنا", "The file's host doesn't allow showing it here")} text={L("افتحه من رابطه الأصلي.", "Open it from its original link.")} a={a} L={L} />
      : <FallbackCard title={L("تعذّر تحميل عارض PDF", "Couldn't load the PDF viewer")} text={L("تأكد من الاتصال وأعد المحاولة.", "Check your connection and try again.")} a={a} L={L} onRetry={retry} />;
  }
  return (
    <>
      <div className="atkv-stage">
        <div className="atkv-zoom" ref={host} style={st.status === "error" ? { display: "none" } : undefined} />
        {st.status === "loading" && <span className="atkv-spin" />}
        {err}
      </div>
      <div className="atkv-bot">
        {st.status === "ready" && st.pages > 1 && (
          <div className="atkv-nav">
            <button type="button" className="atkv-ico" disabled={st.page <= 1} onClick={() => ctrl.current && ctrl.current.go(st.page - 1)} aria-label={L("الصفحة السابقة", "Previous page")}><Prev size={16} /></button>
            <div className="atkv-chips" ref={chips}>
              {st.pages <= 60
                ? Array.from({ length: st.pages }, (_, k) => (
                  <button key={k} type="button" className={`atkv-chip${k + 1 === st.page ? " on" : ""}`} onClick={() => ctrl.current && ctrl.current.go(k + 1)}>{L(`صفحة ${k + 1}`, `Page ${k + 1}`)}</button>
                ))
                : <span className="atkv-pg">{st.page} / {st.pages}</span>}
            </div>
            <button type="button" className="atkv-ico" disabled={st.page >= st.pages} onClick={() => ctrl.current && ctrl.current.go(st.page + 1)} aria-label={L("الصفحة التالية", "Next page")}><Next size={16} /></button>
          </div>
        )}
        <Foot hint={st.status === "ready" ? L("قرّب بإصبعين أو انقر مرتين للتكبير", "Pinch or double-tap to zoom") : st.status === "loading" ? L("يجهّز الصفحات…", "Preparing pages…") : ""} a={a} L={L} />
      </div>
    </>
  );
}
function ImageStage({ a, L, setZoomed, ctrl, step }) {
  const host = useRef(null), img = useRef(null);
  const [st, setSt] = useState("loading");
  useEffect(() => {
    const el = host.current, im = img.current, nat = { w: 4, h: 3 };
    const z = new Zoomer(el, im, {
      dims: () => { const cw = el.clientWidth, ch = el.clientHeight, k = Math.min(cw / nat.w, ch / nat.h); return { w: nat.w * k, h: nat.h * k, cw, ch }; },
      onSwipe: (d) => step(d), onZoomEnd: (s) => setZoomed(s > 1.01),
    });
    const onLoad = () => { nat.w = im.naturalWidth || 4; nat.h = im.naturalHeight || 3; setSt("ready"); };
    if (im.complete && im.naturalWidth) onLoad(); else im.addEventListener("load", onLoad);
    ctrl.current = { isPdf: false, reset: () => z.reset() };
    return () => { im.removeEventListener("load", onLoad); z.destroy(); ctrl.current = null; };
  }, [a.url]);
  return (
    <>
      <div className="atkv-stage">
        <div className="atkv-zoom" ref={host} style={st === "error" ? { display: "none" } : undefined}>
          <img ref={img} className="atkv-img" src={a.url || undefined} alt={a.title_ar || ""} draggable={false} onError={() => setSt("error")} />
        </div>
        {st === "loading" && <span className="atkv-spin" />}
        {st === "error" && <FallbackCard title={L("الصورة ما تحمّلت", "The photo didn't load")} text={L("جرّب تفتحها من رابطها الأصلي.", "Try opening it from its original link.")} a={a} L={L} />}
      </div>
      <div className="atkv-bot"><Foot hint={L("قرّب بإصبعين أو انقر مرتين للتكبير", "Pinch or double-tap to zoom")} a={a} L={L} /></div>
    </>
  );
}
function VideoFileStage({ a, L }) {
  const [err, setErr] = useState(false);
  return (
    <>
      <div className="atkv-stage">
        {err
          ? <FallbackCard title={L("ما قدر المتصفح يشغّل المقطع", "This video can't play here")} text={L("غالبًا صيغته غير مدعومة على هذا الجهاز، وصيغة MP4 هي الأضمن. تقدر تفتحه من الرابط.", "Its format may not be supported on this device (MP4 is the safest). You can open it from the link.")} a={a} L={L} />
          : (
            <div className={`atkv-frame${a.vertical ? " vert" : ""}`} style={a.thumb ? { backgroundImage: `url("${a.thumb}")` } : undefined}>
              <video src={a.url || undefined} poster={a.thumb || undefined} controls playsInline autoPlay preload="metadata" onError={() => setErr(true)} />
            </div>
          )}
      </div>
      <div className="atkv-bot"><Foot hint={a.source === "upload" ? L("يُشغَّل من تخزين الموقع", "Plays from the site's storage") : L("يُشغَّل من الرابط مباشرة", "Plays straight from the link")} a={a} L={L} /></div>
    </>
  );
}
function YtStage({ a, lang, L }) {
  const host = useRef(null);
  const [err, setErr] = useState(null);
  const title = `${attTitle(a, lang)} — YouTube`;
  useEffect(() => {
    let player = null, alive = true;
    const el = host.current;
    warmYouTube();
    loadYouTubeApi().then((YT) => {
      if (!alive || !el) return;
      const mount = document.createElement("div"); el.appendChild(mount);
      player = createYtPlayer(YT, mount, { id: a.ytId, autoplay: true, lang, title, onReady: (e) => { try { e.target.playVideo(); } catch (_) {} }, onError: (e) => { if (alive) setErr(e.data); } });
    }).catch(() => { if (alive && el) el.appendChild(ytPlainIframe(a.ytId, { autoplay: true, lang, title })); });
    return () => { alive = false; try { if (player) player.destroy(); } catch (_) {} if (el) el.innerHTML = ""; };
  }, [a.ytId]);
  return (
    <>
      <div className="atkv-stage">
        <div className={`atkv-frame${a.vertical ? " vert" : ""}`} style={{ backgroundImage: `url("${ytThumb(a.ytId)}")` }}><div className="atkv-host" ref={host} /></div>
        {err != null && (
          <div className="atkv-err" role="status"><AlertTriangle size={14} /> <span>{L("تعذّر تشغيل المقطع داخل الموقع.", "This video can't play here.")}</span>
            <a href={ytWatchUrl(a.ytId)} target="_blank" rel="noopener noreferrer">{L("شاهده على يوتيوب", "Watch on YouTube")} <ExternalLink size={11} /></a></div>
        )}
      </div>
      <div className="atkv-bot"><Foot hint={L("يُشغَّل عبر يوتيوب داخل الموقع", "Plays via YouTube, right here")} a={a} L={L} /></div>
    </>
  );
}
function frameSrc(a) {
  if (a.kind === "office" && !a.embed) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(a.url || "")}`;
  return a.embed || a.url;
}
function FrameStage({ a, lang, L }) {
  const isDoc = a.kind !== "video", src = frameSrc(a), title = attTitle(a, lang);
  const via = a.kind === "office" && !a.embed ? L("عارض مايكروسوفت أوفيس", "Microsoft Office viewer") : (lang === "en" ? PROV_EN : PROV_AR)[a.provider] || L("عارض خارجي", "an external viewer");
  return (
    <>
      <div className="atkv-stage">
        {isDoc
          ? <div className="atkv-doc"><iframe src={src} title={title} allow="autoplay; fullscreen" referrerPolicy="strict-origin-when-cross-origin" /></div>
          : <div className={`atkv-frame${a.vertical ? " vert" : ""}`}><iframe src={src} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" /></div>}
      </div>
      <div className="atkv-bot"><Foot hint={L(`يُعرض عبر ${via} داخل الموقع`, `Shown via ${via}`)} a={a} L={L} /></div>
    </>
  );
}
function FileStage({ a, lang, L }) {
  const ext = String(a.ext || extOf(a.name || a.url) || "").toUpperCase();
  const web = a.kind === "web";
  return (
    <>
      <div className="atkv-stage">
        <div className="atkv-card">
          {!web && <div className="atkv-ext"><KindIcon kind={a.kind} size={30} /><span>{ext || L("ملف", "File")}</span></div>}
          <div className="atkv-card-t">{attTitle(a, lang)}</div>
          <p>{web ? L("رابط لصفحة خارجية، يفتح بصفحة جديدة.", "A link to an external page. It opens in a new tab.")
            : L("هذا النوع ما له عارض داخل المتصفح، فيظهر كبطاقة ملف تفتحه أو تنزّله.", "Browsers can't preview this type, so it opens or downloads instead.")}</p>
          {a.url && <a className="atkv-btn" href={a.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {web ? L("افتح الرابط", "Open link") : L("فتح الملف", "Open file")}{a.size ? ` · ${fmtSize(a.size)}` : ""}</a>}
        </div>
      </div>
      <div className="atkv-bot"><Foot hint="" a={{ ...a, url: null }} L={L} /></div>
    </>
  );
}
function Stage(p) {
  const { a } = p;
  if (a.provider === "youtube" && a.ytId) return <YtStage {...p} />;
  if ((a.source === "link" && ["vimeo", "drive", "gdocs", "onedrive"].includes(a.provider) && a.embed) || a.kind === "office") return <FrameStage {...p} />;
  if (a.kind === "pdf") return <PdfStage {...p} />;
  if (a.kind === "image") return <ImageStage {...p} />;
  if (a.kind === "video") return <VideoFileStage {...p} />;
  return <FileStage {...p} />;
}
function baseSub(a, lang) {
  const L = (ar, en) => (lang === "en" ? en : ar);
  if (a.kind === "pdf") return a.pages ? `PDF · ${pagesLabel(a.pages, lang)}` : "PDF";
  if (a.kind === "video") return a.source === "upload" ? `${L("فيديو مرفوع", "Uploaded video")}${a.dur ? ` · ${fmtDur(a.dur)}` : ""}` : (lang === "en" ? PROV_EN : PROV_AR)[a.provider] || L("مقطع", "Video");
  if (a.kind === "image") return a.source === "upload" ? L("صورة مرفوعة", "Uploaded photo") : L("صورة برابط", "Linked photo");
  return a.source === "upload" ? `${L("ملف مرفوع", "Uploaded file")}${a.size ? ` · ${fmtSize(a.size)}` : ""}` : (lang === "en" ? PROV_EN : PROV_AR)[a.provider] || L("رابط", "Link");
}

/* ═══ العارض بملء الشاشة ═══ */
export function AttachmentViewer({ list, index, onIndex, onClose, lang = "ar" }) {
  const L = (ar, en) => (lang === "en" ? en : ar);
  const n = list.length;
  const i = Math.max(0, Math.min(index, n - 1));
  const a = list[i];
  const [sub, setSub] = useState("");
  const [zoomed, setZoomed] = useState(false);
  const ctrl = useRef(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const step = (d) => { const j = i + d; if (j >= 0 && j < n) onIndex(j); };
  const stepRef = useRef(step); stepRef.current = step;
  useViewerHistory(() => closeRef.current());
  useEffect(() => {
    const prev = document.body.style.overflow, focusBack = document.activeElement;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.stopPropagation();
        const d = e.key === "ArrowRight" ? 1 : -1;
        if (ctrl.current && ctrl.current.isPdf) ctrl.current.step(d); else stepRef.current(d);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
      try { if (focusBack && focusBack.focus) focusBack.focus({ preventScroll: true }); } catch (_) {}
    };
  }, []);
  useEffect(() => {
    if (!a) return;
    setZoomed(false); setSub(baseSub(a, lang));
    logEvent("nav", "att_open", `${a.kind}:${a.id}`, null);
  }, [a && a.id]);
  if (!a || typeof document === "undefined") return null;
  const title = attTitle(a, lang);
  const Prev = lang === "en" ? ChevronLeft : ChevronRight, Next = lang === "en" ? ChevronRight : ChevronLeft;
  const stop = (e) => e.stopPropagation();
  const subLine = [sub, n > 1 ? L(`مرفق ${i + 1} من ${n}`, `${i + 1} of ${n}`) : ""].filter(Boolean).join(" · ");
  return createPortal(
    <div className="atkv" role="dialog" aria-modal="true" aria-label={title} dir={lang === "en" ? "ltr" : "rtl"}
      onClick={stop} onTouchStart={stop} onTouchEnd={stop} onPointerDown={stop} onKeyDown={stop}>
      <div className="atkv-top">
        <button type="button" className="atkv-ico" onClick={() => closeRef.current()} aria-label={L("إغلاق", "Close")} autoFocus><X size={17} /></button>
        <div className="atkv-title"><div className="atkv-name">{title}</div><div className="atkv-sub">{subLine}</div></div>
        {zoomed && <button type="button" className="atkv-ico" onClick={() => ctrl.current && ctrl.current.reset()} aria-label={L("إلغاء التكبير", "Reset zoom")}><RotateCcw size={15} /></button>}
        {n > 1 && (
          <>
            <button type="button" className="atkv-ico" disabled={i === 0} onClick={() => step(-1)} aria-label={L("المرفق السابق", "Previous attachment")}><Prev size={17} /></button>
            <button type="button" className="atkv-ico" disabled={i === n - 1} onClick={() => step(1)} aria-label={L("المرفق التالي", "Next attachment")}><Next size={17} /></button>
          </>
        )}
      </div>
      <Stage key={a.id} a={a} lang={lang} L={L} setSub={setSub} setZoomed={setZoomed} ctrl={ctrl} step={(d) => stepRef.current(d)} />
    </div>,
    document.body
  );
}

/* ═══ الموقع العام ═══ */
export function useAttachments() {
  const [map, setMap] = useState({});
  useEffect(() => {
    let alive = true, seq = 0;
    const load = async () => {
      const my = ++seq;
      try {
        const { data, error } = await sharedSupabase.from("inquiry_attachments").select(ATT_PUBLIC_COLS).eq("published", true).order("sort_order").order("id");
        if (!alive || my !== seq || error) return;
        const m = {};
        (data || []).forEach((r) => { (m[r.inquiry_id] || (m[r.inquiry_id] = [])).push(r); });
        setMap(m);
      } catch (_) { /* الجداول ما انضافت بعد — الموقع يكمل بدون مرفقات */ }
    };
    load();
    const ch = sharedSupabase.channel("public-attachments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiry_attachments_rev" }, load).subscribe();
    return () => { alive = false; sharedSupabase.removeChannel(ch); };
  }, []);
  return map;
}
export function AttachmentsBlock({ rows, lang = "ar", T }) {
  const L = (ar, en) => (lang === "en" ? en : ar);
  const items = useMemo(() => (rows || []).map((r) => toView(r)), [rows]);
  const [open, setOpen] = useState(null);
  if (!items.length) return null;
  return (
    <div className="atk-sec">
      <div className="sec-lbl" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Paperclip size={12} /> {L("المرفقات", "Attachments")} <span style={{ opacity: 0.8 }}>· {lang === "en" ? items.length : attsLabel(items.length, lang)}</span>
      </div>
      <AttachmentTiles items={items} lang={lang} T={T} onOpen={setOpen} />
      {open != null && <AttachmentViewer list={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} lang={lang} />}
    </div>
  );
}

/* ═══ لوحة الإدارة ═══ */
const aBtn = (T, kind) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
  border: `1px solid ${kind === "pri" ? T.brass : kind === "danger" ? "#C0392B" : T.line}`,
  background: kind === "pri" ? T.brass : kind === "danger" ? "#C0392B" : T.surface,
  color: kind === "pri" ? T.onAccent : kind === "danger" ? "#fff" : T.paper,
});
const aIco = (T, danger) => ({ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "none", borderRadius: 8, color: danger ? "#C0392B" : T.muted, cursor: "pointer", padding: 0, flex: "none" });

/* حقل الرابط: يتعرّف على الرابط وأنت تكتب، ويسأل عن النوع لما ما يقدر يعرفه (Drive) */
export function LinkField({ T, placeholder, onAdd, allow }) {
  const [val, setVal] = useState(""), [pick, setPick] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const c = val.trim() ? classifyLink(val) : null;
  const kind = c && c.ok ? (c.needsKind ? pick || c.defaultKind : c.kind) : null;
  const blocked = !!(kind && allow && !allow.includes(kind));
  const submit = async () => {
    if (busy) return;
    if (!c) { setErr("الصق رابط أول."); return; }
    if (!c.ok) { setErr(c.msg); return; }
    if (blocked) { setErr("هذا النوع ما يُقبل هنا. المعرض للصور والمقاطع وملفات PDF والمستندات."); return; }
    setBusy(true);
    const res = await onAdd(c, kind);
    setBusy(false);
    if (res) { setErr(res); return; }
    setVal(""); setPick(null); setErr("");
  };
  const kinds = ["pdf", "video", "image", "file"].filter((k) => !allow || allow.includes(k));
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input value={val} dir={val ? "ltr" : "rtl"} type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={placeholder}
          onChange={(e) => { setVal(e.target.value); setPick(null); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          style={{ flex: 1, minWidth: 0, border: `1px solid ${T.line}`, background: T.surface, color: T.paper, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "inherit" }} />
        <button type="button" onClick={submit} disabled={busy} style={aBtn(T)}><Link2 size={14} /> إضافة</button>
      </div>
      {(err || c) && (
        <div style={{ fontSize: 12.5, lineHeight: 1.85, marginTop: 8, overflowWrap: "anywhere" }} aria-live="polite">
          {err ? <span style={{ color: "#C0392B" }}><AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> {err}</span>
            : c.ok ? <span style={{ color: blocked ? "#C0392B" : "#1E8E5A" }}><Check size={13} style={{ verticalAlign: "-2px" }} /> <b style={{ color: T.paper, fontWeight: 600 }}>{c.label}.</b> {blocked ? "هذا النوع ما يُقبل هنا." : c.note}</span>
              : <span style={{ color: "#C0392B" }}><AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> {c.msg}</span>}
          {c && c.ok && c.needsKind && (
            <div role="radiogroup" aria-label="نوع الملف" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: T.muted, marginInlineEnd: 4 }}>نوعه:</span>
              {kinds.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setPick(k)}
                  style={{ border: `1px solid ${kind === k ? T.brass : T.line}`, background: kind === k ? T.brass : T.surface, color: kind === k ? T.onAccent : T.muted, fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" }}>
                  {k === "pdf" ? "PDF" : KIND_AR[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* صف مرفق بلوحة الإدارة */
export function AAttachmentRow({ row, view, T, index, count, canEdit, onMove, onToggle, onDelete, onTitle, onPreview }) {
  const [confirm, setConfirm] = useState(false);
  const hidden = row.published === false;
  const placeholder = attTitle({ ...view, title_ar: null, title_en: null }, "ar");
  return (
    <li className="atk-arow" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
      <button type="button" onClick={onPreview} aria-label="معاينة" style={{ position: "relative", width: "100%", height: 42, borderRadius: 7, overflow: "hidden", background: T.sunken, color: T.muted, border: 0, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: hidden ? 0.5 : 1 }}>
        <KindIcon kind={view.kind} size={17} />
        {view.thumb && <img src={view.thumb} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      </button>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1, opacity: hidden ? 0.6 : 1 }}>
        <input defaultValue={row.title_ar || ""} placeholder={placeholder} disabled={!canEdit} aria-label="عنوان المرفق"
          onBlur={(e) => { if ((e.target.value || "").trim() !== (row.title_ar || "")) onTitle(e.target.value.trim()); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ width: "100%", border: 0, borderBottom: "1px solid transparent", background: "none", fontSize: 13, color: T.paper, padding: "2px 0", fontFamily: "inherit" }} />
        <span style={{ fontSize: 11, color: T.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {hidden && <span style={{ color: "#C0392B" }}>مخفي عن الملاك · </span>}{attMetaLine(view)}
        </span>
      </span>
      {canEdit && (
        <span className="atk-arow-acts">
          {confirm ? (
            <>
              <button type="button" style={{ ...aBtn(T, "danger"), padding: "5px 11px", fontSize: 12 }} onClick={() => { setConfirm(false); onDelete(); }}>حذف</button>
              <button type="button" style={{ ...aBtn(T), padding: "5px 11px", fontSize: 12 }} onClick={() => setConfirm(false)}>لا</button>
            </>
          ) : (
            <>
              <button type="button" style={aIco(T)} disabled={index === 0} onClick={() => onMove(-1)} aria-label="تحريك للأعلى"><ChevronUp size={15} /></button>
              <button type="button" style={aIco(T)} disabled={index === count - 1} onClick={() => onMove(1)} aria-label="تحريك للأسفل"><ChevronDown size={15} /></button>
              <button type="button" style={aIco(T)} onClick={onToggle} aria-label={hidden ? "إظهار للملاك" : "إخفاء عن الملاك"}>{hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              <button type="button" style={aIco(T, true)} onClick={() => setConfirm(true)} aria-label="حذف"><Trash2 size={14} /></button>
            </>
          )}
        </span>
      )}
    </li>
  );
}

/* عدّاد المساحة — من دالة storage_usage_bytes */
export function AStorageMeter({ supabase, T, refreshKey }) {
  const [used, setUsed] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.rpc("storage_usage_bytes").then(({ data, error }) => { if (alive && !error && data != null) setUsed(Number(data)); });
    return () => { alive = false; };
  }, [supabase, refreshKey]);
  if (used == null) return null;
  const pct = Math.min(100, (used / STORAGE_QUOTA) * 100);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ height: 6, borderRadius: 999, background: T.sunken, overflow: "hidden" }}><div style={{ width: `${Math.max(pct, 0.6)}%`, height: "100%", background: pct > 85 ? "#C0392B" : T.brass }} /></div>
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>التخزين: {fmtSize(used)} مستخدمة من أصل 1GB. الروابط الخارجية (يوتيوب، Drive…) ما تستهلك شي.</div>
    </div>
  );
}

/* قسم «المرفقات» داخل نموذج تعديل الاستفسار */
export function AAttachmentsPanel({ supabase, inquiryId, T, flashToast, log, canEdit = true, onCount }) {
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState([]);
  const [preview, setPreview] = useState(null);
  const [over, setOver] = useState(false);
  const rowsRef = useRef([]);
  const fileRef = useRef(null);
  const countRef = useRef(onCount); countRef.current = onCount;

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("inquiry_attachments").select("*").eq("inquiry_id", inquiryId).order("sort_order").order("id");
    if (error) { setMissing(isMissingTable(error)); rowsRef.current = []; setRows([]); return; }
    rowsRef.current = data || []; setRows(data || []); setMissing(false);
    if (countRef.current) countRef.current(inquiryId, (data || []).length);
  }, [supabase, inquiryId]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const nextOrder = () => (rowsRef.current.length ? Math.max(...rowsRef.current.map((r) => r.sort_order || 0)) + 1 : 0);

  const onFiles = async (fileList) => {
    const files = [...(fileList || [])];
    for (const f of files) {
      const key = `${f.name}-${f.size}-${Math.random()}`;
      setPending((p) => [...p, { key, name: f.name }]);
      let paths = [];
      try {
        const up = await uploadAttachmentFile(supabase, f, { prefix: `inq/${inquiryId}` });
        paths = up.paths;
        const title_ar = niceTitle(f.name) || null;
        const title_en = title_ar ? await autoTranslateAr(supabase, title_ar).catch(() => null) : null;
        const { error } = await supabase.from("inquiry_attachments").insert({ inquiry_id: inquiryId, ...up.fields, title_ar, ...(title_en ? { title_en } : {}), sort_order: nextOrder() });
        if (error) throw userErr(dbErrText(error));
        log("إضافة مرفق", `#${inquiryId} — ${f.name}`);
        const big = up.fields.kind === "video" && up.fields.size_bytes > WARN_VIDEO;
        flashToast(big ? `انضاف المقطع. تنبيه: كل مشاهدة كاملة تسحب ${fmtSize(up.fields.size_bytes)} — تقريبًا ${Math.floor(EGRESS_MONTH / up.fields.size_bytes)} مشاهدة بالشهر` : `انضاف «${f.name}»`);
      } catch (e) {
        if (paths.length) supabase.storage.from(ATT_BUCKET).remove(paths);
        flashToast(`تعذّر رفع «${f.name}»: ${(e && e.userMsg) || (e && e.message) || ""}`);
      } finally {
        setPending((p) => p.filter((x) => x.key !== key));
        await load();
      }
    }
  };
  const addLink = async (c, kind) => {
    const { error } = await supabase.from("inquiry_attachments").insert({ inquiry_id: inquiryId, ...linkFields(c, kind), sort_order: nextOrder() });
    if (error) return dbErrText(error);
    log("إضافة رابط مرفق", `#${inquiryId} — ${c.url}`);
    flashToast(`انضاف ${c.label}`);
    await load();
    return null;
  };
  const saveTitle = async (row, title_ar) => {
    const title_en = title_ar ? await autoTranslateAr(supabase, title_ar).catch(() => null) : null;
    const { error } = await supabase.from("inquiry_attachments").update({ title_ar: title_ar || null, title_en: title_ar ? title_en || null : null }).eq("id", row.id);
    if (error) flashToast(dbErrText(error)); else load();
  };
  const move = async (idx, d) => {
    const list = rowsRef.current, j = idx + d;
    if (j < 0 || j >= list.length) return;
    const a = list[idx], b = list[j];
    const sa = b.sort_order === a.sort_order ? a.sort_order + d : b.sort_order;
    await Promise.all([
      supabase.from("inquiry_attachments").update({ sort_order: sa }).eq("id", a.id),
      supabase.from("inquiry_attachments").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    load();
  };
  const toggle = async (row) => {
    const published = row.published === false;
    const { error } = await supabase.from("inquiry_attachments").update({ published }).eq("id", row.id);
    if (error) { flashToast(dbErrText(error)); return; }
    flashToast(published ? "صار المرفق ظاهرًا للملاك" : "أُخفي المرفق عن الملاك");
    load();
  };
  const remove = async (row) => {
    const { error } = await supabase.from("inquiry_attachments").delete().eq("id", row.id);
    if (error) { flashToast(dbErrText(error)); return; }
    const paths = [row.storage_path, row.thumb_path].filter(Boolean);
    if (paths.length) supabase.storage.from(ATT_BUCKET).remove(paths);
    log("حذف مرفق", `#${inquiryId} — ${row.file_name || row.external_url || row.id}`);
    flashToast("تم حذف المرفق");
    load();
  };

  const box = { marginTop: 4, marginBottom: 14, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, background: T.sunken };
  if (rows === null) return <div style={{ ...box, fontSize: 12.5, color: T.muted }}>يحمّل المرفقات…</div>;
  if (missing) {
    return (
      <div style={{ ...box, fontSize: 12.5, color: T.muted, lineHeight: 1.9 }}>
        قسم المرفقات يحتاج خطوة وحدة على Supabase: شغّل <b style={{ color: T.paper }}>migration-attachments.sql</b> من SQL Editor، وبعدها يشتغل هنا مباشرة.
      </div>
    );
  }
  const views = rows.map((r) => toView(r, supabase));
  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, marginBottom: 11 }}>
        <Paperclip size={15} color={T.brass} /> المرفقات
        <span style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 500, color: T.muted }}>{rows.length ? attsLabel(rows.length) : ""}</span>
      </div>
      {canEdit && (
        <>
          <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer && e.dataTransfer.files); }}
            style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1.5px dashed ${over ? T.brass : T.line}`, borderRadius: 12, padding: "10px 12px", background: T.surface }}>
            <button type="button" style={aBtn(T, "pri")} onClick={() => fileRef.current && fileRef.current.click()}><Upload size={15} /> رفع ملف</button>
            <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={(e) => { const fl = e.target.files; onFiles(fl ? [...fl] : []); e.target.value = ""; }} />
            <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.7, flex: "1 1 200px" }}>أو اسحب الملفات هنا. PDF وفيديو وصور وملفات أوفيس، حتى 50MB للملف. المقاطع الطويلة الأفضل برابط يوتيوب «غير مدرج».</span>
          </div>
          <LinkField T={T} placeholder="أو الصق رابط: يوتيوب، Drive…" onAdd={addLink} />
        </>
      )}
      {(rows.length > 0 || pending.length > 0) && (
        <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r, idx) => (
            <AAttachmentRow key={r.id} row={r} view={views[idx]} T={T} index={idx} count={rows.length} canEdit={canEdit}
              onMove={(d) => move(idx, d)} onToggle={() => toggle(r)} onDelete={() => remove(r)} onTitle={(t) => saveTitle(r, t)} onPreview={() => setPreview(idx)} />
          ))}
          {pending.map((p) => (
            <li key={p.key} className="atk-arow" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <span style={{ height: 42, borderRadius: 7, background: T.sunken, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${T.line}`, borderTopColor: T.brass, animation: "atkspin .8s linear infinite" }} />
              </span>
              <span style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T.faint }}>يجهّز الملف ويرفعه…</div>
              </span>
            </li>
          ))}
        </ol>
      )}
      {rows.length === 0 && pending.length === 0 && <p style={{ fontSize: 12, color: T.muted, margin: "10px 0 0" }}>ما فيه مرفقات لهذا الاستفسار.</p>}
      <AStorageMeter supabase={supabase} T={T} refreshKey={rows.length} />
      {preview != null && views.length > 0 && <AttachmentViewer list={views} index={preview} onIndex={setPreview} onClose={() => setPreview(null)} lang="ar" />}
    </div>
  );
}
