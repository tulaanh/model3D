/**
 * Procedural Physics Sound Engine using Web Audio API
 * Generates dynamic physical slap, poke, and spring bounce sounds with zero latency.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMuted(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Generates a physical slap / tap / boing sound based on impact force and velocity.
   * @param intensity Normalized intensity (0.0 to 1.0)
   * @param type 'slap' | 'poke' | 'boing' | 'release'
   */
  public playImpact(intensity: number = 0.5, type: 'slap' | 'poke' | 'boing' | 'release' = 'slap') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const clampedIntensity = Math.min(Math.max(intensity, 0.1), 1.0);

    // Master gain for this impact
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.4 * clampedIntensity, t);
    masterGain.connect(this.ctx.destination);

    if (type === 'slap') {
      // 1. Slap Transient (White noise burst with bandpass)
      const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200 + clampedIntensity * 800, t);
      filter.Q.setValueAtTime(3.0, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8 * clampedIntensity, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start(t);

      // 2. Fleshy / Elastic Body Thump (Low pitch dive oscillator)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      const startFreq = 220 + clampedIntensity * 120;
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);

      oscGain.gain.setValueAtTime(0.7 * clampedIntensity, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.13);

      // 3. Spring resonance harmonic
      const harmonicOsc = this.ctx.createOscillator();
      const harmonicGain = this.ctx.createGain();
      harmonicOsc.type = 'triangle';
      harmonicOsc.frequency.setValueAtTime(startFreq * 1.5, t);
      harmonicOsc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

      harmonicGain.gain.setValueAtTime(0.3 * clampedIntensity, t);
      harmonicGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      harmonicOsc.connect(harmonicGain);
      harmonicGain.connect(masterGain);
      harmonicOsc.start(t);
      harmonicOsc.stop(t + 0.16);

    } else if (type === 'poke') {
      // Soft cushioned poke sound
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.09);

      oscGain.gain.setValueAtTime(0.5 * clampedIntensity, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.1);

    } else if (type === 'release' || type === 'boing') {
      // Elastic spring boing / twang
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 260 + clampedIntensity * 100;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.4, t + 0.04);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, t + 0.22);

      oscGain.gain.setValueAtTime(0.6 * clampedIntensity, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.26);
    }
  }

  /**
   * Subtle brush sound when the 3D cursor collider grazes the body/hair
   */
  public playBrush() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.05);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}

export const soundEngine = new SoundEngine();
