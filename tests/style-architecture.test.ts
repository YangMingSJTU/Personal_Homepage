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

  it("keeps the homepage in a footer-free locked viewport", () => {
    const layout = read("src/components/layout/SiteLayout.astro");
    const indexPage = read("src/pages/index.astro");
    const baseCss = read("src/styles/base.css");

    expect(layout).toContain("showFooter = true");
    expect(layout).toContain("lockViewport = false");
    expect(layout).toContain("{showFooter && <Footer />}");
    expect(indexPage).toContain("showFooter={false}");
    expect(indexPage).toContain("lockViewport={true}");
    expect(baseCss).toContain("html.viewport-locked body");
    expect(baseCss).toMatch(/\.viewport-locked \.page-shell > main\s*\{[^}]*overflow:\s*hidden;/s);
  });

  it("keeps the intro fluid canvas unobscured like the reference opening", () => {
    const componentsCss = read("src/styles/components.css");
    const effectsCss = read("src/styles/effects.css");
    const introHero = read("src/components/hero/IntroOpeningHero.tsx");
    const indexPage = read("src/pages/index.astro");
    const fluidTransition = read("src/components/hero/fluidTransition.ts");
    const renderQuality = read("src/components/hero/renderQuality.ts");
    const goBackground = read("src/components/home/InteractiveGoBackground.tsx");
    const fluidVendor = read("public/vendor/webgl-fluid-background.js");

    expect(effectsCss).not.toContain(".content-inner::before");
    expect(effectsCss).toMatch(/#background\s*\{[^}]*z-index:\s*-1;/s);
    expect(introHero).toContain("BACK_COLOR: { r: 30, g: 31, b: 33 }");
    expect(introHero).toContain('data-transition-visual="clockwise-fluid-vortex-reveal"');
    expect(introHero).toContain('data-fluid-transition-model="mixed-source-radius-aware-avatar-sink"');
    expect(introHero).toContain('data-fluid-transition-flow="distance-aware-inward-spiral"');
    expect(introHero).toContain('data-fluid-transition-distribution="edge-55-interior-45"');
    expect(introHero).toContain('data-fluid-transition-reveal="fluid-density-board-handoff"');
    expect(introHero).toContain('data-fluid-transition-capture="velocity-damped-avatar-core"');
    expect(introHero).not.toContain("data-fluid-transition-core");
    expect(introHero).not.toContain("avatarSrc");
    expect(indexPage).not.toContain("avatarSrc");
    expect(introHero).toContain("__startWebglFluidTransition");
    expect(introHero).not.toContain("coreHandoff");
    expect(introHero).not.toContain("fluidCore");
    expect(introHero).toContain("resolveFluidAvatarOpacity");
    expect(introHero).toContain('setProperty("--fluid-avatar-opacity"');
    expect(introHero).not.toContain("data-intro-particle-transition");
    expect(introHero).not.toContain("startPptParticleMorph");
    expect(introHero).toContain('data-fluid-config-source="simonaking-homepage"');
    expect(introHero).toContain("SIM_RESOLUTION: 128");
    expect(introHero).toContain("DYE_RESOLUTION: 1024");
    expect(introHero).toContain("BLOOM_ITERATIONS: 8");
    expect(introHero).toContain("SUNRAYS_RESOLUTION: 196");
    expect(introHero).toContain("...getRenderProfile(quality).fluid");
    expect(introHero).toContain("RUNTIME_QUALITY_FALLBACK: getRuntimeFluidFallback(quality)");
    expect(introHero).toContain("updateSinkPoint: (sinkPoint");
    expect(introHero).toContain('window.addEventListener("resize", scheduleSinkUpdate)');
    expect(introHero).toContain("IDLE_SIMULATION_RATE: FLUID_REFERENCE_IDLE_CADENCE");
    expect(introHero).not.toContain('dispatchEvent(new Event("resize"))');
    expect(introHero).toContain("getTransitionMilestones");
    expect(introHero).toContain('setHomeRenderPhase("handoff"');
    expect(introHero).toContain('setHomeRenderPhase("main"');
    expect(introHero).toContain('data-quote-rotation="left-to-right-sequenced"');
    expect(introHero).toContain("data-quote-interlude-ms={quoteInterludeMs}");
    expect(introHero).toContain("getQuoteSweepDuration(quoteState.outgoing)");
    expect(introHero).toContain("pickNextIntroQuote");
    expect(effectsCss).not.toContain(".fluid-transition-core");
    expect(effectsCss).toContain('.profile-card[data-fluid-handoff="active"]');
    expect(effectsCss).toContain("opacity: var(--fluid-avatar-opacity, 0)");
    expect(effectsCss).not.toContain("@keyframes profile-card-in");
    expect(componentsCss).not.toMatch(/animation:\s*profile-card-in/);
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
    expect(renderQuality).toContain("FLUID_RUNTIME_WARMUP_FRAMES = 12");
    expect(renderQuality).toContain("FLUID_RUNTIME_SAMPLE_FRAMES = 40");
    expect(goBackground).toContain("HOME_RENDER_PHASE_EVENT");
    expect(goBackground).toContain('data-render-state={renderState}');
    expect(goBackground).toContain("requestRenderRef");
    expect(goBackground).not.toContain('readCssVariable(canvasHost, "--go-scan"');
    expect(fluidVendor).toContain("PIXEL_RATIO_CAP");
    expect(fluidVendor).toContain("frameDt * idleCadence");
    expect(fluidVendor).toContain("fluidRenderState");
    expect(fluidVendor).toContain("transitionVelocityShader");
    expect(fluidVendor).toContain("injectTransitionSplat");
    expect(fluidVendor).toContain("window.__startWebglFluidTransition");
    expect(fluidVendor).toContain("clockwise");
    expect(fluidVendor).toContain("transitionProgress");
    expect(fluidVendor).toContain("uniform vec2 transitionCenter");
    expect(fluidVendor).toContain("vUv - transitionCenter");
    expect(fluidVendor).toContain("Math.round(state.injectionCount * 0.55)");
    expect(fluidVendor).toContain("mix(720.0, 300.0, spiralProgress)");
    expect(fluidVendor).toContain("mix(740.0, 2050.0, spiralProgress)");
    expect(fluidVendor).toContain("centerDamping * mix(0.92, 1.08, farZone)");
    expect(fluidVendor).toContain("captureZone * captureProgress * 0.06");
    expect(fluidVendor).toContain("clockwiseX * clockwiseWeight + inwardX * inwardWeight");
    expect(fluidVendor).toContain("float densityMask = mix(1.0, fluidPresence, densityReveal)");
    expect(fluidVendor).toContain("float safetyEnvelope = max(spatialMask, fluidPresence * 0.55)");
    expect(fluidVendor).toContain("float guidedMask = mix(1.0, safetyEnvelope, guidedReveal)");
    expect(fluidVendor).toContain("updateSinkPoint(sinkPoint)");
    expect(fluidVendor).toContain("sampleRuntimeQuality(performance.now())");
    expect(fluidVendor).toContain("canvas.dataset.fluidQualityDowngraded = 'true'");
    expect(introHero).not.toContain("data-shape-streak-primary");
    expect(introHero).not.toContain("data-shape-streak-secondary");
  });
});
