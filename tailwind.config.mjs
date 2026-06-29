/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "Noto Sans SC", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "Consolas", "monospace"]
      },
      colors: {
        void: "#05070D",
        ink: "#0B1020",
        panel: "#10141C",
        line: "#263244",
        stone: "#F2EEE3",
        cyan: "#00E5FF",
        violet: "#7C3AED",
        gold: "#C8A96A"
      },
      boxShadow: {
        glow: "0 0 32px rgba(0, 229, 255, 0.16)",
        gold: "0 0 24px rgba(200, 169, 106, 0.18)"
      }
    }
  },
  plugins: []
};
