# Slide Deck Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current particle-heavy intro transition with a cleaner PPT/Keynote-style slide deck transition into the main homepage.

**Architecture:** Keep the existing Astro + React + anime.js structure. `IntroOpeningHero.tsx` remains responsible for trigger handling and transition state; CSS in `effects.css` owns the slide visual, main-view pre-positioning, edge highlight, and reduced-motion behavior.

**Tech Stack:** Astro, React, anime.js, CSS transforms/transitions, Playwright, Vitest.

---

## File Structure

- Modify `src/components/hero/IntroOpeningHero.tsx`: remove particle canvas state and animation, switch transition metadata to `slide-deck-morph`, and drive intro/main slide animations with anime.js.
- Modify `src/styles/effects.css`: remove particle CSS and add deck-slide states for intro shrink/fade, main-view slide-in, and a bright page-edge sweep.
- Modify `tests/e2e/site.spec.ts`: replace particle assertions with slide transition assertions.
- Modify `tests/style-architecture.test.ts`: assert the new transition marker and absence of particle/streak layers.

---

### Task 1: Replace Particle Transition State With Slide Deck State

**Files:**
- Modify: `src/components/hero/IntroOpeningHero.tsx`
- Test: `tests/style-architecture.test.ts`

- [ ] **Step 1: Update the style architecture test first**

Replace the intro transition assertions in `tests/style-architecture.test.ts` with:

```ts
expect(introHero).toContain('data-transition-visual="slide-deck-morph"');
expect(introHero).toContain("data-slide-transition-edge");
expect(introHero).not.toContain("data-intro-particle-transition");
expect(introHero).not.toContain("TransitionParticle");
expect(effectsCss).toContain(".slide-transition-edge");
expect(effectsCss).not.toContain(".intro-particle-transition");
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npm test -- tests/style-architecture.test.ts
```

Expected: FAIL because `IntroOpeningHero.tsx` still contains `particle-dissolve-wipe` and particle canvas code.

- [ ] **Step 3: Remove particle-only code from `IntroOpeningHero.tsx`**

Delete these declarations and hooks:

```ts
type ParticleTransitionState = "idle" | "running" | "done";
type TransitionParticle = { ... };
const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
const particleFrameRef = useRef<number | null>(null);
const [particleState, setParticleState] = useState<ParticleTransitionState>("idle");
const [particleCount, setParticleCount] = useState(0);
const stopParticleTransition = useCallback(...);
const runParticleTransition = useCallback(...);
```

Also remove calls to `stopParticleTransition()`, `setParticleState(...)`, `setParticleCount(...)`, and `runParticleTransition()`.

- [ ] **Step 4: Add deck transition marker and edge element**

Set the section attribute to:

```tsx
data-transition-visual="slide-deck-morph"
```

Remove the particle canvas JSX and add this immediately after the WebGL canvas:

```tsx
<div className="slide-transition-edge" aria-hidden="true" data-slide-transition-edge />
```

- [ ] **Step 5: Run focused test again**

Run:

```bash
npm test -- tests/style-architecture.test.ts
```

Expected: PASS after Task 2 CSS is also completed; if it still fails for missing CSS, continue to Task 2.

---

### Task 2: Implement PPT/Keynote Slide Animation

**Files:**
- Modify: `src/components/hero/IntroOpeningHero.tsx`
- Modify: `src/styles/effects.css`

- [ ] **Step 1: Change `enterMainView` anime sequence**

Replace the current particle and shape-heavy leaving animation with:

```ts
if (!reduceMotion && section) {
  anime({
    targets: section,
    duration: 1120,
    easing: "easeInOutCubic",
    scale: [1, 0.92],
    translateY: ["0vh", "-18vh"],
    opacity: [1, 0.14],
    complete: () => {
      window.__stopWebglFluidBackground?.();
      section.style.visibility = "hidden";
    }
  });

  anime({
    targets: "#main-view",
    duration: 1120,
    easing: "easeOutQuart",
    translateY: ["100vh", "0vh"],
    scale: [1.035, 1],
    opacity: [0, 1]
  });

  return;
}
```

Keep the reduced-motion fallback:

```ts
if (section) section.style.transform = "translateY(-200vh)";
window.__stopWebglFluidBackground?.();
```

- [ ] **Step 2: Remove old shape morph dependency**

Delete the unused `shapeTargetPath`, `shapeRef`, and `pathRef` animation calls if they are no longer needed. Keep the SVG curtain only if it remains a static subtle edge layer; otherwise remove `.shape-wrap` entirely.

- [ ] **Step 3: Add deck slide CSS**

Add or replace the relevant `effects.css` rules with:

```css
.content-intro {
  z-index: 100;
  height: 100vh;
  overflow: hidden;
  background: transparent;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}

.slide-transition-edge {
  position: absolute;
  left: -12%;
  right: -12%;
  bottom: -18px;
  z-index: 5;
  height: 42px;
  opacity: 0;
  background:
    linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.82), rgba(116, 229, 246, 0.72), transparent),
    radial-gradient(ellipse at center, rgba(116, 229, 246, 0.42), transparent 68%);
  filter: blur(0.4px) drop-shadow(0 0 18px rgba(116, 229, 246, 0.42));
  pointer-events: none;
  transform: translateY(72px) scaleX(0.72);
}

.content-intro.is-leaving .slide-transition-edge {
  animation: slide-edge-sweep 1120ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

#main-view {
  transform: translateY(100vh) scale(1.035);
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}

html[data-main-view="active"] #main-view {
  transform: translateY(0) scale(1);
}

@keyframes slide-edge-sweep {
  0% {
    opacity: 0;
    transform: translateY(72px) scaleX(0.72);
  }

  22% {
    opacity: 1;
  }

  72% {
    opacity: 0.82;
    transform: translateY(-16px) scaleX(1);
  }

  100% {
    opacity: 0;
    transform: translateY(-42px) scaleX(1.04);
  }
}
```

