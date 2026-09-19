import { generateJamRequest, refineJamRequest } from './api/client.js';
import { musicEngine } from './music/engine.js';
import { exportMidiFile } from './music/midi.js';
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
import fallbackPresets from './fallback/presets.json';

class ChromajamApp {
  constructor() {
    this.currentSong = null;
    this.audioBase64 = null;
    this.extractedNotes = [];
    this.recordedAudioBuffer = null;
    this.recorder = new AudioRecorder(15);
    this.tapTracker = new TapTracker();
    this.tapTimes = [];

    // Canvas & Visual Renderer
    this.canvas = document.getElementById('visual-canvas');
    this.renderer = new VisualRenderer(this.canvas);
    this.renderer.setAnalyserSource(() => musicEngine.getAnalyserData());

    // UI Drawers
    this.settingsDrawer = document.getElementById('settings-drawer');
    this.debugDrawer = document.getElementById('debug-drawer');
    this.controlsContainer = document.getElementById('controls-container');

    // Modules
    this.debugPanel = new DebugPanel(this.debugDrawer);
    this.settingsManager = new SettingsManager((customs) => {
      this.renderer.setVisualConfig({
        instrument_colors: customs.instrumentColors,
        instrument_shapes: customs.instrumentShapes,
      });
    });
    this.settingsManager.renderDrawer(this.settingsDrawer);

    // Controls Bar
    this.controls = new ControlsBar(this.controlsContainer, {
      onGenerate: (prompt) => this.handleGenerate(prompt),
      onRefine: (inst) => this.handleRefine(inst),
      onToggleRecord: () => this.handleToggleRecord(),
      onFileUpload: (file) => this.handleFileUpload(file),
      onTap: () => this.handleTap(),
      onTogglePlay: () => this.handleTogglePlay(),
      onChangeBpm: (bpm) => this.handleChangeBpm(bpm),
      onToggleUserAudio: (playAudio) => musicEngine.setPlayUserAudio(playAudio),
      onDownloadMidi: () => exportMidiFile(this.currentSong, `${this.currentSong?.analysis?.genre_hint?.replace(/\s+/g, '_') || 'chromajam'}.mid`),
      onToggleSettings: () => this.toggleSettings(),
      onToggleDebug: () => this.debugPanel.toggle(),
    });

    // Wire up music engine events
    musicEngine.on('note', (event) => {
      this.renderer.handleNoteEvent(event);
      hapticController.trigger(event.instrument);
    });

    musicEngine.on('step', ({ step, totalSteps }) => {
      this.renderer.setPlayheadStep(step, totalSteps);
    });

    musicEngine.on('state', ({ isPlaying }) => {
      this.controls.setPlayState(isPlaying);
    });

    // Wire header preset chips for instant 30-second first-time experience
    this.initHeaderPresets();

    // Wire keyboard navigation and accessibility shortcuts
    this.initKeyboardShortcuts();

    // Wire canvas drag gestures (Phase 6 Paint-Back stretch)
    this.initCanvasPaintBack();

    // Start rendering loop
    this.renderer.start();

    // Load initial default preset so canvas is instantly alive
    this.loadInitialSong(fallbackPresets[0]);
  }

  showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast-message');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }

  showLoading(show, message = 'Gemini is listening and composing...') {
    const overlay = document.getElementById('loading-overlay');
    const msgEl = document.getElementById('loading-message');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
    if (msgEl) msgEl.textContent = message;
    this.controls.setLoading(show);
  }

  loadInitialSong(preset) {
    this.currentSong = preset;
    musicEngine.loadSong(preset);
    this.renderer.setVisualConfig(preset.visual);
    this.controls.setBpm(preset.analysis?.tempo || 90);
    this.debugPanel.update({
      requestPayload: { prompt: 'Default Lo-Fi Groove', providedHint: 'prompt' },
      data: preset,
      fallback: true,
      elapsedMs: 0,
    });
  }

