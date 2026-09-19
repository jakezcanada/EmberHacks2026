import { BaseStyle } from './base.js';
import { tracePoints } from '../shapes.js';

/** Sharp brush contours with splatter on a bright plane. */
export class InkStyle extends BaseStyle {
  constructor() {
    super({ maxMarks: 80, life: 1.5, wobble: 0.05, ground: '#f3f4f1' });
  }

  prepare(mark, env) {
    const n = env.isCalm ? 2 : Math.round(3 + mark.vel * 7);
    mark.splatter = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = 1.25 + Math.random() * 1.1;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8, s: 0.04 + Math.random() * 0.09 };
    });
  }

  paintMark(ctx, m, scale, alpha) {
    const r = m.r * scale;
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = m.color;
    tracePoints(ctx, m.pts, m.x, m.y, r, m.rotation);
    ctx.fill();

    // Brush weight thins as the ink dries
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = m.color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, r * 0.16 * (0.5 + 0.5 * alpha));
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = m.color;
    for (const s of m.splatter) {
      ctx.beginPath();
      ctx.arc(m.x + s.dx * r, m.y + s.dy * r, Math.max(1, s.s * r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
