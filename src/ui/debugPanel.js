import { icons } from './icons.js';
import { escapeHtml } from './escape.js';

/**
 * The Gemini I/O tab: exactly what went in, what came back, and whether the
 * result is live Gemini output or a fallback preset.
 */
export class DebugPanel {
  constructor(container) {
    this.container = container;
    this.current = null;
  }

  update({ requestPayload = {}, data, fallback, elapsedMs, error, audioDuration, source, model } = {}) {
    this.current = { requestPayload, data, fallback, elapsedMs, error, audioDuration, source, model };
    this.render();
  }

  render() {
    const d = this.current;
    if (!d) return;
    const req = d.requestPayload || {};
    const isExample = d.source === 'example';
    const notes = req.extractedNotes?.length || 0;
    const taps = req.taps?.length || 0;
    const audio = req.audioBase64 ? `${(d.audioDuration || 0).toFixed(1)} s, 16 kHz mono WAV` : 'None';
    const json = d.data ? JSON.stringify(stripInternal(d.data), null, 2) : '';

    let status;
    if (isExample) status = { cls: 'is-fallback', label: 'Example preset', detail: 'Hand-written preset loaded locally. Gemini was not called.' };
    else if (d.fallback) status = { cls: 'is-fallback', label: 'Fallback preset', detail: explain(d.error) };
    else status = { cls: 'is-live', label: 'Gemini', detail: `Validated response from ${d.model || 'Gemini'} in ${formatMs(d.elapsedMs)}.` };

    this.container.innerHTML = `
      <div class="io">
        <p class="io-status ${status.cls}"><span class="state-mark" aria-hidden="true"></span><strong>${status.label}</strong><span>${escapeHtml(status.detail)}</span></p>

        ${isExample ? `
        <h3 class="sheet-heading">What Gemini heard</h3>
        <p class="hint">Nothing was sent. Type a vibe, tap a rhythm, or upload a clip, then press Generate to see exactly what goes to Gemini.</p>
        ` : `
        <h3 class="sheet-heading">What Gemini heard</h3>
        <dl class="kv">
          <div><dt>Detected input</dt><dd class="mono">${escapeHtml(req.providedHint || 'prompt')}</dd></div>
          <div><dt>Prompt</dt><dd>${req.prompt ? `“${escapeHtml(req.prompt)}”` : '<span class="muted">None</span>'}</dd></div>
          <div><dt>Audio</dt><dd>${escapeHtml(audio)}</dd></div>
          <div><dt>Extracted notes</dt><dd class="mono">${notes}</dd></div>
          <div><dt>Taps</dt><dd class="mono">${taps}</dd></div>
        </dl>`}

        <h3 class="sheet-heading">${isExample ? 'Preset data' : d.fallback ? 'What was played instead' : 'What Gemini returned'}</h3>
        ${d.data?.director_note ? `<blockquote class="director-note">${escapeHtml(d.data.director_note)}</blockquote>` : ''}
        <div class="json-head">
          <span class="mono">response.json</span>
          <button type="button" id="copy-json-btn" class="btn btn-small">${icons.copy}<span>Copy JSON</span></button>
        </div>
        <pre class="json" tabindex="0" aria-label="Validated JSON returned by Gemini"><code>${escapeHtml(json)}</code></pre>
      </div>
    `;

    this.container.querySelector('#copy-json-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(json);
        btn.querySelector('span').textContent = 'Copied';
      } catch {
        btn.querySelector('span').textContent = 'Copy failed';
      }
      setTimeout(() => (btn.querySelector('span').textContent = 'Copy JSON'), 1500);
    });
  }
}

function stripInternal(data) {
  const { id, ...rest } = data;
  return rest;
}

function formatMs(ms) {
  if (!ms) return 'under a second';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Turn API errors into one plain sentence. */
function explain(error) {
  if (!error) return 'Gemini was unavailable, so a matching preset was loaded instead.';
  const e = String(error).toLowerCase();
  if (e.includes('api key') || e.includes('permission') || e.includes('401') || e.includes('403')) return 'The Gemini API key was rejected. Using a matching preset.';
  if (e.includes('503') || e.includes('unavailable') || e.includes('high demand')) return 'Gemini is overloaded right now (high demand). Using a matching preset; try again in a moment.';
  if (e.includes('429') || e.includes('quota') || e.includes('rate')) return 'Gemini is rate-limited right now. Using a matching preset.';
  if (e.includes('timeout') || e.includes('timed out') || e.includes('abort')) return 'Gemini took longer than 10 seconds. Using a matching preset.';
  if (e.includes('fetch') || e.includes('network') || e.includes('http')) return 'Could not reach the server. Using a matching preset.';
  if (e.includes('404') || e.includes('not found')) return 'The configured Gemini model is not available. Using a matching preset.';
  return 'Gemini returned something unusable, so a matching preset was loaded instead.';
}
