import { expect, test, type Locator, type Page } from "@playwright/test";
import { introQuotes } from "../../src/data/introQuotes";

async function getCanvasCenter(canvas: Locator) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2
  };
}

async function getNumericAttribute(locator: Locator, name: string) {
  return Number(await locator.getAttribute(name));
}

async function waitForMainViewSettled(mainView: Locator) {
  await expect
    .poll(() => mainView.evaluate((element) => getComputedStyle(element).transform))
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
}

type ParticlePhaseWindow = Window & {
  __particlePhaseHistory?: string[];
  __particlePhaseObserver?: MutationObserver;
};

async function observeParticlePhases(particleTransition: Locator) {
  await particleTransition.evaluate((element) => {
    const state = window as ParticlePhaseWindow;
    state.__particlePhaseObserver?.disconnect();
    state.__particlePhaseHistory = [element.getAttribute("data-particle-transition-phase") ?? "missing"];
    state.__particlePhaseObserver = new MutationObserver(() => {
      const phase = element.getAttribute("data-particle-transition-phase") ?? "missing";
      if (state.__particlePhaseHistory?.at(-1) !== phase) state.__particlePhaseHistory?.push(phase);
    });
    state.__particlePhaseObserver.observe(element, {
      attributes: true,
      attributeFilter: ["data-particle-transition-phase"]
    });
  });
}

async function readParticlePhases(page: Page) {
  return page.evaluate(() => {
    const state = window as ParticlePhaseWindow;
    state.__particlePhaseObserver?.disconnect();
    return state.__particlePhaseHistory ?? [];
  });
}

type TestPoint = { x: number; y: number };
type PlacementInput = "left" | "right" | "touch";

function getOpenGridCandidates(center: TestPoint, cell: number, isMobile: boolean) {
  const offsets = isMobile
    ? [
        [-3, 4],
        [-2, 4],
        [2, 4],
        [3, 4],
        [-3, 5],
        [3, 5]
      ]
    : [
        [-6, 4],
        [-5, 4],
        [-7, 4],
        [6, 4],
        [7, 4],
        [-6, 5],
        [-5, 5]
      ];

  return offsets.map(([x, y]) => ({ x: center.x + x * cell, y: center.y + y * cell }));
}

async function placeStoneOnOpenCandidate(page: Page, background: Locator, candidates: TestPoint[], input: PlacementInput) {
  for (const point of candidates) {
    if (input === "touch") {
      await page.touchscreen.tap(point.x, point.y);
    } else {
      await page.mouse.click(point.x, point.y, { button: input });
    }

    const lastPlacement = await background.getAttribute("data-last-placement");
    if (lastPlacement === "hit") return point;
  }

  throw new Error("No open go-grid candidate accepted a placement");
}

const githubRepoHref = "https://github.com/YangMingSJTU/Personal_Homepage";
const profileSignature = "Projects / About";
const siteBase = "/Personal_Homepage";
const profileAvatarSrc = `${siteBase}/images/avatar-holy-grail.png`;

function pagePath(path: string) {
  if (path === "/") return `${siteBase}/`;
  return `${siteBase}${path}`;
}

