import { expect, test } from "@playwright/test";

test("renders the primary navigation and product entry points", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByLabel("动态围棋首页");

  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(hero).toHaveAttribute("data-motion-scene", "holographic-go");
  await expect(page.locator("canvas[aria-label='动态围棋棋盘']")).toBeVisible();
  await expect(page.locator("canvas[aria-label='动态围棋棋盘']")).toHaveAttribute("data-visual", "holographic-go-board");
  await expect(hero.getByRole("link", { name: "Products", exact: true })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByText("G.G. Lab")).toHaveCount(0);
  await expect(page.getByText("AI Learner & Product Builder")).toHaveCount(0);
  await expect(page.getByText("Status: Building")).toHaveCount(0);
  await expect(page.getByText("Ready for the next move.")).toHaveCount(0);

  await hero.getByRole("link", { name: "Products", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/?$/);
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.getByText("AI News System")).toBeVisible();
});

test("renders a static go board for reduced motion users", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hero = page.getByLabel("动态围棋首页");

  await expect(page.locator("canvas[aria-label='动态围棋棋盘']")).toBeVisible();
  await expect(hero.getByRole("link", { name: "Products", exact: true })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
});

test("uses the shared sci-fi go background on content pages", async ({ page }) => {
  for (const path of ["/products", "/projects", "/about", "/contact"]) {
    await page.goto(path);

    await expect(page.locator("[data-scifi-go-background]")).toBeVisible();
    await expect(page.getByText("G.G. Lab")).toHaveCount(0);
    await expect(page.getByText("AI Learner & Product Builder")).toHaveCount(0);
  }
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
