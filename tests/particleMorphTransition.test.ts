import { describe, expect, it } from "vitest";
import {
  getTaijiOrbitPoint,
  resolveParticlePhase
} from "@/components/hero/particleMorphTransition";

describe("particle morph phases", () => {
  it("reserves a longer middle phase for the counter-rotating flow", () => {
    expect(resolveParticlePhase(0)).toBe("disintegrate");
    expect(resolveParticlePhase(0.23)).toBe("disintegrate");
    expect(resolveParticlePhase(0.24)).toBe("stream");
    expect(resolveParticlePhase(0.63)).toBe("stream");
    expect(resolveParticlePhase(0.64)).toBe("assemble");
    expect(resolveParticlePhase(0.89)).toBe("assemble");
    expect(resolveParticlePhase(0.9)).toBe("settle");
    expect(resolveParticlePhase(0.99)).toBe("settle");
    expect(resolveParticlePhase(1)).toBe("done");
  });

  it("places the two polarities on mirrored counter-rotating arcs", () => {
    const sweep = Math.PI * 1.08;
    const lightStart = getTaijiOrbitPoint(100, 100, 60, 40, 1, 0, sweep);
    const darkStart = getTaijiOrbitPoint(100, 100, 60, 40, -1, 0, sweep);
    const lightMiddle = getTaijiOrbitPoint(100, 100, 60, 40, 1, 0.5, sweep);
    const darkMiddle = getTaijiOrbitPoint(100, 100, 60, 40, -1, 0.5, sweep);

    expect(lightStart.x).toBeCloseTo(darkStart.x, 5);
    expect(lightStart.y).toBeLessThan(100);
    expect(darkStart.y).toBeGreaterThan(100);
    expect(lightMiddle.x).toBeCloseTo(darkMiddle.x, 5);
    expect(lightMiddle.y - 100).toBeCloseTo(-(darkMiddle.y - 100), 5);
  });
});
