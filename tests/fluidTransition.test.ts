import { describe, expect, it } from "vitest";
import {
  FLUID_AVATAR_REVEAL_END,
  FLUID_AVATAR_REVEAL_START,
  FLUID_TRANSITION_DURATION,
  FLUID_TRANSITION_TIMELINE,
  getFluidInjectionCount,
  getInjectedFluidCount,
  resolveFluidAvatarOpacity,
  resolveFluidTransitionPhase,
  resolveFluidTransitionProgress
} from "@/components/hero/fluidTransition";

describe("fluid vortex transition", () => {
  it("uses a continuous surge, vortex, absorption, and reveal timeline", () => {
    expect(resolveFluidTransitionPhase(0)).toBe("idle");
    expect(resolveFluidTransitionPhase(0.01)).toBe("surge");
    expect(resolveFluidTransitionPhase(FLUID_TRANSITION_TIMELINE.surgeEnd)).toBe("vortex");
    expect(resolveFluidTransitionPhase(FLUID_TRANSITION_TIMELINE.vortexEnd)).toBe("absorb");
    expect(resolveFluidTransitionPhase(FLUID_TRANSITION_TIMELINE.absorbEnd)).toBe("reveal");
    expect(resolveFluidTransitionPhase(1)).toBe("done");
  });

  it("keeps transition timing tied to wall-clock time", () => {
    expect(resolveFluidTransitionProgress(1000, 1000)).toBe(0);
    expect(resolveFluidTransitionProgress(1000, 2300)).toBe(0.5);
    expect(resolveFluidTransitionProgress(1000, 5000)).toBe(1);
    expect(resolveFluidTransitionProgress(1000, 900)).toBe(0);
    expect(FLUID_TRANSITION_DURATION).toBe(2600);
  });

  it("stages eight to twelve deterministic fluid injections by quality", () => {
    expect(getFluidInjectionCount("low")).toBe(8);
    expect(getFluidInjectionCount("balanced")).toBe(10);
    expect(getFluidInjectionCount("high")).toBe(12);
    expect(getInjectedFluidCount(0, 10)).toBe(0);
    expect(getInjectedFluidCount(FLUID_TRANSITION_TIMELINE.surgeEnd, 10)).toBe(10);
    expect(getInjectedFluidCount(1, 10)).toBe(10);
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
