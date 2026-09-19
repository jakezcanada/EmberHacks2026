import { BaseStyle } from './base.js';
import { tracePoints } from '../shapes.js';
import { hexToRgba } from '../palettes.js';

/** Translucent overlapping panes cut in each instrument's shape. */
export class GlassStyle extends BaseStyle {
  constructor() {
    super({ maxMarks: 50, life: 2.0, ground: '#e5e8ea' });
  }

  paintMark(ctx, m, scale, alpha) {
    const r = m.r * scale * 1.15;
    tracePoints(ctx, m.pts, m.x, m.y, r, m.rotation);
    const grad = ctx.createLinearGradient(m.x - r, m.y - r, m.x + r, m.y + r);
    grad.addColorStop(0, hexToRgba(m.color, 0.85 * alpha));
    grad.addColorStop(1, hexToRgba(m.color, 0.32 * alpha));
    ctx.fillStyle = grad;
    ctx.fill();
    // Pane edge: bright bevel over a hairline of ink
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(20, 20, 20, ${0.6 * alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.translate(-1, -1);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
