type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type ParticlePoint = {
  x: number;
  y: number;
  color: RgbColor;
};

type MorphParticle = {
  source: ParticlePoint;
  target: ParticlePoint;
  controlA: { x: number; y: number };
  controlB: { x: number; y: number };
  size: number;
  alpha: number;
  delay: number;
  travelDuration: number;
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
const GOLD: RgbColor = { r: 217, g: 189, b: 120 };
const AMBIENT_COLORS: RgbColor[] = [
  CYAN,
  { r: 103, g: 146, b: 255 },
  { r: 191, g: 111, b: 255 },
  { r: 83, g: 235, b: 176 }
];

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
  color: RgbColor
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
      points.push({ x, y, color });
    }
  }

  return shuffle(points).slice(0, budget);
}

function buildFallbackSources(width: number, height: number, count: number) {
  return Array.from({ length: count }, () => ({
    x: width * (0.36 + Math.random() * 0.28),
    y: height * (0.36 + Math.random() * 0.24),
    color: Math.random() > 0.34 ? WHITE : CYAN
  }));
}

function buildAmbientSources(width: number, height: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const edgeBiased = Math.random() < 0.62;
    let x = Math.random() * width;
    if (edgeBiased) {
      x = Math.random() < 0.5 ? Math.random() * width * 0.28 : width * (0.72 + Math.random() * 0.28);
    }
    return {
      x,
      y: height * (0.08 + Math.random() * 0.84),
      color: AMBIENT_COLORS[index % AMBIENT_COLORS.length]
    };
  });
}

function buildAvatarTargets(avatar: HTMLElement | null, count: number) {
  if (!avatar) return [];
  const rect = avatar.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
    const ring = Math.random() < 0.72;
    const radius = ring ? rect.width * (0.47 + Math.random() * 0.07) : rect.width * Math.sqrt(Math.random()) * 0.42;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      color: ring ? WHITE : GOLD
    };
  });
}

function buildGridTargets(grid: HTMLElement | null, cellSize: number, count: number) {
  const rect = grid?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return [];
  const cell = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 46;
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  return Array.from({ length: count }, () => {
    const rawX = rect.left + Math.random() * rect.width;
    const rawY = rect.top + Math.random() * rect.height;
    return {
      x: originX + Math.round((rawX - originX) / cell) * cell,
      y: originY + Math.round((rawY - originY) / cell) * cell,
      color: Math.random() > 0.2 ? CYAN : WHITE
    };
  });
}

function buildParticles(sources: ParticlePoint[], targets: ParticlePoint[], count: number, width: number) {
  return Array.from({ length: count }, (_, index): MorphParticle => {
    const source = sources[index % sources.length];
    const target = targets[(index * 7) % targets.length];
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const arc = (Math.random() - 0.5) * Math.min(width * 0.22, 90 + distance * 0.42);

    return {
      source,
      target,
      controlA: {
        x: source.x + dx * 0.28 + normalX * arc,
        y: source.y + dy * 0.28 + normalY * arc
      },
      controlB: {
        x: source.x + dx * 0.72 + normalX * arc * 0.62,
        y: source.y + dy * 0.72 + normalY * arc * 0.62
      },
      size: 0.65 + Math.random() * 1.75,
      alpha: 0.32 + Math.random() * 0.42,
      delay: Math.random() * 0.16 + (source.y / Math.max(1, window.innerHeight)) * 0.04,
      travelDuration: 0.7 + Math.random() * 0.1
    };
  });
}

