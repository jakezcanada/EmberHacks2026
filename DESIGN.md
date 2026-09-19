---
name: Chromajam
description: A jam partner you can see. Point and Line to Plane: every instrument is a primary shape on its own line of one shared time axis.
colors:
  sheet: "#f6f7f5"
  plane: "#eceeeb"
  paper: "#ffffff"
  ink: "#141414"
  ink-2: "#44484b"
  ink-3: "#5f6468"
  rule: "rgba(20, 20, 20, 0.14)"
  wash: "rgba(20, 20, 20, 0.06)"
  red: "#d7261e"
  red-deep: "#b51d16"
  yellow: "#f5c400"
  ground-ink: "#f3f4f1"
  ground-grain: "#e2e3df"
  ground-glass: "#e5e8ea"
  ground-neon: "#0f1014"
typography:
  display:
    fontFamily: "Jost, Futura, 'Century Gothic', system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.015em"
  wordmark:
    fontFamily: "Jost, Futura, 'Century Gothic', system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
  body-large:
    fontFamily: "Jost, Futura, 'Century Gothic', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Jost, Futura, 'Century Gothic', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  hint:
    fontFamily: "Jost, Futura, 'Century Gothic', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: "Jost, Futura, 'Century Gothic', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  button-generate:
    fontFamily: "Jost, Futura, 'Century Gothic', system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "0.01em"
  label:
    fontFamily: "Jost, Futura, 'Century Gothic', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.08em"
  measure:
    fontFamily: "'Martian Mono', ui-monospace, 'SFMono-Regular', monospace"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.04em"
  readout:
    fontFamily: "'Martian Mono', ui-monospace, 'SFMono-Regular', monospace"
    fontSize: "17px"
    fontWeight: 500
rounded:
  none: "0px"
spacing:
  hair: "4px"
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  panel: "22px"
  section: "30px"
components:
  button:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    height: "44px"
    padding: "0 16px"
  button-hover:
    backgroundColor: "{colors.wash}"
  button-active-state:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  button-small:
    rounded: "{rounded.none}"
    height: "30px"
    padding: "0 10px"
  button-generate:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper}"
    typography: "{typography.button-generate}"
    rounded: "{rounded.none}"
    height: "52px"
    padding: "0 30px"
  button-generate-hover:
    backgroundColor: "{colors.red-deep}"
  button-play:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    height: "44px"
    padding: "0 16px"
  tool-button:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "34px"
    padding: "0 14px"
  tab:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    height: "44px"
  tab-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  prompt-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    rounded: "{rounded.none}"
    height: "52px"
    padding: "0 16px"
  source-state:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "34px"
    padding: "0 14px 0 12px"
  io-status:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
  switch:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    width: "48px"
    height: "26px"
  switch-on:
    backgroundColor: "{colors.ink}"
  score:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.measure}"
---

# Design System: Chromajam

## Overview

**Creative North Star: "Point and Line to Plane"**

The song is a Bauhaus composition. Every instrument is a primary shape with a color and a fixed line, and time runs left to right, as in Kandinsky's transcription of Beethoven in *Point and Line to Plane*. The interface is a drafting sheet: near-white paper, black ink drawn in three stroke weights, square corners everywhere, flat fills. The chrome stays monochrome so the only color that paints is Gemini's per-song palette, which lands on the plane and in the score. Bauhaus red appears once, on Generate.

The canvas has two layers on one time axis. The **plane** (top) is the expressive painting: Gemini's texture blooms each hit where and when it sounds. The **score** (bottom) is the precise record: seven labeled lanes, the whole loop visible, each hit drawn as its instrument's shape. The same scheduled event fills the score glyph and blooms the plane mark, so the two never disagree. Density is instrument-panel: everything is visible at once, and hierarchy comes from size and ink weight rather than color or depth.

The world rejects the dark neon music-AI dashboard and its cream editorial opposite. Neon survives only as one of Gemini's five painting textures, confined to the plane.

