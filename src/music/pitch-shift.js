import * as Tone from 'tone';

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const MAX_PITCH_SHIFT_SEMITONES = 36;

/** Convert a conventional note name such as C#4 or Db3 to MIDI. */
export function noteToMidi(note) {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(note || '').trim());
  if (!match) throw new Error(`Invalid note name: ${note}`);
  let midi = (Number(match[3]) + 1) * 12 + NOTE_INDEX[match[1].toUpperCase()];
  if (match[2] === '#') midi += 1;
  if (match[2] === 'b') midi -= 1;
  if (midi < 0 || midi > 127) throw new Error(`Note is outside the MIDI range: ${note}`);
  return midi;
}

export function pitchDifference(sourceNote, targetNote) {
  return noteToMidi(targetNote) - noteToMidi(sourceNote);
}

export function pitchRatio(semitones) {
  return 2 ** (semitones / 12);
}

function nearestSource(spec, targetNote) {
  const targetMidi = noteToMidi(targetNote);
  const sourceNotes = spec.root ? [spec.root] : spec.notes;
  return sourceNotes
    .map((note) => ({ note, midi: noteToMidi(note) }))
    .sort((a, b) => Math.abs(a.midi - targetMidi) - Math.abs(b.midi - targetMidi))[0];
}

/**
 * Tone.Sampler-compatible voice for one-shot samples. Tone.PitchShift uses a
 * granular delay, so the source duration is not multiplied by the pitch ratio.
 */
export function pitchedSampler(spec, { baseUrl, extension = 'mp3', ...options } = {}) {
  if (!spec?.notes?.length) throw new Error('A pitched sample needs at least one source note');

  const cache = new Map();
  const maxShift = spec.maxPitchShiftSemitones ?? MAX_PITCH_SHIFT_SEMITONES;
  let destination = null;

  function getVoice(targetNote) {
    const source = nearestSource(spec, targetNote);
    const semitones = pitchDifference(source.note, targetNote);
    if (Math.abs(semitones) > maxShift) {
      throw new Error(`Pitch shift of ${semitones} semitones exceeds the ${maxShift}-semitone limit`);
    }

    const key = `${source.note}:${semitones}`;
    if (!cache.has(key)) {
      const player = new Tone.Player({ url: `${baseUrl}${source.note.replace('#', 's')}.${extension}`, ...options });
      const shifter = new Tone.PitchShift({ pitch: semitones, windowSize: 0.1, delayTime: 0.03 });
      player.connect(shifter);
      if (destination) shifter.connect(destination);
      cache.set(key, { player, shifter, active: false, disposed: false });
    }
    return cache.get(key);
  }

  // Preload every original source note so the engine's existing Tone.loaded()
  // barrier also covers the first playback. Residual shift variants reuse the
  // same Tone.js audio-buffer cache when they are requested.
  for (const note of [spec.root || spec.notes[0]]) getVoice(note);

  return {
    get loaded() {
      return [...cache.values()].every(({ player }) => player.loaded);
    },
    triggerAttackRelease(note, _duration, time, velocity) {
      try {
        const voice = getVoice(note);
        const start = () => {
          if (voice.disposed) return;
          voice.player.start(Math.max(time, Tone.now()), 0, undefined, velocity);
          voice.active = true;
        };
        // Let a one-shot finish naturally; never change its duration via playbackRate.
        if (voice.player.loaded) start();
        else void Tone.loaded().then(start).catch((error) => console.warn(`[PitchShift] ${error.message}`));
      } catch (error) {
        console.warn(`[PitchShift] ${error.message}`);
      }
    },
    connect(output) {
      destination = output;
      for (const { shifter } of cache.values()) shifter.connect(output);
      return this;
    },
    releaseAll(time) {
      for (const voice of cache.values()) {
        if (!voice.active) continue;
        try {
          voice.player.stop(time);
        } catch (error) {
          console.warn(`[PitchShift] Could not stop sample: ${error.message}`);
        }
        voice.active = false;
      }
    },
    dispose() {
      for (const voice of cache.values()) {
        voice.disposed = true;
        if (voice.active) {
          try { voice.player.stop(); } catch {}
        }
        try { voice.player.dispose(); } catch (error) { console.warn(`[PitchShift] Could not dispose sample: ${error.message}`); }
        try { voice.shifter.dispose(); } catch {}
      }
      cache.clear();
    },
  };
}