export class ControlsBar {
  constructor(container, callbacks) {
    this.container = container;
    this.cb = callbacks;
    this.isRecording = false;
    this.isPlaying = false;
    this.bpm = 90;
    this.hasUserAudio = false;
    this.playUserAudio = false;
    this.render();
  }

  setPlayState(isPlaying) {
    this.isPlaying = isPlaying;
    const playBtn = this.container.querySelector('#play-btn');
    if (playBtn) {
      playBtn.innerHTML = isPlaying
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Stop</span>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Play</span>`;
      playBtn.setAttribute('aria-label', isPlaying ? 'Stop playback' : 'Start playback');
    }
  }

  setBpm(bpm) {
    this.bpm = bpm;
    const bpmReadout = this.container.querySelector('#bpm-val');
    if (bpmReadout) {
      bpmReadout.textContent = `${bpm} BPM`;
    }
  }

  setRecordingState(isRecording, elapsed = 0, max = 15) {
    this.isRecording = isRecording;
    const recordBtn = this.container.querySelector('#record-btn');
    if (recordBtn) {
      if (isRecording) {
        recordBtn.classList.add('btn-recording');
        recordBtn.innerHTML = `<span class="rec-dot"></span><span>Stop (${Math.ceil(max - elapsed)}s)</span>`;
      } else {
        recordBtn.classList.remove('btn-recording');
        recordBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg><span>Hum / Record</span>`;
      }
    }
  }

  setTapState(tapCount, bpm) {
    const tapBtn = this.container.querySelector('#tap-pad-btn');
    if (tapBtn) {
      if (tapCount > 1 && bpm) {
        tapBtn.textContent = `Tap (${bpm} BPM)`;
      } else if (tapCount === 1) {
        tapBtn.textContent = 'Tap Again...';
      } else {
        tapBtn.textContent = 'Tap Rhythm';
      }
    }
  }

  setUserAudioAvailable(hasAudio) {
    this.hasUserAudio = hasAudio;
    const toggleWrap = this.container.querySelector('#audio-source-toggle-wrap');
    if (toggleWrap) {
      toggleWrap.style.display = hasAudio ? 'inline-flex' : 'none';
    }
  }

  setLoading(isLoading) {
    const genBtn = this.container.querySelector('#generate-btn');
    if (genBtn) {
      genBtn.disabled = isLoading;
      genBtn.innerHTML = isLoading
        ? `<span class="spinner"></span><span>Creating Jam...</span>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg><span>Generate</span>`;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="controls-wrapper" role="toolbar" aria-label="Music and Generation Controls">
        <!-- Input row -->
        <div class="controls-input-row">
          <div class="prompt-input-group">
            <input
              type="text"
              id="prompt-input"
              class="prompt-input"
              placeholder="Describe a vibe (e.g. 'moody lo-fi hip hop with rainy keys', 'high energy synthwave')..."
              aria-label="Text prompt for music generation"
            />
            <button id="generate-btn" class="btn btn-primary" aria-label="Generate music with Gemini">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>
              <span>Generate</span>
            </button>
          </div>

          <div class="input-actions-group">
            <button id="record-btn" class="btn btn-action" aria-label="Record hum or rhythm from microphone">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
              <span>Hum / Record</span>
            </button>

            <label class="btn btn-action btn-upload" aria-label="Upload audio file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload</span>
              <input type="file" id="audio-file-input" accept="audio/*" style="display: none;" />
            </label>

            <button id="tap-pad-btn" class="btn btn-action" aria-label="Tap tempo or rhythm pad">
              Tap Rhythm
            </button>
          </div>
        </div>

        <!-- Playback & quick actions bar -->
        <div class="controls-playback-row">
          <div class="playback-controls">
            <button id="play-btn" class="btn btn-play" aria-label="Play or Stop Jam">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Play</span>
            </button>

            <div class="tempo-control" aria-label="Tempo control">
              <button id="bpm-minus-btn" class="btn-micro" aria-label="Decrease tempo">-</button>
              <span id="bpm-val" class="bpm-readout">${this.bpm} BPM</span>
              <button id="bpm-plus-btn" class="btn-micro" aria-label="Increase tempo">+</button>
            </div>

            <div id="audio-source-toggle-wrap" class="toggle-wrap" style="display: none;">
              <label class="toggle-label" title="Toggle between playing your original audio or synthesized notes">
                <input type="checkbox" id="audio-source-toggle" />
                <span class="toggle-text">Play My Audio</span>
              </label>
            </div>
          </div>

          <div class="refine-controls">
            <button id="refine-more-energy-btn" class="btn btn-refine" aria-label="Refine jam with more energy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>More Energy</span>
            </button>
            <button id="refine-another-take-btn" class="btn btn-refine" aria-label="Request another take">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              <span>Another Take</span>
            </button>
          </div>

          <div class="utility-controls">
            <button id="download-midi-btn" class="btn btn-outline" aria-label="Download generated pattern as MIDI file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Download .MID</span>
            </button>
            <button id="settings-btn" class="icon-btn" aria-label="Open Settings and Accessibility Panel" title="Accessibility & Settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button id="debug-toggle-btn" class="icon-btn" aria-label="Toggle Gemini I/O Inspector Panel" title="Gemini I/O Debugger">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind listeners
    const promptInput = this.container.querySelector('#prompt-input');
    promptInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.cb.onGenerate(promptInput.value);
      }
    });

    this.container.querySelector('#generate-btn')?.addEventListener('click', () => {
      this.cb.onGenerate(promptInput.value);
    });

    this.container.querySelector('#record-btn')?.addEventListener('click', () => {
      this.cb.onToggleRecord();
    });

    this.container.querySelector('#audio-file-input')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.cb.onFileUpload(e.target.files[0]);
      }
    });

    this.container.querySelector('#tap-pad-btn')?.addEventListener('click', () => {
      this.cb.onTap();
    });

    this.container.querySelector('#play-btn')?.addEventListener('click', () => {
      this.cb.onTogglePlay();
    });

    this.container.querySelector('#bpm-minus-btn')?.addEventListener('click', () => {
      this.cb.onChangeBpm(this.bpm - 5);
    });

    this.container.querySelector('#bpm-plus-btn')?.addEventListener('click', () => {
      this.cb.onChangeBpm(this.bpm + 5);
    });

    this.container.querySelector('#audio-source-toggle')?.addEventListener('change', (e) => {
      this.playUserAudio = e.target.checked;
      this.cb.onToggleUserAudio(e.target.checked);
    });

    this.container.querySelector('#refine-more-energy-btn')?.addEventListener('click', () => {
      this.cb.onRefine('same vibe, more energy');
    });

    this.container.querySelector('#refine-another-take-btn')?.addEventListener('click', () => {
      this.cb.onRefine('create another take with different variations and fills');
    });

    this.container.querySelector('#download-midi-btn')?.addEventListener('click', () => {
      this.cb.onDownloadMidi();
    });

    this.container.querySelector('#settings-btn')?.addEventListener('click', () => {
      this.cb.onToggleSettings();
    });

    this.container.querySelector('#debug-toggle-btn')?.addEventListener('click', () => {
      this.cb.onToggleDebug();
    });
  }
}
