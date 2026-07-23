import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveFluidAvatarOpacity,
  FLUID_REFERENCE_IDLE_CADENCE,
  FLUID_TRANSITION_DURATION,
  FLUID_TRANSITION_TIMELINE,
  getFluidInjectionCount,
  type FluidTransitionPhase
} from "@/components/hero/fluidTransition";
import {
  FLUID_RUNTIME_MEDIAN_THRESHOLD_MS,
  FLUID_RUNTIME_P90_THRESHOLD_MS,
  FLUID_RUNTIME_SAMPLE_FRAMES,
  FLUID_RUNTIME_WARMUP_FRAMES,
  getRenderProfile,
  getRuntimeFluidFallback,
  resolveRenderQuality,
  type RenderQuality
} from "@/components/hero/renderQuality";
import { introQuotes } from "@/data/introQuotes";
import { PROFILE_REVEAL_PROGRESS, getTransitionMilestones, setHomeRenderPhase } from "@/lib/homeRenderPhase";
import { withBase } from "@/lib/sitePath";

declare global {
  interface Window {
    config?: Record<string, unknown>;
    switchPage?: { switched: boolean };
    __stopWebglFluidBackground?: () => void;
    __startWebglFluidTransition?: (options: FluidTransitionOptions) => FluidTransitionController | null;
    __personalFluidScriptLoaded?: boolean;
  }
}

type FluidTransitionOptions = {
  duration: number;
  injectionCount: number;
  sinkPoint: {
    x: number;
    y: number;
  };
  timeline: typeof FLUID_TRANSITION_TIMELINE;
  onProgress?: (progress: number) => void;
  onPhaseChange?: (phase: FluidTransitionPhase) => void;
  onComplete?: () => void;
};

type FluidTransitionController = {
  cancel: () => void;
  duration: number;
  injectionCount: number;
  updateSinkPoint: (sinkPoint: FluidTransitionOptions["sinkPoint"]) => void;
};

const simonAKingFluidConfig = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1024,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1,
  VELOCITY_DISSIPATION: 0.2,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 30,
  SPLAT_RADIUS: 0.25,
  SPLAT_FORCE: 6000,
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  IDLE_SIMULATION_RATE: FLUID_REFERENCE_IDLE_CADENCE,
  PAUSED: false,
  BACK_COLOR: { r: 30, g: 31, b: 33 },
  TRANSPARENT: false,
  BLOOM: true,
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.4,
  BLOOM_THRESHOLD: 0.8,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true,
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1
};

function getFluidConfig(quality: RenderQuality) {
  return {
    ...simonAKingFluidConfig,
    ...getRenderProfile(quality).fluid,
    RENDER_QUALITY: quality,
    RUNTIME_QUALITY_FALLBACK: getRuntimeFluidFallback(quality),
    RUNTIME_QUALITY_WARMUP_FRAMES: FLUID_RUNTIME_WARMUP_FRAMES,
    RUNTIME_QUALITY_SAMPLE_FRAMES: FLUID_RUNTIME_SAMPLE_FRAMES,
    RUNTIME_QUALITY_MEDIAN_THRESHOLD_MS: FLUID_RUNTIME_MEDIAN_THRESHOLD_MS,
    RUNTIME_QUALITY_P90_THRESHOLD_MS: FLUID_RUNTIME_P90_THRESHOLD_MS
  };
}

function getCurrentRenderQuality() {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return resolveRenderQuality({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigatorWithMemory.deviceMemory
  });
}

const introTitle = "YangMing";
const fluidScriptSrc = withBase("/vendor/webgl-fluid-background.js");
const quoteInitialDelayMs = 520;
const quoteHoldMs = 8000;
const quoteCharacterInMs = 520;
const quoteCharacterOutMs = 480;
const quoteInterludeMs = 220;
const quoteSweepWindowMs = 820;
const quoteTransitionMs = quoteSweepWindowMs * 2 + quoteCharacterInMs + quoteCharacterOutMs + quoteInterludeMs;
const quoteInitialRevealMs = quoteSweepWindowMs + quoteCharacterInMs;

