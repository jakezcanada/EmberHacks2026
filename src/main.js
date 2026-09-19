import { generateJamRequest, refineJamRequest } from './api/client.js';
import { musicEngine } from './music/engine.js';
import { exportMidiFile } from './music/midi.js';
import { exportMp3File } from './music/mp3.js';
import { AudioRecorder } from './input/record.js';
import { processAudioToWav } from './input/wav.js';
import { extractNotesFromAudio } from './input/pitch.js';
import { TapTracker } from './input/taps.js';
import { VisualRenderer } from './visuals/renderer.js';
import { safetyManager } from './visuals/safety.js';
import { hapticController } from './a11y/haptics.js';
import { SettingsManager } from './a11y/settings.js';
import { ControlsBar } from './ui/controls.js';
import { DebugPanel } from './ui/debugPanel.js';
import { SongSheet } from './ui/songSheet.js';
import fallbackPresets from './fallback/presets.json';

const MAX_AUDIO_SECONDS = 15;
const EXAMPLE_LABELS = ['Lo-fi', 'Synthwave', 'Trap', 'Ambient'];
const INTERACTIVE = 'button, input, select, textarea, a, summary, [role="switch"], [role="tab"], [contenteditable="true"]';

class ChromajamApp {
  constructor() {
    this.currentSong = null;
    this.audioBase64 = null;
    this.audioDuration = 0;
    this.audioBuffer = null;
    this.extractedNotes = [];
    this.tapTimes = [];
    this.isBusy = false;
    this.engine = musicEngine; // handy for debugging from the console (window.chromajam.engine)
    this.recorder = new AudioRecorder(MAX_AUDIO_SECONDS);
    this.tapTracker = new TapTracker();

    this.canvas = document.getElementById('visual-canvas');
    this.renderer = new VisualRenderer(this.canvas);
    this.renderer.setAnalyserSource(() => musicEngine.getAnalyserData());

    this.panels = {
      song: document.getElementById('panel-song'),
      io: document.getElementById('panel-io'),
      access: document.getElementById('panel-access'),
    };
    this.songSheet = new SongSheet(this.panels.song, { onRefine: (i) => this.handleRefine(i) });
    this.debugPanel = new DebugPanel(this.panels.io);
    this.settings = new SettingsManager({
      onVisualChange: () => this.refreshVisual(),
      onCalmChange: (on) => this.syncCalmButton(on),
    });

    this.controls = new ControlsBar(
      document.getElementById('composer'),
      {
        onGenerate: (prompt) => this.handleGenerate(prompt),
        onToggleRecord: () => this.handleToggleRecord(),
        onFileUpload: (file) => this.handleFileUpload(file),
        onTap: () => this.handleTap(),
        onClearCapture: () => this.clearCapture(),
        onTogglePlay: () => this.handleTogglePlay(),
        onChangeBpm: (bpm) => this.handleChangeBpm(bpm),
        onToggleUserAudio: (mine) => musicEngine.setPlayUserAudio(mine),
        onExample: (i) => this.loadExample(i),
        onDownloadMidi: () => this.handleDownloadMidi(),
        onDownloadMp3: () => this.handleDownloadMp3(),
      },
      { examples: fallbackPresets.map((p, index) => ({ index, label: EXAMPLE_LABELS[index] || p.analysis.genre_hint })) }
    );

    musicEngine.on('note', (event) => {
      this.renderer.handleNoteEvent(event);
      this.songSheet.flash(event.instrument);
      hapticController.trigger(event.instrument);
    });
    musicEngine.on('step', ({ step, totalSteps }) => this.renderer.setPlayheadStep(step, totalSteps));
    musicEngine.on('state', ({ isPlaying }) => this.controls.setPlayState(isPlaying));
    musicEngine.on('loading', ({ loading }) => {
      if (loading) this.showToast('Loading instruments…', 0);
      else if (document.getElementById('toast').textContent === 'Loading instruments…') document.getElementById('toast').hidden = true;
    });

    this.initTabs();
    this.initMasthead();
    this.initKeyboard();
    this.initPaintBack();

    this.renderer.start();
    this.loadExample(0, { quiet: true });
  }

  // ---------- song state ----------

