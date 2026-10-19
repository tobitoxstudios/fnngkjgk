import type { DistrictData, FaultLineScenario } from './ankara-data.ts';

export interface DistrictSeismicImpact {
  districtId: string;
  districtName: string;
  epicentralDistanceKm: number;
  hypocentralDistanceKm: number;
  pWaveArrivalSec: number;
  sWaveArrivalSec: number;
  soilAmplificationFactor: number;
  pgaG: number; // Peak Ground Acceleration in g
  pgvCmSec: number; // Peak Ground Velocity in cm/s
  mmiNumeric: number; // Modified Mercalli Intensity (1.0 - 10.0)
  mmiRoman: string;
  alertLevel: 'Nominal' | 'Dikkat' | 'Uyarı' | 'Kritik';
  // Infrastructure specific damages
  askiPipeBreakProbabilityPercent: number;
  estimatedAsbestosPipeBreaks: number;
  baskentgazShutoffPercent: number;
  edasOutageHouseholds: number;
  fiberDegradationPercent: number;
  trafficCorridorClosureRiskPercent: number;
  schoolImmediateInspectionCount: number;
  compositeDamageScore: number; // 0-100
}

export interface WavefrontState {
  elapsedSec: number;
  pWaveRadiusKm: number;
  sWaveRadiusKm: number;
  surfaceWaveRadiusKm: number;
  isActive: boolean;
}

const P_WAVE_VELOCITY_KM_S = 6.0;
const S_WAVE_VELOCITY_KM_S = 3.5;
const SURFACE_WAVE_VELOCITY_KM_S = 2.8;
// 1 unit in 3D scene coords corresponds to ~2.1 km across Ankara's 25,632 km² map
export const SCENE_UNIT_TO_KM = 2.1;

/**
 * Computes epicentral and hypocentral distance in kilometers from 3D scene coordinates
 */
export function computeDistancesKm(
  epicenter: { x: number; z: number },
  districtCoords: { x: number; z: number },
  depthKm: number
): { epicentralKm: number; hypocentralKm: number } {
  const dx = (districtCoords.x - epicenter.x) * SCENE_UNIT_TO_KM;
  const dz = (districtCoords.z - epicenter.z) * SCENE_UNIT_TO_KM;
  const epicentralKm = Math.sqrt(dx * dx + dz * dz);
  const safeDepth = Math.max(2, depthKm);
  const hypocentralKm = Math.sqrt(epicentralKm * epicentralKm + safeDepth * safeDepth);
  return {
    epicentralKm: Number(epicentralKm.toFixed(1)),
    hypocentralKm: Number(hypocentralKm.toFixed(1)),
  };
}

/**
 * Computes soil amplification factor (Vs30 proxy) based on district AYKOME excavation risk
 * and qualitative water/alluvial soil conditions (1.00 rock to 1.65 soft alluvial basin)
 */
export function computeSoilAmplification(district: DistrictData): number {
  let factor = 1.0 + (district.scores.excavation - 3) * 0.055;
  if (district.qualitativeRisks.waterFailure === 'Yüksek') {
    factor += 0.14;
  } else if (district.qualitativeRisks.waterFailure === 'Orta') {
    factor += 0.06;
  }
  // Alluvial/lakebed basins (Gölbaşı Mogan, Sincan clay, Polatlı basin, Evren/Şereflikoçhisar shore)
  if (['golbasi', 'sincan', 'altindag', 'polatli', 'yenimahalle'].includes(district.id)) {
    factor += 0.12;
  }
  return Number(Math.min(1.75, Math.max(0.95, factor)).toFixed(2));
}

/**
 * Calculates Peak Ground Acceleration (PGA in g) using a calibrated regional Ground Motion
 * Prediction Equation (GMPE) for Anatolian shallow crustal earthquakes.
 */
