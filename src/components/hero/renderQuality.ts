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
  low: {
    goDprCap: 1.25,
    fluid: {
      PIXEL_RATIO_CAP: 1.25,
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 1024,
      PRESSURE_ITERATIONS: 20,
      BLOOM_ITERATIONS: 8,
      BLOOM_RESOLUTION: 256,
      SUNRAYS: true,
      SUNRAYS_RESOLUTION: 196
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
