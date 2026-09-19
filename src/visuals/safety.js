/**
 * Safety module enforcing WCAG 2.3.1 flash rate limits (< 3 flashes / second)
 * and managing Calm Mode for photosensitive users.
 */
class SafetyManager {
  constructor() {
    this.flashTimestamps = [];
    this.maxFlashesPerSecond = 3;
    this.calmMode = false;
    this.userOverrodeCalmMode = false;

    // Detect system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.systemPrefersReduced = prefersReduced.matches;
      this.calmMode = prefersReduced.matches;
      prefersReduced.addEventListener('change', (e) => {
        this.systemPrefersReduced = e.matches;
        if (!this.userOverrodeCalmMode) {
          this.calmMode = e.matches;
        }
      });
    }
  }

  setCalmMode(enabled, isUserAction = true) {
    this.calmMode = enabled;
    if (isUserAction) {
      this.userOverrodeCalmMode = true;
    }
  }

  evaluateSongRecommendation(calmModeRecommended) {
    // Follow each song's recommendation (and the system setting) until the user picks for themselves
    if (!this.userOverrodeCalmMode) {
      this.calmMode = Boolean(calmModeRecommended) || Boolean(this.systemPrefersReduced);
    }
  }

  /**
   * Checks if an energy spike / flash is permitted.
   * Returns clamped luminance multiplier (0.0 to 1.0).
   */
  allowFlash(energyDelta) {
    if (this.calmMode) {
      return 0.2; // Strictly soften any burst in calm mode
    }

    const now = performance.now();
    // Keep timestamps from the last 1000ms
    this.flashTimestamps = this.flashTimestamps.filter(t => now - t < 1000);

    if (energyDelta > 0.4) {
      if (this.flashTimestamps.length >= this.maxFlashesPerSecond) {
        // Suppress flash to prevent exceeding 3/sec
        return 0.25;
      }
      this.flashTimestamps.push(now);
      return 1.0;
    }

    return 1.0;
  }
}

export const safetyManager = new SafetyManager();
