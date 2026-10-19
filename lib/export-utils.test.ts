import test from 'node:test';
import assert from 'node:assert/strict';
import { ANKARA_DISTRICTS, FAULT_SCENARIOS } from './ankara-data.ts';
import {
  evaluateDistrictSeismicImpact,
  compilePostEarthquakeReport,
  type DistrictSeismicImpact,
} from './seismic-engine.ts';
import {
  generateStandaloneHtmlReport,
  generateJsonExport,
  generateGeoJsonExport,
} from './export-utils.ts';

test('export utilities generate valid standalone HTML, JSON, and GeoJSON outputs', () => {
  const fault = FAULT_SCENARIOS[0];
  const impacts: Record<string, DistrictSeismicImpact> = {};
  for (const d of ANKARA_DISTRICTS) {
    impacts[d.id] = evaluateDistrictSeismicImpact(d, 6.8, 12, fault.epicenter);
  }
  const report = compilePostEarthquakeReport(
    ANKARA_DISTRICTS,
    impacts,
    fault,
    6.8,
    12,
    24
  );

  // 1. Test HTML generation
  const html = generateStandaloneHtmlReport(report, ANKARA_DISTRICTS, impacts);
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('ANKA-SİSMİK 3D'));
  assert.ok(html.includes('Kuzey Anadolu Fayı'));
  assert.ok(html.includes('Mw 6.8'));
  assert.ok(html.includes('table'));

  // 2. Test JSON generation
  const jsonStr = generateJsonExport(report, impacts);
  const parsedJson = JSON.parse(jsonStr);
  assert.equal(parsedJson.exportType, 'ANKA_SISMIK_3D_POST_EARTHQUAKE_DATASET');
  assert.equal(parsedJson.report.magnitudeMw, 6.8);
  assert.ok(parsedJson.districtImpacts['cankaya']);

  // 3. Test GeoJSON generation
  const geojsonStr = generateGeoJsonExport(ANKARA_DISTRICTS, impacts);
  const parsedGeo = JSON.parse(geojsonStr);
  assert.equal(parsedGeo.type, 'FeatureCollection');
  assert.equal(parsedGeo.features.length, 25);
  assert.equal(parsedGeo.features[0].geometry.type, 'Point');
  assert.ok(Array.isArray(parsedGeo.features[0].geometry.coordinates));
});
