import { hexToRgba } from '../palettes.js';

export class NeonStyle {
  constructor() {
    this.particles = [];
  }

  spawn(event, { width, height, instrumentColors, instrumentShapes, motion, isCalm }) {
    const color = instrumentColors[event.instrument] || '#00f0ff';
    const shape = instrumentShapes[event.instrument] || 'circle';
    const vel = event.velocity || 0.8;

    let yBase = height * 0.5;
    if (event.instrument === 'bass') yBase = height * 0.82;
    else if (event.instrument === 'melody') yBase = height * 0.22;
    else if (event.instrument === 'kick') yBase = height * 0.65;
    else if (event.instrument === 'snare') yBase = height * 0.45;
    else if (event.instrument === 'hat') yBase = height * 0.35;

    const x = width * (0.1 + 0.8 * Math.random());
    const y = yBase + (Math.random() - 0.5) * (height * 0.12);

    const baseSize = (isCalm ? 24 : 36) * (0.6 + vel * 0.7);

    let vx = (Math.random() - 0.5) * 30;
    let vy = (Math.random() - 0.5) * 30;
    if (motion === 'scatter') {
      vx = (Math.random() - 0.5) * 160 * vel;
      vy = (Math.random() - 0.5) * 160 * vel;
    } else if (motion === 'drift') {
      vx = 25;
      vy = (Math.random() - 0.5) * 10;
    }

    this.particles.push({
      x,
      y,
      vx,
      vy,
      color,
      shape,
      vel,
      size: baseSize,
      life: 1.0,
      decay: isCalm ? 0.35 : 0.55,
      motion,
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 2,
    });

    if (this.particles.length > (isCalm ? 30 : 70)) {
      this.particles.shift();
    }
  }

  draw(ctx, state, dt) {
    const { width, height, energy, isCalm } = state;

    // Dark cyberpunk backdrop with fade trail
    ctx.fillStyle = 'rgba(10, 11, 18, 0.28)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.rotationSpeed * dt;

      const alpha = Math.min(1.0, p.life * 1.6);
      let dynamicSize = p.size;
      if (p.motion === 'pulse') {
        dynamicSize *= 1 + Math.sin(p.life * 10) * 0.25;
      } else if (p.motion === 'swell') {
        dynamicSize *= 1 + (energy.high || 0) * 0.9;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Glow effect (reduced in calm mode)
      ctx.shadowBlur = isCalm ? 6 : 18;
      ctx.shadowColor = p.color;
      ctx.strokeStyle = hexToRgba(p.color, alpha);
      ctx.fillStyle = hexToRgba(p.color, alpha * 0.25);
      ctx.lineWidth = isCalm ? 2 : 3;

      // Draw according to instrument shape
      drawShape(ctx, p.shape, dynamicSize);

      ctx.restore();
    }

    ctx.restore();
  }
}

function drawShape(ctx, shape, size) {
  const r = size / 2;
  ctx.beginPath();

  if (shape === 'square') {
    ctx.rect(-r, -r, size, size);
  } else if (shape === 'triangle') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r, r);
    ctx.lineTo(-r, r);
    ctx.closePath();
  } else if (shape === 'line') {
    ctx.moveTo(-r * 1.5, 0);
    ctx.lineTo(r * 1.5, 0);
  } else if (shape === 'diamond') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
  } else if (shape === 'star') {
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * r, -Math.sin((18 + i * 72) * Math.PI / 180) * r);
      ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (r * 0.5), -Math.sin((54 + i * 72) * Math.PI / 180) * (r * 0.5));
    }
    ctx.closePath();
  } else {
    // Circle or blob
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }

  ctx.fill();
  ctx.stroke();
}
