import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://bi.balagan.pro",
  trailingSlash: "ignore",
  compressHTML: false,
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
});
