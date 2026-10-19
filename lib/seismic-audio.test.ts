import test from 'node:test';
import assert from 'node:assert/strict';
import { seismicAudio } from './seismic-audio.ts';

test('SeismicSoundEngine initializes with audio disabled', () => {
  assert.equal(seismicAudio.isAudioEnabled(), false);
  const st = seismicAudio.getState();
  assert.equal(st.isEnabled, false);
  assert.equal(st.isRumbling, false);
  assert.equal(st.currentIntensity, 0);
});

test('SeismicSoundEngine toggles audio state correctly', () => {
  // Toggle ON
  const enabled = seismicAudio.toggleAudio(true);
  assert.equal(enabled, true);
  assert.equal(seismicAudio.isAudioEnabled(), true);

  // Toggle OFF
  const disabled = seismicAudio.toggleAudio(false);
  assert.equal(disabled, false);
  assert.equal(seismicAudio.isAudioEnabled(), false);
});

test('calculateSeismicIntensity correctly reflects physical phases of earthquake', () => {
  const duration = 30;
  const mw = 7.0;

  // At t=0, intensity is 0
  assert.equal(seismicAudio.calculateSeismicIntensity(0, duration, mw), 0);

  // During P-wave arrival (t=1.5s), intensity starts rising
  const pWaveIntensity = seismicAudio.calculateSeismicIntensity(1.5, duration, mw);
  assert.ok(pWaveIntensity > 0 && pWaveIntensity < 0.4);

  // During S-wave / peak shaking (t=7.0s), intensity reaches maximum
  const peakIntensity = seismicAudio.calculateSeismicIntensity(7.0, duration, mw);
  assert.ok(peakIntensity > pWaveIntensity);
  assert.ok(peakIntensity >= 0.7);

  // During coda decay (t=26s), intensity is attenuating
  const codaIntensity = seismicAudio.calculateSeismicIntensity(26.0, duration, mw);
  assert.ok(codaIntensity < peakIntensity);
  assert.ok(codaIntensity >= 0);

  // At or beyond duration (t=30s), intensity is 0
  assert.equal(seismicAudio.calculateSeismicIntensity(30.0, duration, mw), 0);
  assert.equal(seismicAudio.calculateSeismicIntensity(35.0, duration, mw), 0);
});

test('calculateSeismicIntensity scales with earthquake magnitude', () => {
  const lowMw = seismicAudio.calculateSeismicIntensity(7.0, 30, 5.0);
  const highMw = seismicAudio.calculateSeismicIntensity(7.0, 30, 7.5);

  assert.ok(highMw > lowMw, `Expected Mw 7.5 intensity (${highMw}) to exceed Mw 5.0 intensity (${lowMw})`);
});
