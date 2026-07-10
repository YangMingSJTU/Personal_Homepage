import { describe, expect, it } from "vitest";
import {
  getTaijiPolarity,
  resolveParticlePhase
} from "@/components/hero/particleMorphTransition";

describe("particle morph phases", () => {
  it("reserves a longer middle phase for forming and rotating the Taiji field", () => {
    expect(resolveParticlePhase(0)).toBe("disintegrate");
    expect(resolveParticlePhase(0.29)).toBe("disintegrate");
    expect(resolveParticlePhase(0.3)).toBe("stream");
    expect(resolveParticlePhase(0.69)).toBe("stream");
    expect(resolveParticlePhase(0.7)).toBe("assemble");
    expect(resolveParticlePhase(0.9)).toBe("assemble");
    expect(resolveParticlePhase(0.91)).toBe("settle");
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
});
