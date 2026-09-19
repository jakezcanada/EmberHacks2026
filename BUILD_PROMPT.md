# BUILD_PROMPT.md: Chromajam

Paste this whole file into your AI coding agent (for example Google Antigravity) as the task brief. It is written to be self-contained.

---

## 0. How to work

You are building a hackathon project with a hard time limit of about 4 hours. Follow these rules:

- **Make decisions, do not ask questions.** If something is ambiguous, pick the simplest reasonable option and record it in `DECISIONS.md` (one line per decision).
- **Work in large, complete steps.** Agent quota is limited. Prefer one thorough change per phase over many tiny edits. Do not rewrite files that already work.
- **Build in the phases below, in order.** Finish each phase's acceptance criteria before starting the next. Every phase must leave the app runnable.
- **Do not add features that are not listed.** If time is short, use the cut list in section 9.
- **Keep secrets server-side.** The Gemini API key must never reach the browser.
- **Write plain, readable code.** Small modules, clear names, brief comments only where the reason is not obvious.

## 1. Product

**Chromajam** is a web app that acts as a jam partner you can see.

The user provides one of: a text prompt, a hummed melody, a tapped rhythm, or an uploaded audio clip. The app works out which musical half is missing and generates it (drums if a melody was provided, a melody and bass if drums were provided, everything if only a text prompt was provided). It plays the result, offers a `.mid` download, and paints the music as a real-time visual designed so that a deaf or hard-of-hearing person can follow the song visually.

The theme of the hackathon is **Google Gemini as an I/O module**. Gemini reads messy real-world input and returns structured JSON that the app renders. Make this visible in the UI with a debug panel showing what Gemini received and returned.

## 2. Architecture

Two layers. Do not blur them.

| Layer | Runs on | Job |
|---|---|---|
| Semantic | Gemini, via a server proxy, seconds of latency | Understand vibe, decide what to generate, output the part plus a visual plan |
| Real-time | Web Audio and canvas in the browser, milliseconds | Animate visuals in sync with playback |

Never wait on Gemini per animation frame. Gemini sets the look of the song. Audio events and FFT make it move.

Visual events for discrete hits (kick, snare, notes) must be triggered from the same scheduled Tone.js events that play the sound, using `Tone.Draw` or equivalent, so sight and sound stay in sync. Use `AnalyserNode` FFT only for continuous energy (low, mid, high bands).

## 3. Tech stack (fixed)

- Node.js 20+, Express server (`server/`), ES modules
- Vite with **vanilla JavaScript** client (`src/`), no framework
- `@google/genai` on the server
- `tone` for synthesis and scheduling
- `@tonejs/midi` for `.mid` export
- `pitchy` for pitch detection (or a small autocorrelation fallback if it fails to install)
- Canvas 2D for visuals
- `zod` for server-side validation
- `concurrently` to run client and server with one `npm run dev`

Environment variables in `.env` (also create `.env.example`): `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-flash-latest`), `PORT` (default `3001`), `MAX_AUDIO_SECONDS` (default `15`), `USE_FALLBACK_ONLY` (default `false`).

## 4. File structure

Create exactly this layout:

```
chromajam/
├─ README.md              (already written; do not overwrite)
├─ DECISIONS.md
├─ .env.example
├─ .gitignore             (must ignore .env and node_modules)
├─ package.json
├─ vite.config.js         (proxy /api to the Express port)
├─ index.html
├─ server/
│  ├─ index.js
│  ├─ gemini.js
│  ├─ prompt.js
│  └─ schema.js
└─ src/
   ├─ main.js
   ├─ styles.css
   ├─ input/   record.js, wav.js, pitch.js, taps.js
   ├─ api/     client.js
   ├─ music/   engine.js, humanize.js, midi.js
   ├─ visuals/ renderer.js, palettes.js, safety.js, styles/{watercolor,ink,neon,grain,glass}.js
   ├─ a11y/    haptics.js, settings.js
   ├─ ui/      controls.js, debugPanel.js
   └─ fallback/presets.json
```

