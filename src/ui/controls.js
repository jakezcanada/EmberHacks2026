import { icons } from './icons.js';

/**
 * The composer bar: what you give Gemini (prompt, hum, taps, upload), the one
 * Generate action, then transport, examples and audio exports.
 */
export class ControlsBar {
  constructor(container, callbacks, { examples = [] } = {}) {
    this.container = container;
    this.cb = callbacks;
    this.examples = examples;
    this.bpm = 90;
    this.isPlaying = false;
    this.render();
  }

  $(sel) {
    return this.container.querySelector(sel);
  }

  setPlayState(isPlaying) {
    this.isPlaying = isPlaying;
    const btn = this.$('#play-btn');
    btn.innerHTML = isPlaying ? `${icons.stop}<span>Stop</span>` : `${icons.play}<span>Play</span>`;
    btn.setAttribute('aria-pressed', String(isPlaying));
  }

  setBpm(bpm) {
    this.bpm = bpm;
    this.$('#bpm-val').innerHTML = `${bpm}<span>BPM</span>`;
  }

  setRecordingState(isRecording, elapsed = 0, max = 15) {
    const btn = this.$('#record-btn');
    btn.classList.toggle('is-live', isRecording);
    btn.setAttribute('aria-pressed', String(isRecording));
    btn.innerHTML = isRecording
      ? `${icons.stop}<span>Stop <span class="mono">${Math.max(0, Math.ceil(max - elapsed))} s</span></span>`
      : `${icons.record}<span>Hum</span>`;
  }

  /** Shows what will be sent alongside the prompt (a hummed melody, taps, a file). */
  setCaptured(text) {
    const chip = this.$('#captured');
    if (!text) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    chip.querySelector('.captured-text').textContent = text;
  }

  setUserAudioAvailable(hasAudio) {
    this.$('#source-toggle').hidden = !hasAudio;
    this.$('#download-mp3-btn').disabled = false;
  }

  setUserAudioMode(playMine) {
    this.container.querySelectorAll('#source-toggle button').forEach((b) => {
      b.setAttribute('aria-pressed', String((b.dataset.src === 'mine') === playMine));
    });
  }

  setLoading(isLoading) {
    const btn = this.$('#generate-btn');
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Composing…' : 'Generate';
    this.container.querySelectorAll('[data-refine], .examples button').forEach((b) => (b.disabled = isLoading));
  }

  render() {
    this.container.innerHTML = `
      <div class="composer-inner">
        <div class="compose-row">
          <div class="prompt-field">
            <label class="visually-hidden" for="prompt-input">Describe a vibe for Gemini</label>
            <input type="text" id="prompt-input" class="prompt-input" autocomplete="off"
              placeholder="Describe a vibe: rainy lo-fi with soft keys" />
            <span id="captured" class="captured" hidden>
              <span class="captured-text"></span>
              <button type="button" id="clear-captured" class="captured-clear" aria-label="Remove captured input">${icons.close}</button>
            </span>
          </div>
          <div class="input-tools" role="group" aria-label="Or give it half a song">
            <button type="button" id="record-btn" class="btn" aria-pressed="false">${icons.record}<span>Hum</span></button>
            <button type="button" id="tap-btn" class="btn" aria-keyshortcuts="T">${icons.tap}<span>Tap</span></button>
            <button type="button" id="upload-btn" class="btn">${icons.upload}<span>Upload</span></button>
            <input type="file" id="audio-file-input" class="visually-hidden" accept="audio/*" tabindex="-1" aria-hidden="true" />
          </div>
          <button type="button" id="generate-btn" class="btn btn-generate">Generate</button>
        </div>

        <div class="play-row">
          <div class="transport">
            <button type="button" id="play-btn" class="btn btn-play" aria-pressed="false" aria-keyshortcuts="Space">${icons.play}<span>Play</span></button>
            <div class="tempo" role="group" aria-label="Tempo">
              <button type="button" id="bpm-minus-btn" class="tempo-step" aria-label="Slower by 5 BPM">${icons.minus}</button>
              <output id="bpm-val" class="bpm" aria-live="off">${this.bpm}<span>BPM</span></output>
              <button type="button" id="bpm-plus-btn" class="tempo-step" aria-label="Faster by 5 BPM">${icons.plus}</button>
            </div>
            <div id="source-toggle" class="segmented" role="group" aria-label="Melody plays from" hidden>
              <button type="button" data-src="mine" aria-pressed="false">My recording</button>
              <button type="button" data-src="synth" aria-pressed="true">Synth</button>
            </div>
          </div>
          <div class="examples" role="group" aria-label="Example songs">
            <span class="examples-label" aria-hidden="true">Examples</span>
            ${this.examples.map((ex) => `<button type="button" data-example="${ex.index}">${ex.label}</button>`).join('')}
          </div>
          <button type="button" id="download-midi-btn" class="btn btn-quiet">${icons.download}<span>Download .mid</span></button>
          <button type="button" id="download-mp3-btn" class="btn btn-quiet">${icons.download}<span>Download .mp3</span></button>
        </div>
      </div>
    `;

    const prompt = this.$('#prompt-input');
    prompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.$('#generate-btn').disabled) this.cb.onGenerate(prompt.value.trim());
    });
    this.$('#generate-btn').addEventListener('click', () => this.cb.onGenerate(prompt.value.trim()));
    this.$('#record-btn').addEventListener('click', () => this.cb.onToggleRecord());
    this.$('#tap-btn').addEventListener('click', () => this.cb.onTap());

    const fileInput = this.$('#audio-file-input');
    this.$('#upload-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.cb.onFileUpload(file);
      fileInput.value = '';
    });
    this.$('#clear-captured').addEventListener('click', () => {
      this.cb.onClearCapture();
      prompt.focus();
    });

    this.$('#play-btn').addEventListener('click', () => this.cb.onTogglePlay());
    this.$('#bpm-minus-btn').addEventListener('click', () => this.cb.onChangeBpm(this.bpm - 5));
    this.$('#bpm-plus-btn').addEventListener('click', () => this.cb.onChangeBpm(this.bpm + 5));
    this.container.querySelectorAll('#source-toggle button').forEach((b) => {
      b.addEventListener('click', () => {
        const mine = b.dataset.src === 'mine';
        this.setUserAudioMode(mine);
        this.cb.onToggleUserAudio(mine);
      });
    });
    this.container.querySelectorAll('[data-example]').forEach((b) => {
      b.addEventListener('click', () => this.cb.onExample(Number(b.dataset.example)));
    });
    this.$('#download-midi-btn').addEventListener('click', () => this.cb.onDownloadMidi());
    this.$('#download-mp3-btn').addEventListener('click', () => this.cb.onDownloadMp3());
  }
}
