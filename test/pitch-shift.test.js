import test from 'node:test';
import assert from 'node:assert/strict';
import { noteToMidi, pitchDifference, pitchRatio } from '../src/music/pitch-shift.js';
import catalog from '../src/music/sound-catalog.json' with { type: 'json' };

test('calculates pitch shifts from note names and equal temperament ratios', () => {
  const requests = [
    ['C4', 0, 1],
    ['C#4', 1, 2 ** (1 / 12)],
    ['F4', 5, 2 ** (5 / 12)],
    ['C5', 12, 2],
    ['C3', -12, 0.5],
  ];

  for (const [target, semitones, ratio] of requests) {
    assert.equal(pitchDifference('C4', target), semitones);
    assert.ok(Math.abs(pitchRatio(semitones) - ratio) < 1e-12);
  }
});

test('accepts flats and rejects malformed or out-of-range notes', () => {
  assert.equal(noteToMidi('Db4'), noteToMidi('C#4'));
  assert.throws(() => noteToMidi('H4'), /Invalid note name/);
  assert.throws(() => noteToMidi('C-2'), /outside the MIDI range/);
});

test('each melodic sample has one designated root file', () => {
  for (const [name, spec] of Object.entries(catalog.samples)) {
    assert.equal(spec.notes.length, 1, `${name} should reference one source file`);
    assert.equal(spec.root, spec.notes[0], `${name} root should match its source file`);
  }
});