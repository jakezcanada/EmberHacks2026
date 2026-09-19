import { BaseStyle } from './base.js';
import { shapePoints, tracePoints } from '../shapes.js';

/** Soft washes: each mark is three translucent, slightly different layers that bleed outward. */
export class WatercolorStyle extends BaseStyle {
  constructor() {
    super({ maxMarks: 70, life: 2.2, wobble: 0.12, ground: '#eceeeb' });
  }

  prepare(mark, env) {
    mark.layers = [0, 1, 2].map(() => shapePoints(mark.shape, { stretch: env.stretch, wobble: 0.2 }));
  }

  paintMark(ctx, m, scale, alpha) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = m.color;
    // Bleed: later layers are larger and fainter as the wash spreads
    const spread = 1 + Math.min(1, m.age / m.life) * 0.18;
    m.layers.forEach((pts, i) => {
      ctx.globalAlpha = alpha * (0.34 - i * 0.08);
      tracePoints(ctx, pts, m.x, m.y, m.r * scale * (1 + i * 0.07) * spread, m.rotation);
      ctx.fill();
    });
    // Pigment gathers at the edge of the first layer
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 1.4;
    tracePoints(ctx, m.pts, m.x, m.y, m.r * scale, m.rotation);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