- [ ] **Step 4: Keep fluid canvas unobscured**

Verify `effects.css` still contains:

```css
#background {
  z-index: -1;
}
```

Verify it still does not contain:

```css
.content-inner::before
```

---

### Task 3: Update E2E Transition Assertions

**Files:**
- Modify: `tests/e2e/site.spec.ts`

- [ ] **Step 1: Replace intro marker assertions**

Change:

```ts
await expect(hero).toHaveAttribute("data-transition-visual", "particle-dissolve-wipe");
```

to:

```ts
await expect(hero).toHaveAttribute("data-transition-visual", "slide-deck-morph");
```

- [ ] **Step 2: Replace particle canvas assertions**

Remove checks for:

```ts
const particleCanvas = hero.locator("[data-intro-particle-transition]");
```

Add:

```ts
const slideEdge = hero.locator("[data-slide-transition-edge]");
await expect(slideEdge).toBeAttached();
await expect(hero.locator("[data-intro-particle-transition]")).toHaveCount(0);
```

- [ ] **Step 3: Verify main view slide-in trigger**

After pressing Enter or scrolling, assert:

```ts
await expect(page.locator("html")).toHaveAttribute("data-main-view", "active");
await expect(hero).toHaveClass(/is-leaving/);
await expect(slideEdge).toBeAttached();
await expect(mainView).toHaveCSS("visibility", "visible");
await expect(mainView).toHaveCSS("opacity", "1");
```

- [ ] **Step 4: Update reduced-motion assertions**

In the reduced-motion test, remove particle state checks and assert:

```ts
await expect(hero.locator("[data-slide-transition-edge]")).toBeAttached();
await expect(hero.locator("[data-intro-particle-transition]")).toHaveCount(0);
await expect(mainView).toHaveCSS("visibility", "visible");
```

- [ ] **Step 5: Run e2e and fix timing if needed**

Run:

```bash
npm run test:e2e
```

Expected: all 18 Playwright tests pass. If an assertion reads transition state too early, use `expect.poll` around computed transform or visibility.

---

### Task 4: Visual Verification

**Files:**
- No source files unless screenshots reveal a defect.

- [ ] **Step 1: Build and start preview**

Run:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 5491
```

Expected: preview serves `http://127.0.0.1:5491/Personal_Homepage/`.

- [ ] **Step 2: Capture transition frames**

Use Playwright to capture after pressing Enter at approximately 180ms, 520ms, and 920ms:

```js
await page.goto("http://127.0.0.1:5491/Personal_Homepage/");
await page.waitForTimeout(700);
await page.keyboard.press("Enter");
await page.waitForTimeout(520);
await page.screenshot({ path: "artifacts/slide-deck-transition-520ms.png", fullPage: false });
```

Expected visual:
- 180ms: intro still visible, edge highlight begins near bottom.
- 520ms: main page visibly slides in like the next PPT slide.
- 920ms: main page is settled, intro almost gone.

- [ ] **Step 3: Adjust only timing or easing if needed**

If it feels too slow, change duration from `980` to `860`.
If it feels too abrupt, keep `980` and change `easeOutCubic` to `easeOutQuart` for the main view.

---

### Task 5: Final Verification and Push

**Files:**
- Modified files from Tasks 1-3 only.

- [ ] **Step 1: Run full validation**

Run:

```bash
npm test
npm run build
npm run test:e2e
```

Expected:
- Vitest passes.
- Astro check reports `0 errors / 0 warnings / 0 hints`.
- Playwright reports all tests passed.

- [ ] **Step 2: Review git scope**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Expected: only `IntroOpeningHero.tsx`, `effects.css`, `site.spec.ts`, `style-architecture.test.ts`, and this plan document are modified. Screenshot artifacts must not be staged.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/components/hero/IntroOpeningHero.tsx src/styles/effects.css tests/e2e/site.spec.ts tests/style-architecture.test.ts docs/superpowers/plans/2026-07-09-slide-deck-transition.md
git commit -m "Refine intro slide transition"
```

- [ ] **Step 4: Push to main**

Because this repository should always publish to main for requested pushes, run:

```bash
git fetch origin main
git rev-list --left-right --count HEAD...origin/main
git push origin HEAD:main
git fetch origin main
git rev-list --left-right --count HEAD...origin/main
```

Expected final divergence: `0 0`.

---

## Self-Review

- Spec coverage: The plan replaces particle flow with PPT-style slide transition, preserves WebGL intro, preserves main go background, preserves reduced-motion behavior, and updates tests.
- Placeholder scan: No placeholder steps remain.
- Type consistency: The new public marker is consistently named `slide-deck-morph`; the edge element is consistently named `data-slide-transition-edge` and `.slide-transition-edge`.