## 5. Data contract

The server asks Gemini for JSON using `responseMimeType: "application/json"` and a `responseSchema`, then validates with zod and repairs. The client only ever sees validated data.

```json
{
  "analysis": {
    "tempo": 92,
    "key": "D minor",
    "time_signature": "4/4",
    "mood": ["melancholic", "hopeful"],
    "genre_hint": "lo-fi hip hop",
    "energy_curve": [0.2, 0.4, 0.7, 0.5],
    "provided": "melody",
    "generated": "drums"
  },
  "groove": { "swing": 0.15, "humanize": 0.3 },
  "drums": {
    "bars": 2,
    "kick": [], "snare": [], "hat": [], "clap": [], "perc": []
  },
  "melody": [{ "pitch": "D4", "start": 0, "dur": 0.5, "vel": 0.8 }],
  "bass":   [{ "pitch": "D2", "start": 0, "dur": 1.0, "vel": 0.7 }],
  "visual": {
    "palette": ["#1b2a49", "#e07a5f", "#f2cc8f", "#81b29a"],
    "texture": "watercolor",
    "motion": "swell",
    "instrument_colors": { "kick": "#e07a5f", "snare": "#f2cc8f", "hat": "#81b29a", "melody": "#3d5a80", "bass": "#6d597a", "clap": "#b56576", "perc": "#eaac8b" },
    "instrument_shapes": { "kick": "circle", "snare": "square", "hat": "triangle", "melody": "line", "bass": "blob", "clap": "star", "perc": "diamond" },
    "calm_mode_recommended": false
  },
  "director_note": "One or two sentences describing what was generated and why."
}
```

Rules that `schema.js` must enforce and repair:

- `analysis.tempo`: integer 60 to 180. Clamp.
- `analysis.provided` and `analysis.generated`: each one of `"drums"`, `"melody"`, `"both"`, `"none"`, `"prompt"`. They must never be equal to each other unless both are `"none"`.
- `drums.bars`: integer 1 to 4. Each provided drum lane must have length `16 * bars`, values 0 or 1. If a lane has the wrong length, pad with 0 or truncate. Missing lanes become all zeros.
- Notes: `pitch` is a note name like `C4` (octave 1 to 6), `start` and `dur` are beats from loop start, `vel` is 0 to 1. Drop malformed notes rather than failing. Notes must not extend past `bars * 4` beats. Clamp `dur`.
- `visual.texture` in `watercolor | ink | neon | grain | glass`. `visual.motion` in `drift | pulse | swell | scatter | ripple`. Invalid values fall back to `watercolor` and `drift`.
- `visual.palette`: 3 to 6 valid hex colors. Every instrument must have a color and a shape. Fill any missing ones from defaults.
- If the whole response cannot be repaired, return a preset from the fallback file and flag `"fallback": true`.

General MIDI drum mapping on channel 10: kick 36, snare 38, closed hat 42, clap 39, perc 45.

## 6. Gemini system prompt (used at runtime in `server/prompt.js`)

Use this as the system instruction. Keep it in its own module so it is easy to tune.

```
You are the composition and visual-design engine inside Chromajam, a music app that helps deaf and hard-of-hearing people see music and make it.

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
- Never output content that is not music or visual design data.
```

Add two short few-shot examples in `prompt.js` (one melody-in, one prompt-only) that match the schema exactly.

## 7. Modules to build

### 7.1 Input (`src/input/`)

- `record.js`: microphone recording with a visible record and stop button and a hard cap at `MAX_AUDIO_SECONDS`. Also support uploading an audio file.
- `wav.js`: decode the recording with `AudioContext.decodeAudioData`, downmix to mono, resample to 16 kHz, encode 16-bit PCM WAV. (Send WAV to Gemini, not webm, because WAV is a reliably supported audio input format.) Return base64 plus duration.
- `pitch.js`: run pitch detection over the recording in short frames, smooth the result, and segment it into notes. Output `[{ pitch: "D4", start, dur, vel }]` with `start` and `dur` in seconds, then convert to beats once tempo is estimated. Estimate tempo from onset spacing, and fall back to 100 BPM if unclear. Ignore frames with low clarity. Snap durations to a sensible grid.
- `taps.js`: tap-tempo and rhythm capture (spacebar or on-screen pad). Output tap times and an estimated BPM.

