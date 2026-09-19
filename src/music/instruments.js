import * as Tone from 'tone';
import catalog from './sound-catalog.json';
import { pitchedSampler } from './pitch-shift.js';

/**
 * Instrument library. Each song picks a drum kit, lead, bass and pad from
 * sound-catalog.json; sampled voices load lazily from /samples and synth voices
 * are designed per genre family. Every voice exposes
 *   play(note, durationSec, time, velocity)   (drum kits: hit(lane, time, velocity))
 * and routes into the shared mix with its own reverb/delay sends.
 */

const SAMPLE_ROOT = '/samples/';

export const DEFAULT_SOUND = { drum_kit: 'tight', lead: 'piano', bass: 'synth', pad: 'warm', reverb: 0.25, delay: 0.15 };

export function normalizeSound(sound = {}) {
  const pick = (group, value, fallback) => (catalog[group][value] ? value : fallback);
  return {
    drum_kit: pick('drum_kit', sound.drum_kit, DEFAULT_SOUND.drum_kit),
    lead: pick('lead', sound.lead, DEFAULT_SOUND.lead),
    bass: pick('bass', sound.bass, DEFAULT_SOUND.bass),
    pad: pick('pad', sound.pad, DEFAULT_SOUND.pad),
    reverb: clamp01(sound.reverb ?? DEFAULT_SOUND.reverb),
    delay: clamp01(sound.delay ?? DEFAULT_SOUND.delay),
  };
}

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

function sampleUrls(name) {
  const spec = catalog.samples[name];
  const urls = {};
  const extension = spec.extension || 'mp3';
  for (const note of spec.notes) urls[note] = `${note.replace('#', 's')}.${extension}`;
  return { urls, baseUrl: SAMPLE_ROOT + name + '/', extension };
}

function sampler(name, opts = {}) {
  const spec = catalog.samples[name];
  const { baseUrl, extension } = sampleUrls(name);
  return pitchedSampler(spec, { baseUrl, extension, ...opts });
}

// ---------- the mix ----------

export class Mix {
  constructor() {
    this.master = new Tone.Gain(0.85);
    this.compressor = new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.01, release: 0.2 });
    this.limiter = new Tone.Limiter(-1);
    this.master.chain(this.compressor, this.limiter, Tone.getDestination());

    this.reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.02, wet: 1 });
    this.reverbReturn = new Tone.Gain(0.6).connect(this.master);
    this.reverb.connect(this.reverbReturn);

    this.delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.32, wet: 1 });
    this.delayTone = new Tone.Filter(2600, 'lowpass');
    this.delayReturn = new Tone.Gain(0.5).connect(this.master);
    this.delay.chain(this.delayTone, this.delayReturn);

    this.analyser = new Tone.Analyser('fft', 64);
    this.master.connect(this.analyser);
  }

  /** Song-level amounts scale every voice's own sends. */
  setSpace(reverb, delay) {
    this.reverbReturn.gain.rampTo(0.25 + reverb * 0.9, 0.2);
    this.delayReturn.gain.rampTo(delay * 0.9, 0.2);
  }

  route(node, { rev = 0.2, del = 0 } = {}) {
    node.connect(this.master);
    if (rev > 0) node.connect(new Tone.Gain(rev).connect(this.reverb));
    if (del > 0) node.connect(new Tone.Gain(del).connect(this.delay));
    return node;
  }
}

// ---------- drum kits ----------

const DRUM_NOTES = { kick: 'C1', snare: 'D1', perc: 'A1', tom: 'C2' };

function buildClap(mix) {
  // Several noise bursts a few ms apart, band-passed: how a real handclap is built
  const noise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } });
  const band = new Tone.Filter({ frequency: 1300, type: 'bandpass', Q: 0.9 });
  const out = new Tone.Gain(0.9);
  noise.chain(band, out);
  mix.route(out, { rev: 0.25 });
  return {
    hit(time, vel) {
      for (let i = 0; i < 3; i++) noise.triggerAttackRelease(0.008, time + i * 0.011, vel * 0.7);
      noise.triggerAttackRelease(0.12, time + 0.034, vel);
    },
    dispose() {
      noise.dispose(); band.dispose(); out.dispose();
    },
  };
}