export function computeAttenuatedPGA(
  magnitudeMw: number,
  hypocentralDistanceKm: number,
  soilAmplification: number
): number {
  const mw = Math.min(8.5, Math.max(3.5, magnitudeMw));
  const r = Math.max(4.0, hypocentralDistanceKm);
  // Regional GMPE log10(PGA_g)
  const log10Pga =
    0.82 +
    0.52 * (mw - 6.0) -
    0.032 * (mw - 6.0) * (mw - 6.0) -
    1.18 * Math.log10(r + 6.5) -
    0.0018 * r;
  const rawPga = Math.pow(10, log10Pga) * soilAmplification;
  return Number(Math.min(1.4, Math.max(0.001, rawPga)).toFixed(3));
}

/**
 * Converts PGA (in g) to Modified Mercalli Intensity (MMI 1-10) and Roman numeral
 */
export function pgaToMMI(pgaG: number): { mmiNumeric: number; mmiRoman: string } {
  const safePga = Math.max(0.0005, pgaG);
  // Wald et al. calibrated relationship
  const logPgaGal = Math.log10(safePga * 980.665);
  let mmi = 3.66 * logPgaGal - 1.66;
  if (logPgaGal <= 1.57) {
    mmi = 2.20 * logPgaGal + 1.0;
  }
  const clamped = Number(Math.min(10.0, Math.max(1.0, mmi)).toFixed(1));
  const romanTable = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const idx = Math.min(9, Math.max(0, Math.round(clamped) - 1));
  return { mmiNumeric: clamped, mmiRoman: romanTable[idx] };
}

/**
 * Computes comprehensive seismic and infrastructure impact for a single Ankara district
 */
