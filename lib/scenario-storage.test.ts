import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESET_SCENARIOS,
  TERRAIN_CONTRAST_OPTIONS,
  parseShareUrl,
  buildBriefingReportText,
  importScenariosFromJson,
} from './scenario-storage.ts';
import { FAULT_SCENARIOS } from './ankara-data.ts';

test('PRESET_SCENARIOS are properly configured with 4+ presets', () => {
  assert.ok(PRESET_SCENARIOS.length >= 4);
  const kaf = PRESET_SCENARIOS.find((s) => s.faultId === 'kaf-gerede');
  assert.ok(kaf);
  assert.equal(kaf?.magnitudeMw, 7.2);
  assert.equal(kaf?.isPreset, true);
  assert.ok(kaf?.terrainContrast);
});

test('TERRAIN_CONTRAST_OPTIONS covers all 4 modes', () => {
  assert.equal(TERRAIN_CONTRAST_OPTIONS.length, 4);
  const ids = TERRAIN_CONTRAST_OPTIONS.map((c) => c.id);
  assert.ok(ids.includes('normal'));
  assert.ok(ids.includes('high'));
  assert.ok(ids.includes('topographic'));
  assert.ok(ids.includes('satellite'));
});

test('parseShareUrl correctly extracts scenario parameters from query string', () => {
  const query = '?fault=bala-kesikkopru&mw=6.5&depth=10&spd=1.5&contrast=topographic&heat=0';
  const parsed = parseShareUrl(query);
  assert.equal(parsed.faultId, 'bala-kesikkopru');
  assert.equal(parsed.magnitudeMw, 6.5);
  assert.equal(parsed.depthKm, 10);
  assert.equal(parsed.wavefrontSpeed, 1.5);
  assert.equal(parsed.terrainContrast, 'topographic');
  assert.equal(parsed.showHeatmapOverlay, false);
});

test('parseShareUrl falls back safely on invalid/missing params', () => {
  const empty = parseShareUrl('');
  assert.deepEqual(empty, {});

  const invalid = parseShareUrl('?fault=unknown_fault&mw=999&spd=-1&contrast=invalid');
  assert.equal(invalid.faultId, undefined);
  assert.equal(invalid.magnitudeMw, undefined);
  assert.equal(invalid.terrainContrast, undefined);
});

test('buildBriefingReportText generates rich AFAD/disaster formatted summary', () => {
  const fault = FAULT_SCENARIOS[0];
  const text = buildBriefingReportText({
    scenarioName: 'Test Özel Senaryo',
    fault,
    magnitudeMw: 7.2,
    depthKm: 12,
    wavefrontSpeed: 1.0,
    terrainContrast: 'high',
    shareUrl: 'https://anka-seismic.app/?fault=kaf-gerede&mw=7.2',
  });

  assert.ok(text.includes('ANKA-SİSMİK 3D'));
  assert.ok(text.includes('Test Özel Senaryo'));
  assert.ok(text.includes(fault.name));
  assert.ok(text.includes('Mw 7.2'));
  assert.ok(text.includes('https://anka-seismic.app'));
});

test('importScenariosFromJson handles valid and corrupted JSON data', () => {
  const badResult = importScenariosFromJson('not json');
  assert.equal(badResult.importedCount, 0);
  assert.ok(badResult.errors?.length);

  const sampleJson = JSON.stringify({
    scenarios: [
      {
        name: 'Deneme Senaryosu',
        faultId: 'kaf-gerede',
        magnitudeMw: 7.0,
        depthKm: 12,
        wavefrontSpeed: 1.0,
        terrainContrast: 'high',
        showHeatmapOverlay: true,
      },
    ],
  });

  const validResult = importScenariosFromJson(sampleJson);
  assert.equal(validResult.importedCount, 1);
});
