import type { RenderQuality } from "@/components/hero/renderQuality";

export type FluidTransitionPhase = "idle" | "surge" | "vortex" | "absorb" | "reveal" | "done";

export const FLUID_TRANSITION_DURATION = 2800;
export const FLUID_REFERENCE_IDLE_CADENCE = 0.86;
export const FLUID_AVATAR_REVEAL_START = 0.18;
export const FLUID_AVATAR_REVEAL_END = 0.4;
export const FLUID_TERMINAL_PULL_START = 0.74;
export const FLUID_TERMINAL_PULL_END = 0.97;
export const FLUID_TERMINAL_MIN_SCALE = 0.18;
export const FLUID_TERMINAL_CORE_FADE_START = 0.97;
export const FLUID_TRANSITION_TIMELINE = {
  surgeEnd: 0.2,
  vortexEnd: 0.56,
  absorbEnd: 0.92
} as const;

const injectionCounts: Record<RenderQuality, number> = {
  high: 12,
  balanced: 10,
  low: 8
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

function resolveSmoothRange(start: number, end: number, value: number) {
  const normalized = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return normalized * normalized * (3 - 2 * normalized);
}

export function resolveFluidTerminalPull(progress: number) {
  return resolveSmoothRange(FLUID_TERMINAL_PULL_START, FLUID_TERMINAL_PULL_END, progress);
}

export function resolveFluidTerminalCompressionScale(progress: number) {
  const pull = resolveFluidTerminalPull(progress);
  return FLUID_TERMINAL_MIN_SCALE + (1 - FLUID_TERMINAL_MIN_SCALE) * (1 - pull);
}

export function resolveFluidTerminalCoreOpacity(progress: number) {
  return 1 - resolveSmoothRange(FLUID_TERMINAL_CORE_FADE_START, 1, progress);
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

export function getInjectedFluidCount(progress: number, total: number) {
  if (total <= 0 || progress <= 0) return 0;
  const normalized = Math.min(1, progress / FLUID_TRANSITION_TIMELINE.surgeEnd);
  const eased = normalized * normalized * (3 - 2 * normalized);
  return Math.min(total, Math.floor(eased * total + Number.EPSILON));
}
