import { expect, test, type Locator } from "@playwright/test";

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

const githubRepoHref = "https://github.com/YangMingSJTU/Personal_Homepage";
const profileSignature = "Projects / About";
const profileAvatarSrc = "/images/avatar-holy-grail.png";

test("renders the fluid opening and profile-card main view", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator('[data-motion-scene="intro-opening"]');

  await expect(page.locator("body > header")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Products", exact: true })).toHaveCount(0);
  await expect(hero).toHaveAttribute("data-motion-scene", "intro-opening");
  await expect(hero.locator(".content-inner > canvas#background[aria-label='进入动画背景']")).toHaveAttribute(
    "data-visual",
    "webgl-fluid-opening"
  );
  await expect(hero.locator(".wrap.fade")).toHaveClass(/in/);
  await expect(hero.locator(".content-title")).toHaveText("Personal Homepage");
  await expect(hero.locator("[data-intro-subtitle]")).toBeVisible();
  await expect(hero.locator("[data-intro-subtitle] span")).toHaveCount(profileSignature.length);
  await expect(hero.getByRole("link", { name: "进入主视图" })).toBeVisible();
  await expect(hero.locator(".arrow.arrow-1")).toBeVisible();
  await expect(hero.locator(".arrow.arrow-2")).toBeVisible();
  await expect(hero.locator(".shape-wrap svg.shape path")).toHaveAttribute("d", /^M -44,-50/);
  await expect(hero.locator("canvas[aria-label='动态围棋棋盘']")).toHaveCount(0);
  await expect(page.locator("[data-github-corner]")).toHaveAttribute("href", githubRepoHref);
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
  await expect(page.locator("#main-view [data-interactive-go-background]")).toBeVisible();
  await expect(page.locator("#main-view [data-scifi-go-background]")).toHaveCount(0);
  await expect(page.getByText("G.G. Lab")).toHaveCount(0);
  await expect(page.getByText("AI Learner & Product Builder")).toHaveCount(0);
  await expect(page.getByText("Status: Building")).toHaveCount(0);
  await expect(page.getByText("Ready for the next move.")).toHaveCount(0);

  await page.getByRole("link", { name: "进入主视图" }).click();
  const profileCard = page.locator("[data-profile-card]");
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
  await page.goto("/");
  const hero = page.locator('[data-motion-scene="intro-opening"]');
  const background = page.locator("#main-view [data-interactive-go-background]");

  await expect(hero.locator("canvas[aria-label='进入动画背景']")).toBeVisible();
  await expect(hero.locator("canvas[aria-label='进入动画背景']")).toHaveAttribute("data-visual", "webgl-fluid-opening");
  await expect(hero.locator("canvas[aria-label='动态围棋棋盘']")).toHaveCount(0);
  await expect(background).toBeVisible();
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

  await page.getByRole("link", { name: "进入主视图" }).click();
  await expect(page.locator("#main-view")).toBeInViewport();
  const canvas = background.locator("canvas[aria-label='交互围棋背景']");
  const center = await getCanvasCenter(canvas);
  if (test.info().project.name === "mobile") {
    await page.touchscreen.tap(center.x, center.y);
  } else {
    await page.mouse.click(center.x, center.y, { button: "left" });
  }
  await expect(background).toHaveAttribute("data-last-stone-color", "black");
  await expect(background).toHaveAttribute("data-last-placement", "hit");
  await expect(background).toHaveAttribute("data-placement-effect-count", initialEffectCount || "");
  await expect(background).toHaveAttribute("data-user-placement-effect-count", "0");
  await expect(background).toHaveAttribute("data-active-placement-effect-count", "0");
  await expect(background).toHaveAttribute("data-capture-count", "0");
  await expect(background).toHaveAttribute("data-active-capture-effect-count", "0");
});

test("enters the go-backed main view from the fluid opening", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator('[data-motion-scene="intro-opening"]');
  const background = page.locator("#main-view [data-interactive-go-background]");

  await expect(hero.locator(".wrap.fade")).toHaveClass(/in/);
  await page.getByRole("link", { name: "进入主视图" }).click();

  await expect(hero).toHaveClass(/is-leaving/);
  await expect(page.locator("#main-view")).toBeInViewport();
  await expect(background).toBeVisible();
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
  const effectCountBeforeUser = await getNumericAttribute(background, "data-placement-effect-count");
  const userEffectCountBeforeUser = await getNumericAttribute(background, "data-user-placement-effect-count");

  if (test.info().project.name === "mobile") {
    await page.touchscreen.tap(center.x, center.y);
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
    await page.mouse.click(center.x, center.y, { button: "left" });
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
    await page.mouse.click(center.x, center.y, { button: "left" });
    await expect(background).toHaveAttribute("data-last-placement", "occupied");
    await expect(background).toHaveAttribute("data-user-stone-count", userCountBeforeOccupied || "");
    await expect(background).toHaveAttribute("data-user-placement-effect-count", userEffectCountBeforeOccupied || "");

    const cell = Number(await background.getAttribute("data-cell-size"));
    const effectCountBeforeWhite = await getNumericAttribute(background, "data-placement-effect-count");
    const userEffectCountBeforeWhite = await getNumericAttribute(background, "data-user-placement-effect-count");
    await page.mouse.click(center.x + cell, center.y, { button: "right" });
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

  const cell = Number(await background.getAttribute("data-cell-size"));
  const userCountBeforeMiss = await background.getAttribute("data-user-stone-count");
  const colorBeforeMiss = await background.getAttribute("data-last-stone-color");
  const userEffectCountBeforeMiss = await background.getAttribute("data-user-placement-effect-count");
  if (test.info().project.name === "mobile") {
    await page.waitForTimeout(750);
  }
  await page.mouse.click(center.x + cell / 2, center.y, { button: "left" });
  await expect(background).toHaveAttribute("data-last-placement", "miss");
  await expect(background).toHaveAttribute("data-user-stone-count", userCountBeforeMiss || "");
  await expect(background).toHaveAttribute("data-last-stone-color", colorBeforeMiss || "");
  await expect(background).toHaveAttribute("data-user-placement-effect-count", userEffectCountBeforeMiss || "");
});

test("uses a fixed soft-dark visual system", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
});

test("expands the GitHub corner like a holographic fold", async ({ page }) => {
  await page.goto("/");
  const corner = page.locator("[data-github-corner]");
  const fold = corner.locator("[data-github-fold]");
  const edge = corner.locator("[data-github-fold-edge]");

  await expect(corner).toHaveAttribute("href", githubRepoHref);
  await expect(fold).toBeVisible();
  await expect(edge).toBeVisible();
  await expect(corner).toHaveAttribute("data-corner-style", "holographic-fold");
  await expect(fold).toHaveAttribute("data-fold-state", "rest");

  await corner.hover();
  await expect(fold).toHaveAttribute("data-fold-state", "expanded");
});

test("uses the shared sci-fi go background on public content pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "soft-dark");

  for (const path of ["/projects", "/about", "/contact"]) {
    await page.goto(path);

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
  const response = await page.goto("/products");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Products" })).toHaveCount(0);
});

test("keeps mobile layout within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("contact page exposes a copy email action", async ({ page }) => {
  await page.goto("/contact");

  await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy email/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", githubRepoHref);
});