  mergedVisual(song = this.currentSong) {
    const v = song?.visual || {};
    const c = this.settings.customizations;
    return {
      ...v,
      instrument_colors: { ...v.instrument_colors, ...c.instrumentColors },
      instrument_shapes: { ...v.instrument_shapes, ...c.instrumentShapes },
    };
  }

  refreshVisual() {
    const visual = this.mergedVisual();
    const { calm_mode_recommended, ...rest } = visual;
    this.renderer.setVisualConfig(rest);
    this.songSheet.render(this.currentSong, {
      colors: visual.instrument_colors,
      shapes: visual.instrument_shapes,
      isExample: this.currentSource === 'example',
      isFallback: this.currentFallback,
    });
  }

  applySong(song, meta, { source = 'gemini', autoplay = true } = {}) {
    this.currentSong = song;
    this.currentSource = source;
    this.currentFallback = Boolean(meta?.fallback);
    musicEngine.loadSong(song);
    this.renderer.setSong(song);
    this.renderer.setVisualConfig(this.mergedVisual(song));
    this.controls.setBpm(song.analysis?.tempo || 90);
    this.refreshVisual();
    this.settings.render(this.panels.access, song.visual);
    this.debugPanel.update({ ...meta, source, audioDuration: this.audioDuration });
    this.sourceState = [source === 'example' ? 'example' : meta?.fallback ? 'fallback' : 'live', this.sourceDetail(source, meta)];
    this.setSourceState(...this.sourceState);
    this.syncCalmButton(safetyManager.calmMode);
    this.describeCanvas();
    if (autoplay && !musicEngine.isPlaying) musicEngine.play();
  }

  loadExample(index, { quiet = false } = {}) {
    const preset = fallbackPresets[index];
    if (!preset) return;
    this.applySong(
      structuredClone(preset),
      { requestPayload: { prompt: '', providedHint: preset.analysis.provided }, data: preset, fallback: true, elapsedMs: 0 },
      { source: 'example', autoplay: !quiet }
    );
    if (!quiet) this.showToast(`Example loaded: ${preset.analysis.genre_hint}`);
  }

  describeCanvas() {
    const a = this.currentSong?.analysis || {};
    const v = this.mergedVisual();
    const parts = ['melody', 'kick', 'snare', 'hat', 'bass']
      .map((i) => `${i} as a ${v.instrument_shapes?.[i]}`)
      .join(', ');
    this.canvas.setAttribute(
      'aria-label',
      `Visual score of a ${a.genre_hint || 'loop'} at ${a.tempo || ''} BPM in ${a.key || 'an unknown key'}. Each instrument has its own line: ${parts}.`
    );
  }

  setSourceState(state, detail = '') {
    const el = document.getElementById('source-state');
    el.dataset.state = state;
    document.getElementById('source-label').textContent = { live: 'Gemini', fallback: 'Fallback preset', example: 'Example preset', busy: 'Composing' }[state];
    document.getElementById('source-detail').textContent = detail;
  }

  sourceDetail(source, meta) {
    if (source === 'example') return 'Gemini not called';
    if (meta?.fallback) return 'Gemini unavailable';
    const ms = meta?.elapsedMs || 0;
    return `live · ${ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}`;
  }

  // ---------- chrome ----------

