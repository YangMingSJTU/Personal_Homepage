export type ParticleMorphPhase = "disintegrate" | "stream" | "assemble" | "settle" | "done";

type ParticleTargetKind = "text" | "avatar" | "grid" | "fallback";

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type Point = {
  x: number;
  y: number;
};

type ParticlePoint = Point & {
  color: RgbColor;
  kind?: ParticleTargetKind;
};

type MorphParticle = {
  source: ParticlePoint;
  target: ParticlePoint;
  sourceControl: Point;
  entryControl: Point;
  streamEntry: Point;
  streamExit: Point;
  exitControl: Point;
  targetControl: Point;
  depth: number;
  streamPhase: number;
  streamRadius: number;
  size: number;
  alpha: number;
  delay: number;
  travelDuration: number;
  trailStep: number;
};

type ParticleMorphOptions = {
  canvas: HTMLCanvasElement;
  sourceTextElements: HTMLElement[];
  targetTextElements: HTMLElement[];
  targetAvatar: HTMLElement | null;
  targetGrid: HTMLElement | null;
  gridCellSize: number;
  duration?: number;
  onProgress?: (progress: number) => void;
  onPhaseChange?: (phase: ParticleMorphPhase) => void;
  onComplete?: () => void;
};

type ParticleMorphController = {
  cancel: () => void;
  particleCount: number;
  sourcePointCount: number;
  targetPointCount: number;
};

