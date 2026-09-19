import { BaseStyle } from './base.js';
import { tracePoints } from '../shapes.js';

/** Glowing contours on a dark plane. The only texture that darkens the ground. */
export class NeonStyle extends BaseStyle {
  constructor() {
    super({ maxMarks: 80, life: 1.4, ground: '#0f1014', dark: true });
  }

  paintMark(ctx, m, scale, alpha, state) {
    const r = m.r * scale;
    ctx.globalCompositeOperation = 'lighter';
    tracePoints(ctx, m.pts, m.x, m.y, r, m.rotation);
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = m.color;
    ctx.shadowBlur = state.isCalm ? 6 : 16;
    ctx.strokeStyle = m.color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = state.isCalm ? 2 : 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
