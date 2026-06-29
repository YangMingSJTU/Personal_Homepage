import React, { useCallback, useEffect, useRef, useState } from "react";

type StoneColor = "black" | "white";
type StoneSource = "user" | "random";

type Stone = {
  x: number;
  y: number;
  color: StoneColor;
  source: StoneSource;
  createdAt: number;
};

type HoverPoint = {
  x: number;
  y: number;
} | null;

type LastPlacement = "hit" | "miss" | "none";
type PointerKind = "mouse" | "touch";

type PlacementEffect = {
  x: number;
  y: number;
  color: StoneColor;
  source: StoneSource;
  createdAt: number;
  expiresAt: number;
};

const maxStones = 90;
const randomIntervalMs = 1100;
const placementEffectMs = 1100;
const stoneEntryMs = 260;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

function gridToScreen(x: number, y: number, width: number, height: number, cell: number) {
  return {
    x: width / 2 + x * cell,
    y: height / 2 + y * cell
  };
}

function screenToGridHit(x: number, y: number, width: number, height: number, cell: number) {
  const gridX = Math.round((x - width / 2) / cell);
  const gridY = Math.round((y - height / 2) / cell);
  const screen = gridToScreen(gridX, gridY, width, height, cell);

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
  const now = Date.now();
  return {
    x,
    y,
    color: random() > 0.5 ? "black" : "white",
    source: "random",
    createdAt: now
  };
}

function readCssVariable(element: HTMLElement, name: string, fallback: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  stone: Stone,
  screenX: number,
  screenY: number,
  radius: number,
  scale: number
) {
  const scaledRadius = radius * scale;
  const gradient = ctx.createRadialGradient(screenX - scaledRadius * 0.32, screenY - scaledRadius * 0.38, scaledRadius * 0.12, screenX, screenY, scaledRadius);
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
  ctx.shadowBlur = scaledRadius * (scale > 1 ? 1.35 : 0.9);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = stone.color === "black" ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.72)";
  ctx.stroke();
  ctx.restore();
}

function getStoneScale(stone: Stone, now: number, reducedMotion: boolean) {
  if (reducedMotion) return 1;
  const age = now - stone.createdAt;
  if (age <= 0 || age >= stoneEntryMs) return 1;
  const progress = age / stoneEntryMs;
  if (progress < 0.72) {
    return 0.72 + (1.04 - 0.72) * Math.sin((progress / 0.72) * (Math.PI / 2));
  }
  return 1.04 - 0.04 * ((progress - 0.72) / 0.28);
}

