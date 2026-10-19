import { FAULT_SCENARIOS, type FaultLineScenario } from './ankara-data.ts';
import type { PostEarthquakeReport } from './seismic-engine.ts';

export type TerrainContrastMode = 'normal' | 'high' | 'topographic' | 'satellite';

export interface SavedScenario {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  faultId: string;
  faultName: string;
  magnitudeMw: number;
  depthKm: number;
  wavefrontSpeed: number;
  terrainContrast: TerrainContrastMode;
  showHeatmapOverlay: boolean;
  isPreset?: boolean;
  metricsSnapshot?: {
    highestRiskDistrict: string;
    maxPgaG: number;
    highRiskDistrictCount: number;
    totalSeverelyDamagedBuildings: number;
    estimatedShelterNeeds: number;
  };
}

export const STORAGE_KEY = 'ankara_seismic_saved_scenarios_v1';

export const TERRAIN_CONTRAST_OPTIONS: Array<{
  id: TerrainContrastMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'normal',
    label: 'Standart Dengeli',
    shortLabel: 'Standart',
    description: 'Doğal arazi aydınlatması ve dengeli topoğrafya.',
  },
  {
    id: 'high',
    label: 'Yüksek Kontrast',
    shortLabel: 'Yüksek',
    description: 'Derin gölgeler, belirgin vadi/sırt ayrımı ve keskin rölyef.',
  },
  {
    id: 'topographic',
    label: 'Topografik Kabartma',
    shortLabel: 'Topo Kabartma',
    description: 'Yükseklik basamakları (hipsometrik) ve vurgulanmış eş yükselti eğrileri.',
  },
  {
    id: 'satellite',
    label: 'Radar / Gece Kontrastı',
    shortLabel: 'Radar/Gece',
    description: 'Koyu taktik zemin, parlayan izohipsler ve kriz masası görünümü.',
  },
];

export const PRESET_SCENARIOS: SavedScenario[] = [
  {
    id: 'preset-kaf-gerede-72',
    name: 'AFAD KAF Kuzey Segmenti (Mw 7.2)',
    description: 'Kuzey Anadolu Fayı Gerede-Kızılcahamam segmentinde büyük kırılma. Çamlıdere ve Kızılcahamam doğrudan merkez üssü kuşağında kalır.',
    createdAt: '2026-01-15T09:00:00.000Z',
    faultId: 'kaf-gerede',
    faultName: 'Kuzey Anadolu Fayı — Gerede / Kızılcahamam Segmenti',
    magnitudeMw: 7.2,
    depthKm: 12,
    wavefrontSpeed: 1.0,
    terrainContrast: 'high',
    showHeatmapOverlay: true,
    isPreset: true,
    metricsSnapshot: {
      highestRiskDistrict: 'Çamlıdere',
      maxPgaG: 0.44,
      highRiskDistrictCount: 9,
      totalSeverelyDamagedBuildings: 840,
      estimatedShelterNeeds: 4200,
    },
  },
  {
    id: 'preset-bala-kesikkopru-64',
    name: 'Bala — Kesikköprü Fayı ve İsale Hatları (Mw 6.4)',
    description: '2005-2007 Bala deprem fırtınası benzeri sığ odaklı deprem. Kesikköprü Barajı isale hattı ve güney ilçeleri için kritik senaryo.',
    createdAt: '2026-02-10T14:30:00.000Z',
    faultId: 'bala-kesikkopru',
    faultName: 'Bala — Kesikköprü — Afşar Aktif Fay Zonu',
    magnitudeMw: 6.4,
    depthKm: 8,
    wavefrontSpeed: 1.0,
    terrainContrast: 'topographic',
    showHeatmapOverlay: true,
    isPreset: true,
    metricsSnapshot: {
      highestRiskDistrict: 'Bala',
      maxPgaG: 0.39,
      highRiskDistrictCount: 5,
      totalSeverelyDamagedBuildings: 480,
      estimatedShelterNeeds: 2800,
    },
  },
  {
    id: 'preset-polatli-haymana-66',
    name: 'Eskişehir — Polatlı — Haymana Koridoru (Mw 6.6)',
    description: 'İvedik-Polatlı 107 km içme suyu isale hattı ve Sincan-Temelli sanayi aksını vuran batı sismik senaryosu.',
    createdAt: '2026-03-01T11:15:00.000Z',
    faultId: 'haymana-polatli',
    faultName: 'Eskişehir — Polatlı — Haymana Fay Zonu',
    magnitudeMw: 6.6,
    depthKm: 10,
    wavefrontSpeed: 1.5,
    terrainContrast: 'satellite',
    showHeatmapOverlay: true,
    isPreset: true,
    metricsSnapshot: {
      highestRiskDistrict: 'Polatlı',
      maxPgaG: 0.41,
      highRiskDistrictCount: 6,
      totalSeverelyDamagedBuildings: 620,
      estimatedShelterNeeds: 3400,
    },
  },
  {
    id: 'preset-sereflikochisar-68',
    name: 'Tuz Gölü — Şereflikoçhisar Fayı (Mw 6.8)',
    description: 'Ankara güney sınırında Tuz Gölü fay zonunun ana kırılması. Şereflikoçhisar ve Evren ilçelerinde yoğun sarsıntı.',
    createdAt: '2026-03-15T16:00:00.000Z',
    faultId: 'sereflikochisar-tuzgolu',
    faultName: 'Tuz Gölü Fay Zonu — Şereflikoçhisar Segmenti',
    magnitudeMw: 6.8,
    depthKm: 14,
    wavefrontSpeed: 1.0,
    terrainContrast: 'high',
    showHeatmapOverlay: true,
    isPreset: true,
    metricsSnapshot: {
      highestRiskDistrict: 'Şereflikoçhisar',
      maxPgaG: 0.42,
      highRiskDistrictCount: 4,
      totalSeverelyDamagedBuildings: 510,
      estimatedShelterNeeds: 2900,
    },
  },
];

