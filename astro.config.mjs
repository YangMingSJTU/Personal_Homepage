import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://personal-homepage.example.com",
  devToolbar: {
    enabled: false
  },
  integrations: [
    react(),
    sitemap()
  ]
});
