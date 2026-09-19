import { safetyManager } from '../visuals/safety.js';
import { hapticController } from './haptics.js';

const STORAGE_KEY = 'chromajam_settings_v1';

export class SettingsManager {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.customizations = this.loadSettings();
  }

  loadSettings() {
    const defaults = {
      calmMode: safetyManager.calmMode,
      instrumentColors: {},
      instrumentShapes: {},
      hapticStrength: 'medium', // 'off', 'medium', 'high'
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) };
      }
    } catch (e) {}

    return defaults;
  }

  saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customizations));
    } catch (e) {}
  }

  renderDrawer(container) {
    const instruments = ['kick', 'snare', 'hat', 'clap', 'perc', 'melody', 'bass'];
    const shapes = ['circle', 'square', 'triangle', 'line', 'blob', 'star', 'diamond'];

    container.innerHTML = `
      <div class="settings-drawer-content" role="region" aria-label="Accessibility and Instrument Customization Settings">
        <div class="settings-header">
          <h3>Accessibility & Instruments</h3>
          <button id="close-settings-btn" class="icon-btn" aria-label="Close Settings Panel">&times;</button>
        </div>

        <div class="settings-section">
          <h4>Visual & Motion Safety</h4>
          <label class="toggle-control">
            <input type="checkbox" id="calm-mode-toggle" ${safetyManager.calmMode ? 'checked' : ''} />
            <span><strong>Calm Mode</strong> (Softens colors, slows motion, disables flashing)</span>
          </label>
        </div>

        ${hapticController.isSupported ? `
          <div class="settings-section">
            <h4>Haptic Feedback (Vibration)</h4>
            <label class="toggle-control">
              <input type="checkbox" id="haptics-toggle" ${hapticController.isEnabled ? 'checked' : ''} />
              <span>Enable Beat Vibration (Kick & Snare pulses)</span>
            </label>
          </div>
        ` : ''}

        <div class="settings-section">
          <h4>Instrument Visual Identifiers</h4>
          <p class="settings-hint">Each instrument is distinguished by both a color and a unique shape for accessibility.</p>
          <div class="instrument-settings-list">
            ${instruments.map(inst => `
              <div class="instrument-setting-row" data-inst="${inst}">
                <span class="inst-name">${inst.toUpperCase()}</span>
                <input type="color" class="inst-color-picker" data-inst="${inst}" aria-label="${inst} color" />
                <select class="inst-shape-select" data-inst="${inst}" aria-label="${inst} shape">
                  ${shapes.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="settings-footer">
          <button id="reset-settings-btn" class="btn btn-secondary">Reset to Defaults</button>
        </div>
      </div>
    `;

    // Hook listeners
    const calmToggle = container.querySelector('#calm-mode-toggle');
    calmToggle?.addEventListener('change', (e) => {
      safetyManager.setCalmMode(e.target.checked, true);
      this.customizations.calmMode = e.target.checked;
      this.saveSettings();
      if (this.onUpdate) this.onUpdate(this.customizations);
    });

    const hapticsToggle = container.querySelector('#haptics-toggle');
    hapticsToggle?.addEventListener('change', (e) => {
      hapticController.setEnabled(e.target.checked);
      this.saveSettings();
    });

    const closeBtn = container.querySelector('#close-settings-btn');
    closeBtn?.addEventListener('click', () => {
      container.classList.remove('open');
      document.getElementById('settings-btn')?.focus();
    });

    const resetBtn = container.querySelector('#reset-settings-btn');
    resetBtn?.addEventListener('click', () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      this.customizations = this.loadSettings();
      if (this.onUpdate) this.onUpdate(this.customizations);
      this.updateCurrentInstrumentInputs(container, {});
    });

    // Instrument color/shape listeners
    container.querySelectorAll('.inst-color-picker').forEach(input => {
      input.addEventListener('change', (e) => {
        const inst = e.target.dataset.inst;
        this.customizations.instrumentColors[inst] = e.target.value;
        this.saveSettings();
        if (this.onUpdate) this.onUpdate(this.customizations);
      });
    });

    container.querySelectorAll('.inst-shape-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const inst = e.target.dataset.inst;
        this.customizations.instrumentShapes[inst] = e.target.value;
        this.saveSettings();
        if (this.onUpdate) this.onUpdate(this.customizations);
      });
    });
  }

  updateCurrentInstrumentInputs(container, currentVisual) {
    if (!container || !currentVisual) return;
    const colors = { ...currentVisual.instrument_colors, ...this.customizations.instrumentColors };
    const shapes = { ...currentVisual.instrument_shapes, ...this.customizations.instrumentShapes };

    container.querySelectorAll('.inst-color-picker').forEach(input => {
      const inst = input.dataset.inst;
      if (colors[inst]) input.value = colors[inst];
    });

    container.querySelectorAll('.inst-shape-select').forEach(select => {
      const inst = select.dataset.inst;
      if (shapes[inst]) select.value = shapes[inst];
    });
  }
}
