/**
 * One fixed vertical order for instruments, shared by the painting, the score
 * and the legend: melody on top, bass at the bottom, drums in between.
 */
export const LANES = [
  { id: 'melody', label: 'Melody', top: 0.1, bottom: 0.3, pitched: true, band: 'mid' },
  { id: 'chords', label: 'Chords', top: 0.31, bottom: 0.41, pitched: true, band: 'mid' },
  { id: 'hat', label: 'Hi-hat', top: 0.42, bottom: 0.48, band: 'high' },
  { id: 'perc', label: 'Perc', top: 0.48, bottom: 0.54, band: 'high' },
  { id: 'clap', label: 'Clap', top: 0.54, bottom: 0.6, band: 'mid' },
  { id: 'snare', label: 'Snare', top: 0.6, bottom: 0.68, band: 'mid' },
  { id: 'kick', label: 'Kick', top: 0.68, bottom: 0.79, band: 'low' },
  { id: 'bass', label: 'Bass', top: 0.8, bottom: 0.95, pitched: true, band: 'low' },
];

export const LANE_BY_ID = Object.fromEntries(LANES.map((l) => [l.id, l]));
export const DRUM_LANES = ['kick', 'snare', 'hat', 'clap', 'perc'];

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function pitchToMidi(pitch) {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(pitch || '').trim());
  if (!m) return 60;
  let n = NOTE_INDEX[m[1].toUpperCase()];
  if (m[2] === '#') n += 1;
  if (m[2] === 'b') n -= 1;
  return (parseInt(m[3], 10) + 1) * 12 + n;
}

/** Min/max MIDI pitch of a part, padded so a single note sits mid-lane. */
export function pitchRange(notes = []) {
  if (!notes.length) return { lo: 48, hi: 72 };
  const midis = notes.map((n) => pitchToMidi(n.pitch));
  let lo = Math.min(...midis);
  let hi = Math.max(...midis);
  if (hi - lo < 6) {
    const mid = (hi + lo) / 2;
    lo = mid - 3;
    hi = mid + 3;
  }
  return { lo, hi };
}

/** 0 (bottom of lane) .. 1 (top of lane) */
export function pitchFraction(pitch, range) {
  return (pitchToMidi(pitch) - range.lo) / Math.max(1, range.hi - range.lo);
}

/** Count what a part plays so empty lanes can be drawn as rests. */
export function laneActivity(song) {
  const counts = {};
  for (const id of DRUM_LANES) {
    counts[id] = (song?.drums?.[id] || []).filter((v) => v === 1).length;
  }
  counts.melody = (song?.melody || []).length;
  counts.bass = (song?.bass || []).length;
  counts.chords = (song?.chords || []).length;
  return counts;
}

/** Notes of a pitched lane; chords are spread into one note per chord tone. */
export function partNotes(song, id) {
  if (id === 'chords') {
    return (song?.chords || []).flatMap((c) => (c.pitches || []).map((pitch) => ({ pitch, start: c.start, dur: c.dur, vel: c.vel })));
  }
  return song?.[id] || [];
}
