import type { RenderQuality } from "@/components/hero/renderQuality";

export type FluidTransitionPhase = "idle" | "surge" | "vortex" | "absorb" | "reveal" | "done";

export const FLUID_TRANSITION_DURATION = 2800;
export const FLUID_REFERENCE_IDLE_CADENCE = 0.86;
export const FLUID_AVATAR_REVEAL_START = 0.18;
export const FLUID_AVATAR_REVEAL_END = 0.4;
export const FLUID_TRANSITION_TIMELINE = {
  surgeEnd: 0.14,
  vortexEnd: 0.72,
  absorbEnd: 0.94
} as const;

const injectionCounts: Record<RenderQuality, number> = {
  high: 0,
  balanced: 0,
  low: 0
};

export function getFluidInjectionCount(quality: RenderQuality) {
  return injectionCounts[quality];
}

export function resolveFluidAvatarOpacity(progress: number) {
  const normalized = Math.min(
    1,
    Math.max(0, (progress - FLUID_AVATAR_REVEAL_START) / (FLUID_AVATAR_REVEAL_END - FLUID_AVATAR_REVEAL_START))
  );
  return normalized * normalized * (3 - 2 * normalized);
}

export function resolveFluidTransitionProgress(startTime: number, now: number, duration = FLUID_TRANSITION_DURATION) {
  if (duration <= 0) return 1;
  return Math.min(1, Math.max(0, (now - startTime) / duration));
}

export function resolveFluidTransitionPhase(progress: number): FluidTransitionPhase {
  if (progress >= 1) return "done";
  if (progress >= FLUID_TRANSITION_TIMELINE.absorbEnd) return "reveal";
  if (progress >= FLUID_TRANSITION_TIMELINE.vortexEnd) return "absorb";
  if (progress >= FLUID_TRANSITION_TIMELINE.surgeEnd) return "vortex";
  if (progress > 0) return "surge";
  return "idle";
}
