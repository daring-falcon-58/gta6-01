// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshots, pickups, mission stings and a
// looping synth-wave bassline radio ("BAY FM") the player can switch.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._musicTimer = null;
    this._step = 0;
    // A-minor bassline, one note per 0.22s step.
    this._bass = [55, 0, 55, 65.41, 55, 0, 49, 55, 55, 0, 55, 65.41, 82.41, 73.42, 65.41, 49];
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this._startEngine();
      this._startSiren();
      this._startMusic();
    } catch {
      this.ctx = null;
    }
  }

  _startEngine() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 40;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    osc.connect(filter).connect(gain).connect(this.ctx.destination);
    osc.start();
    this._engineOsc = osc;
    this._engineGain = gain;
  }

  _startSiren() {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 700;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    this._sirenOsc = osc;
    this._sirenGain = gain;
    this._sirenPhase = 0;
  }

  _startMusic() {
    this._musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted || !this.musicOn) return;
      const note = this._bass[this._step % this._bass.length];
      this._step += 1;
      if (!note) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = note;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    }, 220);
  }

  // Called every frame: engine pitch follows speed, siren wails with wanted.
  update(speed01, wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this._engineGain) {
      this._engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.02 + speed01 * 0.05, t, 0.1);
      this._engineOsc.frequency.setTargetAtTime(40 + speed01 * 120, t, 0.1);
    }
    if (this._sirenGain) {
      this._sirenPhase = (this._sirenPhase || 0) + 1;
      const target = this.muted || wanted === 0 ? 0 : 0.035;
      this._sirenGain.gain.setTargetAtTime(target, t, 0.2);
      this._sirenOsc.frequency.setTargetAtTime(this._sirenPhase % 60 < 30 ? 660 : 880, t, 0.05);
    }
  }

  _blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur + 0.02);
  }

  _noise(dur, vol) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  shoot() { this._noise(0.12, 0.25); this._blip(180, 0.08, 'square', 0.1); }
  punch() { this._noise(0.07, 0.18); }
  pickup() { this._blip(880, 0.12, 'sine', 0.14); this._blip(1320, 0.18, 'sine', 0.1); }
  cash() { this._blip(990, 0.1, 'sine', 0.14); this._blip(1480, 0.22, 'sine', 0.12); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => this._blip(f, 0.25, 'triangle', 0.14), i * 110)); }
  busted() { [392, 330, 262, 196].forEach((f, i) => window.setTimeout(() => this._blip(f, 0.3, 'triangle', 0.14), i * 140)); }
  crash() { this._noise(0.25, 0.3); }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  toggleRadio() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}
