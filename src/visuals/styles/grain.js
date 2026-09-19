import { hexToRgba } from '../palettes.js';

export class GrainStyle {
  constructor() {
    this.grains = [];
  }

  spawn(event, { width, height, instrumentColors, instrumentShapes, motion, isCalm }) {
    const color = instrumentColors[event.instrument] || '#d4a373';
    const vel = event.velocity || 0.8;

    let yBase = height * 0.5;
    if (event.instrument === 'bass') yBase = height * 0.8;
    else if (event.instrument === 'melody') yBase = height * 0.25;
    else if (event.instrument === 'kick') yBase = height * 0.65;
    else if (event.instrument === 'snare') yBase = height * 0.45;
    else if (event.instrument === 'hat') yBase = height * 0.35;

    const count = isCalm ? 12 : Math.floor(25 + vel * 30);
    const originX = width * (0.15 + 0.7 * Math.random());
    const originY = yBase + (Math.random() - 0.5) * (height * 0.1);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (20 + Math.random() * 80) * vel;

      this.grains.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 1 + Math.random() * 2.5,
        life: 1.0,
        decay: (isCalm ? 0.4 : 0.6) + Math.random() * 0.4,
        motion,
      });
    }

    if (this.grains.length > (isCalm ? 80 : 250)) {
      this.grains.splice(0, this.grains.length - (isCalm ? 80 : 250));
    }
  }

  draw(ctx, state, dt) {
    const { width, height, isCalm } = state;

    // Warm vintage film backdrop wash
    ctx.fillStyle = 'rgba(28, 25, 23, 0.25)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (let i = this.grains.length - 1; i >= 0; i--) {
      const g = this.grains[i];
      g.life -= g.decay * dt;

      if (g.life <= 0) {
        this.grains.splice(i, 1);
        continue;
      }

      g.x += g.vx * dt;
      g.y += g.vy * dt;

      const alpha = Math.min(1.0, g.life * 1.5);
      ctx.fillStyle = hexToRgba(g.color, alpha);
      ctx.fillRect(g.x, g.y, g.size, g.size);
    }

    // Add subtle ambient film noise if not calm
    if (!isCalm) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (let j = 0; j < 30; j++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
      }
    }

    ctx.restore();
  }
}