function pointOnCurve(particle: MorphParticle, progress: number) {
  const inverse = 1 - progress;
  const sourceWeight = inverse * inverse * inverse;
  const controlAWeight = 3 * inverse * inverse * progress;
  const controlBWeight = 3 * inverse * progress * progress;
  const targetWeight = progress * progress * progress;

  return {
    x:
      sourceWeight * particle.source.x +
      controlAWeight * particle.controlA.x +
      controlBWeight * particle.controlB.x +
      targetWeight * particle.target.x,
    y:
      sourceWeight * particle.source.y +
      controlAWeight * particle.controlA.y +
      controlBWeight * particle.controlB.y +
      targetWeight * particle.target.y
  };
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

  const eased = easeInOutCubic(local);
  const previous = pointOnCurve(particle, Math.max(0, eased - 0.028));
  const current = pointOnCurve(particle, eased);
  const color = mixColor(particle.source.color, particle.target.color, eased);
  const fadeIn = smoothstep(0, 0.12, local);
  const fadeOut = 1 - smoothstep(0.78, 1, local);
  const alpha = particle.alpha * fadeIn * fadeOut;
  const size = particle.size * (1 + Math.sin(Math.PI * local) * 0.42);

  context.globalAlpha = alpha;
  context.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.88)`;
  context.lineWidth = Math.max(0.65, size * 0.64);
  context.beginPath();
  context.moveTo(previous.x, previous.y);
  context.lineTo(current.x, current.y);
  context.stroke();

  context.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.12)`;
  context.beginPath();
  context.arc(current.x, current.y, size * 2.45, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `rgba(${Math.min(255, color.r + 28)}, ${Math.min(255, color.g + 28)}, ${Math.min(255, color.b + 28)}, 0.96)`;
  context.beginPath();
  context.arc(current.x, current.y, size, 0, Math.PI * 2);
  context.fill();
}

function drawTargetHalo(context: CanvasRenderingContext2D, avatar: HTMLElement | null, progress: number) {
  if (!avatar) return;
  const rect = avatar.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const intensity = Math.sin(Math.PI * smoothstep(0.22, 0.96, progress));
  if (intensity <= 0) return;

  const radius = rect.width * (0.52 + progress * 0.24);
  const gradient = context.createRadialGradient(centerX, centerY, rect.width * 0.25, centerX, centerY, radius);
  gradient.addColorStop(0, "rgba(238, 249, 255, 0)");
  gradient.addColorStop(0.72, `rgba(116, 229, 246, ${0.08 * intensity})`);
  gradient.addColorStop(1, "rgba(116, 229, 246, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
}

export function startPptParticleMorph({
  canvas,
  sourceTextElements,
  targetTextElements,
  targetAvatar,
  targetGrid,
  gridCellSize,
  duration = 1480,
  onProgress,
  onComplete
}: ParticleMorphOptions): ParticleMorphController {
  const context = canvas.getContext("2d");
  if (!context) {
    onComplete?.();
    return { cancel: () => undefined, particleCount: 0, sourcePointCount: 0, targetPointCount: 0 };
  }

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const particleCount = width < 720 ? 320 : 560;
  const textSourceBudget = Math.round(particleCount * 0.58);
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
  if (sources.length === 0) sources.push(...buildFallbackSources(width, height, particleCount));

  const targetTextBudget = Math.round(particleCount * 0.38);
  const avatarBudget = Math.round(particleCount * 0.28);
  const targetText = sampleTextPoints(targetTextElements, width, height, targetTextBudget, WHITE);
  const avatarTargets = buildAvatarTargets(targetAvatar, avatarBudget);
  const gridTargets = buildGridTargets(
    targetGrid,
    gridCellSize,
    Math.max(1, particleCount - targetText.length - avatarTargets.length)
  );
  const targets = [...targetText, ...avatarTargets, ...gridTargets];
  if (targets.length === 0) {
    targets.push(...buildGridTargets(targetGrid, gridCellSize, particleCount));
  }
  if (targets.length === 0) {
    targets.push(...buildFallbackSources(width, height, particleCount));
  }

  shuffle(sources);
  shuffle(targets);
  const particles = buildParticles(sources, targets, particleCount, width);
  let frameId: number | null = null;
  let cancelled = false;
  const startedAt = performance.now();

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
    const progress = Math.min(1, (time - startedAt) / duration);

    clear();
    onProgress?.(progress);
    context.globalCompositeOperation = "screen";
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
