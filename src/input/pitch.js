import { PitchDetector } from 'pitchy';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function freqToNoteName(freq) {
  if (!freq || freq < 50 || freq > 2000) return null;
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  if (midi < 24 || midi > 96) return null; // Octaves 1 to 6
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Autocorrelation fallback if PitchDetector encounters an issue
 */
function autoCorrelate(buffer, sampleRate) {
  let size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.015) return [0, 0]; // Low energy / silence

  let r1 = 0, r2 = size - 1, thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < thres) { r2 = size - i; break; }
  }

  const trimmed = buffer.slice(r1, r2);
  size = trimmed.length;

  const c = new Float32Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] = c[i] + trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  let T0 = maxpos;
  if (T0 === 0) return [0, 0];

  const freq = sampleRate / T0;
  const clarity = maxval / c[0];
  return [freq, clarity];
}

/**
 * Extracts segmented notes and estimates tempo from PCM audio.
 */
export function extractNotesFromAudio(pcmData, sampleRate = 16000) {
  if (!pcmData || pcmData.length === 0) {
    return { notes: [], tempo: 100, key: 'C major' };
  }

  const frameSize = 1024;
  const hopSize = 256;
  const numFrames = Math.floor((pcmData.length - frameSize) / hopSize);

  let detector;
  try {
    detector = PitchDetector.forFloat32Array(frameSize);
  } catch (e) {
    detector = null;
  }

  const frameData = [];

  for (let i = 0; i < numFrames; i++) {
    const offset = i * hopSize;
    const frame = pcmData.subarray(offset, offset + frameSize);
    const time = offset / sampleRate;

    // Calculate RMS energy
    let energy = 0;
    for (let j = 0; j < frame.length; j++) energy += frame[j] * frame[j];
    energy = Math.sqrt(energy / frame.length);

    let pitch = 0;
    let clarity = 0;

    if (detector) {
      try {
        [pitch, clarity] = detector.findPitch(frame, sampleRate);
      } catch (err) {
        [pitch, clarity] = autoCorrelate(frame, sampleRate);
      }
    } else {
      [pitch, clarity] = autoCorrelate(frame, sampleRate);
    }

    if (clarity > 0.80 && pitch >= 65 && pitch <= 1200 && energy > 0.02) {
      const noteName = freqToNoteName(pitch);
      if (noteName) {
        frameData.push({ time, pitch, noteName, clarity, energy });
      } else {
        frameData.push({ time, pitch: 0, noteName: null, clarity: 0, energy });
      }
    } else {
      frameData.push({ time, pitch: 0, noteName: null, clarity: 0, energy });
    }
  }

  // Segment frames into discrete note events
  const rawNotes = [];
  let currentNote = null;

  for (let i = 0; i < frameData.length; i++) {
    const f = frameData[i];

    if (f.noteName) {
      if (!currentNote) {
        currentNote = {
          pitch: f.noteName,
          start: f.time,
          end: f.time + hopSize / sampleRate,
          energies: [f.energy],
        };
      } else if (currentNote.pitch === f.noteName) {
        currentNote.end = f.time + hopSize / sampleRate;
        currentNote.energies.push(f.energy);
      } else {
        // Pitch changed
        const dur = currentNote.end - currentNote.start;
        if (dur >= 0.08) {
          const avgEnergy = currentNote.energies.reduce((a, b) => a + b, 0) / currentNote.energies.length;
          rawNotes.push({
            pitch: currentNote.pitch,
            start: currentNote.start,
            dur,
            vel: Math.min(1.0, Math.max(0.4, avgEnergy * 4)),
          });
        }
        currentNote = {
          pitch: f.noteName,
          start: f.time,
          end: f.time + hopSize / sampleRate,
          energies: [f.energy],
        };
      }
    } else {
      if (currentNote) {
        const dur = currentNote.end - currentNote.start;
        if (dur >= 0.08) {
          const avgEnergy = currentNote.energies.reduce((a, b) => a + b, 0) / currentNote.energies.length;
          rawNotes.push({
            pitch: currentNote.pitch,
            start: currentNote.start,
            dur,
            vel: Math.min(1.0, Math.max(0.4, avgEnergy * 4)),
          });
        }
        currentNote = null;
      }
    }
  }

  if (currentNote) {
    const dur = currentNote.end - currentNote.start;
    if (dur >= 0.08) {
      const avgEnergy = currentNote.energies.reduce((a, b) => a + b, 0) / currentNote.energies.length;
      rawNotes.push({
        pitch: currentNote.pitch,
        start: currentNote.start,
        dur,
        vel: Math.min(1.0, Math.max(0.4, avgEnergy * 4)),
      });
    }
  }

  // Estimate tempo from onset deltas
  let estimatedBpm = 100;
  if (rawNotes.length >= 2) {
    const intervals = [];
    for (let i = 1; i < rawNotes.length; i++) {
      const delta = rawNotes[i].start - rawNotes[i - 1].start;
      if (delta > 0.15 && delta < 2.0) {
        intervals.push(delta);
      }
    }

    if (intervals.length > 0) {
      intervals.sort((a, b) => a - b);
      const medianInterval = intervals[Math.floor(intervals.length / 2)];
      let bpm = 60 / medianInterval;
      // Normalize to 70-150 range
      while (bpm < 70) bpm *= 2;
      while (bpm > 150) bpm /= 2;
      estimatedBpm = Math.round(bpm);
    }
  }

  // Convert notes from seconds to beat units and snap to 16th grid (0.25 beats)
  const beatSec = 60 / estimatedBpm;
  const convertedNotes = rawNotes.map(n => {
    let startBeat = n.start / beatSec;
    let durBeat = n.dur / beatSec;

    // Snap to 16th (0.25 beat)
    startBeat = Math.round(startBeat * 4) / 4;
    durBeat = Math.max(0.25, Math.round(durBeat * 4) / 4);

    return {
      pitch: n.pitch,
      start: Number(startBeat.toFixed(2)),
      dur: Number(durBeat.toFixed(2)),
      vel: Number(n.vel.toFixed(2)),
    };
  });

  return {
    notes: convertedNotes,
    tempo: estimatedBpm,
    key: convertedNotes.length > 0 ? `${convertedNotes[0].pitch.replace(/[0-9]/g, '')} minor` : 'C major',
  };
}
