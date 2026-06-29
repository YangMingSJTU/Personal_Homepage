import React, { useCallback, useEffect, useRef, useState } from "react";

type StoneColor = "black" | "white";
type StoneSource = "user" | "random";

type Stone = {
  x: number;
  y: number;
  color: StoneColor;
  source: StoneSource;
  createdAt: number;
  pulseUntil: number;
};

type HoverPoint = {
  x: number;
  y: number;
} | null;

type LastPlacement = "hit" | "miss" | "none";
type PointerKind = "mouse" | "touch";

const maxStones = 90;
const randomIntervalMs = 1100;
const pulseMs = 720;

function getCellSize(width: number) {
  return Math.min(52, Math.max(38, width * 0.05));
}

function stoneKey(x: number, y: number) {
  return `${x}:${y}`;
}

function createSeededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function getVisibleBounds(width: number, height: number, cell: number) {
  const radius = Math.hypot(width, height) / 2 + cell * 3;
  const min = Math.floor(-radius / cell);
  const max = Math.ceil(radius / cell);
  return {
    minX: min,
    maxX: max,
    minY: min,
    maxY: max
  };
}

function gridToScreen(x: number, y: number, width: number, height: number, cell: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const gridX = x * cell;
  const gridY = y * cell;
  return {
    x: width / 2 + gridX * cos - gridY * sin,
    y: height / 2 + gridX * sin + gridY * cos
  };
}

function screenToGridHit(x: number, y: number, width: number, height: number, cell: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - width / 2;
  const dy = y - height / 2;
  const unrotatedX = dx * cos + dy * sin;
  const unrotatedY = -dx * sin + dy * cos;
  const gridX = Math.round(unrotatedX / cell);
  const gridY = Math.round(unrotatedY / cell);
  const screen = gridToScreen(gridX, gridY, width, height, cell, angle);

  return {
    x: gridX,
    y: gridY,
    distance: Math.hypot(x - screen.x, y - screen.y)
  };
}

function getHitRadius(cell: number, pointerKind: PointerKind) {
  return pointerKind === "touch" ? Math.min(22, cell * 0.42) : Math.min(16, cell * 0.32);
}

function pickRandomStone(width: number, height: number, cell: number, random: () => number): Stone {
  const bounds = getVisibleBounds(width, height, cell);
  const x = Math.floor(bounds.minX + random() * Math.max(1, bounds.maxX - bounds.minX));
  const y = Math.floor(bounds.minY + random() * Math.max(1, bounds.maxY - bounds.minY));
  const now = performance.now();
  return {
    x,
    y,
    color: random() > 0.5 ? "black" : "white",
    source: "random",
    createdAt: now,
    pulseUntil: now + pulseMs
  };
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  stone: Stone,
  screenX: number,
  screenY: number,
  radius: number,
  now: number,
  reducedMotion: boolean
) {
  if (stone.pulseUntil > now && !reducedMotion) {
    const progress = 1 - (stone.pulseUntil - now) / pulseMs;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.42 * (1 - progress));
    ctx.strokeStyle = stone.color === "black" ? "rgba(0, 229, 255, 0.82)" : "rgba(255, 255, 255, 0.84)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius + progress * radius * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const gradient = ctx.createRadialGradient(screenX - radius * 0.32, screenY - radius * 0.38, radius * 0.12, screenX, screenY, radius);
  if (stone.color === "black") {
    gradient.addColorStop(0, "#69717f");
    gradient.addColorStop(0.34, "#1e2630");
    gradient.addColorStop(1, "#010205");
    ctx.shadowColor = "rgba(0, 229, 255, 0.36)";
  } else {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.45, "#dce8f4");
    gradient.addColorStop(1, "#6f7c89");
    ctx.shadowColor = "rgba(255, 255, 255, 0.48)";
  }

  ctx.save();
  ctx.shadowBlur = radius * 0.9;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = stone.color === "black" ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.72)";
  ctx.stroke();
  ctx.restore();
}

