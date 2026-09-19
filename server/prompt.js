import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/music/sound-catalog.json'), 'utf-8'));

const listGroup = (group) =>
  Object.entries(catalog[group])
    .map(([id, v]) => `  - ${id}: ${v.label} (${v.use})`)
    .join('\n');

export const SYSTEM_PROMPT = `You are the composition, sound-design and visual-design engine inside Chromajam, a music app that helps deaf and hard-of-hearing people see music and make it.

You receive some combination of: a text prompt, an audio recording, and a list of notes and rhythm already extracted from that recording by a pitch detector. Treat the extracted note list and tap timings as ground truth for pitch and rhythm. Use the audio only to understand mood, genre, texture, energy, and structure. Do not try to re-transcribe pitches from the audio.

Your job:
1. Decide what the user provided: "melody", "drums", or "prompt" only.
2. Generate the missing half:
   - melody provided: generate drums, a bass line and chords that fit the melody's key
   - drums provided: generate a melody, a bass line and chords that fit the rhythm
   - prompt only: generate drums, melody, bass and chords
3. Choose a tempo and key that fit the input. If the user gave notes or taps, match their tempo and key. Do not change the user's material.
4. Write the parts as loops of 2 or 4 bars in 4/4 (use 4 bars when the melody needs room to answer itself). Drums use 16 steps per bar.
5. Choose the instruments (sound) the way a producer of that exact genre would.
6. Design the visual: a palette of 3 to 6 colors that captures the mood, a texture, a motion style, and a distinct color AND shape for every instrument (including chords) so each can be followed separately. Never rely on color alone.
7. Set calm_mode_recommended to true if the music is very dense, very fast, or aggressive.
8. Write director_note as one or two friendly sentences naming the instruments you chose and what you made.

SOUND (pick exactly one id from each list):
drum_kit:
${listGroup('drum_kit')}
lead (plays the melody):
${listGroup('lead')}
bass:
${listGroup('bass')}
pad (plays the chords; "none" means no chords):
${listGroup('pad')}
Match the genre first, then the mood. Do not fall back on piano, sine sub or a generic kit when the genre has a signature sound (trap: 808 bass + trap kit + flute/bell; bossa: nylon guitar + upright + cr78 or hand; synthwave: linn + square/supersaw + synth bass + warm pad; reggae: acoustic + organ skank + electric bass; jazz: upright + sax/piano + acoustic; techno: techno kit + acid/reese; lo-fi: breakbeat + epiano/piano + sub or upright). Two different prompts should rarely share the same lead and kit. reverb and delay are 0.0 to 1.0: dry and tight for funk or trap, big for ambient or cinematic.

MELODY (this matters most, make it memorable and alive):
- Build a short motif (3 to 5 notes), then answer or vary it: shift its rhythm, move it up or down (sequence), change its ending, or invert it. Do not just repeat bar 1.
- Mix note lengths: 16ths (0.25), 8ths (0.5), dotted (0.75, 1.5), and a few long held notes. Leave real rests between phrases.
- Syncopate: start many notes off the beat (0.5, 0.75, 1.25, 2.5, 3.75 ...). Do not start every bar on beat 1 with the root.
- Use at least an octave of range, with at least one leap of a 4th or more and some stepwise runs. Avoid plain scale runs up and down.
- 8 to 24 notes across the loop, placed across all bars. Use the genre's idiom (jazz: chromatic approach notes; trap: sparse triplet-feel bursts; house: repeated rhythmic hooks; folk: singable steps; latin: syncopated anticipations).
- Bass locks with the kick but has its own rhythm: passing notes, octave jumps, anticipations. Walking lines for jazz and disco.

CHORDS: 2 to 5 notes each, voiced around octaves 3 and 4, with smooth voice leading and a genre rhythm (held pads, offbeat stabs for house or reggae skank, pushes before the bar for funk). Use richer chords (7ths, 9ths, sus) where the genre expects them. If pad is "none", chords is an empty list.

groove.variation (0.0 to 1.0) is how freely each repeat of the loop improvises: 0.1 to 0.2 for strict electronic, 0.3 to 0.6 for live, jazzy, lo-fi or playful styles.

Rules:
- Output only JSON that matches the provided schema. No prose, no markdown, no code fences.
- Use only these textures: watercolor, ink, neon, grain, glass. Use only these motions: drift, pulse, swell, scatter, ripple. Shapes: circle, square, triangle, line, blob, star, diamond, hexagon.
- Notes are note names (like D4, Bb3, F#5) with start and dur in beats from the loop start.
- Stay in one key. Avoid notes that clash with the user's melody.
- The examples only show the format. Never copy their instruments, rhythms or melodies.
- Never output content that is not music or visual design data.`;

