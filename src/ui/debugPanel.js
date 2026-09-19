export class DebugPanel {
  constructor(container) {
    this.container = container;
    this.isOpen = false;
    this.currentData = null;
    this.render();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.container.classList.add('open');
    } else {
      this.container.classList.remove('open');
    }
  }

  update({ requestPayload, data, fallback, elapsedMs, raw, error }) {
    this.currentData = { requestPayload, data, fallback, elapsedMs, raw, error };
    this.render();
  }

  render() {
    const d = this.currentData;

    const noteCount = d?.requestPayload?.extractedNotes?.length || 0;
    const tapCount = d?.requestPayload?.taps?.length || 0;
    const promptText = d?.requestPayload?.prompt || '(none)';
    const providedHint = d?.requestPayload?.providedHint || 'prompt';
    const hasAudio = Boolean(d?.requestPayload?.audioBase64);

    this.container.innerHTML = `
      <div class="debug-panel-inner" role="region" aria-label="Gemini I/O Debugger Panel">
        <div class="debug-header">
          <div class="debug-title-wrap">
            <span class="debug-badge ${d?.fallback ? 'badge-fallback' : 'badge-gemini'}">
              ${d?.fallback ? 'FALLBACK PRESET' : 'GEMINI ACTIVE'}
            </span>
            <h3>Gemini I/O Inspector</h3>
          </div>
          <button id="close-debug-btn" class="icon-btn" aria-label="Close Debug Panel">&times;</button>
        </div>

        <div class="debug-body">
          ${d?.error ? `<div class="debug-alert">Notice: ${d.error} (Fallback safely loaded)</div>` : ''}

          <!-- Director Note -->
          <div class="debug-card director-card">
            <h4>Director Note</h4>
            <p class="director-text">${d?.data?.director_note || 'Waiting for first generation...'}</p>
          </div>

          <!-- Section 1: Input to Gemini -->
          <div class="debug-card">
            <div class="card-header">
              <h4>1. What Gemini Saw (Input)</h4>
              <span class="latency-badge">${d?.elapsedMs ? `${d.elapsedMs} ms` : 'Ready'}</span>
            </div>
            <ul class="debug-kv-list">
              <li><strong>Detected Input:</strong> <code>${providedHint}</code></li>
              <li><strong>Text Prompt:</strong> <span>${promptText}</span></li>
              <li><strong>Audio Included:</strong> <span>${hasAudio ? 'Yes (16kHz PCM WAV)' : 'No'}</span></li>
              <li><strong>Extracted Notes:</strong> <span>${noteCount} notes</span></li>
              <li><strong>Taps Recorded:</strong> <span>${tapCount} taps</span></li>
            </ul>
          </div>

          <!-- Section 2: Musical Analysis -->
          <div class="debug-card">
            <h4>2. Musical Analysis</h4>
            <div class="analysis-grid">
              <div class="metric-box">
                <span class="metric-label">Key</span>
                <span class="metric-val">${d?.data?.analysis?.key || '--'}</span>
              </div>
              <div class="metric-box">
                <span class="metric-label">Tempo</span>
                <span class="metric-val">${d?.data?.analysis?.tempo ? `${d.data.analysis.tempo} BPM` : '--'}</span>
              </div>
              <div class="metric-box">
                <span class="metric-label">Style / Texture</span>
                <span class="metric-val">${d?.data?.visual?.texture || '--'}</span>
              </div>
              <div class="metric-box">
                <span class="metric-label">Motion</span>
                <span class="metric-val">${d?.data?.visual?.motion || '--'}</span>
              </div>
            </div>
            <div class="mood-tags">
              ${(d?.data?.analysis?.mood || []).map(m => `<span class="tag">${m}</span>`).join('')}
            </div>
          </div>

          <!-- Section 3: Raw JSON Contract -->
          <div class="debug-card">
            <div class="card-header">
              <h4>3. Validated JSON Contract</h4>
              <button id="copy-json-btn" class="btn btn-xs">Copy JSON</button>
            </div>
            <pre class="json-viewer"><code>${d?.data ? JSON.stringify(d.data, null, 2) : '// No data yet'}</code></pre>
          </div>
        </div>
      </div>
    `;

    // Bind event handlers
    this.container.querySelector('#close-debug-btn')?.addEventListener('click', () => {
      this.toggle();
      document.getElementById('debug-toggle-btn')?.focus();
    });

    this.container.querySelector('#copy-json-btn')?.addEventListener('click', (e) => {
      if (d?.data) {
        navigator.clipboard.writeText(JSON.stringify(d.data, null, 2));
        const btn = e.target;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy JSON'; }, 1500);
      }
    });
  }
}
