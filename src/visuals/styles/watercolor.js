import { hexToRgba } from '../palettes.js';

export class WatercolorStyle {
  constructor() {
    this.blobs = [];
  }

  spawn(event, { width, height, instrumentColors, instrumentShapes, motion, isCalm }) {
    const color = instrumentColors[event.instrument] || '#e07a5f';
    const shape = instrumentShapes[event.instrument] || 'blob';
    const vel = event.velocity || 0.8;

    // Fixed screen zones per instrument
    let yBase = height * 0.5;
    if (event.instrument === 'bass') yBase = height * 0.8;
    else if (event.instrument === 'melody') yBase = height * 0.25;
    else if (event.instrument === 'kick') yBase = height * 0.65;
    else if (event.instrument === 'snare') yBase = height * 0.45;
    else if (event.instrument === 'hat') yBase = height * 0.35;

    const x = width * (0.15 + 0.7 * Math.random());
    const y = yBase + (Math.random() - 0.5) * (height * 0.15);

    const baseRadius = (isCalm ? 30 : 45) * (0.6 + vel * 0.8);

    // Initial velocities depending on motion
    let vx = (Math.random() - 0.5) * 20;
    let vy = (Math.random() - 0.5) * 20;

    if (motion === 'scatter') {
      vx = (Math.random() - 0.5) * 120 * vel;
      vy = (Math.random() - 0.5) * 120 * vel;
    } else if (motion === 'drift') {
      vx = 15;
      vy = (Math.random() - 0.5) * 5;
    }

    this.blobs.push({
      x,
      y,
      vx,
      vy,
      color,
      shape,
      radius: baseRadius * 0.4,
      targetRadius: baseRadius,
      alpha: 0.7 * vel,
      life: 1.0,
      decay: isCalm ? 0.35 : 0.5,
      motion,
      numPoints: 6 + Math.floor(Math.random() * 4),
      pointOffsets: new Array(10).fill(0).map(() => 0.8 + Math.random() * 0.4),
    });

    if (this.blobs.length > (isCalm ? 25 : 50)) {
      this.blobs.shift();
    }
  }

  draw(ctx, state, dt) {
    const { width, height, energy, isCalm } = state;

    // Soft watercolor paper background wash
    ctx.fillStyle = isCalm ? 'rgba(247, 245, 240, 0.2)' : 'rgba(244, 241, 235, 0.25)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';

    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i];
      b.life -= b.decay * dt;

      if (b.life <= 0) {
        this.blobs.splice(i, 1);
        continue;
      }

      // Motion dynamics
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.motion === 'swell') {
        b.radius = b.targetRadius * (1 + (energy.mid || 0) * 0.8);
      } else if (b.motion === 'pulse') {
        b.radius = b.targetRadius * (1 + Math.sin(b.life * 8) * 0.2);
      } else {
        b.radius += (b.targetRadius - b.radius) * dt * 4;
      }

      const currentAlpha = b.alpha * Math.pow(b.life, 1.4);
      ctx.fillStyle = hexToRgba(b.color, currentAlpha);
      ctx.strokeStyle = hexToRgba(b.color, currentAlpha * 1.2);
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      // Draw organic organic watercolor blob
      for (let j = 0; j < b.numPoints; j++) {
        const angle = (j / b.numPoints) * Math.PI * 2;
        const r = b.radius * b.pointOffsets[j];
        const px = b.x + Math.cos(angle) * r;
        const py = b.y + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
