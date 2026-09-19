import { Midi } from '@tonejs/midi';

/**
 * Builds a multi-track MIDI file with drum channel 10, melody track, bass track,
 * and triggers a browser download.
 */
export function exportMidiFile(songData, filename = 'chromajam.mid') {
  if (!songData) return;

  const midi = new Midi();
  const bpm = songData.analysis?.tempo || 100;
  midi.header.setTempo(bpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [4, 4],
  });

  const beatSec = 60 / bpm;
  const sixteenthSec = beatSec / 4;
  const bars = songData.drums?.bars || 2;
  const totalSteps = bars * 16;

  // 1. Drum Track (General MIDI channel 10 is 0-indexed as 9)
  const drumTrack = midi.addTrack();
  drumTrack.name = `Drums (${songData.analysis?.genre_hint || 'Beat'})`;
  drumTrack.channel = 9;

  const drumMap = {
    kick: 36,
    snare: 38,
    hat: 42,
    clap: 39,
    perc: 45,
  };

  for (const [lane, midiPitch] of Object.entries(drumMap)) {
    const pattern = songData.drums?.[lane] || [];
    for (let step = 0; step < totalSteps; step++) {
      if (pattern[step] === 1) {
        drumTrack.addNote({
          midi: midiPitch,
          time: step * sixteenthSec,
          duration: sixteenthSec * 0.8,
          velocity: 0.85,
        });
      }
    }
  }

  // 2. Melody Track
  if (songData.melody && songData.melody.length > 0) {
    const melodyTrack = midi.addTrack();
    melodyTrack.name = `Melody - Key: ${songData.analysis?.key || 'C major'}`;
    melodyTrack.channel = 0;

    for (const note of songData.melody) {
      melodyTrack.addNote({
        name: note.pitch,
        time: note.start * beatSec,
        duration: note.dur * beatSec,
        velocity: note.vel || 0.8,
      });
    }
  }

  // 3. Bass Track
  if (songData.bass && songData.bass.length > 0) {
    const bassTrack = midi.addTrack();
    bassTrack.name = `Bass - Key: ${songData.analysis?.key || 'C major'}`;
    bassTrack.channel = 1;

    for (const note of songData.bass) {
      bassTrack.addNote({
        name: note.pitch,
        time: note.start * beatSec,
        duration: note.dur * beatSec,
        velocity: note.vel || 0.85,
      });
    }
  }

  // Trigger file download
  const arrayBuffer = midi.toArray();
  const blob = new Blob([arrayBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
