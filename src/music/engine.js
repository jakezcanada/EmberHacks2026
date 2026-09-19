import * as Tone from 'tone';
import { calculateStepTiming, humanizeNote } from './humanize.js';
import { Mix, buildDrumKit, buildLead, buildBass, buildPad, normalizeSound } from './instruments.js';

const DRUM_LANES = ['kick', 'snare', 'hat', 'clap', 'perc'];

/** Beat position (from loop start) to a Transport time string. */
function beatToTime(beats) {
  const bar = Math.floor(beats / 4);
  const inBar = beats - bar * 4;
  const beat = Math.floor(inBar);
  const sixteenth = (inBar - beat) * 4;
  return `${bar}:${beat}:${sixteenth}`;
}

function transpose(pitch, semitones) {
  try {
    return Tone.Frequency(pitch).transpose(semitones).toNote();
  } catch {
    return pitch;
  }
}

class MusicEngine {
  constructor() {
    this.isInitialized = false;
    this.isPlaying = false;
    this.currentData = null;
    this.bpm = 90;
    this.bars = 2;
    this.listeners = { note: [], step: [], state: [], loading: [] };

    this.mix = null;
    this.voices = {};
    this.voiceKey = '';
    this.scheduledIds = [];

    this.playUserAudio = false;
    this.userAudioBuffer = null;
    this.userAudioPlayer = null;
  }

  async init() {
    if (this.isInitialized) return;
    await Tone.start();
    Tone.getContext().lookAhead = 0.08;
    this.mix = new Mix();
    this.isInitialized = true;
    if (this.userAudioBuffer) this.setUserAudio(this.userAudioBuffer);
    try {
      await this.mix.reverb.ready;
    } catch {}
  }

  on(event, cb) {
    this.listeners[event]?.push(cb);
  }

  off(event, cb) {
    if (this.listeners[event]) this.listeners[event] = this.listeners[event].filter((fn) => fn !== cb);
  }

