/* ═══════════════════════════════════════════════════════════
   links-kit.jsx — الروابط الخارجية («مساهمات الملاك») بالموقع العام

   رابط خارجي يُدار كاملًا من لوحة الإدارة (تبويب «الروابط الخارجية») ويظهر بأي من أربعة أماكن:
     gallery   مجلد داخل «المكتبة المرئية والتقارير» (اسم المجلد يحدده كل رابط)
     overview  بطاقة أسفل «النظرة العامة»
     notices   داخل نافذة الإشعارات المنبثقة
     header    زر صغير بجانب «انضم لمجتمع الملاك»
   أي ضغطة على رابط تفتح شاشة تنبيه «ستنتقل إلى موقع خارجي» قبل الانتقال.
   لا يُعرض شيء من هذا داخل روابط المشاركة المحدودة.
   ═══════════════════════════════════════════════════════════ */
import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Folder, Globe, Info } from "lucide-react";
import { logEvent } from "./app-bootstrap.jsx";
import { useBackClose } from "./site-hooks.jsx";

export const LINK_PLACEMENTS = [
  { key: "gallery", ar: "مجلد في المكتبة المرئية والتقارير", en: "Folder in the media library" },
  { key: "overview", ar: "بطاقة في النظرة العامة", en: "Card on the overview" },
  { key: "notices", ar: "نافذة الإشعارات المنبثقة", en: "Notices popup" },
  { key: "header", ar: "زر أعلى الصفحة بجانب «انضم لمجتمع الملاك»", en: "Button at the top, next to «Join the community»" },
];

export const DEFAULT_DISCLAIMER_AR = "هذا الموقع من إعداد أحد الملاك بجهد شخصي مشكور. محتواه وأرقامه وتحليلاته مسؤولية صاحبه، ولا يمثل المطور ولا فريق تمثيل الملاك.";
export const DEFAULT_DISCLAIMER_EN = "This website was prepared by one of the owners as a personal effort, which we appreciate. Its content, figures and analysis are the author's responsibility and do not represent the developer or the Owners' Representatives Team.";

/* رابط آمن للفتح: https فقط (يمنع javascript: وغيره حتى لو دخل بالغلط) */
export const safeUrl = (u) => {
  try { const x = new URL(String(u || "").trim()); return x.protocol === "https:" ? x.href : null; } catch { return null; }
};
export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

const pick = (lang, ar, en) => (lang === "en" ? (en || ar) : ar) || "";
export const lkTitle = (l, lang) => pick(lang, l.title_ar, l.title_en);
export const lkDesc = (l, lang) => pick(lang, l.desc_ar, l.desc_en);
export const lkAuthor = (l, lang) => pick(lang, l.author_ar, l.author_en);
export const lkFolder = (l, lang) => pick(lang, l.folder_ar, l.folder_en);
export const lkDisclaimer = (l, lang) => (lang === "en" ? (l.disclaimer_en || DEFAULT_DISCLAIMER_EN) : (l.disclaimer_ar || DEFAULT_DISCLAIMER_AR));

/* ── القراءة العامة — المنشور فقط، ولحظيًا؛ قبل تشغيل الهجرة ترجع قائمة فاضية بهدوء ── */
export function useExternalLinks(supabase, enabled = true) {
  const [links, setLinks] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const load = async () => {
      const { data, error } = await supabase.from("external_links").select("*").eq("published", true).order("sort_order").order("id");
      if (live) setLinks(error ? [] : (data || []).filter((l) => safeUrl(l.url)));
    };
    load();
    const ch = supabase.channel("public-external-links")
      .on("postgres_changes", { event: "*", schema: "public", table: "external_links" }, load)
      .subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, [supabase, enabled]);
  return links;
}
export const linksAt = (links, place) => (links || []).filter((l) => (l.placements || []).includes(place));