type FluidTransitionState = "idle" | "running" | "done";
type QuotePhase = "waiting" | "entering" | "steady" | "transitioning";

interface QuoteState {
  active: string;
  outgoing: string | null;
  phase: QuotePhase;
}

function pickIntroQuote() {
  return introQuotes[Math.floor(Math.random() * introQuotes.length)];
}

function pickNextIntroQuote(currentQuote: string) {
  if (introQuotes.length <= 1) return introQuotes[0] ?? currentQuote;
  const currentIndex = introQuotes.findIndex((quote) => quote === currentQuote);
  const startIndex = currentIndex >= 0 ? currentIndex : Math.floor(Math.random() * introQuotes.length);
  const offset = 1 + Math.floor(Math.random() * (introQuotes.length - 1));
  return introQuotes[(startIndex + offset) % introQuotes.length];
}

function getQuoteCharacterStep(length: number) {
  return length > 1 ? Math.min(42, quoteSweepWindowMs / (length - 1)) : 0;
}

function getQuoteSweepDuration(quote: string) {
  const length = Array.from(quote).length;
  return Math.round(Math.max(0, length - 1) * getQuoteCharacterStep(length));
}

function getQuoteCharacterStyle(index: number, length: number, offset = 0) {
  return {
    "--quote-char-delay": `${Math.round(offset + index * getQuoteCharacterStep(length))}ms`
  } as React.CSSProperties;
}

function renderQuoteCharacters(quote: string, delayOffset = 0) {
  const characters = Array.from(quote);

  return characters.map((letter, index) => (
    <span
      className="intro-quote-char"
      key={`${letter}-${index}`}
      style={getQuoteCharacterStyle(index, characters.length, delayOffset)}
    >
      {letter === " " ? "\u00a0" : letter}
    </span>
  ));
}

function smoothRange(start: number, end: number, value: number) {
  const normalized = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return normalized * normalized * (3 - 2 * normalized);
}