  initHeaderPresets() {
    const presetMap = {
      'header-preset-lofi': 0,
      'header-preset-synth': 1,
      'header-preset-trap': 2,
      'header-preset-ambient': 3,
    };

    for (const [btnId, idx] of Object.entries(presetMap)) {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const preset = fallbackPresets[idx];
        if (preset) {
          this.applyNewSong(preset, {
            requestPayload: { prompt: `Preset: ${preset.analysis.genre_hint}`, providedHint: preset.analysis.provided },
            data: preset,
            fallback: true,
            elapsedMs: 0,
          });
          this.showToast(`Loaded ${preset.analysis.genre_hint} preset`);
        }
      });
    }
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.handleTogglePlay();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this.debugPanel.toggle();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.toggleSettings();
      } else if (e.key === 'Escape') {
        this.settingsDrawer.classList.remove('open');
        this.debugDrawer.classList.remove('open');
      }
    });
  }

  toggleSettings() {
    const isOpen = this.settingsDrawer.classList.contains('open');
    if (isOpen) {
      this.settingsDrawer.classList.remove('open');
    } else {
      this.settingsDrawer.classList.add('open');
      this.settingsManager.updateCurrentInstrumentInputs(
        this.settingsDrawer,
        this.currentSong?.visual
      );
    }
  }

  async handleTogglePlay() {
    await musicEngine.init();
    musicEngine.togglePlay();
  }

  handleChangeBpm(newBpm) {
    musicEngine.setBpm(newBpm);
    this.controls.setBpm(musicEngine.bpm);
  }

  async handleToggleRecord() {
    if (this.recorder.isRecording) {
      this.recorder.stop();
      return;
    }

    try {
      this.controls.setRecordingState(true, 0, 15);
      this.showToast('Recording... Hum a melody or tap a rhythm');

      const audioBlob = await this.recorder.start((elapsed, max) => {
        this.controls.setRecordingState(true, elapsed, max);
      });

      this.controls.setRecordingState(false);
      this.showLoading(true, 'Processing audio & extracting notes...');

      const { base64, duration, pcmData, audioBuffer } = await processAudioToWav(audioBlob);
      this.audioBase64 = base64;
      this.recordedAudioBuffer = audioBuffer;
      musicEngine.setUserAudio(audioBuffer);
      this.controls.setUserAudioAvailable(true);

      const extraction = extractNotesFromAudio(pcmData, 16000);
      this.extractedNotes = extraction.notes;

      this.showLoading(false);
      this.showToast(`Extracted ${this.extractedNotes.length} notes (est. ${extraction.tempo} BPM). Ready to generate!`);
    } catch (err) {
      this.controls.setRecordingState(false);
      this.showLoading(false);
      console.error('Microphone error:', err);
      this.showToast('Microphone access denied or failed. You can still type prompts or upload audio.');
    }
  }

  async handleFileUpload(file) {
    if (!file) return;
    try {
      this.showLoading(true, 'Reading and decoding audio file...');
      const { base64, duration, pcmData, audioBuffer } = await processAudioToWav(file);
      this.audioBase64 = base64;
      this.recordedAudioBuffer = audioBuffer;
      musicEngine.setUserAudio(audioBuffer);
      this.controls.setUserAudioAvailable(true);

      const extraction = extractNotesFromAudio(pcmData, 16000);
      this.extractedNotes = extraction.notes;

      this.showLoading(false);
      this.showToast(`Loaded audio: ${this.extractedNotes.length} notes extracted (est. ${extraction.tempo} BPM).`);
    } catch (err) {
      this.showLoading(false);
      console.error('File processing error:', err);
      this.showToast('Could not process audio file.');
    }
  }

  handleTap() {
    const tapInfo = this.tapTracker.tap();
    this.tapTimes = tapInfo.relativeTimes;
    this.controls.setTapState(tapInfo.tapsCount, tapInfo.bpm);

    if (tapInfo.bpm) {
      this.handleChangeBpm(tapInfo.bpm);
    }
  }

  async handleGenerate(promptText) {
    await musicEngine.init();

    // Determine hint
    let providedHint = 'prompt';
    if (this.extractedNotes.length > 0) {
      providedHint = 'melody';
    } else if (this.tapTimes.length > 1) {
      providedHint = 'drums';
    }

    this.showLoading(true, 'Gemini is composing your missing half and visual style...');

    try {
      const response = await generateJamRequest({
        prompt: promptText,
        audioBase64: this.audioBase64,
        extractedNotes: this.extractedNotes,
        taps: this.tapTimes,
        providedHint,
      });

      this.showLoading(false);
      this.applyNewSong(response.data, response);

      if (response.fallback) {
        this.showToast('Fallback preset loaded (offline or rate limit safe)');
      } else {
        this.showToast('Gemini generation complete! Jam is live.');
      }
    } catch (err) {
      this.showLoading(false);
      console.error('Generate failed:', err);
      this.showToast('Error generating jam. Loaded safe fallback.');
    }
  }

  async handleRefine(instruction) {
    if (!this.currentSong) return;

    this.showLoading(true, `Refining jam: "${instruction}"...`);

    try {
      const response = await refineJamRequest({
        previousResult: this.currentSong,
        instruction,
      });

      this.showLoading(false);
      this.applyNewSong(response.data, response);
      this.showToast(`Refined: ${instruction}`);
    } catch (err) {
      this.showLoading(false);
      console.error('Refine failed:', err);
      this.showToast('Refinement failed.');
    }
  }

  applyNewSong(songData, responseMetadata) {
    this.currentSong = songData;
    musicEngine.loadSong(songData);

    const mergedVisual = {
      ...songData.visual,
      instrument_colors: {
        ...songData.visual?.instrument_colors,
        ...this.settingsManager.customizations.instrumentColors,
      },
      instrument_shapes: {
        ...songData.visual?.instrument_shapes,
        ...this.settingsManager.customizations.instrumentShapes,
      },
    };

    this.renderer.setVisualConfig(mergedVisual);
    this.controls.setBpm(songData.analysis?.tempo || 90);

    if (responseMetadata) {
      this.debugPanel.update(responseMetadata);
    }

    if (!musicEngine.isPlaying) {
      musicEngine.play();
    }
  }

  /**
   * Phase 6 Paint-Back: drag gestures on canvas re-shape the music via /api/refine
   */
  initCanvasPaintBack() {
    let isDragging = false;
    let startX = 0, startY = 0;
    let startTime = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTime = performance.now();
    });

    window.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.hypot(dx, dy);
      const duration = (performance.now() - startTime) / 1000;

      // Only trigger if a deliberate drag occurred
      if (dist < 40 || duration < 0.15) return;

      const speed = dist / duration;
      const endYRatio = e.clientY / window.innerHeight;

      let instruction = '';
      if (speed > 450) {
        instruction = 'higher tempo, much more energetic and busier rhythms';
      } else if (speed < 150) {
        instruction = 'sparser, slower, dreamy and more ambient';
      } else if (endYRatio > 0.65) {
        instruction = 'heavier bass, punchier low end kick, deeper mood';
      } else if (endYRatio < 0.35) {
        instruction = 'brighter melody, sparkling textures, lighter drums';
      } else {
        instruction = dx > 0 ? 'more driving forward motion and syncopation' : 'warmer, vintage tone and laid back groove';
      }

      this.showToast(`Canvas gesture: "${instruction}"`);
      this.handleRefine(instruction);
    });
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.chromajam = new ChromajamApp();
});
