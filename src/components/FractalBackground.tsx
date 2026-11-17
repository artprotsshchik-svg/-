import { useEffect, useRef } from 'react';
import type { ThemeConfig } from './ThemeConfigurator.tsx';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [60, 200, 140];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(
  palette: Array<[number, number, number]>,
  t: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t)) * (palette.length - 1);
  const i = Math.floor(clamped);
  const f = clamped - i;
  const a = palette[i];
  const b = palette[Math.min(palette.length - 1, i + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

function hash2D(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2D(xi, yi);
  const b = hash2D(xi + 1, yi);
  const c = hash2D(xi, yi + 1);
  const d = hash2D(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbmNoise(x: number, y: number): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    val += amp * valueNoise(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

export function FractalBackground({ config }: { config: ThemeConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || config.fractal === 'none' || config.fractalOpacity <= 0) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = config.colors.map(hexToRgb);
    const scaleFactor = 0.45 + (config.fractalScale / 100) * 1.15;
    let rafId = 0;
    let timerId = 0;
    let cancelled = false;

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = Math.max(320, Math.floor(window.innerWidth * dpr));
      const h = Math.max(200, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    syncSize();

    const drawPixelFractal = (timeSec: number, type: 'julia' | 'fbm') => {
      let off = offscreenRef.current;
      if (!off) {
        off = document.createElement('canvas');
        offscreenRef.current = off;
      }
      const ow = 180;
      const oh = 108;
      if (off.width !== ow || off.height !== oh) {
        off.width = ow;
        off.height = oh;
      }
      const octx = off.getContext('2d');
      if (!octx) return;
      const img = octx.createImageData(ow, oh);
      const data = img.data;
      const aspect = canvas.width / Math.max(1, canvas.height);

      if (type === 'julia') {
        const cx = -0.745 + Math.cos(timeSec * 0.22) * 0.045;
        const cy = 0.186 + Math.sin(timeSec * 0.17) * 0.045;
        const zoom = 1.45 / scaleFactor;
        const maxIter = 24;

        for (let py = 0; py < oh; py++) {
          const zy0 = ((py / oh) - 0.5) * 2 * zoom;
          for (let px = 0; px < ow; px++) {
            let zx = ((px / ow) - 0.5) * 2 * aspect * zoom;
            let zy = zy0;
            let iter = 0;
            while (zx * zx + zy * zy < 4 && iter < maxIter) {
              const tmp = zx * zx - zy * zy + cx;
              zy = 2 * zx * zy + cy;
              zx = tmp;
              iter++;
            }
            const idx = (py * ow + px) * 4;
            if (iter === maxIter) {
              data[idx] = palette[0][0];
              data[idx + 1] = palette[0][1];
              data[idx + 2] = palette[0][2];
              data[idx + 3] = 28;
            } else {
              const t = iter / maxIter;
              const [r, g, b] = lerpColor(palette, t);
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = Math.round(50 + t * 205);
            }
          }
        }
      } else {
        const shiftX = timeSec * 0.12;
        const shiftY = timeSec * 0.08;
        const zoom = 2.6 / scaleFactor;
        for (let py = 0; py < oh; py++) {
          const ny = (py / oh) * zoom;
          for (let px = 0; px < ow; px++) {
            const nx = (px / ow) * aspect * zoom;
            const qx = fbmNoise(nx + shiftX, ny + shiftY);
            const qy = fbmNoise(nx + 5.2 - shiftY, ny + 1.3 + shiftX);
            const val = fbmNoise(nx + 2.4 * qx, ny + 2.4 * qy);
            const [r, g, b] = lerpColor(palette, val);
            const idx = (py * ow + px) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = Math.round(Math.max(0, Math.min(255, val * 255)));
          }
        }
      }

      octx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    };

    const drawTree = (timeSec: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const sway = Math.sin(timeSec * 0.5) * 0.04;
      const branch = (
        x: number,
        y: number,
        len: number,
        angle: number,
        depth: number,
        colorIdx: number
      ) => {
        if (depth <= 0 || len < 4) return;
        const x2 = x + Math.cos(angle) * len;
        const y2 = y + Math.sin(angle) * len;
        const [r, g, b] = palette[colorIdx % palette.length];
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.22 + depth * 0.08})`;
        ctx.lineWidth = Math.max(0.8, depth * 0.55);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const nextLen = len * 0.72;
        const spread = 0.42 + (scaleFactor - 0.8) * 0.1;
        branch(x2, y2, nextLen, angle - spread + sway, depth - 1, colorIdx + 1);
        branch(x2, y2, nextLen, angle + spread + sway, depth - 1, colorIdx + 2);
      };

      const baseLen = Math.min(w, h) * 0.18 * scaleFactor;
      branch(w * 0.14, h * 0.96, baseLen, -Math.PI * 0.44, 8, 0);
      branch(w * 0.86, h * 0.96, baseLen * 0.95, -Math.PI * 0.56, 8, 2);
    };

    const drawKoch = (timeSec: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const kochSegment = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        depth: number,
        pts: Array<[number, number]>
      ) => {
        if (depth === 0) {
          pts.push([bx, by]);
          return;
        }
        const dx = (bx - ax) / 3;
        const dy = (by - ay) / 3;
        const x1 = ax + dx;
        const y1 = ay + dy;
        const x3 = ax + 2 * dx;
        const y3 = ay + 2 * dy;
        const px = x1 + (dx * 0.5 - dy * 0.8660254);
        const py = y1 + (dx * 0.8660254 + dy * 0.5);
        kochSegment(ax, ay, x1, y1, depth - 1, pts);
        kochSegment(x1, y1, px, py, depth - 1, pts);
        kochSegment(px, py, x3, y3, depth - 1, pts);
        kochSegment(x3, y3, bx, by, depth - 1, pts);
      };

      const rot = timeSec * 0.08;
      const rings = [
        { cx: w * 0.5, cy: h * 0.52, r: Math.min(w, h) * 0.36 * scaleFactor, color: palette[3], depth: 3 },
        { cx: w * 0.2, cy: h * 0.25, r: Math.min(w, h) * 0.19 * scaleFactor, color: palette[0], depth: 3 },
        { cx: w * 0.82, cy: h * 0.78, r: Math.min(w, h) * 0.21 * scaleFactor, color: palette[1], depth: 3 },
      ];

      for (let idx = 0; idx < rings.length; idx++) {
        const ring = rings[idx];
        const v: Array<[number, number]> = [0, 1, 2].map(k => {
          const a = rot * (idx % 2 === 0 ? 1 : -1) + (k * Math.PI * 2) / 3;
          return [ring.cx + Math.cos(a) * ring.r, ring.cy + Math.sin(a) * ring.r];
        });
        const pts: Array<[number, number]> = [v[0]];
        kochSegment(v[0][0], v[0][1], v[1][0], v[1][1], ring.depth, pts);
        kochSegment(v[1][0], v[1][1], v[2][0], v[2][1], ring.depth, pts);
        kochSegment(v[2][0], v[2][1], v[0][0], v[0][1], ring.depth, pts);

        const [r, g, b] = ring.color;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.65)`;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
        ctx.closePath();
        ctx.stroke();
      }
    };

    const drawSierpinski = (timeSec: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const drawTri = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        depth: number,
        colorIdx: number
      ) => {
        if (depth <= 0) {
          const [r, g, b] = palette[colorIdx % palette.length];
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.65)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x3, y3);
          ctx.closePath();
          ctx.stroke();
          return;
        }
        const mx12 = (x1 + x2) / 2;
        const my12 = (y1 + y2) / 2;
        const mx23 = (x2 + x3) / 2;
        const my23 = (y2 + y3) / 2;
        const mx31 = (x3 + x1) / 2;
        const my31 = (y3 + y1) / 2;
        drawTri(x1, y1, mx12, my12, mx31, my31, depth - 1, colorIdx);
        drawTri(mx12, my12, x2, y2, mx23, my23, depth - 1, colorIdx + 1);
        drawTri(mx31, my31, mx23, my23, x3, y3, depth - 1, colorIdx + 2);
      };

      const size = Math.min(w, h) * 0.44 * scaleFactor;
      const rot = timeSec * 0.05;
      const cx = w * 0.5;
      const cy = h * 0.53;
      const pts: Array<[number, number]> = [0, 1, 2].map(k => {
        const a = rot - Math.PI / 2 + (k * Math.PI * 2) / 3;
        return [cx + Math.cos(a) * size, cy + Math.sin(a) * size];
      });
      drawTri(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], 5, 0);
    };

    const drawAt = (timeMs: number) => {
      if (cancelled) return;
      const t = timeMs / 1000;
      if (config.fractal === 'julia' || config.fractal === 'fbm') {
        drawPixelFractal(t, config.fractal);
      } else if (config.fractal === 'tree') {
        drawTree(t);
      } else if (config.fractal === 'koch') {
        drawKoch(t);
      } else if (config.fractal === 'sierpinski') {
        drawSierpinski(t);
      }
      if (config.animate) {
        timerId = window.setTimeout(() => {
          rafId = requestAnimationFrame(drawAt);
        }, 160);
      }
    };

    const onResize = () => {
      syncSize();
      drawAt(performance.now());
    };

    window.addEventListener('resize', onResize);
    drawAt(0);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      if (timerId) window.clearTimeout(timerId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [config.fractal, config.fractalOpacity, config.fractalScale, config.colors, config.animate]);

  if (config.fractal === 'none' || config.fractalOpacity <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{
        opacity: +(Math.max(0, Math.min(100, config.fractalOpacity)) / 100).toFixed(2),
      }}
    />
  );
}
