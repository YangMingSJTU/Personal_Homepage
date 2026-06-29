import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://gg-lab.example.com",
  integrations: [
    react(),
    sitemap()
  ]
});
