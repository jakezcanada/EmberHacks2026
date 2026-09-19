import { safetyManager } from '../visuals/safety.js';
import { hapticController, HAPTIC_PRESETS, DEFAULT_HAPTICS } from './haptics.js';
import { LANES } from '../visuals/lanes.js';
import { SHAPES } from '../visuals/shapes.js';
import { glyphSvg } from '../ui/songSheet.js';

const STORAGE_KEY = 'chromajam_settings_v2';

/**
 * The Access tab: calm mode, haptics, and a per-instrument color, shape and
 * vibration mapping. Choices persist in localStorage and override Gemini's.
 */
export class SettingsManager {
  constructor({ onVisualChange, onCalmChange, onAudioChange }) {
    this.onVisualChange = onVisualChange;
    this.onCalmChange = onCalmChange;
    this.onAudioChange = onAudioChange;
    this.customizations = this.load();
    if (typeof this.customizations.calmMode === 'boolean') {
      safetyManager.setCalmMode(this.customizations.calmMode, true);
    }
    hapticController.setChoices(this.customizations.hapticPatterns);
  }

  load() {
    const defaults = { calmMode: null, fluctuations: true, instrumentColors: {}, instrumentShapes: {}, instrumentVolumes: {}, hapticPatterns: {} };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...defaults, ...JSON.parse(stored) };
    } catch {}
    return defaults;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customizations));
    } catch {}
  }

  setCalm(enabled) {
    safetyManager.setCalmMode(enabled, true);
    this.customizations.calmMode = enabled;
    this.save();
    const toggle = this.container?.querySelector('#calm-toggle');
    if (toggle) toggle.setAttribute('aria-checked', String(enabled));
    this.onCalmChange?.(enabled);
  }

  render(container, visual = {}) {
    this.container = container;
    this.visual = visual;
    const colors = { ...visual.instrument_colors, ...this.customizations.instrumentColors };
    const shapes = { ...visual.instrument_shapes, ...this.customizations.instrumentShapes };
    const haptics = { ...DEFAULT_HAPTICS, ...this.customizations.hapticPatterns };
    const volumes = { ...this.customizations.instrumentVolumes };

    container.innerHTML = `
      <div class="access">
        <h3 class="sheet-heading">Motion safety</h3>
        <div class="switch-row">
          <button type="button" role="switch" id="fluctuations-toggle" class="switch" aria-checked="${this.customizations.fluctuations !== false}" aria-describedby="fluctuations-desc"><span aria-hidden="true"></span></button>
          <div>
            <p class="switch-label">Note fluctuations</p>
            <p class="hint" id="fluctuations-desc">Allow live variations such as passing notes, octave jumps and ghost hits.</p>
          </div>
        </div>
        <div class="switch-row">
          <button type="button" role="switch" id="calm-toggle" class="switch" aria-checked="${safetyManager.calmMode}" aria-describedby="calm-desc"><span aria-hidden="true"></span></button>
          <div>
            <p class="switch-label" id="calm-label">Calm mode</p>
            <p class="hint" id="calm-desc">Slower, smaller marks and no whole-plane pulses. Flashes are always capped at 3 per second. Turns on by itself when your system asks for reduced motion.</p>
          </div>
        </div>

        ${hapticController.isSupported ? `
        <div class="switch-row">
          <button type="button" role="switch" id="haptics-toggle" class="switch" aria-checked="${hapticController.isEnabled}" aria-describedby="haptics-desc"><span aria-hidden="true"></span></button>
          <div>
            <p class="switch-label">Vibrate on the beat</p>
            <p class="hint" id="haptics-desc">Each instrument can have its own pattern, set below.</p>
          </div>
        </div>` : ''}

        <h3 class="sheet-heading">Instruments</h3>
        <p class="hint">Every instrument keeps a color, a shape and a line of its own. Your choices here override Gemini's.</p>
        <table class="mapping">
          <thead><tr><th scope="col">Instrument</th><th scope="col">Color</th><th scope="col">Shape</th><th scope="col">Volume</th>${hapticController.isSupported ? '<th scope="col">Vibration</th>' : ''}</tr></thead>
          <tbody>
            ${LANES.map((lane) => `
              <tr data-inst="${lane.id}">
                <th scope="row"><span class="mapping-glyph">${glyphSvg(shapes[lane.id], colors[lane.id], { size: 20 })}</span>${lane.label}</th>
                <td><input type="color" data-kind="color" value="${colors[lane.id] || '#888888'}" aria-label="${lane.label} color" /></td>
                <td><select data-kind="shape" aria-label="${lane.label} shape">
                  ${SHAPES.map((s) => `<option value="${s}" ${s === shapes[lane.id] ? 'selected' : ''}>${s}</option>`).join('')}
                </select></td>
                <td><input type="range" data-kind="volume" min="0" max="1" step="0.01" value="${volumes[lane.id] ?? 1}" aria-label="${lane.label} volume" /></td>
                ${hapticController.isSupported ? `<td><select data-kind="haptic" aria-label="${lane.label} vibration">
                  ${Object.entries(HAPTIC_PRESETS).map(([k, p]) => `<option value="${k}" ${k === haptics[lane.id] ? 'selected' : ''}>${p.label}</option>`).join('')}
                </select></td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
        <button type="button" id="reset-settings-btn" class="btn btn-quiet">Reset to Gemini's choices</button>
      </div>
    `;

    container.querySelector('#calm-toggle').addEventListener('click', () => this.setCalm(!safetyManager.calmMode));
    container.querySelector('#fluctuations-toggle').addEventListener('click', (event) => {
      const next = this.customizations.fluctuations === false;
      this.customizations.fluctuations = next;
      event.currentTarget.setAttribute('aria-checked', String(next));
      this.save();
      this.onAudioChange?.({ fluctuations: next, volumes: this.customizations.instrumentVolumes });
    });

    container.querySelector('#haptics-toggle')?.addEventListener('click', (e) => {
      const next = !hapticController.isEnabled;
      hapticController.setEnabled(next);
      e.currentTarget.setAttribute('aria-checked', String(next));
    });

    container.querySelectorAll('.mapping [data-kind]').forEach((input) => {
      const inst = input.closest('tr').dataset.inst;
      input.addEventListener(input.type === 'color' ? 'input' : 'change', () => {
        const kind = input.dataset.kind;
        if (kind === 'color') this.customizations.instrumentColors[inst] = input.value;
        if (kind === 'shape') this.customizations.instrumentShapes[inst] = input.value;
        if (kind === 'volume') this.customizations.instrumentVolumes[inst] = Number(input.value);
        if (kind === 'haptic') {
          this.customizations.hapticPatterns[inst] = input.value;
          hapticController.setChoice(inst, input.value);
        }
        this.save();
        if (kind === 'volume') this.onAudioChange?.({ fluctuations: this.customizations.fluctuations !== false, volumes: this.customizations.instrumentVolumes });
        if (kind !== 'haptic' && kind !== 'volume') {
          const row = input.closest('tr');
          const c = row.querySelector('[data-kind="color"]').value;
          const s = row.querySelector('[data-kind="shape"]').value;
          row.querySelector('.mapping-glyph').innerHTML = glyphSvg(s, c, { size: 20 });
          this.onVisualChange?.();
        }
      });
    });

    container.querySelector('#reset-settings-btn').addEventListener('click', () => {
      this.customizations = { calmMode: this.customizations.calmMode, fluctuations: true, instrumentColors: {}, instrumentShapes: {}, instrumentVolumes: {}, hapticPatterns: {} };
      hapticController.setChoices({});
      this.save();
      this.onVisualChange?.();
      this.onAudioChange?.({ fluctuations: true, volumes: {} });
      this.render(container, this.visual);
      container.querySelector('#reset-settings-btn').focus();
    });
  }
}