export function evaluateDistrictSeismicImpact(
  district: DistrictData,
  magnitudeMw: number,
  depthKm: number,
  epicenter: { x: number; z: number }
): DistrictSeismicImpact {
  const { epicentralKm, hypocentralKm } = computeDistancesKm(
    epicenter,
    district.coords,
    depthKm
  );
  const soilAmp = computeSoilAmplification(district);
  const pgaG = computeAttenuatedPGA(magnitudeMw, hypocentralKm, soilAmp);
  const pgvCmSec = Number((pgaG * 92.5 * Math.pow(1.18, magnitudeMw - 6.0)).toFixed(1));
  const { mmiNumeric, mmiRoman } = pgaToMMI(pgaG);

  const pWaveArrivalSec = Number((hypocentralKm / P_WAVE_VELOCITY_KM_S).toFixed(1));
  const sWaveArrivalSec = Number((hypocentralKm / S_WAVE_VELOCITY_KM_S).toFixed(1));

  // ASKİ Asbestos & Old Pipe Breakage vulnerability
  const pipeVulnerability =
    (district.aski.asbestosOrOldPipePercent / 100) * 1.35 +
    (district.aski.lossLeakagePercent / 100) * 0.65;
  const askiPipeBreakProbabilityPercent = Math.min(
    99,
    Math.round(Math.min(1, pgaG * 2.4 * pipeVulnerability) * 100)
  );
  const estimatedAsbestosPipeBreaks = Math.max(
    0,
    Math.round(
      (district.aski.asbestosOrOldPipePercent * 0.45 + district.scores.excavation * 1.8) *
        Math.pow(pgaG / 0.15, 1.35)
    )
  );

  // Başkentgaz Automatic Seismic Shutoff & Leak Risk
  const gasVulnerability = 1.0 + (10 - district.scores.gas187) * 0.12 + district.scores.excavation * 0.04;
  const baskentgazShutoffPercent = Math.min(
    98,
    Math.round(Math.min(1, Math.pow(pgaG / 0.32, 1.15) * gasVulnerability) * 100)
  );

  // Başkent EDAŞ Power Outage Households (overhead lines more vulnerable to shaking/pole tilt)
  const overheadRatio = (100 - district.energy.undergroundCablePercent) / 100;
  const edasVulnerability = 0.55 + overheadRatio * 0.85 + (district.scores.electricity / 10) * 0.35;
  const outageFraction = Math.min(0.95, Math.pow(pgaG / 0.35, 1.2) * edasVulnerability);
  const totalHouseholds = Math.round(district.population2026 / 3.1);
  const edasOutageHouseholds = Math.round(totalHouseholds * outageFraction);

  // Fiber & Telecom degradation
  const copperOrVdslRatio = (100 - district.fiber.coveragePercent) / 100;
  const fiberDegradationPercent = Math.min(
    92,
    Math.round(Math.min(1, pgaG * 1.65 * (0.4 + copperOrVdslRatio * 0.9)) * 100)
  );

  // EGM Traffic Blackspot & Bridge/Viaduct Closure Risk
  const trafficCorridorClosureRiskPercent = Math.min(
    98,
    Math.round(
      Math.min(
        1,
        pgaG * 2.1 * (0.5 + (district.scores.traffic / 10) * 0.7)
      ) * 100
    )
  );

  // MEB School Immediate Structural & ISG Inspection Count
  const schoolRiskFactor =
    district.qualitativeRisks.schoolIsg === 'Yüksek'
      ? 0.85
      : district.qualitativeRisks.schoolIsg === 'Orta'
      ? 0.55
      : 0.35;
  const schoolImmediateInspectionCount = Math.min(
    district.schoolIsg.schoolCount,
    Math.round(district.schoolIsg.schoolCount * Math.min(1, pgaG * 2.5 * schoolRiskFactor))
  );

  // Composite Damage Score (0-100)
  const compositeDamageScore = Math.min(
    100,
    Math.round(
      askiPipeBreakProbabilityPercent * 0.25 +
        baskentgazShutoffPercent * 0.25 +
        trafficCorridorClosureRiskPercent * 0.25 +
        fiberDegradationPercent * 0.1 +
        Math.min(100, (pgaG / 0.45) * 100) * 0.15
    )
  );

  let alertLevel: DistrictSeismicImpact['alertLevel'] = 'Nominal';
  if (pgaG >= 0.22 || compositeDamageScore >= 65) {
    alertLevel = 'Kritik';
  } else if (pgaG >= 0.11 || compositeDamageScore >= 38) {
    alertLevel = 'Uyarı';
  } else if (pgaG >= 0.04 || compositeDamageScore >= 15) {
    alertLevel = 'Dikkat';
  }

  return {
    districtId: district.id,
    districtName: district.name,
    epicentralDistanceKm: epicentralKm,
    hypocentralDistanceKm: hypocentralKm,
    pWaveArrivalSec,
    sWaveArrivalSec,
    soilAmplificationFactor: soilAmp,
    pgaG,
    pgvCmSec,
    mmiNumeric,
    mmiRoman,
    alertLevel,
    askiPipeBreakProbabilityPercent,
    estimatedAsbestosPipeBreaks,
    baskentgazShutoffPercent,
    edasOutageHouseholds,
    fiberDegradationPercent,
    trafficCorridorClosureRiskPercent,
    schoolImmediateInspectionCount,
    compositeDamageScore,
  };
}

/**
 * Computes wavefront radii at elapsed time t (seconds)
 */
export function computeWavefrontState(elapsedSec: number, isActive: boolean): WavefrontState {
  const safeT = Math.max(0, elapsedSec);
  return {
    elapsedSec: Number(safeT.toFixed(2)),
    pWaveRadiusKm: Number((safeT * P_WAVE_VELOCITY_KM_S).toFixed(1)),
    sWaveRadiusKm: Number((safeT * S_WAVE_VELOCITY_KM_S).toFixed(1)),
    surfaceWaveRadiusKm: Number((safeT * SURFACE_WAVE_VELOCITY_KM_S).toFixed(1)),
    isActive,
  };
}

/**
 * Computes instantaneous 3D ground oscillation amplitude (0 to 1+) for a district at elapsed time t
 */