test("renders the fluid opening and profile-card main view", async ({ page }) => {
  await page.goto(pagePath("/"));
  const hero = page.locator('[data-motion-scene="intro-opening"]');
  const mainView = page.locator("#main-view");
  const goBackground = mainView.locator("[data-interactive-go-background]");
  const profileCard = page.locator("[data-profile-card]");
  const profileCardInner = profileCard.locator(".profile-card-inner");

  await expect(page.locator("body > header")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Products", exact: true })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-main-view", "active");
  await expect(hero).toHaveAttribute("data-motion-scene", "intro-opening");
  await expect(hero).toHaveAttribute("data-transition-visual", "ppt-particle-morph");
  await expect(hero.locator(".content-inner > canvas#background[aria-label='进入动画背景']")).toHaveAttribute(
    "data-visual",
    "webgl-fluid-opening"
  );
  await expect(hero.locator(".wrap.fade")).toHaveClass(/in/);
  const introTitle = hero.locator(".content-title");
  await expect(introTitle).toHaveText("YangMing");
  await expect(introTitle).toHaveCSS("text-shadow", "none");
  await expect(introTitle).toHaveCSS("animation-name", "none");
  const introSubtitle = hero.locator("[data-intro-subtitle]");
  await expect(introSubtitle).toBeVisible();
  await expect(introSubtitle).toHaveAttribute("data-quote-rotation", "left-to-right-sequenced");
  await expect(introSubtitle).toHaveAttribute("data-quote-visible", "true");
  await expect(introSubtitle).toHaveAttribute("data-quote-hold-ms", "8000");
  await expect(introSubtitle).toHaveAttribute("data-quote-interlude-ms", "220");
  await expect(introSubtitle).toHaveAttribute("data-quote-transition-ms", "2860");
  await expect(introSubtitle).toHaveAttribute("data-quote-phase", "steady");
  const selectedIntroQuote = await introSubtitle.getAttribute("data-original-content");
  expect(Array.from(introQuotes)).toContain(selectedIntroQuote);
  await expect(hero.locator("[data-active-quote] .intro-quote-char")).toHaveCount(
    Array.from(selectedIntroQuote || "").length
  );
  const titleBox = await introTitle.boundingBox();
  const subtitleBox = await introSubtitle.boundingBox();
  expect(titleBox).not.toBeNull();
  expect(subtitleBox).not.toBeNull();
  const titleSubtitleGap = subtitleBox!.y - (titleBox!.y + titleBox!.height);
  expect(titleSubtitleGap).toBeGreaterThan(test.info().project.name === "mobile" ? 26 : 44);
  const quoteTransition = await introSubtitle.evaluate(
    (element, initialQuote) =>
      new Promise<{
        active: string;
        activeCharacterCount: number;
        outgoing: string;
        outgoingCharacterCount: number;
        outgoingEndMs: number;
        phase: string | null;
        incomingStartMs: number;
      }>((resolve) => {
        const milliseconds = (value: string) => Number.parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
        const readTransition = () => ({
          active: element.getAttribute("data-original-content") ?? "",
          activeCharacterCount: element.querySelectorAll("[data-active-quote] .intro-quote-char").length,
          incomingStartMs: milliseconds(
            getComputedStyle(element.querySelector("[data-active-quote] .intro-quote-char") as Element).animationDelay
          ),
          outgoing: element.getAttribute("data-outgoing-content") ?? "",
          outgoingCharacterCount: element.querySelectorAll("[data-outgoing-quote] .intro-quote-char").length,
          outgoingEndMs: (() => {
            const characters = element.querySelectorAll("[data-outgoing-quote] .intro-quote-char");
            const lastCharacter = characters[characters.length - 1];
            if (!lastCharacter) return 0;
            const style = getComputedStyle(lastCharacter);
            return milliseconds(style.animationDelay) + milliseconds(style.animationDuration);
          })(),
          phase: element.getAttribute("data-quote-phase")
        });
        let observer: MutationObserver;
        const finishWhenTransitioning = () => {
          const current = readTransition();
          if (current.active === initialQuote || current.phase !== "transitioning" || !current.outgoing) return;
          observer.disconnect();
          resolve(current);
        };
        observer = new MutationObserver(finishWhenTransitioning);
        observer.observe(element, { attributes: true, childList: true, subtree: true });
        finishWhenTransitioning();
      }),
    selectedIntroQuote
  );
  expect(Array.from(introQuotes)).toContain(quoteTransition.active);
  expect(quoteTransition.active).not.toBe(selectedIntroQuote);
  expect(quoteTransition.activeCharacterCount).toBe(Array.from(quoteTransition.active).length);
  expect(quoteTransition.outgoing).toBe(selectedIntroQuote);
  expect(quoteTransition.outgoingCharacterCount).toBe(Array.from(quoteTransition.outgoing).length);
  expect(quoteTransition.phase).toBe("transitioning");
  expect(quoteTransition.incomingStartMs - quoteTransition.outgoingEndMs).toBeGreaterThanOrEqual(200);
  expect(quoteTransition.incomingStartMs - quoteTransition.outgoingEndMs).toBeLessThanOrEqual(240);
  await expect(introSubtitle).toHaveAttribute("data-quote-visible", "true");
  await expect(introSubtitle).toHaveAttribute("data-quote-phase", "steady", { timeout: 4000 });
  await expect(hero.locator("[data-outgoing-quote]")).toHaveCount(0);
  await expect(hero.getByRole("link", { name: "进入主视图" })).toHaveCount(0);
  await expect(hero.getByText("ENTER", { exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      hero.locator(".content-inner").evaluate((element) => getComputedStyle(element, "::before").content)
    )
    .toBe("none");
  await expect(hero.locator("#background")).toHaveCSS("z-index", "-1");
  await expect(hero.locator(".arrow.arrow-1")).toBeVisible();
  await expect(hero.locator(".arrow.arrow-2")).toBeVisible();
  const particleFlow = page.locator("[data-intro-particle-transition]");
  await expect(particleFlow).toBeAttached();
  await expect(particleFlow).toHaveAttribute("data-particle-transition-state", "idle");
  await expect(particleFlow).toHaveAttribute("data-particle-transition-phase", "idle");
  await expect(particleFlow).toHaveAttribute("data-particle-transition-model", "abstract-taiji-particle-flow");
  await expect(particleFlow).toHaveAttribute("data-particle-transition-duration-ms", "2100");
  await expect(particleFlow).toHaveAttribute("data-particle-max-frame-step-ms", "64");
  await expect(particleFlow).toHaveAttribute("data-particle-target-order", "grid-avatar-text");
  await expect(particleFlow).toHaveAttribute("data-particle-path", "counter-rotating-dual-flow");
  await expect(particleFlow).toHaveAttribute("data-particle-polarities", "light-dark");
  await expect(particleFlow).toHaveAttribute("data-particle-rotation-degrees", "180-210");
  await expect(particleFlow).toHaveAttribute("data-particle-count", "0");
  await expect(particleFlow).toHaveAttribute("data-particle-source-count", "0");
  await expect(particleFlow).toHaveAttribute("data-particle-target-count", "0");
  await expect(particleFlow).toHaveAttribute("data-particle-flow-direction", "source-to-target");
  await expect(particleFlow).toHaveAttribute("data-particle-mapping", "intro-to-main-anchors");
  await expect(hero.locator("[data-slide-transition-edge]")).toHaveCount(0);
  await expect(hero.locator("[data-shape-main-path]")).toHaveCount(0);
  await expect(hero.locator("[data-shape-streak-primary]")).toHaveCount(0);
  await expect(hero.locator("[data-shape-streak-secondary]")).toHaveCount(0);
  await expect(hero.locator("canvas[aria-label='动态围棋棋盘']")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.scripts).some((script) =>
          script.src.includes("/Personal_Homepage/vendor/webgl-fluid-background.js")
        )
      )
    )
    .toBe(true);
  await expect.poll(() => page.evaluate(() => typeof window.__stopWebglFluidBackground)).toBe("function");
  await expect(page.locator("[data-github-corner]")).toHaveAttribute("href", githubRepoHref);
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
  await expect(mainView).toHaveCSS("visibility", "hidden");
  await expect(mainView).toHaveCSS("opacity", "0");
  await expect(mainView).toHaveCSS("pointer-events", "none");
  await expect(goBackground).not.toBeVisible();
  await expect.poll(() => profileCardInner.evaluate((element) => element.classList.contains("in"))).toBe(false);
  await expect(page.locator("#main-view [data-scifi-go-background]")).toHaveCount(0);
  await expect(page.getByText("G.G. Lab")).toHaveCount(0);
  await expect(page.getByText("AI Learner & Product Builder")).toHaveCount(0);
  await expect(page.getByText("Status: Building")).toHaveCount(0);
  await expect(page.getByText("Ready for the next move.")).toHaveCount(0);

  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-main-view", "active");
  await expect(hero).toHaveClass(/is-leaving/);
  await expect(particleFlow).toHaveAttribute("data-particle-transition-state", "running");
  await expect(particleFlow).toHaveAttribute(
    "data-particle-transition-phase",
    /^(disintegrate|stream|assemble|settle)$/
  );
  await expect(particleFlow).toHaveAttribute("data-particle-count", /^[1-9]\d*$/);
  await expect(particleFlow).toHaveAttribute("data-particle-source-count", /^[1-9]\d*$/);
  await expect(particleFlow).toHaveAttribute("data-particle-target-count", /^[1-9]\d*$/);
  await expect(mainView).toHaveCSS("visibility", "visible");
  await expect(goBackground).toBeVisible();
  await waitForMainViewSettled(mainView);
  await expect(mainView).toHaveCSS("opacity", "1");
  await expect(mainView).toHaveCSS("z-index", "1");
  await expect(particleFlow).toHaveAttribute("data-particle-transition-state", "done");
  await expect(particleFlow).toHaveAttribute("data-particle-transition-phase", "done");
  await expect(particleFlow).toHaveAttribute("data-particle-count", "0");
  await expect.poll(() => profileCardInner.evaluate((element) => element.classList.contains("in"))).toBe(true);
  await expect(profileCard).toBeInViewport();
  await expect(profileCard.getByRole("heading", { name: "Personal Homepage" })).toBeVisible();
  await expect(profileCard.getByText(profileSignature)).toBeVisible();
  await expect(profileCard.locator("img.profile-avatar")).toHaveAttribute("src", profileAvatarSrc);
  await expect(profileCard.locator("img.profile-avatar")).toHaveAttribute("alt", "Holy grail avatar");
  await expect(profileCard.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await expect(profileCard.getByRole("link", { name: "About", exact: true })).toBeVisible();
  await expect(profileCard.getByRole("link", { name: "Contact", exact: true })).toHaveCount(0);
  await expect(profileCard.getByRole("link", { name: "GitHub", exact: true })).toHaveCount(0);
});

test("renders a static intro and go-backed main view for reduced motion users", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(pagePath("/"));
  const hero = page.locator('[data-motion-scene="intro-opening"]');
  const background = page.locator("#main-view [data-interactive-go-background]");
  const mainView = page.locator("#main-view");
  const particleTransition = page.locator("[data-intro-particle-transition]");

  await expect(hero.locator("canvas[aria-label='进入动画背景']")).toBeVisible();
  await expect(hero.locator("canvas[aria-label='进入动画背景']")).toHaveAttribute("data-visual", "webgl-fluid-opening");
  await expect(hero.locator("canvas[aria-label='动态围棋棋盘']")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-main-view", "active");
  await expect(mainView).toHaveCSS("visibility", "hidden");
  await expect(background).not.toBeVisible();
  await expect(background).toHaveAttribute("data-stone-count", /^[1-9]\d*$/);
  await expect(background).toHaveAttribute("data-grid-angle", "0.0000");
  await expect(background).toHaveAttribute("data-placement-effect-count", "0");
  await expect(background).toHaveAttribute("data-user-placement-effect-count", "0");
  await expect(background).toHaveAttribute("data-active-placement-effect-count", "0");
  await expect(background).toHaveAttribute("data-placement-effect-visual", "grid-distortion-wave");
  await expect(background).toHaveAttribute("data-visible-occupancy", /^[0-9]+(\.\d+)?$/);
  await expect(background).toHaveAttribute("data-visible-stone-count", /^[0-9]+$/);
  await expect(background).toHaveAttribute("data-visible-capacity", /^[1-9]\d*$/);
  await expect(background).toHaveAttribute("data-random-placement-mode", /^(normal|throttled|paused)$/);
  await expect(background).toHaveAttribute("data-capture-count", "0");
  await expect(background).toHaveAttribute("data-active-capture-effect-count", "0");
  await expect(background).toHaveAttribute("data-last-captured-color", "none");
  const initialStoneCount = await background.getAttribute("data-stone-count");
  const initialEffectCount = await background.getAttribute("data-placement-effect-count");
  await page.waitForTimeout(1200);
  await expect(background).toHaveAttribute("data-stone-count", initialStoneCount || "");
  await expect(background).toHaveAttribute("data-grid-angle", "0.0000");
  await expect(background).toHaveAttribute("data-placement-effect-count", initialEffectCount || "");
  await expect(background).toHaveAttribute("data-active-placement-effect-count", "0");

  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-main-view", "active");
  await expect(hero).toHaveClass(/is-leaving/);
  await expect(hero.locator("[data-slide-transition-edge]")).toHaveCount(0);
  await expect(particleTransition).toHaveAttribute(
    "data-particle-transition-state",
    "done"
  );
  await expect(particleTransition).toHaveAttribute("data-particle-count", "0");
  await expect(particleTransition).toHaveAttribute("data-particle-source-count", "0");
  await expect(particleTransition).toHaveAttribute("data-particle-target-count", "0");
  await expect(particleTransition).toHaveAttribute("data-particle-transition-phase", "done");
  await expect(mainView).toHaveCSS("visibility", "visible");
  await expect(background).toBeVisible();
  await expect(page.locator("#main-view")).toBeInViewport();
  const canvas = background.locator("canvas[aria-label='交互围棋背景']");
  const center = await getCanvasCenter(canvas);
  const cell = Number(await background.getAttribute("data-cell-size"));
  await placeStoneOnOpenCandidate(
    page,
    background,
    getOpenGridCandidates(center, cell, test.info().project.name === "mobile"),
    test.info().project.name === "mobile" ? "touch" : "left"
  );
  await expect(background).toHaveAttribute("data-last-stone-color", "black");
  await expect(background).toHaveAttribute("data-last-placement", "hit");
  await expect(background).toHaveAttribute("data-placement-effect-count", initialEffectCount || "");
  await expect(background).toHaveAttribute("data-user-placement-effect-count", "0");
  await expect(background).toHaveAttribute("data-active-placement-effect-count", "0");
  await expect(background).toHaveAttribute("data-capture-count", "0");
  await expect(background).toHaveAttribute("data-active-capture-effect-count", "0");
});

test("enters the go-backed main view from the fluid opening", async ({ page }) => {
  await page.goto(pagePath("/"));
  const hero = page.locator('[data-motion-scene="intro-opening"]');
  const background = page.locator("#main-view [data-interactive-go-background]");
  const particleTransition = page.locator("[data-intro-particle-transition]");

  await expect(hero.locator(".wrap.fade")).toHaveClass(/in/);
  await observeParticlePhases(particleTransition);
  if (test.info().project.name === "mobile") {
    await hero.evaluate((element) => {
      const startTouch = new Touch({ identifier: 1, target: element, clientX: 200, clientY: 620 });
      const endTouch = new Touch({ identifier: 1, target: element, clientX: 200, clientY: 520 });
      element.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          changedTouches: [startTouch],
          targetTouches: [startTouch],
          touches: [startTouch]
        })
      );
      element.dispatchEvent(
        new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          changedTouches: [endTouch],
          targetTouches: [],
          touches: []
        })
      );
    });
  } else {
    await page.mouse.wheel(0, 420);
  }

  await expect(page.locator("html")).toHaveAttribute("data-main-view", "active");
  await expect(hero).toHaveClass(/is-leaving/);
  await expect(hero.locator("[data-slide-transition-edge]")).toHaveCount(0);
  await expect(particleTransition).toHaveAttribute(
    "data-particle-transition-state",
    "running"
  );
  await expect(particleTransition).toHaveAttribute(
    "data-particle-flow-direction",
    "source-to-target"
  );
  await expect(particleTransition).toHaveAttribute(
    "data-particle-mapping",
    "intro-to-main-anchors"
  );
  await expect(particleTransition).toHaveAttribute("data-particle-transition-model", "abstract-taiji-particle-flow");
  await expect(particleTransition).toHaveAttribute("data-particle-target-order", "grid-avatar-text");
  await expect(hero.locator("[data-shape-main-path]")).toHaveCount(0);
  await expect(page.locator("#main-view")).toBeInViewport();
  await expect(background).toBeVisible();
  await waitForMainViewSettled(page.locator("#main-view"));
  await expect(particleTransition).toHaveAttribute(
    "data-particle-transition-state",
    "done"
  );
  const phaseHistory = await readParticlePhases(page);
  const phaseIndexes = ["disintegrate", "stream", "assemble", "settle", "done"].map((phase) =>
    phaseHistory.indexOf(phase)
  );
  expect(phaseIndexes.every((index) => index >= 0)).toBe(true);
  expect(phaseIndexes).toEqual([...phaseIndexes].sort((left, right) => left - right));
  const canvas = background.locator("canvas[aria-label='交互围棋背景']");
  await expect(canvas).toHaveAttribute("data-visual", "infinite-go-grid");
  await expect(page.locator("#main-view .scifi-go-board-plane")).toHaveCount(0);
  await expect(background).toHaveAttribute("data-last-placement", "none");
  await expect(background).toHaveAttribute("data-cell-size", /^[1-9]\d*(\.\d+)?$/);
  await expect(background).toHaveAttribute("data-user-stone-count", "0");
  await expect(background).toHaveAttribute("data-grid-angle", "0.0000");
  await expect(background).toHaveAttribute("data-placement-effect-visual", "grid-distortion-wave");
  await expect(background).toHaveAttribute("data-user-placement-effect-count", "0");
  await expect(background).toHaveAttribute("data-visible-occupancy", /^[0-9]+(\.\d+)?$/);
  await expect(background).toHaveAttribute("data-visible-stone-count", /^[0-9]+$/);
  await expect(background).toHaveAttribute("data-visible-capacity", /^[1-9]\d*$/);
  await expect(background).toHaveAttribute("data-random-placement-mode", "normal");
  await expect(background).toHaveAttribute("data-capture-count", "0");
  await expect(background).toHaveAttribute("data-active-capture-effect-count", "0");
  await expect(background).toHaveAttribute("data-last-captured-color", "none");
  const effectCountBeforeRandom = await getNumericAttribute(background, "data-placement-effect-count");
  await expect
    .poll(async () => getNumericAttribute(background, "data-placement-effect-count"))
    .toBeGreaterThan(effectCountBeforeRandom);
  await expect(background).toHaveAttribute("data-grid-angle", "0.0000");

  const center = await getCanvasCenter(canvas);
  const cell = Number(await background.getAttribute("data-cell-size"));
  const openCandidates = getOpenGridCandidates(center, cell, test.info().project.name === "mobile");
  const effectCountBeforeUser = await getNumericAttribute(background, "data-placement-effect-count");
  const userEffectCountBeforeUser = await getNumericAttribute(background, "data-user-placement-effect-count");
  const firstPoint = await placeStoneOnOpenCandidate(
    page,
    background,
    openCandidates,
    test.info().project.name === "mobile" ? "touch" : "left"
  );

  if (test.info().project.name === "mobile") {
    await expect(background).toHaveAttribute("data-last-stone-color", "black");
    await expect(background).toHaveAttribute("data-last-placement", "hit");
    await expect(background).toHaveAttribute("data-last-placement-effect", "black");
    await expect
      .poll(async () => getNumericAttribute(background, "data-placement-effect-count"))
      .toBeGreaterThan(effectCountBeforeUser);
    await expect
      .poll(async () => getNumericAttribute(background, "data-user-placement-effect-count"))
      .toBeGreaterThan(userEffectCountBeforeUser);
  } else {
    await expect(background).toHaveAttribute("data-last-stone-color", "black");
    await expect(background).toHaveAttribute("data-last-placement", "hit");
    await expect(background).toHaveAttribute("data-last-placement-effect", "black");
    await expect
      .poll(async () => getNumericAttribute(background, "data-placement-effect-count"))
      .toBeGreaterThan(effectCountBeforeUser);
    await expect
      .poll(async () => getNumericAttribute(background, "data-user-placement-effect-count"))
      .toBeGreaterThan(userEffectCountBeforeUser);

    const userCountBeforeOccupied = await background.getAttribute("data-user-stone-count");
    const userEffectCountBeforeOccupied = await background.getAttribute("data-user-placement-effect-count");
    await page.mouse.click(firstPoint.x, firstPoint.y, { button: "left" });
    await expect(background).toHaveAttribute("data-last-placement", "occupied");
    await expect(background).toHaveAttribute("data-user-stone-count", userCountBeforeOccupied || "");
    await expect(background).toHaveAttribute("data-user-placement-effect-count", userEffectCountBeforeOccupied || "");

    const effectCountBeforeWhite = await getNumericAttribute(background, "data-placement-effect-count");
    const userEffectCountBeforeWhite = await getNumericAttribute(background, "data-user-placement-effect-count");
    await placeStoneOnOpenCandidate(
      page,
      background,
      openCandidates.filter((point) => point.x !== firstPoint.x || point.y !== firstPoint.y),
      "right"
    );
    await expect(background).toHaveAttribute("data-last-stone-color", "white");
    await expect(background).toHaveAttribute("data-last-placement", "hit");
    await expect(background).toHaveAttribute("data-last-placement-effect", "white");
    await expect
      .poll(async () => getNumericAttribute(background, "data-placement-effect-count"))
      .toBeGreaterThan(effectCountBeforeWhite);
    await expect
      .poll(async () => getNumericAttribute(background, "data-user-placement-effect-count"))
      .toBeGreaterThan(userEffectCountBeforeWhite);

    const captureCountBefore = await getNumericAttribute(background, "data-capture-count");
    const captureX = center.x + cell * 4;
    const captureY = center.y + cell * 4;
    await page.mouse.click(captureX, captureY, { button: "right" });
    await expect(background).toHaveAttribute("data-last-placement", "hit");
    await page.mouse.click(captureX + cell, captureY, { button: "left" });
    await expect(background).toHaveAttribute("data-last-placement", "hit");
    await page.mouse.click(captureX - cell, captureY, { button: "left" });
    await expect(background).toHaveAttribute("data-last-placement", "hit");
    await page.mouse.click(captureX, captureY + cell, { button: "left" });
    await expect(background).toHaveAttribute("data-last-placement", "hit");
    await page.mouse.click(captureX, captureY - cell, { button: "left" });
    await expect(background).toHaveAttribute("data-last-placement", "hit");
    await expect
      .poll(async () => getNumericAttribute(background, "data-capture-count"))
      .toBeGreaterThan(captureCountBefore);
    await expect(background).toHaveAttribute("data-last-captured-color", "white");
    await expect
      .poll(async () => getNumericAttribute(background, "data-active-capture-effect-count"))
      .toBeGreaterThan(0);
  }

  const userCountBeforeMiss = await background.getAttribute("data-user-stone-count");
  const colorBeforeMiss = await background.getAttribute("data-last-stone-color");
  const userEffectCountBeforeMiss = await background.getAttribute("data-user-placement-effect-count");
  if (test.info().project.name === "mobile") {
    await page.waitForTimeout(750);
  }
  await page.mouse.click(firstPoint.x + cell / 2, firstPoint.y, { button: "left" });
  await expect(background).toHaveAttribute("data-last-placement", "miss");
  await expect(background).toHaveAttribute("data-user-stone-count", userCountBeforeMiss || "");
  await expect(background).toHaveAttribute("data-last-stone-color", colorBeforeMiss || "");
  await expect(background).toHaveAttribute("data-user-placement-effect-count", userEffectCountBeforeMiss || "");
});

