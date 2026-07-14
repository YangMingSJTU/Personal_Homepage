import { getRenderProfile, type RenderQuality } from "@/components/hero/renderQuality";

export type ParticleMorphPhase = "disintegrate" | "stream" | "assemble" | "settle" | "done";
export type ParticlePolarity = -1 | 1;
export type ParticleFlowAxis = "vertical" | "horizontal";

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type Point = {
  x: number;
  y: number;
};

type MorphParticle = {
  source: Point;
  sourceControl: Point;
  entryControl: Point;
  taijiEntry: Point;
  taijiExit: Point;
  taijiCenter: Point;
  exitControl: Point;
  axisExitControl: Point;
  axisExit: Point;
  polarity: ParticlePolarity;
  depth: number;
  size: number;
  alpha: number;
  entryDelay: number;
  exitDelay: number;
  flowPhase: number;
  tailColor: string;
  strokeColor: string;
  coreColor: string;
};

type PathSample = {
  point: Point;
  tangent: Point;
  speed: number;
};

type EyeSprite = {
  image: HTMLCanvasElement;
  size: number;
};

type ParticleMorphOptions = {
  canvas: HTMLCanvasElement;
  duration?: number;
  quality?: RenderQuality;
  onProgress?: (progress: number) => void;
  onPhaseChange?: (phase: ParticleMorphPhase) => void;
  onComplete?: () => void;
};

type ParticleMorphController = {
  cancel: () => void;
  particleCount: number;
  sourcePointCount: number;
  targetPointCount: number;
  quality: RenderQuality;
  dprCap: number;
};

const WHITE: RgbColor = { r: 238, g: 249, b: 255 };
const CYAN: RgbColor = { r: 116, g: 229, b: 246 };
const VIOLET: RgbColor = { r: 191, g: 111, b: 255 };
const GRAPHITE_VIOLET: RgbColor = { r: 112, g: 105, b: 184 };
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAIJI_ENTRY_ANGLE = -Math.PI * 0.08;
const TAIJI_ROTATION = Math.PI * 0.6;
const GATHER_END = 0.34;
const ROTATION_END = 0.76;

