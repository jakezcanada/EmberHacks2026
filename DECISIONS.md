# Architectural & Design Decisions

- Model Selection: Defaulted `GEMINI_MODEL` to `gemini-2.5-flash` for low latency, multimodal audio support, and JSON schema compliance.
- Client Architecture: Vanilla ES modules with Vite, no external frontend framework as specified.
- Synth Sounds: Tone.js MembraneSynth (kick), NoiseSynth + MetalSynth (snare, hat, clap, perc), PolySynth with triangle/saw oscillator (melody), MonoSynth with lowpass filter (bass).
- Pitch Detection: Using Pitchy with Web Audio AnalyserNode autocorrelation fallback for robust client-side pitch tracking without external binary dependencies.
