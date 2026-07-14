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
    const renderQuality = read("src/components/hero/renderQuality.ts");
    const goBackground = read("src/components/home/InteractiveGoBackground.tsx");
    const fluidVendor = read("public/vendor/webgl-fluid-background.js");

    expect(effectsCss).not.toContain(".content-inner::before");
    expect(effectsCss).toMatch(/#background\s*\{[^}]*z-index:\s*-1;/s);
    expect(introHero).toContain("BACK_COLOR: { r: 30, g: 31, b: 33 }");
    expect(introHero).toContain('data-transition-visual="ppt-particle-morph"');
    expect(introHero).toContain("data-intro-particle-transition");
    expect(introHero).toContain('data-particle-flow-direction="axes-to-taiji-to-axes"');
    expect(introHero).toContain('data-particle-mapping="axis-streams-to-viewport-taiji"');
    expect(introHero).toContain('data-particle-transition-model="fullscreen-taiji-particle-wipe"');
    expect(introHero).toContain('data-particle-target-order="main-view-behind-curtain"');
    expect(introHero).toContain('data-particle-path="tangent-continuous-axis-taiji-axis"');
    expect(introHero).toContain('data-particle-continuity="c1-tangent-matched"');
    expect(introHero).toContain('data-particle-orbit="continuous-slow-spin"');
    expect(introHero).toContain('data-particle-polarities="light-dark"');
    expect(introHero).toContain('data-particle-entry-axes="light-vertical-dark-horizontal"');
    expect(introHero).toContain('data-particle-exit-axes="opposite-axis-edges"');
    expect(introHero).toContain('data-particle-rotation-degrees="108"');
    expect(introHero).toContain('data-fluid-time-scale={fluidBaseConfig.TIME_SCALE}');
    expect(introHero).toContain("TIME_SCALE: 0.5");
    expect(introHero).toContain('data-particle-taiji-geometry="s-curve-dual-eyes"');
    expect(introHero).toContain('data-particle-coverage="viewport-diagonal"');
    expect(introHero).toContain('data-particle-timeline="wall-clock"');
    expect(introHero).toContain("getTransitionMilestones");
    expect(introHero).toContain('setHomeRenderPhase("handoff"');
    expect(introHero).toContain('setHomeRenderPhase("main"');
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
    expect(particleMorph).toContain("sampleParticlePath");
    expect(particleMorph).toContain("drawTransitionCurtain");
    expect(particleMorph).toContain("drawTaijiFlowField");
    expect(particleMorph).toContain("duration = PARTICLE_TRANSITION_DURATION");
    expect(particleMorph).toContain("entryTangentDistance");
    expect(particleMorph).toContain("exitTangentDistance");
    expect(particleMorph).toContain("resolveTaijiRotation");
    expect(particleMorph).toContain("resolveParticleProgress");
    expect(particleMorph).not.toContain("maxFrameStep");
    expect(particleMorph).toContain("profile.particleCount");
    expect(renderQuality).toContain("particleCount: 1600");
    expect(renderQuality).toContain("particleCount: 1300");
    expect(renderQuality).toContain("particleCount: 700");
    expect(goBackground).toContain("HOME_RENDER_PHASE_EVENT");
    expect(goBackground).toContain('data-render-state={renderState}');
    expect(goBackground).toContain("requestRenderRef");
    expect(goBackground).not.toContain('readCssVariable(canvasHost, "--go-scan"');
    expect(fluidVendor).toContain("PIXEL_RATIO_CAP");
    expect(fluidVendor).toContain("config.TIME_SCALE ?? 1");
    expect(fluidVendor).toContain("fluidRenderState");
    expect(effectsCss).toMatch(/\.intro-particle-morph\s*\{[^}]*mix-blend-mode:\s*normal;/s);
    expect(introHero).not.toContain("data-shape-streak-primary");
    expect(introHero).not.toContain("data-shape-streak-secondary");
  });
});
