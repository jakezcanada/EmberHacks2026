/**
 * Applies swing and humanization jitter to step timing and velocity.
 */
export function calculateStepTiming(stepIndex, bpm, groove = { swing: 0, humanize: 0 }) {
  // Duration of one 16th note in seconds
  const sixteenthSec = 60 / bpm / 4;
  let timingOffset = 0;

  // Swing delays every 2nd 16th note (odd indices)
  if (stepIndex % 2 === 1) {
    timingOffset += (groove.swing || 0) * sixteenthSec * 0.4;
  }

  // Humanize timing jitter
  if (groove.humanize > 0) {
    const jitter = (Math.random() - 0.5) * (groove.humanize * 0.025);
    timingOffset += jitter;
  }

  // Humanize velocity multiplier
  let velMultiplier = 1.0;
  if (groove.humanize > 0) {
    velMultiplier += (Math.random() - 0.5) * (groove.humanize * 0.25);
    velMultiplier = Math.max(0.4, Math.min(1.2, velMultiplier));
  }

  return { timingOffset, velMultiplier };
}

export function humanizeNote(note, bpm, groove = { swing: 0, humanize: 0 }) {
  let startOffset = 0;
  let vel = note.vel || 0.8;

  if (groove.humanize > 0) {
    startOffset = (Math.random() - 0.5) * (groove.humanize * 0.02);
    vel *= (1 + (Math.random() - 0.5) * (groove.humanize * 0.2));
    vel = Math.max(0.2, Math.min(1.0, vel));
  }

  return {
    ...note,
    start: Math.max(0, note.start + startOffset),
    vel,
  };
}