test("uses a fixed soft-dark visual system", async ({ page }) => {
  await page.goto(pagePath("/"));

  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
});

test("expands the GitHub corner as a real page-corner curl", async ({ page }) => {
  await page.goto(pagePath("/"));
  const corner = page.locator("[data-github-corner]");
  const fold = corner.locator("[data-github-fold]");
  const underlay = corner.locator("[data-github-corner-underlay]");
  const asset = corner.locator("[data-github-curl-asset]");
  const mark = corner.locator("[data-github-corner-mark]");

  await expect(corner).toHaveAttribute("href", githubRepoHref);
  await expect(fold).toBeVisible();
  await expect(underlay).toBeVisible();
  await expect(asset).toBeVisible();
  await expect(mark).toBeVisible();
  await expect(asset).toHaveAttribute("src", /github-page-curl\.png$/);
  await expect(corner.locator("[data-github-corner-label]")).toHaveCount(0);
  await expect(corner.locator("[data-github-corner-paper]")).toHaveCount(0);
  await expect(corner.locator("[data-github-curl-ridge]")).toHaveCount(0);
  await expect(corner.locator("[data-github-curl-sheet]")).toHaveCount(0);
  await expect(corner.locator("[data-github-curl-edge]")).toHaveCount(0);
  await expect(corner).toHaveAttribute("data-corner-style", "asset-page-curl");
  await expect(fold).toHaveAttribute("data-fold-state", "rest");
  const restTransform = await asset.evaluate((element) => getComputedStyle(element).transform);
  const restBox = await fold.boundingBox();
  const restAssetBox = await asset.boundingBox();
  expect(restBox?.width).toBeLessThanOrEqual(40);
  expect(restBox?.height).toBeLessThanOrEqual(40);
  expect(restAssetBox?.width).toBeLessThanOrEqual(40);
  expect(restAssetBox?.height).toBeLessThanOrEqual(40);
  await expect(underlay).toHaveCSS("opacity", "0");
  await expect(mark).toHaveCSS("opacity", "0");

  await corner.hover();
  await expect(fold).toHaveAttribute("data-fold-state", "expanded");
  const expandedBox = await fold.boundingBox();
  const expandedAssetBox = await asset.boundingBox();
  expect(expandedBox?.width).toBeLessThanOrEqual(82);
  expect(expandedBox?.height).toBeLessThanOrEqual(82);
  expect(expandedAssetBox?.width).toBeLessThanOrEqual(82);
  expect(expandedAssetBox?.height).toBeLessThanOrEqual(82);
  expect(expandedBox?.width ?? 0).toBeGreaterThan(restBox?.width ?? 0);
  expect(expandedBox?.height ?? 0).toBeGreaterThan(restBox?.height ?? 0);
  expect(expandedAssetBox?.width ?? 0).toBeGreaterThan(restAssetBox?.width ?? 0);
  expect(expandedAssetBox?.height ?? 0).toBeGreaterThan(restAssetBox?.height ?? 0);
  const expandedTransform = await asset.evaluate((element) => getComputedStyle(element).transform);
  expect(expandedTransform).not.toBe(restTransform);
  const expandedFilter = await asset.evaluate((element) => getComputedStyle(element).filter);
  expect(expandedFilter).not.toContain("drop-shadow");
  await expect(underlay).toHaveCSS("opacity", "0");
  await expect(mark).toHaveCSS("opacity", "1");
  const cornerBox = await corner.boundingBox();
  const markBox = await mark.boundingBox();
  expect(markBox?.x ?? 0).toBeGreaterThanOrEqual(cornerBox?.x ?? 0);
  expect(markBox?.y ?? 0).toBeGreaterThanOrEqual(cornerBox?.y ?? 0);
  expect((markBox?.x ?? 0) + (markBox?.width ?? 0)).toBeLessThanOrEqual((cornerBox?.x ?? 0) + (cornerBox?.width ?? 0));
  expect((markBox?.y ?? 0) + (markBox?.height ?? 0)).toBeLessThanOrEqual((cornerBox?.y ?? 0) + (cornerBox?.height ?? 0));
  expect(markBox?.y ?? 0).toBeLessThanOrEqual((cornerBox?.y ?? 0) + 20);
  expect((markBox?.x ?? 0) + (markBox?.width ?? 0)).toBeGreaterThanOrEqual((cornerBox?.x ?? 0) + (cornerBox?.width ?? 0) - 30);
});

test("uses the shared sci-fi go background on public content pages", async ({ page }) => {
  await page.goto(pagePath("/"));
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");

  for (const path of ["/projects", "/about", "/contact"]) {
    await page.goto(pagePath(path));

    await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");
    await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
    await expect(page.locator("[data-scifi-go-background]")).toBeVisible();
    await expect(page.getByText("G.G. Lab")).toHaveCount(0);
    await expect(page.getByText("AI Learner & Product Builder")).toHaveCount(0);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  }
});

test("does not expose products as a public page", async ({ page }) => {
  const response = await page.goto(pagePath("/products"));

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Products" })).toHaveCount(0);
});

test("keeps mobile layout within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pagePath("/"));

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("contact page exposes a copy email action", async ({ page }) => {
  await page.goto(pagePath("/contact"));

  await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy email/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", githubRepoHref);
});
