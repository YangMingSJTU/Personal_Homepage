import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://yangmingsjtu.github.io",
  base: "/Personal_Homepage",
  devToolbar: {
    enabled: false
  },
  integrations: [
    react(),
    sitemap()
  ]
});