export function computeInstantaneousGroundMotion(
  impact: DistrictSeismicImpact,
  elapsedSec: number,
  isSimulating: boolean
): { intensity: number; phase: 'Beklemede' | 'P-Dalgası (Öncü)' | 'S-Dalgası (Yıkıcı)' | 'Sönümlenme' } {
  if (!isSimulating || elapsedSec <= 0) {
    return { intensity: 0, phase: 'Beklemede' };
  }
  if (elapsedSec < impact.pWaveArrivalSec) {
    return { intensity: 0, phase: 'Beklemede' };
  }
  const normalizedPga = Math.min(1.5, impact.pgaG / 0.35);
  if (elapsedSec < impact.sWaveArrivalSec) {
    // P-wave compressional vertical jolt (lower amplitude, higher frequency)
    const pEnvelope = Math.min(1, (elapsedSec - impact.pWaveArrivalSec) / 1.5);
    return {
      intensity: Number((normalizedPga * 0.32 * pEnvelope).toFixed(3)),
      phase: 'P-Dalgası (Öncü)',
    };
  }
  const timeSinceS = elapsedSec - impact.sWaveArrivalSec;
  const strongMotionDuration = 12.0; // seconds of strong S-wave & Love/Rayleigh surface wave
  if (timeSinceS <= strongMotionDuration) {
    const codaDecay = Math.exp(-timeSinceS / 9.5);
    const envelope = Math.min(1, timeSinceS / 0.8) * codaDecay;
    return {
      intensity: Number((normalizedPga * envelope).toFixed(3)),
      phase: 'S-Dalgası (Yıkıcı)',
    };
  }
  const tailDecay = Math.exp(-(timeSinceS - strongMotionDuration) / 6.0);
  const residual = Number((normalizedPga * 0.25 * tailDecay).toFixed(3));
  return {
    intensity: residual < 0.005 ? 0 : residual,
    phase: 'Sönümlenme',
  };
}

/**
 * Formats remaining seconds for the 30-minute (1800s) auto-update cycle as MM:SS
 */