export default function InteractiveGoBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stonesRef = useRef<Map<string, Stone>>(new Map());
  const animationRef = useRef<number | null>(null);
  const randomRef = useRef(createSeededRandom(20260629));
  const metricsRef = useRef({ width: 0, height: 0, cell: 48, angle: 0 });
  const reducedMotionRef = useRef(false);
  const hoverPointRef = useRef<HoverPoint>(null);
  const [stoneCount, setStoneCount] = useState(0);
  const [userStoneCount, setUserStoneCount] = useState(0);
  const [cellSize, setCellSize] = useState(48);
  const [lastStoneColor, setLastStoneColor] = useState<StoneColor | "none">("none");
  const [lastPlacement, setLastPlacement] = useState<LastPlacement>("none");
  const [hoverPoint, setHoverPoint] = useState<HoverPoint>(null);

  const syncStoneCount = useCallback(() => {
    const stones = Array.from(stonesRef.current.values());
    setStoneCount(stones.length);
    setUserStoneCount(stones.filter((stone) => stone.source === "user").length);
  }, []);

  const trimRandomStones = useCallback(() => {
    const stones = Array.from(stonesRef.current.values()).filter((stone) => stone.source === "random");
    stones.sort((a, b) => a.createdAt - b.createdAt);
    while (stonesRef.current.size > maxStones && stones.length > 0) {
      const oldest = stones.shift();
      if (!oldest) return;
      stonesRef.current.delete(stoneKey(oldest.x, oldest.y));
    }
  }, []);

  const placeStone = useCallback(
    (x: number, y: number, color: StoneColor, source: StoneSource) => {
      const now = performance.now();
      stonesRef.current.set(stoneKey(x, y), {
        x,
        y,
        color,
        source,
        createdAt: now,
        pulseUntil: now + pulseMs
      });
      trimRandomStones();
      setLastStoneColor(color);
      syncStoneCount();
    },
    [syncStoneCount, trimRandomStones]
  );

  const tryPlaceStoneFromClientPoint = useCallback(
    (clientX: number, clientY: number, color: StoneColor, pointerKind: PointerKind) => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      const rect = canvas.getBoundingClientRect();
      const metrics = metricsRef.current;
      const point = screenToGridHit(clientX - rect.left, clientY - rect.top, metrics.width, metrics.height, metrics.cell, metrics.angle);
      hoverPointRef.current = { x: point.x, y: point.y };
      setHoverPoint((current) => (current?.x === point.x && current?.y === point.y ? current : { x: point.x, y: point.y }));

      if (point.distance > getHitRadius(metrics.cell, pointerKind)) {
        setLastPlacement("miss");
        return false;
      }

      placeStone(point.x, point.y, color, "user");
      setLastPlacement("hit");
      return true;
    },
    [placeStone]
  );

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const metrics = metricsRef.current;
    const point = screenToGridHit(event.clientX - rect.left, event.clientY - rect.top, metrics.width, metrics.height, metrics.cell, metrics.angle);
    hoverPointRef.current = point;
    setHoverPoint((current) => (current?.x === point.x && current?.y === point.y ? current : point));
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverPointRef.current = null;
    setHoverPoint(null);
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      tryPlaceStoneFromClientPoint(event.clientX, event.clientY, "black", "mouse");
    },
    [tryPlaceStoneFromClientPoint]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse") return;
      event.preventDefault();
      tryPlaceStoneFromClientPoint(event.clientX, event.clientY, "black", "touch");
    },
    [tryPlaceStoneFromClientPoint]
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      tryPlaceStoneFromClientPoint(event.clientX, event.clientY, "white", "mouse");
    },
    [tryPlaceStoneFromClientPoint]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = reducedMotionQuery.matches;

    const initializeStones = () => {
      if (stonesRef.current.size > 0) return;
      const metrics = metricsRef.current;
      const random = randomRef.current;
      const initialCount = reducedMotionRef.current ? 18 : 26;
      for (let i = 0; i < initialCount; i += 1) {
        const stone = pickRandomStone(metrics.width, metrics.height, metrics.cell, random);
        stonesRef.current.set(stoneKey(stone.x, stone.y), stone);
      }
      syncStoneCount();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const context = canvas.getContext("2d");
      if (context) context.setTransform(dpr, 0, 0, dpr, 0, 0);
      metricsRef.current.width = rect.width;
      metricsRef.current.height = rect.height;
      metricsRef.current.cell = getCellSize(rect.width);
      setCellSize(metricsRef.current.cell);
      initializeStones();
    };

    const draw = (time: number) => {
      const context = canvas.getContext("2d");
      if (!context) return;

      const metrics = metricsRef.current;
      const cell = metrics.cell;
      const angle = reducedMotionRef.current ? 0 : Math.sin(time * 0.0001) * 0.022;
      metrics.angle = angle;
      containerRef.current?.setAttribute("data-grid-angle", angle.toFixed(4));

      context.clearRect(0, 0, metrics.width, metrics.height);
      context.fillStyle = "#04070b";
      context.fillRect(0, 0, metrics.width, metrics.height);

      const backgroundGradient = context.createRadialGradient(metrics.width * 0.72, metrics.height * 0.16, 0, metrics.width * 0.72, metrics.height * 0.16, metrics.width * 0.58);
      backgroundGradient.addColorStop(0, "rgba(0, 229, 255, 0.15)");
      backgroundGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = backgroundGradient;
      context.fillRect(0, 0, metrics.width, metrics.height);

      const bounds = getVisibleBounds(metrics.width, metrics.height, cell);
      context.save();
      context.lineWidth = 1;
      context.strokeStyle = "rgba(0, 229, 255, 0.2)";
      context.shadowColor = "rgba(0, 229, 255, 0.2)";
      context.shadowBlur = 5;
      context.beginPath();
      for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 1) {
        const start = gridToScreen(gridX, bounds.minY, metrics.width, metrics.height, cell, angle);
        const end = gridToScreen(gridX, bounds.maxY, metrics.width, metrics.height, cell, angle);
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
      }
      for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY += 1) {
        const start = gridToScreen(bounds.minX, gridY, metrics.width, metrics.height, cell, angle);
        const end = gridToScreen(bounds.maxX, gridY, metrics.width, metrics.height, cell, angle);
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
      }
      context.stroke();
      context.restore();

      context.save();
      for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 6) {
        for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY += 6) {
          const screen = gridToScreen(gridX, gridY, metrics.width, metrics.height, cell, angle);
          context.globalAlpha = 0.22;
          context.fillStyle = "rgba(200, 169, 106, 0.72)";
          context.beginPath();
          context.arc(screen.x, screen.y, 1.7, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();

      const stoneRadius = Math.min(18, cell * 0.34);
      stonesRef.current.forEach((stone) => {
        if (stone.x < bounds.minX || stone.x > bounds.maxX || stone.y < bounds.minY || stone.y > bounds.maxY) return;
        const screen = gridToScreen(stone.x, stone.y, metrics.width, metrics.height, cell, angle);
        drawStone(context, stone, screen.x, screen.y, stoneRadius, time, reducedMotionRef.current);
      });

      context.save();
      const vignette = context.createRadialGradient(metrics.width / 2, metrics.height / 2, metrics.width * 0.15, metrics.width / 2, metrics.height / 2, metrics.width * 0.72);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0.02)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.72)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, metrics.width, metrics.height);
      context.restore();

      animationRef.current = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    animationRef.current = window.requestAnimationFrame(draw);

    const randomTimer = reducedMotionRef.current
      ? null
      : window.setInterval(() => {
          const metrics = metricsRef.current;
          const random = randomRef.current;
          const stone = pickRandomStone(metrics.width, metrics.height, metrics.cell, random);
          stonesRef.current.set(stoneKey(stone.x, stone.y), stone);
          trimRandomStones();
          syncStoneCount();
        }, randomIntervalMs);

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
    };
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      window.removeEventListener("resize", resize);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
      if (randomTimer) window.clearInterval(randomTimer);
    };
  }, [syncStoneCount, trimRandomStones]);

  return (
    <div
      ref={containerRef}
      className="interactive-go-background"
      data-interactive-go-background
      data-stone-count={stoneCount}
      data-user-stone-count={userStoneCount}
      data-last-stone-color={lastStoneColor}
      data-last-placement={lastPlacement}
      data-cell-size={cellSize.toFixed(2)}
      data-grid-angle="0.0000"
      data-hover-point={hoverPoint ? `${hoverPoint.x}:${hoverPoint.y}` : ""}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="interactive-go-canvas"
        aria-label="交互围棋背景"
        data-visual="infinite-go-grid"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}