const WHITE: RgbColor = { r: 238, g: 249, b: 255 };
const CYAN: RgbColor = { r: 116, g: 229, b: 246 };
const BLUE: RgbColor = { r: 103, g: 146, b: 255 };
const VIOLET: RgbColor = { r: 191, g: 111, b: 255 };
const GOLD: RgbColor = { r: 217, g: 189, b: 120 };
const AMBIENT_COLORS: RgbColor[] = [CYAN, BLUE, VIOLET, WHITE];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edgeStart: number, edgeEnd: number, value: number) {
  const normalized = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function fontFromElement(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function drawTextElement(context: CanvasRenderingContext2D, element: HTMLElement) {
  const leaves = Array.from(element.querySelectorAll(":scope > span")) as HTMLElement[];
  const textElements = leaves.length > 1 ? leaves : [element];

  for (const textElement of textElements) {
    const text = textElement.textContent?.replace(/\u00a0/g, " ") ?? "";
    const rect = textElement.getBoundingClientRect();
    if (!text.trim() || rect.width <= 0 || rect.height <= 0) continue;

    context.font = fontFromElement(textElement);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
}

function sampleTextPoints(
  elements: HTMLElement[],
  width: number,
  height: number,
  budget: number,
  color: RgbColor,
  kind?: ParticleTargetKind
) {
  const mask = document.createElement("canvas");
  const context = mask.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  mask.width = Math.ceil(width);
  mask.height = Math.ceil(height);
  context.fillStyle = "#fff";
  for (const element of elements) drawTextElement(context, element);

  const image = context.getImageData(0, 0, mask.width, mask.height).data;
  const step = width < 720 ? 4 : 5;
  const points: ParticlePoint[] = [];

  for (let y = 0; y < mask.height; y += step) {
    for (let x = 0; x < mask.width; x += step) {
      if (image[(y * mask.width + x) * 4 + 3] < 48) continue;
      points.push({ x, y, color, kind });
    }
  }

  return shuffle(points).slice(0, budget);
}

function buildFallbackPoints(width: number, height: number, count: number, kind?: ParticleTargetKind) {
  return Array.from({ length: count }, () => ({
    x: width * (0.36 + Math.random() * 0.28),
    y: height * (0.36 + Math.random() * 0.24),
    color: Math.random() > 0.34 ? WHITE : CYAN,
    kind
  }));
}

function buildAmbientSources(width: number, height: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const edgeBiased = Math.random() < 0.68;
    let x = Math.random() * width;
    if (edgeBiased) {
      x = Math.random() < 0.5 ? Math.random() * width * 0.26 : width * (0.74 + Math.random() * 0.26);
    }
    return {
      x,
      y: height * (0.06 + Math.random() * 0.88),
      color: AMBIENT_COLORS[index % AMBIENT_COLORS.length]
    };
  });
}

function buildAvatarTargets(avatar: HTMLElement | null, count: number) {
  if (!avatar) return [];
  const rect = avatar.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return Array.from({ length: count }, (_, index): ParticlePoint => {
    const angle = (index / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    const ring = Math.random() < 0.76;
    const radius = ring ? rect.width * (0.47 + Math.random() * 0.055) : rect.width * Math.sqrt(Math.random()) * 0.41;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      color: ring ? WHITE : GOLD,
      kind: "avatar"
    };
  });
}

function buildGridTargets(grid: HTMLElement | null, cellSize: number, count: number) {
  const rect = grid?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return [];
  const cell = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 46;
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  return Array.from({ length: count }, (_, index): ParticlePoint => {
    const rawX = rect.left + Math.random() * rect.width;
    const rawY = rect.top + Math.random() * rect.height;
    return {
      x: originX + Math.round((rawX - originX) / cell) * cell,
      y: originY + Math.round((rawY - originY) / cell) * cell,
      color: index % 5 === 0 ? WHITE : CYAN,
      kind: "grid"
    };
  });
}

function sortByPolarPosition(points: ParticlePoint[], width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  return [...points].sort((left, right) => {
    const leftAngle = Math.atan2(left.y - centerY, left.x - centerX);
    const rightAngle = Math.atan2(right.y - centerY, right.x - centerX);
    return leftAngle - rightAngle;
  });
}

function buildParticles(
  sources: ParticlePoint[],
  targets: ParticlePoint[],
  count: number,
  width: number,
  height: number
) {
  const orderedSources = sortByPolarPosition(sources, width, height);
  const orderedTargets = sortByPolarPosition(targets, width, height);
  const targetDelay: Record<ParticleTargetKind, number> = {
    grid: 0,
    avatar: 0.04,
    text: 0.075,
    fallback: 0.025
  };
  const targetFinish: Record<ParticleTargetKind, number> = {
    grid: 0.84,
    avatar: 0.92,
    text: 0.975,
    fallback: 0.92
  };

  return Array.from({ length: count }, (_, index): MorphParticle => {
    const source = orderedSources[Math.floor((index / count) * orderedSources.length) % orderedSources.length];
    const target = orderedTargets[Math.floor((index / count) * orderedTargets.length) % orderedTargets.length];
    const targetKind = target.kind ?? "fallback";
    const lane = (index % 3) - 1;
    const strand = ((Math.floor(index / 3) % 9) - 4) / 4;
    const depth = ((index * 37) % 101) / 100;
    const jitter = (Math.random() - 0.5) * (8 + depth * 10);
    const streamEntry = {
      x:
        width * 0.5 +
        lane * width * (0.025 + depth * 0.018) +
        strand * width * (0.012 + depth * 0.008) +
        jitter,
      y: height * (0.41 + (depth - 0.5) * 0.045 + strand * 0.028)
    };
    const streamExit = {
      x:
        width * 0.5 -
        lane * width * (0.052 + depth * 0.024) +
        strand * width * (0.02 + depth * 0.009) -
        jitter * 0.8,
      y: height * (0.67 + (depth - 0.5) * 0.055 - strand * 0.024)
    };
    const sourceSweep = (source.y / Math.max(1, height)) * 0.025 +
      (Math.abs(source.x - width / 2) / Math.max(1, width)) * 0.035;
    const delay = clamp(sourceSweep + targetDelay[targetKind] + Math.random() * 0.014, 0, 0.16);

    return {
      source,
      target,
      sourceControl: {
        x: source.x + (streamEntry.x - source.x) * 0.38 + lane * (18 + depth * 26),
        y: source.y + (streamEntry.y - source.y) * 0.18 - (1 - depth) * 24
      },
      entryControl: {
        x: streamEntry.x + lane * (24 + depth * 34),
        y: streamEntry.y - height * (0.075 + depth * 0.025)
      },
      streamEntry,
      streamExit,
      exitControl: {
        x: streamExit.x - lane * (30 + depth * 42),
        y: streamExit.y + height * (0.07 + depth * 0.02)
      },
      targetControl: {
        x: streamExit.x + (target.x - streamExit.x) * 0.64 - lane * (18 + depth * 30),
        y: streamExit.y + (target.y - streamExit.y) * 0.46 + (1 - depth) * 20
      },
      depth,
      streamPhase: lane * 1.25 + strand * 1.7 + depth * Math.PI,
      streamRadius: 17 + depth * 31 + Math.abs(strand) * 8,
      size: 0.7 + depth * 1.65 + (index % 17 === 0 ? 0.85 : 0),
      alpha: 0.38 + depth * 0.42,
      delay,
      travelDuration: Math.max(0.56, targetFinish[targetKind] - delay + depth * 0.012),
      trailStep: 0.012 + depth * 0.012
    };
  });
}

function cubicPoint(start: Point, controlA: Point, controlB: Point, end: Point, progress: number) {
  const inverse = 1 - progress;
  const startWeight = inverse * inverse * inverse;
  const controlAWeight = 3 * inverse * inverse * progress;
  const controlBWeight = 3 * inverse * progress * progress;
  const endWeight = progress * progress * progress;

  return {
    x: startWeight * start.x + controlAWeight * controlA.x + controlBWeight * controlB.x + endWeight * end.x,
    y: startWeight * start.y + controlAWeight * controlA.y + controlBWeight * controlB.y + endWeight * end.y
  };
}

function pointOnMagneticPath(particle: MorphParticle, progress: number) {
  if (progress <= 0.3) {
    const local = easeInOutCubic(progress / 0.3);
    return cubicPoint(
      particle.source,
      particle.sourceControl,
      particle.entryControl,
      particle.streamEntry,
      local
    );
  }

  if (progress <= 0.64) {
    const local = smoothstep(0, 1, (progress - 0.3) / 0.34);
    const envelope = Math.sin(Math.PI * local);
    const orbit = particle.streamPhase + local * Math.PI * 2;
    return {
      x:
        particle.streamEntry.x +
        (particle.streamExit.x - particle.streamEntry.x) * local +
        Math.cos(orbit) * particle.streamRadius * envelope,
      y:
        particle.streamEntry.y +
        (particle.streamExit.y - particle.streamEntry.y) * local +
        Math.sin(orbit) * particle.streamRadius * 0.32 * envelope
    };
  }

  const local = easeInOutCubic((progress - 0.64) / 0.36);
  return cubicPoint(
    particle.streamExit,
    particle.exitControl,
    particle.targetControl,
    particle.target,
    local
  );
}

function mixColor(source: RgbColor, target: RgbColor, progress: number) {
  return {
    r: Math.round(source.r + (target.r - source.r) * progress),
    g: Math.round(source.g + (target.g - source.g) * progress),
    b: Math.round(source.b + (target.b - source.b) * progress)
  };
}

function drawParticle(context: CanvasRenderingContext2D, particle: MorphParticle, progress: number) {
  const local = (progress - particle.delay) / particle.travelDuration;
  if (local <= 0 || local >= 1) return;

  const current = pointOnMagneticPath(particle, local);
  const trailA = pointOnMagneticPath(particle, Math.max(0, local - particle.trailStep));
  const trailB = pointOnMagneticPath(particle, Math.max(0, local - particle.trailStep * 2.1));
  const trailC = pointOnMagneticPath(particle, Math.max(0, local - particle.trailStep * 3.3));
  const color = mixColor(particle.source.color, particle.target.color, smoothstep(0.46, 0.92, local));
  const fadeIn = smoothstep(0, 0.08, local);
  const fadeOut = 1 - smoothstep(0.9, 1, local);
  const streamBoost = smoothstep(0.22, 0.42, local) * (1 - smoothstep(0.68, 0.86, local));
  const alpha = particle.alpha * fadeIn * fadeOut;
  const size = particle.size * (1 + streamBoost * (0.52 + particle.depth * 0.28));

  context.globalAlpha = alpha * 0.68;
  context.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.92)`;
  context.lineWidth = Math.max(0.7, size * 0.58);
  context.beginPath();
  context.moveTo(trailC.x, trailC.y);
  context.lineTo(trailB.x, trailB.y);
  context.lineTo(trailA.x, trailA.y);
  context.lineTo(current.x, current.y);
  context.stroke();

  context.globalAlpha = alpha * 0.24;
  context.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`;
  context.beginPath();
  context.arc(current.x, current.y, size * (2.4 + streamBoost * 1.2), 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = alpha;
  context.fillStyle = `rgba(${Math.min(255, color.r + 30)}, ${Math.min(255, color.g + 30)}, ${Math.min(255, color.b + 30)}, 0.98)`;
  context.beginPath();
  context.arc(current.x, current.y, size, 0, Math.PI * 2);
  context.fill();
}

function drawStreamField(context: CanvasRenderingContext2D, width: number, height: number, progress: number) {
  const intensity = smoothstep(0.12, 0.3, progress) * (1 - smoothstep(0.62, 0.8, progress));
  if (intensity <= 0) return;

  const colors = [VIOLET, WHITE, CYAN];
  context.save();
  context.lineCap = "round";

  for (let index = 0; index < 3; index += 1) {
    const lane = index - 1;
    const color = colors[index];
    context.globalAlpha = intensity * (index === 1 ? 0.34 : 0.24);
    context.strokeStyle = `rgb(${color.r} ${color.g} ${color.b})`;
    context.lineWidth = index === 1 ? 1.35 : 0.9;
    context.setLineDash([2 + index, 14 + index * 4]);
    context.lineDashOffset = -progress * 320 + lane * 12;
    context.beginPath();
    context.moveTo(width * (0.5 + lane * 0.03), height * 0.29);
    context.bezierCurveTo(
      width * (0.5 + lane * 0.075),
      height * 0.42,
      width * (0.5 - lane * 0.1),
      height * 0.58,
      width * (0.5 - lane * 0.065),
      height * 0.73
    );
    context.stroke();
  }

  context.restore();
}

function drawGridIgnition(context: CanvasRenderingContext2D, targets: ParticlePoint[], progress: number) {
  const stage = smoothstep(0.44, 0.84, progress);
  if (stage <= 0 || stage >= 1 || targets.length === 0) return;

  const stride = Math.max(1, Math.ceil(targets.length / 72));
  let visibleIndex = 0;
  for (let index = 0; index < targets.length; index += stride) {
    const target = targets[index];
    const order = (visibleIndex % 72) / 72;
    const local = clamp((stage - order * 0.72) / 0.22, 0, 1);
    const intensity = Math.sin(Math.PI * local);
    visibleIndex += 1;
    if (intensity <= 0) continue;

    context.globalAlpha = intensity * 0.16;
    context.fillStyle = "rgba(116, 229, 246, 0.28)";
    context.beginPath();
    context.arc(target.x, target.y, 5.5, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = intensity * 0.72;
    context.fillStyle = "rgba(238, 249, 255, 0.94)";
    context.beginPath();
    context.arc(target.x, target.y, 1.1, 0, Math.PI * 2);
    context.fill();
  }
}

function drawTargetHalo(context: CanvasRenderingContext2D, avatar: HTMLElement | null, progress: number) {
  if (!avatar) return;
  const rect = avatar.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const arrival = smoothstep(0.58, 0.9, progress);
  const fade = 1 - smoothstep(0.95, 1, progress);
  const intensity = arrival * fade;
  if (intensity <= 0) return;

  const radius = rect.width * (0.5 + arrival * 0.28);
  const gradient = context.createRadialGradient(centerX, centerY, rect.width * 0.22, centerX, centerY, radius);
  gradient.addColorStop(0, "rgba(238, 249, 255, 0)");
  gradient.addColorStop(0.68, `rgba(116, 229, 246, ${0.13 * intensity})`);
  gradient.addColorStop(1, "rgba(191, 111, 255, 0)");
  context.globalAlpha = 1;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();

  const settle = smoothstep(0.82, 1, progress);
  const ringAlpha = Math.sin(Math.PI * settle) * 0.42;
  if (ringAlpha <= 0) return;
  context.globalAlpha = ringAlpha;
  context.strokeStyle = "rgba(238, 249, 255, 0.92)";
  context.lineWidth = 1.1;
  context.beginPath();
  context.arc(centerX, centerY, rect.width * (0.48 + settle * 0.82), 0, Math.PI * 2);
  context.stroke();
}

export function resolveParticlePhase(progress: number): ParticleMorphPhase {
  if (progress < 0.26) return "disintegrate";
  if (progress < 0.58) return "stream";
  if (progress < 0.9) return "assemble";
  if (progress < 1) return "settle";
  return "done";
}

export function startPptParticleMorph({
  canvas,
  sourceTextElements,
  targetTextElements,
  targetAvatar,
  targetGrid,
  gridCellSize,
  duration = 1950,
  onProgress,
  onPhaseChange,
  onComplete
}: ParticleMorphOptions): ParticleMorphController {
  const context = canvas.getContext("2d");
  if (!context) {
    onPhaseChange?.("done");
    onComplete?.();
    return { cancel: () => undefined, particleCount: 0, sourcePointCount: 0, targetPointCount: 0 };
  }

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const highResolutionViewport = width * height > 2_200_000;
  const particleCount = width < 720 ? 460 : highResolutionViewport ? 760 : 900;
  const textSourceBudget = Math.round(particleCount * 0.6);
  const ambientSourceBudget = particleCount - textSourceBudget;
  const textSources = sampleTextPoints(sourceTextElements, width, height, textSourceBudget, WHITE);
  for (let index = 0; index < textSources.length; index += 1) {
    if (index % 5 === 0) textSources[index].color = CYAN;
  }
  const ambientSources = buildAmbientSources(width, height, ambientSourceBudget);
  const sources = [...textSources, ...ambientSources];
  if (sources.length < particleCount) {
    sources.push(...buildAmbientSources(width, height, particleCount - sources.length));
  }
  if (sources.length === 0) sources.push(...buildFallbackPoints(width, height, particleCount));

  const targetTextBudget = Math.round(particleCount * 0.3);
  const avatarBudget = Math.round(particleCount * 0.25);
  const targetText = sampleTextPoints(targetTextElements, width, height, targetTextBudget, WHITE, "text");
  const avatarTargets = buildAvatarTargets(targetAvatar, avatarBudget);
  const gridTargets = buildGridTargets(
    targetGrid,
    gridCellSize,
    Math.max(1, particleCount - targetText.length - avatarTargets.length)
  );
  const targets = [...gridTargets, ...avatarTargets, ...targetText];
  if (targets.length === 0) {
    targets.push(...buildGridTargets(targetGrid, gridCellSize, particleCount));
  }
  if (targets.length === 0) {
    targets.push(...buildFallbackPoints(width, height, particleCount, "fallback"));
  }

  const particles = buildParticles(sources, targets, particleCount, width, height);
  let frameId: number | null = null;
  let cancelled = false;
  let lastPhase: ParticleMorphPhase | null = null;
  const startedAt = performance.now();
  let lastFrameAt = startedAt;
  let elapsed = 0;
  const maxFrameStep = 64;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";

  const clear = () => {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
  };

  const drawFrame = (time: number) => {
    if (cancelled) return;
    elapsed += clamp(time - lastFrameAt, 0, maxFrameStep);
    lastFrameAt = time;
    const progress = Math.min(1, elapsed / duration);
    const phase = resolveParticlePhase(progress);
    canvas.dataset.particleProgress = progress.toFixed(3);

    clear();
    onProgress?.(progress);
    if (phase !== lastPhase) {
      lastPhase = phase;
      onPhaseChange?.(phase);
    }

    context.globalCompositeOperation = "screen";
    drawStreamField(context, width, height, progress);
    drawGridIgnition(context, gridTargets, progress);
    drawTargetHalo(context, targetAvatar, progress);
    for (const particle of particles) drawParticle(context, particle, progress);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";

    if (progress < 1) {
      frameId = window.requestAnimationFrame(drawFrame);
      return;
    }

    frameId = null;
    clear();
    onComplete?.();
  };

  frameId = window.requestAnimationFrame(drawFrame);

  return {
    particleCount,
    sourcePointCount: sources.length,
    targetPointCount: targets.length,
    cancel: () => {
      cancelled = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      clear();
    }
  };
}
