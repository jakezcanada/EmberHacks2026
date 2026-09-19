import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load fallback presets
const presetsPath = path.resolve(__dirname, '../src/fallback/presets.json');
let fallbackPresets = [];
try {
  fallbackPresets = JSON.parse(fs.readFileSync(presetsPath, 'utf-8'));
} catch (err) {
  console.error('Error loading fallback presets:', err);
}

export const VALID_TEXTURES = ['watercolor', 'ink', 'neon', 'grain', 'glass'];
export const VALID_MOTIONS = ['drift', 'pulse', 'swell', 'scatter', 'ripple'];
export const VALID_PROVIDERS = ['drums', 'melody', 'both', 'none', 'prompt'];
export const VALID_SHAPES = ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'];

export const DEFAULT_INSTRUMENT_COLORS = {
  kick: '#e07a5f',
  snare: '#f2cc8f',
  hat: '#81b29a',
  melody: '#3d5a80',
  bass: '#6d597a',
  clap: '#b56576',
  perc: '#eaac8b',
};

export const DEFAULT_INSTRUMENT_SHAPES = {
  kick: 'circle',
  snare: 'square',
  hat: 'triangle',
  melody: 'line',
  bass: 'blob',
  clap: 'star',
  perc: 'diamond',
};

export const DEFAULT_PALETTE = ['#1b2a49', '#e07a5f', '#f2cc8f', '#81b29a', '#3d5a80'];

