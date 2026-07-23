import { describe, expect, it } from "vitest";
import {
  FLUID_AVATAR_REVEAL_END,
  FLUID_AVATAR_REVEAL_START,
  FLUID_REFERENCE_IDLE_CADENCE,
  FLUID_TRANSITION_DURATION,
  FLUID_TRANSITION_TIMELINE,
  getFluidInjectionCount,
  resolveFluidAvatarOpacity,
  resolveFluidTransitionPhase,
  resolveFluidTransitionProgress
} from "@/components/hero/fluidTransition";

describe("fluid vortex transition", () => {
  it("compensates for the reference page's frame-bound idle cadence", () => {
    expect(FLUID_REFERENCE_IDLE_CADENCE).toBe(0.86);
  });

  it("uses a continuous surge, vortex, absorption, and reveal timeline", () => {
    expect(FLUID_TRANSITION_TIMELINE).toEqual({ surgeEnd: 0.14, vortexEnd: 0.72, absorbEnd: 0.94 });
    expect(resolveFluidTransitionPhase(0)).toBe("idle");
    expect(resolveFluidTransitionPhase(0.01)).toBe("surge");
    expect(resolveFluidTransitionPhase(FLUID_TRANSITION_TIMELINE.surgeEnd)).toBe("vortex");
    expect(resolveFluidTransitionPhase(FLUID_TRANSITION_TIMELINE.vortexEnd)).toBe("absorb");
    expect(resolveFluidTransitionPhase(FLUID_TRANSITION_TIMELINE.absorbEnd)).toBe("reveal");
    expect(resolveFluidTransitionPhase(1)).toBe("done");
  });

  it("keeps transition timing tied to wall-clock time", () => {
    expect(resolveFluidTransitionProgress(1000, 1000)).toBe(0);
    expect(resolveFluidTransitionProgress(1000, 2400)).toBe(0.5);
    expect(resolveFluidTransitionProgress(1000, 5000)).toBe(1);
    expect(resolveFluidTransitionProgress(1000, 900)).toBe(0);
    expect(FLUID_TRANSITION_DURATION).toBe(2800);
  });

  it("reuses the existing fluid field without transition splats", () => {
    expect(getFluidInjectionCount("low")).toBe(0);
    expect(getFluidInjectionCount("balanced")).toBe(0);
    expect(getFluidInjectionCount("high")).toBe(0);
  });

  it("reveals the single profile avatar monotonically without overshoot", () => {
    const samples = Array.from({ length: 21 }, (_, index) => resolveFluidAvatarOpacity(index / 20));

    expect(FLUID_AVATAR_REVEAL_START).toBe(0.18);
    expect(FLUID_AVATAR_REVEAL_END).toBe(0.4);
    expect(resolveFluidAvatarOpacity(FLUID_AVATAR_REVEAL_START)).toBe(0);
    expect(resolveFluidAvatarOpacity(FLUID_AVATAR_REVEAL_END)).toBe(1);
    expect(samples.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(samples.every((value, index) => index === 0 || value >= samples[index - 1])).toBe(true);
  });

});