**Key Characteristics:**
- Ink on a near-white sheet; a cool gray plane holds the painting.
- Three stroke weights: 1px hairline, 1.5px control, 2px structure.
- Square corners on every piece of chrome.
- State is shown by fill pattern, never by hue: filled is active or sounding, hollow is waiting, dashed is resting.
- One type family (Jost) with hierarchy by size; Martian Mono only for measurements.
- Seven instrument shapes, seven fixed lanes, one shared time axis.
- Motion is bloom-and-fade, capped at three flashes per second and slowed in calm mode.

## Colors

A monochrome ink-and-paper chrome with one reserved red; all expressive color is runtime data from Gemini.

### Primary
- **Bauhaus Red** (`red`): Only for the Generate button fill and the text caret in the prompt field that feeds it. Hover deepens to **Fired Red** (`red-deep`).

### Secondary
- **Signal Yellow** (`yellow`): Text selection, and the focus ring wherever the ring sits on an ink-filled surface (selected tab, captured-input chip) where a black ring would vanish. Never a fill for controls.

### Neutral
- **Drafting Ink** (`ink`): All text, all rules and borders, the playhead, and the "on" fill for pressed, selected, and live states.
- **Graphite** (`ink-2`): Secondary text: origin lines, hints, mono measurement labels, tagline.
- **Pencil** (`ink-3`): Placeholders, silent legend rows, scrollbar thumb. This is the lightest ink allowed for text.
- **Sheet** (`sheet`): Page background, the song sheet, the composer, and the score strip on the canvas.
- **Plane** (`plane`): The painting's ground at rest (also the watercolor texture's ground).
- **Paper** (`paper`): Surfaces that accept input or report status: the prompt field, source-state chip, I/O status box, JSON block, switches, selects.
- **Rule** (`rule`): Hairline dividers inside lists, tables, and measurement grids.
- **Wash** (`wash`): The only hover treatment: a 6% ink tint behind outlined controls.

### Texture grounds
Each of Gemini's five textures owns a fixed ground for the plane: watercolor on Plane, ink on `ground-ink`, grain on `ground-grain`, glass on `ground-glass`, and neon on `ground-neon`, the only dark ground. When the ground is dark, plane annotations, the ghost hairline, and the developing marks switch from ink to white.