Detect what the user provided: if extracted notes exist, `provided = "melody"`. If only taps exist, `provided = "drums"`. If only text exists, `provided = "prompt"`. Send this hint to the server so Gemini does not have to guess.

### 7.2 Server (`server/`)

- `POST /api/generate`: body contains `prompt` (optional string), `audioBase64` (optional), `extractedNotes` (optional array), `taps` (optional array), `providedHint`. Build a multimodal request to Gemini, validate the response, return JSON. Enforce a body size limit and audio length limit. If `USE_FALLBACK_ONLY` is true or the call fails or times out (10 seconds), return a fallback preset chosen to match the hint.
- `POST /api/refine`: body contains the previous result JSON and an instruction string like "same vibe, more energy" or "make the drums sparser". Send both to Gemini, validate, return.
- Never log the API key. Log a short line per request (timing and whether fallback was used).

### 7.3 Music engine (`src/music/`)

- `engine.js`: build Tone.js instruments (synthesized kick, snare, hat, clap, perc, a lead synth for melody, a bass synth). Schedule drum lanes on the 16th-note grid and melody and bass notes by beat position. Loop the whole pattern. Play, stop, and tempo change. Expose an event emitter that fires `{ instrument, time, velocity }` for every scheduled hit or note, using `Tone.Draw` so the visuals are synced.
- `humanize.js`: apply `groove.swing` (delay every second 16th) and `groove.humanize` (small random velocity and timing jitter) on the client only.
- `midi.js`: build a multi-track MIDI file with `@tonejs/midi` (drums on channel 10, melody track, bass track, tempo, key in track name) and trigger a download.
- If the user provided a hummed melody, offer a toggle: play **my recording** or a **cleaned-up synth version** of the extracted notes.

### 7.4 Visuals (`src/visuals/`)

- `renderer.js`: one canvas, one `requestAnimationFrame` loop. Read the analyser bands for continuous energy. Subscribe to the engine's event emitter to spawn a visual element per hit or note, using that instrument's color and shape and a fixed screen region per instrument (for example bass at the bottom, drums in the middle, melody in the upper area).
- `styles/*.js`: five renderers, each exporting `draw(ctx, state, dt)` and `spawn(event)`:
  - `watercolor`: soft blooming blobs that bleed and fade
  - `ink`: sharp strokes and splatter on a light background
  - `neon`: glowing lines and shapes on dark
  - `grain`: textured particles, film-like
  - `glass`: translucent overlapping panes
- The `motion` value modifies behavior: `drift` (slow movement), `pulse` (elements scale on the beat), `swell` (energy-linked growth), `scatter` (bursts outward), `ripple` (expanding rings).
- `safety.js`: enforce a global flash limiter of at most 3 flashes per second (any full-screen or large-area luminance jump counts as a flash). **Calm mode** disables flashes and strobing, reduces particle count, and slows motion. Calm mode also turns on automatically when `prefers-reduced-motion` is set or when `calm_mode_recommended` is true (the user can override).
- Also show a **beat grid strip** along the bottom edge: a row of 16 cells per bar that light up as the playhead passes. This gives a precise, non-color-dependent view of rhythm.

### 7.5 Accessibility (`src/a11y/`, and across the UI)

- `haptics.js`: use `navigator.vibrate` where available. Kick is a short strong pulse, snare a double pulse, hats none by default. Provide an on/off toggle. Detect unsupported browsers and hide the toggle.
- `settings.js`: a small settings panel to change the color, shape, and haptic pattern for each instrument, and to toggle calm mode. Persist choices with `localStorage` (this is a normal Vite app, so `localStorage` is fine).
- The whole UI must be operable by keyboard, use visible focus styles, have sufficient color contrast, and use semantic HTML and ARIA labels on custom controls.