/* ── شاشة التنبيه قبل مغادرة الموقع ── */
export function LinkLeaveSheet({ link, T, lang, onClose }) {
  useBackClose(!!link, onClose);
  if (!link) return null;
  const href = safeUrl(link.url);
  const en = lang === "en";
  return (
    <div className="ovl no-print" style={{ zIndex: 96 }} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }} role="dialog" aria-modal="true" aria-labelledby="lk-leave-title">
        <div style={{ padding: "22px 20px 8px", display: "flex", flexDirection: "column", gap: 14, textAlign: "start" }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: T.brass + "1F", color: T.brass, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ExternalLink size={24} />
          </span>
          <h2 id="lk-leave-title" style={{ margin: 0, fontSize: 19, fontWeight: 800, lineHeight: 1.4, color: T.paper }}>
            {en ? "You are about to leave this site" : "ستنتقل إلى موقع خارجي"}
          </h2>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.paper }}>{lkTitle(link, lang)}</div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.95, color: T.muted }}>{lkDisclaimer(link, lang)}</p>
          <span dir="ltr" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: T.sunken, border: `1px solid ${T.line}`, color: T.paper, fontSize: 12.5, fontFamily: "ui-monospace, Menlo, monospace" }}>
            <Globe size={13} />{hostOf(link.url)}
          </span>
        </div>
        <div style={{ padding: "14px 20px calc(20px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 10 }}>
          <a href={href || "#"} target="_blank" rel="noopener noreferrer" className="big-btn"
            style={{ marginTop: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
            onClick={() => { logEvent("click", "external_link", String(link.id), null); setTimeout(onClose, 0); }}>
            {en ? "Open the site" : "فتح الموقع"} <ExternalLink size={16} />
          </a>
          <button type="button" onClick={onClose}
            style={{ minHeight: 48, borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.paper, font: "inherit", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
            {en ? "Go back" : "رجوع"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── مجلد بالمعرض: يتجمّع كل رابطين بنفس اسم المجلد بمجلد واحد.
   يعتمد على أصناف glx-* ومتغيرات --gx-* من gallery-kit (يُعرض داخل حاوية .glx) ── */
export function LinksFolders({ links, lang, onLeave }) {
  const [open, setOpen] = useState({});
  const items = linksAt(links, "gallery");
  if (!items.length) return null;
  const groups = [];
  items.forEach((l) => {
    const k = l.folder_ar || "";
    let g = groups.find((x) => x.k === k);
    if (!g) { g = { k, title: lkFolder(l, lang), rows: [] }; groups.push(g); }
    g.rows.push(l);
  });
  const en = lang === "en";
  return groups.map((g) => {
    const isOpen = !!open[g.k];
    return (
      <section key={g.k} className={`glx-fold${isOpen ? " open" : ""}`}>
        <button type="button" className="glx-fh" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [g.k]: !isOpen }))}>
          <span className="glx-fi"><Folder size={22} /></span>
          <span className="glx-ft">
            <b>{g.title}</b>
            <span>{en ? (g.rows.length === 1 ? "1 link" : `${g.rows.length} links`) : (g.rows.length === 1 ? "رابط واحد" : `${g.rows.length} روابط`)}</span>
          </span>
          <span className="glx-chev"><ChevronDown size={18} /></span>
        </button>
        {isOpen && (
          <div className="glx-fb">
            <div className="glx-list">
              {g.rows.map((l) => (
                <button key={l.id} type="button" className="glx-row" onClick={() => onLeave(l)}>
                  <span className="glx-rt"><Globe size={17} /></span>
                  <span className="glx-rn">
                    {lkTitle(l, lang)}
                    {lkAuthor(l, lang) && <span style={{ display: "block", fontSize: 11.5, fontWeight: 400, color: "var(--gx-muted)", marginTop: 2 }}>{lkAuthor(l, lang)}</span>}
                  </span>
                  <span className="glx-rb">{en ? "External site" : "موقع خارجي"}</span>
                  <span className="glx-rg"><ExternalLink size={15} /></span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  });
}

/* ── بطاقة بالنظرة العامة ── */
export function LinksOverviewCards({ links, T, lang, onLeave }) {
  const items = linksAt(links, "overview");
  if (!items.length) return null;
  const en = lang === "en";
  return items.map((l) => (
    <section key={l.id} className="surf" data-sec="ext-link" style={{ padding: "18px 16px", marginTop: 14, display: "flex", flexDirection: "column", gap: 10, border: `1px solid ${T.brass}4D` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.brass, fontSize: 12, fontWeight: 700 }}>
        <Globe size={16} /><span>{lkAuthor(l, lang) || (en ? "Owner contribution" : "من مساهمات الملاك")}</span>
      </div>
      <h2 className="sec-t" style={{ margin: 0 }}>{lkTitle(l, lang)}</h2>
      {lkDesc(l, lang) && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.85, color: T.muted }}>{lkDesc(l, lang)}</p>}
      <p style={{ margin: 0, display: "flex", gap: 7, alignItems: "flex-start", fontSize: 11.5, lineHeight: 1.8, color: T.muted }}>
        <Info size={14} style={{ flex: "none", marginTop: 4 }} />
        <span>{en ? "Content is the author's responsibility and does not represent the developer or the Owners' Representatives Team." : "المحتوى من إعداد صاحبه، ولا يمثل المطور ولا فريق تمثيل الملاك."}</span>
      </p>
      <button type="button" className="big-btn" onClick={() => onLeave(l)} style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {en ? "Open the site" : "فتح الموقع"} <ExternalLink size={16} />
      </button>
    </section>
  ));
}

/* ── داخل نافذة الإشعارات ── */
export function LinksInNotices({ links, T, lang, onLeave }) {
  const items = linksAt(links, "notices");
  const en = lang === "en";
  return items.map((l, i) => (
    <div key={l.id} style={{ marginTop: i === 0 ? 0 : 16, paddingTop: i === 0 ? 0 : 16, borderTop: i === 0 ? "none" : `1px solid ${T.lineSoft}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Globe size={15} color={T.brass} style={{ flexShrink: 0, marginTop: 3 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.paper }}>{lkTitle(l, lang)}{lkAuthor(l, lang) ? ` — ${lkAuthor(l, lang)}` : ""}</div>
        {lkDesc(l, lang) && <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{lkDesc(l, lang)}</div>}
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{en ? "Content is the author's responsibility and does not represent the developer or the Owners' Representatives Team." : "المحتوى من إعداد صاحبه، ولا يمثل المطور ولا فريق تمثيل الملاك."}</div>
        <button type="button" onClick={() => onLeave(l)}
          style={{ marginTop: 9, display: "inline-flex", alignItems: "center", gap: 7, minHeight: 44, padding: "0 16px", border: "none", borderRadius: 10, background: T.brass, color: "#fff", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {en ? "Open the site" : "فتح الموقع"} <ExternalLink size={14} />
        </button>
      </div>
    </div>
  ));
}

/* ── زر بالترويسة (بجانب «انضم لمجتمع الملاك») ── */
export function LinksHeaderChips({ links, T, lang, onLeave }) {
  const items = linksAt(links, "header");
  return items.map((l) => (
    <button key={l.id} type="button" onClick={() => onLeave(l)}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.paper, font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
      <ExternalLink size={14} color={T.brass} />{lkTitle(l, lang)}
    </button>
  ));
}