function drawPlacementEffect(
  ctx: CanvasRenderingContext2D,
  effect: PlacementEffect,
  screenX: number,
  screenY: number,
  cell: number,
  now: number,
  ripplePrimary: string,
  rippleSecondary: string,
  gridShadow: string
) {
  const progress = clamp((now - effect.createdAt) / placementEffectMs, 0, 1);
  const easeOut = 1 - Math.pow(1 - progress, 3);
  const sourceStrength = effect.source === "user" ? 1 : 0.58;
  const alpha = (1 - progress) * sourceStrength;
  const color = effect.color === "black" ? ripplePrimary : rippleSecondary;
  const shadowColor = effect.color === "black" ? gridShadow : rippleSecondary;
  const radius = cell * (0.4 + easeOut * 2.45);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const fill = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
  fill.addColorStop(0, color);
  fill.addColorStop(0.22, color);
  fill.addColorStop(0.58, "rgba(0, 0, 0, 0)");
  fill.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.globalAlpha = alpha * 0.18;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
  ctx.fill();

  [1, 0.62].forEach((ratio, index) => {
    ctx.globalAlpha = alpha * (index === 0 ? 0.54 : 0.3);
    ctx.strokeStyle = color;
    ctx.lineWidth = index === 0 ? 1.15 : 0.75;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 18 * (1 - progress);
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius * ratio, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();

  ctx.save();
  const coreRadius = cell * (0.22 + (1 - progress) * 0.42);
  const core = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, coreRadius);
  core.addColorStop(0, color);
  core.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.globalAlpha = alpha * 0.58;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(screenX, screenY, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getDistortedScreenPoint(
  screenX: number,
  screenY: number,
  effects: PlacementEffect[],
  width: number,
  height: number,
  cell: number,
  now: number
) {
  let distortedX = screenX;
  let distortedY = screenY;

  effects.forEach((effect) => {
    const progress = clamp((now - effect.createdAt) / placementEffectMs, 0, 1);
    if (progress >= 1) return;

    const center = gridToScreen(effect.x, effect.y, width, height, cell);
    const deltaX = screenX - center.x;
    const deltaY = screenY - center.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 0.001) return;

    const maxRadius = cell * 4.25;
    if (distance > maxRadius + cell) return;

    const waveFront = cell * 0.34 + progress * maxRadius;
    const bandWidth = cell * 1.28;
    const bandFalloff = clamp(1 - Math.abs(distance - waveFront) / bandWidth, 0, 1);
    const radialFalloff = clamp(1 - distance / (maxRadius + cell), 0, 1);
    const timeFade = Math.pow(1 - progress, 1.32);
    const sourceStrength = effect.source === "user" ? 1 : 0.58;
    const phase = distance * 0.19 - progress * Math.PI * 7.4;
    const amplitude = cell * 0.18 * sourceStrength * timeFade * bandFalloff * (0.38 + radialFalloff * 0.62);
    const displacement = Math.sin(phase) * amplitude;

    distortedX += (deltaX / distance) * displacement;
    distortedY += (deltaY / distance) * displacement;
  });

  return { x: distortedX, y: distortedY };
}

function drawDistortedGridLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  effects: PlacementEffect[],
  width: number,
  height: number,
  cell: number,
  now: number
) {
  if (effects.length === 0) {
    const start = gridToScreen(startX, startY, width, height, cell);
    const end = gridToScreen(endX, endY, width, height, cell);
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    return;
  }

  const distanceInCells = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
  const steps = Math.max(1, Math.ceil(distanceInCells / 0.24));

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const gridX = startX + (endX - startX) * progress;
    const gridY = startY + (endY - startY) * progress;
    const screen = gridToScreen(gridX, gridY, width, height, cell);
    const point = getDistortedScreenPoint(screen.x, screen.y, effects, width, height, cell, now);
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
}

export default function InteractiveGoBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stonesRef = useRef<Map<string, Stone>>(new Map());
  const placementEffectsRef = useRef<PlacementEffect[]>([]);
  const placementEffectTotalRef = useRef(0);
  const userPlacementEffectTotalRef = useRef(0);
  const activePlacementEffectCountRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const randomRef = useRef(createSeededRandom(20260629));
  const metricsRef = useRef({ width: 0, height: 0, cell: 48 });
  const reducedMotionRef = useRef(false);
  const hoverPointRef = useRef<HoverPoint>(null);
  const suppressMouseClickUntilRef = useRef(0);
  const [stoneCount, setStoneCount] = useState(0);
  const [userStoneCount, setUserStoneCount] = useState(0);
  const [placementEffectCount, setPlacementEffectCount] = useState(0);
  const [userPlacementEffectCount, setUserPlacementEffectCount] = useState(0);
  const [activePlacementEffectCount, setActivePlacementEffectCount] = useState(0);
  const [cellSize, setCellSize] = useState(48);
  const [lastStoneColor, setLastStoneColor] = useState<StoneColor | "none">("none");
  const [lastPlacementEffect, setLastPlacementEffect] = useState<StoneColor | "none">("none");
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
      const now = Date.now();
      stonesRef.current.set(stoneKey(x, y), {
        x,
        y,
        color,
        source,
        createdAt: now
      });
      if (!reducedMotionRef.current) {
        placementEffectsRef.current = [
          ...placementEffectsRef.current.slice(-9),
          { x, y, color, source, createdAt: now, expiresAt: now + placementEffectMs }
        ];
        placementEffectTotalRef.current += 1;
        activePlacementEffectCountRef.current = placementEffectsRef.current.length;
        setPlacementEffectCount(placementEffectTotalRef.current);
        setActivePlacementEffectCount(placementEffectsRef.current.length);
        if (source === "user") {
          userPlacementEffectTotalRef.current += 1;
          setUserPlacementEffectCount(userPlacementEffectTotalRef.current);
        }
      }
      if (source === "user") {
        setLastStoneColor(color);
        setLastPlacementEffect(color);
      }
      trimRandomStones();
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
      const point = screenToGridHit(clientX - rect.left, clientY - rect.top, metrics.width, metrics.height, metrics.cell);
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
    const point = screenToGridHit(event.clientX - rect.left, event.clientY - rect.top, metrics.width, metrics.height, metrics.cell);
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
      if (Date.now() < suppressMouseClickUntilRef.current) return;
      tryPlaceStoneFromClientPoint(event.clientX, event.clientY, "black", "mouse");
    },
    [tryPlaceStoneFromClientPoint]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse") return;
      event.preventDefault();
      suppressMouseClickUntilRef.current = Date.now() + 700;
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

    const draw = () => {
      const context = canvas.getContext("2d");
      if (!context) return;

      const wallTime = Date.now();
      const metrics = metricsRef.current;
      const cell = metrics.cell;
      const container = containerRef.current;
      container?.setAttribute("data-grid-angle", "0.0000");
      const canvasHost = container ?? canvas;
      const backgroundColor = readCssVariable(canvasHost, "--go-bg", "#08111c");
      const gridColor = readCssVariable(canvasHost, "--go-grid", "rgba(0, 229, 255, 0.2)");
      const gridShadow = readCssVariable(canvasHost, "--go-grid-shadow", "rgba(0, 229, 255, 0.18)");
      const glowPrimary = readCssVariable(canvasHost, "--go-glow-primary", "rgba(0, 229, 255, 0.16)");
      const glowSecondary = readCssVariable(canvasHost, "--go-glow-secondary", "rgba(200, 169, 106, 0.11)");
      const ripplePrimary = readCssVariable(canvasHost, "--go-ripple-primary", "rgba(90, 235, 255, 0.72)");
      const rippleSecondary = readCssVariable(canvasHost, "--go-ripple-secondary", "rgba(232, 196, 116, 0.54)");
      const scanColor = readCssVariable(canvasHost, "--go-scan", "rgba(255, 255, 255, 0.025)");
      const vignetteEdge = readCssVariable(canvasHost, "--go-vignette-edge", "rgba(0, 0, 0, 0.58)");

      context.clearRect(0, 0, metrics.width, metrics.height);
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, metrics.width, metrics.height);

      const backgroundGradient = context.createRadialGradient(metrics.width * 0.72, metrics.height * 0.16, 0, metrics.width * 0.72, metrics.height * 0.16, metrics.width * 0.58);
      backgroundGradient.addColorStop(0, glowPrimary);
      backgroundGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = backgroundGradient;
      context.fillRect(0, 0, metrics.width, metrics.height);

      const bounds = getVisibleBounds(metrics.width, metrics.height, cell);
      placementEffectsRef.current = placementEffectsRef.current.filter((effect) => effect.expiresAt > wallTime);
      const activeEffects = placementEffectsRef.current;
      if (activePlacementEffectCountRef.current !== activeEffects.length) {
        activePlacementEffectCountRef.current = activeEffects.length;
        setActivePlacementEffectCount(activeEffects.length);
      }

      context.save();
      context.lineWidth = 1;
      context.strokeStyle = gridColor;
      context.shadowColor = gridShadow;
      context.shadowBlur = 5;
      context.beginPath();
      for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 1) {
        drawDistortedGridLine(context, gridX, bounds.minY, gridX, bounds.maxY, activeEffects, metrics.width, metrics.height, cell, wallTime);
      }
      for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY += 1) {
        drawDistortedGridLine(context, bounds.minX, gridY, bounds.maxX, gridY, activeEffects, metrics.width, metrics.height, cell, wallTime);
      }
      context.stroke();
      context.restore();

      context.save();
      for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 6) {
        for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY += 6) {
          const screen = gridToScreen(gridX, gridY, metrics.width, metrics.height, cell);
          context.globalAlpha = 0.22;
          context.fillStyle = glowSecondary;
          context.beginPath();
          context.arc(screen.x, screen.y, 1.7, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();

      activeEffects.forEach((effect) => {
        const screen = gridToScreen(effect.x, effect.y, metrics.width, metrics.height, cell);
        drawPlacementEffect(context, effect, screen.x, screen.y, cell, wallTime, ripplePrimary, rippleSecondary, gridShadow);
      });

      const stoneRadius = Math.min(18, cell * 0.34);
      stonesRef.current.forEach((stone) => {
        if (stone.x < bounds.minX || stone.x > bounds.maxX || stone.y < bounds.minY || stone.y > bounds.maxY) return;
        const screen = gridToScreen(stone.x, stone.y, metrics.width, metrics.height, cell);
        drawStone(context, stone, screen.x, screen.y, stoneRadius, getStoneScale(stone, wallTime, reducedMotionRef.current));
      });

      context.save();
      const vignette = context.createRadialGradient(metrics.width / 2, metrics.height / 2, metrics.width * 0.15, metrics.width / 2, metrics.height / 2, metrics.width * 0.72);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0.02)");
      vignette.addColorStop(1, vignetteEdge);
      context.fillStyle = vignette;
      context.fillRect(0, 0, metrics.width, metrics.height);
      context.restore();

      context.save();
      context.fillStyle = scanColor;
      for (let y = 0; y < metrics.height; y += 7) {
        context.fillRect(0, y, metrics.width, 1);
      }
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
          for (let attempt = 0; attempt < 8; attempt += 1) {
            const stone = pickRandomStone(metrics.width, metrics.height, metrics.cell, random);
            const key = stoneKey(stone.x, stone.y);
            if (stonesRef.current.has(key)) continue;
            placeStone(stone.x, stone.y, stone.color, "random");
            break;
          }
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
  }, [placeStone, syncStoneCount, trimRandomStones]);

  return (
    <div
      ref={containerRef}
      className="interactive-go-background"
      data-interactive-go-background
      data-stone-count={stoneCount}
      data-user-stone-count={userStoneCount}
      data-placement-effect-count={placementEffectCount}
      data-user-placement-effect-count={userPlacementEffectCount}
      data-active-placement-effect-count={activePlacementEffectCount}
      data-placement-effect-visual="grid-distortion-wave"
      data-last-stone-color={lastStoneColor}
      data-last-placement-effect={lastPlacementEffect}
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