const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const pitchRegex = /^[A-G][#b]?[1-6]$/;

// Zod Schema
export const NoteSchema = z.object({
  pitch: z.string(),
  start: z.number(),
  dur: z.number(),
  vel: z.number().default(0.8),
});

export const ChromajamSchema = z.object({
  analysis: z.object({
    tempo: z.number(),
    key: z.string().default('C major'),
    time_signature: z.string().default('4/4'),
    mood: z.array(z.string()).default(['upbeat']),
    genre_hint: z.string().default('ambient'),
    energy_curve: z.array(z.number()).default([0.3, 0.5, 0.7, 0.5]),
    provided: z.enum(['drums', 'melody', 'both', 'none', 'prompt']),
    generated: z.enum(['drums', 'melody', 'both', 'none', 'prompt']),
  }),
  groove: z.object({
    swing: z.number().default(0),
    humanize: z.number().default(0.2),
  }),
  drums: z.object({
    bars: z.number(),
    kick: z.array(z.number()).default([]),
    snare: z.array(z.number()).default([]),
    hat: z.array(z.number()).default([]),
    clap: z.array(z.number()).default([]),
    perc: z.array(z.number()).default([]),
  }),
  melody: z.array(NoteSchema).default([]),
  bass: z.array(NoteSchema).default([]),
  visual: z.object({
    palette: z.array(z.string()),
    texture: z.string(),
    motion: z.string(),
    instrument_colors: z.record(z.string()).default(DEFAULT_INSTRUMENT_COLORS),
    instrument_shapes: z.record(z.string()).default(DEFAULT_INSTRUMENT_SHAPES),
    calm_mode_recommended: z.boolean().default(false),
  }),
  director_note: z.string().default(''),
});

export function getFallbackPreset(hint = 'prompt') {
  let matched = null;
  if (hint === 'melody') {
    matched = fallbackPresets.find(p => p.analysis.provided === 'melody');
  } else if (hint === 'drums') {
    matched = fallbackPresets.find(p => p.analysis.provided === 'drums');
  } else {
    matched = fallbackPresets.find(p => p.analysis.provided === 'prompt') || fallbackPresets[0];
  }
  const result = JSON.parse(JSON.stringify(matched || fallbackPresets[0]));
  result.fallback = true;
  return result;
}

export function repairAndValidate(data, hint = 'prompt') {
  if (!data || typeof data !== 'object') {
    return getFallbackPreset(hint);
  }

  try {
    const repaired = { ...data };

    // 1. Analysis repair
    repaired.analysis = repaired.analysis || {};
    let tempo = Math.round(Number(repaired.analysis.tempo) || 100);
    repaired.analysis.tempo = Math.max(60, Math.min(180, tempo));
    repaired.analysis.key = String(repaired.analysis.key || 'C major');
    repaired.analysis.time_signature = '4/4';
    repaired.analysis.mood = Array.isArray(repaired.analysis.mood) && repaired.analysis.mood.length > 0
      ? repaired.analysis.mood.map(String)
      : ['creative'];
    repaired.analysis.genre_hint = String(repaired.analysis.genre_hint || 'chillhop');
    repaired.analysis.energy_curve = Array.isArray(repaired.analysis.energy_curve) && repaired.analysis.energy_curve.length > 0
      ? repaired.analysis.energy_curve.map(n => Math.max(0, Math.min(1, Number(n) || 0.5)))
      : [0.3, 0.5, 0.7, 0.5];

    let provided = String(repaired.analysis.provided || hint).toLowerCase();
    if (!VALID_PROVIDERS.includes(provided)) provided = hint || 'prompt';
    let generated = String(repaired.analysis.generated || (provided === 'melody' ? 'drums' : (provided === 'drums' ? 'melody' : 'both'))).toLowerCase();
    if (!VALID_PROVIDERS.includes(generated)) {
      generated = provided === 'melody' ? 'drums' : (provided === 'drums' ? 'melody' : 'both');
    }
    if (provided === generated && provided !== 'none') {
      generated = provided === 'melody' ? 'drums' : 'melody';
    }
    repaired.analysis.provided = provided;
    repaired.analysis.generated = generated;

    // 2. Groove repair
    repaired.groove = repaired.groove || {};
    repaired.groove.swing = Math.max(0, Math.min(1, Number(repaired.groove.swing) || 0));
    repaired.groove.humanize = Math.max(0, Math.min(1, Number(repaired.groove.humanize) || 0.2));

    // 3. Drums repair
    repaired.drums = repaired.drums || {};
    let bars = Math.round(Number(repaired.drums.bars) || 2);
    bars = Math.max(1, Math.min(4, bars));
    repaired.drums.bars = bars;
    const targetLength = 16 * bars;

    const drumLanes = ['kick', 'snare', 'hat', 'clap', 'perc'];
    for (const lane of drumLanes) {
      let rawLane = Array.isArray(repaired.drums[lane]) ? repaired.drums[lane] : [];
      let laneValues = rawLane.map(val => (val === 1 || val === true ? 1 : 0));
      if (laneValues.length < targetLength) {
        laneValues = [...laneValues, ...new Array(targetLength - laneValues.length).fill(0)];
      } else if (laneValues.length > targetLength) {
        laneValues = laneValues.slice(0, targetLength);
      }
      repaired.drums[lane] = laneValues;
    }

    // 4. Notes (Melody & Bass) repair
    const maxBeats = bars * 4;

    function sanitizeNotes(notesArray) {
      if (!Array.isArray(notesArray)) return [];
      const validNotes = [];
      for (const note of notesArray) {
        if (!note || typeof note !== 'object') continue;
        let pitch = String(note.pitch || '').trim().toUpperCase();
        if (!pitchRegex.test(pitch)) continue;

        let start = Number(note.start);
        if (isNaN(start) || start < 0 || start >= maxBeats) continue;

        let dur = Number(note.dur);
        if (isNaN(dur) || dur <= 0) dur = 0.5;
        dur = Math.min(dur, maxBeats - start);
        if (dur <= 0) continue;

        let vel = Number(note.vel);
        if (isNaN(vel)) vel = 0.8;
        vel = Math.max(0.1, Math.min(1.0, vel));

        validNotes.push({ pitch, start, dur, vel });
      }
      return validNotes;
    }

    repaired.melody = sanitizeNotes(repaired.melody);
    repaired.bass = sanitizeNotes(repaired.bass);

    // 5. Visual repair
    repaired.visual = repaired.visual || {};
    let texture = String(repaired.visual.texture || '').toLowerCase();
    if (!VALID_TEXTURES.includes(texture)) texture = 'watercolor';
    repaired.visual.texture = texture;

    let motion = String(repaired.visual.motion || '').toLowerCase();
    if (!VALID_MOTIONS.includes(motion)) motion = 'drift';
    repaired.visual.motion = motion;

    let palette = Array.isArray(repaired.visual.palette) ? repaired.visual.palette : [];
    palette = palette.filter(c => typeof c === 'string' && hexColorRegex.test(c.trim()));
    if (palette.length < 3 || palette.length > 6) {
      palette = DEFAULT_PALETTE.slice(0, Math.max(3, Math.min(6, palette.length || 4)));
    }
    repaired.visual.palette = palette;

    const colors = { ...DEFAULT_INSTRUMENT_COLORS, ...(repaired.visual.instrument_colors || {}) };
    for (const key of Object.keys(DEFAULT_INSTRUMENT_COLORS)) {
      if (!colors[key] || !hexColorRegex.test(colors[key])) {
        colors[key] = DEFAULT_INSTRUMENT_COLORS[key];
      }
    }
    repaired.visual.instrument_colors = colors;

    const shapes = { ...DEFAULT_INSTRUMENT_SHAPES, ...(repaired.visual.instrument_shapes || {}) };
    for (const key of Object.keys(DEFAULT_INSTRUMENT_SHAPES)) {
      if (!shapes[key] || !VALID_SHAPES.includes(shapes[key])) {
        shapes[key] = DEFAULT_INSTRUMENT_SHAPES[key];
      }
    }
    repaired.visual.instrument_shapes = shapes;
    repaired.visual.calm_mode_recommended = Boolean(repaired.visual.calm_mode_recommended);

    // 6. Director note
    repaired.director_note = String(repaired.director_note || 'Generated jam partner response.');

    // Validate with Zod
    const parsed = ChromajamSchema.safeParse(repaired);
    if (parsed.success) {
      return parsed.data;
    } else {
      console.warn('Zod validation failed after repair, using fallback:', parsed.error);
      return getFallbackPreset(hint);
    }
  } catch (err) {
    console.error('Error during repairAndValidate, falling back:', err);
    return getFallbackPreset(hint);
  }
}

// JSON Schema for Gemini API responseSchema
export const geminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    analysis: {
      type: 'OBJECT',
      properties: {
        tempo: { type: 'INTEGER', description: 'Tempo in BPM between 60 and 180' },
        key: { type: 'STRING', description: 'Musical key e.g. D minor, C major' },
        time_signature: { type: 'STRING', description: 'Time signature, usually 4/4' },
        mood: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Mood tags e.g. melancholic, upbeat',
        },
        genre_hint: { type: 'STRING', description: 'Genre hint e.g. lo-fi hip hop, synthwave' },
        energy_curve: {
          type: 'ARRAY',
          items: { type: 'NUMBER' },
          description: 'Energy value per bar (0.0 to 1.0)',
        },
        provided: {
          type: 'STRING',
          enum: ['drums', 'melody', 'both', 'none', 'prompt'],
          description: 'What the user provided',
        },
        generated: {
          type: 'STRING',
          enum: ['drums', 'melody', 'both', 'none', 'prompt'],
          description: 'What Gemini generated',
        },
      },
      required: ['tempo', 'key', 'time_signature', 'mood', 'genre_hint', 'energy_curve', 'provided', 'generated'],
    },
    groove: {
      type: 'OBJECT',
      properties: {
        swing: { type: 'NUMBER', description: 'Swing ratio 0.0 to 1.0' },
        humanize: { type: 'NUMBER', description: 'Humanization jitter 0.0 to 1.0' },
      },
      required: ['swing', 'humanize'],
    },
    drums: {
      type: 'OBJECT',
      properties: {
        bars: { type: 'INTEGER', description: 'Number of bars 1 to 4' },
        kick: { type: 'ARRAY', items: { type: 'INTEGER' }, description: '16 steps per bar (0 or 1)' },
        snare: { type: 'ARRAY', items: { type: 'INTEGER' }, description: '16 steps per bar (0 or 1)' },
        hat: { type: 'ARRAY', items: { type: 'INTEGER' }, description: '16 steps per bar (0 or 1)' },
        clap: { type: 'ARRAY', items: { type: 'INTEGER' }, description: '16 steps per bar (0 or 1)' },
        perc: { type: 'ARRAY', items: { type: 'INTEGER' }, description: '16 steps per bar (0 or 1)' },
      },
      required: ['bars', 'kick', 'snare', 'hat', 'clap', 'perc'],
    },
    melody: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pitch: { type: 'STRING', description: 'Note name like D4, C#5' },
          start: { type: 'NUMBER', description: 'Start beat within the loop' },
          dur: { type: 'NUMBER', description: 'Duration in beats' },
          vel: { type: 'NUMBER', description: 'Velocity 0.0 to 1.0' },
        },
        required: ['pitch', 'start', 'dur', 'vel'],
      },
    },
    bass: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pitch: { type: 'STRING', description: 'Bass note name like D2, A1' },
          start: { type: 'NUMBER', description: 'Start beat within the loop' },
          dur: { type: 'NUMBER', description: 'Duration in beats' },
          vel: { type: 'NUMBER', description: 'Velocity 0.0 to 1.0' },
        },
        required: ['pitch', 'start', 'dur', 'vel'],
      },
    },
    visual: {
      type: 'OBJECT',
      properties: {
        palette: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '3 to 6 valid hex colors',
        },
        texture: {
          type: 'STRING',
          enum: ['watercolor', 'ink', 'neon', 'grain', 'glass'],
          description: 'Visual texture style',
        },
        motion: {
          type: 'STRING',
          enum: ['drift', 'pulse', 'swell', 'scatter', 'ripple'],
          description: 'Visual motion style',
        },
        instrument_colors: {
          type: 'OBJECT',
          properties: {
            kick: { type: 'STRING' },
            snare: { type: 'STRING' },
            hat: { type: 'STRING' },
            melody: { type: 'STRING' },
            bass: { type: 'STRING' },
            clap: { type: 'STRING' },
            perc: { type: 'STRING' },
          },
          required: ['kick', 'snare', 'hat', 'melody', 'bass', 'clap', 'perc'],
        },
        instrument_shapes: {
          type: 'OBJECT',
          properties: {
            kick: { type: 'STRING', enum: ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'] },
            snare: { type: 'STRING', enum: ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'] },
            hat: { type: 'STRING', enum: ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'] },
            melody: { type: 'STRING', enum: ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'] },
            bass: { type: 'STRING', enum: ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'] },
            clap: { type: 'STRING', enum: ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'] },
            perc: { type: 'STRING', enum: ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'] },
          },
          required: ['kick', 'snare', 'hat', 'melody', 'bass', 'clap', 'perc'],
        },
        calm_mode_recommended: { type: 'BOOLEAN' },
      },
      required: ['palette', 'texture', 'motion', 'instrument_colors', 'instrument_shapes', 'calm_mode_recommended'],
    },
    director_note: {
      type: 'STRING',
      description: 'One or two sentences describing what was generated and why',
    },
  },
  required: ['analysis', 'groove', 'drums', 'melody', 'bass', 'visual', 'director_note'],
};
