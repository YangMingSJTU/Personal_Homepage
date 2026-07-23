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
    expect(introHero).toContain('data-transition-visual="irregular-fluid-ebb-reveal"');
    expect(introHero).toContain('data-fluid-transition-model="irregular-fluid-ebb"');
    expect(introHero).toContain('data-fluid-transition-flow="clockwise-outward-edge-drain"');
    expect(introHero).toContain('data-fluid-transition-direction="outward"');
    expect(introHero).toContain('data-fluid-transition-distribution="existing-fluid-no-injection"');
    expect(introHero).toContain('data-fluid-transition-reveal="density-evacuation-board-reveal"');
    expect(introHero).toContain('data-fluid-transition-capture="irregular-front-edge-absorption"');
    expect(introHero).toContain('data-fluid-transition-density-pass="fused-advection"');
    expect(introHero).toContain('data-fluid-post-process-mode="interleaved-cache"');
    expect(introHero).toContain('data-fluid-transition-color="hue-preserving-tone-map"');
    expect(introHero).toContain('data-fluid-transition-palette="original-fluid-hues"');
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
    expect(introHero).toContain("updateOriginPoint: (originPoint");
    expect(introHero).toContain('window.addEventListener("resize", scheduleOriginUpdate)');
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
    expect(fluidTransition).toContain("FLUID_TRANSITION_DURATION = 2800");
    expect(fluidTransition).toContain("getFluidInjectionCount");
    expect(fluidTransition).toMatch(/high:\s*0,[\s\S]*balanced:\s*0,[\s\S]*low:\s*0/);
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
    expect(fluidVendor).not.toContain("injectTransitionSplat");
    expect(fluidVendor).toContain("window.__startWebglFluidTransition");
    expect(fluidVendor).toContain("clockwise");
    expect(fluidVendor).toContain("transitionProgress");
    expect(fluidVendor).toContain("uniform vec2 transitionCenter");
    expect(fluidVendor).toContain("vUv - transitionCenter");
    expect(fluidVendor).toContain("uniform float resolutionScale");
    expect(fluidVendor).toContain("float outwardRate = mix(0.34, 1.24");
    expect(fluidVendor).toContain("float angularRate = mix(0.24, 0.035");
    expect(fluidVendor).toContain("float harmonicThree = radial.x * (radialX2 - 3.0 * radialY2)");
    expect(fluidVendor).toContain("float harmonicFour = 4.0 * radial.x * radial.y");
    expect(fluidVendor).toContain("radial * outwardRate * flowVariation + clockwise * angularRate");
    expect(fluidVendor).not.toContain("remainingSeconds");
    expect(fluidVendor).toContain(
      "float steering = (1.0 - exp(-steeringRate * dt)) * smoothstep(0.03, 0.20, progress)",
    );
    expect(fluidVendor).toContain("uniform float openBoundary");
    expect(fluidVendor).toContain("result *= mix(1.0, withinBounds, openBoundary)");
    expect(fluidVendor).not.toContain("createSeededTransitionRandom");
    expect(fluidVendor).toContain("float densityMask = mix(1.0, fluidPresence, densityReveal)");
    expect(fluidVendor).toContain("vec4 applyEbbRetention (vec4 density)");
    expect(fluidVendor).toContain("result = applyEbbRetention(result)");
    expect(fluidVendor).toContain("const ebbAdvectionProgram = new Program(baseVertexShader, ebbAdvectionShader)");
    expect(fluidVendor).toContain("const dyeAdvectionProgram = activeTransition ? ebbAdvectionProgram : advectionProgram");
    expect(fluidVendor).not.toContain("uniform float ebbActive");
    expect(fluidVendor).not.toContain("transitionDensityShader");
    expect(fluidVendor).not.toContain("transitionDensityProgram");
    expect(fluidVendor).toContain("const refreshBloom = config.BLOOM");
    expect(fluidVendor).toContain("const refreshSunrays = config.SUNRAYS");
    expect(fluidVendor).toContain("postProcessFrame = (postProcessFrame + 1) % 2");
    expect(fluidVendor).toContain("float frontRadius = mix(0.012, viewportRadius, easedTide) + irregularity");
    expect(fluidVendor).toContain("float harmonicThree = direction.x * (directionX2 - 3.0 * directionY2)");
    expect(fluidVendor).toContain("float edgeCapture = (1.0 - smoothstep(0.018, 0.13, edgeDistance))");
    expect(fluidVendor).not.toContain("atan(physicalOffset.y, physicalOffset.x)");
    expect(fluidVendor).not.toContain("atan(offset.y, offset.x)");
    expect(fluidVendor).toContain("float absorptionRate = evacuated * mix(0.0, 15.0");
    expect(fluidVendor).not.toContain("coreColorInfluence");
    expect(fluidVendor).not.toContain("desaturation");
    expect(fluidVendor).toContain("float toneMappedEnergy = colorEnergy / (1.0 + 0.22 * colorEnergy)");
    expect(fluidVendor).not.toContain("terminalPull");
    expect(fluidVendor).not.toContain("compressionScale");
    expect(fluidVendor).not.toContain("transitionColorPalette");
    expect(fluidVendor).not.toContain("guidedReveal");
    expect(fluidVendor).not.toContain("spatialMask");
    expect(fluidVendor).not.toContain("safetyEnvelope");
    expect(fluidVendor).toContain("updateOriginPoint(originPoint)");
    expect(fluidVendor).toContain("sampleRuntimeQuality(performance.now())");
    expect(fluidVendor).toContain("canvas.dataset.fluidQualityDowngraded = 'true'");
    expect(introHero).not.toContain("data-shape-streak-primary");
    expect(introHero).not.toContain("data-shape-streak-secondary");
  });
});