export function formatRefreshCountdown(remainingSeconds: number): string {
  const clamped = Math.max(0, Math.floor(remainingSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Computes spatial soil amplification at any 3D map coordinate (x, z)
 * modeling Ankara's alluvial basins (Sincan-Etimesgut, Gölbaşı-Mogan, Polatlı, Çubuk)
 */
export function computeSpatialSoilAmplificationAt(x: number, z: number): number {
  const sincanBasin = 0.28 * Math.exp(-((x + 15) * (x + 15) + (z - 1) * (z - 1)) / 95);
  const golbasiBasin = 0.34 * Math.exp(-((x - 1) * (x - 1) + (z - 16) * (z - 16)) / 85);
  const polatliBasin = 0.25 * Math.exp(-((x + 34) * (x + 34) + (z - 16) * (z - 16)) / 140);
  const cubukBasin = 0.22 * Math.exp(-((x - 6) * (x - 6) + (z + 20) * (z + 20)) / 110);
  return Number(Math.min(1.68, 1.02 + sincanBasin + golbasiBasin + polatliBasin + cubukBasin).toFixed(2));
}

/**
 * Computes dynamic PGA intensity (g) at a map coordinate (x, z) for the 3D heatmap overlay.
 * When simulation is playing, intensity dynamically lights up as P-wave and S-wave fronts
 * sweep across the city map; when paused, it shows the static peak PGA distribution.
 */
export function computeGridPointDynamicPGA(
  gridCoord: { x: number; z: number },
  epicenter: { x: number; z: number },
  magnitudeMw: number,
  depthKm: number,
  elapsedSec: number,
  isSimulating: boolean
): number {
  const { hypocentralKm } = computeDistancesKm(epicenter, gridCoord, depthKm);
  const soilAmp = computeSpatialSoilAmplificationAt(gridCoord.x, gridCoord.z);
  const peakPga = computeAttenuatedPGA(magnitudeMw, hypocentralKm, soilAmp);

  if (!isSimulating || elapsedSec <= 0) {
    return peakPga;
  }

  const pArrival = hypocentralKm / P_WAVE_VELOCITY_KM_S;
  const sArrival = hypocentralKm / S_WAVE_VELOCITY_KM_S;

  if (elapsedSec < pArrival - 0.6) {
    // Unreached zone ahead of P-wave: faint baseline tectonic stress
    return Number((peakPga * 0.04).toFixed(4));
  }

  if (elapsedSec < sArrival) {
    // Between P-wave and S-wave arrival: rising compressional wave front (35% to 65% of peak)
    const pProgress = Math.min(1, Math.max(0, (elapsedSec - (pArrival - 0.6)) / Math.max(0.8, sArrival - pArrival + 0.6)));
    return Number((peakPga * (0.28 + 0.37 * pProgress)).toFixed(4));
  }

  // S-wave & surface wave peak pulse + residual thermal footprint (coda)
  const timeSinceS = elapsedSec - sArrival;
  const sPulse = Math.exp(-timeSinceS / 8.5);
  // Surge to 1.15x at the S-wave crest, then settle to 0.58x residual PGA footprint
  const factor = Math.min(1.18, 0.58 + 0.60 * sPulse);
  return Number((peakPga * factor).toFixed(4));
}

/**
 * Normalizes a PGA value (in g) into [0, 1] for d3-scale-chromatic color interpolation
 */
export function normalizePgaForChromaticScale(pgaG: number): number {
  const safe = Math.max(0, Math.min(0.45, pgaG));
  const linear = safe / 0.45;
  return Number(Math.min(1, Math.max(0, Math.pow(linear, 0.68))).toFixed(4));
}

export const SIMULATION_DURATION_SEC = 24.0;

export interface PostEarthquakeReport {
  faultName: string;
  faultShortName: string;
  faultType: string;
  magnitudeMw: number;
  depthKm: number;
  durationSec: number;
  overallStatus: 'KRİTİK AFET DURUMU' | 'YÜKSEK UYARI' | 'DİKKAT' | 'NOMİNAL';
  maxPgaG: number;
  maxMmiRoman: string;
  epicenterDistrictId: string;
  epicenterDistrictName: string;
  criticalDistrictCount: number;
  warningDistrictCount: number;
  totalEstimatedPipeBreaks: number;
  totalGasShutoffSubscribers: number;
  totalEdasOutageHouseholds: number;
  totalSchoolsRequiringInspection: number;
  highRiskTrafficCorridorCount: number;
  topImpactedDistricts: DistrictSeismicImpact[];
  actionDirectives: Array<{
    agency: string;
    hotline: string;
    directive: string;
  }>;
}

/**
 * Compiles a comprehensive province-wide post-earthquake damage and infrastructure report
 * across all 25 Ankara districts when the simulation concludes.
 */
export function compilePostEarthquakeReport(
  districts: DistrictData[],
  impactsById: Record<string, DistrictSeismicImpact>,
  fault: FaultLineScenario,
  magnitudeMw: number,
  depthKm: number,
  durationSec: number = SIMULATION_DURATION_SEC
): PostEarthquakeReport {
  const allImpacts = districts
    .map((d) => impactsById[d.id])
    .filter((imp): imp is DistrictSeismicImpact => Boolean(imp));

  const sortedByImpact = [...allImpacts].sort(
    (a, b) => b.pgaG - a.pgaG || b.compositeDamageScore - a.compositeDamageScore
  );

  const hardestHit = sortedByImpact[0];
  let criticalDistrictCount = 0;
  let warningDistrictCount = 0;
  let totalEstimatedPipeBreaks = 0;
  let totalGasShutoffSubscribers = 0;
  let totalEdasOutageHouseholds = 0;
  let totalSchoolsRequiringInspection = 0;
  let highRiskTrafficCorridorCount = 0;

  for (const d of districts) {
    const imp = impactsById[d.id];
    if (!imp) continue;
    if (imp.alertLevel === 'Kritik') criticalDistrictCount++;
    if (imp.alertLevel === 'Uyarı' || imp.alertLevel === 'Kritik') warningDistrictCount++;
    totalEstimatedPipeBreaks += imp.estimatedAsbestosPipeBreaks;
    totalGasShutoffSubscribers += Math.round(
      d.energy.gasSubscribers * (imp.baskentgazShutoffPercent / 100)
    );
    totalEdasOutageHouseholds += imp.edasOutageHouseholds;
    totalSchoolsRequiringInspection += imp.schoolImmediateInspectionCount;
    if (imp.trafficCorridorClosureRiskPercent >= 35) {
      highRiskTrafficCorridorCount += d.traffic.blackspots.length;
    }
  }

  let overallStatus: PostEarthquakeReport['overallStatus'] = 'NOMİNAL';
  if (criticalDistrictCount >= 2 || (hardestHit && hardestHit.pgaG >= 0.25)) {
    overallStatus = 'KRİTİK AFET DURUMU';
  } else if (warningDistrictCount >= 2 || (hardestHit && hardestHit.pgaG >= 0.12)) {
    overallStatus = 'YÜKSEK UYARI';
  } else if (hardestHit && hardestHit.pgaG >= 0.05) {
    overallStatus = 'DİKKAT';
  }

  const topDistrictNames = sortedByImpact
    .slice(0, 3)
    .map((i) => i.districtName)
    .join(', ');

  const actionDirectives = [
    {
      agency: 'ASKİ Genel Müdürlüğü',
      hotline: 'Alo 153',
      directive: `${topDistrictNames} başta olmak üzere il genelinde tahmini ~${totalEstimatedPipeBreaks} asbest/eski içme suyu boru kırığına acil izolasyon vanası müdahalesi.`,
    },
    {
      agency: 'Başkentgaz SCADA / RMS',
      hotline: 'Alo 187',
      directive: `Sismik hareket eşiği aşımı nedeniyle ~${totalGasShutoffSubscribers.toLocaleString('tr-TR')} abonede otomatik kesilen RMS-A/B regülatör istasyonlarında sızıntı (CH4) taraması.`,
    },
    {
      agency: 'Başkent EDAŞ & AYKOME',
      hotline: 'Alo 186',
      directive: `Elektrik kesintisi yaşayan ~${totalEdasOutageHouseholds.toLocaleString('tr-TR')} hanede trafo sismik röle kontrolü ve ${highRiskTrafficCorridorCount} kritik ulaşım noktasında koridor güvenliği.`,
    },
    {
      agency: 'MEB İSG & AFAD Ankara',
      hotline: 'Alo 112 / 122',
      directive: `Sarsıntıdan etkilenen ${totalSchoolsRequiringInspection} eğitim kurumunda hızlı yapısal ön hasar tespiti ve toplanma alanı koordinasyonu.`,
    },
  ];

  return {
    faultName: fault.name,
    faultShortName: fault.shortName,
    faultType: fault.faultType,
    magnitudeMw,
    depthKm,
    durationSec,
    overallStatus,
    maxPgaG: hardestHit ? hardestHit.pgaG : 0,
    maxMmiRoman: hardestHit ? hardestHit.mmiRoman : 'I',
    epicenterDistrictId: hardestHit ? hardestHit.districtId : 'cankaya',
    epicenterDistrictName: hardestHit ? hardestHit.districtName : 'Çankaya',
    criticalDistrictCount,
    warningDistrictCount,
    totalEstimatedPipeBreaks,
    totalGasShutoffSubscribers,
    totalEdasOutageHouseholds,
    totalSchoolsRequiringInspection,
    highRiskTrafficCorridorCount,
    topImpactedDistricts: sortedByImpact.slice(0, 8),
    actionDirectives,
  };
}