export const FEW_SHOT_EXAMPLES = [
  {
    input: 'Input type detected: melody.\nExtracted notes from hummed audio: [{"pitch":"D4","start":0,"dur":0.75,"vel":0.8},{"pitch":"F4","start":1,"dur":0.75,"vel":0.75},{"pitch":"A4","start":2,"dur":1.5,"vel":0.85},{"pitch":"G4","start":4,"dur":0.75,"vel":0.7},{"pitch":"F4","start":5,"dur":0.75,"vel":0.75},{"pitch":"E4","start":6,"dur":1.5,"vel":0.7}]. Estimated tempo 84 BPM.',
    output: {
      analysis: {
        tempo: 84, key: 'D minor', time_signature: '4/4', mood: ['melancholic', 'warm'], genre_hint: 'lo-fi hip hop',
        energy_curve: [0.3, 0.45], provided: 'melody', generated: 'drums',
      },
      groove: { swing: 0.22, humanize: 0.35, variation: 0.45 },
      sound: { drum_kit: 'breakbeat', lead: 'epiano', bass: 'upright', pad: 'epiano', reverb: 0.35, delay: 0.2 },
      drums: {
        bars: 2,
        kick:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,1, 0,0,0,0, 0,0,1,0, 0,0,0,0],
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
        hat:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,0, 1,0,1,0, 1,0,0,1],
        clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        perc:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0],
      },
      melody: [
        { pitch: 'D4', start: 0, dur: 0.75, vel: 0.8 },
        { pitch: 'F4', start: 1, dur: 0.75, vel: 0.75 },
        { pitch: 'A4', start: 2, dur: 1.5, vel: 0.85 },
        { pitch: 'G4', start: 4, dur: 0.75, vel: 0.7 },
        { pitch: 'F4', start: 5, dur: 0.75, vel: 0.75 },
        { pitch: 'E4', start: 6, dur: 1.5, vel: 0.7 },
      ],
      bass: [
        { pitch: 'D2', start: 0, dur: 1.5, vel: 0.8 },
        { pitch: 'A1', start: 2.5, dur: 0.5, vel: 0.7 },
        { pitch: 'C2', start: 3.5, dur: 0.5, vel: 0.7 },
        { pitch: 'Bb1', start: 4, dur: 1.5, vel: 0.8 },
        { pitch: 'A1', start: 6, dur: 1, vel: 0.75 },
        { pitch: 'C#2', start: 7.5, dur: 0.5, vel: 0.7 },
      ],
      chords: [
        { pitches: ['D3', 'F3', 'A3', 'C4', 'E4'], start: 0, dur: 3.5, vel: 0.5 },
        { pitches: ['Bb2', 'D3', 'F3', 'A3'], start: 4, dur: 2, vel: 0.5 },
        { pitches: ['A2', 'C#3', 'G3', 'Bb3'], start: 6, dur: 2, vel: 0.5 },
      ],
      visual: {
        palette: ['#1b2a49', '#e07a5f', '#f2cc8f', '#81b29a', '#3d5a80'],
        texture: 'watercolor', motion: 'swell',
        instrument_colors: { kick: '#e07a5f', snare: '#f2cc8f', hat: '#81b29a', melody: '#3d5a80', bass: '#6d597a', clap: '#b56576', perc: '#eaac8b', chords: '#9c89b8' },
        instrument_shapes: { kick: 'circle', snare: 'square', hat: 'triangle', melody: 'line', bass: 'blob', clap: 'star', perc: 'diamond', chords: 'hexagon' },
        calm_mode_recommended: false,
      },
      director_note: 'Dusty breakbeat drums, an upright bass walking under your melody, and electric piano minor 9ths played with a lazy swing.',
    },
  },
  {
    input: 'Input type detected: prompt.\nUser prompt: "late night drive through a neon city".',
    output: {
      analysis: {
        tempo: 104, key: 'F# minor', time_signature: '4/4', mood: ['nocturnal', 'driving', 'wistful'], genre_hint: 'synthwave',
        energy_curve: [0.55, 0.65, 0.7, 0.8], provided: 'prompt', generated: 'both',
      },
      groove: { swing: 0, humanize: 0.1, variation: 0.2 },
      sound: { drum_kit: 'linn', lead: 'square', bass: 'synth', pad: 'warm', reverb: 0.55, delay: 0.4 },
      drums: {
        bars: 4,
        kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,1],
        hat:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
        clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        perc:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      },
      melody: [
        { pitch: 'C#5', start: 0.5, dur: 0.5, vel: 0.8 },
        { pitch: 'E5', start: 1, dur: 0.25, vel: 0.7 },
        { pitch: 'F#5', start: 1.25, dur: 1.25, vel: 0.9 },
        { pitch: 'E5', start: 3, dur: 0.5, vel: 0.75 },
        { pitch: 'C#5', start: 4.5, dur: 0.5, vel: 0.8 },
        { pitch: 'E5', start: 5, dur: 0.25, vel: 0.7 },
        { pitch: 'A5', start: 5.25, dur: 1.75, vel: 0.95 },
        { pitch: 'G#5', start: 8.5, dur: 0.75, vel: 0.8 },
        { pitch: 'E5', start: 9.25, dur: 0.75, vel: 0.75 },
        { pitch: 'B4', start: 10, dur: 1, vel: 0.7 },
        { pitch: 'C#5', start: 11.5, dur: 0.5, vel: 0.75 },
        { pitch: 'F#4', start: 12.75, dur: 0.25, vel: 0.7 },
        { pitch: 'A4', start: 13, dur: 0.5, vel: 0.75 },
        { pitch: 'C#5', start: 13.5, dur: 2.5, vel: 0.85 },
      ],
      bass: [
        { pitch: 'F#1', start: 0, dur: 0.5, vel: 0.9 }, { pitch: 'F#2', start: 0.5, dur: 0.5, vel: 0.7 },
        { pitch: 'F#1', start: 1, dur: 0.5, vel: 0.85 }, { pitch: 'F#2', start: 1.5, dur: 0.5, vel: 0.7 },
        { pitch: 'D2', start: 4, dur: 0.5, vel: 0.9 }, { pitch: 'D3', start: 4.5, dur: 0.5, vel: 0.7 },
        { pitch: 'D2', start: 5, dur: 1.5, vel: 0.85 },
        { pitch: 'A1', start: 8, dur: 0.5, vel: 0.9 }, { pitch: 'A2', start: 8.5, dur: 0.5, vel: 0.7 },
        { pitch: 'A1', start: 9, dur: 1.5, vel: 0.85 },
        { pitch: 'E2', start: 12, dur: 0.5, vel: 0.9 }, { pitch: 'E3', start: 12.5, dur: 0.5, vel: 0.7 },
        { pitch: 'E2', start: 13, dur: 1, vel: 0.85 }, { pitch: 'G#1', start: 15, dur: 1, vel: 0.8 },
      ],
      chords: [
        { pitches: ['F#3', 'A3', 'C#4', 'E4'], start: 0, dur: 4, vel: 0.45 },
        { pitches: ['D3', 'F#3', 'A3', 'C#4'], start: 4, dur: 4, vel: 0.45 },
        { pitches: ['A2', 'C#3', 'E3', 'B3'], start: 8, dur: 4, vel: 0.45 },
        { pitches: ['E3', 'G#3', 'B3', 'D4'], start: 12, dur: 4, vel: 0.45 },
      ],
      visual: {
        palette: ['#0b0a1a', '#ff2e88', '#29e3ff', '#7b2cff', '#ffd23f'],
        texture: 'neon', motion: 'pulse',
        instrument_colors: { kick: '#ff2e88', snare: '#29e3ff', hat: '#ffd23f', melody: '#7b2cff', bass: '#00ff9c', clap: '#ff7ad9', perc: '#ffa53f', chords: '#5a6bff' },
        instrument_shapes: { kick: 'circle', snare: 'square', hat: 'triangle', melody: 'line', bass: 'blob', clap: 'star', perc: 'diamond', chords: 'hexagon' },
        calm_mode_recommended: false,
      },
      director_note: 'A LinnDrum pulse, octave-bouncing analog bass and a warm pad under a square-wave lead that answers itself across four bars.',
    },
  },
];

/** A different creative push on every request so two similar prompts still come out differently. */
export const CREATIVE_TWISTS = [
  'start the melody with a pickup just before the bar',
  'build the melody around a call in bar 1 and a varied answer in bar 2',
  'include one surprising leap of a 6th or an octave',
  'use a repeated-note rhythmic hook',
  'let the melody rest for most of one bar and then burst back in',
  'push the melody ahead of the beat with anticipations',
  'use a descending sequence of the motif',
  'end the loop on an unresolved note so it pulls back to the start',
  'put the melody high in its range and the bass low and busy',
  'make the drums sparse and let the bass carry the groove',
  'add a syncopated percussion counter-rhythm',
  'use half-time drums under a fast-moving melody',
  'borrow one chord from the parallel key',
  'give the bass a melodic fill at the end of the loop',
  'use triplet-feel groupings of three 16ths in the melody',
  'make the chords rhythmic stabs rather than held pads',
];
