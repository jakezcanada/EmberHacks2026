import { hexToRgba } from '../palettes.js';

export class GlassStyle {
  constructor() {
    this.panes = [];
  }

  spawn(event, { width, height, instrumentColors, instrumentShapes, motion, isCalm }) {
    const color = instrumentColors[event.instrument] || '#90e0ef';
    const shape = instrumentShapes[event.instrument] || 'square';
    const vel = event.velocity || 0.8;

    let yBase = height * 0.5;
    if (event.instrument === 'bass') yBase = height * 0.8;
    else if (event.instrument === 'melody') yBase = height * 0.25;
    else if (event.instrument === 'kick') yBase = height * 0.65;
    else if (event.instrument === 'snare') yBase = height * 0.45;
    else if (event.instrument === 'hat') yBase = height * 0.35;

    const x = width * (0.15 + 0.7 * Math.random());
    const y = yBase + (Math.random() - 0.5) * (height * 0.12);

    const w = (isCalm ? 45 : 70) * (0.6 + vel * 0.7);
    const h = (isCalm ? 35 : 55) * (0.6 + vel * 0.7);

    this.panes.push({
      x,
      y,
      w,
      h,
      color,
      shape,
      vel,
      angle: (Math.random() - 0.5) * 0.5,
      life: 1.0,
      decay: isCalm ? 0.3 : 0.45,
      motion,
      vx: motion === 'drift' ? 15 : (motion === 'scatter' ? (Math.random() - 0.5) * 60 : 0),
      vy: motion === 'scatter' ? (Math.random() - 0.5) * 60 : 0,
    });

    if (this.panes.length > (isCalm ? 20 : 40)) {
      this.panes.shift();
    }
  }

  draw(ctx, state, dt) {
    const { width, height, energy, isCalm } = state;

    // Deep frosted glass backdrop wash
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = this.panes.length - 1; i >= 0; i--) {
      const p = this.panes[i];
      p.life -= p.decay * dt;

      if (p.life <= 0) {
        this.panes.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      let dynamicW = p.w;
      let dynamicH = p.h;
      if (p.motion === 'swell') {
        dynamicW *= 1 + (energy.low || 0) * 0.7;
        dynamicH *= 1 + (energy.low || 0) * 0.7;
      }

      const alpha = Math.min(0.65, p.life * 0.7);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Glass fill gradient
      const grad = ctx.createLinearGradient(-dynamicW / 2, -dynamicH / 2, dynamicW / 2, dynamicH / 2);
      grad.addColorStop(0, hexToRgba(p.color, alpha * 0.9));
      grad.addColorStop(1, hexToRgba(p.color, alpha * 0.2));

      ctx.fillStyle = grad;
      ctx.strokeStyle = hexToRgba('#ffffff', alpha * 0.8);
      ctx.lineWidth = 1.5;

      // Rounded rectangle pane
      drawRoundedRect(ctx, -dynamicW / 2, -dynamicH / 2, dynamicW, dynamicH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
