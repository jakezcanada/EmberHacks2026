# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary audience (the people the product is for):** deaf and hard-of-hearing people who want to follow and make music visually. Hearing users benefit too, but the visual is designed as the primary interface, not decoration.
- **Immediate audience (the next few weeks):** EmberHacks 2026 hackathon judges watching a live demo. A teammate drives the app on a laptop or projector for 2–3 minutes while judges watch from a few feet away.

## Product Purpose

Chromajam is a jam partner you can see. The user gives it one half of a song (a text prompt, a hummed melody, a tapped rhythm, or an uploaded clip). Gemini works out which half is missing and writes it. The app plays the loop, offers a `.mid` download, and paints the music as a real-time visual that a deaf or hard-of-hearing person can follow.

Success in the demo: a judge understands within seconds that the song is *readable* without sound, that Gemini is the I/O module turning messy input into structured music and visual data, and a first-time user can generate and play something in under 30 seconds.

## Positioning

Most visualizers show volume. Chromajam shows meaning: every instrument has its own color, shape, and screen region. Hits are driven by the same scheduled events that make the sound, so they land exactly on time. Gemini decides what the song looks like (palette, texture, motion); the audio engine makes it move.

## Operating Context

- Demo is live, driven by a teammate, and often on flaky venue Wi-Fi. Fallback presets must keep it alive with no API key.
- The canvas must read from several feet away on a projector.
- Inputs: text prompt, microphone hum (capped at `MAX_AUDIO_SECONDS`), tap pad, audio upload. Outputs: audio playback, `.mid` export, canvas, haptics.
- The Gemini I/O inspector (what Gemini received, what it returned, director note, fallback badge) is part of the pitch because the hackathon theme is *Gemini as an I/O module*.

## Capabilities and Constraints

- Stack is fixed by BUILD_PROMPT.md: Vite + vanilla JS client, Express server, `@google/genai`, Tone.js, `@tonejs/midi`, Canvas 2D, zod.
- Data contract fixed by BUILD_PROMPT.md §5: `visual.texture` ∈ watercolor | ink | neon | grain | glass; `visual.motion` ∈ drift | pulse | swell | scatter | ripple; Gemini supplies a palette plus a color and a shape for every instrument (kick, snare, hat, clap, perc, melody, bass).
- Visual hits must be triggered from the scheduled Tone.js events (`Tone.Draw`); FFT is only for continuous energy.
- Required surfaces: large canvas hero, compact controls, settings drawer, collapsible Gemini debug panel, beat grid strip, friendly loading state, non-technical errors.
- The API key never reaches the browser.

## Brand Commitments

- Name: **Chromajam**.
- Tagline: **A jam partner you can see.**
- Gemini must be visibly credited: the I/O inspector and the fallback badge stay prominent.
- Nothing else is binding. The existing logo dots, colors, and fonts may be replaced.

## Evidence on Hand

- Four hand-written fallback presets in `src/fallback/presets.json` (lo-fi, synthwave, trap, ambient).
- No user testing, testimonials, or deaf/HoH community endorsement yet. The README states the visual mappings are untested assumptions; never imply otherwise.

## Product Principles

1. **Readable without sound.** Every musical event must be identifiable by position and shape, not color alone.
2. **Two layers, two jobs.** The canvas has a precise score/rhythm layer (who played, when) and a separate expressive painting layer (mood, energy), each with its own space.
3. **Gemini's work is visible.** What went in and what came back is always one keystroke away.
4. **Never a dead screen.** Every failure path lands on a fallback preset or a plain-language message.
5. **Safe to watch.** No more than 3 flashes per second in any mode; calm mode visibly reduces motion.

## Accessibility & Inclusion

- WCAG 2.3.1 flash limit (≤3 flashes/second), calm mode, `prefers-reduced-motion` respected.
- Instrument identity by color **and** shape **and** region; customizable per instrument, persisted.
- Haptics via the Vibration API where supported (toggle hidden when unsupported).
- Fully keyboard-operable, visible focus, sufficient contrast, semantic HTML, ARIA on custom controls.
