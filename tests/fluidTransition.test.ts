import { describe, expect, it } from "vitest";
import {
  FLUID_AVATAR_REVEAL_END,
  FLUID_AVATAR_REVEAL_START,
  FLUID_REFERENCE_IDLE_CADENCE,
  FLUID_TERMINAL_CORE_FADE_START,
  FLUID_TERMINAL_MIN_SCALE,
  FLUID_TERMINAL_PULL_END,
  FLUID_TERMINAL_PULL_START,
  FLUID_TRANSITION_DURATION,
  FLUID_TRANSITION_TIMELINE,
  getFluidInjectionCount,
  getInjectedFluidCount,
  resolveFluidAvatarOpacity,
  resolveFluidTerminalCompressionScale,
  resolveFluidTerminalCoreOpacity,
  resolveFluidTerminalPull,
  resolveFluidTransitionPhase,
  resolveFluidTransitionProgress
} from "@/components/hero/fluidTransition";

describe("fluid vortex transition", () => {
  it("compensates for the reference page's frame-bound idle cadence", () => {
    expect(FLUID_REFERENCE_IDLE_CADENCE).toBe(0.86);
  });

  it("uses a continuous surge, vortex, absorption, and reveal timeline", () => {
    expect(FLUID_TRANSITION_TIMELINE).toEqual({ surgeEnd: 0.2, vortexEnd: 0.56, absorbEnd: 0.92 });
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

  it("compresses terminal fluid continuously before fading only the captured core", () => {
    const progressSamples = Array.from({ length: 101 }, (_, index) => index / 100);
    const pullSamples = progressSamples.map(resolveFluidTerminalPull);
    const scaleSamples = progressSamples.map(resolveFluidTerminalCompressionScale);
    const opacitySamples = progressSamples.map(resolveFluidTerminalCoreOpacity);

    expect(FLUID_TERMINAL_PULL_START).toBe(0.74);
    expect(FLUID_TERMINAL_PULL_END).toBe(0.97);
    expect(FLUID_TERMINAL_MIN_SCALE).toBe(0.18);
    expect(FLUID_TERMINAL_CORE_FADE_START).toBe(0.97);
    expect(resolveFluidTerminalPull(FLUID_TERMINAL_PULL_START)).toBe(0);
    expect(resolveFluidTerminalPull(FLUID_TERMINAL_PULL_END)).toBe(1);
    expect(resolveFluidTerminalCompressionScale(FLUID_TERMINAL_PULL_START)).toBe(1);
    expect(resolveFluidTerminalCompressionScale(FLUID_TERMINAL_PULL_END)).toBeCloseTo(FLUID_TERMINAL_MIN_SCALE);
    expect(resolveFluidTerminalCoreOpacity(FLUID_TERMINAL_CORE_FADE_START)).toBe(1);
    expect(resolveFluidTerminalCoreOpacity(1)).toBe(0);
    expect(pullSamples.every((value, index) => index === 0 || value >= pullSamples[index - 1])).toBe(true);
    expect(scaleSamples.every((value, index) => index === 0 || value <= scaleSamples[index - 1])).toBe(true);
    expect(scaleSamples.every((value) => value >= FLUID_TERMINAL_MIN_SCALE && value <= 1)).toBe(true);
    expect(opacitySamples.every((value, index) => index === 0 || value <= opacitySamples[index - 1])).toBe(true);
  });
});
