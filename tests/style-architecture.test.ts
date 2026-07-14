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
    const fluidTransition = read("src/components/hero/fluidTransition.ts");
    const renderQuality = read("src/components/hero/renderQuality.ts");
    const goBackground = read("src/components/home/InteractiveGoBackground.tsx");
    const fluidVendor = read("public/vendor/webgl-fluid-background.js");

    expect(effectsCss).not.toContain(".content-inner::before");
    expect(effectsCss).toMatch(/#background\s*\{[^}]*z-index:\s*-1;/s);
    expect(introHero).toContain("BACK_COLOR: { r: 30, g: 31, b: 33 }");
    expect(introHero).toContain('data-transition-visual="clockwise-fluid-vortex-reveal"');
    expect(introHero).toContain('data-fluid-transition-model="random-surge-clockwise-center-sink"');
    expect(introHero).toContain("data-fluid-transition-core");
    expect(introHero).toContain("__startWebglFluidTransition");
    expect(introHero).not.toContain("data-intro-particle-transition");
    expect(introHero).not.toContain("startPptParticleMorph");
    expect(introHero).toContain('data-fluid-config-source="simonaking-homepage"');
    expect(introHero).toContain("SIM_RESOLUTION: 128");
    expect(introHero).toContain("DYE_RESOLUTION: 1024");
    expect(introHero).toContain("BLOOM_ITERATIONS: 8");
    expect(introHero).toContain("SUNRAYS_RESOLUTION: 196");
    expect(introHero).not.toContain("TIME_SCALE");
    expect(introHero).not.toContain('dispatchEvent(new Event("resize"))');
    expect(introHero).toContain("getTransitionMilestones");
    expect(introHero).toContain('setHomeRenderPhase("handoff"');
    expect(introHero).toContain('setHomeRenderPhase("main"');
    expect(introHero).toContain('data-quote-rotation="left-to-right-sequenced"');
    expect(introHero).toContain("data-quote-interlude-ms={quoteInterludeMs}");
    expect(introHero).toContain("getQuoteSweepDuration(quoteState.outgoing)");
    expect(introHero).toContain("pickNextIntroQuote");
    expect(effectsCss).toContain(".fluid-transition-core");
    expect(effectsCss).toContain('.profile-card[data-fluid-handoff="active"]');
    expect(effectsCss).not.toContain(".intro-particle-morph");
    expect(effectsCss).not.toContain(".slide-transition-edge");
    expect(effectsCss).toMatch(/\.content-title\s*\{[^}]*text-shadow:\s*none;[^}]*animation:\s*none;/s);
    expect(effectsCss).toContain(".intro-quote-layer.is-entering .intro-quote-char");
    expect(effectsCss).toContain(".intro-quote-layer.is-exiting .intro-quote-char");
    expect(effectsCss).toContain("@keyframes quote-character-in");
    expect(effectsCss).toContain("@keyframes quote-character-out");
    expect(effectsCss).not.toContain("@keyframes white-shadow");
    expect(effectsCss).not.toContain("@keyframes letter-glow");
    expect(fluidTransition).toContain("FLUID_TRANSITION_DURATION = 2600");
    expect(fluidTransition).toContain("getFluidInjectionCount");
    expect(fluidTransition).toContain("resolveFluidTransitionProgress");
    expect(renderQuality).not.toContain("particleCount");
    expect(renderQuality).not.toContain("particleDprCap");
    expect(goBackground).toContain("HOME_RENDER_PHASE_EVENT");
    expect(goBackground).toContain('data-render-state={renderState}');
    expect(goBackground).toContain("requestRenderRef");
    expect(goBackground).not.toContain('readCssVariable(canvasHost, "--go-scan"');
    expect(fluidVendor).toContain("PIXEL_RATIO_CAP");
    expect(fluidVendor).not.toContain("TIME_SCALE");
    expect(fluidVendor).toContain("fluidRenderState");
    expect(fluidVendor).toContain("transitionVelocityShader");
    expect(fluidVendor).toContain("injectTransitionSplat");
    expect(fluidVendor).toContain("window.__startWebglFluidTransition");
    expect(fluidVendor).toContain("clockwise");
    expect(fluidVendor).toContain("transitionProgress");
    expect(introHero).not.toContain("data-shape-streak-primary");
    expect(introHero).not.toContain("data-shape-streak-secondary");
  });
});
