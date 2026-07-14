import { describe, expect, it } from "vitest";
import {
  FLUID_RELEASE_PROGRESS,
  HANDOFF_PREPARE_PROGRESS,
  getTransitionMilestones
} from "@/lib/homeRenderPhase";

describe("homepage render handoff", () => {
  it("releases WebGL before preparing the go background", () => {
    expect(FLUID_RELEASE_PROGRESS).toBe(0.3);
    expect(HANDOFF_PREPARE_PROGRESS).toBe(0.4);
    expect(getTransitionMilestones(0.29)).toEqual({ releaseFluid: false, prepareHandoff: false });
    expect(getTransitionMilestones(0.3)).toEqual({ releaseFluid: true, prepareHandoff: false });
    expect(getTransitionMilestones(0.4)).toEqual({ releaseFluid: true, prepareHandoff: true });
  });
});
