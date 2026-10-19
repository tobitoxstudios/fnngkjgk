/**
 * Seismic Sound Synthesizer (Web Audio API)
 *
 * Generates procedural low-frequency tectonic rumbling, P-wave compression hum,
 * and shear-wave bedrock friction sound effects that dynamically scale in frequency
 * and intensity with earthquake magnitude (Mw) and simulation elapsed time.
 */

export interface SeismicAudioState {
  isEnabled: boolean;
  isRumbling: boolean;
  currentIntensity: number; // 0.0 to 1.0
  magnitudeMw: number;
}

class SeismicSoundEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = false;
  private isRumbling: boolean = false;
  private currentIntensity: number = 0;

  // Web Audio Nodes
  private masterGain: GainNode | null = null;
  private subOsc1: OscillatorNode | null = null;
  private subOsc2: OscillatorNode | null = null;
  private tremorLfo: OscillatorNode | null = null;
  private tremorLfoGain: GainNode | null = null;

  // Noise & Bedrock Friction filter
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;

  // Subscribers for UI visualizer
  private listeners: Set<(state: SeismicAudioState) => void> = new Set();

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public subscribe(fn: (state: SeismicAudioState) => void): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    const st = this.getState();
    this.listeners.forEach((fn) => fn(st));
  }

  public getState(): SeismicAudioState {
    return {
      isEnabled: this.isEnabled,
      isRumbling: this.isRumbling,
      currentIntensity: this.currentIntensity,
      magnitudeMw: 6.5,
    };
  }

  private initContext(): boolean {
    if (typeof window === 'undefined') return false;

    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return false;

      this.ctx = new AudioCtxClass();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return true;
  }

  /**
   * Generates a 4-second looping buffer of Brownian (red) noise.
   * Brownian noise has a 1/f^2 power spectrum, yielding a deep, heavy subterranean rumble.
   */
  private createBrownianNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = buffer.getChannelData(channel);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Integrate white noise to produce Brownian rumble
        lastOut = (lastOut + 0.025 * white) / 1.025;
        output[i] = lastOut * 3.5; // Gain compensation
      }
    }

    return buffer;
  }

  /**
   * Enables or disables sound effects.
   */
  public toggleAudio(force?: boolean): boolean {
    const target = force !== undefined ? force : !this.isEnabled;
    this.isEnabled = target;

    if (this.isEnabled) {
      this.initContext();
    } else {
      this.stopRumble(true);
    }

    this.notify();
    return this.isEnabled;
  }

  public isAudioEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Starts synthesizing tectonic rumble for a given earthquake magnitude.
   */
  public startRumble(magnitudeMw: number = 6.5) {
    if (!this.isEnabled) return;
    if (!this.initContext() || !this.ctx) return;

    this.stopRumble(false); // Clean up any active sound first

    const now = this.ctx.currentTime;

    // 1. Master Output Gain with smooth volume ramp
    const master = this.ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.connect(this.ctx.destination);
    this.masterGain = master;

    // 2. Sub-bass fundamental tectonic tone (36Hz - 46Hz depending on magnitude)
    // Larger magnitudes exhibit lower fundamental frequencies
    const fundamentalFreq = Math.max(32, 54 - (magnitudeMw - 4.5) * 4.5);
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(fundamentalFreq, now);

    const osc1Gain = this.ctx.createGain();
    osc1Gain.gain.setValueAtTime(0.35, now);
    osc1.connect(osc1Gain);
    osc1Gain.connect(master);
    osc1.start(now);
    this.subOsc1 = osc1;

    // 3. Sub-harmonic shear friction tone (triangle wave for harmonic gravel)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(fundamentalFreq * 1.48, now);

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.2, now);
    osc2.connect(osc2Gain);
    osc2Gain.connect(master);
    osc2.start(now);
    this.subOsc2 = osc2;

    // 4. Infrasonic Tremor LFO (modulates main pitch & volume like rhythmic crust fault slip)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(3.8, now);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(4.2, now); // +/- 4.2 Hz pitch modulation
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    lfo.start(now);
    this.tremorLfo = lfo;
    this.tremorLfoGain = lfoGain;

    // 5. Bedrock Crushing Brownian Noise with dynamic Low-Pass Filter
    const noiseBuffer = this.createBrownianNoiseBuffer();
    if (noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(45, now); // Starts at deep rumble 45Hz
      filter.Q.setValueAtTime(3.0, now); // Resonant crust cavity

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.25, now);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(master);

      noise.start(now);
      this.noiseSource = noise;
      this.noiseFilter = filter;
      this.noiseGain = nGain;
    }

    this.isRumbling = true;
    this.currentIntensity = 0.05;
    this.notify();
  }

  /**
   * Computes the seismic amplitude envelope at a given elapsed time (seconds).
   * Models:
   * - P-wave arrival (0s - 3s): subtle deep rumble build-up
   * - S-wave & Surface wave peak shaking (4s - 14s): maximum roar, tremor speedup, frequency expansion
   * - Coda wave reverberation / attenuation (15s - 30s): gradual subterranean decay
   */
  public calculateSeismicIntensity(
    elapsedSec: number,
    durationSec: number = 30,
    magnitudeMw: number = 6.5
  ): number {
    if (elapsedSec <= 0 || elapsedSec >= durationSec) return 0;

    // Magnitude scaling factor (Mw 4.5 gives ~0.45 factor, Mw 7.6 gives ~1.0)
    const magFactor = Math.min(1.0, Math.max(0.35, (magnitudeMw - 4.0) / 3.6));

    let envelope = 0;
    if (elapsedSec < 3.0) {
      // P-wave build up (quadratic ease in)
      const t = elapsedSec / 3.0;
      envelope = t * t * 0.45;
    } else if (elapsedSec <= 13.0) {
      // S-wave and Peak acceleration zone
      const t = (elapsedSec - 3.0) / 10.0;
      // Reaches peak around 40% of peak window, then slight undulation
      envelope = 0.45 + 0.55 * Math.sin(t * Math.PI * 0.95);
    } else {
      // Coda wave exponential attenuation
      const t = (elapsedSec - 13.0) / (durationSec - 13.0);
      envelope = Math.max(0, (1 - t) * 0.85 * Math.exp(-t * 2.2));
    }

    return Math.min(1.0, Math.max(0, envelope * magFactor));
  }

  /**
   * Updates rumbling intensity in real-time as simulation advances.
   */
  public updateRumbleIntensity(
    elapsedSec: number,
    durationSec: number = 30,
    magnitudeMw: number = 6.5,
    isSimulating: boolean = true
  ) {
    if (!this.isEnabled) return;

    if (!isSimulating || elapsedSec >= durationSec) {
      if (this.isRumbling) {
        this.stopRumble();
      }
      return;
    }

    // Auto-start rumble if not already running
    if (!this.isRumbling) {
      this.startRumble(magnitudeMw);
    }

    if (!this.ctx || !this.masterGain) return;

    const intensity = this.calculateSeismicIntensity(elapsedSec, durationSec, magnitudeMw);
    this.currentIntensity = intensity;

    const now = this.ctx.currentTime;
    const targetGain = 0.04 + intensity * 0.38; // Max master volume capped at 0.42 for safety
    this.masterGain.gain.setTargetAtTime(targetGain, now, 0.08);

    // Expand low-pass filter cutoff with shaking intensity (45Hz -> up to 180Hz)
    if (this.noiseFilter) {
      const targetCutoff = 45 + intensity * 150;
      this.noiseFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);
    }

    // Speed up tremor LFO during peak rupture (3.5Hz -> 8.5Hz)
    if (this.tremorLfo) {
      const targetLfoRate = 3.5 + intensity * 5.0;
      this.tremorLfo.frequency.setTargetAtTime(targetLfoRate, now, 0.1);
    }

    this.notify();
  }

  /**
   * Stops rumble with a quick natural exponential fade-out.
   */
  public stopRumble(immediate = false) {
    if (!this.isRumbling) return;

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      const fadeTime = immediate ? 0.05 : 0.4;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);

      const oldOsc1 = this.subOsc1;
      const oldOsc2 = this.subOsc2;
      const oldLfo = this.tremorLfo;
      const oldNoise = this.noiseSource;
      const oldMaster = this.masterGain;

      setTimeout(() => {
        try {
          oldOsc1?.stop();
          oldOsc1?.disconnect();
          oldOsc2?.stop();
          oldOsc2?.disconnect();
          oldLfo?.stop();
          oldLfo?.disconnect();
          oldNoise?.stop();
          oldNoise?.disconnect();
          oldMaster?.disconnect();
        } catch {}
      }, fadeTime * 1000 + 50);
    }

    this.subOsc1 = null;
    this.subOsc2 = null;
    this.tremorLfo = null;
    this.tremorLfoGain = null;
    this.noiseSource = null;
    this.noiseFilter = null;
    this.noiseGain = null;
    this.masterGain = null;

    this.isRumbling = false;
    this.currentIntensity = 0;
    this.notify();
  }
}

// Global Singleton Instance
export const seismicAudio = new SeismicSoundEngine();
