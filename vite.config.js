import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /* 6.8.0 — محرّك الترجمة الداخلي يشتغل بـ Web Worker من نوع module (local-mt.js) */
  worker: { format: "es" },
});
