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

  it("scales particles while preserving the reference fluid appearance", () => {
    expect(getRenderProfile("high").particleCount).toBe(1600);
    expect(getRenderProfile("balanced").particleCount).toBe(1300);
    expect(getRenderProfile("low").particleCount).toBe(700);

    for (const quality of ["high", "balanced", "low"] as const) {
      const fluid = getRenderProfile(quality).fluid;
      expect(fluid.SIM_RESOLUTION).toBe(128);
      expect(fluid.DYE_RESOLUTION).toBe(1024);
      expect(fluid.PRESSURE_ITERATIONS).toBe(20);
      expect(fluid.BLOOM_ITERATIONS).toBe(8);
      expect(fluid.BLOOM_RESOLUTION).toBe(256);
      expect(fluid.SUNRAYS).toBe(true);
      expect(fluid.SUNRAYS_RESOLUTION).toBe(196);
    }
  });
});
