import { describe, expect, it } from "vitest";
import { resolveParticlePhase } from "@/components/hero/particleMorphTransition";

describe("particle morph phases", () => {
  it("moves through the three-act magnetic-field sequence", () => {
    expect(resolveParticlePhase(0)).toBe("disintegrate");
    expect(resolveParticlePhase(0.25)).toBe("disintegrate");
    expect(resolveParticlePhase(0.26)).toBe("stream");
    expect(resolveParticlePhase(0.57)).toBe("stream");
    expect(resolveParticlePhase(0.58)).toBe("assemble");
    expect(resolveParticlePhase(0.89)).toBe("assemble");
    expect(resolveParticlePhase(0.9)).toBe("settle");
    expect(resolveParticlePhase(0.99)).toBe("settle");
    expect(resolveParticlePhase(1)).toBe("done");
  });
});
