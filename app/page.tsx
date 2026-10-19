'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Flame,
  Play,
  RotateCcw,
  Square,
  Share2,
  Bookmark,
  BookmarkPlus,
  Layers,
  Sparkles,
  Mountain,
  Volume2,
  VolumeX,
} from 'lucide-react';
import AnkaraSeismicCanvas, {
  type CameraPreset,
  type LayerMode,
  type TerrainContrastMode,
} from '@/components/AnkaraSeismicCanvas';
import DistrictInspectorDrawer from '@/components/DistrictInspectorDrawer';
import ModalsOverlay, { type ActiveModalType } from '@/components/ModalsOverlay';
import {
  ANKARA_DISTRICTS,
  FAULT_SCENARIOS,
  type FaultLineScenario,
} from '@/lib/ankara-data';
import {
  evaluateDistrictSeismicImpact,
  computeWavefrontState,
  formatRefreshCountdown,
  compilePostEarthquakeReport,
  SIMULATION_DURATION_SEC,
  type DistrictSeismicImpact,
} from '@/lib/seismic-engine';
import {
  parseShareUrl,
  TERRAIN_CONTRAST_OPTIONS,
  type SavedScenario,
} from '@/lib/scenario-storage';
import { seismicAudio } from '@/lib/seismic-audio';