function build808Kick(mix) {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.09,
    octaves: 5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.9, sustain: 0.05, release: 0.6 },
  });
  const drive = new Tone.Distortion(0.25);
  kick.volume.value = -2;
  kick.connect(drive);
  mix.route(drive, { rev: 0 });
  return {
    hit(time, vel) { kick.triggerAttackRelease('A0', 0.6, time, vel); },
    dispose() { kick.dispose(); drive.dispose(); },
  };
}

// Closed-hat character per kit. decay in seconds; hp = high-pass Hz; lp = darkening low-pass;
// metal = level of the metallic partials; open = chance of an open hat on the "and" of a beat.
const HAT_TUNING = {
  acoustic: { decay: 0.07, hp: 6500, lp: 14000, metal: 0.35, open: 0.25 },
  breakbeat: { decay: 0.06, hp: 5500, lp: 9000, metal: 0.25, open: 0.2 },
  linn: { decay: 0.05, hp: 7500, lp: 15000, metal: 0.3, open: 0.15 },
  cr78: { decay: 0.035, hp: 8500, lp: 16000, metal: 0.15, open: 0 },
  techno: { decay: 0.045, hp: 8000, lp: 16000, metal: 0.4, open: 0.3 },
  trap: { decay: 0.03, hp: 9000, lp: 17000, metal: 0.2, open: 0 },
  fm: { decay: 0.05, hp: 7000, lp: 14000, metal: 0.7, open: 0.1 },
  industrial: { decay: 0.08, hp: 5500, lp: 12000, metal: 0.6, open: 0.2 },
  r8: { decay: 0.045, hp: 7500, lp: 15000, metal: 0.3, open: 0.15 },
  hand: { decay: 0.09, hp: 4500, lp: 9000, metal: 0, open: 0, shaker: true },
  tight: { decay: 0.04, hp: 8000, lp: 16000, metal: 0.25, open: 0.1 },
  room: { decay: 0.08, hp: 6000, lp: 12000, metal: 0.35, open: 0.25 },
};

/**
 * A designed hi-hat: high-passed white noise with a faint metallic layer and an
 * exponential decay. Both voices are monophonic, so each hit chokes the last
 * one the way a real hat pedal does.
 */
export function buildHat(kitId, mix) {
  const t = HAT_TUNING[kitId] || HAT_TUNING.tight;
  // Hats sit well behind kick and snare
  const out = new Tone.Gain(t.shaker ? 0.28 : 0.22);
  const hp = new Tone.Filter({ frequency: t.hp, type: 'highpass', rolloff: -24 });
  const lp = new Tone.Filter({ frequency: t.lp, type: 'lowpass', rolloff: -12 });
  hp.chain(lp, out);
  mix.route(out, { rev: kitId === 'acoustic' || kitId === 'room' ? 0.15 : 0.05 });

  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: t.shaker ? 0.012 : 0.001, decay: t.decay, sustain: 0, release: 0.02, decayCurve: 'exponential' },
  }).connect(hp);

  const metal = t.metal > 0
    ? new Tone.MetalSynth({
        frequency: 320,
        harmonicity: 5.1,
        modulationIndex: 24,
        resonance: 9000,
        octaves: 1,
        envelope: { attack: 0.001, decay: t.decay * 0.8, release: 0.01 },
        volume: -26 + t.metal * 10,
      }).connect(hp)
    : null;

  return {
    hit(time, vel, step) {
      // Now and then the "and" of a beat opens up, which is where real players open the hat
      const open = t.open > 0 && step != null && step % 4 === 2 && Math.random() < t.open * 0.5;
      const decay = open ? t.decay * 5 : t.decay;
      noise.envelope.decay = decay;
      if (metal) metal.envelope.decay = decay * 0.8;
      const v = Math.min(1, vel * (0.9 + Math.random() * 0.2));
      noise.triggerAttackRelease(decay, time, v);
      metal?.triggerAttackRelease(320, decay, time, v); // Monophonic signature: note first
    },
    dispose() {
      noise.dispose(); metal?.dispose(); hp.dispose(); lp.dispose(); out.dispose();
    },
  };
}

