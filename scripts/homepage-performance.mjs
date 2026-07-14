import { chromium } from "playwright";

const targetUrl = process.env.PERF_URL ?? "http://127.0.0.1:4321/Personal_Homepage/";

try {
  const response = await fetch(targetUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
} catch (error) {
  console.error(`Homepage preview is unavailable at ${targetUrl}. Start it with: npm run preview -- --host 127.0.0.1`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  window.__homepagePerf = { frames: [], longTasks: [] };
  let previousFrame = null;
  const sampleFrame = (timestamp) => {
    if (previousFrame !== null) window.__homepagePerf.frames.push(timestamp - previousFrame);
    previousFrame = timestamp;
    requestAnimationFrame(sampleFrame);
  };
  requestAnimationFrame(sampleFrame);

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__homepagePerf.longTasks.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // Long Task API is not available in every browser mode.
  }

  window.__resetHomepagePerf = () => {
    window.__homepagePerf.frames.length = 0;
    window.__homepagePerf.longTasks.length = 0;
  };
});

function summarize(values) {
  const sorted = [...values.frames].sort((left, right) => left - right);
  const elapsed = values.frames.reduce((sum, value) => sum + value, 0);
  const percentile = (value) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] ?? 0;
  return {
    frames: values.frames.length,
    fps: values.frames.length ? Number((1000 / (elapsed / values.frames.length)).toFixed(1)) : 0,
    p50FrameMs: Number(percentile(0.5).toFixed(1)),
    p95FrameMs: Number(percentile(0.95).toFixed(1)),
    maxFrameMs: Number((sorted.at(-1) ?? 0).toFixed(1)),
    framesOver50Ms: values.frames.filter((value) => value > 50).length,
    longTaskCount: values.longTasks.length,
    longTaskTotalMs: Math.round(values.longTasks.reduce((sum, value) => sum + value, 0))
  };
}

async function resetProbe() {
  await page.evaluate(() => window.__resetHomepagePerf());
}

async function readProbe() {
  return page.evaluate(() => ({
    frames: [...window.__homepagePerf.frames],
    longTasks: [...window.__homepagePerf.longTasks]
  }));
}

await page.goto(targetUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

await resetProbe();
await page.waitForTimeout(1800);
const intro = summarize(await readProbe());

await resetProbe();
const transitionStartedAt = Date.now();
await page.keyboard.press("Enter");
await page.waitForFunction(
  () => document.querySelector("[data-webgl-fluid-background]")?.getAttribute("data-fluid-transition-state") === "done",
  undefined,
  { timeout: 5000 }
);
const transitionDurationMs = Date.now() - transitionStartedAt;
const transition = summarize(await readProbe());

await page.waitForTimeout(120);
await resetProbe();
await page.waitForTimeout(700);
const mainIdle = summarize(await readProbe());

const state = await page.evaluate(() => ({
  quality: document.documentElement.dataset.renderQuality,
  phase: document.documentElement.dataset.homeRenderPhase,
  goRenderState: document.querySelector("[data-interactive-go-background]")?.getAttribute("data-render-state"),
  goFrames: Number(document.querySelector("[data-interactive-go-background]")?.getAttribute("data-render-frame-count") ?? 0),
  fluidState: document.querySelector("[data-webgl-fluid-background]")?.getAttribute("data-fluid-render-state")
}));

console.log(JSON.stringify({ targetUrl, transitionDurationMs, state, intro, transition, mainIdle }, null, 2));
await browser.close();
