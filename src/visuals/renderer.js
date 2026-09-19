import { safetyManager } from './safety.js';
import { WatercolorStyle } from './styles/watercolor.js';
import { InkStyle } from './styles/ink.js';
import { NeonStyle } from './styles/neon.js';
import { GrainStyle } from './styles/grain.js';
import { GlassStyle } from './styles/glass.js';
import { hexToRgba } from './palettes.js';

export class VisualRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.styles = {
      watercolor: new WatercolorStyle(),
      ink: new InkStyle(),
      neon: new NeonStyle(),
      grain: new GrainStyle(),
      glass: new GlassStyle(),
    };

    this.currentStyleName = 'watercolor';
    this.currentMotion = 'drift';
    this.palette = ['#1b2a49', '#e07a5f', '#f2cc8f', '#81b29a', '#3d5a80'];
    this.instrumentColors = {
      kick: '#e07a5f',
      snare: '#f2cc8f',
      hat: '#81b29a',
      melody: '#3d5a80',
      bass: '#6d597a',
      clap: '#b56576',
      perc: '#eaac8b',
    };
    this.instrumentShapes = {
      kick: 'circle',
      snare: 'square',
      hat: 'triangle',
      melody: 'line',
      bass: 'blob',
      clap: 'star',
      perc: 'diamond',
    };

    this.ripples = [];
    this.currentStep = -1;
    this.totalSteps = 32;
    this.bars = 2;
    this.lastTime = performance.now();
    this.isRunning = false;
    this.analyserSource = null;

    this.handleResize = this.resize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  setAnalyserSource(getAnalyserFn) {
    this.analyserSource = getAnalyserFn;
  }

  setVisualConfig(visualConfig) {
    if (!visualConfig) return;

    if (this.styles[visualConfig.texture]) {
      this.currentStyleName = visualConfig.texture;
    }
    this.currentMotion = visualConfig.motion || 'drift';

    if (Array.isArray(visualConfig.palette) && visualConfig.palette.length > 0) {
      this.palette = visualConfig.palette;
    }

    if (visualConfig.instrument_colors) {
      this.instrumentColors = { ...this.instrumentColors, ...visualConfig.instrument_colors };
    }

    if (visualConfig.instrument_shapes) {
      this.instrumentShapes = { ...this.instrumentShapes, ...visualConfig.instrument_shapes };
    }

    safetyManager.evaluateSongRecommendation(visualConfig.calm_mode_recommended);
  }

  setPlayheadStep(step, totalSteps) {
    this.currentStep = step;
    this.totalSteps = totalSteps || 32;
    this.bars = Math.max(1, Math.round(this.totalSteps / 16));
  }

  handleNoteEvent(event) {
    const style = this.styles[this.currentStyleName] || this.styles.watercolor;
    const isCalm = safetyManager.calmMode;

    style.spawn(event, {
      width: this.width,
      height: this.height,
      instrumentColors: this.instrumentColors,
      instrumentShapes: this.instrumentShapes,
      motion: this.currentMotion,
      isCalm,
    });

    // If ripple motion, spawn an expanding ring
    if (this.currentMotion === 'ripple') {
      let yBase = this.height * 0.5;
      if (event.instrument === 'bass') yBase = this.height * 0.8;
      else if (event.instrument === 'melody') yBase = this.height * 0.25;
      else if (event.instrument === 'kick') yBase = this.height * 0.65;
      else if (event.instrument === 'snare') yBase = this.height * 0.45;

      this.ripples.push({
        x: this.width * (0.2 + 0.6 * Math.random()),
        y: yBase,
        radius: 10,
        maxRadius: (isCalm ? 80 : 150) * (event.velocity || 0.8),
        color: this.instrumentColors[event.instrument] || '#ffffff',
        alpha: 0.8,
        speed: (isCalm ? 80 : 160),
      });
      if (this.ripples.length > 20) this.ripples.shift();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  getEnergyBands() {
    if (!this.analyserSource) return { low: 0, mid: 0, high: 0 };
    const data = this.analyserSource();
    if (!data || data.length === 0) return { low: 0, mid: 0, high: 0 };

    // Group 64 bands into low, mid, high
    const len = data.length;
    const lowCount = Math.floor(len * 0.15);
    const midCount = Math.floor(len * 0.45);

    let lowSum = 0, midSum = 0, highSum = 0;
    for (let i = 0; i < lowCount; i++) lowSum += Math.abs(data[i]);
    for (let i = lowCount; i < lowCount + midCount; i++) midSum += Math.abs(data[i]);
    for (let i = lowCount + midCount; i < len; i++) highSum += Math.abs(data[i]);

    // Normalize from dB / magnitude to approx 0-1
    return {
      low: Math.min(1.0, (lowSum / lowCount) / 100 + 1),
      mid: Math.min(1.0, (midSum / midCount) / 100 + 1),
      high: Math.min(1.0, (highSum / (len - lowCount - midCount)) / 100 + 1),
    };
  }

  loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    const energy = this.getEnergyBands();
    const isCalm = safetyManager.calmMode;

    const state = {
      width: this.width,
      height: this.height,
      energy,
      isCalm,
      currentMotion: this.currentMotion,
      palette: this.palette,
    };

    // 1. Draw Active Style Renderer
    const activeRenderer = this.styles[this.currentStyleName] || this.styles.watercolor;
    activeRenderer.draw(this.ctx, state, dt);

    // 2. Draw expanding ripples if present
    if (this.ripples.length > 0) {
      this.ctx.save();
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.radius += r.speed * dt;
        r.alpha -= (dt * (isCalm ? 0.8 : 1.2));

        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          this.ripples.splice(i, 1);
          continue;
        }

        this.ctx.strokeStyle = hexToRgba(r.color, r.alpha);
        this.ctx.lineWidth = isCalm ? 1.5 : 2.5;
        this.ctx.beginPath();
        this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // 3. Draw Beat Grid Strip along bottom edge
    this.drawBeatGrid(this.ctx, this.width, this.height, this.currentStep, this.totalSteps);

    requestAnimationFrame(this.loop.bind(this));
  }

  drawBeatGrid(ctx, width, height, currentStep, totalSteps) {
    const stripHeight = 22;
    const y = height - stripHeight - 6;
    const padding = 16;
    const availableWidth = width - padding * 2;
    const cellWidth = availableWidth / totalSteps;
    const isCalm = safetyManager.calmMode;

    ctx.save();
    // Subdued background bar
    ctx.fillStyle = 'rgba(10, 12, 20, 0.75)';
    ctx.fillRect(padding - 4, y - 4, availableWidth + 8, stripHeight + 8);

    for (let step = 0; step < totalSteps; step++) {
      const x = padding + step * cellWidth;
      const isDownbeat = step % 4 === 0;
      const isBarStart = step % 16 === 0;
      const isActive = step === currentStep;

      if (isActive) {
        // Active playhead cell
        ctx.fillStyle = isCalm ? '#38bdf8' : '#38bdf8';
        ctx.shadowBlur = isCalm ? 0 : 8;
        ctx.shadowColor = '#38bdf8';
        ctx.fillRect(x + 1, y, cellWidth - 2, stripHeight);
      } else {
        ctx.shadowBlur = 0;
        if (isBarStart) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        } else if (isDownbeat) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        }
        ctx.fillRect(x + 1, y + (isDownbeat ? 2 : 5), cellWidth - 2, stripHeight - (isDownbeat ? 4 : 10));
      }
    }

    ctx.restore();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
  }
}
