class HapticController {
  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    this.isEnabled = false;

    // Default patterns in ms: [vibrate, pause, vibrate, ...]
    this.patterns = {
      kick: [45],
      snare: [25, 20, 25],
      hat: [],
      clap: [20, 15, 20],
      perc: [30],
      melody: [],
      bass: [60],
    };

    // Load preference from localStorage
    try {
      const saved = localStorage.getItem('chromajam_haptics_enabled');
      if (saved !== null) {
        this.isEnabled = saved === 'true';
      }
    } catch (e) {}
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('chromajam_haptics_enabled', String(enabled));
    } catch (e) {}
  }

  trigger(instrument) {
    if (!this.isSupported || !this.isEnabled) return;
    const pattern = this.patterns[instrument];
    if (pattern && pattern.length > 0) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  setCustomPattern(instrument, patternArray) {
    if (Array.isArray(patternArray)) {
      this.patterns[instrument] = patternArray;
    }
  }
}

export const hapticController = new HapticController();
