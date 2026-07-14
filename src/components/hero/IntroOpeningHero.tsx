import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FLUID_TRANSITION_DURATION,
  FLUID_TRANSITION_TIMELINE,
  getFluidInjectionCount,
  type FluidTransitionPhase
} from "@/components/hero/fluidTransition";
import {
  getRenderProfile,
  resolveRenderQuality,
  type RenderQuality
} from "@/components/hero/renderQuality";
import { introQuotes } from "@/data/introQuotes";
import { getTransitionMilestones, setHomeRenderPhase } from "@/lib/homeRenderPhase";
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
  timeline: typeof FLUID_TRANSITION_TIMELINE;
  onProgress?: (progress: number) => void;
  onPhaseChange?: (phase: FluidTransitionPhase) => void;
  onComplete?: () => void;
};

type FluidTransitionController = {
  cancel: () => void;
  duration: number;
  injectionCount: number;
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
    PIXEL_RATIO_CAP: getRenderProfile(quality).fluid.PIXEL_RATIO_CAP
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

interface IntroOpeningHeroProps {
  avatarSrc?: string;
}

export default function IntroOpeningHero({ avatarSrc }: IntroOpeningHeroProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const fluidCoreRef = useRef<HTMLDivElement | null>(null);
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
    const profileAvatar = profileCard?.querySelector(".profile-avatar") as HTMLElement | null;
    const fluidCore = fluidCoreRef.current;
    const sectionRect = section.getBoundingClientRect();
    const coreStart = {
      x: sectionRect.width / 2,
      y: sectionRect.height / 2
    };
    const avatarRect = profileAvatar?.getBoundingClientRect();
    const coreTarget = avatarRect
      ? {
          x: avatarRect.left + avatarRect.width / 2,
          y: avatarRect.top + avatarRect.height / 2
        }
      : coreStart;

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
      profileCard.style.setProperty("--fluid-profile-progress", "0");
    }
    if (fluidCore) {
      fluidCore.style.left = `${coreStart.x}px`;
      fluidCore.style.top = `${coreStart.y}px`;
      fluidCore.style.opacity = "0";
      fluidCore.style.transform = "translate3d(-50%, -50%, 0) scale(0.82)";
    }
    setFluidTransitionState("running");
    setFluidTransitionPhase("surge");
    handoffPreparedRef.current = false;
    const controller = startTransition({
      duration: FLUID_TRANSITION_DURATION,
      injectionCount: getFluidInjectionCount(renderQualityRef.current),
      timeline: FLUID_TRANSITION_TIMELINE,
      onPhaseChange: setFluidTransitionPhase,
      onProgress: (progress) => {
        const milestones = getTransitionMilestones(progress);
        const sourceDeparture = smoothRange(0.01, 0.16, progress);
        const coreArrival = smoothRange(0.12, 0.3, progress);
        const coreDeparture = smoothRange(0.84, 0.99, progress);
        const coreHandoff = smoothRange(0.82, 0.98, progress);
        const profileProgress = milestones.revealProfile ? smoothRange(0.76, 0.98, progress) : 0;

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
          profileCard.style.setProperty("--fluid-profile-progress", profileProgress.toFixed(4));
        }
        if (fluidCore) {
          const opacity = coreArrival * (1 - coreDeparture);
          const scale = 0.82 + coreArrival * 0.18 + Math.sin(progress * Math.PI * 5) * 0.012 * (1 - coreDeparture);
          fluidCore.style.left = `${coreStart.x + (coreTarget.x - coreStart.x) * coreHandoff}px`;
          fluidCore.style.top = `${coreStart.y + (coreTarget.y - coreStart.y) * coreHandoff}px`;
          fluidCore.style.opacity = opacity.toFixed(4);
          fluidCore.style.transform = `translate3d(-50%, -50%, 0) scale(${scale.toFixed(4)})`;
        }
      },
      onComplete: () => {
        setFluidTransitionState("done");
        setFluidTransitionPhase("done");
        mainView.style.opacity = "";
        mainView.style.transform = "";
        mainView.style.zIndex = "";
        if (profileCard) {
          delete profileCard.dataset.fluidHandoff;
          profileCard.style.removeProperty("--fluid-profile-progress");
        }
        if (profileCardInner) {
          profileCardInner.classList.add("in");
          profileCardInner.style.opacity = "";
          profileCardInner.style.transform = "";
          profileCardInner.style.animation = "";
          profileCardInner.style.transition = "";
        }
        if (fluidCore) {
          fluidCore.style.opacity = "0";
          fluidCore.style.transform = "translate3d(-50%, -50%, 0) scale(0.96)";
        }
        window.__stopWebglFluidBackground?.();
        sourceFluid?.setAttribute("data-fluid-render-state", "stopped");
        setHomeRenderPhase("main", renderQualityRef.current);
        window.requestAnimationFrame(() => {
          section.style.visibility = "hidden";
        });
      }
    });
    if (!controller) {
      if (profileCard) {
        delete profileCard.dataset.fluidHandoff;
        profileCard.style.removeProperty("--fluid-profile-progress");
      }
      if (profileCardInner) {
        profileCardInner.style.opacity = "";
        profileCardInner.style.transform = "";
      }
      if (fluidCore) {
        fluidCore.style.opacity = "0";
      }
      return false;
    }
    fluidTransitionControllerRef.current = controller;
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
      profileCard.style.removeProperty("--fluid-profile-progress");
    }
    if (fluidCoreRef.current) {
      fluidCoreRef.current.style.opacity = "";
      fluidCoreRef.current.style.transform = "";
      fluidCoreRef.current.style.left = "";
      fluidCoreRef.current.style.top = "";
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
            data-fluid-config-source="simonaking-homepage"
            data-fluid-transition-state={fluidTransitionState}
            data-fluid-transition-phase={fluidTransitionPhase}
            data-fluid-transition-model="random-surge-clockwise-center-sink"
            data-fluid-transition-duration-ms={FLUID_TRANSITION_DURATION}
            data-fluid-transition-injection-count={getFluidInjectionCount(renderQuality)}
            data-fluid-transition-progress="0.0000"
          />

          {avatarSrc ? (
            <div ref={fluidCoreRef} className="fluid-transition-core" data-fluid-transition-core aria-hidden="true">
              <img src={avatarSrc} alt="" width="112" height="112" decoding="async" />
            </div>
          ) : null}

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
