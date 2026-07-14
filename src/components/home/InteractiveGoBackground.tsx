import React, { useCallback, useEffect, useRef, useState } from "react";
import { getRenderProfile, type RenderQuality } from "@/components/hero/renderQuality";
import {
  getDocumentRenderQuality,
  getHomeRenderPhase,
  HOME_RENDER_PHASE_EVENT,
  type HomeRenderPhase,
  type HomeRenderPhaseDetail
} from "@/lib/homeRenderPhase";
import {
  canPlaceStone,
  getCapturedOpponentKeys,
  getRandomPlacementMode,
  getVisibleOccupancy,
  stoneKey,
  type BoardStone,
  type RandomPlacementMode,
  type StoneColor,
  type StoneSource,
  type VisibleBounds
} from "./goRules";

type Stone = BoardStone;

type HoverPoint = {
  x: number;
  y: number;
} | null;

type LastPlacement = "hit" | "miss" | "occupied" | "none";
type PointerKind = "mouse" | "touch";
type GoRenderState = "paused" | "prepared" | "active" | "idle";

type GoPalette = {
  gridColor: string;
  gridShadow: string;
  glowSecondary: string;
  ripplePrimary: string;
  rippleSecondary: string;
};

type PlacementEffect = {
  x: number;
  y: number;
  color: StoneColor;
  source: StoneSource;
  createdAt: number;
  expiresAt: number;
};

type CaptureEffect = Stone & {
  capturedAt: number;
  expiresAt: number;
};

const randomIntervalMs = 1100;
const placementEffectMs = 1100;
const captureEffectMs = 560;
const stoneEntryMs = 260;
const defaultPalette: GoPalette = {
  gridColor: "rgba(0, 229, 255, 0.2)",
  gridShadow: "rgba(0, 229, 255, 0.18)",
  glowSecondary: "rgba(200, 169, 106, 0.11)",
  ripplePrimary: "rgba(90, 235, 255, 0.72)",
  rippleSecondary: "rgba(232, 196, 116, 0.54)"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCellSize(width: number) {
  return Math.min(52, Math.max(38, width * 0.05));
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
  scale: number,
  opacity = 1,
  glowBoost = 1
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
  ctx.globalAlpha = opacity;
  ctx.shadowBlur = scaledRadius * (scale > 1 ? 1.35 : 0.9) * glowBoost;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = stone.color === "black" ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.72)";
  ctx.stroke();
  ctx.restore();
}

