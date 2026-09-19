/**
 * Shared instrument geometry. Every texture draws the same eight shapes so an
 * instrument is recognisable by form, not only by color.
 * Points are in unit space (radius 1) and scaled at draw time.
 */

export const SHAPES = ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond', 'hexagon'];

function circlePoints(n = 28) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  return pts;
}

function blobPoints(seed = Math.random()) {
  const pts = [];
  const n = 28;
  const p1 = seed * 6.28;
  const p2 = seed * 17.3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.16 * Math.sin(a * 2 + p1) + 0.09 * Math.sin(a * 3 + p2);
    pts.push([Math.cos(a) * r * 1.12, Math.sin(a) * r * 0.86]);
  }
  return pts;
}

const BASE = {
  circle: circlePoints(),
  square: [[-0.86, -0.86], [0.86, -0.86], [0.86, 0.86], [-0.86, 0.86]],
  triangle: [[0, -1.08], [0.98, 0.72], [-0.98, 0.72]],
  diamond: [[0, -1.12], [0.92, 0], [0, 1.12], [-0.92, 0]],
  hexagon: Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3) * 0.92]),
  star: (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 1.1 : 0.46;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  })(),
};

/** A horizontal bar with rounded ends; `stretch` sets its length relative to its height. */
function linePoints(stretch = 2.6) {
  const h = 0.34;
  const half = Math.max(h, stretch);
  const pts = [];
  const cap = 8;
  for (let i = 0; i <= cap; i++) {
    const a = -Math.PI / 2 + (i / cap) * Math.PI;
    pts.push([half - h + Math.cos(a) * h, Math.sin(a) * h]);
  }
  for (let i = 0; i <= cap; i++) {
    const a = Math.PI / 2 + (i / cap) * Math.PI;
    pts.push([-half + h + Math.cos(a) * h, Math.sin(a) * h]);
  }
  return pts;
}

/**
 * Unit polygon for a shape. `wobble` (0..1) roughens edges for painted textures.
 */
export function shapePoints(shape, { stretch = 2.6, wobble = 0, seed = Math.random() } = {}) {
  let pts;
  if (shape === 'line') pts = linePoints(stretch);
  else if (shape === 'blob') pts = blobPoints(seed);
  else pts = (BASE[shape] || BASE.circle).map((p) => [p[0], p[1]]);

  if (wobble > 0) {
    // Subdivide straight edges so the wobble can bend them
    const dense = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const steps = pts.length < 12 ? 5 : 1;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        dense.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts = dense.map(([x, y]) => {
      const j = 1 + (Math.random() - 0.5) * wobble;
      return [x * j, y * j];
    });
  }
  return pts;
}

export function tracePoints(ctx, pts, x, y, r, rotation = 0) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0] * r;
    const py = pts[i][1] * r;
    const tx = x + px * cos - py * sin;
    const ty = y + px * sin + py * cos;
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  }
  ctx.closePath();
}

/** Returns true when unit-space point (x, y) is inside polygon pts. */
export function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Small glyph used in the score, legend and settings, drawn with an ink contour. */
export function drawGlyph(ctx, shape, x, y, r, { fill, fillAlpha = 1, ink = '#141414', inkAlpha = 1, lineWidth = 1.25 } = {}) {
  const pts = shape === 'line' ? shapePoints('line', { stretch: 1.5 }) : BASE[shape] || (shape === 'blob' ? BLOB_GLYPH : BASE.circle);
  tracePoints(ctx, pts, x, y, r);
  if (fill && fillAlpha > 0) {
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (inkAlpha > 0) {
    ctx.globalAlpha = inkAlpha;
    ctx.strokeStyle = ink;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const BLOB_GLYPH = blobPoints(0.37);

/** SVG path data for a shape glyph (used by DOM legend and settings). */
export function glyphSvgPath(shape, size = 20) {
  const pts = shape === 'line' ? shapePoints('line', { stretch: 1.4 }) : shape === 'blob' ? BLOB_GLYPH : BASE[shape] || BASE.circle;
  const r = size * 0.4;
  const c = size / 2;
  return pts.map((p, i) => `${i ? 'L' : 'M'}${(c + p[0] * r).toFixed(2)} ${(c + p[1] * r).toFixed(2)}`).join(' ') + 'Z';
}
