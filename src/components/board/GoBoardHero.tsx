import React, { useEffect, useMemo, useRef } from "react";

type StoneColor = "black" | "white";

type Point = {
  col: number;
  row: number;
};

type Stone = Point & {
  color: StoneColor;
};

type Particle = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  tone: "cyan" | "gold" | "white";
};

type BoardLayout = {
  left: number;
  top: number;
  size: number;
  gap: number;
};

type GoBoardHeroProps = {
  primaryHref?: string;
  secondaryHref?: string;
};

const STAR_POINTS: Point[] = [
  { col: 3, row: 3 },
  { col: 9, row: 3 },
  { col: 15, row: 3 },
  { col: 3, row: 9 },
  { col: 9, row: 9 },
  { col: 15, row: 9 },
  { col: 3, row: 15 },
  { col: 9, row: 15 },
  { col: 15, row: 15 }
];

const MOVE_SEQUENCE: Stone[] = [
  { col: 3, row: 3, color: "black" },
  { col: 15, row: 15, color: "white" },
  { col: 15, row: 3, color: "black" },
  { col: 3, row: 15, color: "white" },
  { col: 9, row: 9, color: "black" },
  { col: 10, row: 9, color: "white" },
  { col: 9, row: 10, color: "black" },
  { col: 8, row: 9, color: "white" },
  { col: 4, row: 10, color: "black" },
  { col: 14, row: 8, color: "white" },
  { col: 5, row: 16, color: "black" },
  { col: 16, row: 5, color: "white" },
  { col: 11, row: 12, color: "black" },
  { col: 7, row: 6, color: "white" },
  { col: 12, row: 6, color: "black" },
  { col: 6, row: 12, color: "white" },
  { col: 13, row: 13, color: "black" },
  { col: 5, row: 5, color: "white" }
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const getLayout = (width: number, height: number): BoardLayout => {
  const isNarrow = width < 720;
  const size = Math.min(width * (isNarrow ? 0.9 : 0.76), height * (isNarrow ? 0.52 : 0.72), isNarrow ? 520 : 760);
  const left = (width - size) / 2;
  const top = isNarrow ? Math.max(26, height * 0.09) : Math.max(40, (height - size) * 0.38);

  return {
    left,
    top,
    size,
    gap: size / 18
  };
};

const getBoardPoint = (layout: BoardLayout, point: Point) => ({
  x: layout.left + point.col * layout.gap,
  y: layout.top + point.row * layout.gap
});

const nearestPoint = (layout: BoardLayout, x: number, y: number): Point | null => {
  const col = Math.round((x - layout.left) / layout.gap);
  const row = Math.round((y - layout.top) / layout.gap);

  if (col < 0 || col > 18 || row < 0 || row > 18) {
    return null;
  }

  return { col, row };
};

const buildParticles = (): Particle[] =>
  Array.from({ length: 90 }, (_, index) => {
    const tone: Particle["tone"] = index % 9 === 0 ? "gold" : index % 3 === 0 ? "white" : "cyan";

    return {
      x: (Math.sin(index * 12.9898) * 43758.5453) % 1,
      y: (Math.sin(index * 78.233) * 19341.711) % 1,
      radius: 0.7 + (index % 5) * 0.32,
      speed: 0.12 + (index % 7) * 0.035,
      phase: index * 0.47,
      tone
    };
  }).map((particle) => ({
    ...particle,
    x: Math.abs(particle.x),
    y: Math.abs(particle.y)
  }));

const drawSpace = (ctx: CanvasRenderingContext2D, width: number, height: number, particles: Particle[], time: number, intro: number) => {
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#02050a");
  background.addColorStop(0.46, "#06101a");
  background.addColorStop(1, "#020308");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const aura = ctx.createRadialGradient(width * 0.5, height * 0.38, 0, width * 0.5, height * 0.38, Math.max(width, height) * 0.68);
  aura.addColorStop(0, `rgba(0, 229, 255, ${0.18 * intro})`);
  aura.addColorStop(0.42, `rgba(84, 120, 255, ${0.08 * intro})`);
  aura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, height);

  particles.forEach((particle) => {
    const drift = time * particle.speed;
    const x = (particle.x * width + Math.sin(drift + particle.phase) * 26 + width) % width;
    const y = (particle.y * height + Math.cos(drift * 0.72 + particle.phase) * 18 + height) % height;
    const pulse = 0.45 + Math.sin(time * 1.8 + particle.phase) * 0.25;
    const color = particle.tone === "gold" ? "200, 169, 106" : particle.tone === "white" ? "230, 248, 255" : "0, 229, 255";

    ctx.save();
    ctx.globalAlpha = intro * pulse;
    ctx.fillStyle = `rgba(${color}, 0.62)`;
    ctx.shadowColor = `rgba(${color}, 0.86)`;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
};

const drawHologramBoard = (ctx: CanvasRenderingContext2D, layout: BoardLayout, intro: number, time: number) => {
  const panelInset = layout.gap * 0.9;
  const panelLeft = layout.left - panelInset;
  const panelTop = layout.top - panelInset;
  const panelSize = layout.size + panelInset * 2;
  const panelRadius = Math.max(12, layout.gap * 0.3);

  ctx.save();
  ctx.globalAlpha = intro;
  ctx.shadowColor = "rgba(0, 229, 255, 0.34)";
  ctx.shadowBlur = 42;
  ctx.fillStyle = "rgba(2, 12, 22, 0.64)";
  ctx.strokeStyle = "rgba(0, 229, 255, 0.38)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(panelLeft, panelTop, panelSize, panelSize, panelRadius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const lineProgress = easeOutCubic(intro);
  const gridAlpha = 0.28 + Math.sin(time * 2.2) * 0.04;
  const centerX = layout.left + layout.size / 2;
  const centerY = layout.top + layout.size / 2;

  for (let index = 0; index < 19; index += 1) {
    const axis = layout.left + index * layout.gap;
    const rowAxis = layout.top + index * layout.gap;
    const revealDelay = index / 28;
    const localProgress = clamp((lineProgress - revealDelay) / 0.66, 0, 1);

    ctx.save();
    ctx.globalAlpha = localProgress;
    ctx.lineWidth = index === 0 || index === 18 ? 1.35 : 0.82;
    ctx.shadowColor = index % 3 === 0 ? "rgba(200, 169, 106, 0.5)" : "rgba(0, 229, 255, 0.58)";
    ctx.shadowBlur = index % 3 === 0 ? 10 : 14;
    ctx.strokeStyle = index % 3 === 0 ? `rgba(200, 169, 106, ${gridAlpha})` : `rgba(0, 229, 255, ${gridAlpha + 0.08})`;

    ctx.beginPath();
    ctx.moveTo(axis, centerY - (layout.size / 2) * localProgress);
    ctx.lineTo(axis, centerY + (layout.size / 2) * localProgress);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX - (layout.size / 2) * localProgress, rowAxis);
    ctx.lineTo(centerX + (layout.size / 2) * localProgress, rowAxis);
    ctx.stroke();
    ctx.restore();
  }

  const scanY = layout.top + ((time * 82) % (layout.size + layout.gap * 2)) - layout.gap;
  const scanGradient = ctx.createLinearGradient(layout.left, scanY - 18, layout.left, scanY + 18);
  scanGradient.addColorStop(0, "rgba(0, 229, 255, 0)");
  scanGradient.addColorStop(0.5, `rgba(0, 229, 255, ${0.24 * intro})`);
  scanGradient.addColorStop(1, "rgba(0, 229, 255, 0)");
  ctx.save();
  ctx.fillStyle = scanGradient;
  ctx.fillRect(panelLeft, scanY - 18, panelSize, 36);
  ctx.restore();
};

const drawStarPoints = (ctx: CanvasRenderingContext2D, layout: BoardLayout, intro: number, time: number) => {
  STAR_POINTS.forEach((point, index) => {
    const { x, y } = getBoardPoint(layout, point);
    const pulse = 0.6 + Math.sin(time * 2.6 + index) * 0.22;

    ctx.save();
    ctx.globalAlpha = intro;
    ctx.shadowColor = index === 4 ? "rgba(200, 169, 106, 0.9)" : "rgba(0, 229, 255, 0.86)";
    ctx.shadowBlur = index === 4 ? 20 : 15;
    ctx.fillStyle = index === 4 ? `rgba(255, 221, 137, ${0.72 * pulse})` : `rgba(141, 247, 255, ${0.72 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3.5, layout.gap * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
};

const drawEnergyStone = (ctx: CanvasRenderingContext2D, layout: BoardLayout, stone: Stone, time: number, alpha = 1) => {
  const { x, y } = getBoardPoint(layout, stone);
  const radius = layout.gap * 0.43;
  const outerColor = stone.color === "black" ? "0, 229, 255" : "230, 248, 255";
  const coreGradient = ctx.createRadialGradient(x - radius * 0.26, y - radius * 0.32, radius * 0.08, x, y, radius);

  if (stone.color === "black") {
    coreGradient.addColorStop(0, "#657386");
    coreGradient.addColorStop(0.38, "#121820");
    coreGradient.addColorStop(1, "#020308");
  } else {
    coreGradient.addColorStop(0, "#ffffff");
    coreGradient.addColorStop(0.44, "#d9f8ff");
    coreGradient.addColorStop(1, "#7692a1");
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = `rgba(${outerColor}, 0.58)`;
  ctx.shadowBlur = radius * 1.25;
  ctx.strokeStyle = `rgba(${outerColor}, 0.78)`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(x, y, radius * (1.04 + Math.sin(time * 3.2 + x) * 0.025), 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.88, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.38;
  ctx.strokeStyle = stone.color === "black" ? "rgba(0, 229, 255, 0.88)" : "rgba(255, 255, 255, 0.88)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.36, -time * 1.8, Math.PI * 1.35 - time * 1.8);
  ctx.stroke();
  ctx.restore();
};

const drawImpact = (ctx: CanvasRenderingContext2D, layout: BoardLayout, stone: Stone, age: number) => {
  const progress = clamp(age / 780, 0, 1);
  const { x, y } = getBoardPoint(layout, stone);
  const color = stone.color === "black" ? "0, 229, 255" : "230, 248, 255";

  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.62;
  ctx.strokeStyle = `rgba(${color}, 0.86)`;
  ctx.shadowColor = `rgba(${color}, 0.72)`;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, layout.gap * (0.5 + progress * 1.05), 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = (1 - progress) * 0.3;
  ctx.beginPath();
  ctx.moveTo(x - layout.gap * 1.3, y);
  ctx.lineTo(x + layout.gap * 1.3, y);
  ctx.moveTo(x, y - layout.gap * 1.3);
  ctx.lineTo(x, y + layout.gap * 1.3);
  ctx.stroke();
  ctx.restore();
};

const drawHover = (ctx: CanvasRenderingContext2D, layout: BoardLayout, hover: Point | null, time: number) => {
  if (!hover) {
    return;
  }

  const { x, y } = getBoardPoint(layout, hover);
  const size = layout.gap * (0.38 + Math.sin(time * 5) * 0.03);

  ctx.save();
  ctx.strokeStyle = "rgba(0, 229, 255, 0.82)";
  ctx.shadowColor = "rgba(0, 229, 255, 0.9)";
  ctx.shadowBlur = 18;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x - size * 0.32, y - size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x + size * 0.32, y - size);
  ctx.moveTo(x - size, y + size);
  ctx.lineTo(x - size * 0.32, y + size);
  ctx.moveTo(x + size, y + size);
  ctx.lineTo(x + size * 0.32, y + size);
  ctx.stroke();
  ctx.restore();
};

export default function GoBoardHero({ primaryHref = "/products", secondaryHref = "/projects" }: GoBoardHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useMemo(buildParticles, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) {
      return undefined;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    let animationId: number | undefined;
    let hover: Point | null = null;
    let placedStones: Stone[] = [];
    const startedAt = performance.now();

    const render = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      const time = reducedMotion ? 3.2 : (now - startedAt) / 1000;
      const intro = reducedMotion ? 1 : clamp(time / 1.8, 0, 1);
      const layout = getLayout(rect.width, rect.height);
      drawSpace(ctx, rect.width, rect.height, particles, time, intro);
      drawHologramBoard(ctx, layout, intro, time);
      drawStarPoints(ctx, layout, intro, time);

      const interval = 720;
      const introDelay = 1450;
      const cycle = interval * (MOVE_SEQUENCE.length + 4);
      const elapsed = reducedMotion ? cycle : Math.max(0, (now - startedAt - introDelay) % cycle);
      const revealCount = reducedMotion ? 16 : Math.min(MOVE_SEQUENCE.length, Math.floor(elapsed / interval) + 1);
      const stones = MOVE_SEQUENCE.slice(0, revealCount);

      stones.forEach((stone, index) => {
        const stoneIntro = reducedMotion ? 1 : clamp((elapsed - index * interval) / 360, 0, 1);
        drawEnergyStone(ctx, layout, stone, time, intro * easeOutCubic(stoneIntro));
      });
      placedStones.forEach((stone) => drawEnergyStone(ctx, layout, stone, time, 0.95));

      if (!reducedMotion && revealCount > 0 && revealCount <= MOVE_SEQUENCE.length) {
        const latest = stones[stones.length - 1];
        const age = elapsed - (revealCount - 1) * interval;
        if (latest && age >= 0 && age < 780) {
          drawImpact(ctx, layout, latest, age);
        }
      }

      drawHover(ctx, layout, hover, time);
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(performance.now());
    };

    const stopLoop = () => {
      if (animationId !== undefined) {
        window.cancelAnimationFrame(animationId);
        animationId = undefined;
      }
    };

    const loop = (now: number) => {
      render(now);
      if (!reducedMotion) {
        animationId = window.requestAnimationFrame(loop);
      }
    };

    const startLoop = () => {
      if (animationId === undefined && !reducedMotion) {
        animationId = window.requestAnimationFrame(loop);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      hover = nearestPoint(getLayout(rect.width, rect.height), event.clientX - rect.left, event.clientY - rect.top);
      if (reducedMotion) {
        render(performance.now());
      }
    };

    const handlePointerLeave = () => {
      hover = null;
      if (reducedMotion) {
        render(performance.now());
      }
    };

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = nearestPoint(getLayout(rect.width, rect.height), event.clientX - rect.left, event.clientY - rect.top);

      if (!point) {
        return;
      }

      placedStones = [
        ...placedStones.slice(-5),
        {
          ...point,
          color: placedStones.length % 2 === 0 ? "black" : "white"
        }
      ];
      render(performance.now());
    };

    const handleMotionChange = () => {
      reducedMotion = motionQuery.matches;
      stopLoop();
      render(performance.now());
      startLoop();
    };

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("click", handleClick);
    motionQuery.addEventListener("change", handleMotionChange);
    resizeCanvas();
    startLoop();

    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("click", handleClick);
      motionQuery.removeEventListener("change", handleMotionChange);
      stopLoop();
    };
  }, [particles]);

  return (
    <section className="go-hero" aria-label="动态围棋首页" data-motion-scene="holographic-go">
      <canvas ref={canvasRef} className="go-board-canvas" aria-label="动态围棋棋盘" data-visual="holographic-go-board" />
      <div className="go-hero-actions" aria-label="Primary entry points">
        <a className="go-hero-link go-hero-link-primary" href={primaryHref}>
          Products
        </a>
        <a className="go-hero-link" href={secondaryHref}>
          Projects
        </a>
      </div>
    </section>
  );
}
