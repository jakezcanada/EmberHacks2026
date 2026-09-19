import { safetyManager } from './safety.js';
import { WatercolorStyle } from './styles/watercolor.js';
import { InkStyle } from './styles/ink.js';
import { NeonStyle } from './styles/neon.js';
import { GrainStyle } from './styles/grain.js';
import { GlassStyle } from './styles/glass.js';
import { hexToRgba } from './palettes.js';
import { LANES, LANE_BY_ID, DRUM_LANES, pitchRange, pitchFraction, laneActivity, partNotes } from './lanes.js';
import { shapePoints, tracePoints, drawGlyph } from './shapes.js';

const INK = '#141414';
const SHEET = '#f6f7f5';
const MONO = '"Martian Mono", ui-monospace, monospace';
const SANS = 'Jost, "Futura", system-ui, sans-serif';

// Relative size of each instrument's mark, in plane units
const SIZE = { kick: 2.3, snare: 1.8, clap: 1.5, hat: 1.0, perc: 1.2, melody: 1.3, bass: 1.9, chords: 1.0 };

const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function hexToRgb(hex) {
  let c = String(hex).replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * One canvas, two layers sharing one time axis:
 *  - the plane (top): Gemini's texture paints each hit where and when it happens
 *  - the score (bottom): one labeled lane per instrument, the whole loop visible
 * Discrete hits arrive from the engine's Tone.Draw events; FFT only drives
 * continuous energy (swell) and never triggers marks.
 */
export class VisualRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.styles = {
      watercolor: new WatercolorStyle(),
      ink: new InkStyle(),
      neon: new NeonStyle(),
      grain: new GrainStyle(),
      glass: new GlassStyle(),
    };
    this.styleName = 'watercolor';
    this.motion = 'drift';
    this.palette = [];
    this.instrumentColors = {
      kick: '#e07a5f', snare: '#f2cc8f', hat: '#81b29a', melody: '#3d5a80',
      bass: '#6d597a', clap: '#b56576', perc: '#eaac8b', chords: '#9c89b8',
    };
    this.instrumentShapes = {
      kick: 'circle', snare: 'square', hat: 'triangle', melody: 'line',
      bass: 'blob', clap: 'star', perc: 'diamond', chords: 'hexagon',
    };

    this.song = null;
    this.bars = 2;
    this.totalSteps = 32;
    this.bpm = 90;
    this.ranges = { melody: pitchRange(), bass: pitchRange(), chords: pitchRange() };
    this.activity = {};

    this.isPlaying = false;
    this.currentStep = -1;
    this.lastStepAt = 0;
    this.lastBeatAt = -1e9;
    this.tint = { color: '#000000', alpha: 0 };
    this.ripples = [];

    this.groundRgb = hexToRgb(this.styles.watercolor.ground);
    this.ghost = document.createElement('canvas');
    this.accum = document.createElement('canvas');
    this.melodyTrail = [];
    this.ghostDirty = true;
    this.revealStart = performance.now();
    this.developing = false;
    this.developMix = 0;
    this.exposures = [];
    this.exposureClock = 0;

    this.analyserSource = null;
    this.lastTime = performance.now();
    this.isRunning = false;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();
  }

  // ---------- configuration ----------

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;

    const compact = this.width < 640;
    const scoreH = compact ? LANES.length * 17 + 34 : Math.min(256, Math.max(196, this.height * 0.3));
    this.plane = { x: 0, y: 0, w: this.width, h: this.height - scoreH };
    this.score = { x: 0, y: this.plane.h, w: this.width, h: scoreH, compact };
    this.unit = Math.min(this.plane.w, this.plane.h * 1.7) / 48;
    // One time axis for painting and score: beat 0 sits at the same x in both
    const labelW = compact ? 72 : 124;
    this.grid = { x: labelW, w: this.width - labelW - (compact ? 10 : 18) };
    this.ghostDirty = true;
    this.resetAccumulation();
  }

  setAnalyserSource(fn) {
    this.analyserSource = fn;
  }

  setSong(song) {
    if (!song) return;
    this.song = song;
    this.bars = Math.max(1, song.drums?.bars || 2);
    this.totalSteps = this.bars * 16;
    this.bpm = song.analysis?.tempo || this.bpm;
    this.ranges = { melody: pitchRange(song.melody), bass: pitchRange(song.bass), chords: pitchRange(partNotes(song, 'chords')) };
    this.activity = laneActivity(song);
    this.ghostDirty = true;
    this.revealStart = performance.now();
    this.resetAccumulation();
  }

  setTempo(bpm) {
    this.bpm = bpm;
  }

  setVisualConfig(visual) {
    if (!visual) return;
    if (this.styles[visual.texture] && visual.texture !== this.styleName) {
      this.styles[this.styleName].clear();
      this.styleName = visual.texture;
      this.resetAccumulation();
    }
    if (visual.motion) this.motion = visual.motion;
    if (Array.isArray(visual.palette) && visual.palette.length) this.palette = visual.palette;
    if (visual.instrument_colors) this.instrumentColors = { ...this.instrumentColors, ...visual.instrument_colors };
    if (visual.instrument_shapes) this.instrumentShapes = { ...this.instrumentShapes, ...visual.instrument_shapes };
    if ('calm_mode_recommended' in visual) safetyManager.evaluateSongRecommendation(visual.calm_mode_recommended);
    this.ghostDirty = true;
  }

  setDeveloping(on) {
    this.developing = on;
    if (on) this.exposures = [];
  }

  setPlayheadStep(step, totalSteps) {
    if (totalSteps) this.totalSteps = totalSteps;
    if (step < 0) {
      this.isPlaying = false;
      this.currentStep = -1;
      return;
    }
    this.isPlaying = true;
    this.currentStep = step;
    this.lastStepAt = performance.now();
    if (step % 4 === 0) this.lastBeatAt = this.lastStepAt;
  }

  // ---------- geometry ----------

  laneBox(id) {
    const lane = LANE_BY_ID[id] || LANE_BY_ID.snare;
    return { top: this.plane.h * lane.top, bottom: this.plane.h * lane.bottom, lane };
  }

  xForBeat(beat) {
    return this.grid.x + (beat / (this.bars * 4)) * this.grid.w;
  }

  resetAccumulation() {
    if (!this.plane) return;
    this.accum.width = Math.max(1, Math.round(this.plane.w * this.dpr));
    this.accum.height = Math.max(1, Math.round(this.plane.h * this.dpr));
    this.accumCtx = this.accum.getContext('2d');
    this.accumCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.melodyTrail = [];
  }

  geometryFor(instrument, { beat, pitch, dur, velocity = 0.8, step }) {
    const { top, bottom, lane } = this.laneBox(instrument);
    const shape = this.instrumentShapes[instrument] || 'circle';
    const calm = safetyManager.calmMode;
    // Weight like Kandinsky's points: accents are heavier, long notes larger
    let weight = 1;
    if (step != null) weight = step % 16 === 0 ? 1.4 : step % 4 === 0 ? 1.15 : 0.85;
    else if (dur) weight = 0.8 + 0.3 * Math.sqrt(Math.min(4, dur));
    const r = (SIZE[instrument] || 1.2) * this.unit * (0.55 + 0.6 * velocity) * weight * (calm ? 0.85 : 1);

    let y = (top + bottom) / 2;
    if (lane.pitched && pitch) {
      const f = pitchFraction(pitch, this.ranges[instrument]);
      y = bottom - f * (bottom - top);
    }

    let stretch = 2.4;
    if (shape === 'line' && dur) {
      const lenPx = (dur / (this.bars * 4)) * this.plane.w * 0.88;
      stretch = Math.max(1.2, lenPx / 2 / r);
    }
    // Pitched line marks start at the note onset; drums stay centered on their step
    let x = this.xForBeat(beat);
    if (shape === 'line' && lane.pitched) x += r * (stretch - 0.34);

    return { x, y, r, stretch, shape, band: lane.band };
  }

  // ---------- events ----------

  handleNoteEvent(event) {
    const inst = event.instrument;
    // Drum hits sit in the middle of their step cell, exactly over the score's glyph
    const beat = event.step != null ? (event.step + 0.5) / 4 : event.start ?? 0;
    const g = this.geometryFor(inst, { beat, pitch: event.pitch, dur: event.dur, velocity: event.velocity, step: event.step });
    const color = this.instrumentColors[inst] || '#888888';
    const isCalm = safetyManager.calmMode;

    this.stamp(inst, g, color, beat);

    this.currentStyle.spawn(event, {
      ...g,
      color,
      motion: this.motion,
      isCalm,
      unit: this.unit,
    });

    if (this.motion === 'ripple') {
      this.ripples.push({
        x: g.x, y: g.y, r: g.r, color,
        maxR: g.r * (isCalm ? 2.2 : 3.4),
        age: 0, life: isCalm ? 1.4 : 0.9,
      });
      if (this.ripples.length > 24) this.ripples.shift();
    }

    // Pulse motion lets the kick breathe the whole plane; that is a large-area
    // luminance change, so it goes through the flash limiter.
    if (this.motion === 'pulse' && inst === 'kick' && !isCalm) {
      const gate = safetyManager.allowFlash(event.velocity ?? 0.8);
      this.tint = { color, alpha: 0.1 * gate };
    }
  }

  // Played marks leave a faint print, so the loop builds into a composition
  stamp(inst, g, color, beat) {
    const c = this.accumCtx;
    if (!c) return;
    const pts = shapePoints(g.shape, { stretch: g.stretch });
    tracePoints(c, pts, g.x, g.y, g.r * 0.8);
    c.globalAlpha = 0.16;
    c.fillStyle = color;
    c.fill();
    c.globalAlpha = 1;

    if (inst === 'melody') {
      const onsetX = this.xForBeat(beat);
      const last = this.melodyTrail[this.melodyTrail.length - 1];
      if (last && onsetX < last.x) this.melodyTrail.push(null); // loop wrapped
      const prev = this.melodyTrail[this.melodyTrail.length - 1];
      const point = { x: onsetX, y: g.y, age: 0 };
      if (prev) {
        c.strokeStyle = color;
        c.globalAlpha = 0.3;
        c.lineWidth = Math.max(1.5, this.unit * 0.18);
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(prev.x, prev.y);
        c.lineTo(point.x, point.y);
        c.stroke();
        c.globalAlpha = 1;
      }
      this.melodyTrail.push(point);
      if (this.melodyTrail.length > 48) this.melodyTrail.splice(0, this.melodyTrail.length - 48);
    }
  }

  drawAccumulation(ctx, dt) {
    const c = this.accumCtx;
    if (!c) return;
    // Prints fade over a few loops
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dt * 0.12)})`;
    c.fillRect(0, 0, this.accum.width, this.accum.height);
    c.restore();
    ctx.drawImage(this.accum, 0, 0, this.plane.w, this.plane.h);
  }

  // The melody's pitch contour: one connected line through the notes as they sound
  drawMelodyLine(ctx, dt) {
    ctx.save();
    ctx.strokeStyle = this.instrumentColors.melody;
    ctx.lineWidth = Math.max(2, this.unit * 0.32);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < this.melodyTrail.length; i++) {
      const a = this.melodyTrail[i - 1];
      const b = this.melodyTrail[i];
      if (!a || !b) continue;
      const alpha = Math.max(0, 1 - b.age / 5);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha * 0.85;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const p of this.melodyTrail) if (p) p.age += dt;
    ctx.restore();
  }

  get currentStyle() {
    return this.styles[this.styleName] || this.styles.watercolor;
  }

  // ---------- loop ----------

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    const tick = () => {
      if (!this.isRunning) return;
      this.frame();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop() {
    this.isRunning = false;
  }

  getEnergyBands() {
    const data = this.analyserSource?.();
    if (!data || !data.length) return { low: 0, mid: 0, high: 0 };
    // Analyser returns decibels (about -100..0, -Infinity when silent)
    const norm = (db) => (Number.isFinite(db) ? Math.min(1, Math.max(0, (db + 90) / 70)) : 0);
    const len = data.length;
    const lowEnd = Math.max(1, Math.floor(len * 0.12));
    const midEnd = Math.floor(len * 0.5);
    const avg = (a, b) => {
      let s = 0;
      for (let i = a; i < b; i++) s += norm(data[i]);
      return s / Math.max(1, b - a);
    };
    return { low: avg(0, lowEnd), mid: avg(lowEnd, midEnd), high: avg(midEnd, len) };
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (!this.width) return;

    const ctx = this.ctx;
    const isCalm = safetyManager.calmMode;
    const beatPulse = Math.exp(-(now - this.lastBeatAt) / 140);
    const style = this.currentStyle;

    // Ground eases between textures so a light-to-dark change is a fade, not a flash
    const target = hexToRgb(style.ground);
    const k = 1 - Math.exp(-dt * 3);
    this.groundRgb = this.groundRgb.map((c, i) => c + (target[i] - c) * k);
    const [gr, gg, gb] = this.groundRgb;
    const groundIsDark = (0.2126 * gr + 0.7152 * gg + 0.0722 * gb) / 255 < 0.45;

    this.developMix += ((this.developing ? 1 : 0) - this.developMix) * (1 - Math.exp(-dt * 2.5));

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.plane.w, this.plane.h);
    ctx.clip();

    ctx.fillStyle = `rgb(${gr | 0}, ${gg | 0}, ${gb | 0})`;
    ctx.fillRect(0, 0, this.plane.w, this.plane.h);

    if (this.tint.alpha > 0.002) {
      ctx.fillStyle = hexToRgba(this.tint.color, this.tint.alpha);
      ctx.fillRect(0, 0, this.plane.w, this.plane.h);
      this.tint.alpha *= Math.exp(-dt * 7);
    }

    this.drawGhost(ctx, now, groundIsDark);
    this.drawAccumulation(ctx, dt);
    this.drawMelodyLine(ctx, dt);

    const state = {
      width: this.plane.w,
      height: this.plane.h,
      energy: this.getEnergyBands(),
      isCalm,
      beatPulse,
      currentMotion: this.motion,
      palette: this.palette,
    };
    ctx.globalAlpha = 1;
    style.draw(ctx, state, dt);
    this.drawRipples(ctx, dt);
    this.drawDeveloping(ctx, dt, groundIsDark);
    this.drawPlaneAnnotations(ctx, groundIsDark);
    this.drawPlaneFrame(ctx, now, groundIsDark);
    ctx.restore();

    this.drawScore(ctx, now);
  }

  playPosition(now) {
    if (!this.isPlaying || this.currentStep < 0) return -1;
    const stepDur = 60000 / this.bpm / 4;
    return this.currentStep + Math.min(1, (now - this.lastStepAt) / stepDur);
  }

  // The whole loop as a faint still composition, so the plane is never blank
  // and upcoming hits are visible before they sound.
  renderGhost() {
    const g = this.ghost;
    g.width = Math.max(1, Math.round(this.plane.w * this.dpr));
    g.height = Math.max(1, Math.round(this.plane.h * this.dpr));
    const c = g.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.plane.w, this.plane.h);
    if (!this.song) return;
    const dark = this.currentStyle.dark;

    // Upcoming hits are drawn hollow; sounding and played marks are filled
    const paint = (inst, opts) => {
      const geo = this.geometryFor(inst, opts);
      const pts = shapePoints(geo.shape, { stretch: geo.stretch });
      tracePoints(c, pts, geo.x, geo.y, geo.r * 0.62);
      c.globalAlpha = 0.85;
      c.strokeStyle = this.instrumentColors[inst];
      c.lineWidth = 2;
      c.stroke();
      c.globalAlpha = dark ? 0.4 : 0.35;
      c.strokeStyle = dark ? '#ffffff' : INK;
      c.lineWidth = 0.75;
      c.stroke();
    };

    for (const inst of DRUM_LANES) {
      (this.song.drums?.[inst] || []).forEach((v, step) => {
        if (v === 1) paint(inst, { beat: (step + 0.5) / 4, velocity: 0.8, step });
      });
    }
    for (const inst of ['melody', 'chords', 'bass']) {
      for (const n of partNotes(this.song, inst)) paint(inst, { beat: n.start, pitch: n.pitch, dur: n.dur, velocity: n.vel });
    }

    const melody = [...(this.song.melody || [])].sort((a, b) => a.start - b.start);
    if (melody.length > 1) {
      c.save();
      c.setLineDash([2, 5]);
      c.strokeStyle = this.instrumentColors.melody;
      c.globalAlpha = 0.7;
      c.lineWidth = 1.25;
      c.beginPath();
      melody.forEach((n, i) => {
        const g = this.geometryFor('melody', { beat: n.start, pitch: n.pitch, dur: n.dur });
        const x = this.xForBeat(n.start);
        if (i === 0) c.moveTo(x, g.y);
        else c.lineTo(x, g.y);
      });
      c.stroke();
      c.restore();
    }
    c.globalAlpha = 1;
    this.ghostDirty = false;
  }

  drawGhost(ctx, now, groundIsDark) {
    if (this.ghostDirty) this.renderGhost();
    const reveal = easeOut((now - this.revealStart) / 1100);
    const alpha = (1 - this.developMix) * (this.isPlaying ? 0.75 : 1);
    if (alpha < 0.01 || reveal <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.rect(0, 0, this.plane.w * reveal, this.plane.h);
    ctx.clip();
    ctx.drawImage(this.ghost, 0, 0, this.plane.w, this.plane.h);
    ctx.restore();

    // Developing edge: a hairline sweeping ahead of the reveal
    if (reveal < 1) {
      ctx.fillStyle = groundIsDark ? 'rgba(255,255,255,0.5)' : 'rgba(20,20,20,0.5)';
      ctx.fillRect(this.plane.w * reveal, 0, 1, this.plane.h);
    }
  }

  drawRipples(ctx, dt) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        this.ripples.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = hexToRgba(r.color, 0.7 * (1 - t));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.maxR - r.r) * easeOut(t), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // While Gemini composes, faint primitives surface and sink back into the plane
  drawDeveloping(ctx, dt, groundIsDark) {
    if (this.developMix < 0.01) return;
    if (this.developing) {
      this.exposureClock += dt;
      if (this.exposureClock > 0.28) {
        this.exposureClock = 0;
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        const shapes = ['circle', 'square', 'triangle'];
        this.exposures.push({
          x: this.plane.w * (0.06 + Math.random() * 0.88),
          y: this.plane.h * (lane.top + Math.random() * (lane.bottom - lane.top)),
          r: this.unit * (0.8 + Math.random() * 1.6),
          shape: shapes[Math.floor(Math.random() * 3)],
          age: 0,
          life: 2.4,
        });
      }
    }
    const ink = groundIsDark ? '#ffffff' : INK;
    for (let i = this.exposures.length - 1; i >= 0; i--) {
      const e = this.exposures[i];
      e.age += dt;
      if (e.age > e.life) {
        this.exposures.splice(i, 1);
        continue;
      }
      const a = Math.sin((e.age / e.life) * Math.PI) * 0.2 * this.developMix;
      drawGlyph(ctx, e.shape, e.x, e.y, e.r, { fill: ink, fillAlpha: a * 0.35, ink, inkAlpha: a, lineWidth: 1 });
    }
  }

  drawPlaneAnnotations(ctx, groundIsDark) {
    if (!this.song) return;
    const a = this.song.analysis || {};
    const ink = groundIsDark ? 'rgba(255,255,255,0.8)' : 'rgba(20,20,20,0.78)';
    const compact = this.plane.w < 560;
    ctx.font = `500 12px ${MONO}`;
    ctx.fillStyle = ink;
    ctx.textBaseline = 'top';

    const left = [`${this.bpm} BPM`, a.key, `${this.bars} ${this.bars === 1 ? 'BAR' : 'BARS'}`].filter(Boolean).join('  ·  ').toUpperCase();
    ctx.textAlign = 'left';
    ctx.fillText(left, 16, 14);
    ctx.textAlign = 'right';
    if (!compact) ctx.fillText(`${this.styleName} / ${this.motion}`.toUpperCase(), this.plane.w - 16, 14);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  drawPlaneFrame(ctx, now, groundIsDark) {
    const pos = this.playPosition(now);
    if (pos < 0) return;
    const x = this.xForBeat(pos / 4);
    ctx.fillStyle = groundIsDark ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,20,0.4)';
    ctx.fillRect(Math.round(x), 34, 1.5, this.plane.h - 34);
  }

  // ---------- score ----------

  drawScore(ctx, now) {
    const s = this.score;
    const compact = s.compact;
    ctx.fillStyle = SHEET;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = INK;
    ctx.fillRect(s.x, s.y, s.w, 2);

    const gridX = this.grid.x;
    const gridW = this.grid.w;
    const stepRowY = s.y + 10;
    const stepRowH = 14;
    const rowsTop = stepRowY + stepRowH + 8;
    const rowH = (s.y + s.h - 8 - rowsTop) / LANES.length;
    const steps = this.totalSteps;
    const cellW = gridW / steps;
    const pos = this.playPosition(now);
    const playing = pos >= 0;
    const current = playing ? Math.floor(pos) : -1;
    const playBeat = playing ? pos / 4 : -1;

    // Step row: 16 cells per bar that light up as the playhead passes
    ctx.font = `500 ${compact ? 10 : 12}px ${MONO}`;
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    const barLabel = playing ? `BAR ${Math.floor(current / 16) + 1}/${this.bars}` : `${this.bars} ${this.bars === 1 ? 'BAR' : 'BARS'}`;
    ctx.fillText(barLabel, compact ? 8 : 16, stepRowY + stepRowH / 2);
    for (let i = 0; i < steps; i++) {
      const x = gridX + i * cellW;
      if (i === current) {
        ctx.fillStyle = INK;
        ctx.fillRect(x + 1, stepRowY, cellW - 2, stepRowH);
      } else {
        ctx.fillStyle = i % 4 === 0 ? 'rgba(20,20,20,0.28)' : 'rgba(20,20,20,0.1)';
        const inset = i % 4 === 0 ? 3 : 5;
        ctx.fillRect(x + 1, stepRowY + inset, cellW - 2, stepRowH - inset * 2);
      }
    }

    // Grid lines
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(gridX + i * cellW) + 0.5;
      if (i % 16 === 0) ctx.fillStyle = 'rgba(20,20,20,0.75)';
      else if (i % 4 === 0) ctx.fillStyle = 'rgba(20,20,20,0.2)';
      else continue;
      ctx.fillRect(x, rowsTop, 1, rowH * LANES.length);
    }

    LANES.forEach((lane, idx) => {
      const y0 = rowsTop + idx * rowH;
      const cy = y0 + rowH / 2;
      const color = this.instrumentColors[lane.id];
      const shape = this.instrumentShapes[lane.id];
      const silent = !this.activity[lane.id];

      ctx.fillStyle = 'rgba(20,20,20,0.1)';
      ctx.fillRect(gridX, y0, gridW, 1);

      // Label: shape + name. Dimmed and dashed when the part rests.
      const gr = Math.min(compact ? 5 : 7, rowH * 0.34);
      drawGlyph(ctx, shape, (compact ? 8 : 16) + gr, cy, gr, {
        fill: color, fillAlpha: silent ? 0 : 1, inkAlpha: silent ? 0.45 : 1, lineWidth: 1.1,
      });
      ctx.font = `${silent ? 400 : 500} ${compact ? 12 : 13}px ${SANS}`;
      ctx.fillStyle = silent ? '#5f6468' : INK;
      ctx.fillText(compact ? lane.label.replace('Hi-hat', 'Hat') : lane.label, (compact ? 8 : 16) + gr * 2 + 7, cy + 1);

      if (silent) {
        ctx.save();
        ctx.strokeStyle = 'rgba(20,20,20,0.35)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(gridX, Math.round(cy) + 0.5);
        ctx.lineTo(gridX + gridW, Math.round(cy) + 0.5);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (!lane.pitched) {
        const hits = this.song?.drums?.[lane.id] || [];
        const r = Math.min(cellW * 0.4, rowH * 0.36);
        hits.forEach((v, step) => {
          if (v !== 1) return;
          const x = gridX + (step + 0.5) * cellW;
          const sounding = step === current;
          const played = playing && step < current;
          if (sounding || played) {
            drawGlyph(ctx, shape, x, cy, sounding ? r * 1.3 : r, {
              fill: color, fillAlpha: 1, inkAlpha: 1, lineWidth: sounding ? 1.75 : 1,
            });
          } else {
            // Waiting: hollow, color outline around an ink hairline
            drawGlyph(ctx, shape, x, cy, r, { ink: color, inkAlpha: 1, lineWidth: 2 });
            drawGlyph(ctx, shape, x, cy, r, { inkAlpha: 0.55, lineWidth: 0.75 });
          }
        });
      } else {
        const notes = partNotes(this.song, lane.id);
        const range = this.ranges[lane.id];
        const barH = Math.max(3, rowH * 0.26);
        for (const n of notes) {
          const x0 = gridX + n.start * 4 * cellW;
          const w = Math.max(3, n.dur * 4 * cellW - 2);
          const f = pitchFraction(n.pitch, range);
          const y = y0 + 3 + (1 - f) * (rowH - 6 - barH);
          const sounding = playing && playBeat >= n.start && playBeat < n.start + n.dur;
          const played = playing && playBeat >= n.start + n.dur;
          if (sounding || played) {
            ctx.fillStyle = color;
            ctx.fillRect(x0 + 1, y, w, barH);
            ctx.strokeStyle = INK;
            ctx.lineWidth = sounding ? 1.75 : 1;
            ctx.strokeRect(x0 + 1.5, y + 0.5, w - 1, barH - 1);
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x0 + 2, y + 1, w - 2, barH - 2);
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 0.75;
            ctx.strokeRect(x0 + 2, y + 1, w - 2, barH - 2);
            ctx.globalAlpha = 1;
          }
        }
      }
    });

    // Playhead
    if (playing) {
      const x = gridX + pos * cellW;
      ctx.fillStyle = INK;
      ctx.fillRect(Math.round(x), s.y, 1.5, s.h);
    }
    ctx.textBaseline = 'alphabetic';
  }

  destroy() {
    this.stop();
    this.resizeObserver.disconnect();
  }
}