export default function IntroOpeningHero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const fluidTransitionControllerRef = useRef<FluidTransitionController | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const handoffPreparedRef = useRef(false);
  const renderQualityRef = useRef<RenderQuality>("balanced");
  const [quoteState, setQuoteState] = useState<QuoteState>({
    active: introQuotes[0],
    outgoing: null,
    phase: "waiting"
  });
  const [introLoaded, setIntroLoaded] = useState(false);
  const [fluidTransitionState, setFluidTransitionState] = useState<FluidTransitionState>("idle");
  const [fluidTransitionPhase, setFluidTransitionPhase] = useState<FluidTransitionPhase>("idle");
  const [renderQuality, setRenderQuality] = useState<RenderQuality>("balanced");

  const stopFluidTransition = useCallback(() => {
    fluidTransitionControllerRef.current?.cancel();
    fluidTransitionControllerRef.current = null;
  }, []);

  const runFluidTransition = useCallback((mainView: HTMLElement, profileCardInner: HTMLElement | null) => {
    const section = sectionRef.current;
    const startTransition = window.__startWebglFluidTransition;
    if (!section || !startTransition) return false;

    const sourceContent = section.querySelector(".wrap") as HTMLElement | null;
    const sourceFluid = section.querySelector("#background") as HTMLCanvasElement | null;
    const profileCard = document.querySelector("[data-profile-card]") as HTMLElement | null;
    stopFluidTransition();
    if (sourceContent) sourceContent.style.transition = "none";
    if (profileCardInner) {
      profileCardInner.style.animation = "none";
      profileCardInner.style.transition = "none";
      profileCardInner.style.opacity = "1";
      profileCardInner.style.transform = "none";
    }
    if (profileCard) {
      profileCard.dataset.fluidHandoff = "active";
      profileCard.style.setProperty("--fluid-avatar-opacity", "0");
      profileCard.style.setProperty("--fluid-profile-progress", "0");
    }

    const profileAvatar = profileCard?.querySelector(".profile-avatar") as HTMLElement | null;
    const resolveSinkPoint = (): FluidTransitionOptions["sinkPoint"] => {
      const sectionRect = section.getBoundingClientRect();
      const fallbackTarget = {
        x: sectionRect.left + sectionRect.width / 2,
        y: sectionRect.top + sectionRect.height / 2
      };
      const avatarRect = profileAvatar?.getBoundingClientRect();
      const avatarTarget = avatarRect
        ? {
            x: avatarRect.left + avatarRect.width / 2,
            y: avatarRect.top + avatarRect.height / 2
          }
        : fallbackTarget;
      const fluidRect = sourceFluid?.getBoundingClientRect();
      return fluidRect && fluidRect.width > 0 && fluidRect.height > 0
        ? {
            x: Math.min(1, Math.max(0, (avatarTarget.x - fluidRect.left) / fluidRect.width)),
            y: Math.min(1, Math.max(0, 1 - (avatarTarget.y - fluidRect.top) / fluidRect.height))
          }
        : { x: 0.5, y: 0.5 };
    };
    let trackedController: FluidTransitionController | null = null;
    let sinkUpdateFrame: number | null = null;
    const updateTrackedSink = () => {
      sinkUpdateFrame = null;
      trackedController?.updateSinkPoint(resolveSinkPoint());
    };
    const scheduleSinkUpdate = () => {
      if (sinkUpdateFrame !== null) return;
      sinkUpdateFrame = window.requestAnimationFrame(updateTrackedSink);
    };
    const stopSinkTracking = () => {
      if (sinkUpdateFrame !== null) window.cancelAnimationFrame(sinkUpdateFrame);
      sinkUpdateFrame = null;
      window.removeEventListener("resize", scheduleSinkUpdate);
      window.removeEventListener("orientationchange", scheduleSinkUpdate);
    };
    window.addEventListener("resize", scheduleSinkUpdate);
    window.addEventListener("orientationchange", scheduleSinkUpdate);
    setFluidTransitionState("running");
    setFluidTransitionPhase("surge");
    handoffPreparedRef.current = false;
    const controller = startTransition({
      duration: FLUID_TRANSITION_DURATION,
      injectionCount: getFluidInjectionCount(renderQualityRef.current),
      sinkPoint: resolveSinkPoint(),
      timeline: FLUID_TRANSITION_TIMELINE,
      onPhaseChange: setFluidTransitionPhase,
      onProgress: (progress) => {
        const milestones = getTransitionMilestones(progress);
        const sourceDeparture = smoothRange(0.01, 0.16, progress);
        const avatarOpacity = resolveFluidAvatarOpacity(progress);
        const profileProgress = milestones.revealProfile ? smoothRange(PROFILE_REVEAL_PROGRESS, 0.98, progress) : 0;

        if (sourceContent) {
          sourceContent.style.opacity = (1 - sourceDeparture).toFixed(4);
          sourceContent.style.transform = `translate3d(0, ${(-sourceDeparture * 12).toFixed(2)}px, 0) scale(${(
            1 + sourceDeparture * 0.018
          ).toFixed(4)})`;
          sourceContent.style.filter = `blur(${(sourceDeparture * 3).toFixed(2)}px)`;
        }
        if (!handoffPreparedRef.current && milestones.prepareHandoff) {
          handoffPreparedRef.current = true;
          setHomeRenderPhase("handoff", renderQualityRef.current);
        }
        if (profileCard) {
          profileCard.style.setProperty("--fluid-avatar-opacity", avatarOpacity.toFixed(4));
          profileCard.style.setProperty("--fluid-profile-progress", profileProgress.toFixed(4));
        }
      },
      onComplete: () => {
        stopSinkTracking();
        fluidTransitionControllerRef.current = null;
        setFluidTransitionState("done");
        setFluidTransitionPhase("done");
        mainView.style.opacity = "";
        mainView.style.transform = "";
        mainView.style.zIndex = "";
        if (profileCard) {
          profileCard.style.setProperty("--fluid-avatar-opacity", "1");
          profileCard.style.setProperty("--fluid-profile-progress", "1");
        }
        if (profileCardInner) {
          profileCardInner.classList.add("in");
          profileCardInner.style.opacity = "";
          profileCardInner.style.transform = "";
          profileCardInner.style.animation = "";
          profileCardInner.style.transition = "";
        }
        window.__stopWebglFluidBackground?.();
        sourceFluid?.setAttribute("data-fluid-render-state", "stopped");
        setHomeRenderPhase("main", renderQualityRef.current);
        window.requestAnimationFrame(() => {
          if (profileCard) {
            delete profileCard.dataset.fluidHandoff;
            profileCard.style.removeProperty("--fluid-avatar-opacity");
            profileCard.style.removeProperty("--fluid-profile-progress");
          }
          section.style.visibility = "hidden";
        });
      }
    });
    if (!controller) {
      stopSinkTracking();
      if (profileCard) {
        delete profileCard.dataset.fluidHandoff;
        profileCard.style.removeProperty("--fluid-avatar-opacity");
        profileCard.style.removeProperty("--fluid-profile-progress");
      }
      if (profileCardInner) {
        profileCardInner.style.opacity = "";
        profileCardInner.style.transform = "";
      }
      return false;
    }
    trackedController = {
      ...controller,
      cancel() {
        stopSinkTracking();
        controller.cancel();
      }
    };
    fluidTransitionControllerRef.current = trackedController;
    return true;
  }, [stopFluidTransition]);

  const enterMainView = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    window.switchPage = { ...(window.switchPage ?? {}), switched: true };
    const section = sectionRef.current;
    const mainView = document.querySelector("#main-view") as HTMLElement | null;
    const profileCardInner = document.querySelector(".profile-card-inner") as HTMLElement | null;
    if (mainView) {
      mainView.style.transform = "";
      mainView.style.opacity = "";
      mainView.style.zIndex = "";
    }
    setHomeRenderPhase("transition", renderQualityRef.current);
    document.documentElement.dataset.mainView = "active";
    section?.classList.add("is-leaving");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && section && mainView && runFluidTransition(mainView, profileCardInner)) {
      return;
    }

    if (mainView) {
      mainView.style.transform = "";
      mainView.style.opacity = "";
      mainView.style.zIndex = "";
    }
    if (profileCardInner) {
      profileCardInner.classList.add("in");
      profileCardInner.style.opacity = "";
      profileCardInner.style.transform = "";
      profileCardInner.style.animation = "";
      profileCardInner.style.transition = "";
    }
    if (section) section.style.visibility = "hidden";
    setFluidTransitionState("done");
    setFluidTransitionPhase("done");
    window.__stopWebglFluidBackground?.();
    setHomeRenderPhase("main", renderQualityRef.current);
  }, [runFluidTransition]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const quality = getCurrentRenderQuality();
    renderQualityRef.current = quality;
    setRenderQuality(quality);
    setHomeRenderPhase("intro", quality);
    leavingRef.current = false;
    handoffPreparedRef.current = false;
    document.documentElement.removeAttribute("data-main-view");
    const profileCardInner = document.querySelector(".profile-card-inner") as HTMLElement | null;
    profileCardInner?.classList.remove("in");
    if (profileCardInner) {
      profileCardInner.style.opacity = "";
      profileCardInner.style.transform = "";
      profileCardInner.style.animation = "";
      profileCardInner.style.transition = "";
    }
    const mainView = document.querySelector("#main-view") as HTMLElement | null;
    if (mainView) {
      mainView.style.opacity = "";
      mainView.style.transform = "";
      mainView.style.zIndex = "";
    }
    stopFluidTransition();
    setFluidTransitionState("idle");
    setFluidTransitionPhase("idle");
    setQuoteState({ active: pickIntroQuote(), outgoing: null, phase: "waiting" });
    window.config = { ...getFluidConfig(quality), PAUSED: reduceMotion };
    window.switchPage = { switched: false };
    const fadeTimer = window.setTimeout(() => setIntroLoaded(true), 0);
    const quoteTimers = new Set<number>();

    const scheduleQuoteTimer = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        quoteTimers.delete(timer);
        callback();
      }, delay);
      quoteTimers.add(timer);
    };

    const scheduleQuoteRotation = () => {
      scheduleQuoteTimer(() => {
        if (leavingRef.current) return;
        setQuoteState((current) => {
          const nextQuote = pickNextIntroQuote(current.active);
          return reduceMotion
            ? { active: nextQuote, outgoing: null, phase: "steady" }
            : { active: nextQuote, outgoing: current.active, phase: "transitioning" };
        });

        if (reduceMotion) {
          scheduleQuoteRotation();
          return;
        }

        scheduleQuoteTimer(() => {
          if (leavingRef.current) return;
          setQuoteState((current) => ({ ...current, outgoing: null, phase: "steady" }));
          scheduleQuoteRotation();
        }, quoteTransitionMs);
      }, quoteHoldMs);
    };

    scheduleQuoteTimer(() => {
      if (leavingRef.current) return;
      setQuoteState((current) => ({
        ...current,
        phase: reduceMotion ? "steady" : "entering"
      }));
      scheduleQuoteRotation();

      if (!reduceMotion) {
        scheduleQuoteTimer(() => {
          if (leavingRef.current) return;
          setQuoteState((current) =>
            current.phase === "entering" ? { ...current, phase: "steady" } : current
          );
        }, quoteInitialRevealMs);
      }
    }, quoteInitialDelayMs);

    if (!reduceMotion && !window.__personalFluidScriptLoaded) {
      const script = document.createElement("script");
      script.src = fluidScriptSrc;
      script.async = true;
      script.dataset.webglFluidLoader = "true";
      document.body.appendChild(script);
      window.__personalFluidScriptLoaded = true;
    }

    const section = sectionRef.current;
    if (!section) return undefined;
    section.style.opacity = "";
    section.style.transform = "";
    section.style.visibility = "";
    const sourceContent = section.querySelector(".wrap") as HTMLElement | null;
    const sourceFluid = section.querySelector("#background") as HTMLCanvasElement | null;
    sourceFluid?.setAttribute("data-fluid-render-state", reduceMotion ? "paused" : "loading");
    if (sourceContent) {
      sourceContent.style.opacity = "";
      sourceContent.style.transform = "";
      sourceContent.style.filter = "";
      sourceContent.style.transition = "";
    }
    if (sourceFluid) sourceFluid.style.opacity = "";
    const profileCard = document.querySelector("[data-profile-card]") as HTMLElement | null;
    if (profileCard) {
      delete profileCard.dataset.fluidHandoff;
      profileCard.style.removeProperty("--fluid-avatar-opacity");
      profileCard.style.removeProperty("--fluid-profile-progress");
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY <= 20) return;
      event.preventDefault();
      enterMainView();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      enterMainView();
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartYRef.current = null;
      if (startY === null || endY === undefined) return;
      if (startY - endY > 32) enterMainView();
    };

    document.body.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("keydown", handleKeyDown);
    section.addEventListener("touchstart", handleTouchStart, { passive: true });
    section.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.clearTimeout(fadeTimer);
      for (const timer of quoteTimers) window.clearTimeout(timer);
      quoteTimers.clear();
      document.body.removeEventListener("wheel", handleWheel);
      document.removeEventListener("keydown", handleKeyDown);
      section.removeEventListener("touchstart", handleTouchStart);
      section.removeEventListener("touchend", handleTouchEnd);
      window.switchPage = { switched: true };
      stopFluidTransition();
      window.__stopWebglFluidBackground?.();
    };
  }, [enterMainView, stopFluidTransition]);

  return (
    <>
      <section
        ref={sectionRef}
        className="content content-intro"
        aria-label="进入动画"
        data-motion-scene="intro-opening"
        data-transition-visual="clockwise-fluid-vortex-reveal"
        data-render-quality={renderQuality}
      >
        <div className="content-inner">
          <canvas
            id="background"
            aria-label="进入动画背景"
            data-visual="webgl-fluid-opening"
            data-webgl-fluid-background
            data-fluid-quality={renderQuality}
            data-fluid-effective-quality={renderQuality}
            data-fluid-quality-downgraded="false"
            data-fluid-runtime-probe-state={renderQuality === "low" ? "disabled" : "warming"}
            data-fluid-config-source="simonaking-homepage"
            data-fluid-transition-state={fluidTransitionState}
            data-fluid-transition-phase={fluidTransitionPhase}
            data-fluid-transition-model="mixed-source-radius-aware-avatar-sink"
            data-fluid-transition-flow="terminal-spiral-avatar-capture"
            data-fluid-transition-distribution="edge-55-interior-45"
            data-fluid-transition-reveal="density-reveal-uv-compression"
            data-fluid-transition-capture="tangent-damped-core-absorption"
            data-fluid-transition-color="progressive-controlled-palette"
            data-fluid-transition-palette="cyan-violet-gold-white"
            data-fluid-idle-cadence={FLUID_REFERENCE_IDLE_CADENCE}
            data-fluid-transition-duration-ms={FLUID_TRANSITION_DURATION}
            data-fluid-transition-injection-count={getFluidInjectionCount(renderQuality)}
            data-fluid-transition-progress="0.0000"
          />

          <div className={`wrap fade${introLoaded ? " in" : ""}`}>
            <h2 className="content-title">{introTitle}</h2>
            <h3
              className="content-subtitle"
              data-intro-subtitle
              data-original-content={quoteState.active}
              data-outgoing-content={quoteState.outgoing ?? ""}
              data-quote-rotation="left-to-right-sequenced"
              data-quote-phase={quoteState.phase}
              data-quote-visible={quoteState.phase === "waiting" ? "false" : "true"}
              data-quote-hold-ms={quoteHoldMs}
              data-quote-interlude-ms={quoteInterludeMs}
              data-quote-transition-ms={quoteTransitionMs}
              style={
                {
                  "--quote-enter-duration": `${quoteCharacterInMs}ms`,
                  "--quote-exit-duration": `${quoteCharacterOutMs}ms`
                } as React.CSSProperties
              }
              aria-live="polite"
            >
              {quoteState.outgoing ? (
                <span
                  className="intro-quote-layer is-outgoing is-exiting"
                  data-outgoing-quote
                  aria-hidden="true"
                >
                  {renderQuoteCharacters(quoteState.outgoing)}
                </span>
              ) : null}
              <span
                className={`intro-quote-layer ${
                  quoteState.phase === "waiting"
                    ? "is-waiting"
                    : quoteState.phase === "steady"
                      ? "is-steady"
                      : "is-entering"
                }`}
                data-active-quote
                key={quoteState.active}
              >
                {renderQuoteCharacters(
                  quoteState.active,
                  quoteState.phase === "transitioning" && quoteState.outgoing
                    ? getQuoteSweepDuration(quoteState.outgoing) + quoteCharacterOutMs + quoteInterludeMs
                    : 0
                )}
              </span>
            </h3>
            <div className="arrow arrow-1" aria-hidden="true" onMouseEnter={enterMainView} />
            <div className="arrow arrow-2" aria-hidden="true" onMouseEnter={enterMainView} />
          </div>
        </div>
      </section>
    </>
  );
}
