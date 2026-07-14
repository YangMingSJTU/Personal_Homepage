import { describe, expect, it } from "vitest";
import {
  FLUID_RUNTIME_SAMPLE_FRAMES,
  getRenderProfile,
  getRuntimeFluidFallback,
  resolveRenderQuality,
  shouldDowngradeFluidQuality
} from "@/components/hero/renderQuality";

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

  it("scales the complete fluid pipeline by quality", () => {
    expect(getRenderProfile("high").fluid).toMatchObject({
      PIXEL_RATIO_CAP: 1.5,
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 1024,
      PRESSURE_ITERATIONS: 20,
      BLOOM_ITERATIONS: 8,
      BLOOM_RESOLUTION: 256,
      SUNRAYS: true,
      SUNRAYS_RESOLUTION: 196
    });
    expect(getRenderProfile("balanced").fluid).toMatchObject({
      PIXEL_RATIO_CAP: 1.35,
      SIM_RESOLUTION: 96,
      DYE_RESOLUTION: 768,
      PRESSURE_ITERATIONS: 16,
      BLOOM_ITERATIONS: 6,
      BLOOM_RESOLUTION: 192,
      SUNRAYS: true,
      SUNRAYS_RESOLUTION: 128
    });
    expect(getRenderProfile("low").fluid).toMatchObject({
      PIXEL_RATIO_CAP: 1.25,
      SIM_RESOLUTION: 64,
      DYE_RESOLUTION: 512,
      PRESSURE_ITERATIONS: 12,
      BLOOM_ITERATIONS: 4,
      BLOOM_RESOLUTION: 128,
      SUNRAYS: false,
      SUNRAYS_RESOLUTION: 96
    });
  });

  it("offers at most one lower-cost runtime profile", () => {
    expect(getRuntimeFluidFallback("high")).toEqual({
      quality: "balanced",
      PRESSURE_ITERATIONS: 16,
      BLOOM_ITERATIONS: 6,
      SUNRAYS: true
    });
    expect(getRuntimeFluidFallback("balanced")).toEqual({
      quality: "low",
      PRESSURE_ITERATIONS: 12,
      BLOOM_ITERATIONS: 4,
      SUNRAYS: false
    });
    expect(getRuntimeFluidFallback("low")).toBeNull();
  });

  it("downgrades only after a complete slow-frame sample", () => {
    expect(shouldDowngradeFluidQuality(Array(FLUID_RUNTIME_SAMPLE_FRAMES - 1).fill(60))).toBe(false);
    expect(shouldDowngradeFluidQuality(Array(FLUID_RUNTIME_SAMPLE_FRAMES).fill(16.7))).toBe(false);
    expect(shouldDowngradeFluidQuality(Array(FLUID_RUNTIME_SAMPLE_FRAMES).fill(25))).toBe(true);
    expect(
      shouldDowngradeFluidQuality([
        ...Array(FLUID_RUNTIME_SAMPLE_FRAMES - 5).fill(16.7),
        ...Array(5).fill(50)
      ])
    ).toBe(true);
  });
});
