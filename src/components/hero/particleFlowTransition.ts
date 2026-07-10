type FlowColor = {
  core: string;
  glow: string;
  trail: string;
};

type FlowParticle = {
  x: number;
  anchorY: number;
  direction: -1 | 1;
  travel: number;
  driftY: number;
  size: number;
  trail: number;
  alpha: number;
  start: number;
  life: number;
  phase: number;
  wobble: number;
  color: FlowColor;
};

type ParticleFlowOptions = {
  canvas: HTMLCanvasElement;
  slide: HTMLElement;
  duration?: number;
  onComplete?: () => void;
};

type ParticleFlowController = {
  cancel: () => void;
  particleCount: number;
};

const FLOW_COLORS: FlowColor[] = [
  {
    core: "rgba(239, 252, 255, 0.98)",
    glow: "rgba(151, 236, 250, 0.58)",
    trail: "rgba(116, 229, 246, 0.72)"
  },
  {
    core: "rgba(224, 235, 255, 0.96)",
    glow: "rgba(113, 151, 255, 0.5)",
    trail: "rgba(104, 143, 255, 0.66)"
  },
  {
    core: "rgba(246, 232, 255, 0.94)",
    glow: "rgba(187, 126, 255, 0.44)",
    trail: "rgba(177, 112, 255, 0.58)"
  }
];

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function buildParticles(width: number, height: number, count: number): FlowParticle[] {
  return Array.from({ length: count }, (_, index) => {
    const start = Math.random() * 0.86;
    const direction = Math.random() < 0.82 ? 1 : -1;
    const startProgress = easeInOutCubic(start);

    return {
      x: Math.random() * width,
      anchorY: height * (1 - startProgress) + (Math.random() - 0.5) * 34,
      direction,
      travel: width * (0.035 + Math.random() * 0.13),
      driftY: -14 + (Math.random() - 0.5) * 46,
      size: 0.7 + Math.random() * 2.4,
      trail: 14 + Math.random() * 58,
      alpha: 0.34 + Math.random() * 0.58,
      start,
      life: 0.16 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      wobble: 3 + Math.random() * 15,
      color: FLOW_COLORS[index % FLOW_COLORS.length]
    };
  });
}

function drawFlowFront(context: CanvasRenderingContext2D, width: number, boundaryY: number, progress: number) {
  const band = context.createLinearGradient(0, boundaryY - 76, 0, boundaryY + 76);
  band.addColorStop(0, "rgba(116, 229, 246, 0)");
  band.addColorStop(0.42, "rgba(105, 156, 255, 0.055)");
  band.addColorStop(0.5, "rgba(220, 249, 255, 0.16)");
  band.addColorStop(0.58, "rgba(177, 112, 255, 0.05)");
  band.addColorStop(1, "rgba(177, 112, 255, 0)");
  context.fillStyle = band;
  context.fillRect(0, boundaryY - 76, width, 152);

  const lineGradient = context.createLinearGradient(0, 0, width, 0);
  lineGradient.addColorStop(0, "rgba(116, 229, 246, 0)");
  lineGradient.addColorStop(0.18, "rgba(116, 229, 246, 0.5)");
  lineGradient.addColorStop(0.52, "rgba(238, 251, 255, 0.76)");
  lineGradient.addColorStop(0.82, "rgba(177, 112, 255, 0.44)");
  lineGradient.addColorStop(1, "rgba(177, 112, 255, 0)");

  context.strokeStyle = lineGradient;
  context.lineWidth = 1.2;
  context.beginPath();
  for (let x = -20; x <= width + 20; x += 18) {
    const y = boundaryY + Math.sin(x * 0.014 + progress * 11) * 7 + Math.sin(x * 0.004 - progress * 6) * 4;
    if (x === -20) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
}

function drawParticle(context: CanvasRenderingContext2D, particle: FlowParticle, progress: number) {
  const local = (progress - particle.start) / particle.life;
  if (local <= 0 || local >= 1) return;

  const eased = easeOutCubic(local);
  const fade = Math.sin(Math.PI * local) * particle.alpha;
  const wave = Math.sin(local * 9 + particle.phase) * particle.wobble * (1 - local * 0.55);
  const travel = particle.travel * eased * particle.direction;
  const x = particle.x + travel;
  const y = particle.anchorY + particle.driftY * eased + wave;
  const tailLength = particle.trail * (0.55 + (1 - local) * 0.8);
  const tailX = x - tailLength * particle.direction;
  const tailY = y - particle.driftY * 0.13;

  context.globalAlpha = fade;
  context.strokeStyle = particle.color.trail;
  context.lineWidth = Math.max(0.7, particle.size * 0.72);
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.quadraticCurveTo((tailX + x) / 2, y - wave * 0.28, x, y);
  context.stroke();

  context.fillStyle = particle.color.glow;
  context.beginPath();
  context.arc(x, y, particle.size * 3.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = particle.color.core;
  context.beginPath();
  context.arc(x, y, particle.size, 0, Math.PI * 2);
  context.fill();
}

export function startPptParticleFlow({
  canvas,
  slide,
  duration = 1320,
  onComplete
}: ParticleFlowOptions): ParticleFlowController {
  const context = canvas.getContext("2d");
  if (!context) return { cancel: () => undefined, particleCount: 0 };

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const particleCount = width < 720 ? 320 : 620;
  const particles = buildParticles(width, height, particleCount);
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
    const eased = easeInOutCubic(progress);
    const boundaryY = height * (1 - eased);

    clear();
    slide.style.clipPath = `inset(0 0 ${(eased * 100).toFixed(3)}% 0)`;
    slide.style.transform = `translate3d(0, ${(-eased * 2.2).toFixed(3)}vh, 0)`;

    context.globalCompositeOperation = "lighter";
    drawFlowFront(context, width, boundaryY, progress);
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
    cancel: () => {
      cancelled = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      clear();
    }
  };
}