  emit(event, data) {
    for (const fn of this.listeners[event] || []) {
      try {
        fn(data);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // ---------- voices ----------

  /** Builds the kit, lead, bass and pad the song asks for, reusing them when unchanged. */
  async prepareVoices() {
    if (!this.isInitialized || !this.currentData) return;
    const sound = normalizeSound(this.currentData.sound);
    this.mix.setSpace(sound.reverb, sound.delay);
    const key = [sound.drum_kit, sound.lead, sound.bass, sound.pad].join('|');
    // Same band: wait for its samples if they are still loading
    if (key === this.voiceKey) return this.voicesReady;

    const old = this.voices;
    this.voiceKey = key;
    this.voices = {
      kit: buildDrumKit(sound.drum_kit, this.mix),
      lead: buildLead(sound.lead, this.mix),
      bass: buildBass(sound.bass, this.mix),
      pad: buildPad(sound.pad, this.mix),
    };
    // Let tails of the previous instruments ring out before freeing them
    setTimeout(() => Object.values(old).forEach((v) => v?.dispose()), 2500);

    this.emit('loading', { loading: true, sound });
    const loadTimeout = new Promise((resolve) => setTimeout(resolve, 5000));
    this.voicesReady = Promise.race([Tone.loaded(), loadTimeout])
      .catch((err) => console.warn('Some samples failed to load:', err))
      .finally(() => this.emit('loading', { loading: false, sound }));
    return this.voicesReady;
  }

  setUserAudio(audioBuffer) {
    this.userAudioBuffer = audioBuffer;
    if (this.userAudioPlayer) {
      this.userAudioPlayer.dispose();
      this.userAudioPlayer = null;
    }
    if (audioBuffer && this.mix) {
      this.userAudioPlayer = new Tone.Player(audioBuffer).connect(this.mix.master);
      this.userAudioPlayer.loop = true;
    }
  }

  setPlayUserAudio(enable) {
    this.playUserAudio = enable;
    if (this.isPlaying) this.schedulePlayback();
  }

  async loadSong(songData) {
    this.currentData = songData;
    this.bpm = Math.max(60, Math.min(300, songData.analysis?.tempo || 90));
    this.bars = songData.drums?.bars || 2;
    Tone.getTransport().bpm.value = this.bpm;

    // Old callbacks must not play the previous song on the new instruments
    this.clearScheduled();
    await this.prepareVoices();
    if (this.isPlaying && this.currentData === songData) this.schedulePlayback();
  }

  setBpm(bpm) {
    this.bpm = Math.max(60, Math.min(300, bpm));
    Tone.getTransport().bpm.value = this.bpm;
    if (this.currentData?.analysis) this.currentData.analysis.tempo = this.bpm;
  }

  clearScheduled() {
    for (const id of this.scheduledIds) Tone.getTransport().clear(id);
    this.scheduledIds = [];
  }

  schedule(fn, time) {
    this.scheduledIds.push(Tone.getTransport().schedule(fn, time));
  }

  draw(time, data, event = 'note') {
    Tone.getDraw().schedule(() => this.emit(event, data), time);
  }

  // ---------- scheduling ----------

  schedulePlayback() {
    this.clearScheduled();
    const song = this.currentData;
    if (!song) return;

    const { drums = {}, melody = [], bass = [], chords = [] } = song;
    const groove = song.groove || { swing: 0, humanize: 0 };
    // How much each pass of the loop is allowed to differ from the written part
    const variation = Math.max(0, Math.min(1, groove.variation ?? 0.35));
    const totalSteps = this.bars * 16;
    const totalBeats = this.bars * 4;
    const beatSec = () => 60 / this.bpm;

    const transport = Tone.getTransport();
    transport.loop = true;
    transport.loopStart = 0;
    transport.loopEnd = `${this.bars}m`;

    // 1. Drums on the 16th grid, accented, with occasional ghost notes
    for (let step = 0; step < totalSteps; step++) {
      this.schedule((time) => {
        this.draw(time, { step, totalSteps }, 'step');
        const { timingOffset, velMultiplier } = calculateStepTiming(step, this.bpm, groove);
        const hitTime = time + timingOffset;
        const accent = step % 16 === 0 ? 1 : step % 4 === 0 ? 0.92 : step % 2 === 0 ? 0.78 : 0.66;
        const kit = this.voices.kit;
        if (!kit) return;

        for (const lane of DRUM_LANES) {
          if (drums[lane]?.[step] === 1) {
            const vel = Math.min(1, accent * velMultiplier);
            kit.hit(lane, hitTime, vel, step);
            this.draw(hitTime, { instrument: lane, velocity: vel, time: hitTime, step });
          }
        }

        const ghostHat = !drums.hat?.[step] && step % 2 === 1 && Math.random() < variation * 0.14;
        const ghostSnare = !drums.snare?.[step] && !drums.kick?.[step] && Math.random() < variation * 0.05;
        if (ghostHat) {
          kit.hit('hat', hitTime, 0.3, step);
          this.draw(hitTime, { instrument: 'hat', velocity: 0.3, time: hitTime, step });
        }
        if (ghostSnare) {
          kit.hit('snare', hitTime, 0.22);
          this.draw(hitTime, { instrument: 'snare', velocity: 0.22, time: hitTime, step });
        }
      }, `0:0:${step}`);
    }

    // 2. Melody: each pass may rest, jump an octave, or add a passing note from the melody's own pitches
    const melodyPitches = [...new Set(melody.map((n) => n.pitch))];
    for (const raw of melody) {
      const note = humanizeNote(raw, this.bpm, groove);
      if (note.start >= totalBeats) continue;
      this.schedule((time) => {
        if (this.playUserAudio && this.userAudioPlayer) return;
        if (Math.random() < variation * 0.12) return; // breathe: leave this one out

        let pitch = note.pitch;
        if (Math.random() < variation * 0.12) {
          const up = transpose(pitch, 12);
          const down = transpose(pitch, -12);
          pitch = Tone.Frequency(up).toMidi() <= 88 && Math.random() < 0.6 ? up : down;
        }

        const vel = Math.min(1, note.vel * (0.85 + Math.random() * 0.25));
        const durSec = note.dur * beatSec();
        const ornament = note.dur >= 0.5 && melodyPitches.length > 1 && Math.random() < variation * 0.3;
        const mainDur = ornament ? durSec / 2 : durSec;
        this.voices.lead?.play(pitch, mainDur, time, vel);
        this.draw(time, { instrument: 'melody', pitch, velocity: vel, time, start: raw.start, dur: ornament ? note.dur / 2 : note.dur });

        if (ornament) {
          const others = melodyPitches.filter((p) => p !== raw.pitch);
          const passing = others[Math.floor(Math.random() * others.length)];
          const t2 = time + mainDur;
          this.voices.lead?.play(passing, mainDur, t2, vel * 0.85);
          this.draw(t2, { instrument: 'melody', pitch: passing, velocity: vel * 0.85, time: t2, start: raw.start + note.dur / 2, dur: note.dur / 2 });
        }
      }, beatToTime(note.start));
    }

    // 3. Bass
    for (const raw of bass) {
      const note = humanizeNote(raw, this.bpm, groove);
      if (note.start >= totalBeats) continue;
      this.schedule((time) => {
        const pop = note.dur <= 0.5 && Math.random() < variation * 0.1;
        const pitch = pop ? transpose(note.pitch, 12) : note.pitch;
        this.voices.bass?.play(pitch, note.dur * beatSec(), time, note.vel);
        this.draw(time, { instrument: 'bass', pitch: note.pitch, velocity: note.vel, time, start: raw.start, dur: note.dur });
      }, beatToTime(note.start));
    }

    // 4. Chords on the pad
    for (const chord of chords) {
      if (chord.start >= totalBeats || !chord.pitches?.length) continue;
      this.schedule((time) => {
        const vel = (chord.vel ?? 0.6) * (0.9 + Math.random() * 0.15);
        this.voices.pad?.playChord(chord.pitches, chord.dur * beatSec(), time, vel);
        for (const p of chord.pitches) {
          this.draw(time, { instrument: 'chords', pitch: p, velocity: vel, time, start: chord.start, dur: chord.dur });
        }
      }, beatToTime(chord.start));
    }

    // 5. The user's own recording, if chosen instead of the synth melody
    if (this.playUserAudio && this.userAudioPlayer) {
      this.schedule((time) => this.userAudioPlayer.start(time), '0:0:0');
    }
  }

  async play() {
    await this.init();
    if (this.isPlaying) return;
    await this.prepareVoices();
    this.schedulePlayback();
    Tone.getTransport().position = 0;
    Tone.getTransport().start('+0.05');
    this.isPlaying = true;
    this.emit('state', { isPlaying: true });
  }

  stop() {
    Tone.getTransport().stop();
    const now = Tone.now();
    this.voices.lead?.release(now);
    this.voices.pad?.release(now);
    this.voices.bass?.release(now);
    try {
      this.userAudioPlayer?.stop();
    } catch {}
    this.isPlaying = false;
    this.emit('state', { isPlaying: false });
    this.emit('step', { step: -1, totalSteps: this.bars * 16 });
  }

  togglePlay() {
    if (this.isPlaying) this.stop();
    else this.play();
  }

  getAnalyserData() {
    return this.mix ? this.mix.analyser.getValue() : new Float32Array(64);
  }

  async recordLoop() {
    await this.init();
    const rawContext = Tone.getContext().rawContext;
    if (!window.MediaRecorder) throw new Error('This browser cannot record audio');
    const destination = rawContext.createMediaStreamDestination();
    this.mix.master.connect(destination);
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
      .find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const recording = new Promise((resolve) => {
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        setTimeout(() => resolve(new Blob(chunks, { type: recorder.mimeType })), 0);
      });
    });
    const duration = (this.bars * 4 * 60) / this.bpm;
    const wasPlaying = this.isPlaying;
    try {
      recorder.start();
      if (!wasPlaying) await this.play();
      await new Promise((resolve) => setTimeout(resolve, duration * 1000 + 250));
      recorder.stop();
      return await recording;
    } finally {
      this.mix.master.disconnect(destination);
      if (!wasPlaying && this.isPlaying) this.stop();
    }
  }
}

export const musicEngine = new MusicEngine();
