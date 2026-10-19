import test from 'node:test';
import assert from 'node:assert/strict';
import { ANKARA_DISTRICTS, FAULT_SCENARIOS } from './ankara-data.ts';
import {
  computeDistancesKm,
  computeSoilAmplification,
  computeAttenuatedPGA,
  pgaToMMI,
  evaluateDistrictSeismicImpact,
  computeWavefrontState,
  computeInstantaneousGroundMotion,
  formatRefreshCountdown,
  computeGridPointDynamicPGA,
  normalizePgaForChromaticScale,
  compilePostEarthquakeReport,
} from './seismic-engine.ts';

test('Ankara dataset contains all 25 districts with valid risk scores', () => {
  assert.equal(ANKARA_DISTRICTS.length, 25);
  for (const d of ANKARA_DISTRICTS) {
    assert.ok(d.population2026 > 0, `${d.name} population should be > 0`);
    assert.equal(d.aski.modernPipePercent + d.aski.asbestosOrOldPipePercent, 100, `${d.name} pipe percentages should sum to 100`);
    assert.equal(d.security.policePercent + d.security.gendarmeriePercent, 100, `${d.name} police + gendarmerie should sum to 100`);
  }
});

test('computeDistancesKm calculates epicentral and hypocentral distances accurately', () => {
  const { epicentralKm, hypocentralKm } = computeDistancesKm(
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    10
  );
  // 10 units * 2.1 km/unit = 21.0 km
  assert.equal(epicentralKm, 21.0);
  assert.ok(hypocentralKm > epicentralKm);
});

test('computeAttenuatedPGA increases with magnitude and decreases with distance', () => {
  const pgaM6Near = computeAttenuatedPGA(6.0, 15, 1.2);
  const pgaM7Near = computeAttenuatedPGA(7.2, 15, 1.2);
  const pgaM7Far = computeAttenuatedPGA(7.2, 85, 1.2);

  assert.ok(pgaM7Near > pgaM6Near, 'M7.2 should produce higher PGA than M6.0 at same distance');
  assert.ok(pgaM7Near > pgaM7Far, 'Closer distance should produce higher PGA than far distance');
});

test('evaluateDistrictSeismicImpact computes realistic infrastructure metrics across districts', () => {
  const balaFault = FAULT_SCENARIOS.find((f) => f.id === 'bala-kesikkopru')!;
  const balaDistrict = ANKARA_DISTRICTS.find((d) => d.id === 'bala')!;
  const nallihanDistrict = ANKARA_DISTRICTS.find((d) => d.id === 'nallihan')!;

  const balaImpact = evaluateDistrictSeismicImpact(
    balaDistrict,
    balaFault.defaultMw,
    balaFault.defaultDepthKm,
    balaFault.epicenter
  );
  const nallihanImpact = evaluateDistrictSeismicImpact(
    nallihanDistrict,
    balaFault.defaultMw,
    balaFault.defaultDepthKm,
    balaFault.epicenter
  );

  assert.ok(balaImpact.pgaG > nallihanImpact.pgaG, 'Bala (at epicenter) must have higher PGA than distant Nallıhan');
  assert.ok(balaImpact.askiPipeBreakProbabilityPercent > nallihanImpact.askiPipeBreakProbabilityPercent);
  assert.ok(balaImpact.sWaveArrivalSec > balaImpact.pWaveArrivalSec, 'S-wave arrives after P-wave');
});

test('computeInstantaneousGroundMotion transitions through P-wave, S-wave, and decay phases', () => {
  const cankaya = ANKARA_DISTRICTS.find((d) => d.id === 'cankaya')!;
  const impact = evaluateDistrictSeismicImpact(cankaya, 6.8, 8, { x: 10, z: 10 });

  const beforeP = computeInstantaneousGroundMotion(impact, impact.pWaveArrivalSec - 0.5, true);
  assert.equal(beforeP.phase, 'Beklemede');
  assert.equal(beforeP.intensity, 0);

  const duringP = computeInstantaneousGroundMotion(impact, (impact.pWaveArrivalSec + impact.sWaveArrivalSec) / 2, true);
  assert.equal(duringP.phase, 'P-Dalgası (Öncü)');
  assert.ok(duringP.intensity > 0);

  const duringS = computeInstantaneousGroundMotion(impact, impact.sWaveArrivalSec + 1.5, true);
  assert.equal(duringS.phase, 'S-Dalgası (Yıkıcı)');
  assert.ok(duringS.intensity > duringP.intensity);
});

test('computeGridPointDynamicPGA and normalizePgaForChromaticScale dynamically evolve with wave propagation', () => {
  const epicenter = { x: 0, z: 0 };
  const targetCoord = { x: 15, z: 0 }; // ~31.5 km away

  const staticPga = computeGridPointDynamicPGA(targetCoord, epicenter, 7.0, 10, 0, false);
  const preWavePga = computeGridPointDynamicPGA(targetCoord, epicenter, 7.0, 10, 1.0, true);
  const sWaveCrestPga = computeGridPointDynamicPGA(targetCoord, epicenter, 7.0, 10, 10.2, true);

  assert.ok(staticPga > 0.1, 'Static peak PGA should be significant');
  assert.ok(preWavePga < staticPga * 0.1, 'Before P-wave arrives, dynamic PGA is near zero');
  assert.ok(sWaveCrestPga > preWavePga * 10, 'When S-wave arrives, dynamic PGA surges');

  const normLow = normalizePgaForChromaticScale(0.01);
  const normHigh = normalizePgaForChromaticScale(0.42);
  assert.ok(normHigh > normLow && normHigh <= 1.0 && normLow >= 0.0);
});

test('compilePostEarthquakeReport aggregates province-wide damages and ranks top impacted districts', () => {
  const kaf = FAULT_SCENARIOS[0];
  const map: Record<string, ReturnType<typeof evaluateDistrictSeismicImpact>> = {};
  for (const d of ANKARA_DISTRICTS) {
    map[d.id] = evaluateDistrictSeismicImpact(d, kaf.defaultMw, kaf.defaultDepthKm, kaf.epicenter);
  }
  const report = compilePostEarthquakeReport(ANKARA_DISTRICTS, map, kaf, kaf.defaultMw, kaf.defaultDepthKm);
  assert.equal(report.topImpactedDistricts.length, 8);
  assert.ok(report.maxPgaG >= report.topImpactedDistricts[1].pgaG);
  assert.ok(report.totalEstimatedPipeBreaks > 0);
  assert.ok(report.totalGasShutoffSubscribers > 0);
  assert.equal(report.actionDirectives.length, 4);
});

test('formatRefreshCountdown formats 30-minute intervals properly', () => {
  assert.equal(formatRefreshCountdown(1800), '30:00');
  assert.equal(formatRefreshCountdown(65), '01:05');
  assert.equal(formatRefreshCountdown(0), '00:00');
});
