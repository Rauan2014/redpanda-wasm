/**
 * Synthesized Nintendo 3DS HOME Menu UI sound effects via Web Audio API.
 * No external audio files are fetched (keeps COEP strict and instant response).
 */

export class HomeAudioSynth {
  #ctx = null;
  #muted = false;

  get muted() {
    return this.#muted;
  }

  setMuted(value) {
    this.#muted = Boolean(value);
  }

  toggleMute() {
    this.#muted = !this.#muted;
    return this.#muted;
  }

  #ensureContext() {
    if (this.#muted) return null;
    if (!this.#ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.#ctx = new AudioCtx();
    }
    if (this.#ctx.state === 'suspended') {
      void this.#ctx.resume().catch(() => {});
    }
    return this.#ctx;
  }

  #tone({ freq, endFreq, duration, type = 'sine', gain = 0.08, delay = 0 }) {
    const ctx = this.#ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playSelect() {
    this.#tone({ freq: 740, endFreq: 1046, duration: 0.055, type: 'triangle', gain: 0.07 });
    this.#tone({ freq: 1480, endFreq: 1568, duration: 0.04, type: 'sine', gain: 0.035, delay: 0.012 });
  }

  playLaunch() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      this.#tone({
        freq,
        duration: 0.19,
        type: idx % 2 === 0 ? 'triangle' : 'sine',
        gain: 0.065,
        delay: idx * 0.048,
      });
    });
  }

  playInsertCart() {
    this.#tone({ freq: 210, endFreq: 120, duration: 0.05, type: 'square', gain: 0.04 });
    this.#tone({ freq: 880, endFreq: 1174, duration: 0.14, type: 'sine', gain: 0.065, delay: 0.055 });
  }

  playModal(open = true) {
    if (open) {
      this.#tone({ freq: 440, endFreq: 660, duration: 0.09, type: 'sine', gain: 0.055 });
      this.#tone({ freq: 660, endFreq: 880, duration: 0.1, type: 'triangle', gain: 0.04, delay: 0.04 });
    } else {
      this.#tone({ freq: 660, endFreq: 420, duration: 0.08, type: 'sine', gain: 0.05 });
    }
  }

  playEmpty() {
    this.#tone({ freq: 330, endFreq: 247, duration: 0.09, type: 'triangle', gain: 0.045 });
  }
}
