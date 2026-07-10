import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("style architecture", () => {
  it("keeps global CSS as an import-only entrypoint", () => {
    const globalCss = read("src/styles/global.css");

    expect(globalCss.trim()).toBe(
      [
        '@import "./tokens.css";',
        '@import "./base.css";',
        '@import "./components.css";',
        '@import "./effects.css";'
      ].join("\n")
    );
  });

  it("uses a single soft-dark visual theme instead of a light/dark toggle system", () => {
    const tokensCss = read("src/styles/tokens.css");
    const layout = read("src/components/layout/SiteLayout.astro");

    expect(tokensCss).toContain("--theme-name: soft-dark");
    expect(tokensCss).not.toContain('data-theme="light"');
    expect(layout).toContain('data-ui-theme="soft-dark"');
    expect(layout).not.toContain("ThemeToggle");
    expect(layout).not.toContain("personal-homepage-theme");
  });

  it("keeps the intro fluid canvas unobscured like the reference opening", () => {
    const effectsCss = read("src/styles/effects.css");
    const introHero = read("src/components/hero/IntroOpeningHero.tsx");
    const particleMorph = read("src/components/hero/particleMorphTransition.ts");

    expect(effectsCss).not.toContain(".content-inner::before");
    expect(effectsCss).toMatch(/#background\s*\{[^}]*z-index:\s*-1;/s);
    expect(introHero).toContain("BACK_COLOR: { r: 30, g: 31, b: 33 }");
    expect(introHero).toContain('data-transition-visual="ppt-particle-morph"');
    expect(introHero).toContain("data-intro-particle-transition");
    expect(introHero).toContain('data-particle-flow-direction="axes-to-taiji-to-axes"');
    expect(introHero).toContain('data-particle-mapping="axis-streams-to-viewport-taiji"');
    expect(introHero).toContain('data-particle-transition-model="fullscreen-taiji-particle-wipe"');
    expect(introHero).toContain('data-particle-target-order="main-view-behind-curtain"');
    expect(introHero).toContain('data-particle-path="axis-gather-rotate-axis-release"');
    expect(introHero).toContain('data-particle-polarities="light-dark"');
    expect(introHero).toContain('data-particle-entry-axes="light-vertical-dark-horizontal"');
    expect(introHero).toContain('data-particle-exit-axes="opposite-axis-edges"');
    expect(introHero).toContain('data-particle-rotation-degrees="540"');
    expect(introHero).toContain('data-particle-taiji-geometry="s-curve-dual-eyes"');
    expect(introHero).toContain('data-particle-coverage="viewport-diagonal"');
    expect(introHero).toContain('data-particle-max-frame-step-ms="64"');
    expect(introHero).toContain("startPptParticleMorph");
    expect(introHero).toContain('data-quote-rotation="left-to-right-sequenced"');
    expect(introHero).toContain("data-quote-interlude-ms={quoteInterludeMs}");
    expect(introHero).toContain("getQuoteSweepDuration(quoteState.outgoing)");
    expect(introHero).toContain("pickNextIntroQuote");
    expect(effectsCss).toContain(".intro-particle-morph");
    expect(effectsCss).not.toContain(".slide-transition-edge");
    expect(effectsCss).toMatch(/\.content-title\s*\{[^}]*text-shadow:\s*none;[^}]*animation:\s*none;/s);
    expect(effectsCss).toContain(".intro-quote-layer.is-entering .intro-quote-char");
    expect(effectsCss).toContain(".intro-quote-layer.is-exiting .intro-quote-char");
    expect(effectsCss).toContain("@keyframes quote-character-in");
    expect(effectsCss).toContain("@keyframes quote-character-out");
    expect(effectsCss).not.toContain("@keyframes white-shadow");
    expect(effectsCss).not.toContain("@keyframes letter-glow");
    expect(particleMorph).toContain("resolveParticlePhase");
    expect(particleMorph).toContain("getParticleAxis");
    expect(particleMorph).toContain("getTaijiPolarity");
    expect(particleMorph).toContain("buildTaijiAnchor");
    expect(particleMorph).toContain("buildAxisPoint");
    expect(particleMorph).toContain("pointOnTaijiPath");
    expect(particleMorph).toContain("drawTransitionCurtain");
    expect(particleMorph).toContain("drawTaijiFlowField");
    expect(particleMorph).toContain("duration = 2300");
    expect(particleMorph).toContain("const maxFrameStep = 64");
    expect(particleMorph).toContain("particleCount = width < 720 ? 900 : highResolutionViewport ? 1300 : 1600");
    expect(effectsCss).toMatch(/\.intro-particle-morph\s*\{[^}]*mix-blend-mode:\s*normal;/s);
    expect(introHero).not.toContain("data-shape-streak-primary");
    expect(introHero).not.toContain("data-shape-streak-secondary");
  });
});
