import { describe, expect, it } from "vitest";
import { getRenderProfile, resolveRenderQuality } from "@/components/hero/renderQuality";

describe("homepage render quality", () => {
  it("uses low quality for mobile and constrained hardware", () => {
    expect(
      resolveRenderQuality({
        width: 390,
        height: 844,
        devicePixelRatio: 2,
        hardwareConcurrency: 8,
        deviceMemory: 8
      })
    ).toBe("low");
    expect(
      resolveRenderQuality({
        width: 1440,
        height: 900,
        devicePixelRatio: 1,
        hardwareConcurrency: 4,
        deviceMemory: 8
      })
    ).toBe("low");
  });

  it("keeps balanced as the regular desktop default", () => {
    expect(
      resolveRenderQuality({
        width: 1440,
        height: 900,
        devicePixelRatio: 1,
        hardwareConcurrency: 8,
        deviceMemory: 8
      })
    ).toBe("balanced");
  });

  it("reserves high quality for capable low-pixel-density displays", () => {
    expect(
      resolveRenderQuality({
        width: 1280,
        height: 720,
        devicePixelRatio: 1,
        hardwareConcurrency: 12,
        deviceMemory: 8
      })
    ).toBe("high");
  });

  it("provides the planned particle and fluid budgets", () => {
    expect(getRenderProfile("high").particleCount).toBe(1600);
    expect(getRenderProfile("balanced").particleCount).toBe(1300);
    expect(getRenderProfile("balanced").fluid.DYE_RESOLUTION).toBe(768);
    expect(getRenderProfile("low").particleCount).toBe(700);
    expect(getRenderProfile("low").fluid.SIM_RESOLUTION).toBe(64);
    expect(getRenderProfile("low").fluid.DYE_RESOLUTION).toBe(384);
  });
});