### Named Rules
**The Only Gemini Paints Rule.** Chrome carries no hue. Instrument colors and the palette arrive per song from Gemini (or a preset, or the user's override in Access) and appear only on the plane, the score, and the instrument glyphs. They are runtime data and never become tokens.

**The One Red Rule.** Red marks the one control that transforms the song. If a second element turns red, Generate stops being findable from across the room.

**The Hue Never Carries State Rule.** Every state must stay readable in grayscale. Filled, hollow, half-filled, and dashed carry state; color only identifies an instrument.

## Typography

**Display Font:** Jost (with Futura, Century Gothic, system-ui), self-hosted, variable 400–700
**Label/Mono Font:** Martian Mono (with ui-monospace, SFMono-Regular), self-hosted, 400–500

**Character:** Jost is a geometric Futura descendant, which matches the circle, square, and triangle drawn on the canvas. Martian Mono appears only where a number is measured.

### Hierarchy
- **Display** (500, 36px, 1.02, -0.015em, balanced wrap): The song title at the top of the Song tab. Drops to 30px at 1240px and below.
- **Wordmark** (700, 21px, 0.1em, uppercase): CHROMAJAM in the masthead only. 18px at 900px and below, 16px with 0.06em at 520px and below.
- **Body Large** (400, 18px, 1.45, max 38ch): The director note, the prompt input, and measurement values (500).
- **Body** (400, 16px, 1.45): Default text, legend names (500), switch labels (500), and outlined buttons (500).
- **Hint** (400, 14px, 1.45, Graphite): Origin lines, helper copy, mood line.
- **Label** (600, 13px, 0.08em, uppercase): Sheet section headings. Each one sits under a 2px ink rule, so it heads a real section rather than decorating one.
- **Measure** (Martian Mono 500, 12px, 0.04em, uppercase): Measurement names (TEMPO, KEY), table heads, legend counts, plane annotations (BPM · KEY · BARS, TEXTURE / MOTION), and the score's bar counter.
- **Readout** (Martian Mono 500, 17px): The live BPM value in the tempo control.

### Named Rules
**The One Family Rule.** Jost sets everything that is read. Hierarchy comes from size and weight, never from a second display face.

**The Mono Measures Rule.** Martian Mono is only for quantities and machine data: tempo, key, bars, counts, milliseconds, JSON. Never use it for prose or for decoration. The body sets `tabular-nums` so Jost numerals also align.

## Layout

A fixed three-row frame fills the viewport (`100dvh`): masthead (56px, 2px ink rule below), stage, and composer. The stage is a two-column grid: the canvas takes the remaining width, and the song sheet has a fixed width of 392px (340px at 1240px and below), separated by a 2px ink rule. The page gutter is 20px (16px at 900px and below); sheet panels pad 22px. Spacing steps are 4, 8, 10, 14, 20, 22, and 30px, with 30px above each sheet section heading.

**Responsive:** at 1240px the tagline and source detail hide. At 1080px the input-tool buttons collapse to 52px icon squares. At 900px the frame becomes a single scrolling column: masthead, plane (68svh, 440–640px), composer, then sheet. The toast becomes a fixed bar 16px from the bottom edge. At 520px the compose row stacks, Generate goes full width, and the brand mark hides. The canvas switches to its compact score below 640px of canvas width.

**Canvas geometry.** The score strip takes 28% of canvas height, clamped to 176–236px (compact: 17px per lane plus 34px). A label column (124px, compact 72px) holds shape and name. The step grid fills the rest with 16 steps per bar.

### Named Rules
**The One Time Axis Rule.** The plane and the score share one horizontal scale. Beat 0 sits at the same x in both, drum hits sit mid-cell exactly over their score glyph, and a single playhead hairline sweeps both.

**The Fixed Lane Order Rule.** Instruments keep one vertical order everywhere (plane, score, legend, Access table), top to bottom: Melody, Hi-hat, Perc, Clap, Snare, Kick, Bass. Melody sits on top and bass at the bottom, with drums between, ordered from high to low register. Melody and bass place notes by pitch within their lane. Drums sit on the lane's center line.

## Elevation & Depth

The chrome is flat. Depth comes from ink rules and from surface tone (Sheet, Plane, Paper), not from shadow. Pressed and selected controls fill with ink instead of lifting.

### Shadow Vocabulary
- **Floating toast** (`box-shadow: 0 6px 20px rgba(20, 20, 20, 0.25)`): Only at 900px and below, where the toast floats as a fixed bar over scrolling content. This is the system's only shadow.

### Named Rules
**The Flat Sheet Rule.** No chrome element casts a shadow, glows, or uses a gradient. Glow and gradient belong to the painting textures (neon, glass), which live only on the plane.

## Shapes

The chrome uses square corners at 0px radius, including selects and the switch thumb. Borders come in three weights with fixed jobs:
- **1px hairline:** dividers, the tagline rule, small and quiet buttons, example chips, the JSON box, table inputs.
- **1.5px control stroke:** outlined buttons, tool buttons, the tempo and segmented groups, the source chip, switches, and state marks.
- **2px structural rule:** the frame (masthead, stage, and plane edges), the tab bar, section-heading rules, the prompt field, and the I/O status box.

**The seven instrument shapes** form the canvas vocabulary: circle, square, triangle, line (a horizontal bar with round caps whose length follows note duration), blob (a seeded organic loop), star (five points), and diamond. The default mapping is kick = circle, snare = square, hi-hat = triangle, melody = line, bass = blob, clap = star, perc = diamond. Gemini or the user may reassign shapes per song, but only within these seven. Glyphs in the score, legend, and Access table draw the shape filled with the instrument color and outlined with a 1.25px ink contour.

The brand mark and transport icons use the same primitives: a filled circle, an outlined square, and a filled triangle. Play is a triangle, Stop a square, and Hum/record a circle. The icon family uses a 20px grid, 1.75px stroke, square caps, and miter joins, drawn as inline SVG.

### Named Rules
**The Square Chrome Rule.** Chrome has no border-radius. Curves appear only inside the instrument vocabulary (circle, blob, line caps) and the icons that quote it.

**The Seven Shapes Rule.** An instrument is identified by shape and lane first and color second. Never add an eighth shape or render an instrument without its shape.

## Components

The controls are drafted rather than decorated: outlined in ink, filled with ink when on, and tinted with a 6% wash on hover.

### Buttons
- **Shape:** Square (0px), 1.5px ink outline, 44px tall, 16px horizontal padding, Body 500 with an optional 18px icon at an 8px gap.
- **Primary (Generate):** Bauhaus Red fill, white text, 19px/600, 52px tall, 30px padding, no border. Hover changes to Fired Red. While composing, the label reads "Composing…" and the button dims.
- **Play:** Ink fill with Sheet text, 600 weight, at least 112px wide.
- **Hover / Active / Focus:** Wash on hover, a 1px press offset on active, and a 2px ink focus outline at a 2px offset (yellow on ink surfaces). Background and color transitions run 120ms on the standard ease-out.
- **Quiet / Small:** Quiet drops to a 1px border (Download .mid, Reset). Small is 30px tall, 13px text, 1px border (Copy JSON).
- **On state:** Pressed toggles (Calm mode, Hum while recording, the melody-source segment, the selected example) fill with ink and switch to Sheet text.

### Chips
- **Examples:** 36px tall, 1px ink border, 15px/500, with the wash on hover. The group sits after a mono uppercase EXAMPLES label that hides at 1080px and below.
- **Captured input:** An ink-filled chip inside the prompt field in 12px mono, with a 32px square clear button.

### Cards / Containers
- **Corner Style:** Square.
- **Background:** Paper for status and data boxes (I/O status, JSON); Sheet for panels.
- **Shadow Strategy:** None (see Elevation & Depth).
- **Border:** 2px ink for the status box, 1px ink for the JSON block.
- **Internal Padding:** 12–14px.
- **Measurements grid:** A two-column definition list under a 1px ink top rule, with hairline Rule dividers, mono uppercase names, and 18px/500 values.

### Inputs / Fields
- **Prompt field:** Paper fill, 2px ink border, 52px tall, 18px text, 16px inset, Pencil placeholder, red caret.
- **Focus:** The whole field takes a 2px ink outline at a 2px offset.
- **Switch:** A 48×26px square track (1.5px ink) with a 17px square ink thumb. When on, the track fills with ink, the thumb turns Sheet, and it slides 22px over 160ms.
- **Selects and color inputs:** Paper fill, 1px ink border, square, 28–30px tall.

### Navigation
- **Sheet tabs:** Three equal 44px cells (Song, Gemini I/O, Access) divided by 1px ink rules on a 2px ink baseline. The selected tab fills with ink. Hover shows the wash. Focus uses a yellow ring inset 4px. A mono `kbd` shows the D shortcut.
- **Masthead tools:** 34px tool buttons with a 1.5px outline. Calm mode fills with ink when on.

### Source State (signature)
A Paper chip in the masthead that reports where the song came from, sized to read from the judging table (17px/600 label, 14px Graphite detail). Its 14px state mark follows the fill-pattern rule: **filled** means live Gemini, **outline** means preset or fallback, and **half-filled** means composing. The I/O tab's status box uses the same mark.

### The Plane and Score (signature)
**Fill-pattern state on the canvas.** Every mark has three states, the same in both layers:
- **Waiting (hollow):** A 2px instrument-color outline over a 0.75px ink hairline at about 55% (score) or 35% (plane ghost), with no fill.
- **Played or sounding (filled):** Instrument-color fill with an ink contour (1px). The sounding step's glyph draws at 1.3× scale with a 1.75px contour.
- **Resting (dashed):** A lane with no hits shows a 3/4px dashed center line in the score. Its legend glyph is unfilled with a 2.5px dashed outline at 50%, and its count reads "rests".

**Plane.** Before playback the whole loop sits on the plane as a faint hollow "ghost" composition, revealed left to right over 1100ms behind a developing hairline, so the plane is never blank and upcoming hits are visible. The melody's pitch contour connects its notes with a dotted 2/5 line. Each hit then blooms (scale 0.55→1 over 0.14s), moves by Gemini's motion modifier (drift, pulse, swell, scatter, ripple), and fades. Played marks leave a 16% print, and the melody leaves a solid contour line, so the loop builds into a composition that fades over a few loops. Mark weight follows the beat (downbeat 1.4×, quarter 1.15×, off-beat 0.85×), and kick, bass, and snare are the largest marks. Mono annotations sit in the top corners at 12px. The plane playhead is a 1.5px hairline at 40% ink.

**Textures.** Five painting treatments share one mark lifecycle and the seven shapes. **Watercolor** uses three multiplied translucent washes that bleed outward. **Ink** uses a brush contour with splatter and an ink hairline. **Grain** fills the shape with stipple under a film noise veil. **Glass** uses translucent panes with a bevel edge. **Neon** uses glowing contours on the only dark ground. Moving between textures fades the ground color rather than cutting it.

**Score.** A Sheet strip under a 2px ink rule. A step row of 16 cells per bar shows the current step filled in ink, with beat cells heavier than off-beats. Grid lines are 75% ink at bar lines and 20% at beats. Lane rows are divided by 10% ink hairlines. The score playhead is a 1.5px solid ink line.

**Developing.** While Gemini composes, the ghost fades out and faint circle, square, and triangle outlines surface and sink back into the plane at random lane positions every 0.28s (peak about 20% opacity). The plane appears to develop like a print.

**Legend.** A four-column row (glyph, name, shape name, mono count) per lane in fixed order. While an instrument sounds, its glyph scales to 1.3× for 140ms.

### Named Rules
**The Three Flashes Rule.** Any large-area luminance change goes through the flash limiter: at most three full-strength flashes per second, with extra flashes held to 25%. The only whole-plane flash is the pulse-motion kick tint, capped at 10% alpha. Film grain reseeds 12 times per second at no more than 9% alpha, which makes it texture, not a flash.

**The Calm Rule.** Calm mode visibly slows and quiets the painting: motion speed ×0.4, mark life ×1.5, mark cap halved, marks 15% smaller and unrotated, no whole-plane pulse, softer glow and splatter. Flash gating drops to 20%. Calm mode follows `prefers-reduced-motion` and each song's recommendation until the user chooses. CSS transitions and animations stop under reduced motion.

## Do's and Don'ts

### Do:
- **Do** keep chrome in ink, sheet, plane, and paper, and let Gemini's palette be the only color that paints.
- **Do** show every state by fill pattern (filled, hollow, half, dashed) so it survives grayscale.
- **Do** draw every instrument with its shape, in its fixed lane, on the shared time axis, in every view that lists instruments.
- **Do** use the three stroke weights for their jobs: 1px hairline, 1.5px control, 2px structure.
- **Do** set measurements in Martian Mono and everything read in Jost, sized by hierarchy.
- **Do** put the pressed/selected state in an ink fill with Sheet text, and hover in the 6% wash.
- **Do** route any whole-plane luminance change through the flash limiter and give it a calm-mode variant.

### Don't:
- **Don't** use red anywhere except Generate (and its prompt caret).
- **Don't** round, shadow, glow, or gradient any chrome. Those effects belong only to painting textures on the plane.
- **Don't** use hue to signal state, success, or error.
- **Don't** add a second display face, or use mono for prose.
- **Don't** introduce an eighth instrument shape or reorder the lanes per view.
- **Don't** set text lighter than Pencil (`ink-3`) on Sheet.
- **Don't** tokenize per-song instrument colors or palettes. They are runtime data.
