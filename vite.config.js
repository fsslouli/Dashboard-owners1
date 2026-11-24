import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

/* 7.16.0 — قائمة الإصدارات (رقم + تاريخ فقط) تُستخرج وقت البناء من changelog-legal-data.jsx،
   عشان الموقع العام يعرض رقم الإصدار بدون ما تنحمّل معه تفاصيل التحديثات (هذي ما تنحمّل إلا من الإدارة). */
const VID = "virtual:releases";
function releasesPlugin() {
  const file = new URL("./changelog-legal-data.jsx", import.meta.url).pathname;
  return {
    name: "releases-list",
    resolveId(id) { return id === VID ? "\0" + VID : null; },
    load(id) {
      if (id !== "\0" + VID) return null;
      this.addWatchFile(file);
      const src = readFileSync(file, "utf8");
      const rx = /version:\s*"([^"]+)",\s*dateAr:\s*"([^"]+)",\s*dateEn:\s*"([^"]+)"/g;
      const out = []; let m;
      while ((m = rx.exec(src))) out.push({ version: m[1], dateAr: m[2], dateEn: m[3] });
      if (!out.length) this.error("releases-list: no releases found in changelog-legal-data.jsx");
      return `export const RELEASES = ${JSON.stringify(out)};\nexport const CURRENT_VERSION = RELEASES[0].version;`;
    },
  };
}

export default defineConfig({
  plugins: [react(), releasesPlugin()],
  /* 6.8.0 — محرّك الترجمة الداخلي يشتغل بـ Web Worker من نوع module (local-mt.js) */
  worker: { format: "es" },
});
