import React, { useCallback, useEffect, useRef, useState } from "react";
import anime from "animejs/lib/anime.es.js";
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
const shapePath =
  "M -44,-50 C -52.71,28.52 15.86,8.186 184,14.69 383.3,22.39 462.5,12.58 638,14 835.5,15.6 987,6.4 1194,13.86 1661,30.68 1652,-36.74 1582,-140.1 1512,-243.5 15.88,-589.5 -44,-50 Z";
const shapeTargetPath =
  "M -44,-50 C -137.1,117.4 67.86,445.5 236,452 435.3,459.7 500.5,242.6 676,244 873.5,245.6 957,522.4 1154,594 1593,753.7 1793,226.3 1582,-126 1371,-478.3 219.8,-524.2 -44,-50 Z";

function pickIntroQuote() {
  return introQuotes[Math.floor(Math.random() * introQuotes.length)];
}

export default function IntroOpeningHero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const shapeRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const [selectedQuote, setSelectedQuote] = useState<string>(introQuotes[0]);
  const [introLoaded, setIntroLoaded] = useState(false);
  const [subtitleLoaded, setSubtitleLoaded] = useState(false);

  const enterMainView = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    window.switchPage = { ...(window.switchPage ?? {}), switched: true };
    document.documentElement.dataset.mainView = "active";
    document.querySelector(".profile-card-inner")?.classList.add("in");
    const section = sectionRef.current;
    const shape = shapeRef.current;
    const path = pathRef.current;
    section?.classList.add("is-leaving");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && section && shape && path) {
      shape.style.transformOrigin = "50% 0%";
      anime({
        targets: section,
        duration: 1200,
        easing: "easeInOutSine",
        translateY: "-200vh",
        complete: () => {
          window.__stopWebglFluidBackground?.();
        }
      });
      anime({
        targets: shape,
        scaleY: [
          { value: [0.8, 1.8], duration: 600, easing: "easeInQuad" },
          { value: 1, duration: 600, easing: "easeOutQuad" }
        ]
      });
      anime({
        targets: path,
        duration: 1200,
        easing: "easeOutQuad",
        d: shapeTargetPath
      });
      return;
    }

    if (section) section.style.transform = "translateY(-200vh)";
    window.__stopWebglFluidBackground?.();
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.removeAttribute("data-main-view");
    document.querySelector(".profile-card-inner")?.classList.remove("in");
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
      window.__stopWebglFluidBackground?.();
    };
  }, [enterMainView]);

  return (
    <section ref={sectionRef} className="content content-intro" aria-label="进入动画" data-motion-scene="intro-opening">
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

        <div className="shape-wrap" aria-hidden="true">
          <svg ref={shapeRef} className="shape" width="100%" height="100vh" preserveAspectRatio="none" viewBox="0 0 1440 800">
            <path ref={pathRef} d={shapePath} />
          </svg>
        </div>
      </div>
    </section>
  );
}