export function buildDrumKit(kitId, mix) {
  const kit = catalog.drum_kit[kitId] || catalog.drum_kit[DEFAULT_SOUND.drum_kit];
  const base = `${SAMPLE_ROOT}drums/${kit.dir}/`;
  const files = kit.files || {
    kick: 'kick.mp3',
    snare: 'snare.mp3',
    perc: 'tom2.mp3',
    tom: 'tom1.mp3',
  };
  const samples = new Tone.Sampler({
    urls: { [DRUM_NOTES.kick]: files.kick, [DRUM_NOTES.snare]: files.snare, [DRUM_NOTES.perc]: files.perc, [DRUM_NOTES.tom]: files.tom },
    baseUrl: base,
    release: 1,
  });
  const customHat = files.hat
    ? new Tone.Sampler({ urls: { [DRUM_NOTES.kick]: files.hat }, baseUrl: base, release: 0.2 })
    : null;
  samples.volume.value = -3;
  mix.route(samples, { rev: kitId === 'acoustic' || kitId === 'room' ? 0.3 : 0.12 });
  const clap = buildClap(mix);
  const hat = buildHat(kitId, mix);
  const boom = kitId === 'trap' ? build808Kick(mix) : null;

  return {
    hit(lane, time, vel, step) {
      if (lane === 'clap') return clap.hit(time, vel);
      if (lane === 'hat') {
        if (customHat?.loaded) customHat.triggerAttack(DRUM_NOTES.kick, time, vel);
        else hat.hit(time, vel, step);
        return;
      }
      if (lane === 'kick' && boom) return boom.hit(time, vel);
      if (!samples.loaded) return;
      samples.triggerAttack(DRUM_NOTES[lane] || DRUM_NOTES.perc, time, vel);
    },
    dispose() {
      samples.dispose(); customHat?.dispose(); clap.dispose(); hat.dispose(); boom?.dispose();
    },
  };
}

// ---------- melodic voices ----------

function poly(voice, options, volume) {
  const s = new Tone.PolySynth(voice, options);
  s.maxPolyphony = 16;
  s.volume.value = volume;
  return s;
}

/** Wraps a Tone instrument plus its effect chain into a playable voice. */
function voice(source, chain, mix, sends, { strum = 0, arp = false } = {}) {
  let last = source;
  for (const fx of chain) {
    last.connect(fx);
    last = fx;
  }
  mix.route(last, sends);
  return {
    source,
    play(note, dur, time, vel) {
      if (source.loaded === false) return;
      source.triggerAttackRelease(note, dur, time, vel);
    },
    /** Chords: block, strummed, or arpeggiated across the chord's length. */
    playChord(notes, dur, time, vel) {
      if (source.loaded === false || !notes.length) return;
      if (arp) {
        const step = Math.min(0.18, dur / notes.length);
        notes.forEach((n, i) => source.triggerAttackRelease(n, Math.max(0.2, dur - i * step), time + i * step, vel));
      } else if (strum) {
        notes.forEach((n, i) => source.triggerAttackRelease(n, dur, time + i * strum, vel * (1 - i * 0.05)));
      } else {
        source.triggerAttackRelease(notes, dur, time, vel);
      }
    },
    release(time) {
      source.releaseAll?.(time);
    },
    dispose() {
      source.dispose();
      chain.forEach((fx) => fx.dispose());
    },
  };
}

const ePianoOptions = {
  harmonicity: 3,
  modulationIndex: 1.6,
  oscillator: { type: 'sine' },
  modulation: { type: 'sine' },
  envelope: { attack: 0.004, decay: 1.6, sustain: 0.2, release: 1.4 },
  modulationEnvelope: { attack: 0.004, decay: 0.45, sustain: 0.08, release: 0.6 },
};