/**
 * Loads all user-saved scenarios from browser LocalStorage
 */
export function loadUserScenarios(): SavedScenario[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) => item && typeof item.id === 'string' && typeof item.faultId === 'string'
      );
    }
  } catch (err) {
    console.error('Failed to load scenarios from localStorage:', err);
  }
  return [];
}

/**
 * Loads both preset and user-saved scenarios
 */
export function getAllScenarios(): SavedScenario[] {
  const userScenarios = loadUserScenarios();
  return [...userScenarios, ...PRESET_SCENARIOS];
}

/**
 * Saves a new scenario to localStorage
 */
export function saveScenario(scenarioInput: {
  name: string;
  description?: string;
  faultId: string;
  magnitudeMw: number;
  depthKm: number;
  wavefrontSpeed: number;
  terrainContrast: TerrainContrastMode;
  showHeatmapOverlay: boolean;
  metricsSnapshot?: SavedScenario['metricsSnapshot'];
}): SavedScenario {
  const fault = FAULT_SCENARIOS.find((f) => f.id === scenarioInput.faultId);
  const faultName = fault ? fault.name : scenarioInput.faultId;

  const newScenario: SavedScenario = {
    id: `scen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: scenarioInput.name.trim() || `${fault?.shortName || 'Özel'} Mw ${scenarioInput.magnitudeMw.toFixed(1)} Senaryosu`,
    description: (scenarioInput.description || '').trim(),
    createdAt: new Date().toISOString(),
    faultId: scenarioInput.faultId,
    faultName,
    magnitudeMw: Number(scenarioInput.magnitudeMw.toFixed(1)),
    depthKm: Math.round(scenarioInput.depthKm),
    wavefrontSpeed: Number(scenarioInput.wavefrontSpeed.toFixed(1)),
    terrainContrast: scenarioInput.terrainContrast,
    showHeatmapOverlay: scenarioInput.showHeatmapOverlay,
    isPreset: false,
    metricsSnapshot: scenarioInput.metricsSnapshot,
  };

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const existing = loadUserScenarios();
    const updated = [newScenario, ...existing];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save scenario to localStorage:', err);
    }
  }

  return newScenario;
}

/**
 * Deletes a user scenario by ID
 */
export function deleteScenario(id: string): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
  try {
    const existing = loadUserScenarios();
    const filtered = existing.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to delete scenario:', err);
    return false;
  }
}

/**
 * Exports all user scenarios as a downloadable JSON string
 */
export function exportScenariosAsJson(): string {
  const all = getAllScenarios();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      platform: 'ANKA-SİSMİK 3D',
      version: '2026.1',
      scenarioCount: all.length,
      scenarios: all,
    },
    null,
    2
  );
}

/**
 * Imports scenarios from JSON text
 */
export function importScenariosFromJson(jsonString: string): { importedCount: number; errors?: string[] } {
  try {
    const data = JSON.parse(jsonString);
    const candidateList = Array.isArray(data) ? data : data?.scenarios;
    if (!Array.isArray(candidateList)) {
      return { importedCount: 0, errors: ['Geçersiz dosya formatı. Senaryo listesi bulunamadı.'] };
    }

    const validNewScenarios: SavedScenario[] = [];
    for (const item of candidateList) {
      if (item && item.faultId && typeof item.magnitudeMw === 'number') {
        validNewScenarios.push({
          id: `scen_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: String(item.name || 'İçe Aktarılan Senaryo').trim(),
          description: String(item.description || '').trim(),
          createdAt: item.createdAt || new Date().toISOString(),
          faultId: String(item.faultId),
          faultName: String(item.faultName || item.faultId),
          magnitudeMw: Math.max(4.0, Math.min(8.5, Number(item.magnitudeMw))),
          depthKm: Math.max(2, Math.min(60, Number(item.depthKm) || 10)),
          wavefrontSpeed: Math.max(0.2, Math.min(5.0, Number(item.wavefrontSpeed) || 1.0)),
          terrainContrast: ['normal', 'high', 'topographic', 'satellite'].includes(item.terrainContrast)
            ? item.terrainContrast
            : 'high',
          showHeatmapOverlay: item.showHeatmapOverlay !== false,
          isPreset: false,
          metricsSnapshot: item.metricsSnapshot,
        });
      }
    }

    if (validNewScenarios.length > 0) {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const current = loadUserScenarios();
        const combined = [...validNewScenarios, ...current];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
      }
      return { importedCount: validNewScenarios.length };
    }

    return { importedCount: 0, errors: ['Uygun senaryo kaydı bulunamadı.'] };
  } catch (err: any) {
    return { importedCount: 0, errors: [err?.message || 'JSON ayrıştırma hatası.'] };
  }
}