export const PARTICLE_TRANSITION_DURATION = 2800;
export const PARTICLE_TRANSITION_TIMELINE = {
  gatherEnd: GATHER_END,
  rotationEnd: ROTATION_END,
  rotationDegrees: 108
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edgeStart: number, edgeEnd: number, value: number) {
  const normalized = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function mixColor(source: RgbColor, target: RgbColor, progress: number) {
  return {
    r: Math.round(source.r + (target.r - source.r) * progress),
    g: Math.round(source.g + (target.g - source.g) * progress),
    b: Math.round(source.b + (target.b - source.b) * progress)
  };
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

function cubicSample(start: Point, controlA: Point, controlB: Point, end: Point, progress: number): PathSample {
  const point = cubicPoint(start, controlA, controlB, end, progress);
  const inverse = 1 - progress;
  const derivative = {
    x:
      3 * inverse * inverse * (controlA.x - start.x) +
      6 * inverse * progress * (controlB.x - controlA.x) +
      3 * progress * progress * (end.x - controlB.x),
    y:
      3 * inverse * inverse * (controlA.y - start.y) +
      6 * inverse * progress * (controlB.y - controlA.y) +
      3 * progress * progress * (end.y - controlB.y)
  };
  const speed = Math.max(0.001, Math.hypot(derivative.x, derivative.y));

  return {
    point,
    tangent: { x: derivative.x / speed, y: derivative.y / speed },
    speed
  };
}

function rotatePoint(point: Point, center: Point, angle: number, scale = 1) {
  const offsetX = (point.x - center.x) * scale;
  const offsetY = (point.y - center.y) * scale;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: center.x + offsetX * cosine - offsetY * sine,
    y: center.y + offsetX * sine + offsetY * cosine
  };
}

function getTaijiRadius(width: number, height: number) {
  return Math.hypot(width, height) * 0.515;
}

export function getParticleAxis(polarity: ParticlePolarity): ParticleFlowAxis {
  return polarity === 1 ? "vertical" : "horizontal";
}

export function getTaijiPolarity(x: number, y: number, radius: number): ParticlePolarity {
  const halfRadius = radius / 2;
  const eyeRadius = radius * 0.115;
  if (Math.hypot(x, y + halfRadius) <= eyeRadius) return 1;
  if (Math.hypot(x, y - halfRadius) <= eyeRadius) return -1;

  const localY = y < 0 ? y + halfRadius : y - halfRadius;
  const curveX = Math.sqrt(Math.max(0, halfRadius * halfRadius - localY * localY));
  const boundaryX = y < 0 ? curveX : -curveX;
  return x >= boundaryX ? 1 : -1;
}

function buildTaijiAnchor(index: number, count: number, width: number, height: number) {
  const radius = getTaijiRadius(width, height);
  const center = { x: width * 0.5, y: height * 0.5 };
  const normalizedRadius = Math.sqrt((index + 0.5) / Math.max(1, count));
  const angle = index * GOLDEN_ANGLE;
  const local = {
    x: Math.cos(angle) * radius * normalizedRadius * 0.992,
    y: Math.sin(angle) * radius * normalizedRadius * 0.992
  };
  const polarity = getTaijiPolarity(local.x, local.y, radius);
  const entry = rotatePoint(
    { x: center.x + local.x, y: center.y + local.y },
    center,
    TAIJI_ENTRY_ANGLE
  );

  return {
    center,
    entry,
    exit: rotatePoint(entry, center, TAIJI_ROTATION),
    polarity,
    radius
  };
}

function buildAxisPoint(
  anchor: Point,
  index: number,
  width: number,
  height: number,
  polarity: ParticlePolarity,
  side: -1 | 1
) {
  const padding = Math.max(64, Math.min(width, height) * 0.14);
  const lane = (((index * 73) % 101) / 100 - 0.5) * 0.16;
  if (getParticleAxis(polarity) === "vertical") {
    return {
      x: clamp(anchor.x + lane * width, -padding, width + padding),
      y: side < 0 ? -padding : height + padding
    };
  }

  return {
    x: side < 0 ? -padding : width + padding,
    y: clamp(anchor.y + lane * height, -padding, height + padding)
  };
}

function buildParticles(count: number, width: number, height: number) {
  return Array.from({ length: count }, (_, index): MorphParticle => {
    const taiji = buildTaijiAnchor(index, count, width, height);
    const polarity = taiji.polarity;
    const sourceSide: -1 | 1 = index % 2 === 0 ? -1 : 1;
    const source = buildAxisPoint(taiji.entry, index, width, height, polarity, sourceSide);
    const axisExit = buildAxisPoint(taiji.exit, index, width, height, polarity, sourceSide === -1 ? 1 : -1);
    const depth = ((index * 37) % 101) / 100;
    const entryOffset = {
      x: taiji.entry.x - taiji.center.x,
      y: taiji.entry.y - taiji.center.y
    };
    const entryLength = Math.max(1, Math.hypot(entryOffset.x, entryOffset.y));
    const entryTangent = { x: -entryOffset.y / entryLength, y: entryOffset.x / entryLength };
    const exitOffset = {
      x: taiji.exit.x - taiji.center.x,
      y: taiji.exit.y - taiji.center.y
    };
    const exitLength = Math.max(1, Math.hypot(exitOffset.x, exitOffset.y));
    const exitTangent = { x: -exitOffset.y / exitLength, y: exitOffset.x / exitLength };
    const axis = getParticleAxis(polarity);
    const entryDelay = (((index * 17) % 29) / 29) * 0.052;
    const exitDelay = (((index * 13) % 31) / 31) * 0.065;
    const orbitAngularRate = TAIJI_ROTATION / (ROTATION_END - GATHER_END);
    const entryTangentDistance = entryLength * orbitAngularRate * (GATHER_END - entryDelay) / 3;
    const exitTangentDistance = exitLength * orbitAngularRate * (1 - ROTATION_END) / 3;
    const color = polarity === 1
      ? mixColor(CYAN, WHITE, 0.28 + depth * 0.42)
      : mixColor(GRAPHITE_VIOLET, VIOLET, 0.16 + depth * 0.34);

    return {
      source,
      sourceControl: axis === "vertical"
        ? {
            x: source.x + entryTangent.x * taiji.radius * 0.09,
            y: source.y + (taiji.entry.y - source.y) * 0.48
          }
        : {
            x: source.x + (taiji.entry.x - source.x) * 0.48,
            y: source.y + entryTangent.y * taiji.radius * 0.09
          },
      entryControl: {
        x: taiji.entry.x - entryTangent.x * entryTangentDistance,
        y: taiji.entry.y - entryTangent.y * entryTangentDistance
      },
      taijiEntry: taiji.entry,
      taijiExit: taiji.exit,
      taijiCenter: taiji.center,
      exitControl: {
        x: taiji.exit.x + exitTangent.x * exitTangentDistance,
        y: taiji.exit.y + exitTangent.y * exitTangentDistance
      },
      axisExitControl: axis === "vertical"
        ? {
            x: axisExit.x,
            y: taiji.exit.y + (axisExit.y - taiji.exit.y) * 0.7
          }
        : {
            x: taiji.exit.x + (axisExit.x - taiji.exit.x) * 0.7,
            y: axisExit.y
          },
      axisExit,
      polarity,
      depth,
      size: 0.85 + depth * 1.9 + (index % 29 === 0 ? 0.9 : 0),
      alpha: 0.5 + depth * 0.42,
      entryDelay,
      exitDelay,
      flowPhase: ((index * 47) % 113) / 113 * Math.PI * 2,
      tailColor: `rgba(${color.r}, ${color.g}, ${color.b}, 0.42)`,
      strokeColor: `rgba(${color.r}, ${color.g}, ${color.b}, 0.94)`,
      coreColor: `rgba(${Math.min(255, color.r + 28)}, ${Math.min(255, color.g + 28)}, ${Math.min(255, color.b + 28)}, 0.98)`
    };
  });
}

export function resolveTaijiRotation(progress: number) {
  const local = clamp((progress - GATHER_END) / (ROTATION_END - GATHER_END), 0, 1);
  return TAIJI_ROTATION * local;
}

function sampleParticlePath(particle: MorphParticle, progress: number): PathSample {
  if (progress <= GATHER_END) {
    const gatherDuration = GATHER_END - particle.entryDelay;
    const local = clamp((progress - particle.entryDelay) / gatherDuration, 0, 1);
    const sample = cubicSample(
      particle.source,
      particle.sourceControl,
      particle.entryControl,
      particle.taijiEntry,
      local
    );
    return { ...sample, speed: sample.speed / gatherDuration };
  }

  if (progress <= ROTATION_END) {
    const rotationProgress = clamp((progress - GATHER_END) / (ROTATION_END - GATHER_END), 0, 1);
    const currentEnvelope = Math.pow(Math.sin(Math.PI * rotationProgress), 2);
    const currentAngle =
      Math.sin(particle.flowPhase + rotationProgress * Math.PI * 3) *
      currentEnvelope *
      (0.008 + particle.depth * 0.006);
    const breathingScale =
      1 +
      Math.sin(particle.flowPhase * 1.7 + rotationProgress * Math.PI * 4) *
        currentEnvelope *
        (0.004 + particle.depth * 0.004);
    const point = rotatePoint(
      particle.taijiEntry,
      particle.taijiCenter,
      resolveTaijiRotation(progress) + currentAngle,
      breathingScale
    );
    const offsetX = point.x - particle.taijiCenter.x;
    const offsetY = point.y - particle.taijiCenter.y;
    const radius = Math.max(0.001, Math.hypot(offsetX, offsetY));
    return {
      point,
      tangent: { x: -offsetY / radius, y: offsetX / radius },
      speed: radius * TAIJI_ROTATION / (ROTATION_END - GATHER_END)
    };
  }

  const releaseDuration = 1 - ROTATION_END;
  const local = clamp((progress - ROTATION_END) / releaseDuration, 0, 1);
  const sample = cubicSample(
    particle.taijiExit,
    particle.exitControl,
    particle.axisExitControl,
    particle.axisExit,
    local
  );
  return { ...sample, speed: sample.speed / releaseDuration };
}

function drawParticle(context: CanvasRenderingContext2D, particle: MorphParticle, progress: number) {
  const sample = sampleParticlePath(particle, progress);
  const fadeIn = smoothstep(particle.entryDelay, particle.entryDelay + 0.075, progress);
  const fadeOut = 1 - smoothstep(0.88 + particle.exitDelay * 0.3, 1, progress);
  const rotationBoost = smoothstep(0.26, GATHER_END, progress) * (1 - smoothstep(ROTATION_END, 0.84, progress));
  const alpha = particle.alpha * fadeIn * fadeOut;
  const size = particle.size * (1 + rotationBoost * (0.28 + particle.depth * 0.18));
  const rotating = progress >= GATHER_END && progress <= ROTATION_END;
  const trailLength = rotating
    ? size * (5.5 + particle.depth * 5.5)
    : clamp(sample.speed * (0.006 + particle.depth * 0.004), size * 3.2, size * 11);
  const normal = { x: -sample.tangent.y, y: sample.tangent.x };
  const bend = Math.sin(particle.flowPhase + progress * Math.PI * 4) * size * (0.35 + particle.depth * 0.7);
  const trailA = {
    x: sample.point.x - sample.tangent.x * trailLength * 0.32 + normal.x * bend * 0.25,
    y: sample.point.y - sample.tangent.y * trailLength * 0.32 + normal.y * bend * 0.25
  };
  const trailB = {
    x: sample.point.x - sample.tangent.x * trailLength * 0.67 + normal.x * bend * 0.7,
    y: sample.point.y - sample.tangent.y * trailLength * 0.67 + normal.y * bend * 0.7
  };
  const trailC = {
    x: sample.point.x - sample.tangent.x * trailLength + normal.x * bend * 0.2,
    y: sample.point.y - sample.tangent.y * trailLength + normal.y * bend * 0.2
  };

  if (alpha <= 0.002) return;

  context.lineCap = "butt";
  context.globalAlpha = alpha * 0.2;
  context.strokeStyle = particle.tailColor;
  context.lineWidth = Math.max(0.45, size * 0.28);
  context.beginPath();
  context.moveTo(trailC.x, trailC.y);
  context.lineTo(trailB.x, trailB.y);
  context.stroke();

  context.globalAlpha = alpha * 0.46;
  context.strokeStyle = particle.strokeColor;
  context.lineWidth = Math.max(0.55, size * 0.4);
  context.beginPath();
  context.moveTo(trailB.x, trailB.y);
  context.lineTo(trailA.x, trailA.y);
  context.stroke();

  context.globalAlpha = alpha * 0.82;
  context.strokeStyle = particle.coreColor;
  context.lineWidth = Math.max(0.65, size * 0.52);
  context.beginPath();
  context.moveTo(trailA.x, trailA.y);
  context.lineTo(sample.point.x, sample.point.y);
  context.stroke();
}

function traceTaijiSeam(context: CanvasRenderingContext2D, radius: number) {
  context.beginPath();
  context.arc(0, -radius / 2, radius / 2, -Math.PI / 2, Math.PI / 2);
  context.arc(0, radius / 2, radius / 2, -Math.PI / 2, (-Math.PI * 3) / 2, true);
}

function createEyeSprite(color: RgbColor, eyeRadius: number): EyeSprite {
  const size = Math.max(1, Math.ceil(eyeRadius * 3));
  const image = document.createElement("canvas");
  image.width = size;
  image.height = size;
  const context = image.getContext("2d");
  if (context) {
    const center = size / 2;
    const glow = context.createRadialGradient(center, center, 0, center, center, center);
    glow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.46)`);
    glow.addColorStop(0.38, `rgba(${color.r}, ${color.g}, ${color.b}, 0.16)`);
    glow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
    context.fillStyle = glow;
    context.fillRect(0, 0, size, size);
  }
  return { image, size };
}

function drawTransitionCurtain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  gradient: CanvasGradient
) {
  const coverage = smoothstep(0.11, GATHER_END, progress) * (1 - smoothstep(ROTATION_END, 0.95, progress));
  if (coverage <= 0) return;

  context.save();
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = coverage;
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function drawTaijiFlowField(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  eyeSprites: [EyeSprite, EyeSprite]
) {
  const intensity = smoothstep(0.17, GATHER_END, progress) * (1 - smoothstep(ROTATION_END, 0.88, progress));
  if (intensity <= 0) return;

  const radius = getTaijiRadius(width, height);
  const rotation = TAIJI_ENTRY_ANGLE + resolveTaijiRotation(progress);
  const seamWidth = clamp(radius * 0.006, 4, 10);
  context.save();
  context.translate(width * 0.5, height * 0.5);
  context.rotate(rotation);
  context.lineCap = "round";

  context.globalAlpha = intensity * 0.11;
  context.lineWidth = seamWidth * 2.4;
  context.setLineDash([]);
  context.strokeStyle = "rgba(221, 235, 249, 0.9)";
  traceTaijiSeam(context, radius);
  context.stroke();

  context.globalAlpha = intensity * 0.5;
  context.lineWidth = Math.max(1, seamWidth * 0.22);
  context.setLineDash([3, clamp(radius * 0.018, 12, 24)]);
  context.lineDashOffset = -progress * 420;
  context.strokeStyle = "rgba(232, 244, 255, 0.94)";
  traceTaijiSeam(context, radius);
  context.stroke();

  const eyeRadius = radius * 0.115;
  for (const [index, eye] of [
    { y: -radius / 2, color: CYAN },
    { y: radius / 2, color: VIOLET }
  ].entries()) {
    const sprite = eyeSprites[index];
    context.globalAlpha = intensity;
    context.drawImage(sprite.image, -sprite.size / 2, eye.y - sprite.size / 2, sprite.size, sprite.size);

    context.globalAlpha = intensity * 0.34;
    context.fillStyle = `rgb(${eye.color.r} ${eye.color.g} ${eye.color.b})`;
    context.beginPath();
    context.arc(0, eye.y, eyeRadius * 0.22, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = intensity * 0.78;
    context.fillStyle = `rgb(${eye.color.r} ${eye.color.g} ${eye.color.b})`;
    context.beginPath();
    context.arc(0, eye.y, clamp(radius * 0.01, 3, 9), 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

export function resolveParticlePhase(progress: number): ParticleMorphPhase {
  if (progress < GATHER_END) return "disintegrate";
  if (progress < ROTATION_END) return "stream";
  if (progress < 0.92) return "assemble";
  if (progress < 1) return "settle";
  return "done";
}

export function resolveParticleProgress(startedAt: number, now: number, duration: number) {
  if (duration <= 0) return 1;
  return clamp((now - startedAt) / duration, 0, 1);
}

export function startPptParticleMorph({
  canvas,
  duration = PARTICLE_TRANSITION_DURATION,
  quality = "balanced",
  onProgress,
  onPhaseChange,
  onComplete
}: ParticleMorphOptions): ParticleMorphController {
  const context = canvas.getContext("2d");
  if (!context) {
    onPhaseChange?.("done");
    onComplete?.();
    return {
      cancel: () => undefined,
      particleCount: 0,
      sourcePointCount: 0,
      targetPointCount: 0,
      quality,
      dprCap: getRenderProfile(quality).particleDprCap
    };
  }

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const profile = getRenderProfile(quality);
  const particleCount = profile.particleCount;
  const dpr = Math.min(window.devicePixelRatio || 1, profile.particleDprCap);
  const particles = buildParticles(particleCount, width, height);
  let frameId: number | null = null;
  let cancelled = false;
  let lastPhase: ParticleMorphPhase | null = null;
  let startedAt: number | null = null;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  const curtainGradient = context.createRadialGradient(
    width * 0.5,
    height * 0.5,
    0,
    width * 0.5,
    height * 0.5,
    Math.hypot(width, height) * 0.62
  );
  curtainGradient.addColorStop(0, "rgb(10 18 30)");
  curtainGradient.addColorStop(0.7, "rgb(4 10 18)");
  curtainGradient.addColorStop(1, "rgb(2 7 13)");
  const eyeRadius = getTaijiRadius(width, height) * 0.115;
  const eyeSprites: [EyeSprite, EyeSprite] = [
    createEyeSprite(CYAN, eyeRadius),
    createEyeSprite(VIOLET, eyeRadius)
  ];

  const clear = () => {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
  };

  const drawFrame = (time: number) => {
    if (cancelled) return;
    if (startedAt === null) startedAt = time;
    const progress = resolveParticleProgress(startedAt, time, duration);
    const phase = resolveParticlePhase(progress);
    canvas.dataset.particleProgress = progress.toFixed(3);

    clear();
    onProgress?.(progress);
    if (phase !== lastPhase) {
      lastPhase = phase;
      onPhaseChange?.(phase);
    }

    drawTransitionCurtain(context, width, height, progress, curtainGradient);
    context.globalCompositeOperation = "screen";
    drawTaijiFlowField(context, width, height, progress, eyeSprites);
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
    sourcePointCount: particleCount,
    targetPointCount: particleCount,
    quality,
    dprCap: profile.particleDprCap,
    cancel: () => {
      cancelled = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      clear();
    }
  };
}
