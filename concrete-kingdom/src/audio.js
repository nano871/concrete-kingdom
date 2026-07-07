/**
 * Audio engine for Concrete Kingdom — procedural audio using Web Audio API.
 * No external sound files needed — generates sounds at runtime.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterVolume = 0.3;
    this.initialized = false;
    this.radioOn = false;
    this.radioIndex = 0;
    this.radioTimer = 0;

    // Radio channels
    this.radioChannels = ['bass', 'synth', 'drums'];
  }

  /** Initialize on first user interaction (browser autoplay policy). */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) { console.warn('Audio not available'); }
  }

  /** Play a simple tone. */
  _tone(freq, duration, type = 'sawtooth', volume = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /** Engine hum (continuous low rumble while driving). */
  startEngine() {
    if (!this.ctx || this._engineNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.04 * this.masterVolume, this.ctx.currentTime);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    this._engineNode = { osc, gain };
  }

  stopEngine() {
    if (this._engineNode) {
      this._engineNode.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      setTimeout(() => {
        try { this._engineNode.osc.stop(); } catch(e) {}
        this._engineNode = null;
      }, 300);
    }
  }

  /** Siren sound for police chase. */
  siren() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.setValueAtTime(500, t + 0.15);
    osc.frequency.setValueAtTime(800, t + 0.3);
    gain.gain.setValueAtTime(0.05 * this.masterVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Gunshot sound. */
  gunshot() {
    if (!this.ctx) return;
    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.02));
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15 * this.masterVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }

  /** Footstep. */
  footstep() {
    const t = this.ctx.currentTime;
    this._tone(200 + Math.random() * 100, 0.05, 'sine', 0.03);
  }

  /** Cash pickup. */
  cashPickup() {
    if (!this.ctx) return;
    this._tone(880, 0.1, 'sine', 0.08);
    setTimeout(() => this._tone(1320, 0.15, 'sine', 0.06), 80);
  }

  /** Car horn. */
  horn() {
    this._tone(440, 0.3, 'square', 0.06);
  }

  /** Radio music (simple loop). */
  updateRadio(dt) {
    if (!this.radioOn || !this.ctx) return;
    this.radioTimer += dt;
    if (this.radioTimer > 2) {
      this.radioTimer = 0;
      const channel = this.radioChannels[this.radioIndex % this.radioChannels.length];
      this.radioIndex++;
      // Simple radio beat
      const freq = channel === 'bass' ? 55 : channel === 'synth' ? 440 : 220;
      this._tone(freq, 0.5, channel === 'drums' ? 'sine' : 'sawtooth', 0.02);
    }
  }

  /** Ambient city hum. */
  updateAmbient(dt, isNight) {
    if (!this.ctx || Math.random() > dt * 2) return;
    // Distant traffic/ambient noise
    const freq = isNight ? 100 + Math.random() * 50 : 200 + Math.random() * 100;
    this._tone(freq, 0.3, 'sine', 0.01);
  }
}