  initTabs() {
    this.tabs = [...document.querySelectorAll('.sheet-tabs [role="tab"]')];
    this.tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => this.selectTab(tab.id.replace('tab-', '')));
      tab.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const next = this.tabs[(i + dir + this.tabs.length) % this.tabs.length];
        this.selectTab(next.id.replace('tab-', ''), { focus: true });
      });
    });
  }

  selectTab(name, { focus = false } = {}) {
    for (const tab of this.tabs) {
      const on = tab.id === `tab-${name}`;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    }
    for (const [key, panel] of Object.entries(this.panels)) panel.hidden = key !== name;
    document.getElementById('access-btn').setAttribute('aria-pressed', String(name === 'access'));
  }

  initMasthead() {
    document.getElementById('calm-btn').addEventListener('click', () => this.settings.setCalm(!safetyManager.calmMode));
    document.getElementById('access-btn').addEventListener('click', () => {
      this.selectTab('access');
      document.querySelector('.sheet').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  syncCalmButton(on) {
    document.getElementById('calm-btn').setAttribute('aria-pressed', String(on));
  }

  showToast(msg, duration = 3200) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(this.toastTimer);
    if (duration > 0) this.toastTimer = setTimeout(() => (toast.hidden = true), duration);
  }

  setBusy(on, label = 'Gemini is composing') {
    this.isBusy = on;
    this.controls.setLoading(on);
    this.renderer.setDeveloping(on);
    clearInterval(this.busyTimer);
    if (on) {
      // The masthead badge carries the composing state; no toast repeats it
      document.getElementById('toast').hidden = true;
      document.getElementById('source-state').title = label;
      const started = performance.now();
      const tick = () => this.setSourceState('busy', `${((performance.now() - started) / 1000).toFixed(1)} s`);
      tick();
      this.busyTimer = setInterval(tick, 100);
    } else {
      if (this.sourceState) this.setSourceState(...this.sourceState);
    }
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest?.(INTERACTIVE) || e.target.closest?.('pre')) return;
      const key = e.key.toLowerCase();
      if (e.code === 'Space') {
        e.preventDefault();
        this.handleTogglePlay();
      } else if (key === 't') {
        this.handleTap();
      } else if (key === 'd') {
        const ioOpen = !this.panels.io.hidden;
        this.selectTab(ioOpen ? 'song' : 'io');
      } else if (key === 'a' || key === 's') {
        this.selectTab('access');
      } else if (key === 'escape') {
        this.selectTab('song');
      }
    });
  }

  // ---------- transport ----------

  async handleTogglePlay() {
    await musicEngine.init();
    musicEngine.togglePlay();
  }

  handleChangeBpm(bpm) {
    musicEngine.setBpm(bpm);
    this.controls.setBpm(musicEngine.bpm);
    this.renderer.setTempo(musicEngine.bpm);
  }

  handleDownloadMidi() {
    const name = (this.currentSong?.analysis?.genre_hint || 'chromajam').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      exportMidiFile(this.currentSong, `chromajam-${name}.mid`);
      this.showToast('MIDI downloaded · drums, melody and bass tracks');
    } catch (err) {
      console.error('MIDI export failed:', err);
      this.showToast('Could not build a MIDI file for this song');
    }
  }

  async handleDownloadMp3() {
    const name = (this.currentSong?.analysis?.genre_hint || 'chromajam').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const button = document.getElementById('download-mp3-btn');
    try {
      button.disabled = true;
      this.showToast('Rendering one loop for MP3…', 0);
      const source = this.currentSong ? await musicEngine.recordLoop() : this.audioBuffer;
      await exportMp3File(source, `chromajam-${name}.mp3`);
      this.showToast('MP3 downloaded');
    } catch (err) {
      console.error('MP3 export failed:', err);
      this.showToast(`Could not render MP3: ${err.message || 'audio export failed'}`);
    } finally {
      button.disabled = false;
    }
  }

  // ---------- inputs ----------

  clearCapture() {
    this.audioBase64 = null;
    this.audioDuration = 0;
    this.audioBuffer = null;
    this.extractedNotes = [];
    this.tapTimes = [];
    this.tapTracker.reset();
    musicEngine.setPlayUserAudio(false);
    this.controls.setUserAudioMode(false);
    this.controls.setUserAudioAvailable(false);
    this.controls.setCaptured(null);
  }

  async handleToggleRecord() {
    if (this.recorder.isRecording) {
      this.recorder.stop();
      return;
    }
    try {
      this.controls.setRecordingState(true, 0, MAX_AUDIO_SECONDS);
      this.showToast('Listening · hum, then press Stop');
      const blob = await this.recorder.start((elapsed, max) => this.controls.setRecordingState(true, elapsed, max));
      this.controls.setRecordingState(false);
      await this.ingestAudio(blob, 'Melody');
    } catch (err) {
      this.controls.setRecordingState(false);
      console.error('Microphone error:', err);
      this.showToast('Microphone blocked · type a vibe or upload a clip', 4500);
    }
  }

  async handleFileUpload(file) {
    try {
      await this.ingestAudio(file, 'Clip');
    } catch (err) {
      console.error('File processing error:', err);
      this.showToast('Could not read that file · try a short WAV or MP3', 4500);
    }
  }

  async ingestAudio(blobOrFile, kind) {
    this.showToast('Finding the notes…');
    const { base64, duration, pcmData, audioBuffer } = await processAudioToWav(blobOrFile);
    this.audioBase64 = base64;
    this.audioDuration = duration;
    this.audioBuffer = audioBuffer;
    musicEngine.setUserAudio(audioBuffer);
    this.controls.setUserAudioAvailable(true);
    const extraction = extractNotesFromAudio(pcmData, 16000);
    this.extractedNotes = extraction.notes;
    this.tapTimes = [];
    const n = this.extractedNotes.length;
    this.controls.setCaptured(`${kind} · ${n} ${n === 1 ? 'note' : 'notes'} · ~${extraction.tempo} BPM`);
    this.showToast(n ? `Heard ${n} notes · press Generate for drums` : 'No clear notes · Gemini will read the mood', 4000);
  }

  handleTap() {
    const info = this.tapTracker.tap();
    this.tapTimes = info.relativeTimes;
    if (info.tapsCount > 1 && info.bpm) {
      this.controls.setCaptured(`Rhythm · ${info.tapsCount} taps · ${info.bpm} BPM`);
      this.handleChangeBpm(info.bpm);
    } else {
      this.controls.setCaptured('Rhythm · keep tapping');
    }
  }

  // ---------- Gemini ----------

  async handleGenerate(promptText) {
    if (this.isBusy) return;
    // Start audio inside the click gesture, but don't make the request wait for it
    const audioReady = musicEngine.init();

    let providedHint = 'prompt';
    if (this.extractedNotes.length > 0) providedHint = 'melody';
    else if (this.tapTimes.length > 1) providedHint = 'drums';

    if (providedHint === 'prompt' && !promptText && !this.audioBase64) {
      this.showToast('Type a vibe, hum or tap first');
      document.getElementById('prompt-input').focus();
      return;
    }

    this.setBusy(true, providedHint === 'melody' ? 'Gemini is writing drums for your melody' : providedHint === 'drums' ? 'Gemini is writing a melody for your rhythm' : 'Gemini is composing');
    const response = await generateJamRequest({
      prompt: promptText,
      audioBase64: this.audioBase64,
      extractedNotes: this.extractedNotes,
      taps: this.tapTimes,
      providedHint,
      avoidPresetId: this.currentSong?.id || null,
    });
    await audioReady;
    this.setBusy(false);

    this.applySong(response.data, response, { source: 'gemini' });
    this.showToast(response.fallback ? 'Gemini unavailable · playing a matching preset' : 'New song from Gemini is playing', 4200);
  }

  async handleRefine(instruction) {
    if (!this.currentSong || this.isBusy) return;
    this.setBusy(true, 'Gemini is revising');
    const response = await refineJamRequest({ previousResult: this.currentSong, instruction });
    this.setBusy(false);

    if (response.error) {
      this.showToast('Gemini unavailable · keeping the current song', 4000);
      return;
    }
    this.applySong(response.data, response, { source: 'gemini' });
    this.showToast(`Revised: ${instruction}`);
  }

  /** Paint-back: a deliberate drag across the painting becomes a refine instruction. */
  initPaintBack() {
    let start = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    window.addEventListener('pointerup', (e) => {
      if (!start) return;
      const s = start;
      start = null;
      const rect = this.canvas.getBoundingClientRect();
      const planeH = this.renderer.plane?.h || rect.height;
      if (s.y - rect.top > planeH) return; // drags on the score do nothing

      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dist = Math.hypot(dx, dy);
      const seconds = (performance.now() - s.t) / 1000;
      if (dist < 60 || seconds < 0.15 || this.isBusy) return;

      const speed = dist / seconds;
      const endY = (e.clientY - rect.top) / planeH;
      let instruction;
      if (speed > 900) instruction = 'higher tempo, much more energetic and busier rhythms';
      else if (speed < 220) instruction = 'sparser, slower, dreamy and more ambient';
      else if (endY > 0.66) instruction = 'heavier bass, punchier low end kick, deeper mood';
      else if (endY < 0.34) instruction = 'brighter melody, sparkling textures, lighter drums';
      else instruction = dx > 0 ? 'more driving forward motion and syncopation' : 'warmer, vintage tone and laid back groove';

      this.handleRefine(instruction);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.chromajam = new ChromajamApp();
});
