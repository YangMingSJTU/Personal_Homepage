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

type ParticleTransitionState = "idle" | "running" | "done";

type TransitionParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  alpha: number;
  phase: number;
  curl: number;
};

function pickIntroQuote() {
  return introQuotes[Math.floor(Math.random() * introQuotes.length)];
}

export default function IntroOpeningHero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const shapeRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleFrameRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const [selectedQuote, setSelectedQuote] = useState<string>(introQuotes[0]);
  const [introLoaded, setIntroLoaded] = useState(false);
  const [subtitleLoaded, setSubtitleLoaded] = useState(false);
  const [particleState, setParticleState] = useState<ParticleTransitionState>("idle");
  const [particleCount, setParticleCount] = useState(0);

  const stopParticleTransition = useCallback(() => {
    if (particleFrameRef.current !== null) {
      window.cancelAnimationFrame(particleFrameRef.current);
      particleFrameRef.current = null;
    }
    const canvas = particleCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const runParticleTransition = useCallback(() => {
    const canvas = particleCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    stopParticleTransition();

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const count = window.innerWidth < 720 ? 140 : 280;
    const centerX = width * 0.5;
    const centerY = height * 0.48;
    const palette = [188, 196, 206, 278];
    const particles: TransitionParticle[] = Array.from({ length: count }, (_, index) => {
      const ring = Math.sqrt(Math.random());
      const angle = Math.random() * Math.PI * 2;
      const startRadiusX = width * (0.08 + Math.random() * 0.22);
      const startRadiusY = height * (0.05 + Math.random() * 0.14);
      const x = centerX + Math.cos(angle) * startRadiusX * ring;
      const y = centerY + Math.sin(angle) * startRadiusY * ring - height * 0.1;
      const outward = Math.random() < 0.5 ? -1 : 1;
      return {
        x,
        y,
        vx: outward * (width * (0.2 + Math.random() * 0.46)),
        vy: height * (0.34 + Math.random() * 0.7),
        size: 1.1 + Math.random() * 3.4,
        hue: palette[index % palette.length],
        alpha: 0.42 + Math.random() * 0.48,
        phase: Math.random() * Math.PI * 2,
        curl: (Math.random() - 0.5) * width * 0.12
      };
    });

    setParticleCount(count);
    setParticleState("running");
    const startedAt = performance.now();
    const duration = 1080;

    const drawFrame = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      for (const particle of particles) {
        const curl = Math.sin(progress * 9 + particle.phase) * particle.curl * (1 - progress);
        const x = particle.x + particle.vx * eased + curl;
        const y = particle.y + particle.vy * eased + Math.sin(progress * 6 + particle.phase) * 18;
        const previousX = particle.x + particle.vx * Math.max(0, eased - 0.05) + curl * 0.8;
        const previousY = particle.y + particle.vy * Math.max(0, eased - 0.05);
        const alpha = particle.alpha * Math.sin(Math.PI * progress) * (1 - progress * 0.12);
        if (alpha <= 0.01) continue;

        const gradient = context.createRadialGradient(x, y, 0, x, y, particle.size * 7);
        gradient.addColorStop(0, `hsla(${particle.hue}, 100%, 86%, ${alpha})`);
        gradient.addColorStop(0.36, `hsla(${particle.hue}, 95%, 62%, ${alpha * 0.46})`);
        gradient.addColorStop(1, `hsla(${particle.hue}, 90%, 52%, 0)`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, particle.size * 7, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = `hsla(${particle.hue}, 100%, 78%, ${alpha * 0.52})`;
        context.lineWidth = Math.max(1, particle.size * 0.75);
        context.beginPath();
        context.moveTo(previousX, previousY);
        context.lineTo(x, y);
        context.stroke();
      }

      context.globalCompositeOperation = "source-over";
      if (progress < 1) {
        particleFrameRef.current = window.requestAnimationFrame(drawFrame);
      } else {
        context.clearRect(0, 0, width, height);
        particleFrameRef.current = null;
        setParticleCount(0);
        setParticleState("done");
      }
    };

    particleFrameRef.current = window.requestAnimationFrame(drawFrame);
  }, [stopParticleTransition]);

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
    if (!reduceMotion) {
      runParticleTransition();
    } else {
      setParticleCount(0);
      setParticleState("done");
    }

    if (!reduceMotion && section && shape && path) {
      shape.style.transformOrigin = "50% 0%";
      anime({
        targets: section,
        delay: 360,
        duration: 1200,
        easing: "easeInOutSine",
        translateY: "-200vh",
        complete: () => {
          window.__stopWebglFluidBackground?.();
        }
      });
      anime({
        targets: shape,
        delay: 280,
        scaleY: [
          { value: [0.8, 1.8], duration: 600, easing: "easeInQuad" },
          { value: 1, duration: 600, easing: "easeOutQuad" }
        ]
      });
      anime({
        targets: path,
        delay: 280,
        duration: 1200,
        easing: "easeOutQuad",
        d: shapeTargetPath
      });
      return;
    }

    if (section) section.style.transform = "translateY(-200vh)";
    window.__stopWebglFluidBackground?.();
  }, [runParticleTransition]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.removeAttribute("data-main-view");
    document.querySelector(".profile-card-inner")?.classList.remove("in");
    stopParticleTransition();
    setParticleState("idle");
    setParticleCount(0);
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
      stopParticleTransition();
      window.__stopWebglFluidBackground?.();
    };
  }, [enterMainView, stopParticleTransition]);

  return (
    <section
      ref={sectionRef}
      className="content content-intro"
      aria-label="进入动画"
      data-motion-scene="intro-opening"
      data-transition-visual="particle-dissolve-wipe"
    >
      <div className="content-inner">
        <canvas
          id="background"
          aria-label="进入动画背景"
          data-visual="webgl-fluid-opening"
          data-webgl-fluid-background
        />
        <canvas
          ref={particleCanvasRef}
          className="intro-particle-transition"
          aria-hidden="true"
          data-intro-particle-transition
          data-particle-transition-state={particleState}
          data-particle-count={particleCount}
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
            <defs>
              <linearGradient id="shapeCurtainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#05070d" />
                <stop offset="42%" stopColor="#07111c" />
                <stop offset="72%" stopColor="#0d1b2b" />
                <stop offset="100%" stopColor="#101827" />
              </linearGradient>
            </defs>
            <path ref={pathRef} className="shape-curtain" data-shape-main-path d={shapePath} />
          </svg>
        </div>
      </div>
    </section>
  );
}