export function buildLead(id, mix) {
  switch (id) {
    case 'piano': return voice(sampler('piano', { release: 1.2 }), [], mix, { rev: 0.35, del: 0.1 });
    case 'guitar_nylon': return voice(sampler('guitar-nylon', { release: 1 }), [], mix, { rev: 0.3, del: 0.1 });
    case 'guitar_acoustic': return voice(sampler('guitar-acoustic', { release: 1 }), [], mix, { rev: 0.3, del: 0.1 });
    case 'guitar_electric': return voice(sampler('guitar-electric', { release: 0.8 }), [new Tone.Chorus(2, 2.5, 0.3).start()], mix, { rev: 0.25, del: 0.2 });
    case 'flute': return voice(sampler('flute', { release: 0.6, attack: 0.02 }), [], mix, { rev: 0.4, del: 0.15 });
    case 'sax': return voice(sampler('saxophone', { release: 0.5 }), [], mix, { rev: 0.35, del: 0.05 });
    case 'trumpet': return voice(sampler('trumpet', { release: 0.4 }), [], mix, { rev: 0.35, del: 0.05 });
    case 'violin': return voice(sampler('violin', { release: 1, attack: 0.05 }), [], mix, { rev: 0.45 });
    case 'clarinet': return voice(sampler('clarinet', { release: 0.5 }), [], mix, { rev: 0.35 });
    case 'xylophone': return voice(sampler('xylophone', { release: 1.5 }), [], mix, { rev: 0.3, del: 0.15 });
    case 'harp': return voice(sampler('harp', { release: 2 }), [], mix, { rev: 0.45, del: 0.1 });
    case 'organ': return voice(sampler('organ', { release: 0.3 }), [], mix, { rev: 0.25 });
    case 'horn': return voice(sampler('french-horn', { release: 0.8, attack: 0.04 }), [], mix, { rev: 0.5 });
    case 'epiano':
      return voice(poly(Tone.FMSynth, ePianoOptions, -8), [new Tone.Tremolo(4.5, 0.35).start()], mix, { rev: 0.3, del: 0.15 });
    case 'supersaw':
      return voice(
        poly(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 32 }, envelope: { attack: 0.01, decay: 0.25, sustain: 0.55, release: 0.5 } }, -16),
        [new Tone.Filter(3800, 'lowpass'), new Tone.Chorus(1.5, 3.5, 0.5).start()],
        mix, { rev: 0.4, del: 0.3 }
      );
    case 'pluck':
      return voice(
        poly(Tone.MonoSynth, {
          oscillator: { type: 'sawtooth' },
          filter: { Q: 2, type: 'lowpass', rolloff: -24 },
          envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.25 },
          filterEnvelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.2, baseFrequency: 350, octaves: 3.6 },
        }, -10),
        [], mix, { rev: 0.35, del: 0.35 }
      );
    case 'square':
      return voice(
        poly(Tone.Synth, { oscillator: { type: 'pulse', width: 0.35 }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 } }, -16),
        [new Tone.Vibrato(5.5, 0.08), new Tone.Filter(2600, 'lowpass')],
        mix, { rev: 0.3, del: 0.25 }
      );
    case 'bell':
      return voice(
        poly(Tone.FMSynth, {
          harmonicity: 5.01, modulationIndex: 9,
          envelope: { attack: 0.001, decay: 1.8, sustain: 0, release: 1.8 },
          modulationEnvelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.8 },
        }, -14),
        [], mix, { rev: 0.5, del: 0.25 }
      );
    case 'chip':
      return voice(
        poly(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0, decay: 0.12, sustain: 0.45, release: 0.05 } }, -20),
        [], mix, { rev: 0.1, del: 0.2 }
      );
    case 'soft':
    default:
      return voice(
        poly(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.06, decay: 0.4, sustain: 0.6, release: 1.4 } }, -8),
        [new Tone.Filter(2000, 'lowpass')], mix, { rev: 0.5, del: 0.2 }
      );
  }
}

