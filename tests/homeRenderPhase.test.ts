import { describe, expect, it } from "vitest";
import {
  HANDOFF_PREPARE_PROGRESS,
  PROFILE_REVEAL_PROGRESS,
  getTransitionMilestones
} from "@/lib/homeRenderPhase";

describe("homepage render handoff", () => {
  it("prepares the board before the fluid mask reveals it", () => {
    expect(HANDOFF_PREPARE_PROGRESS).toBe(0.08);
    expect(PROFILE_REVEAL_PROGRESS).toBe(0.76);
    expect(getTransitionMilestones(0.07)).toEqual({ prepareHandoff: false, revealProfile: false });
    expect(getTransitionMilestones(0.08)).toEqual({ prepareHandoff: true, revealProfile: false });
    expect(getTransitionMilestones(0.76)).toEqual({ prepareHandoff: true, revealProfile: true });
  });
});