### 7.6 UI (`src/ui/`, `index.html`, `src/styles.css`)

Layout: a large canvas as the hero, controls in a compact bar, a settings drawer, and a debug panel.

Controls: record or upload, tap pad, text prompt field, Generate button, Play/Stop, tempo readout, Download MIDI, "Another take" and "More energy" refine buttons (calling `/api/refine`), toggle for my-recording versus synth.

**Debug panel (important for the hackathon theme):** a collapsible side panel showing (1) what was sent to Gemini (prompt text, audio duration, extracted note count, taps), (2) the raw JSON returned, and (3) the `director_note`. Include a "Fallback used" badge when relevant.

Show a friendly loading state during the Gemini call (animate the canvas gently). Show clear, non-technical errors.

### 7.7 Fallback (`src/fallback/presets.json`)

Create 4 hand-written, valid presets that satisfy the schema exactly: (1) lo-fi drums for a melody, (2) a melody and bass over a four-on-the-floor beat, (3) a full prompt-only trap-style loop, (4) a calm ambient set. Each includes a full `visual` block. The client and server both use these when Gemini is unavailable.

## 8. Build phases and acceptance criteria

**Phase 1: skeleton and Gemini loop.** Project scaffold, `npm run dev` works, mic recording and text prompt work, `/api/generate` returns validated JSON, the debug panel shows request and response.
*Done when:* typing a prompt and pressing Generate shows valid JSON in the debug panel, and unplugging the network shows a fallback preset instead of an error.

**Phase 2: sound.** Tone.js engine plays drums, melody, and bass from the JSON. Loop, stop, and tempo work. MIDI export downloads a file that opens in a DAW or MIDI player.
*Done when:* every fallback preset and a real Gemini response play correctly and the exported `.mid` contains the same notes.

**Phase 3: hum to notes.** WAV encoding and pitch detection. A hummed melody produces an extracted note list that is sent with the audio, and Gemini generates matching drums and bass.
*Done when:* humming a simple four-note phrase produces roughly the right notes and drums that fit its tempo.

**Phase 4: visuals.** Renderer, at least three styles (watercolor, neon, ink), instrument colors and shapes, FFT energy, event-synced hits, beat grid strip.
*Done when:* the visual clearly reacts to each instrument separately and stays in sync with the sound.

**Phase 5: accessibility and polish.** Flash limiter, calm mode, haptics, settings panel, keyboard operation, remaining two styles, refine buttons.
*Done when:* nothing on screen flashes more than 3 times per second in any mode, calm mode visibly reduces motion, and the app is fully usable without a mouse.

**Phase 6 (stretch, only if time remains): paint-back.** Let the user drag on the canvas. Map drag position and speed to a short text instruction (for example "warmer, busier" or "sparser, darker") and send it to `/api/refine`. Apply the new result without stopping playback if possible.

## 9. Cut list (drop in this order if running late)

1. Phase 6 (paint-back)
2. `grain` and `glass` styles
3. Settings panel customization (keep calm mode and haptics toggles)
4. "Another take" and "More energy" buttons
5. Tap pad (keep hum and text)

Never cut: the debug panel, the fallback presets, MIDI export, the flash limiter, calm mode.

## 10. Quality bar

- The app never shows a blank screen or unhandled error. Every failure path ends in a fallback preset or a clear message.
- The Gemini call has a timeout and one retry with a shorter prompt.
- No API key in client code, logs, or the repository.
- Code passes the linter with no errors.
- A first-time user can generate and play something in under 30 seconds.
- Update `README.md` checkboxes only for features that actually work, and document any deviation in `DECISIONS.md`.

## 11. Deliverable

A runnable repository matching the structure in section 4, with `npm install && npm run dev` working from a clean clone after the user adds `GEMINI_API_KEY` to `.env`. When finished, give a short summary of what works, what was cut, and any known bugs.
