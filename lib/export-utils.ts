import type { DistrictData } from './ankara-data.ts';
import type {
  DistrictSeismicImpact,
  PostEarthquakeReport,
} from './seismic-engine.ts';

/**
 * Generates a self-contained, offline-compatible HTML report document
 * with modern CSS and tabular data for all 25 districts.
 */
export function generateStandaloneHtmlReport(
  report: PostEarthquakeReport,
  districts: DistrictData[],
  impactsById: Record<string, DistrictSeismicImpact>
): string {
  const generatedAt = new Date().toLocaleString('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'medium',
  });

  const rows = report.topImpactedDistricts
    .map(
      (imp, idx) => `
    <tr style="border-bottom: 1px solid #1e293b;">
      <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">#${idx + 1} ${imp.districtName}</td>
      <td style="padding: 10px 14px; text-align: right; color: #94a3b8;">${imp.epicentralDistanceKm} km</td>
      <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #f59e0b;">${imp.pgaG.toFixed(3)}g</td>
      <td style="padding: 10px 14px; text-align: right; color: #38bdf8;">MMI ${imp.mmiRoman}</td>
      <td style="padding: 10px 14px; text-align: right; color: #38bdf8;">~${imp.estimatedAsbestosPipeBreaks} Nokta</td>
      <td style="padding: 10px 14px; text-align: right; color: #facc15;">%${imp.baskentgazShutoffPercent}</td>
      <td style="padding: 10px 14px; text-align: right; color: #fb7185;">${imp.edasOutageHouseholds.toLocaleString('tr-TR')}</td>
      <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: ${
        imp.compositeDamageScore >= 65 ? '#f43f5e' : imp.compositeDamageScore >= 38 ? '#f59e0b' : '#10b981'
      };">${imp.compositeDamageScore}/100</td>
    </tr>`
    )
    .join('');

  const directivesHtml = report.actionDirectives
    .map(
      (d) => `
    <div style="background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <strong style="color: #38bdf8; font-size: 14px;">${d.agency}</strong>
        <span style="color: #fbbf24; font-family: monospace; font-size: 13px;">${d.hotline}</span>
      </div>
      <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${d.directive}</p>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ANKA-SİSMİK 3D - Deprem Sonuç ve Altyapı Hasar Raporu</title>
  <style>
    body {
      margin: 0;
      padding: 32px 20px;
      background-color: #0b0e17;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .container {
      max-width: 1080px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #1e293b;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      font-family: monospace;
      background: #881337;
      color: #fda4af;
      border: 1px solid #f43f5e;
      margin-bottom: 8px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .kpi-card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 14px;
    }
    .kpi-title {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: 700;
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      background: #111827;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #1e293b;
      margin-bottom: 28px;
    }
    th {
      background: #131c2e;
      padding: 12px 14px;
      color: #94a3b8;
      font-weight: 600;
      text-align: left;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
    @media print {
      body { background: #fff; color: #000; }
      .btn-print { display: none; }
      .kpi-card, table, tr, th, td { border-color: #ccc !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
        <div>
          <span class="badge">[${report.overallStatus}]</span>
          <h1 style="margin: 0; font-size: 24px; color: #ffffff;">ANKA-SİSMİK 3D: Deprem Hasar ve Altyapı Raporu</h1>
          <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">
            Senaryo: <strong style="color: #f8fafc;">${report.faultName}</strong> · 
            Büyüklük: <strong style="color: #f43f5e;">Mw ${report.magnitudeMw.toFixed(1)}</strong> · 
            Derinlik: <strong style="color: #38bdf8;">${report.depthKm} km</strong> · 
            Oluşturulma: ${generatedAt}
          </p>
        </div>
        <button class="btn-print" onclick="window.print()">Yazdır / PDF Olarak Kaydet</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Maksimum Yer İvmesi</div>
        <div class="kpi-value" style="color: #f43f5e;">${report.maxPgaG.toFixed(3)}g</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">MMI ${report.maxMmiRoman} (${report.epicenterDistrictName})</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Kritik / Uyarı İlçe</div>
        <div class="kpi-value" style="color: #f59e0b;">${report.warningDistrictCount} / 25</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${report.criticalDistrictCount} İlçe Kritik</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">ASKİ Boru Kırığı</div>
        <div class="kpi-value" style="color: #38bdf8;">~${report.totalEstimatedPipeBreaks}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Asbest / Eski Şebeke</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Başkentgaz Kesinti</div>
        <div class="kpi-value" style="color: #facc15;">${report.totalGasShutoffSubscribers.toLocaleString('tr-TR')}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Otomatik RMS Vana</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">EDAŞ Kesinti Hane</div>
        <div class="kpi-value" style="color: #fb7185;">${report.totalEdasOutageHouseholds.toLocaleString('tr-TR')}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Alo 186 Şebeke</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">MEB Ön Denetim</div>
        <div class="kpi-value" style="color: #34d399;">${report.totalSchoolsRequiringInspection}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Eğitim Kurumu</div>
      </div>
    </div>

    <h2 style="font-size: 16px; margin: 0 0 12px 0; color: #f8fafc;">En Çok Etkilenen İlk 8 İlçe Hasar Sıralaması</h2>
    <table>
      <thead>
        <tr>
          <th>İlçe</th>
          <th style="text-align: right;">Mesafe</th>
          <th style="text-align: right;">PGA (g)</th>
          <th style="text-align: right;">MMI</th>
          <th style="text-align: right;">ASKİ Kırık</th>
          <th style="text-align: right;">Gaz Kesme</th>
          <th style="text-align: right;">EDAŞ Kesinti</th>
          <th style="text-align: right;">Hasar Skoru</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <h2 style="font-size: 16px; margin: 0 0 12px 0; color: #f8fafc;">Kurumsal Acil Müdahale ve Altyapı Direktifleri</h2>
    ${directivesHtml}

    <div style="margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px; font-size: 12px; color: #64748b; text-align: center;">
      ANKA-SİSMİK 3D · Ankara Büyükşehir Belediyesi AYKOME, ASKİ, Başkentgaz, Başkent EDAŞ, MEB İSG ve EGM Trafik verileriyle üretilmiştir.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates raw JSON export of the complete simulation state
 */
export function generateJsonExport(
  report: PostEarthquakeReport,
  impactsById: Record<string, DistrictSeismicImpact>
): string {
  return JSON.stringify(
    {
      exportType: 'ANKA_SISMIK_3D_POST_EARTHQUAKE_DATASET',
      exportedAtIso: new Date().toISOString(),
      report,
      districtImpacts: impactsById,
    },
    null,
    2
  );
}

/**
 * Generates standard GIS GeoJSON FeatureCollection containing all 25 Ankara districts
 * with coordinates and computed seismic impacts.
 */
export function generateGeoJsonExport(
  districts: DistrictData[],
  impactsById: Record<string, DistrictSeismicImpact>
): string {
  const features = districts.map((d) => {
    const imp = impactsById[d.id];
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        // Approximate geo coordinates centered around Ankara (lat ~39.93, lon ~32.85)
        // x scene mapped to lon, z scene mapped to lat
        coordinates: [
          Number((32.85 + (d.coords.x * 2.1) / 85.0).toFixed(5)),
          Number((39.93 - (d.coords.z * 2.1) / 111.0).toFixed(5)),
        ],
      },
      properties: {
        code: d.code,
        id: d.id,
        name: d.name,
        category: d.category,
        population2026: d.population2026,
        soilAndInfraRisks: d.aykome.soilAndInfraRisks,
        pgaG: imp ? imp.pgaG : 0,
        mmiRoman: imp ? imp.mmiRoman : 'I',
        compositeDamageScore: imp ? imp.compositeDamageScore : 0,
        estimatedAsbestosPipeBreaks: imp ? imp.estimatedAsbestosPipeBreaks : 0,
        baskentgazShutoffPercent: imp ? imp.baskentgazShutoffPercent : 0,
        edasOutageHouseholds: imp ? imp.edasOutageHouseholds : 0,
      },
    };
  });

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features,
    },
    null,
    2
  );
}

/**
 * Initiates browser file download using a temporary anchor element
 */
export function triggerBrowserDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