export function buildBass(id, mix) {
  switch (id) {
    case 'electric': return voice(sampler('bass-electric', { release: 0.4 }), [], mix, { rev: 0.03 });
    case 'upright': return voice(sampler('contrabass', { release: 0.5 }), [], mix, { rev: 0.1 });
    case 'cello': return voice(sampler('cello', { release: 0.8, attack: 0.03 }), [], mix, { rev: 0.3 });
    case 'sub':
      return voice(new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        filter: { type: 'lowpass', frequency: 500 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.3 },
        filterEnvelope: { baseFrequency: 400, octaves: 0 },
        volume: -4,
      }), [], mix, { rev: 0 });
    case '808':
      return voice(
        new Tone.MembraneSynth({ pitchDecay: 0.06, octaves: 0.8, oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 1.2, sustain: 0.35, release: 0.5 }, volume: -3 }),
        [new Tone.Distortion(0.35), new Tone.Filter(1200, 'lowpass')], mix, { rev: 0 }
      );
    case 'reese':
      return voice(new Tone.MonoSynth({
        oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.3 },
        filterEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.5, release: 0.3, baseFrequency: 160, octaves: 2.2 },
        volume: -12,
      }), [new Tone.Chorus(0.8, 4, 0.4).start()], mix, { rev: 0.05 });
    case 'acid':
      return voice(new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 9, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.002, decay: 0.2, sustain: 0.4, release: 0.1 },
        filterEnvelope: { attack: 0.001, decay: 0.2, sustain: 0.05, release: 0.1, baseFrequency: 130, octaves: 4.2 },
        volume: -12,
      }), [new Tone.Distortion(0.3)], mix, { rev: 0.05, del: 0.15 });
    case 'fm':
      return voice(new Tone.FMSynth({
        harmonicity: 1, modulationIndex: 4,
        envelope: { attack: 0.002, decay: 0.3, sustain: 0.35, release: 0.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0.1, release: 0.2 },
        volume: -6,
      }), [], mix, { rev: 0.03 });
    case 'synth':
    default:
      return voice(new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.2 },
        filterEnvelope: { attack: 0.002, decay: 0.2, sustain: 0.25, release: 0.2, baseFrequency: 90, octaves: 3 },
        volume: -10,
      }), [], mix, { rev: 0.03 });
  }
}

export function buildPad(id, mix) {
  switch (id) {
    case 'none': return null;
    case 'piano': return voice(sampler('piano', { release: 1.5, volume: -8 }), [], mix, { rev: 0.4 });
    case 'strings': return voice(sampler('violin', { attack: 0.25, release: 1.6, volume: -12 }), [], mix, { rev: 0.6 });
    case 'organ': return voice(sampler('organ', { release: 0.4, volume: -14 }), [new Tone.Tremolo(6, 0.25).start()], mix, { rev: 0.3 });
    case 'guitar': return voice(sampler('guitar-acoustic', { release: 1, volume: -8 }), [], mix, { rev: 0.3 }, { strum: 0.018 });
    case 'harp': return voice(sampler('harp', { release: 2.5, volume: -8 }), [], mix, { rev: 0.5, del: 0.15 }, { arp: true });
    case 'brass': return voice(sampler('french-horn', { attack: 0.03, release: 0.6, volume: -10 }), [], mix, { rev: 0.4 });
    case 'epiano': return voice(poly(Tone.FMSynth, ePianoOptions, -14), [new Tone.Tremolo(4.5, 0.35).start()], mix, { rev: 0.35 });
    case 'glass':
      return voice(poly(Tone.FMSynth, {
        harmonicity: 2.01, modulationIndex: 2.5,
        envelope: { attack: 0.4, decay: 1.5, sustain: 0.5, release: 2.5 },
        modulationEnvelope: { attack: 0.5, decay: 1, sustain: 0.3, release: 2 },
      }, -20), [], mix, { rev: 0.7, del: 0.2 });
    case 'warm':
    default:
      return voice(
        poly(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 40 }, envelope: { attack: 0.5, decay: 0.6, sustain: 0.8, release: 2 } }, -24),
        [new Tone.Filter(1300, 'lowpass'), new Tone.Chorus(0.6, 3, 0.6).start()],
        mix, { rev: 0.6 }
      );
  }
}
