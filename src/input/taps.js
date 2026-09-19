/**
 * Tap-tempo and rhythm capture tracker.
 */
export class TapTracker {
  constructor() {
    this.tapTimes = [];
    this.maxTaps = 16;
    this.timeoutMs = 2500;
    this.lastTapTime = 0;
  }

  tap() {
    const now = performance.now();

    // Reset if user paused for more than timeout
    if (this.tapTimes.length > 0 && now - this.lastTapTime > this.timeoutMs) {
      this.tapTimes = [];
    }

    this.tapTimes.push(now);
    this.lastTapTime = now;

    if (this.tapTimes.length > this.maxTaps) {
      this.tapTimes.shift();
    }

    const bpm = this.calculateBpm();
    return {
      tapsCount: this.tapTimes.length,
      bpm,
      relativeTimes: this.getRelativeTimes(),
    };
  }

  calculateBpm() {
    if (this.tapTimes.length < 2) return null;

    const intervals = [];
    for (let i = 1; i < this.tapTimes.length; i++) {
      intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
    }

    // Average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    let bpm = Math.round(60000 / avgInterval);
    bpm = Math.max(50, Math.min(300, bpm));
    return bpm;
  }

  getRelativeTimes() {
    if (this.tapTimes.length === 0) return [];
    const first = this.tapTimes[0];
    return this.tapTimes.map(t => Number(((t - first) / 1000).toFixed(3)));
  }

  reset() {
    this.tapTimes = [];
    this.lastTapTime = 0;
  }
}
