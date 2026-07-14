import { describe, expect, it } from "vitest";
import {
  PARTICLE_TRANSITION_DURATION,
  PARTICLE_TRANSITION_TIMELINE,
  getParticleAxis,
  getTaijiPolarity,
  resolveParticlePhase,
  resolveParticleProgress,
  resolveTaijiRotation
} from "@/components/hero/particleMorphTransition";

describe("particle morph phases", () => {
  it("reserves a longer middle phase for forming and rotating the Taiji field", () => {
    expect(resolveParticlePhase(0)).toBe("disintegrate");
    expect(resolveParticlePhase(0.33)).toBe("disintegrate");
    expect(resolveParticlePhase(0.34)).toBe("stream");
    expect(resolveParticlePhase(0.75)).toBe("stream");
    expect(resolveParticlePhase(0.76)).toBe("assemble");
    expect(resolveParticlePhase(0.91)).toBe("assemble");
    expect(resolveParticlePhase(0.92)).toBe("settle");
    expect(resolveParticlePhase(0.99)).toBe("settle");
    expect(resolveParticlePhase(1)).toBe("done");
  });

  it("builds an S-shaped field with opposite-polarity eyes", () => {
    const radius = 100;

    expect(getTaijiPolarity(80, -50, radius)).toBe(1);
    expect(getTaijiPolarity(-30, -50, radius)).toBe(-1);
    expect(getTaijiPolarity(30, 50, radius)).toBe(1);
    expect(getTaijiPolarity(-80, 50, radius)).toBe(-1);
    expect(getTaijiPolarity(0, -50, radius)).toBe(1);
    expect(getTaijiPolarity(0, 50, radius)).toBe(-1);
  });

  it("assigns the light and dark flows to perpendicular viewport axes", () => {
    expect(getParticleAxis(1)).toBe("vertical");
    expect(getParticleAxis(-1)).toBe("horizontal");
  });

  it("uses wall-clock progress without stretching slow frames", () => {
    expect(resolveParticleProgress(1000, 1000, PARTICLE_TRANSITION_DURATION)).toBe(0);
    expect(resolveParticleProgress(1000, 2400, PARTICLE_TRANSITION_DURATION)).toBe(0.5);
    expect(resolveParticleProgress(1000, 5000, PARTICLE_TRANSITION_DURATION)).toBe(1);
    expect(resolveParticleProgress(1000, 900, PARTICLE_TRANSITION_DURATION)).toBe(0);
  });

  it("keeps rotating after formation without a stationary hold", () => {
    const samples = [0.34, 0.44, 0.55, 0.66, 0.76].map(resolveTaijiRotation);

    expect(samples[0]).toBe(0);
    samples.slice(1).forEach((angle, index) => expect(angle).toBeGreaterThan(samples[index]));
    expect(samples.at(-1)).toBeCloseTo(Math.PI * 0.6, 8);
    expect(PARTICLE_TRANSITION_TIMELINE.rotationDegrees).toBe(108);
  });
});
