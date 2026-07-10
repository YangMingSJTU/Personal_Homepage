import React, { useCallback, useEffect, useRef, useState } from "react";
import { startPptParticleMorph } from "@/components/hero/particleMorphTransition";
import { introQuotes } from "@/data/introQuotes";
import { withBase } from "@/lib/sitePath";

declare global {
  interface Window {
    config?: Record<string, unknown>;
    switchPage?: { switched: boolean };
    __stopWebglFluidBackground?: () => void;
    __personalFluidScriptLoaded?: boolean;
  }
}

const fluidConfig = {
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

const introTitle = "YangMing";
const fluidScriptSrc = withBase("/vendor/webgl-fluid-background.js");

type ParticleTransitionState = "idle" | "running" | "done";

function pickIntroQuote() {
  return introQuotes[Math.floor(Math.random() * introQuotes.length)];
}

function smoothRange(start: number, end: number, value: number) {
  const normalized = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return normalized * normalized * (3 - 2 * normalized);
}

export default function IntroOpeningHero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleControllerRef = useRef<ReturnType<typeof startPptParticleMorph> | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const [selectedQuote, setSelectedQuote] = useState<string>(introQuotes[0]);
  const [introLoaded, setIntroLoaded] = useState(false);
  const [subtitleLoaded, setSubtitleLoaded] = useState(false);
  const [particleState, setParticleState] = useState<ParticleTransitionState>("idle");
  const [particleCount, setParticleCount] = useState(0);
  const [sourcePointCount, setSourcePointCount] = useState(0);
  const [targetPointCount, setTargetPointCount] = useState(0);

  const stopParticleMorph = useCallback(() => {
    particleControllerRef.current?.cancel();
    particleControllerRef.current = null;
  }, []);

  const runParticleMorph = useCallback((mainView: HTMLElement, profileCardInner: HTMLElement | null) => {
    const canvas = particleCanvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return false;

    const sourceContent = section.querySelector(".wrap") as HTMLElement | null;
    const sourceTextElements = Array.from(section.querySelectorAll(".content-title, .content-subtitle")) as HTMLElement[];
    const targetTextElements = Array.from(
      document.querySelectorAll("#main-view .profile-card h1, #main-view .profile-card p, #main-view .profile-card a span")
    ) as HTMLElement[];
    const targetAvatar = document.querySelector("#main-view .profile-avatar") as HTMLElement | null;
    const targetGrid = document.querySelector("#main-view [data-interactive-go-background]") as HTMLElement | null;
    const gridCellSize = Number(targetGrid?.getAttribute("data-cell-size")) || 46;

    stopParticleMorph();
    if (sourceContent) sourceContent.style.transition = "none";
    if (profileCardInner) {
      profileCardInner.style.animation = "none";
      profileCardInner.style.transition = "none";
    }
    setParticleState("running");
    const controller = startPptParticleMorph({
      canvas,
      sourceTextElements,
      targetTextElements,
      targetAvatar,
      targetGrid,
      gridCellSize,
      onProgress: (progress) => {
        const incoming = smoothRange(0.04, 0.88, progress);
        const cardProgress = smoothRange(0.36, 0.94, progress);

        if (sourceContent) {
          sourceContent.style.opacity = (1 - smoothRange(0.08, 0.64, progress)).toFixed(4);
          sourceContent.style.transform = `translate3d(0, ${(-progress * 12).toFixed(2)}px, 0) scale(${(
            1 +
            progress * 0.025
          ).toFixed(4)})`;
          sourceContent.style.filter = `blur(${(progress * 3.5).toFixed(2)}px)`;
        }
        mainView.style.opacity = (0.05 + incoming * 0.95).toFixed(4);
        mainView.style.transform = `translate3d(0, ${((1 - incoming) * 4).toFixed(3)}vh, 0) scale(${(
          0.965 +
          incoming * 0.035
        ).toFixed(4)})`;
        mainView.style.filter = `blur(${((1 - incoming) * 8).toFixed(2)}px)`;

        if (profileCardInner) {
          profileCardInner.style.opacity = cardProgress.toFixed(4);
          profileCardInner.style.transform = `translate3d(0, ${((1 - cardProgress) * 22).toFixed(2)}px, 0) scale(${(
            0.975 +
            cardProgress * 0.025
          ).toFixed(4)})`;
        }
      },
      onComplete: () => {
        setParticleCount(0);
        setParticleState("done");
        mainView.style.opacity = "";
        mainView.style.transform = "";
        mainView.style.filter = "";
        mainView.style.zIndex = "";
        if (profileCardInner) {
          profileCardInner.classList.add("in");
          profileCardInner.style.opacity = "";
          profileCardInner.style.transform = "";
        }
        window.__stopWebglFluidBackground?.();
        section.style.visibility = "hidden";
        window.dispatchEvent(new Event("resize"));
      }
    });
    particleControllerRef.current = controller;
    setParticleCount(controller.particleCount);
    setSourcePointCount(controller.sourcePointCount);
    setTargetPointCount(controller.targetPointCount);
    return controller.particleCount > 0;
  }, [stopParticleMorph]);

  const enterMainView = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    window.switchPage = { ...(window.switchPage ?? {}), switched: true };
    const section = sectionRef.current;
    const mainView = document.querySelector("#main-view") as HTMLElement | null;
    const profileCardInner = document.querySelector(".profile-card-inner") as HTMLElement | null;
    if (mainView) {
      mainView.style.transform = "none";
      mainView.style.opacity = "0";
      mainView.style.filter = "none";
      mainView.style.zIndex = "120";
    }
    document.documentElement.dataset.mainView = "active";
    section?.classList.add("is-leaving");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && section && mainView && runParticleMorph(mainView, profileCardInner)) {
      return;
    }

    if (mainView) {
      mainView.style.transform = "";
      mainView.style.opacity = "";
      mainView.style.filter = "";
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
    setParticleCount(0);
    setParticleState("done");
    setSourcePointCount(0);
    setTargetPointCount(0);
    window.__stopWebglFluidBackground?.();
    window.dispatchEvent(new Event("resize"));
  }, [runParticleMorph]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    leavingRef.current = false;
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
      mainView.style.filter = "";
      mainView.style.zIndex = "";
    }
    stopParticleMorph();
    setParticleState("idle");
    setParticleCount(0);
    setSourcePointCount(0);
    setTargetPointCount(0);
    setSelectedQuote(pickIntroQuote());
    window.config = { ...fluidConfig, PAUSED: reduceMotion };
    window.switchPage = { switched: false };
    const fadeTimer = window.setTimeout(() => setIntroLoaded(true), 0);
    const subtitleTimer = window.setTimeout(() => setSubtitleLoaded(true), 270);

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
    if (sourceContent) {
      sourceContent.style.opacity = "";
      sourceContent.style.transform = "";
      sourceContent.style.filter = "";
      sourceContent.style.transition = "";
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
      window.clearTimeout(subtitleTimer);
      document.body.removeEventListener("wheel", handleWheel);
      document.removeEventListener("keydown", handleKeyDown);
      section.removeEventListener("touchstart", handleTouchStart);
      section.removeEventListener("touchend", handleTouchEnd);
      window.switchPage = { switched: true };
      stopParticleMorph();
      window.__stopWebglFluidBackground?.();
    };
  }, [enterMainView, stopParticleMorph]);

  return (
    <>
      <section
        ref={sectionRef}
        className="content content-intro"
        aria-label="进入动画"
        data-motion-scene="intro-opening"
        data-transition-visual="ppt-particle-morph"
      >
        <div className="content-inner">
          <canvas
            id="background"
            aria-label="进入动画背景"
            data-visual="webgl-fluid-opening"
            data-webgl-fluid-background
          />

          <div className={`wrap fade${introLoaded ? " in" : ""}`}>
            <h2 className="content-title">{introTitle}</h2>
            <h3 className="content-subtitle" data-intro-subtitle data-original-content={selectedQuote}>
              {subtitleLoaded
                ? Array.from(selectedQuote).map((letter, index) => (
                    <span key={`${letter}-${index}`} style={{ animationDelay: `${index * 55}ms` }}>
                      {letter === " " ? "\u00a0" : letter}
                    </span>
                  ))
                : "\u00a0"}
            </h3>
            <div className="arrow arrow-1" aria-hidden="true" onMouseEnter={enterMainView} />
            <div className="arrow arrow-2" aria-hidden="true" onMouseEnter={enterMainView} />
          </div>
        </div>
      </section>
      <canvas
        ref={particleCanvasRef}
        className="intro-particle-morph"
        aria-hidden="true"
        data-intro-particle-transition
        data-particle-transition-state={particleState}
        data-particle-count={particleCount}
        data-particle-source-count={sourcePointCount}
        data-particle-target-count={targetPointCount}
        data-particle-flow-direction="source-to-target"
        data-particle-mapping="intro-to-main-anchors"
      />
    </>
  );
}
