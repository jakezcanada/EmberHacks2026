import { hexToRgba } from '../palettes.js';

export class InkStyle {
  constructor() {
    this.elements = [];
  }

  spawn(event, { width, height, instrumentColors, instrumentShapes, motion, isCalm }) {
    const color = instrumentColors[event.instrument] || '#111116';
    const shape = instrumentShapes[event.instrument] || 'line';
    const vel = event.velocity || 0.8;

    let yBase = height * 0.5;
    if (event.instrument === 'bass') yBase = height * 0.82;
    else if (event.instrument === 'melody') yBase = height * 0.22;
    else if (event.instrument === 'kick') yBase = height * 0.68;
    else if (event.instrument === 'snare') yBase = height * 0.45;
    else if (event.instrument === 'hat') yBase = height * 0.32;

    const x = width * (0.15 + 0.7 * Math.random());
    const y = yBase + (Math.random() - 0.5) * (height * 0.12);

    const length = (isCalm ? 40 : 70) * (0.5 + vel * 0.8);
    const angle = (Math.random() - 0.5) * Math.PI * 0.6;

    // Splatter particles
    const splatters = [];
    const numSplats = isCalm ? 2 : Math.floor(4 + vel * 8);
    for (let i = 0; i < numSplats; i++) {
      splatters.push({
        dx: (Math.random() - 0.5) * 50 * vel,
        dy: (Math.random() - 0.5) * 50 * vel,
        r: (1 + Math.random() * 3) * vel,
      });
    }

    this.elements.push({
      x,
      y,
      color,
      shape,
      vel,
      length,
      angle,
      splatters,
      life: 1.0,
      decay: isCalm ? 0.3 : 0.45,
      motion,
      vx: motion === 'drift' ? 20 : (motion === 'scatter' ? (Math.random() - 0.5) * 80 : 0),
      vy: motion === 'scatter' ? (Math.random() - 0.5) * 80 : 0,
    });

    if (this.elements.length > (isCalm ? 25 : 60)) {
      this.elements.shift();
    }
  }

  draw(ctx, state, dt) {
    const { width, height, energy, isCalm } = state;

    // Clean paper wash
    ctx.fillStyle = isCalm ? 'rgba(250, 250, 248, 0.2)' : 'rgba(248, 248, 244, 0.25)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      el.life -= el.decay * dt;

      if (el.life <= 0) {
        this.elements.splice(i, 1);
        continue;
      }

      el.x += el.vx * dt;
      el.y += el.vy * dt;

      const alpha = Math.min(1.0, el.life * 1.5);
      ctx.fillStyle = hexToRgba(el.color, alpha);
      ctx.strokeStyle = hexToRgba(el.color, alpha);

      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate(el.angle);

      const dynamicLen = el.motion === 'swell'
        ? el.length * (1 + (energy.mid || 0) * 0.8)
        : el.length;

      // Stroke
      ctx.lineWidth = Math.max(1, (3 + el.vel * 4) * el.life);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-dynamicLen / 2, 0);
      ctx.lineTo(dynamicLen / 2, 0);
      ctx.stroke();

      // Draw ink splatter dots
      for (const sp of el.splatters) {
        ctx.beginPath();
        ctx.arc(sp.dx, sp.dy, sp.r * el.life, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.restore();
  }
}
