// Vibration patterns in ms: [vibrate, pause, vibrate, ...]
export const HAPTIC_PRESETS = {
  none: { label: 'None', pattern: [] },
  tap: { label: 'Tap', pattern: [25] },
  strong: { label: 'Strong', pattern: [45] },
  double: { label: 'Double', pattern: [25, 20, 25] },
  long: { label: 'Long', pattern: [70] },
};

export const DEFAULT_HAPTICS = {
  kick: 'strong',
  snare: 'double',
  hat: 'none',
  clap: 'double',
  perc: 'tap',
  melody: 'none',
  chords: 'none',
  bass: 'long',
};

class HapticController {
  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    this.isEnabled = false;
    this.choices = { ...DEFAULT_HAPTICS };
    try {
      this.isEnabled = localStorage.getItem('chromajam_haptics_enabled') === 'true';
    } catch {}
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('chromajam_haptics_enabled', String(enabled));
    } catch {}
  }

  setChoice(instrument, presetName) {
    if (HAPTIC_PRESETS[presetName]) this.choices[instrument] = presetName;
  }

  setChoices(choices = {}) {
    this.choices = { ...DEFAULT_HAPTICS, ...choices };
  }

  trigger(instrument) {
    if (!this.isSupported || !this.isEnabled) return;
    const pattern = HAPTIC_PRESETS[this.choices[instrument]]?.pattern;
    if (pattern?.length) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }
}

export const hapticController = new HapticController();