export default function HomePage() {
  // Selected fault scenario & earthquake parameters
  const [selectedFaultId, setSelectedFaultId] = useState<string>(FAULT_SCENARIOS[0].id);
  const activeFault: FaultLineScenario = useMemo(
    () => FAULT_SCENARIOS.find((f) => f.id === selectedFaultId) || FAULT_SCENARIOS[0],
    [selectedFaultId]
  );

  const [magnitudeMw, setMagnitudeMw] = useState<number>(FAULT_SCENARIOS[0].defaultMw);
  const [depthKm, setDepthKm] = useState<number>(FAULT_SCENARIOS[0].defaultDepthKm);

  // Togglable d3-scale-chromatic PGA Heatmap Overlay (default ON)
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState<boolean>(true);

  // Wavefront propagation speed multiplier (0.5x, 1x, 2x)
  const [wavefrontSpeed, setWavefrontSpeed] = useState<number>(1.0);

  // Terrain Contrast mode ('normal' | 'high' | 'topographic' | 'satellite')
  const [terrainContrast, setTerrainContrast] = useState<TerrainContrastMode>('high');

  // Selected district & inspector drawer
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('cankaya');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

  // Layer visualization & camera preset
  const [layerMode] = useState<LayerMode>('pga');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');

  // Collapsible Bottom Dock ("Cinema Mode")
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);

  // Active modal ('none' | 'matrix' | 'live_feed' | 'pubchem' | 'results')
  const [activeModal, setActiveModal] = useState<ActiveModalType>('none');
  const [initialPubChemCid, setInitialPubChemCid] = useState<number>(297);

  // Seismic simulation playback state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  // Low-frequency tectonic rumbling audio state (Web Audio API)
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(false);
  const [audioIntensity, setAudioIntensity] = useState<number>(0);

  // 30-Minute (1800 seconds) Auto-Update Live Feed state
  const [remainingRefreshSec, setRemainingRefreshSec] = useState<number>(1800);
  const [liveFeed, setLiveFeed] = useState<any>(null);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState<boolean>(false);

  // Compute seismic and infrastructure impacts for all 25 Ankara districts
  const impactsById: Record<string, DistrictSeismicImpact> = useMemo(() => {
    const map: Record<string, DistrictSeismicImpact> = {};
    for (const d of ANKARA_DISTRICTS) {
      map[d.id] = evaluateDistrictSeismicImpact(
        d,
        magnitudeMw,
        depthKm,
        activeFault.epicenter
      );
    }
    return map;
  }, [magnitudeMw, depthKm, activeFault]);

  // Compile province-wide post-earthquake damage report across all 25 districts
  const postEarthquakeReport = useMemo(
    () =>
      compilePostEarthquakeReport(
        ANKARA_DISTRICTS,
        impactsById,
        activeFault,
        magnitudeMw,
        depthKm,
        SIMULATION_DURATION_SEC
      ),
    [impactsById, activeFault, magnitudeMw, depthKm]
  );

  const selectedDistrict = useMemo(
    () => ANKARA_DISTRICTS.find((d) => d.id === selectedDistrictId) || ANKARA_DISTRICTS[6],
    [selectedDistrictId]
  );

  const selectedImpact = impactsById[selectedDistrict.id];

  const wavefront = useMemo(
    () => computeWavefrontState(elapsedSec, isSimulating),
    [elapsedSec, isSimulating]
  );

  // Fetch 30-minute live feed (Google Search Grounded via /api/live-feed)
  const fetchLiveFeed = useCallback(async (force = false, districtName = 'Ankara Geneli') => {
    setIsRefreshingFeed(true);
    try {
      const url = `/api/live-feed?${force ? 'force=1&' : ''}district=${encodeURIComponent(
        districtName
      )}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLiveFeed(data);
        setRemainingRefreshSec(1800);
      }
    } catch {
      // Resilient fallback handled by server
    } finally {
      setIsRefreshingFeed(false);
    }
  }, []);

  // Initial fetch + 30-minute (1800s) auto-update interval
  useEffect(() => {
    fetchLiveFeed(false, 'Ankara Geneli');

    const timer = setInterval(() => {
      setRemainingRefreshSec((prev) => {
        if (prev <= 1) {
          fetchLiveFeed(true, 'Ankara Geneli');
          return 1800;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchLiveFeed]);

  // Simulation wave propagation timer: automatically stops and opens Results Report when earthquake ends
  useEffect(() => {
    if (!isSimulating) return;

    const simInterval = setInterval(() => {
      setElapsedSec((prev) => Number((prev + 0.5 * wavefrontSpeed).toFixed(2)));
    }, 100);

    return () => clearInterval(simInterval);
  }, [isSimulating, wavefrontSpeed]);

  useEffect(() => {
    if (isSimulating && elapsedSec >= SIMULATION_DURATION_SEC) {
      setIsSimulating(false);
      setActiveModal('results');
    }
  }, [isSimulating, elapsedSec]);

  // Subscribe to seismic audio engine state changes
  useEffect(() => {
    const unsub = seismicAudio.subscribe((st) => {
      setIsAudioEnabled(st.isEnabled);
      setAudioIntensity(st.currentIntensity);
    });
    return () => {
      unsub();
      seismicAudio.stopRumble(true);
    };
  }, []);

  // Synchronize audio rumble intensity with simulation wave progress & magnitude
  useEffect(() => {
    if (isAudioEnabled && isSimulating) {
      seismicAudio.updateRumbleIntensity(
        elapsedSec,
        SIMULATION_DURATION_SEC,
        magnitudeMw,
        isSimulating
      );
    } else if (!isSimulating) {
      seismicAudio.stopRumble();
    }
  }, [isAudioEnabled, isSimulating, elapsedSec, magnitudeMw]);

  // Toggle audio rumble handler (Web Audio API)
  const handleToggleAudio = useCallback(() => {
    const next = seismicAudio.toggleAudio();
    setIsAudioEnabled(next);
    if (next && isSimulating) {
      seismicAudio.startRumble(magnitudeMw);
      seismicAudio.updateRumbleIntensity(
        elapsedSec,
        SIMULATION_DURATION_SEC,
        magnitudeMw,
        true
      );
    }
  }, [isSimulating, magnitudeMw, elapsedSec]);

  // Keyboard shortcut 'H' to collapse/expand bottom control dock, 'M' to toggle seismic audio
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setIsDockCollapsed((prev) => !prev);
      }
      if (e.key === 'm' || e.key === 'M') {
        handleToggleAudio();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleAudio]);

  // Restore scenario parameters from URL query parameters (Share link) on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseShareUrl(window.location.search);
    if (parsed.faultId) {
      setSelectedFaultId(parsed.faultId);
    }
    if (typeof parsed.magnitudeMw === 'number') {
      setMagnitudeMw(parsed.magnitudeMw);
    }
    if (typeof parsed.depthKm === 'number') {
      setDepthKm(parsed.depthKm);
    }
    if (typeof parsed.wavefrontSpeed === 'number') {
      setWavefrontSpeed(parsed.wavefrontSpeed);
    }
    if (parsed.terrainContrast) {
      setTerrainContrast(parsed.terrainContrast);
    }
    if (typeof parsed.showHeatmapOverlay === 'boolean') {
      setShowHeatmapOverlay(parsed.showHeatmapOverlay);
    }
  }, []);

  const handleLoadScenario = useCallback((scenario: SavedScenario) => {
    setSelectedFaultId(scenario.faultId);
    setMagnitudeMw(scenario.magnitudeMw);
    setDepthKm(scenario.depthKm);
    setWavefrontSpeed(scenario.wavefrontSpeed);
    setTerrainContrast(scenario.terrainContrast);
    setShowHeatmapOverlay(scenario.showHeatmapOverlay);
    setElapsedSec(0.4);
    setIsSimulating(true);
    if (isAudioEnabled) {
      seismicAudio.startRumble(scenario.magnitudeMw);
    }
    setActiveModal('none');
  }, [isAudioEnabled]);

  const handleFaultChange = (faultId: string) => {
    setSelectedFaultId(faultId);
    const f = FAULT_SCENARIOS.find((item) => item.id === faultId);
    if (f) {
      setMagnitudeMw(f.defaultMw);
      setDepthKm(f.defaultDepthKm);
    }
  };

  const handleStartOrFinishSimulation = () => {
    if (isSimulating) {
      // Finishing earthquake early immediately presents the Post-Earthquake Results Report
      setIsSimulating(false);
      setElapsedSec(SIMULATION_DURATION_SEC);
      seismicAudio.stopRumble();
      setActiveModal('results');
    } else {
      setActiveModal('none');
      setElapsedSec(0.4);
      setIsSimulating(true);
      if (isAudioEnabled) {
        seismicAudio.startRumble(magnitudeMw);
      }
    }
  };

  const handleReplaySimulation = useCallback(() => {
    setActiveModal('none');
    setElapsedSec(0.4);
    setIsSimulating(true);
    if (isAudioEnabled) {
      seismicAudio.startRumble(magnitudeMw);
    }
  }, [isAudioEnabled, magnitudeMw]);

  const handleSelectDistrict = useCallback((id: string) => {
    setSelectedDistrictId(id);
    setIsInspectorOpen(true);
  }, []);

  const handleOpenPubChem = useCallback((cid: number) => {
    setInitialPubChemCid(cid);
    setActiveModal('pubchem');
  }, []);

  const countdownFormatted = formatRefreshCountdown(remainingRefreshSec);

  return (
    <main
      data-state={isSimulating ? 'simulating' : activeModal === 'results' ? 'results' : 'ready'}
      className="relative w-screen h-screen overflow-hidden select-none bg-[#0B0E17]"
    >
      {/* 1. Full-Bleed 3D Ankara Seismic & d3-scale-chromatic PGA Heatmap Canvas */}
      <AnkaraSeismicCanvas
        selectedDistrictId={selectedDistrictId}
        onSelectDistrict={handleSelectDistrict}
        activeFault={activeFault}
        impactsById={impactsById}
        layerMode={layerMode}
        cameraPreset={cameraPreset}
        isSimulating={isSimulating}
        elapsedSec={elapsedSec}
        magnitudeMw={magnitudeMw}
        depthKm={depthKm}
        showHeatmapOverlay={showHeatmapOverlay}
        wavefrontSpeed={wavefrontSpeed}
        terrainContrast={terrainContrast}
      />

      {/* 2. Clean 3-Zone Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-6 pl-5 pr-14 py-3 bg-[#0B0E17] border-b border-slate-800">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setCameraPreset('overview');
          }}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          ANKA-SİSMİK 3D
        </a>

        {/* Zone 2: Concise Navigation Links */}
        <nav
          aria-label="Ana Veri Modülleri"
          className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-300"
        >
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'results' ? 'none' : 'results')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sonuç Raporu
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'matrix' ? 'none' : 'matrix')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            25 İlçe Tablosu
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'live_feed' ? 'none' : 'live_feed')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Canlı Veri ({countdownFormatted})
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'pubchem' ? 'none' : 'pubchem')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Kimyasal Risk (PubChem)
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'saved_scenarios' ? 'none' : 'saved_scenarios')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModal === 'saved_scenarios'
                ? 'bg-purple-500/25 text-purple-200 border border-purple-400/60'
                : 'bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-purple-400" />
            <span>Senaryolar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'share' ? 'none' : 'share')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModal === 'share'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60'
                : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Paylaş</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'export_guide' ? 'none' : 'export_guide')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>İndir / .EXE</span>
          </button>
        </nav>

        {/* Zone 3: Primary Simulation Action Button & Mobile Share */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveModal('share')}
            title="Senaryoyu Paylaş"
            aria-label="Senaryoyu Paylaş"
            className="md:hidden p-2 bg-[#0F1624] hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleStartOrFinishSimulation}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              isSimulating
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
          >
            {isSimulating ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Bitir & Sonuçlar ({wavefront.elapsedSec}s / {SIMULATION_DURATION_SEC}s)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simülasyonu Başlat</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 3. Compact On-Demand District Summary Card */}
      <DistrictInspectorDrawer
        district={selectedDistrict}
        impact={selectedImpact}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        onSelectDistrict={handleSelectDistrict}
        onOpenPubChem={handleOpenPubChem}
        isSimulating={isSimulating}
        elapsedSec={elapsedSec}
      />

      {/* 4. Streamlined Single-Row Bottom Control Bar */}
      <section
        aria-label="Sismik Senaryo ve PGA Isı Haritası Kontrol Çubuğu"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96vw] max-w-[1240px] flex flex-col items-center pointer-events-none"
      >
        {/* Minimal Collapse Handle */}
        <button
          type="button"
          onClick={() => setIsDockCollapsed((prev) => !prev)}
          className="pointer-events-auto mb-1 px-3 py-1 text-[11px] font-medium bg-[#0F1624] hover:bg-[#162033] text-slate-300 border border-slate-800 rounded-t-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {isDockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kontrolleri Göster (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Gizle (H)</span>
            </>
          )}
        </button>

        {!isDockCollapsed && (
          <div className="pointer-events-auto w-full bg-[#0F1624] border border-slate-800 rounded-xl shadow-2xl px-4 py-3 text-xs">
            <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
              {/* 1. Fault Scenario Selector */}
              <div className="w-full sm:w-[190px] shrink-0">
                <label
                  htmlFor="fault-scenario-select"
                  className="block text-[10px] font-medium text-slate-400 mb-1"
                >
                  Fay Hattı Senaryosu
                </label>
                <select
                  id="fault-scenario-select"
                  value={selectedFaultId}
                  onChange={(e) => handleFaultChange(e.target.value)}
                  className="w-full bg-[#0B0E17] text-slate-100 font-medium text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {FAULT_SCENARIOS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.shortName} (Mw {f.defaultMw})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Magnitude Slider */}
              <div className="flex-1 min-w-[120px]">
                <div className="flex justify-between text-[10px] mb-1">
                  <label htmlFor="mw-slider" className="text-slate-400 font-medium">
                    Büyüklük
                  </label>
                  <span className="font-mono font-bold text-rose-400 tabular-nums">
                    Mw {magnitudeMw.toFixed(1)} · {depthKm}km
                  </span>
                </div>
                <input
                  id="mw-slider"
                  type="range"
                  min={4.5}
                  max={7.6}
                  step={0.1}
                  value={magnitudeMw}
                  onChange={(e) => setMagnitudeMw(parseFloat(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* 3. Wavefront Propagation Speed Selector (0.5x, 1x, 2x + Stepper) */}
              <div className="flex flex-col justify-center shrink-0">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-1">
                  <label htmlFor="wavefront-speed-input">Dalga Hızı</label>
                  <span className="font-mono text-cyan-400 font-bold">{wavefrontSpeed.toFixed(1)}x</span>
                </div>
                <div className="flex items-center gap-1 bg-[#0B0E17] border border-slate-700 rounded-lg p-0.5">
                  {[0.5, 1.0, 2.0].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setWavefrontSpeed(spd)}
                      className={`px-2 py-1 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                        wavefrontSpeed === spd
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                  <input
                    id="wavefront-speed-input"
                    type="number"
                    min="0.2"
                    max="4.0"
                    step="0.1"
                    aria-label="Dalga Yayılım Hızı Çarpanı"
                    value={wavefrontSpeed}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0 && val <= 5.0) {
                        setWavefrontSpeed(Number(val.toFixed(1)));
                      }
                    }}
                    className="w-11 bg-transparent text-center text-[11px] font-mono text-slate-200 border-l border-slate-700 pl-1 py-0.5 focus:outline-none focus:text-cyan-400"
                  />
                </div>
              </div>

              {/* 4. Arazi Kontrastı Selector (Normal, Yüksek, Topoğrafik, Radar/Gece) */}
              <div className="flex flex-col justify-center shrink-0">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-1">
                  <span className="flex items-center gap-1">
                    <Mountain className="w-3 h-3 text-emerald-400" />
                    <span>Arazi Kontrastı</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {TERRAIN_CONTRAST_OPTIONS.find((c) => c.id === terrainContrast)?.shortLabel || 'Yüksek'}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 bg-[#0B0E17] border border-slate-700 rounded-lg p-0.5">
                  {TERRAIN_CONTRAST_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTerrainContrast(opt.id)}
                      title={opt.description}
                      className={`px-2 py-1 text-[10px] font-medium rounded transition-colors cursor-pointer ${
                        terrainContrast === opt.id
                          ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Togglable d3-scale-chromatic PGA Heatmap Button + Color Scale Legend */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  aria-pressed={showHeatmapOverlay}
                  onClick={() => setShowHeatmapOverlay((prev) => !prev)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    showHeatmapOverlay
                      ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                      : 'bg-[#0B0E17] border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Isı Haritası {showHeatmapOverlay ? '(Açık)' : '(Kapalı)'}</span>
                </button>

                {showHeatmapOverlay && (
                  <div
                    aria-label="d3-scale-chromatic PGA İvme Renk Ölçeği"
                    className="hidden sm:flex flex-col justify-center bg-[#0B0E17] border border-slate-800 rounded-lg px-2 py-1"
                  >
                    <div className="w-20 h-1.5 rounded-full bg-gradient-to-r from-[#ffffcc] via-[#fd8d3c] to-[#bd0026]" />
                    <div className="flex justify-between text-[8px] font-mono text-slate-400 mt-0.5 tabular-nums">
                      <span>0.01g</span>
                      <span>0.45g+</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Audio Toggle Control: Low-Frequency Tectonic Rumble SFX */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-pressed={isAudioEnabled}
                  onClick={handleToggleAudio}
                  title={`Düşük Frekanslı Sismik Uğultu Efekti [M] - ${
                    isAudioEnabled ? 'Açık (Simülasyonda yoğunlaşır)' : 'Kapalı'
                  }`}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isAudioEnabled
                      ? 'bg-indigo-600/25 border-indigo-500/60 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                      : 'bg-[#0B0E17] border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {isAudioEnabled ? (
                    <Volume2
                      className={`w-3.5 h-3.5 text-indigo-400 ${
                        isSimulating ? 'animate-pulse' : ''
                      }`}
                    />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>Sismik Ses {isAudioEnabled ? '(Açık)' : '(Kapalı)'}</span>

                  {/* Dynamic audio intensity visualizer bars when enabled */}
                  {isAudioEnabled && (
                    <div
                      className="flex items-end gap-0.5 h-3 w-4 pl-0.5"
                      title={`Sismik Uğultu Yoğunluğu: %${Math.round(audioIntensity * 100)}`}
                    >
                      <span
                        className="w-0.5 bg-indigo-400 rounded-t transition-all duration-75"
                        style={{
                          height: `${Math.max(2, isSimulating ? 3 + audioIntensity * 9 : 2)}px`,
                        }}
                      />
                      <span
                        className="w-0.5 bg-indigo-300 rounded-t transition-all duration-75"
                        style={{
                          height: `${Math.max(2, isSimulating ? 4 + audioIntensity * 10 : 2)}px`,
                        }}
                      />
                      <span
                        className="w-0.5 bg-indigo-400 rounded-t transition-all duration-75"
                        style={{
                          height: `${Math.max(2, isSimulating ? 2 + audioIntensity * 8 : 2)}px`,
                        }}
                      />
                    </div>
                  )}
                </button>
              </div>

              {/* 7. District Inspector Toggle & Camera Reset & Quick Save/Share */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen((prev) => !prev)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    isInspectorOpen
                      ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                      : 'bg-[#0B0E17] border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  İlçe: {selectedDistrict.name}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCameraPreset((prev) =>
                      prev === 'overview' ? 'metro_core' : 'overview'
                    )
                  }
                  title="Kamerayı Merkeze Odakla / Genel Görünüm"
                  aria-label="Kamerayı Sıfırla"
                  className="p-1.5 bg-[#0B0E17] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('saved_scenarios')}
                  title="Senaryoyu Kaydet & Şablonlar"
                  aria-label="Senaryoyu Kaydet"
                  className="p-1.5 bg-[#0B0E17] hover:bg-purple-950/40 text-purple-300 border border-slate-700 hover:border-purple-500/50 rounded-lg transition-colors cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-purple-400" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('share')}
                  title="Senaryoyu Paylaş"
                  aria-label="Senaryoyu Paylaş"
                  className="p-1.5 bg-[#0B0E17] hover:bg-cyan-950/40 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 rounded-lg transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. Analytical, Live Data, Post-Earthquake Results, Saved Scenarios & Share Modals */}
      <ModalsOverlay
        activeModal={activeModal}
        onClose={() => setActiveModal('none')}
        onSwitchModal={(m) => setActiveModal(m)}
        impactsById={impactsById}
        postEarthquakeReport={postEarthquakeReport}
        onReplaySimulation={handleReplaySimulation}
        onSelectDistrictFromMatrix={handleSelectDistrict}
        liveFeed={liveFeed}
        isRefreshingFeed={isRefreshingFeed}
        onForceRefreshFeed={(distName) => fetchLiveFeed(true, distName)}
        countdownFormatted={countdownFormatted}
        initialPubChemCid={initialPubChemCid}
        currentScenario={{
          faultId: selectedFaultId,
          magnitudeMw,
          depthKm,
          wavefrontSpeed,
          terrainContrast,
          showHeatmapOverlay,
        }}
        onLoadScenario={handleLoadScenario}
      />
    </main>
  );
}
