---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["src/styles.css","src/visuals/renderer.js"]
---

# Surface brief: Chromajam app (index.html)

Scope: the single-page Chromajam app, including the canvas, score, song sheet, Gemini I/O tab, composer bar, and settings dialog. Visitor mode: **Operate** (generate, play, read the song), staged for a live judge demo on a laptop or projector.

Audience and job: a teammate drives it for 2–3 minutes and judges watch from a few feet away. Deaf and hard-of-hearing users must be able to follow who plays and when without sound. Success means making and playing something in under 30 seconds and seeing Gemini's input and output at one keystroke.

Memorable moment: the loop plays, and each instrument lands as its own primary shape, on its own line, exactly on the beat. The painting above blooms the same shapes in Gemini's palette.

## Direction contract

THESIS: The song is a Bauhaus composition. Every instrument is a primary shape with a color and a fixed line, and time runs left to right as in Kandinsky's Beethoven transcription in *Point and Line to Plane*. It refuses the dark neon music-AI dashboard and its cream editorial opposite.

OWN-WORLD: A cool gray plane (#eceeeb) on a near-white sheet (#f6f7f5). Black ink (#141414) is used for 1px hairlines, 2px structural rules, square corners, and flat fills with no glow or gradient in the chrome. Gemini's palette is the only color that paints. Bauhaus red (#d7261e) is reserved for Generate. State is shown by fill pattern: filled means sounding or active, outline means waiting, dashed means off. Hue never carries state. Type: Jost (Futura lineage) for everything, with hierarchy by size. Martian Mono is used for measurements (tempo, key, bars, ms).

STORY: The judge sees a painted plane and a score beneath it where each instrument's line is labeled with its shape. The driver types a vibe and hits Generate. The plane develops out of gray while Gemini composes, and the new song paints itself in time. The I/O tab shows what Gemini heard and what it returned.

FIRST VIEWPORT (1440×900): A 48px masthead with the ○□△ mark, CHROMAJAM, the tagline, the source state, and Calm/Settings on the right. Below that, the plane plus score take about 73% of the width at full height, with melody on top and bass at the bottom, and the 7-lane score in the lower ~190px with a step row. A 380px song sheet sits on the right with Song and Gemini I/O tabs: genre title, director note, mono measurements, instrument legend (shape + color + name), and refine actions. A composer bar runs along the bottom: transport (Play, tempo, source toggle), then the prompt field and red Generate, then Hum/Tap/Upload, examples, and .mid.

FORM: Point and Line to Plane (Kandinsky / Bauhaus visual music). It was candidate 4 on the ordered grounded list, assigned by seed da8d7f9e and chosen by the user ("whatever you recommend"). Raises: line-pattern state from the jackfield, generation that develops from the darkroom, one type family sized by hierarchy from the lineup poster, a single accent on the transforming control from the drawcord cape, and mono measurements on the plate from the cloud quarry.

Signature interaction: the painting and the score share one time axis. A playhead hairline sweeps both, and each scheduled hit fills its shape in the score and blooms in the painting from the same Tone.Draw event. While Gemini composes, the plane develops. Motion grammar: marks bloom in and fade, with drift, pulse, swell, scatter, and ripple as Gemini's modifiers, all capped by the 3-flashes/second limiter and slowed in calm mode.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Build path is code-led (no image generation available this session). This is not stored as a default.
