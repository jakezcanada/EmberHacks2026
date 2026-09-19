export const SYSTEM_PROMPT = `You are the composition and visual-design engine inside Chromajam, a music app that helps deaf and hard-of-hearing people see music and make it.

You receive some combination of: a text prompt, an audio recording, and a list of notes and rhythm already extracted from that recording by a pitch detector. Treat the extracted note list and tap timings as ground truth for pitch and rhythm. Use the audio only to understand mood, genre, texture, energy, and structure. Do not try to re-transcribe pitches from the audio.

Your job:
1. Decide what the user provided: "melody", "drums", or "prompt" only.
2. Generate the missing half:
   - melody provided: generate drums (and a simple bass line that fits the melody's key)
   - drums provided: generate a melody and a bass line that fit the rhythm
   - prompt only: generate drums, melody, and bass
3. Choose a tempo and key that fit the input. If the user gave notes or taps, match their tempo and key. Do not change the user's material.
4. Write the parts as loops of 1 to 4 bars in 4/4. Keep patterns musical and not too busy: leave space. Drums use 16 steps per bar.
5. Design the visual: a palette of 3 to 6 colors that captures the mood, a texture, a motion style, and a distinct color AND shape for every instrument so each can be followed separately. Never rely on color alone to distinguish instruments.
6. Set calm_mode_recommended to true if the music is very dense, very fast, or aggressive.
7. Write director_note as one or two friendly sentences explaining what you made.

Rules:
- Output only JSON that matches the provided schema. No prose, no markdown, no code fences.
- Use only these textures: watercolor, ink, neon, grain, glass. Use only these motions: drift, pulse, swell, scatter, ripple.
- Notes are note names (like D4) with start and dur in beats from the loop start.
- Stay in one key. Prefer notes from the scale. Avoid notes that clash with the user's melody.
- Never output content that is not music or visual design data.`;

export const FEW_SHOT_EXAMPLES = [
  {
    input: "User hummed a gentle melody: extracted notes = [{\"pitch\": \"D4\", \"start\": 0, \"dur\": 0.75, \"vel\": 0.8}, {\"pitch\": \"F4\", \"start\": 1, \"dur\": 0.75, \"vel\": 0.75}, {\"pitch\": \"A4\", \"start\": 2, \"dur\": 1.5, \"vel\": 0.85}, {\"pitch\": \"G4\", \"start\": 4, \"dur\": 0.75, \"vel\": 0.7}, {\"pitch\": \"F4\", \"start\": 5, \"dur\": 0.75, \"vel\": 0.75}, {\"pitch\": \"E4\", \"start\": 6, \"dur\": 1.5, \"vel\": 0.7}]. Estimated tempo: 84 BPM. Key: D minor.",
    output: {
      analysis: {
        tempo: 84,
        key: "D minor",
        time_signature: "4/4",
        mood: ["melancholic", "reflective"],
        genre_hint: "lo-fi hip hop",
        energy_curve: [0.2, 0.35, 0.6, 0.45],
        provided: "melody",
        generated: "drums"
      },
      groove: { swing: 0.2, humanize: 0.3 },
      drums: {
        bars: 2,
        kick:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,1,0,0, 1,0,0,0, 0,0,0,0, 0,1,0,0, 0,0,1,0],
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,0],
        clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        perc:  [0,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0]
      },
      melody: [
        { pitch: "D4", start: 0, dur: 0.75, vel: 0.8 },
        { pitch: "F4", start: 1, dur: 0.75, vel: 0.75 },
        { pitch: "A4", start: 2, dur: 1.5, vel: 0.85 },
        { pitch: "G4", start: 4, dur: 0.75, vel: 0.7 },
        { pitch: "F4", start: 5, dur: 0.75, vel: 0.75 },
        { pitch: "E4", start: 6, dur: 1.5, vel: 0.7 }
      ],
      bass: [
        { pitch: "D2", start: 0, dur: 3.5, vel: 0.75 },
        { pitch: "G2", start: 4, dur: 1.5, vel: 0.7 },
        { pitch: "A2", start: 6, dur: 1.5, vel: 0.7 }
      ],
      visual: {
        palette: ["#1b2a49", "#e07a5f", "#f2cc8f", "#81b29a", "#3d5a80"],
        texture: "watercolor",
        motion: "swell",
        instrument_colors: {
          kick: "#e07a5f",
          snare: "#f2cc8f",
          hat: "#81b29a",
          melody: "#3d5a80",
          bass: "#6d597a",
          clap: "#b56576",
          perc: "#eaac8b"
        },
        instrument_shapes: {
          kick: "circle",
          snare: "square",
          hat: "triangle",
          melody: "line",
          bass: "blob",
          clap: "star",
          perc: "diamond"
        },
        calm_mode_recommended: false
      },
      director_note: "Created a laid-back boom-bap rhythm and supportive root bass line to frame your hummed melody."
    }
  },
  {
    input: "User prompt: 'late night cyberpunk city ride in the rain, neon reflections, driving synth rhythm'",
    output: {
      analysis: {
        tempo: 120,
        key: "C minor",
        time_signature: "4/4",
        mood: ["futuristic", "driving", "nocturnal"],
        genre_hint: "synthwave",
        energy_curve: [0.6, 0.75, 0.85, 0.8],
        provided: "prompt",
        generated: "both"
      },
      groove: { swing: 0.05, humanize: 0.15 },
      drums: {
        bars: 2,
        kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        hat:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
        clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        perc:  [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,1,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0, 0,1,0,0]
      },
      melody: [
        { pitch: "C5", start: 0, dur: 0.5, vel: 0.85 },
        { pitch: "D#5", start: 0.75, dur: 0.5, vel: 0.8 },
        { pitch: "G5", start: 1.5, dur: 1.0, vel: 0.9 },
        { pitch: "F5", start: 3, dur: 0.75, vel: 0.8 },
        { pitch: "D#5", start: 4, dur: 0.5, vel: 0.85 },
        { pitch: "D5", start: 5, dur: 0.75, vel: 0.8 },
        { pitch: "C5", start: 6, dur: 1.5, vel: 0.9 }
      ],
      bass: [
        { pitch: "C2", start: 0, dur: 0.75, vel: 0.9 },
        { pitch: "C2", start: 1, dur: 0.75, vel: 0.85 },
        { pitch: "G#1", start: 2, dur: 0.75, vel: 0.9 },
        { pitch: "A#1", start: 3, dur: 0.75, vel: 0.85 },
        { pitch: "C2", start: 4, dur: 0.75, vel: 0.9 },
        { pitch: "C2", start: 5, dur: 0.75, vel: 0.85 },
        { pitch: "G#1", start: 6, dur: 0.75, vel: 0.9 },
        { pitch: "A#1", start: 7, dur: 0.75, vel: 0.85 }
      ],
      visual: {
        palette: ["#090a0f", "#00f0ff", "#ff007f", "#7928ca", "#ffe600"],
        texture: "neon",
        motion: "pulse",
        instrument_colors: {
          kick: "#ff007f",
          snare: "#00f0ff",
          hat: "#ffe600",
          melody: "#7928ca",
          bass: "#00ff88",
          clap: "#ff66cc",
          perc: "#ffaa00"
        },
        instrument_shapes: {
          kick: "circle",
          snare: "square",
          hat: "triangle",
          melody: "line",
          bass: "blob",
          clap: "star",
          perc: "diamond"
        },
        calm_mode_recommended: false
      },
      director_note: "A pulsating 4-on-the-floor synthwave loop featuring arpeggiated bass, gated reverb snares, and vivid neon aesthetics."
    }
  }
];
