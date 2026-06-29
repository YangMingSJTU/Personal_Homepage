import React, { useEffect, useRef } from "react";

type StoneColor = "black" | "white";

type Stone = {
  col: number;
  row: number;
  color: StoneColor;
  createdAt?: number;
};

type Point = {
  col: number;
  row: number;
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

const getLayout = (width: number, height: number): BoardLayout => {
  const isNarrow = width < 720;
  const size = Math.min(width * (isNarrow ? 0.92 : 0.78), height * (isNarrow ? 0.58 : 0.76), isNarrow ? 520 : 720);
  const left = (width - size) / 2;
  const top = isNarrow ? Math.max(36, height * 0.08) : Math.max(46, (height - size) * 0.42);

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

const drawBoard = (ctx: CanvasRenderingContext2D, width: number, height: number, layout: BoardLayout) => {
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#05070d");
  background.addColorStop(0.48, "#0a1118");
  background.addColorStop(1, "#030407");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const boardGradient = ctx.createLinearGradient(layout.left, layout.top, layout.left + layout.size, layout.top + layout.size);
  boardGradient.addColorStop(0, "#e4c68a");
  boardGradient.addColorStop(0.5, "#cfa666");
  boardGradient.addColorStop(1, "#ad8048");

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = boardGradient;
  ctx.fillRect(layout.left - layout.gap, layout.top - layout.gap, layout.size + layout.gap * 2, layout.size + layout.gap * 2);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#5d3d1e";
  ctx.lineWidth = 1;
  for (let i = 0; i < 34; i += 1) {
    const y = layout.top - layout.gap + i * (layout.size + layout.gap * 2) / 34;
    ctx.beginPath();
    ctx.moveTo(layout.left - layout.gap, y);
    ctx.lineTo(layout.left + layout.size + layout.gap, y + Math.sin(i) * 5);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(30, 20, 12, 0.76)";
  ctx.lineWidth = Math.max(1, layout.gap * 0.028);
  for (let i = 0; i < 19; i += 1) {
    const axis = layout.left + i * layout.gap;
    const rowAxis = layout.top + i * layout.gap;

    ctx.beginPath();
    ctx.moveTo(axis, layout.top);
    ctx.lineTo(axis, layout.top + layout.size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(layout.left, rowAxis);
    ctx.lineTo(layout.left + layout.size, rowAxis);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(28, 19, 11, 0.88)";
  STAR_POINTS.forEach((point) => {
    const { x, y } = getBoardPoint(layout, point);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, layout.gap * 0.11), 0, Math.PI * 2);
    ctx.fill();
  });
};

const drawStone = (ctx: CanvasRenderingContext2D, layout: BoardLayout, stone: Stone, alpha = 1) => {
  const { x, y } = getBoardPoint(layout, stone);
  const radius = layout.gap * 0.43;
  const highlightX = x - radius * 0.36;
  const highlightY = y - radius * 0.42;
  const gradient = ctx.createRadialGradient(highlightX, highlightY, radius * 0.1, x, y, radius);

  if (stone.color === "black") {
    gradient.addColorStop(0, "#5b6370");
    gradient.addColorStop(0.42, "#171b22");
    gradient.addColorStop(1, "#020204");
  } else {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.5, "#f0eadf");
    gradient.addColorStop(1, "#b8afa2");
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
  ctx.shadowBlur = radius * 0.48;
  ctx.shadowOffsetY = radius * 0.22;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawRipple = (ctx: CanvasRenderingContext2D, layout: BoardLayout, stone: Stone, age: number) => {
  const progress = Math.min(1, age / 720);
  const { x, y } = getBoardPoint(layout, stone);

  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.42;
  ctx.strokeStyle = stone.color === "black" ? "#0b1118" : "#fff8e7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, layout.gap * (0.58 + progress * 0.62), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const drawHover = (ctx: CanvasRenderingContext2D, layout: BoardLayout, hover: Point | null) => {
  if (!hover) {
    return;
  }

  const { x, y } = getBoardPoint(layout, hover);

  ctx.save();
  ctx.strokeStyle = "rgba(0, 229, 255, 0.72)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, layout.gap * 0.33, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

export default function GoBoardHero({ primaryHref = "/products", secondaryHref = "/projects" }: GoBoardHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

      const layout = getLayout(rect.width, rect.height);
      drawBoard(ctx, rect.width, rect.height, layout);

      const interval = 860;
      const cycle = interval * (MOVE_SEQUENCE.length + 5);
      const elapsed = reducedMotion ? cycle : (now - startedAt) % cycle;
      const revealCount = reducedMotion ? 16 : Math.min(MOVE_SEQUENCE.length, 8 + Math.floor(elapsed / interval));
      const stones = MOVE_SEQUENCE.slice(0, revealCount);

      stones.forEach((stone) => drawStone(ctx, layout, stone));
      placedStones.forEach((stone) => drawStone(ctx, layout, stone, reducedMotion ? 1 : 0.92));

      if (!reducedMotion && revealCount > 8 && revealCount <= MOVE_SEQUENCE.length) {
        const latestMoveAt = (revealCount - 8) * interval;
        const latest = stones[stones.length - 1];
        const age = elapsed - latestMoveAt;
        if (latest && age >= 0 && age < 720) {
          drawRipple(ctx, layout, latest, age);
        }
      }

      drawHover(ctx, layout, hover);
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(performance.now());
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

    const stopLoop = () => {
      if (animationId !== undefined) {
        window.cancelAnimationFrame(animationId);
        animationId = undefined;
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
          color: placedStones.length % 2 === 0 ? "black" : "white",
          createdAt: performance.now()
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
  }, []);

  return (
    <section className="go-hero" aria-label="动态围棋首页">
      <canvas ref={canvasRef} className="go-board-canvas" aria-label="动态围棋棋盘" />
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
