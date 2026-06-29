import { expect, test } from "@playwright/test";

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
  await expect(hero.locator("[data-intro-subtitle] span")).toHaveCount("Projects / About / Contact".length);
  await expect(hero.getByRole("link", { name: "进入主视图" })).toBeVisible();
  await expect(hero.locator(".arrow.arrow-1")).toBeVisible();
  await expect(hero.locator(".arrow.arrow-2")).toBeVisible();
  await expect(hero.locator(".shape-wrap svg.shape path")).toHaveAttribute("d", /^M -44,-50/);
  await expect(hero.locator("canvas[aria-label='动态围棋棋盘']")).toHaveCount(0);
  await expect(page.locator("#main-view [data-scifi-go-background]")).toBeVisible();
  await expect(page.getByText("G.G. Lab")).toHaveCount(0);
  await expect(page.getByText("AI Learner & Product Builder")).toHaveCount(0);
  await expect(page.getByText("Status: Building")).toHaveCount(0);
  await expect(page.getByText("Ready for the next move.")).toHaveCount(0);

  await page.getByRole("link", { name: "进入主视图" }).click();
  const profileCard = page.locator("[data-profile-card]");
  await expect(profileCard).toBeInViewport();
  await expect(profileCard.getByRole("heading", { name: "Personal Homepage" })).toBeVisible();
  await expect(profileCard.getByText("Projects / About / Contact")).toBeVisible();
  await expect(profileCard.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await expect(profileCard.getByRole("link", { name: "About", exact: true })).toBeVisible();
  await expect(profileCard.getByRole("link", { name: "Contact", exact: true })).toBeVisible();
  await expect(profileCard.getByRole("link", { name: "GitHub", exact: true })).toBeVisible();
});

test("renders a static intro and go-backed main view for reduced motion users", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hero = page.locator('[data-motion-scene="intro-opening"]');

  await expect(hero.locator("canvas[aria-label='进入动画背景']")).toBeVisible();
  await expect(hero.locator("canvas[aria-label='进入动画背景']")).toHaveAttribute("data-visual", "webgl-fluid-opening");
  await expect(hero.locator("canvas[aria-label='动态围棋棋盘']")).toHaveCount(0);
  await expect(page.locator("#main-view [data-scifi-go-background]")).toBeVisible();
});

test("enters the go-backed main view from the fluid opening", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator('[data-motion-scene="intro-opening"]');

  await page.getByRole("link", { name: "进入主视图" }).click();

  await expect(hero).toHaveClass(/is-leaving/);
  await expect(page.locator("#main-view")).toBeInViewport();
  await expect(page.locator("#main-view [data-scifi-go-background]")).toBeVisible();
});

test("uses the shared sci-fi go background on public content pages", async ({ page }) => {
  for (const path of ["/projects", "/about", "/contact"]) {
    await page.goto(path);

    await expect(page.locator("[data-scifi-go-background]")).toBeVisible();
    await expect(page.getByText("G.G. Lab")).toHaveCount(0);
    await expect(page.getByText("AI Learner & Product Builder")).toHaveCount(0);
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
});
