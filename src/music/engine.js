import * as Tone from 'tone';
import { calculateStepTiming, humanizeNote } from './humanize.js';

class MusicEngine {
  constructor() {
    this.isInitialized = false;
    this.isPlaying = false;
    this.currentData = null;
    this.bpm = 90;
    this.bars = 2;
    this.listeners = {
      note: [],
      step: [],
      state: [],
    };

    this.synths = {};
    this.scheduledPartIds = [];
    this.analyser = null;
    this.masterGain = null;
    this.limiter = null;

    // Toggle for user audio vs synth
    this.playUserAudio = false;
    this.userAudioBuffer = null;
    this.userAudioPlayer = null;
  }

  async init() {
    if (this.isInitialized) return;

    await Tone.start();

    // Master limiter and analyser
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.analyser = new Tone.Analyser('fft', 64);
    this.masterGain = new Tone.Gain(0.9).connect(this.limiter);
    this.masterGain.connect(this.analyser);

    // Kick: punchy low membrane
    this.synths.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.35,
        sustain: 0.01,
        release: 0.4,
      },
    }).connect(this.masterGain);

    // Snare: noise synth with snappy envelope
    this.synths.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.001,
        decay: 0.22,
        sustain: 0,
      },
    }).connect(this.masterGain);

    // Hat: bright metallic closed hat
    this.synths.hat = new Tone.MetalSynth({
      frequency: 200,
      envelope: {
        attack: 0.001,
        decay: 0.06,
        release: 0.03,
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(this.masterGain);
    this.synths.hat.volume.value = -10;

    // Clap: snappy pink noise with slight spread
    this.synths.clap = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: {
        attack: 0.005,
        decay: 0.18,
        sustain: 0,
      },
    }).connect(this.masterGain);
    this.synths.clap.volume.value = -3;

    // Perc: high melodic percussion / rim / woodblock
    this.synths.perc = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 3,
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.001,
        decay: 0.15,
        sustain: 0.01,
        release: 0.1,
      },
    }).connect(this.masterGain);
    this.synths.perc.volume.value = -4;

    // Melody: expressive PolySynth
    this.synths.melody = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: {
        attack: 0.02,
        decay: 0.2,
        sustain: 0.5,
        release: 0.8,
      },
    }).connect(this.masterGain);
    this.synths.melody.volume.value = -4;

    // Bass: punchy sub-bass MonoSynth
    this.synths.bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: {
        Q: 2,
        type: 'lowpass',
        rolloff: -24,
      },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.4,
        release: 0.6,
      },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.2,
        release: 0.4,
        baseFrequency: 60,
        octaves: 3,
      },
    }).connect(this.masterGain);
    this.synths.bass.volume.value = -2;

    this.isInitialized = true;
  }

  on(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event].push(cb);
    }
  }

  off(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(fn => fn !== cb);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      for (const fn of this.listeners[event]) {
        try { fn(data); } catch (e) { console.error(e); }
      }
    }
  }

  setUserAudio(audioBuffer) {
    this.userAudioBuffer = audioBuffer;
    if (this.userAudioPlayer) {
      this.userAudioPlayer.dispose();
      this.userAudioPlayer = null;
    }
    if (audioBuffer) {
      this.userAudioPlayer = new Tone.Player(audioBuffer).connect(this.masterGain);
      this.userAudioPlayer.loop = true;
    }
  }

  setPlayUserAudio(enable) {
    this.playUserAudio = enable;
  }

  loadSong(songData) {
    this.currentData = songData;
    this.bpm = songData.analysis?.tempo || 90;
    this.bars = songData.drums?.bars || 2;

    Tone.getTransport().bpm.value = this.bpm;

    if (this.isPlaying) {
      this.schedulePlayback();
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(60, Math.min(180, bpm));
    Tone.getTransport().bpm.value = this.bpm;
    if (this.currentData?.analysis) {
      this.currentData.analysis.tempo = this.bpm;
    }
  }

  clearScheduled() {
    for (const id of this.scheduledPartIds) {
      Tone.getTransport().clear(id);
    }
    this.scheduledPartIds = [];
  }

  schedulePlayback() {
    this.clearScheduled();
    if (!this.currentData) return;

    const { drums, melody, bass, groove = { swing: 0, humanize: 0 } } = this.currentData;
    const totalSteps = this.bars * 16;
    const totalBeats = this.bars * 4;
    const loopDuration = `${this.bars}m`;

    Tone.getTransport().loop = true;
    Tone.getTransport().loopStart = 0;
    Tone.getTransport().loopEnd = loopDuration;

    // 1. Schedule Drum Grid
    const drumLanes = ['kick', 'snare', 'hat', 'clap', 'perc'];

    for (let step = 0; step < totalSteps; step++) {
      // Calculate 16th time position: bar:quarter:sixteenth
      const bar = Math.floor(step / 16);
      const beat = Math.floor((step % 16) / 4);
      const sixteenth = step % 4;
      const timeStr = `${bar}:${beat}:${sixteenth}`;

      const partId = Tone.getTransport().schedule((time) => {
        // Step notification for visual beat grid
        Tone.getDraw().schedule(() => {
          this.emit('step', { step, totalSteps, bar, beat });
        }, time);

        const { timingOffset, velMultiplier } = calculateStepTiming(step, this.bpm, groove);
        const hitTime = time + timingOffset;

        for (const lane of drumLanes) {
          if (drums && drums[lane] && drums[lane][step] === 1) {
            const vel = Math.min(1.0, 0.85 * velMultiplier);

            // Trigger synth
            if (lane === 'kick') {
              this.synths.kick.triggerAttackRelease('C1', '8n', hitTime, vel);
            } else if (lane === 'snare') {
              this.synths.snare.triggerAttackRelease('16n', hitTime, vel);
            } else if (lane === 'hat') {
              this.synths.hat.triggerAttackRelease('32n', hitTime, vel * 0.7);
            } else if (lane === 'clap') {
              this.synths.clap.triggerAttackRelease('16n', hitTime, vel);
            } else if (lane === 'perc') {
              this.synths.perc.triggerAttackRelease('G2', '16n', hitTime, vel);
            }

            // Sync with visual renderer and haptics via Tone.Draw
            Tone.getDraw().schedule(() => {
              this.emit('note', { instrument: lane, velocity: vel, time: hitTime });
            }, hitTime);
          }
        }
      }, timeStr);

      this.scheduledPartIds.push(partId);
    }

    // 2. Schedule Melody
    if (melody && Array.isArray(melody)) {
      for (const rawNote of melody) {
        const note = humanizeNote(rawNote, this.bpm, groove);
        if (note.start >= totalBeats) continue;

        // Convert beat position to Transport time
        const bar = Math.floor(note.start / 4);
        const beatRemainder = note.start % 4;
        const beat = Math.floor(beatRemainder);
        const sixteenthRemainder = (beatRemainder - beat) * 4;
        const sixteenth = Math.floor(sixteenthRemainder);
        const frac = sixteenthRemainder - sixteenth;
        const timeStr = `${bar}:${beat}:${sixteenth + frac}`;

        const partId = Tone.getTransport().schedule((time) => {
          if (!this.playUserAudio || !this.userAudioPlayer) {
            this.synths.melody.triggerAttackRelease(
              note.pitch,
              Tone.Time(`${note.dur} * 4n`).toSeconds(),
              time,
              note.vel || 0.8
            );
          }

          Tone.getDraw().schedule(() => {
            this.emit('note', {
              instrument: 'melody',
              pitch: note.pitch,
              velocity: note.vel || 0.8,
              time,
            });
          }, time);
        }, timeStr);

        this.scheduledPartIds.push(partId);
      }
    }

    // 3. Schedule Bass
    if (bass && Array.isArray(bass)) {
      for (const rawNote of bass) {
        const note = humanizeNote(rawNote, this.bpm, groove);
        if (note.start >= totalBeats) continue;

        const bar = Math.floor(note.start / 4);
        const beatRemainder = note.start % 4;
        const beat = Math.floor(beatRemainder);
        const sixteenthRemainder = (beatRemainder - beat) * 4;
        const sixteenth = Math.floor(sixteenthRemainder);
        const frac = sixteenthRemainder - sixteenth;
        const timeStr = `${bar}:${beat}:${sixteenth + frac}`;

        const partId = Tone.getTransport().schedule((time) => {
          this.synths.bass.triggerAttackRelease(
            note.pitch,
            Tone.Time(`${note.dur} * 4n`).toSeconds(),
            time,
            note.vel || 0.85
          );

          Tone.getDraw().schedule(() => {
            this.emit('note', {
              instrument: 'bass',
              pitch: note.pitch,
              velocity: note.vel || 0.85,
              time,
            });
          }, time);
        }, timeStr);

        this.scheduledPartIds.push(partId);
      }
    }

    // 4. Schedule User Audio if enabled
    if (this.playUserAudio && this.userAudioPlayer) {
      const audioPartId = Tone.getTransport().schedule((time) => {
        this.userAudioPlayer.start(time);
      }, '0:0:0');
      this.scheduledPartIds.push(audioPartId);
    }
  }

  async play() {
    await this.init();
    if (this.isPlaying) return;

    this.schedulePlayback();
    Tone.getTransport().position = 0;
    Tone.getTransport().start();
    this.isPlaying = true;
    this.emit('state', { isPlaying: true });
  }

  stop() {
    Tone.getTransport().stop();
    if (this.userAudioPlayer) {
      try { this.userAudioPlayer.stop(); } catch (e) {}
    }
    this.isPlaying = false;
    this.emit('state', { isPlaying: false });
    this.emit('step', { step: -1, totalSteps: this.bars * 16, bar: -1, beat: -1 });
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  getAnalyserData() {
    if (!this.analyser) return new Float32Array(64);
    return this.analyser.getValue();
  }
}

export const musicEngine = new MusicEngine();
