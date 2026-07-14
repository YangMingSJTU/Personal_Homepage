import type { RenderQuality } from "@/components/hero/renderQuality";

export type HomeRenderPhase = "intro" | "transition" | "handoff" | "main";

export type HomeRenderPhaseDetail = {
  phase: HomeRenderPhase;
  quality: RenderQuality;
};

export const HOME_RENDER_PHASE_EVENT = "personal-homepage:render-phase";
export const HANDOFF_PREPARE_PROGRESS = 0.08;
export const PROFILE_REVEAL_PROGRESS = 0.76;

export function getTransitionMilestones(progress: number) {
  return {
    prepareHandoff: progress >= HANDOFF_PREPARE_PROGRESS,
    revealProfile: progress >= PROFILE_REVEAL_PROGRESS
  };
}

export function setHomeRenderPhase(phase: HomeRenderPhase, quality: RenderQuality) {
  document.documentElement.dataset.homeRenderPhase = phase;
  document.documentElement.dataset.renderQuality = quality;
  window.dispatchEvent(
    new CustomEvent<HomeRenderPhaseDetail>(HOME_RENDER_PHASE_EVENT, {
      detail: { phase, quality }
    })
  );
}

export function getHomeRenderPhase(): HomeRenderPhase {
  const phase = document.documentElement.dataset.homeRenderPhase;
  if (phase === "transition" || phase === "handoff" || phase === "main") return phase;
  return "intro";
}

export function getDocumentRenderQuality(): RenderQuality {
  const quality = document.documentElement.dataset.renderQuality;
  if (quality === "high" || quality === "low") return quality;
  return "balanced";
}