function drawCaptureEffect(
  ctx: CanvasRenderingContext2D,
  effect: CaptureEffect,
  screenX: number,
  screenY: number,
  radius: number,
  cell: number,
  now: number,
  ripplePrimary: string,
  rippleSecondary: string,
  gridShadow: string
) {
  const progress = clamp((now - effect.capturedAt) / captureEffectMs, 0, 1);
  const fadeProgress = progress < 0.28 ? 0 : (progress - 0.28) / 0.72;
  const opacity = Math.pow(1 - fadeProgress, 1.28);
  const scale = 1 - 0.34 * progress;
  const color = effect.color === "black" ? ripplePrimary : rippleSecondary;

  drawStone(ctx, effect, screenX, screenY, radius, scale, opacity, 1.4 + (1 - progress) * 0.8);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = color;
  ctx.shadowColor = effect.color === "black" ? gridShadow : rippleSecondary;
  ctx.shadowBlur = 12 * (1 - progress);
  ctx.lineWidth = 0.85;
  ctx.globalAlpha = 0.24 * (1 - progress);
  ctx.beginPath();
  ctx.arc(screenX, screenY, cell * (0.54 + progress * 1.55), 0, Math.PI * 2);
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
  const captureEffectsRef = useRef<CaptureEffect[]>([]);
  const placementEffectTotalRef = useRef(0);
  const userPlacementEffectTotalRef = useRef(0);
  const captureTotalRef = useRef(0);
  const activePlacementEffectCountRef = useRef(0);
  const activeCaptureEffectCountRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const randomTimerRef = useRef<number | null>(null);
  const requestRenderRef = useRef<() => void>(() => undefined);
  const homePhaseRef = useRef<HomeRenderPhase>("intro");
  const renderQualityRef = useRef<RenderQuality>("balanced");
  const renderStateRef = useRef<GoRenderState>("paused");
  const renderFrameCountRef = useRef(0);
  const preparedRef = useRef(false);
  const paletteRef = useRef<GoPalette>(defaultPalette);
  const randomRef = useRef(createSeededRandom(20260629));
  const randomTickRef = useRef(0);
  const metricsRef = useRef({ width: 0, height: 0, cell: 48 });
  const visibleMetricsRef = useRef({
    visibleStoneCount: 0,
    visibleCapacity: 1,
    visibleOccupancy: 0,
    randomPlacementMode: "normal" as RandomPlacementMode
  });
  const reducedMotionRef = useRef(false);
  const hoverPointRef = useRef<HoverPoint>(null);
  const suppressMouseClickUntilRef = useRef(0);
  const [stoneCount, setStoneCount] = useState(0);
  const [userStoneCount, setUserStoneCount] = useState(0);
  const [visibleStoneCount, setVisibleStoneCount] = useState(0);
  const [visibleCapacity, setVisibleCapacity] = useState(1);
  const [visibleOccupancy, setVisibleOccupancy] = useState(0);
  const [randomPlacementMode, setRandomPlacementMode] = useState<RandomPlacementMode>("normal");
  const [placementEffectCount, setPlacementEffectCount] = useState(0);
  const [userPlacementEffectCount, setUserPlacementEffectCount] = useState(0);
  const [activePlacementEffectCount, setActivePlacementEffectCount] = useState(0);
  const [captureCount, setCaptureCount] = useState(0);
  const [activeCaptureEffectCount, setActiveCaptureEffectCount] = useState(0);
  const [cellSize, setCellSize] = useState(48);
  const [lastStoneColor, setLastStoneColor] = useState<StoneColor | "none">("none");
  const [lastPlacementEffect, setLastPlacementEffect] = useState<StoneColor | "none">("none");
  const [lastCapturedColor, setLastCapturedColor] = useState<StoneColor | "none">("none");
  const [lastPlacement, setLastPlacement] = useState<LastPlacement>("none");
  const [hoverPoint, setHoverPoint] = useState<HoverPoint>(null);
  const [renderState, setRenderState] = useState<GoRenderState>("paused");

  const syncStoneCount = useCallback(() => {
    const stones = Array.from(stonesRef.current.values());
    setStoneCount(stones.length);
    setUserStoneCount(stones.filter((stone) => stone.source === "user").length);
  }, []);

  const syncVisibleMetrics = useCallback((bounds?: VisibleBounds) => {
    const metrics = metricsRef.current;
    const visibleBounds = bounds ?? getVisibleBounds(metrics.width, metrics.height, metrics.cell);
    const next = getVisibleOccupancy(stonesRef.current, visibleBounds);
    const nextMode = getRandomPlacementMode(next.occupancy);
    const previous = visibleMetricsRef.current;

    if (
      previous.visibleStoneCount !== next.visibleStoneCount ||
      previous.visibleCapacity !== next.visibleCapacity ||
      Math.abs(previous.visibleOccupancy - next.occupancy) > 0.0001 ||
      previous.randomPlacementMode !== nextMode
    ) {
      visibleMetricsRef.current = {
        visibleStoneCount: next.visibleStoneCount,
        visibleCapacity: next.visibleCapacity,
        visibleOccupancy: next.occupancy,
        randomPlacementMode: nextMode
      };
      setVisibleStoneCount(next.visibleStoneCount);
      setVisibleCapacity(next.visibleCapacity);
      setVisibleOccupancy(next.occupancy);
      setRandomPlacementMode(nextMode);
    }

    return { ...next, randomPlacementMode: nextMode };
  }, []);

  const placeStone = useCallback(
    (x: number, y: number, color: StoneColor, source: StoneSource) => {
      const now = Date.now();
      if (!canPlaceStone(stonesRef.current, x, y)) {
        return false;
      }

      const placedStone: Stone = {
        x,
        y,
        color,
        source,
        createdAt: now
      };
      stonesRef.current.set(stoneKey(x, y), placedStone);

      const capturedKeys = getCapturedOpponentKeys(stonesRef.current, placedStone);
      const capturedStones = capturedKeys
        .map((key) => stonesRef.current.get(key))
        .filter((stone): stone is Stone => Boolean(stone));

      capturedKeys.forEach((key) => {
        stonesRef.current.delete(key);
      });

      if (capturedStones.length > 0) {
        captureTotalRef.current += capturedStones.length;
        setCaptureCount(captureTotalRef.current);
        setLastCapturedColor(capturedStones[0].color);
        if (!reducedMotionRef.current) {
          captureEffectsRef.current = [
            ...captureEffectsRef.current.slice(-18),
            ...capturedStones.map((stone) => ({
              ...stone,
              capturedAt: now,
              expiresAt: now + captureEffectMs
            }))
          ];
          activeCaptureEffectCountRef.current = captureEffectsRef.current.length;
          setActiveCaptureEffectCount(captureEffectsRef.current.length);
        }
      }

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
      syncStoneCount();
      syncVisibleMetrics();
      requestRenderRef.current();
      return true;
    },
    [syncStoneCount, syncVisibleMetrics]
  );

  const tryPlaceStoneFromClientPoint = useCallback(
    (clientX: number, clientY: number, color: StoneColor, pointerKind: PointerKind) => {
      if (homePhaseRef.current !== "main") return false;
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

      const placed = placeStone(point.x, point.y, color, "user");
      setLastPlacement(placed ? "hit" : "occupied");
      return placed;
    },
    [placeStone]
  );

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (homePhaseRef.current !== "main") return;
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
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = reducedMotionQuery.matches;
    homePhaseRef.current = getHomeRenderPhase();
    renderQualityRef.current = getDocumentRenderQuality();
    container.dataset.renderFrameCount = "0";
    container.dataset.randomTimerState = "stopped";
    container.dataset.renderQuality = renderQualityRef.current;
    container.dataset.handoffFrameReused = "false";

    const updateRenderState = (next: GoRenderState) => {
      if (renderStateRef.current === next) return;
      renderStateRef.current = next;
      setRenderState(next);
    };

    const stopAnimation = () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };

    const stopRandomTimer = () => {
      if (randomTimerRef.current !== null) window.clearInterval(randomTimerRef.current);
      randomTimerRef.current = null;
      container.dataset.randomTimerState = "stopped";
    };

    const readPalette = () => {
      paletteRef.current = {
        gridColor: readCssVariable(container, "--go-grid", defaultPalette.gridColor),
        gridShadow: readCssVariable(container, "--go-grid-shadow", defaultPalette.gridShadow),
        glowSecondary: readCssVariable(container, "--go-glow-secondary", defaultPalette.glowSecondary),
        ripplePrimary: readCssVariable(container, "--go-ripple-primary", defaultPalette.ripplePrimary),
        rippleSecondary: readCssVariable(container, "--go-ripple-secondary", defaultPalette.rippleSecondary)
      };
    };

    const initializeStones = () => {
      if (stonesRef.current.size > 0) return;
      const metrics = metricsRef.current;
      const random = randomRef.current;
      const initialCount = reducedMotionRef.current ? 18 : 26;
      const settledAt = Date.now() - stoneEntryMs;
      for (let i = 0; i < initialCount; i += 1) {
        const stone = pickRandomStone(metrics.width, metrics.height, metrics.cell, random);
        if (stonesRef.current.has(stoneKey(stone.x, stone.y))) continue;
        stonesRef.current.set(stoneKey(stone.x, stone.y), { ...stone, createdAt: settledAt });
      }
      syncStoneCount();
      syncVisibleMetrics();
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const profile = getRenderProfile(renderQualityRef.current);
      const dpr = Math.min(window.devicePixelRatio || 1, profile.goDprCap);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const context = canvas.getContext("2d");
      if (context) context.setTransform(dpr, 0, 0, dpr, 0, 0);
      metricsRef.current.width = rect.width;
      metricsRef.current.height = rect.height;
      metricsRef.current.cell = getCellSize(rect.width);
      setCellSize(metricsRef.current.cell);
      readPalette();
      initializeStones();
      return true;
    };

    const drawFrame = (continueAnimation: boolean) => {
      animationRef.current = null;
      const context = canvas.getContext("2d");
      if (!context) return;

      const wallTime = Date.now();
      const metrics = metricsRef.current;
      const cell = metrics.cell;
      const palette = paletteRef.current;
      container.setAttribute("data-grid-angle", "0.0000");
      renderFrameCountRef.current += 1;
      container.dataset.renderFrameCount = String(renderFrameCountRef.current);

      context.clearRect(0, 0, metrics.width, metrics.height);

      const bounds = getVisibleBounds(metrics.width, metrics.height, cell);
      syncVisibleMetrics(bounds);
      placementEffectsRef.current = placementEffectsRef.current.filter((effect) => effect.expiresAt > wallTime);
      const activeEffects = placementEffectsRef.current;
      if (activePlacementEffectCountRef.current !== activeEffects.length) {
        activePlacementEffectCountRef.current = activeEffects.length;
        setActivePlacementEffectCount(activeEffects.length);
      }
      captureEffectsRef.current = captureEffectsRef.current.filter((effect) => effect.expiresAt > wallTime);
      const activeCaptureEffects = captureEffectsRef.current;
      if (activeCaptureEffectCountRef.current !== activeCaptureEffects.length) {
        activeCaptureEffectCountRef.current = activeCaptureEffects.length;
        setActiveCaptureEffectCount(activeCaptureEffects.length);
      }

      context.save();
      context.lineWidth = 1;
      context.strokeStyle = palette.gridColor;
      context.shadowColor = palette.gridShadow;
      context.shadowBlur = 3;
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
          context.fillStyle = palette.glowSecondary;
          context.beginPath();
          context.arc(screen.x, screen.y, 1.7, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();

      activeEffects.forEach((effect) => {
        const screen = gridToScreen(effect.x, effect.y, metrics.width, metrics.height, cell);
        drawPlacementEffect(
          context,
          effect,
          screen.x,
          screen.y,
          cell,
          wallTime,
          palette.ripplePrimary,
          palette.rippleSecondary,
          palette.gridShadow
        );
      });

      const stoneRadius = Math.min(18, cell * 0.34);
      activeCaptureEffects.forEach((effect) => {
        if (effect.x < bounds.minX || effect.x > bounds.maxX || effect.y < bounds.minY || effect.y > bounds.maxY) return;
        const screen = gridToScreen(effect.x, effect.y, metrics.width, metrics.height, cell);
        drawCaptureEffect(
          context,
          effect,
          screen.x,
          screen.y,
          stoneRadius,
          cell,
          wallTime,
          palette.ripplePrimary,
          palette.rippleSecondary,
          palette.gridShadow
        );
      });

      let hasEnteringStone = false;
      stonesRef.current.forEach((stone) => {
        if (stone.x < bounds.minX || stone.x > bounds.maxX || stone.y < bounds.minY || stone.y > bounds.maxY) return;
        const screen = gridToScreen(stone.x, stone.y, metrics.width, metrics.height, cell);
        const stoneAge = wallTime - stone.createdAt;
        if (!reducedMotionRef.current && stoneAge >= 0 && stoneAge < stoneEntryMs) hasEnteringStone = true;
        drawStone(context, stone, screen.x, screen.y, stoneRadius, getStoneScale(stone, wallTime, reducedMotionRef.current));
      });

      const hasActiveAnimation =
        !reducedMotionRef.current &&
        (activeEffects.length > 0 || activeCaptureEffects.length > 0 || hasEnteringStone);
      if (continueAnimation && homePhaseRef.current === "main" && hasActiveAnimation && !document.hidden) {
        updateRenderState("active");
        animationRef.current = window.requestAnimationFrame(() => drawFrame(true));
        return;
      }

      updateRenderState(homePhaseRef.current === "main" ? "idle" : "prepared");
    };

    const requestRender = () => {
      if (homePhaseRef.current !== "main" || document.hidden || animationRef.current !== null) return;
      updateRenderState("active");
      animationRef.current = window.requestAnimationFrame(() => drawFrame(true));
    };
    requestRenderRef.current = requestRender;

    const startRandomTimer = () => {
      if (reducedMotionRef.current || randomTimerRef.current !== null || homePhaseRef.current !== "main") return;
      randomTimerRef.current = window.setInterval(() => {
          const metrics = metricsRef.current;
          const random = randomRef.current;
          const bounds = getVisibleBounds(metrics.width, metrics.height, metrics.cell);
          const { randomPlacementMode: mode } = syncVisibleMetrics(bounds);
          randomTickRef.current += 1;

          if (mode === "paused") return;
          if (mode === "throttled" && randomTickRef.current % 3 !== 0) return;

          for (let attempt = 0; attempt < 8; attempt += 1) {
            const stone = pickRandomStone(metrics.width, metrics.height, metrics.cell, random);
            if (placeStone(stone.x, stone.y, stone.color, "random")) break;
          }
        }, randomIntervalMs);
      container.dataset.randomTimerState = "running";
    };

    const prepareBackground = () => {
      stopAnimation();
      if (!resizeCanvas()) return;
      drawFrame(false);
      preparedRef.current = true;
      container.dataset.handoffFrameReused = "false";
      updateRenderState("prepared");
    };

    const activateMain = () => {
      stopAnimation();
      if (!preparedRef.current) {
        if (!resizeCanvas()) return;
        drawFrame(false);
        container.dataset.handoffFrameReused = "false";
      } else {
        container.dataset.handoffFrameReused = "true";
      }
      preparedRef.current = true;
      updateRenderState("idle");
      startRandomTimer();
    };

    const applyRenderPhase = (phase: HomeRenderPhase, quality: RenderQuality) => {
      homePhaseRef.current = phase;
      renderQualityRef.current = quality;
      container.dataset.renderQuality = quality;

      if (phase === "intro" || phase === "transition") {
        stopAnimation();
        stopRandomTimer();
        preparedRef.current = false;
        updateRenderState("paused");
        return;
      }
      if (phase === "handoff") {
        stopRandomTimer();
        prepareBackground();
        return;
      }
      activateMain();
    };

    const handleRenderPhase = (event: Event) => {
      const detail = (event as CustomEvent<HomeRenderPhaseDetail>).detail;
      if (!detail) return;
      applyRenderPhase(detail.phase, detail.quality);
    };

    const handleResize = () => {
      if (homePhaseRef.current !== "handoff" && homePhaseRef.current !== "main") return;
      stopAnimation();
      if (resizeCanvas()) drawFrame(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAnimation();
        stopRandomTimer();
        if (homePhaseRef.current === "main") updateRenderState("idle");
        return;
      }
      if (homePhaseRef.current === "main") activateMain();
    };

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      if (event.matches) {
        placementEffectsRef.current = [];
        captureEffectsRef.current = [];
        activePlacementEffectCountRef.current = 0;
        activeCaptureEffectCountRef.current = 0;
        setActivePlacementEffectCount(0);
        setActiveCaptureEffectCount(0);
        stopAnimation();
        stopRandomTimer();
        if (homePhaseRef.current === "main") drawFrame(false);
        return;
      }
      if (homePhaseRef.current === "main") startRandomTimer();
    };

    window.addEventListener(HOME_RENDER_PHASE_EVENT, handleRenderPhase);
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    applyRenderPhase(getHomeRenderPhase(), getDocumentRenderQuality());

    return () => {
      window.removeEventListener(HOME_RENDER_PHASE_EVENT, handleRenderPhase);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      stopAnimation();
      stopRandomTimer();
      requestRenderRef.current = () => undefined;
    };
  }, [placeStone, syncStoneCount, syncVisibleMetrics]);

  return (
    <div
      ref={containerRef}
      className="interactive-go-background"
      data-interactive-go-background
      data-stone-count={stoneCount}
      data-user-stone-count={userStoneCount}
      data-visible-stone-count={visibleStoneCount}
      data-visible-capacity={visibleCapacity}
      data-visible-occupancy={visibleOccupancy.toFixed(4)}
      data-random-placement-mode={randomPlacementMode}
      data-placement-effect-count={placementEffectCount}
      data-user-placement-effect-count={userPlacementEffectCount}
      data-active-placement-effect-count={activePlacementEffectCount}
      data-placement-effect-visual="grid-distortion-wave"
      data-capture-count={captureCount}
      data-active-capture-effect-count={activeCaptureEffectCount}
      data-last-stone-color={lastStoneColor}
      data-last-placement-effect={lastPlacementEffect}
      data-last-captured-color={lastCapturedColor}
      data-last-placement={lastPlacement}
      data-cell-size={cellSize.toFixed(2)}
      data-grid-angle="0.0000"
      data-render-state={renderState}
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
