import { BaseStyle } from './base.js';
import { pointInPolygon } from '../shapes.js';

/** Film-like stipple: each mark is a cloud of grains filling the instrument's shape. */
export class GrainStyle extends BaseStyle {
  constructor() {
    super({ maxMarks: 60, life: 1.8, ground: '#e2e3df' });
    this.noise = null;
    this.noiseClock = 0;
  }

  prepare(mark, env) {
    const count = env.isCalm ? 36 : 80;
    const grains = [];
    let guard = 0;
    while (grains.length < count && guard++ < count * 8) {
      const x = (Math.random() * 2 - 1) * (mark.shape === 'line' ? env.stretch : 1.15);
      const y = (Math.random() * 2 - 1) * 1.15;
      if (pointInPolygon(x, y, mark.pts)) grains.push({ x, y, s: 1 + Math.random() * 1.6 });
    }
    mark.grains = grains;
  }

  paintMark(ctx, m, scale, alpha) {
    const r = m.r * scale;
    // Grains loosen outward as the mark ages
    const loosen = 1 + (m.age / m.life) * 0.25;
    ctx.fillStyle = m.color;
    ctx.globalAlpha = alpha;
    const cos = Math.cos(m.rotation);
    const sin = Math.sin(m.rotation);
    for (const g of m.grains) {
      const px = g.x * r * loosen;
      const py = g.y * r * loosen;
      ctx.fillRect(m.x + px * cos - py * sin, m.y + px * sin + py * cos, g.s, g.s);
    }
    ctx.globalAlpha = 1;
  }

  paintOverlay(ctx, state, dt) {
    if (!this.noise) this.noise = makeNoiseTile();
    // Re-seed the grain field 12 times a second: film texture, never a flash
    this.noiseClock += dt;
    if (this.noiseClock > 1 / 12) {
      this.noiseClock = 0;
      this.offset = [Math.random() * 128, Math.random() * 128];
    }
    const [ox, oy] = this.offset || [0, 0];
    ctx.save();
    ctx.globalAlpha = state.isCalm ? 0.05 : 0.09;
    ctx.fillStyle = ctx.createPattern(this.noise, 'repeat');
    ctx.translate(-ox, -oy);
    ctx.fillRect(ox, oy, state.width, state.height);
    ctx.restore();
  }
}

function makeNoiseTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 20 : 235;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
