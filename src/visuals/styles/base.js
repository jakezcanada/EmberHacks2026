import { shapePoints } from '../shapes.js';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Shared mark lifecycle for every texture: spawn at the instrument's place,
 * bloom in, move by the song's motion style, fade out. Subclasses only decide
 * how a mark is painted (`paintMark`) and what the plane looks like (`ground`).
 */
export class BaseStyle {
  constructor({ maxMarks = 90, life = 1.6, wobble = 0, ground = '#eceeeb', dark = false } = {}) {
    this.marks = [];
    this.maxMarks = maxMarks;
    this.life = life;
    this.wobble = wobble;
    this.ground = ground;
    this.dark = dark;
  }

  spawn(event, env) {
    const { x, y, r, stretch = 1, color, shape, motion, isCalm, unit, band } = env;
    const vel = event.velocity ?? 0.8;
    const calmFactor = isCalm ? 0.4 : 1;

    const mark = {
      x, y, r, color, shape, motion, vel, band,
      age: 0,
      life: this.life * (isCalm ? 1.5 : 1),
      rotation: shape === 'line' || shape === 'circle' || isCalm ? 0 : (Math.random() - 0.5) * 0.4,
      spin: 0,
      vx: 0,
      vy: 0,
      pts: shapePoints(shape, { stretch, wobble: this.wobble }),
    };

    if (motion === 'drift') {
      mark.vx = unit * 1.6 * calmFactor;
      mark.vy = (Math.random() - 0.5) * unit * 0.5 * calmFactor;
    } else if (motion === 'scatter') {
      const a = Math.random() * Math.PI * 2;
      const speed = unit * (7 + 8 * vel) * calmFactor;
      mark.vx = Math.cos(a) * speed;
      mark.vy = Math.sin(a) * speed * 0.6;
      mark.spin = (Math.random() - 0.5) * 2 * calmFactor;
    }

    this.prepare(mark, env);
    this.marks.push(mark);
    const cap = isCalm ? Math.round(this.maxMarks / 2) : this.maxMarks;
    if (this.marks.length > cap) this.marks.splice(0, this.marks.length - cap);
  }

  /** Hook for per-texture setup (extra layers, stipple points, splatter). */
  prepare() {}

  scaleOf(mark, state) {
    const bloom = mark.age < 0.14 ? 0.55 + 0.45 * easeOut(mark.age / 0.14) : 1;
    let motion = 1;
    if (mark.motion === 'pulse') motion = 1 + 0.3 * state.beatPulse * (state.isCalm ? 0.35 : 1);
    else if (mark.motion === 'swell') motion = 1 + 0.8 * (state.energy[mark.band] || 0) * (state.isCalm ? 0.5 : 1);
    return bloom * motion;
  }

  alphaOf(mark) {
    const t = mark.age / mark.life;
    return t >= 1 ? 0 : Math.pow(1 - t, 1.3);
  }

  draw(ctx, state, dt) {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.age += dt;
      if (m.age >= m.life) {
        this.marks.splice(i, 1);
        continue;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rotation += m.spin * dt;
      if (m.motion === 'scatter') {
        const drag = Math.exp(-1.8 * dt);
        m.vx *= drag;
        m.vy *= drag;
      }
    }

    ctx.save();
    for (const m of this.marks) {
      this.paintMark(ctx, m, this.scaleOf(m, state), this.alphaOf(m), state);
    }
    ctx.restore();
    this.paintOverlay(ctx, state, dt);
  }

  paintMark() {}
  paintOverlay() {}

  clear() {
    this.marks = [];
  }
}
