import { useState, useRef, useEffect, useCallback } from 'react';
import { planets, PlanetData, SUN_DATA } from './data/planets';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

interface PlanetPosition {
  x: number;
  y: number;
  radius: number;
  angle: number;
}

// ─── Utility Functions ───────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function lightenColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
}

function darkenColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amount)}, ${Math.max(0, g - amount)}, ${Math.max(0, b - amount)})`;
}

// ─── Pre-render Star Field (static, never changes) ──────────────────────────
function createStarField(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep space background
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, width, height);

  // Subtle nebula
  const nebula1 = ctx.createRadialGradient(width * 0.2, height * 0.3, 0, width * 0.2, height * 0.3, width * 0.4);
  nebula1.addColorStop(0, 'rgba(40, 20, 80, 0.04)');
  nebula1.addColorStop(1, 'transparent');
  ctx.fillStyle = nebula1;
  ctx.fillRect(0, 0, width, height);

  const nebula2 = ctx.createRadialGradient(width * 0.8, height * 0.7, 0, width * 0.8, height * 0.7, width * 0.3);
  nebula2.addColorStop(0, 'rgba(20, 40, 80, 0.04)');
  nebula2.addColorStop(1, 'transparent');
  ctx.fillStyle = nebula2;
  ctx.fillRect(0, 0, width, height);

  // Stars (static, no twinkle to save CPU)
  const count = Math.floor((width * height) / 4000);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.4 + 0.3;
    const brightness = Math.random() * 0.5 + 0.3;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
    ctx.fill();
  }

  return canvas;
}

// ─── Pre-render Planet Textures ─────────────────────────────────────────────
function createPlanetTexture(planet: PlanetData, size: number): HTMLCanvasElement {
  const padding = planet.hasRings ? size * 3 : size * 0.5;
  const canvasSize = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const r = size;

  // Atmospheric glow
  if (planet.atmosphereColor) {
    const atmoGrad = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 2.2);
    atmoGrad.addColorStop(0, planet.atmosphereColor);
    atmoGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = atmoGrad;
    ctx.fill();
  }

  // Planet body
  const bodyGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  bodyGrad.addColorStop(0, lightenColor(planet.color, 50));
  bodyGrad.addColorStop(0.4, planet.color);
  bodyGrad.addColorStop(0.8, planet.colorSecondary);
  bodyGrad.addColorStop(1, darkenColor(planet.colorSecondary, 40));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Surface details
  drawSurfaceDetails(ctx, planet, cx, cy, r);

  // Shadow (terminator)
  const shadowGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.55, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.85, 'rgba(0,0,0,0.35)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = shadowGrad;
  ctx.fill();

  // Specular highlight
  const specGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.35, cy - r * 0.35, r * 0.55);
  specGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = specGrad;
  ctx.fill();

  // Rings
  if (planet.hasRings) {
    drawRingsStatic(ctx, planet, cx, cy, r);
  }

  return canvas;
}

function drawSurfaceDetails(ctx: CanvasRenderingContext2D, planet: PlanetData, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  switch (planet.id) {
    case 'earth': {
      // Continents
      ctx.fillStyle = 'rgba(45, 107, 63, 0.5)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.2, r * 0.3, r * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + r * 0.2, y - r * 0.1, r * 0.15, r * 0.35, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - r * 0.5, y + r * 0.3, r * 0.2, r * 0.15, 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(i * 1.5) * r * 0.4, y + Math.sin(i * 2) * r * 0.3, r * 0.25, r * 0.06, i * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Polar ice
      ctx.fillStyle = 'rgba(220, 240, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.85, r * 0.4, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 240, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.85, r * 0.35, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'jupiter': {
      const bands = [
        { y: -0.7, h: 0.15, color: 'rgba(180, 120, 60, 0.4)' },
        { y: -0.4, h: 0.12, color: 'rgba(200, 150, 80, 0.3)' },
        { y: -0.1, h: 0.18, color: 'rgba(160, 100, 40, 0.4)' },
        { y: 0.2, h: 0.14, color: 'rgba(190, 140, 70, 0.35)' },
        { y: 0.5, h: 0.12, color: 'rgba(170, 110, 50, 0.3)' },
        { y: 0.75, h: 0.1, color: 'rgba(150, 90, 40, 0.35)' },
      ];
      bands.forEach((band) => {
        ctx.beginPath();
        ctx.ellipse(x, y + r * band.y, r * 1.1, r * band.h, 0, 0, Math.PI * 2);
        ctx.fillStyle = band.color;
        ctx.fill();
      });
      // Great Red Spot
      const spotGrad = ctx.createRadialGradient(x + r * 0.2, y + r * 0.2, 0, x + r * 0.2, y + r * 0.2, r * 0.2);
      spotGrad.addColorStop(0, 'rgba(200, 60, 30, 0.6)');
      spotGrad.addColorStop(0.5, 'rgba(180, 80, 40, 0.4)');
      spotGrad.addColorStop(1, 'rgba(160, 100, 60, 0)');
      ctx.beginPath();
      ctx.ellipse(x + r * 0.2, y + r * 0.2, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = spotGrad;
      ctx.fill();
      break;
    }
    case 'saturn': {
      const bands = [
        { y: -0.5, h: 0.2, color: 'rgba(200, 180, 100, 0.2)' },
        { y: -0.1, h: 0.25, color: 'rgba(180, 160, 80, 0.15)' },
        { y: 0.3, h: 0.2, color: 'rgba(190, 170, 90, 0.18)' },
        { y: 0.6, h: 0.15, color: 'rgba(170, 150, 70, 0.15)' },
      ];
      bands.forEach((band) => {
        ctx.beginPath();
        ctx.ellipse(x, y + r * band.y, r * 1.1, r * band.h, 0, 0, Math.PI * 2);
        ctx.fillStyle = band.color;
        ctx.fill();
      });
      break;
    }
    case 'mars': {
      ctx.fillStyle = 'rgba(230, 230, 240, 0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.8, r * 0.35, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(230, 230, 240, 0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.85, r * 0.25, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(80, 30, 10, 0.3)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.1, y + r * 0.1, r * 0.3, r * 0.4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Craters
      ctx.fillStyle = 'rgba(60, 20, 5, 0.25)';
      [[-0.3, 0.2, 0.08], [0.2, -0.3, 0.06], [0.3, 0.4, 0.07], [-0.2, -0.4, 0.05]].forEach(([cx, cy, cr]) => {
        ctx.beginPath();
        ctx.arc(x + r * cx, y + r * cy, r * cr, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 'venus': {
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.6 + i * r * 0.25, r * 0.9, r * 0.08, 0.1 * i, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 220, 150, ${0.1 + i * 0.02})`;
        ctx.fill();
      }
      break;
    }
    case 'mercury': {
      ctx.fillStyle = 'rgba(80, 80, 80, 0.3)';
      [[-0.3, -0.2, 0.15], [0.2, 0.3, 0.12], [-0.1, 0.4, 0.1], [0.4, -0.1, 0.08], [-0.4, 0.1, 0.09]].forEach(([cx, cy, cr]) => {
        ctx.beginPath();
        ctx.arc(x + r * cx, y + r * cy, r * cr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(140, 140, 140, 0.2)';
      [[-0.3, -0.2, 0.1], [0.2, 0.3, 0.08], [-0.1, 0.4, 0.07]].forEach(([cx, cy, cr]) => {
        ctx.beginPath();
        ctx.arc(x + r * cx, y + r * cy, r * cr, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 'uranus': {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(x, y + r * (-0.3 + i * 0.3), r * 0.95, r * 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 180, 200, 0.15)';
        ctx.fill();
      }
      break;
    }
    case 'neptune': {
      const spotGrad = ctx.createRadialGradient(x + r * 0.15, y - r * 0.1, 0, x + r * 0.15, y - r * 0.1, r * 0.2);
      spotGrad.addColorStop(0, 'rgba(20, 30, 80, 0.5)');
      spotGrad.addColorStop(1, 'rgba(30, 50, 120, 0)');
      ctx.beginPath();
      ctx.ellipse(x + r * 0.15, y - r * 0.1, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = spotGrad;
      ctx.fill();
      ctx.fillStyle = 'rgba(150, 180, 255, 0.15)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(x, y + r * (-0.3 + i * 0.3), r * 0.4, r * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

function drawRingsStatic(ctx: CanvasRenderingContext2D, planet: PlanetData, x: number, y: number, r: number) {
  if (!planet.ringColor) return;
  const ringInner = r * 1.4;
  const ringOuter = r * 2.2;
  const tilt = planet.id === 'uranus' ? 1.4 : 0.3;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);

  const ringBands = planet.id === 'saturn' ? 5 : 2;
  for (let i = 0; i < ringBands; i++) {
    const innerR = ringInner + (ringOuter - ringInner) * (i / ringBands);
    const outerR = ringInner + (ringOuter - ringInner) * ((i + 0.8) / ringBands);
    const alpha = planet.id === 'saturn' ? 0.4 - i * 0.05 : 0.15;
    ctx.beginPath();
    ctx.ellipse(0, 0, outerR, outerR * 0.3, 0, 0, Math.PI * 2);
    ctx.strokeStyle = planet.ringColor.replace(/[\d.]+\)$/, `${alpha})`);
    ctx.lineWidth = (outerR - innerR) * 0.8;
    ctx.stroke();
  }

  if (planet.id === 'saturn') {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 0.9, r * 0.05, 0, 0, Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();
  }
  ctx.restore();
}

// ─── Pre-render Sun Texture ─────────────────────────────────────────────────
function createSunTexture(size: number): HTMLCanvasElement {
  const canvasSize = size * 5;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  // Outer corona
  for (let i = 3; i >= 0; i--) {
    const r = size + 15 + i * 20;
    const gradient = ctx.createRadialGradient(cx, cy, size, cx, cy, r);
    gradient.addColorStop(0, `rgba(255, 180, 0, ${0.07 - i * 0.012})`);
    gradient.addColorStop(0.5, `rgba(255, 100, 0, ${0.03 - i * 0.006})`);
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // Sun body
  const surfGrad = ctx.createRadialGradient(cx - 6, cy - 6, 0, cx, cy, size);
  surfGrad.addColorStop(0, '#fffde0');
  surfGrad.addColorStop(0.2, '#fff3a0');
  surfGrad.addColorStop(0.5, '#ffcc00');
  surfGrad.addColorStop(0.75, '#ff9500');
  surfGrad.addColorStop(1, '#ff5500');
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fillStyle = surfGrad;
  ctx.fill();

  // Surface granulation (static pattern)
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const dist = size * 0.4 + (i % 3) * 5;
    const gx = cx + Math.cos(angle) * dist;
    const gy = cy + Math.sin(angle) * dist;
    const gSize = 3 + (i % 3) * 2;
    const granGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gSize);
    granGrad.addColorStop(0, 'rgba(255, 255, 200, 0.12)');
    granGrad.addColorStop(1, 'rgba(255, 200, 0, 0)');
    ctx.beginPath();
    ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
    ctx.fillStyle = granGrad;
    ctx.fill();
  }

  // Inner core glow
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.35);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  coreGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  return canvas;
}

// ─── Asteroid Belt (pre-computed positions) ─────────────────────────────────
const ASTEROIDS = Array.from({ length: 60 }, () => ({
  angle: Math.random() * Math.PI * 2,
  radius: 265 + Math.random() * 35,
  size: Math.random() * 1.2 + 0.4,
  brightness: Math.random() * 0.3 + 0.15,
}));

// ─── Main Component ─────────────────────────────────────────────────────────
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const planetPositionsRef = useRef<Map<string, PlanetPosition>>(new Map());
  const sunPosRef = useRef({ x: 0, y: 0, radius: 40 });
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1 });
  const hoveredRef = useRef<string | null>(null);

  // Pre-rendered assets (created once)
  const starFieldRef = useRef<HTMLCanvasElement | null>(null);
  const sunTextureRef = useRef<HTMLCanvasElement | null>(null);
  const planetTexturesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // React state for UI
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  const [showSunInfo, setShowSunInfo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [focusedPlanet, setFocusedPlanet] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);

  // Refs for animation loop
  const isPlayingRef = useRef(true);
  const speedRef = useRef(1);
  const showLabelsRef = useRef(true);
  const showOrbitsRef = useRef(true);
  const focusedRef = useRef<string | null>(null);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { showOrbitsRef.current = showOrbits; }, [showOrbits]);
  useEffect(() => { focusedRef.current = focusedPlanet; }, [focusedPlanet]);

  // ─── Initialize pre-rendered assets ───────────────────────────────────────
  const initAssets = useCallback((width: number, height: number) => {
    // Star field (only regenerate on resize)
    starFieldRef.current = createStarField(width, height);

    // Sun texture
    sunTextureRef.current = createSunTexture(40);

    // Planet textures (high-res versions for zoom)
    planets.forEach((planet) => {
      planetTexturesRef.current.set(planet.id, createPlanetTexture(planet, planet.size));
    });
  }, []);

  // ─── Main Render Loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initAssets(window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener('resize', resize);

    let lastFrameTime = 0;
    const TARGET_FPS = 60;
    const FRAME_DURATION = 1000 / TARGET_FPS;

    const animate = (timestamp: number) => {
      // Frame rate limiting for high-refresh displays
      const delta = timestamp - lastFrameTime;
      if (delta < FRAME_DURATION * 0.9) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = timestamp;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const cam = cameraRef.current;

      // Update time
      if (isPlayingRef.current) {
        timeRef.current += speedRef.current;
      }
      const time = timeRef.current;

      // Smooth camera
      cam.x = lerp(cam.x, cam.targetX, 0.06);
      cam.y = lerp(cam.y, cam.targetY, 0.06);
      cam.zoom = lerp(cam.zoom, cam.targetZoom, 0.06);

      // Clear
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, w, h);

      // Draw pre-rendered star field (single drawImage - very fast)
      if (starFieldRef.current) {
        ctx.drawImage(starFieldRef.current, 0, 0);
      }

      // Apply camera
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-w / 2 + cam.x, -h / 2 + cam.y);

      const centerX = w / 2;
      const centerY = h / 2;

      // Orbits (30% more visible)
      if (showOrbitsRef.current) {
        planets.forEach((planet) => {
          const isFocused = focusedRef.current === planet.id;
          ctx.beginPath();
          ctx.arc(centerX, centerY, planet.orbitRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isFocused
            ? 'rgba(100, 200, 255, 0.3)'
            : 'rgba(255, 255, 255, 0.08)'; // ~30% more than 0.06
          ctx.lineWidth = isFocused ? 1.5 : 0.7;
          if (isFocused) {
            ctx.setLineDash([8, 4]);
            ctx.lineDashOffset = -time * 0.02;
          }
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      // Asteroid belt
      ASTEROIDS.forEach((asteroid) => {
        const angle = asteroid.angle + time * 0.00008;
        const ax = centerX + Math.cos(angle) * asteroid.radius;
        const ay = centerY + Math.sin(angle) * asteroid.radius;
        ctx.beginPath();
        ctx.arc(ax, ay, asteroid.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150, 140, 120, ${asteroid.brightness})`;
        ctx.fill();
      });

      // Sun (pre-rendered texture)
      if (sunTextureRef.current) {
        const sunCanvas = sunTextureRef.current;
        const sunSize = 40;
        const drawSize = sunSize * 5;
        ctx.drawImage(sunCanvas, centerX - drawSize / 2, centerY - drawSize / 2, drawSize, drawSize);
        sunPosRef.current = { x: centerX, y: centerY, radius: sunSize };
      }

      // Planets (pre-rendered textures, rotated for animation)
      planets.forEach((planet) => {
        const angle = time * planet.speed * 0.008;
        const px = centerX + Math.cos(angle) * planet.orbitRadius;
        const py = centerY + Math.sin(angle) * planet.orbitRadius;

        planetPositionsRef.current.set(planet.id, { x: px, y: py, radius: planet.size, angle });

        const isHovered = hoveredRef.current === planet.id;
        const isSelected = focusedRef.current === planet.id;

        // Draw pre-rendered planet texture
        const texture = planetTexturesRef.current.get(planet.id);
        if (texture) {
          const padding = planet.hasRings ? planet.size * 3 : planet.size * 0.5;
          const texSize = (planet.size + padding) * 2;
          ctx.drawImage(texture, px - texSize / 2, py - texSize / 2, texSize, texSize);
        }

        // Selection/hover indicators (only drawn when needed)
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, planet.size + 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -time * 0.05;
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (isHovered) {
          ctx.beginPath();
          ctx.arc(px, py, planet.size + 5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Labels
        if (showLabelsRef.current && cam.zoom < 2.5) {
          ctx.fillStyle = isSelected
            ? 'rgba(100, 200, 255, 0.9)'
            : isHovered
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(255, 255, 255, 0.5)';
          const fontSize = 11 / Math.max(cam.zoom, 0.8);
          ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(planet.name, px, py + planet.size + 18 / Math.max(cam.zoom, 0.8));
        }
      });

      ctx.restore();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initAssets]);

  // ─── Wheel zoom (non-passive for preventDefault) ──────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      cam.targetZoom = Math.max(0.4, Math.min(6, cam.targetZoom * factor));
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // ─── Interaction ──────────────────────────────────────────────────────────
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const cam = cameraRef.current;
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: (screenX - w / 2) / cam.zoom + w / 2 - cam.x,
      y: (screenY - h / 2) / cam.zoom + h / 2 - cam.y,
    };
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    // Sun
    const sunPos = sunPosRef.current;
    if (Math.hypot(world.x - sunPos.x, world.y - sunPos.y) <= sunPos.radius * 1.2) {
      setShowSunInfo(true);
      setSelectedPlanet(null);
      setFocusedPlanet(null);
      cameraRef.current.targetX = 0;
      cameraRef.current.targetY = 0;
      cameraRef.current.targetZoom = 1;
      return;
    }

    // Planets
    for (const [id, pos] of planetPositionsRef.current.entries()) {
      if (Math.hypot(world.x - pos.x, world.y - pos.y) <= pos.radius + 12) {
        const planet = planets.find((p) => p.id === id);
        if (planet) {
          setSelectedPlanet(planet);
          setShowSunInfo(false);
          setFocusedPlanet(id);
          const w = window.innerWidth;
          const h = window.innerHeight;
          cameraRef.current.targetX = w / 2 - pos.x;
          cameraRef.current.targetY = h / 2 - pos.y;
          cameraRef.current.targetZoom = 3.5;
          return;
        }
      }
    }

    // Empty space
    setSelectedPlanet(null);
    setShowSunInfo(false);
    setFocusedPlanet(null);
    cameraRef.current.targetX = 0;
    cameraRef.current.targetY = 0;
    cameraRef.current.targetZoom = 1;
  }, [screenToWorld]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    let found = false;
    const sunPos = sunPosRef.current;
    if (Math.hypot(world.x - sunPos.x, world.y - sunPos.y) <= sunPos.radius * 1.2) {
      found = true;
    }

    if (!found) {
      for (const [id, pos] of planetPositionsRef.current.entries()) {
        if (Math.hypot(world.x - pos.x, world.y - pos.y) <= pos.radius + 12) {
          hoveredRef.current = id;
          found = true;
          break;
        }
      }
    }

    if (!found) hoveredRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = found ? 'pointer' : 'default';
  }, [screenToWorld]);

  const resetView = useCallback(() => {
    setSelectedPlanet(null);
    setShowSunInfo(false);
    setFocusedPlanet(null);
    cameraRef.current.targetX = 0;
    cameraRef.current.targetY = 0;
    cameraRef.current.targetZoom = 1;
  }, []);

  const focusOnPlanet = useCallback((planet: PlanetData) => {
    const pos = planetPositionsRef.current.get(planet.id);
    if (pos) {
      setSelectedPlanet(planet);
      setShowSunInfo(false);
      setFocusedPlanet(planet.id);
      const w = window.innerWidth;
      const h = window.innerHeight;
      cameraRef.current.targetX = w / 2 - pos.x;
      cameraRef.current.targetY = h / 2 - pos.y;
      cameraRef.current.targetZoom = 3.5;
    }
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#050510] select-none">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        className="absolute inset-0"
      />

      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10">
        <h1 className="text-xl md:text-2xl font-bold text-white/90 tracking-wide drop-shadow-lg">
          ✦ Interactive Solar System ✦
        </h1>
        <p className="text-xs text-white/40 mt-1">Click planets to explore • Scroll to zoom</p>
      </div>

      {/* Back button */}
      {focusedPlanet && (
        <button
          onClick={resetView}
          className="absolute top-4 left-4 z-20 flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-white/80 hover:text-white hover:bg-black/70 transition-all text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.963a.75.75 0 11-1.04 1.074l-5.5-5.25a.75.75 0 010-1.074l5.5-5.25a.75.75 0 111.04 1.074L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Overview
        </button>
      )}

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl rounded-2xl px-5 py-3 border border-white/10 z-10">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all text-white hover:scale-110"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div className="w-px h-6 bg-white/10" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpeed(Math.max(0.1, +(speed - 0.25).toFixed(2)))}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-bold hover:scale-110"
          >
            −
          </button>
          <div className="text-center min-w-[50px]">
            <div className="text-white/90 text-sm font-mono font-medium">{speed.toFixed(2)}×</div>
            <div className="text-[9px] text-white/30 uppercase tracking-wider">Speed</div>
          </div>
          <button
            onClick={() => setSpeed(Math.min(10, +(speed + 0.25).toFixed(2)))}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-bold hover:scale-110"
          >
            +
          </button>
        </div>

        <div className="w-px h-6 bg-white/10" />

        <div className="hidden md:flex items-center gap-1">
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                Math.abs(speed - s) < 0.01
                  ? 'bg-blue-500/40 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/10" />

        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            showLabels ? 'bg-white/15 text-white/80' : 'bg-white/5 text-white/30 hover:bg-white/10'
          }`}
        >
          Labels
        </button>
        <button
          onClick={() => setShowOrbits(!showOrbits)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            showOrbits ? 'bg-white/15 text-white/80' : 'bg-white/5 text-white/30 hover:bg-white/10'
          }`}
        >
          Orbits
        </button>
      </div>

      {/* Planet Legend */}
      <div className="absolute bottom-24 left-4 hidden lg:block z-10">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/5 p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 font-semibold px-1">Planets</p>
          <div className="space-y-0.5">
            {planets.map((planet) => (
              <button
                key={planet.id}
                onClick={() => focusOnPlanet(planet)}
                className={`flex items-center gap-2.5 w-full text-left rounded-lg px-2 py-1.5 transition-all ${
                  focusedPlanet === planet.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: planet.color,
                    boxShadow: focusedPlanet === planet.id ? `0 0 6px ${planet.color}` : 'none',
                  }}
                />
                <span className={`text-xs transition-colors ${
                  focusedPlanet === planet.id ? 'text-white/90 font-medium' : 'text-white/50 hover:text-white/80'
                }`}>
                  {planet.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Planet Info Panel */}
      {selectedPlanet && (
        <div className="absolute top-16 right-4 md:right-6 w-[340px] bg-gradient-to-b from-black/80 to-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden z-20 shadow-2xl shadow-black/50 animate-slide-in">
          <div className="relative p-5 pb-4">
            <button
              onClick={() => { setSelectedPlanet(null); setFocusedPlanet(null); cameraRef.current.targetX = 0; cameraRef.current.targetY = 0; cameraRef.current.targetZoom = 1; }}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all text-white/50 hover:text-white"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${lightenColor(selectedPlanet.color, 60)}, ${selectedPlanet.color}, ${darkenColor(selectedPlanet.colorSecondary, 30)})`,
                  boxShadow: `0 0 20px ${selectedPlanet.color}40`,
                }}
              />
              <div>
                <h2 className="text-xl font-bold text-white">{selectedPlanet.name}</h2>
                <p className="text-xs text-white/40">{selectedPlanet.type}</p>
              </div>
            </div>
          </div>
          <div className="px-5 pb-3">
            <p className="text-sm text-white/60 leading-relaxed">{selectedPlanet.description}</p>
          </div>
          <div className="px-5 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Diameter" value={selectedPlanet.realDiameter} />
              <StatCard label="Distance" value={selectedPlanet.distanceFromSun} />
              <StatCard label="Orbital Period" value={selectedPlanet.orbitalPeriod} />
              <StatCard label="Day Length" value={selectedPlanet.dayLength} />
              <StatCard label="Temperature" value={selectedPlanet.temperature} />
              <StatCard label="Moons" value={String(selectedPlanet.moons)} />
            </div>
          </div>
          <div className="px-5 pb-3">
            <div className="bg-white/5 rounded-lg px-3 py-2">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Atmosphere</span>
              <p className="text-xs text-white/70 mt-0.5">{selectedPlanet.atmosphere}</p>
            </div>
          </div>
          <div className="mx-5 mb-5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg px-3 py-2.5 border border-blue-500/10">
            <div className="flex items-start gap-2">
              <span className="text-sm">💡</span>
              <div>
                <span className="text-[10px] text-blue-300/60 uppercase tracking-wider font-semibold">Fun Fact</span>
                <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{selectedPlanet.funFact}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sun Info Panel */}
      {showSunInfo && (
        <div className="absolute top-16 right-4 md:right-6 w-[340px] bg-gradient-to-b from-black/80 to-black/60 backdrop-blur-2xl rounded-2xl border border-yellow-500/10 overflow-hidden z-20 shadow-2xl shadow-black/50 animate-slide-in">
          <div className="relative p-5 pb-4">
            <button
              onClick={() => setShowSunInfo(false)}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all text-white/50 hover:text-white"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-full shadow-lg"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, #fffde0, #ffcc00, #ff5500)',
                  boxShadow: '0 0 30px rgba(255, 180, 0, 0.4)',
                }}
              />
              <div>
                <h2 className="text-xl font-bold text-white">{SUN_DATA.name}</h2>
                <p className="text-xs text-white/40">{SUN_DATA.type}</p>
              </div>
            </div>
          </div>
          <div className="px-5 pb-3">
            <p className="text-sm text-white/60 leading-relaxed">{SUN_DATA.description}</p>
          </div>
          <div className="px-5 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Diameter" value={SUN_DATA.diameter} />
              <StatCard label="Age" value={SUN_DATA.age} />
              <StatCard label="Temperature" value={SUN_DATA.temperature} />
              <StatCard label="Luminosity" value={SUN_DATA.luminosity} />
            </div>
          </div>
          <div className="px-5 pb-3">
            <div className="bg-white/5 rounded-lg px-3 py-2">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Composition</span>
              <p className="text-xs text-white/70 mt-0.5">{SUN_DATA.composition}</p>
            </div>
          </div>
          <div className="mx-5 mb-5 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg px-3 py-2.5 border border-yellow-500/10">
            <div className="flex items-start gap-2">
              <span className="text-sm">☀️</span>
              <div>
                <span className="text-[10px] text-yellow-300/60 uppercase tracking-wider font-semibold">Fun Fact</span>
                <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{SUN_DATA.funFact}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help hint */}
      {!focusedPlanet && !selectedPlanet && !showSunInfo && (
        <div className="absolute bottom-24 right-4 z-10 hidden md:block">
          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/5 p-3 space-y-1.5">
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">Controls</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/20 bg-white/5 rounded px-1.5 py-0.5 font-mono">Scroll</span>
              <span className="text-[10px] text-white/40">Zoom in/out</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/20 bg-white/5 rounded px-1.5 py-0.5 font-mono">Click</span>
              <span className="text-[10px] text-white/40">Select planet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg px-3 py-2">
      <span className="text-[10px] text-white/30 uppercase tracking-wider">{label}</span>
      <p className="text-xs text-white/80 font-medium mt-0.5">{value}</p>
    </div>
  );
}

export default App;
