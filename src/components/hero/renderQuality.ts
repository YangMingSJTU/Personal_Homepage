export type RenderQuality = "high" | "balanced" | "low";

export type RenderCapabilities = {
  width: number;
  height: number;
  devicePixelRatio: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
};

export type RenderProfile = {
  goDprCap: number;
  fluid: {
    PIXEL_RATIO_CAP: number;
    SIM_RESOLUTION: number;
    DYE_RESOLUTION: number;
    PRESSURE_ITERATIONS: number;
    BLOOM_ITERATIONS: number;
    BLOOM_RESOLUTION: number;
    SUNRAYS: boolean;
    SUNRAYS_RESOLUTION: number;
  };
};

export type RuntimeFluidFallback = {
  quality: RenderQuality;
  PRESSURE_ITERATIONS: number;
  BLOOM_ITERATIONS: number;
  SUNRAYS: boolean;
};

export const FLUID_RUNTIME_WARMUP_FRAMES = 12;
export const FLUID_RUNTIME_SAMPLE_FRAMES = 40;
export const FLUID_RUNTIME_MEDIAN_THRESHOLD_MS = 24;
export const FLUID_RUNTIME_P90_THRESHOLD_MS = 42;

const renderProfiles: Record<RenderQuality, RenderProfile> = {
  high: {
    goDprCap: 1.5,
    fluid: {
      PIXEL_RATIO_CAP: 1.5,
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 1024,
      PRESSURE_ITERATIONS: 20,
      BLOOM_ITERATIONS: 8,
      BLOOM_RESOLUTION: 256,
      SUNRAYS: true,
      SUNRAYS_RESOLUTION: 196
    }
  },
  balanced: {
    goDprCap: 1.35,
    fluid: {
      PIXEL_RATIO_CAP: 1.35,
      SIM_RESOLUTION: 96,
      DYE_RESOLUTION: 768,
      PRESSURE_ITERATIONS: 16,
      BLOOM_ITERATIONS: 6,
      BLOOM_RESOLUTION: 192,
      SUNRAYS: true,
      SUNRAYS_RESOLUTION: 128
    }
  },
  low: {
    goDprCap: 1.25,
    fluid: {
      PIXEL_RATIO_CAP: 1.25,
      SIM_RESOLUTION: 64,
      DYE_RESOLUTION: 512,
      PRESSURE_ITERATIONS: 12,
      BLOOM_ITERATIONS: 4,
      BLOOM_RESOLUTION: 128,
      SUNRAYS: false,
      SUNRAYS_RESOLUTION: 96
    }
  }
};

export function resolveRenderQuality({
  width,
  height,
  devicePixelRatio,
  hardwareConcurrency,
  deviceMemory
}: RenderCapabilities): RenderQuality {
  const dpr = Math.max(1, Math.min(devicePixelRatio || 1, 2));
  const effectivePixels = Math.max(1, width) * Math.max(1, height) * dpr * dpr;

  if (
    width < 720 ||
    effectivePixels > 3_200_000 ||
    (hardwareConcurrency !== undefined && hardwareConcurrency <= 4) ||
    (deviceMemory !== undefined && deviceMemory <= 4)
  ) {
    return "low";
  }

  if (
    effectivePixels <= 1_050_000 &&
    dpr <= 1.25 &&
    (hardwareConcurrency ?? 0) >= 8 &&
    (deviceMemory ?? 0) >= 8
  ) {
    return "high";
  }

  return "balanced";
}

export function getRenderProfile(quality: RenderQuality): RenderProfile {
  return renderProfiles[quality];
}

export function getRuntimeFluidFallback(quality: RenderQuality): RuntimeFluidFallback | null {
  if (quality === "low") return null;
  const fallbackQuality: RenderQuality = quality === "high" ? "balanced" : "low";
  const fallback = renderProfiles[fallbackQuality].fluid;
  return {
    quality: fallbackQuality,
    PRESSURE_ITERATIONS: fallback.PRESSURE_ITERATIONS,
    BLOOM_ITERATIONS: fallback.BLOOM_ITERATIONS,
    SUNRAYS: fallback.SUNRAYS
  };
}

function percentile(sortedValues: number[], percentileValue: number) {
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * percentileValue) - 1);
  return sortedValues[Math.max(0, index)] ?? 0;
}

export function shouldDowngradeFluidQuality(frameDurations: number[]) {
  const samples = frameDurations
    .filter((duration) => Number.isFinite(duration) && duration > 0)
    .slice(-FLUID_RUNTIME_SAMPLE_FRAMES)
    .sort((left, right) => left - right);
  if (samples.length < FLUID_RUNTIME_SAMPLE_FRAMES) return false;

  const median = percentile(samples, 0.5);
  const p90 = percentile(samples, 0.9);
  return median > FLUID_RUNTIME_MEDIAN_THRESHOLD_MS || p90 > FLUID_RUNTIME_P90_THRESHOLD_MS;
}