/**
 * Builds a shareable URL containing the exact scenario parameters
 */
export function buildShareUrl(params: {
  faultId: string;
  magnitudeMw: number;
  depthKm: number;
  wavefrontSpeed: number;
  terrainContrast: TerrainContrastMode;
  showHeatmapOverlay: boolean;
}): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('fault', params.faultId);
  url.searchParams.set('mw', params.magnitudeMw.toFixed(1));
  url.searchParams.set('depth', params.depthKm.toString());
  url.searchParams.set('spd', params.wavefrontSpeed.toFixed(1));
  url.searchParams.set('contrast', params.terrainContrast);
  url.searchParams.set('heat', params.showHeatmapOverlay ? '1' : '0');
  return url.toString();
}

/**
 * Parses query parameters from URL search string to initialize a scenario
 */
export function parseShareUrl(search: string): Partial<{
  faultId: string;
  magnitudeMw: number;
  depthKm: number;
  wavefrontSpeed: number;
  terrainContrast: TerrainContrastMode;
  showHeatmapOverlay: boolean;
}> {
  if (!search) return {};
  try {
    const params = new URLSearchParams(search);
    const result: ReturnType<typeof parseShareUrl> = {};

    const fault = params.get('fault');
    if (fault && FAULT_SCENARIOS.some((f) => f.id === fault)) {
      result.faultId = fault;
    }

    const mw = params.get('mw');
    if (mw) {
      const val = parseFloat(mw);
      if (!isNaN(val) && val >= 4.0 && val <= 8.5) {
        result.magnitudeMw = Number(val.toFixed(1));
      }
    }

    const depth = params.get('depth');
    if (depth) {
      const val = parseInt(depth, 10);
      if (!isNaN(val) && val >= 2 && val <= 60) {
        result.depthKm = val;
      }
    }

    const spd = params.get('spd');
    if (spd) {
      const val = parseFloat(spd);
      if (!isNaN(val) && val >= 0.2 && val <= 5.0) {
        result.wavefrontSpeed = Number(val.toFixed(1));
      }
    }

    const contrast = params.get('contrast');
    if (contrast && ['normal', 'high', 'topographic', 'satellite'].includes(contrast)) {
      result.terrainContrast = contrast as TerrainContrastMode;
    }

    const heat = params.get('heat');
    if (heat !== null) {
      result.showHeatmapOverlay = heat === '1' || heat === 'true';
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Builds a formatted disaster management & AFAD style briefing report text suitable for sharing
 */
export function buildBriefingReportText(params: {
  scenarioName?: string;
  fault: FaultLineScenario;
  magnitudeMw: number;
  depthKm: number;
  wavefrontSpeed: number;
  terrainContrast: TerrainContrastMode;
  postEarthquakeReport?: PostEarthquakeReport;
  shareUrl: string;
}): string {
  const {
    scenarioName,
    fault,
    magnitudeMw,
    depthKm,
    postEarthquakeReport,
    shareUrl,
  } = params;

  const topImpacts = postEarthquakeReport?.topImpactedDistricts.slice(0, 5) || [];
  const topList = topImpacts
    .map(
      (d, i) =>
        `   ${i + 1}. ${d.districtName}: Tepe PGA ${d.pgaG.toFixed(2)}g | Şiddet: ${d.mmiRoman} | Hasar Skoru: ${d.compositeDamageScore}/100 (${d.alertLevel})`
    )
    .join('\n');

  return [
    `🚨 ANKA-SİSMİK 3D — ANKARA DEPREM SİMÜLASYONU RAPORU`,
    `═══════════════════════════════════════════════════════════`,
    scenarioName ? `📌 Senaryo Başlığı: ${scenarioName}` : null,
    `📍 Fay Hattı: ${fault.name}`,
    `⚡ Büyüklük: Mw ${magnitudeMw.toFixed(1)} | Odak Derinliği: ${depthKm} km`,
    `⏱️ Fay Tipi: ${fault.faultType} | Kırık Uzunluğu: ${fault.ruptureLengthKm} km`,
    `═══════════════════════════════════════════════════════════`,
    `📊 KRİTİK İLÇE ETKİ SIRALAMASI (İLK 5):`,
    topList || '   (Hesaplanan ilçe verileri simülasyondan okunuyor...)',
    `═══════════════════════════════════════════════════════════`,
    postEarthquakeReport
      ? `📈 İL GENELİ TAHMİNİ ALTYAPI VE HASAR BİLANÇOSU:\n` +
        `   • Genel Durum: ${postEarthquakeReport.overallStatus}\n` +
        `   • Kritik Seviyede Sarsılan İlçe: ${postEarthquakeReport.criticalDistrictCount} / 25 ilçe\n` +
        `   • Uyarı/Kritik İlçe Sayısı: ${postEarthquakeReport.warningDistrictCount} ilçe\n` +
        `   • Tahmini Asbest/Eski Boru Kırığı: ~${postEarthquakeReport.totalEstimatedPipeBreaks} nokta\n` +
        `   • Doğalgaz Kesilen Abone (RMS): ~${postEarthquakeReport.totalGasShutoffSubscribers.toLocaleString('tr-TR')} abone\n` +
        `   • Elektrik Kesintisi Riski (EDAŞ): ~${postEarthquakeReport.totalEdasOutageHouseholds.toLocaleString('tr-TR')} hane\n` +
        `   • Ön Kontrol Gereken Okul: ${postEarthquakeReport.totalSchoolsRequiringInspection} okul`
      : null,
    `═══════════════════════════════════════════════════════════`,
    `🔗 3D İnteraktif Simülasyonu Doğrudan İnceleyin:`,
    shareUrl,
    `═══════════════════════════════════════════════════════════`,
    `Bilgi: ANKA-SİSMİK 3D | Boğaziçi KRDAE & AFAD Sismik Azalım Modelleriyle Hesaplanmıştır.`,
  ]
    .filter(Boolean)
    .join('\n');
}
