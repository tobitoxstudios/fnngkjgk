'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  ExternalLink,
  FlaskConical,
  Globe,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  ArrowUpDown,
  Phone,
  Database,
  Download,
  FileCode,
  FileText,
  Monitor,
  Terminal,
  Layers,
  Check,
  Share2,
  Bookmark,
  BookmarkPlus,
  Save,
  Trash2,
  Copy,
  Send,
  UploadCloud,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  ANKARA_DISTRICTS,
  ANKARA_SUMMARY_STATS,
  HAZMAT_COMPOUNDS,
  FAULT_SCENARIOS,
  type DistrictData,
} from '@/lib/ankara-data';
import type {
  DistrictSeismicImpact,
  PostEarthquakeReport,
} from '@/lib/seismic-engine';
import {
  generateStandaloneHtmlReport,
  generateJsonExport,
  generateGeoJsonExport,
  triggerBrowserDownload,
} from '@/lib/export-utils';
import {
  type SavedScenario,
  type TerrainContrastMode,
  getAllScenarios,
  saveScenario,
  deleteScenario,
  exportScenariosAsJson,
  importScenariosFromJson,
  buildShareUrl,
  buildBriefingReportText,
  TERRAIN_CONTRAST_OPTIONS,
} from '@/lib/scenario-storage';
import type { PubChemCompoundProfile } from '@/app/api/pubchem/route';

export type ActiveModalType =
  | 'none'
  | 'matrix'
  | 'live_feed'
  | 'pubchem'
  | 'results'
  | 'export_guide'
  | 'saved_scenarios'
  | 'share';

interface LiveFeedResponse {
  lastUpdatedIso: string;
  nextUpdateIso: string;
  refreshIntervalSeconds: number;
  summaryText: string;
  groundingSources: Array<{ title: string; uri: string }>;
  portalFeeds: Array<{
    institutionId: string;
    institutionName: string;
    category: string;
    status: string;
    latestNotice: string;
    portalUrl: string;
    contact: string;
  }>;
  isLiveSearchGrounded: boolean;
}

interface ModalsOverlayProps {
  activeModal: ActiveModalType;
  onClose: () => void;
  onSwitchModal?: (modal: ActiveModalType) => void;
  impactsById: Record<string, DistrictSeismicImpact>;
  postEarthquakeReport?: PostEarthquakeReport;
  onReplaySimulation?: () => void;
  onSelectDistrictFromMatrix: (districtId: string) => void;
  liveFeed: LiveFeedResponse | null;
  isRefreshingFeed: boolean;
  onForceRefreshFeed: (districtName?: string) => void;
  countdownFormatted: string;
  initialPubChemCid: number;
  currentScenario?: {
    faultId: string;
    magnitudeMw: number;
    depthKm: number;
    wavefrontSpeed: number;
    terrainContrast: TerrainContrastMode;
    showHeatmapOverlay: boolean;
  };
  onLoadScenario?: (scenario: SavedScenario) => void;
}

export default function ModalsOverlay({
  activeModal,
  onClose,
  onSwitchModal,
  impactsById,
  postEarthquakeReport,
  onReplaySimulation,
  onSelectDistrictFromMatrix,
  liveFeed,
  isRefreshingFeed,
  onForceRefreshFeed,
  countdownFormatted,
  initialPubChemCid,
  currentScenario,
  onLoadScenario,
}: ModalsOverlayProps) {
  // Matrix filter & sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'pga' | 'damage' | 'pop' | 'asbestos' | 'gas'>('pga');

  // PubChem workbench states
  const [selectedCid, setSelectedCid] = useState<number>(initialPubChemCid || 297);
  const [pubchemProfile, setPubchemProfile] = useState<PubChemCompoundProfile | null>(null);
  const [isLoadingPubchem, setIsLoadingPubchem] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string>('');

  // Scenario management & share states
  const [allScenariosList, setAllScenariosList] = useState<SavedScenario[]>([]);
  const [scenarioFilter, setScenarioFilter] = useState<'all' | 'custom' | 'preset'>('all');
  const [newScenarioName, setNewScenarioName] = useState<string>('');
  const [newScenarioDesc, setNewScenarioDesc] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<'url' | 'briefing' | null>(null);

  // Sync scenarios when modal becomes active
  useEffect(() => {
    if (activeModal === 'saved_scenarios') {
      setAllScenariosList(getAllScenarios());
      if (currentScenario) {
        const fault = FAULT_SCENARIOS.find((f) => f.id === currentScenario.faultId);
        setNewScenarioName(
          `${fault?.shortName || 'Ankara'} Mw ${currentScenario.magnitudeMw.toFixed(1)} Senaryosu`
        );
      }
    }
  }, [activeModal, currentScenario]);

  const handleSaveCurrentScenario = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentScenario) return;

    const fault = FAULT_SCENARIOS.find((f) => f.id === currentScenario.faultId);
    const topRanked = postEarthquakeReport?.topImpactedDistricts[0];

    const saved = saveScenario({
      name:
        newScenarioName.trim() ||
        `${fault?.shortName || 'Özel'} Mw ${currentScenario.magnitudeMw.toFixed(1)} Senaryosu`,
      description: newScenarioDesc.trim(),
      faultId: currentScenario.faultId,
      magnitudeMw: currentScenario.magnitudeMw,
      depthKm: currentScenario.depthKm,
      wavefrontSpeed: currentScenario.wavefrontSpeed,
      terrainContrast: currentScenario.terrainContrast,
      showHeatmapOverlay: currentScenario.showHeatmapOverlay,
      metricsSnapshot: postEarthquakeReport
        ? {
            highestRiskDistrict: topRanked ? topRanked.districtName : 'Ankara',
            maxPgaG: postEarthquakeReport.maxPgaG,
            highRiskDistrictCount:
              postEarthquakeReport.criticalDistrictCount +
              postEarthquakeReport.warningDistrictCount,
            totalSeverelyDamagedBuildings: Math.round(
              postEarthquakeReport.totalEstimatedPipeBreaks * 4.2
            ),
            estimatedShelterNeeds: Math.round(
              postEarthquakeReport.totalEdasOutageHouseholds * 0.15
            ),
          }
        : undefined,
    });

    setAllScenariosList(getAllScenarios());
    setSaveSuccessMsg(`"${saved.name}" başarıyla yerel senaryolarınıza kaydedildi!`);
    setTimeout(() => setSaveSuccessMsg(''), 4500);
  };

  const handleDeleteScenario = (id: string) => {
    deleteScenario(id);
    setAllScenariosList(getAllScenarios());
  };

  const handleExportScenarios = () => {
    const jsonStr = exportScenariosAsJson();
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerBrowserDownload(`Ankara_Sismik_Senaryolar_${dateStr}.json`, jsonStr, 'application/json');
    setSaveSuccessMsg('Senaryolar JSON olarak dışa aktarıldı!');
    setTimeout(() => setSaveSuccessMsg(''), 3500);
  };

  const handleImportScenariosFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const result = importScenariosFromJson(content);
        if (result.importedCount > 0) {
          setAllScenariosList(getAllScenarios());
          setSaveSuccessMsg(`${result.importedCount} adet senaryo başarıyla içe aktarıldı!`);
        } else {
          setSaveSuccessMsg(result.errors?.[0] || 'İçe aktarma başarısız oldu.');
        }
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Share helpers
  const activeFaultObj =
    FAULT_SCENARIOS.find((f) => f.id === currentScenario?.faultId) || FAULT_SCENARIOS[0];
  const shareUrl = currentScenario
    ? buildShareUrl({
        faultId: currentScenario.faultId,
        magnitudeMw: currentScenario.magnitudeMw,
        depthKm: currentScenario.depthKm,
        wavefrontSpeed: currentScenario.wavefrontSpeed,
        terrainContrast: currentScenario.terrainContrast,
        showHeatmapOverlay: currentScenario.showHeatmapOverlay,
      })
    : typeof window !== 'undefined'
    ? window.location.href
    : '';

  const briefingText = currentScenario
    ? buildBriefingReportText({
        scenarioName:
          newScenarioName ||
          `${activeFaultObj.shortName} Mw ${currentScenario.magnitudeMw.toFixed(1)} Senaryosu`,
        fault: activeFaultObj,
        magnitudeMw: currentScenario.magnitudeMw,
        depthKm: currentScenario.depthKm,
        wavefrontSpeed: currentScenario.wavefrontSpeed,
        terrainContrast: currentScenario.terrainContrast,
        postEarthquakeReport,
        shareUrl,
      })
    : '';

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyFeedback('url');
      setTimeout(() => setCopyFeedback(null), 3000);
    } catch {
      // Fallback
    }
  };

  const handleCopyBriefing = async () => {
    try {
      await navigator.clipboard.writeText(briefingText);
      setCopyFeedback('briefing');
      setTimeout(() => setCopyFeedback(null), 3000);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `ANKA-SİSMİK 3D: ${activeFaultObj.shortName} Mw ${currentScenario?.magnitudeMw.toFixed(1)} Deprem Simülasyonu`,
          text: `Ankara deprem simülasyonu ve altyapı hasar analizini 3D olarak inceleyin.`,
          url: shareUrl,
        });
      } catch {
        // User canceled
      }
    } else {
      handleCopyShareUrl();
    }
  };

  const handleDownloadHtml = () => {
    if (!postEarthquakeReport) return;
    const htmlContent = generateStandaloneHtmlReport(
      postEarthquakeReport,
      ANKARA_DISTRICTS,
      impactsById
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerBrowserDownload(
      `Ankara_Deprem_Hasar_Raporu_${dateStr}.html`,
      htmlContent,
      'text/html;charset=utf-8'
    );
    setDownloadSuccessMessage('Çevrimdışı HTML Raporu başarıyla indirildi!');
    setTimeout(() => setDownloadSuccessMessage(''), 4000);
  };

  const handleDownloadJson = () => {
    if (!postEarthquakeReport) return;
    const jsonContent = generateJsonExport(postEarthquakeReport, impactsById);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerBrowserDownload(
      `Ankara_Deprem_Veri_Seti_${dateStr}.json`,
      jsonContent,
      'application/json;charset=utf-8'
    );
    setDownloadSuccessMessage('JSON veri seti başarıyla indirildi!');
    setTimeout(() => setDownloadSuccessMessage(''), 4000);
  };

  const handleDownloadGeoJson = () => {
    const geoJsonContent = generateGeoJsonExport(ANKARA_DISTRICTS, impactsById);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerBrowserDownload(
      `Ankara_Deprem_CBS_Harita_${dateStr}.geojson`,
      geoJsonContent,
      'application/geo+json;charset=utf-8'
    );
    setDownloadSuccessMessage('CBS GeoJSON katmanı başarıyla indirildi!');
    setTimeout(() => setDownloadSuccessMessage(''), 4000);
  };

  // Sync initialPubChemCid when opened from District Inspector
  useEffect(() => {
    if (initialPubChemCid) {
      setSelectedCid(initialPubChemCid);
    }
  }, [initialPubChemCid]);

  // Fetch PubChem profile whenever selectedCid changes and modal is pubchem
  useEffect(() => {
    if (activeModal !== 'pubchem') return;
    let cancelled = false;
    setIsLoadingPubchem(true);
    setImgError(false);

    fetch(`/api/pubchem?cid=${selectedCid}`)
      .then((res) => res.json())
      .then((data: PubChemCompoundProfile) => {
        if (!cancelled) {
          setPubchemProfile(data);
          setIsLoadingPubchem(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoadingPubchem(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeModal, selectedCid]);

  if (activeModal === 'none') return null;

  const filteredDistricts = ANKARA_DISTRICTS.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.includes(searchQuery);
    const matchesCat = categoryFilter === 'ALL' || d.category === categoryFilter;
    return matchesSearch && matchesCat;
  }).sort((a, b) => {
    const impA = impactsById[a.id];
    const impB = impactsById[b.id];
    if (!impA || !impB) return 0;
    if (sortBy === 'pga') return impB.pgaG - impA.pgaG;
    if (sortBy === 'damage') return impB.compositeDamageScore - impA.compositeDamageScore;
    if (sortBy === 'pop') return b.population2026 - a.population2026;
    if (sortBy === 'asbestos') return b.aski.asbestosOrOldPipePercent - a.aski.asbestosOrOldPipePercent;
    return b.energy.gasSubscribers - a.energy.gasSubscribers;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        activeModal === 'results'
          ? 'Deprem Simülasyonu Sonuç ve Hasar Değerlendirme Raporu'
          : activeModal === 'matrix'
          ? 'Ankara 25 İlçe Sismik ve Altyapı Veri Matrisi'
          : activeModal === 'live_feed'
          ? '30 Dakikalık Canlı Veri Akışı ve Resmi Kurum Portalları'
          : activeModal === 'export_guide'
          ? 'İndirme, Kurulum ve Masaüstü Çalıştırma Merkezi'
          : activeModal === 'saved_scenarios'
          ? 'Senaryo Yönetim ve Kayıt Merkezi'
          : activeModal === 'share'
          ? 'Sismik Senaryoyu ve Brifing Raporunu Paylaş'
          : 'PubChem Kimyasal ve İkincil Afet Risk Analizi'
      }
      className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-black/75"
    >
      <div className="w-full max-w-[1160px] max-h-[88vh] flex flex-col bg-[#0F1624] border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131C2E]">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              {activeModal === 'results' &&
                'Deprem Simülasyonu Sonuç ve Altyapı Hasar Raporu (25 İlçe)'}
              {activeModal === 'matrix' &&
                '01. Ankara 25 İlçe Entegre Altyapı ve Sismik Etki Matrisi'}
              {activeModal === 'live_feed' &&
                '02. Canlı Veri Senkronizasyonu (30 Dk Periyotlu) ve Resmi Kurumlar Dizini'}
              {activeModal === 'pubchem' &&
                '03. Altyapı Kimyasal & İkincil Sismik Tehlike Analizi (PubChem PUG-REST)'}
              {activeModal === 'export_guide' &&
                '04. İndirme, Kurulum ve Masaüstü Çalıştırma Merkezi (.exe, Chrome, HTML)'}
              {activeModal === 'saved_scenarios' &&
                '05. Senaryo Yönetim Merkezi (Kayıtlı ve Tarihsel Afet Senaryoları)'}
              {activeModal === 'share' &&
                '06. Sismik Simülasyonu ve Brifing Raporunu Paylaş'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeModal === 'results' &&
                'Sismik dalga yayılımı tamamlandı · ASKİ, Başkentgaz, Başkent EDAŞ, MEB İSG ve EGM Trafik il geneli hasar bilançosu'}
              {activeModal === 'matrix' &&
                'ABB AYKOME, ASKİ, Başkentgaz, Başkent EDAŞ, EGM Trafik ve MEB İSG verileriyle sismik kırılganlık karşılaştırması'}
              {activeModal === 'live_feed' &&
                'Google Search Grounding (gemini-3.8-flash) ve 15 resmi kurum portalı üzerinden yarım saatte bir otomatik güncellenen saha raporu'}
              {activeModal === 'pubchem' &&
                'Deprem anında doğalgaz (CH4/C3H8), asbestli içme suyu boruları (SiO2), jeotermal hatlar (H2S) ve arıtma tesislerindeki kimyasal risk profilleri'}
              {activeModal === 'export_guide' &&
                'Tek tıkla çevrimdışı HTML raporu, CBS GeoJSON ve JSON veri seti indirin; Chrome PWA veya Masaüstü .EXE olarak bağımsız çalıştırın'}
              {activeModal === 'saved_scenarios' &&
                'Özelleştirilmiş fay, büyüklük, dalga hızı ve arazi kontrast senaryolarınızı kaydedin, yükleyin, dışa aktarın veya AFAD/tarihsel senaryoları simüle edin'}
              {activeModal === 'share' &&
                'Etkileşimli 3D simülasyon bağlantısı (URL), AFAD brifing metni veya doğrudan cihaz paylaşımı (WhatsApp, Telegram vb.)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Pencereyi Kapat"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL 1: 25 DISTRICT MATRIX */}
        {activeModal === 'matrix' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Global Province Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[11px] text-slate-400">TOPLAM NÜFUS (25 İLÇE)</div>
                <div className="text-lg font-mono font-bold tabular-nums text-white mt-0.5">
                  5.850.000
                </div>
                <div className="text-[11px] text-slate-400 font-mono">25.632 km² Yüzölçümü</div>
              </div>
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[11px] text-slate-400">ASKİ BARAJ HACMİ</div>
                <div className="text-lg font-mono font-bold tabular-nums text-sky-400 mt-0.5">
                  1,45 Milyar m³
                </div>
                <div className="text-[11px] text-slate-400 font-mono">Aktif Doluluk Takipte</div>
              </div>
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[11px] text-slate-400">BAŞKENTGAZ ABONE</div>
                <div className="text-lg font-mono font-bold tabular-nums text-amber-400 mt-0.5">
                  2.180.000+
                </div>
                <div className="text-[11px] text-slate-400 font-mono">25 İlçede Aktif Şebeke</div>
              </div>
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[11px] text-slate-400">ORTALAMA FİBER KAPSAMA</div>
                <div className="text-lg font-mono font-bold tabular-nums text-cyan-400 mt-0.5">
                  %64,9
                </div>
                <div className="text-[11px] text-slate-400 font-mono">Metropolde %85-94</div>
              </div>
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[11px] text-slate-400">KAZA KARA NOKTASI</div>
                <div className="text-lg font-mono font-bold tabular-nums text-rose-400 mt-0.5">
                  48 Kritik Nokta
                </div>
                <div className="text-[11px] text-slate-400 font-mono">EGM Trafik / KGM</div>
              </div>
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[11px] text-slate-400">MEB EĞİTİM KURUMU</div>
                <div className="text-lg font-mono font-bold tabular-nums text-emerald-400 mt-0.5">
                  1.950+ Okul
                </div>
                <div className="text-[11px] text-slate-400 font-mono">Yılda 2 Tahliye Tatbikatı</div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="İlçe adı veya kodu ara (örn: Çankaya, Polatlı, 07)..."
                  aria-label="İlçe Ara"
                  className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'Metropol Çekirdek', 'Büyüme/Sanayi', 'Kuzey/Doğu Çevre', 'Kırsal/Dış İlçe'].map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                        categoryFilter === cat
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'bg-[#0B0E17] text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {cat === 'ALL' ? 'Tüm İlçeler (25)' : cat}
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  aria-label="Sıralama Ölçütü"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-[#0B0E17] text-xs text-slate-200 border border-slate-800 rounded px-2.5 py-1 focus:outline-none"
                >
                  <option value="pga">Sırala: Yer İvmesi (PGA)</option>
                  <option value="damage">Sırala: Bileşik Hasar Skoru</option>
                  <option value="pop">Sırala: Nüfus (2026)</option>
                  <option value="asbestos">Sırala: ASKİ Asbest/Eski Boru %</option>
                  <option value="gas">Sırala: Başkentgaz Abone Sayısı</option>
                </select>
              </div>
            </div>

            {/* 25 District Data Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#131C2E] text-slate-300 border-b border-slate-800 font-semibold">
                    <th className="py-2.5 px-3">Kod & İlçe</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-right">Nüfus</th>
                    <th className="py-2.5 px-3 text-right">PGA (g) / MMI</th>
                    <th className="py-2.5 px-3 text-right">ASKİ Eski/Asbest</th>
                    <th className="py-2.5 px-3 text-right">Başkentgaz Abone</th>
                    <th className="py-2.5 px-3 text-right">EDAŞ Yeraltı %</th>
                    <th className="py-2.5 px-3 text-right">Fiber %</th>
                    <th className="py-2.5 px-3 text-right">Hasar Skoru</th>
                    <th className="py-2.5 px-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                  {filteredDistricts.map((d) => {
                    const imp = impactsById[d.id];
                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-slate-800/50 transition-colors text-slate-200"
                      >
                        <td className="py-2.5 px-3 font-sans font-semibold text-white whitespace-nowrap">
                          <span className="font-mono text-cyan-400 mr-1.5">[{d.code}]</span>
                          {d.name}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-400 whitespace-nowrap">
                          {d.category}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {d.population2026.toLocaleString('tr-TR')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-cyan-300">
                          {imp ? `${imp.pgaG.toFixed(3)}g (${imp.mmiRoman})` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-300">
                          %{d.aski.asbestosOrOldPipePercent} (Kayıp %{d.aski.lossLeakagePercent})
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-300">
                          {d.energy.gasSubscribers.toLocaleString('tr-TR')}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          %{d.energy.undergroundCablePercent}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-300">
                          %{d.fiber.coveragePercent}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          <span
                            className={
                              (imp?.compositeDamageScore || 0) >= 65
                                ? 'text-rose-400'
                                : (imp?.compositeDamageScore || 0) >= 38
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {imp?.compositeDamageScore || 0}/100
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectDistrictFromMatrix(d.id);
                              onClose();
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 rounded transition-colors whitespace-nowrap"
                          >
                            3B Odakla
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 2: 30-MINUTE LIVE FEED & 15 OFFICIAL PORTALS */}
        {activeModal === 'live_feed' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Auto-Refresh & Search Grounding Box */}
            <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-semibold text-cyan-400">
                    OTOMATİK VERİ ÇEKME PERİYODU: 30 DAKİKA (1800 SANİYE)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                    Son Senkronizasyon:{' '}
                    {liveFeed?.lastUpdatedIso
                      ? new Date(liveFeed.lastUpdatedIso).toLocaleTimeString('tr-TR')
                      : 'Yükleniyor...'}{' '}
                    · Sonraki Otomatik Güncelleme Kalan Süre:{' '}
                    <strong className="text-amber-400">{countdownFormatted}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRefreshingFeed}
                  onClick={() => onForceRefreshFeed('Ankara Geneli')}
                  className="px-4 py-2 text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingFeed ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingFeed ? 'Kaynaklar Taranıyor...' : 'Şimdi Güncelle (Canlı Veri Çek)'}</span>
                </button>
              </div>

              {/* Search Grounded Summary */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>
                    Canlı Sismik ve Altyapı Durum Sentezi (Google Search Grounding · gemini-3.8-flash)
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-[#0B0E17] p-3.5 rounded-lg border border-slate-800">
                  {liveFeed?.summaryText ||
                    'Ankara 25 ilçe sismik ve altyapı verileri AFAD, ASKİ, Başkent EDAŞ ve AYKOME kaynaklarından senkronize edilmektedir...'}
                </p>

                {/* Grounding Web Citations */}
                {liveFeed?.groundingSources && liveFeed.groundingSources.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[11px] text-slate-400 mb-1.5">
                      Doğrulanan Web Kaynakları ve Resmi Veri Uçları:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {liveFeed.groundingSources.map((src, i) => (
                        <a
                          key={`${src.uri}-${i}`}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#0B0E17] hover:bg-slate-800 text-cyan-300 border border-slate-800 rounded transition-colors"
                        >
                          <span className="truncate max-w-[260px]">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 15 Official Institutions from Bölüm 3 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">
                Bölüm 3: Resmi Kurumlar, Çağrı Merkezleri ve Çevrimiçi Portallar Dizini (15 Kurum)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(liveFeed?.portalFeeds || []).map((item) => (
                  <div
                    key={item.institutionId}
                    className="p-3.5 bg-[#111827] border border-slate-800 rounded-lg flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-white">
                          {item.institutionName}
                        </h4>
                        <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                          [{item.status}]
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {item.category}
                      </div>
                      <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                        {item.latestNotice}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono text-amber-300 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {item.contact}
                      </span>
                      <a
                        href={item.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        <span>Resmi Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: PUBCHEM SECONDARY SEISMIC CHEMICAL HAZARDS WORKBENCH */}
        {activeModal === 'pubchem' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Top Quick-Try Example Selector Bar (Science Skill Requirement) */}
            <div className="bg-[#111827] p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 font-medium">
                Hızlı Molekül & Altyapı Tehlike Seçimi (PubChem CID Sorgusu):
              </div>
              <div className="flex flex-wrap gap-2">
                {HAZMAT_COMPOUNDS.map((comp) => (
                  <button
                    key={comp.cid}
                    type="button"
                    onClick={() => setSelectedCid(comp.cid)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      selectedCid === comp.cid
                        ? 'bg-cyan-500 text-slate-950 font-semibold'
                        : 'bg-[#0B0E17] text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>{comp.nameTr}</span>
                    <span className="font-mono opacity-75">({comp.formulaFallback})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Split Interactive Structure + Synchronized Telemetry Inspector */}
            {isLoadingPubchem || !pubchemProfile ? (
              <div className="p-12 text-center text-sm text-slate-400 font-mono">
                PubChem PUG-REST veritabanından moleküler yapı ve tehlike verileri çekiliyor (CID: {selectedCid})...
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Left 5 Columns: 2D Chemical Structure Card */}
                <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-mono text-cyan-400">
                        PubChem CID: {pubchemProfile.cid}
                      </span>
                      <span className="text-xs font-mono text-emerald-400">
                        {pubchemProfile.provenanceBadge}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {pubchemProfile.nameTr}
                    </h3>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      IUPAC: {pubchemProfile.iupacName}
                    </p>
                  </div>

                  {/* 2D Chemical Depiction with Resilient Fallback */}
                  <div className="my-4 bg-white rounded-lg p-4 flex items-center justify-center min-h-[220px] border border-slate-700">
                    {!imgError ? (
                      <img
                        src={pubchemProfile.image2dUrl}
                        alt={`${pubchemProfile.nameTr} 2B Kimyasal Yapısı`}
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                        className="max-h-[190px] w-auto object-contain"
                      />
                    ) : (
                      <div className="text-center text-slate-800 p-4 space-y-2">
                        <FlaskConical className="w-10 h-10 mx-auto text-cyan-700" />
                        <div className="font-mono text-lg font-bold">
                          {pubchemProfile.molecularFormula}
                        </div>
                        <div className="font-mono text-xs text-slate-600">
                          SMILES: {pubchemProfile.canonicalSmiles}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <span className="text-rose-400 font-semibold">
                      GHS Sinyal: {pubchemProfile.ghsSignal}
                    </span>
                    <a
                      href={pubchemProfile.pubchemRecordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <span>PubChem Kaydını Aç</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Right 7 Columns: Physicochemical & Ankara Infrastructure Risk Correlation */}
                <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white">
                      Fizikokimyasal Parametreler ve Ankara Altyapı Korelasyonu
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono tabular-nums">
                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <span className="block text-[10px] text-slate-400">MOLEKÜLER FORMÜL</span>
                        <span className="text-base font-bold text-cyan-300">
                          {pubchemProfile.molecularFormula}
                        </span>
                      </div>
                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <span className="block text-[10px] text-slate-400">MOLEKÜL AĞIRLIĞI</span>
                        <span className="text-base font-bold text-white">
                          {pubchemProfile.molecularWeight}
                        </span>
                      </div>
                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <span className="block text-[10px] text-slate-400">TOPOLOJİK KUTUPSAL ALAN</span>
                        <span className="text-base font-bold text-amber-300">
                          {pubchemProfile.tpsa} Å²
                        </span>
                      </div>
                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <span className="block text-[10px] text-slate-400">AĞIR ATOM SAYISI</span>
                        <span className="text-sm font-semibold text-slate-200">
                          {pubchemProfile.heavyAtomCount}
                        </span>
                      </div>
                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <span className="block text-[10px] text-slate-400">KOMPLEKSİTE</span>
                        <span className="text-sm font-semibold text-slate-200">
                          {pubchemProfile.complexity}
                        </span>
                      </div>
                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <span className="block text-[10px] text-slate-400">NET YÜK</span>
                        <span className="text-sm font-semibold text-slate-200">
                          {pubchemProfile.charge}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg font-mono text-xs space-y-1">
                      <div>
                        <span className="text-slate-400">Canonical SMILES: </span>
                        <span className="text-cyan-300 break-all">{pubchemProfile.canonicalSmiles}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">InChIKey: </span>
                        <span className="text-slate-200 break-all">{pubchemProfile.inchiKey}</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs leading-relaxed">
                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <div className="font-semibold text-amber-400 mb-1">
                          Ankara Altyapı Kaynağı:
                        </div>
                        <p className="text-slate-300">{pubchemProfile.infrastructureSource}</p>
                      </div>

                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <div className="font-semibold text-rose-400 mb-1">
                          Sismik İkincil Tehlike Mekanizması:
                        </div>
                        <p className="text-slate-300">{pubchemProfile.seismicHazardMechanism}</p>
                      </div>

                      <div className="p-3 bg-[#0B0E17] border border-slate-800 rounded-lg">
                        <div className="font-semibold text-cyan-400 mb-1">
                          Birincil Risk Altındaki Ankara İlçeleri:
                        </div>
                        <p className="text-slate-300">{pubchemProfile.affectedDistrictsSummary}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL 4: POST-EARTHQUAKE SIMULATION RESULTS REPORT */}
        {activeModal === 'results' && postEarthquakeReport && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Top Scenario Completion Banner */}
            <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded border ${
                      postEarthquakeReport.overallStatus === 'KRİTİK AFET DURUMU'
                        ? 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                        : postEarthquakeReport.overallStatus === 'YÜKSEK UYARI'
                        ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                        : 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                    }`}
                  >
                    [{postEarthquakeReport.overallStatus}]
                  </span>
                  <span className="text-sm font-bold text-white">
                    {postEarthquakeReport.faultName}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Büyüklük: <strong className="text-rose-400">Mw {postEarthquakeReport.magnitudeMw.toFixed(1)}</strong> ·
                  Odak Derinliği: <strong className="text-cyan-400">{postEarthquakeReport.depthKm} km</strong> ·
                  Fay Tipi: {postEarthquakeReport.faultType} ·
                  Sismik Yayılım Süresi: {postEarthquakeReport.durationSec} sn
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onSwitchModal && (
                  <button
                    type="button"
                    onClick={() => onSwitchModal('matrix')}
                    className="px-3.5 py-2 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Tüm 25 İlçe Tablosu
                  </button>
                )}
                {onSwitchModal && (
                  <button
                    type="button"
                    onClick={() => onSwitchModal('pubchem')}
                    className="px-3.5 py-2 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Kimyasal Risk Analizi (PubChem)
                  </button>
                )}
                {onReplaySimulation && (
                  <button
                    type="button"
                    onClick={onReplaySimulation}
                    className="px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition-colors cursor-pointer"
                  >
                    Simülasyonu Tekrar Başlat
                  </button>
                )}
              </div>
            </div>

            {/* One-Click Direct Download Strip & Notification */}
            <div className="p-3.5 bg-[#111827] border border-emerald-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Tek Tıkla Raporu & Veriyi İndir</span>
                    {downloadSuccessMessage && (
                      <span className="text-[11px] font-mono font-medium text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/40">
                        {downloadSuccessMessage}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    İnternetsiz çalışan çevrimdışı HTML raporu, CBS harita katmanı (.geojson) veya makinece okunabilir JSON veri seti.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>HTML Raporu İndir (.html)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>JSON İndir</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadGeoJson}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CBS GeoJSON</span>
                </button>
                {onSwitchModal && (
                  <>
                    <button
                      type="button"
                      onClick={() => onSwitchModal('share')}
                      className="px-3 py-1.5 text-xs font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Senaryoyu Paylaş</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchModal('saved_scenarios')}
                      className="px-3 py-1.5 text-xs font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-purple-400" />
                      <span>Senaryoyu Kaydet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchModal('export_guide')}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Çalıştırma Rehberi (.exe / Chrome)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 6 Province-Wide Post-Earthquake Damage KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400">MAKSİMUM YER İVMESİ</div>
                <div className="text-lg font-mono font-bold tabular-nums text-rose-400 mt-0.5">
                  {postEarthquakeReport.maxPgaG.toFixed(3)}g
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  MMI {postEarthquakeReport.maxMmiRoman} · {postEarthquakeReport.epicenterDistrictName}
                </div>
              </div>

              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400">KRİTİK / UYARI İLÇE</div>
                <div className="text-lg font-mono font-bold tabular-nums text-amber-400 mt-0.5">
                  {postEarthquakeReport.warningDistrictCount} / 25 İlçe
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {postEarthquakeReport.criticalDistrictCount} Kritik Seviye
                </div>
              </div>

              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400">ASKİ BORU KIRIĞI</div>
                <div className="text-lg font-mono font-bold tabular-nums text-sky-400 mt-0.5">
                  ~{postEarthquakeReport.totalEstimatedPipeBreaks} Nokta
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Asbest / Eski Şebeke
                </div>
              </div>

              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400">BAŞKENTGAZ KESİNTİ</div>
                <div className="text-lg font-mono font-bold tabular-nums text-yellow-400 mt-0.5">
                  {postEarthquakeReport.totalGasShutoffSubscribers.toLocaleString('tr-TR')}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Otomatik RMS Vana (Abone)
                </div>
              </div>

              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400">BAŞKENT EDAŞ KESİNTİ</div>
                <div className="text-lg font-mono font-bold tabular-nums text-orange-400 mt-0.5">
                  {postEarthquakeReport.totalEdasOutageHouseholds.toLocaleString('tr-TR')}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Etkilenen Hane (Alo 186)
                </div>
              </div>

              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400">MEB ACİL DENETİM</div>
                <div className="text-lg font-mono font-bold tabular-nums text-emerald-400 mt-0.5">
                  {postEarthquakeReport.totalSchoolsRequiringInspection} Okul
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {postEarthquakeReport.highRiskTrafficCorridorCount} Kritik Kavşak
                </div>
              </div>
            </div>

            {/* Top 8 Hardest-Hit Districts Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">
                Depremden En Çok Etkilenen İlk 8 İlçe Sıralaması
              </h3>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#131C2E] text-slate-300 border-b border-slate-800 font-semibold">
                      <th className="py-2.5 px-3">Sıra & İlçe</th>
                      <th className="py-2.5 px-3 text-right">Merkez Uzaklık</th>
                      <th className="py-2.5 px-3 text-right">Yer İvmesi (PGA)</th>
                      <th className="py-2.5 px-3 text-right">Şiddet (MMI)</th>
                      <th className="py-2.5 px-3 text-right">ASKİ Boru Kırığı</th>
                      <th className="py-2.5 px-3 text-right">Başkentgaz Kesme</th>
                      <th className="py-2.5 px-3 text-right">EDAŞ Kesinti Hane</th>
                      <th className="py-2.5 px-3 text-right">Hasar Skoru</th>
                      <th className="py-2.5 px-3 text-right">3B Sahne</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                    {postEarthquakeReport.topImpactedDistricts.map((imp, idx) => (
                      <tr
                        key={imp.districtId}
                        className="hover:bg-slate-800/50 transition-colors text-slate-200"
                      >
                        <td className="py-2.5 px-3 font-sans font-semibold text-white whitespace-nowrap">
                          <span className="font-mono text-cyan-400 mr-1.5">#{idx + 1}</span>
                          {imp.districtName}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">
                          {imp.epicentralDistanceKm} km (x{imp.soilAmplificationFactor})
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-300">
                          {imp.pgaG.toFixed(3)}g
                        </td>
                        <td className="py-2.5 px-3 text-right text-cyan-300">
                          MMI {imp.mmiRoman}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sky-300">
                          ~{imp.estimatedAsbestosPipeBreaks} Nokta (%{imp.askiPipeBreakProbabilityPercent})
                        </td>
                        <td className="py-2.5 px-3 text-right text-yellow-300">
                          %{imp.baskentgazShutoffPercent}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-300">
                          {imp.edasOutageHouseholds.toLocaleString('tr-TR')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          <span
                            className={
                              imp.compositeDamageScore >= 65
                                ? 'text-rose-400'
                                : imp.compositeDamageScore >= 38
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {imp.compositeDamageScore}/100
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectDistrictFromMatrix(imp.districtId);
                              onClose();
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 rounded transition-colors whitespace-nowrap cursor-pointer"
                          >
                            3B İncele
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Emergency Response Directives across Ankara Agencies */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">
                Kurumsal Acil Müdahale ve Altyapı Eylem Direktifleri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {postEarthquakeReport.actionDirectives.map((item) => (
                  <div
                    key={item.agency}
                    className="p-3.5 bg-[#111827] border border-slate-800 rounded-lg space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400">{item.agency}</span>
                      <span className="text-[11px] font-mono text-amber-400">
                        Acil Hat: {item.hotline}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.directive}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 5: EXPORT & RUNNING GUIDE (.EXE, CHROME, OFFLINE HTML) */}
        {activeModal === 'export_guide' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Download Strip */}
            <div className="p-4 bg-[#111827] border border-emerald-500/30 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Doğrudan İndirme Seçenekleri (Çevrimdışı ve Veri Formatları)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    İnternet bağlantısı olmaksızın veya CBS yazılımlarında kullanmak üzere dosyayı hemen indirin.
                  </p>
                </div>
                {downloadSuccessMessage && (
                  <span className="text-xs font-mono font-medium text-emerald-300 bg-emerald-950/90 px-3 py-1 rounded border border-emerald-500/40">
                    {downloadSuccessMessage}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* 1. Standalone HTML */}
                <div className="p-3.5 bg-[#0B0E17] border border-slate-800 rounded-lg flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <FileText className="w-4 h-4" />
                      <span>Bağımsız HTML Raporu (.html)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Tek bir dosya. Çift tıklayarak Chrome, Edge veya Firefox ile internetsiz açılır. 25 ilçe verisi ve acil durum direktiflerini içerir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadHtml}
                    className="w-full py-2 px-3 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>HTML Olarak İndir</span>
                  </button>
                </div>

                {/* 2. JSON Dataset */}
                <div className="p-3.5 bg-[#0B0E17] border border-slate-800 rounded-lg flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                      <FileCode className="w-4 h-4" />
                      <span>Sayısal Veri Seti (.json)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Tüm ilçelerin PGA, boru kırığı, doğalgaz kesintisi, EDAŞ arıza ve PubChem ikincil tehlike verilerini içeren ham JSON.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="w-full py-2 px-3 text-xs font-semibold bg-[#131C2E] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>JSON Olarak İndir</span>
                  </button>
                </div>

                {/* 3. GeoJSON */}
                <div className="p-3.5 bg-[#0B0E17] border border-slate-800 rounded-lg flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                      <Layers className="w-4 h-4" />
                      <span>CBS Harita Katmanı (.geojson)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      QGIS, ArcGIS veya Google Earth ile açılabilen 25 ilçe coğrafi koordinatları ve sismik öznitelik tablosu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadGeoJson}
                    className="w-full py-2 px-3 text-xs font-semibold bg-[#131C2E] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>GeoJSON Olarak İndir</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Run & Install Methods Guide */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-cyan-400" />
                <span>Uygulamayı Çalıştırma ve Kurma Rehberi: Hangi Formatı Seçmelisiniz?</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Method 1: Chrome / Edge PWA */}
                <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-400 text-sm">
                      1. Google Chrome & Edge: Masaüstü Uygulaması (En Kolay & Önerilen)
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">
                      ÖNERİLEN
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Bu simülasyon bir <strong>Progressive Web App (PWA)</strong> olarak tasarlanmıştır. Hiçbir harici dosya kurmadan, doğrudan tarayıcınızdan masaüstü programı haline getirebilirsiniz:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 font-mono text-[11px] bg-[#0B0E17] p-3 rounded-lg border border-slate-800">
                    <li>Chrome veya Edge adres çubuğunun sağ tarafındaki <strong>&quot;Uygulamayı Yükle&quot;</strong> simgesine tıklayın (veya menüden <em>&quot;Kaydet ve Paylaş &gt; Uygulama Olarak Yükle&quot;</em>).</li>
                    <li>Çıkan pencerede <strong>&quot;Yükle&quot;</strong> butonuna basın.</li>
                    <li>Masaüstünüze ve Windows Başlat menünüze <strong>ANKA-SİSMİK 3D</strong> kısayolu eklenecektir.</li>
                    <li>Tıpkı bir <strong>.exe</strong> gibi tarayıcı sekmeleri olmadan bağımsız bir pencerede açılır ve çalışır!</li>
                  </ol>
                </div>

                {/* Method 2: Offline Single File HTML */}
                <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 text-sm">
                      2. Çevrimdışı Tek Dosya (.html)
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                      SIFIR KURULUM
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    İnternetin olmadığı acil durum merkezlerinde, kriz masalarında veya saha çalışmalarında kullanılmak üzere hazırlanmıştır:
                  </p>
                  <div className="space-y-1.5 text-slate-300 font-mono text-[11px] bg-[#0B0E17] p-3 rounded-lg border border-slate-800">
                    <div>• Yukarıdaki <strong>&quot;HTML Olarak İndir&quot;</strong> butonuna basın.</div>
                    <div>• İnen <code>.html</code> dosyasını USB belleğe atabilir veya e-posta ile iletebilirsiniz.</div>
                    <div>• Dosyaya çift tıkladığınız anda Chrome, Edge veya Firefox içerisinde tüm rapor, hasar tablosu ve kurum direktifleri açılır.</div>
                    <div>• Yazdırma (Ctrl+P) desteği ile tek tuşla resmi PDF raporuna dönüştürülebilir.</div>
                  </div>
                </div>

                {/* Method 3: Local Node.js Production Build */}
                <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-amber-400" />
                      <span>3. Yerel Sunucu / Kod Olarak Derleme (Node.js)</span>
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Projeyi kendi bilgisayarınızda veya kurum içi kapalı ağ (intranet) sunucunuzda çalıştırmak için:
                  </p>
                  <pre className="bg-[#0B0E17] p-3 rounded-lg border border-slate-800 text-[11px] text-cyan-300 font-mono overflow-x-auto">
{`# Bağımlılıkları yükleyin
npm install

# Üretim sürümünü derleyin (Next.js Optimize Build)
npm run build

# Yerel sunucuyu başlatın (Port 3000)
npm run start`}
                  </pre>
                  <p className="text-[11px] text-slate-400">
                    Ardından tarayıcınızda <code>http://localhost:3000</code> adresine giderek tam sürümü çalıştırabilirsiniz.
                  </p>
                </div>

                {/* Method 4: Windows .EXE Standalone Package */}
                <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-400 text-sm flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-rose-400" />
                      <span>4. Windows İçin Tek Başına .EXE Dosyası Üretme (Electron)</span>
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Eğer mutlaka Windows kullanıcılarına kurulumsuz tek bir <strong>.exe</strong> dosyası dağıtmak isterseniz:
                  </p>
                  <pre className="bg-[#0B0E17] p-3 rounded-lg border border-slate-800 text-[11px] text-cyan-300 font-mono overflow-x-auto">
{`# Electron paketleyicisini ekleyin
npm install --save-dev electron electron-builder

# Windows .exe kurulum dosyasını derleyin
npx electron-builder --win portable`}
                  </pre>
                  <p className="text-[11px] text-slate-400">
                    Derleme tamamlandığında <code>dist/</code> dizininde bağımsız çalışan <code>ANKA-Sismik-3D.exe</code> dosyası oluşacaktır.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 6: SCENARIO MANAGEMENT & SAVED SCENARIOS */}
        {activeModal === 'saved_scenarios' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Quick Save Card */}
            {currentScenario && (
              <div className="p-4 bg-[#111827] border border-purple-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookmarkPlus className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">
                      Mevcut Simülasyon Senaryosunu Kaydet
                    </h3>
                  </div>
                  {saveSuccessMsg && (
                    <span className="text-xs font-mono font-medium text-emerald-300 bg-emerald-950/90 px-3 py-1 rounded border border-emerald-500/40">
                      {saveSuccessMsg}
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveCurrentScenario} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="new-scenario-name" className="block text-[11px] text-slate-400 font-medium mb-1">
                        Senaryo Başlığı
                      </label>
                      <input
                        id="new-scenario-name"
                        type="text"
                        value={newScenarioName}
                        onChange={(e) => setNewScenarioName(e.target.value)}
                        placeholder="Örn: KAF Kuzey Segmenti Mw 7.2 Kritik Senaryo"
                        className="w-full bg-[#0B0E17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-medium"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-scenario-desc" className="block text-[11px] text-slate-400 font-medium mb-1">
                        Açıklama / Afet Notu (İsteğe Bağlı)
                      </label>
                      <input
                        id="new-scenario-desc"
                        type="text"
                        value={newScenarioDesc}
                        onChange={(e) => setNewScenarioDesc(e.target.value)}
                        placeholder="Örn: Çamlıdere su toplama havzası ve İvedik isale hattı risk değerlendirmesi"
                        className="w-full bg-[#0B0E17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>

                  {/* Current Parameter Chips */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="px-2 py-0.5 bg-[#0B0E17] border border-slate-800 rounded font-mono text-cyan-300">
                        {activeFaultObj.shortName}
                      </span>
                      <span className="px-2 py-0.5 bg-[#0B0E17] border border-slate-800 rounded font-mono text-rose-300 font-bold">
                        Mw {currentScenario.magnitudeMw.toFixed(1)} · {currentScenario.depthKm} km
                      </span>
                      <span className="px-2 py-0.5 bg-[#0B0E17] border border-slate-800 rounded font-mono text-amber-300">
                        {currentScenario.wavefrontSpeed.toFixed(1)}x Hız
                      </span>
                      <span className="px-2 py-0.5 bg-[#0B0E17] border border-slate-800 rounded font-mono text-emerald-300">
                        Arazi: {TERRAIN_CONTRAST_OPTIONS.find((c) => c.id === currentScenario.terrainContrast)?.label || currentScenario.terrainContrast}
                      </span>
                      <span className="px-2 py-0.5 bg-[#0B0E17] border border-slate-800 rounded font-mono text-slate-300">
                        PGA Isı Haritası: {currentScenario.showHeatmapOverlay ? 'Açık' : 'Kapalı'}
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Senaryoyu Kaydet</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Filter Tabs & JSON Import/Export Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1 bg-[#0B0E17] p-1 border border-slate-800 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setScenarioFilter('all')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                    scenarioFilter === 'all'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tüm Senaryolar ({allScenariosList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScenarioFilter('custom')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                    scenarioFilter === 'custom'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Kaydettiklerim ({allScenariosList.filter((s) => !s.isPreset).length})
                </button>
                <button
                  type="button"
                  onClick={() => setScenarioFilter('preset')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                    scenarioFilter === 'preset'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  AFAD / Tarihsel Şablonlar ({allScenariosList.filter((s) => s.isPreset).length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportScenarios}
                  className="px-3 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>JSON Dışa Aktar</span>
                </button>
                <label className="px-3 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer">
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>JSON İçe Aktar</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportScenariosFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Scenarios Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allScenariosList
                .filter((scen) => {
                  if (scenarioFilter === 'custom') return !scen.isPreset;
                  if (scenarioFilter === 'preset') return scen.isPreset;
                  return true;
                })
                .map((scen) => {
                  const faultObj =
                    FAULT_SCENARIOS.find((f) => f.id === scen.faultId) || FAULT_SCENARIOS[0];
                  const contrastObj = TERRAIN_CONTRAST_OPTIONS.find(
                    (c) => c.id === scen.terrainContrast
                  );

                  return (
                    <div
                      key={scen.id}
                      className="p-4 bg-[#111827] border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col justify-between gap-4 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white tracking-tight">
                                {scen.name}
                              </h4>
                              {scen.isPreset ? (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded">
                                  AFAD Şablonu
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded">
                                  Kayıtlı Senaryom
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {faultObj.name}
                            </div>
                          </div>

                          {!scen.isPreset && (
                            <button
                              type="button"
                              onClick={() => handleDeleteScenario(scen.id)}
                              title="Senaryoyu Sil"
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {scen.description && (
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {scen.description}
                          </p>
                        )}

                        {/* Parameter Grid */}
                        <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px] tabular-nums">
                          <div className="p-2 bg-[#0B0E17] border border-slate-800 rounded">
                            <span className="block text-[9px] text-slate-500 uppercase">Büyüklük</span>
                            <span className="font-bold text-rose-400">Mw {scen.magnitudeMw.toFixed(1)}</span>
                          </div>
                          <div className="p-2 bg-[#0B0E17] border border-slate-800 rounded">
                            <span className="block text-[9px] text-slate-500 uppercase">Derinlik</span>
                            <span className="font-bold text-white">{scen.depthKm} km</span>
                          </div>
                          <div className="p-2 bg-[#0B0E17] border border-slate-800 rounded">
                            <span className="block text-[9px] text-slate-500 uppercase">Dalga Hızı</span>
                            <span className="font-bold text-cyan-300">{scen.wavefrontSpeed.toFixed(1)}x</span>
                          </div>
                          <div className="p-2 bg-[#0B0E17] border border-slate-800 rounded">
                            <span className="block text-[9px] text-slate-500 uppercase">Arazi</span>
                            <span className="font-bold text-amber-300 truncate block">
                              {contrastObj?.shortLabel || scen.terrainContrast}
                            </span>
                          </div>
                        </div>

                        {/* KPI Snapshot if available */}
                        {scen.metricsSnapshot && (
                          <div className="p-2.5 bg-[#0B0E17] border border-slate-800/80 rounded-lg flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">
                              En Riskli İlçe:{' '}
                              <strong className="text-rose-300 font-semibold">
                                {scen.metricsSnapshot.highestRiskDistrict}
                              </strong>{' '}
                              ({scen.metricsSnapshot.maxPgaG.toFixed(2)}g)
                            </span>
                            <span className="text-slate-400 font-mono">
                              Yıkık/Ağır:{' '}
                              <strong className="text-amber-300">
                                ~{scen.metricsSnapshot.totalSeverelyDamagedBuildings} bina
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        {onLoadScenario && (
                          <button
                            type="button"
                            onClick={() => {
                              onLoadScenario(scen);
                              onClose();
                            }}
                            className="flex-1 py-1.5 px-3 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Simülasyona Yükle & Çalıştır</span>
                          </button>
                        )}
                        {onSwitchModal && (
                          <button
                            type="button"
                            onClick={() => {
                              if (onLoadScenario) onLoadScenario(scen);
                              onSwitchModal('share');
                            }}
                            className="py-1.5 px-3 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Paylaş</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* MODAL 7: SHARE SIMULATION & BRIEFING REPORT */}
        {activeModal === 'share' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Active Scenario Card Preview */}
            <div className="p-4 bg-[#111827] border border-cyan-500/30 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  <span>Paylaşılacak Sismik Senaryo Parametreleri</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date().toLocaleDateString('tr-TR')} · ANKA-SİSMİK 3D
                </span>
              </div>
              <div className="text-base font-bold text-white tracking-tight">
                {activeFaultObj.name}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 bg-[#0B0E17] border border-slate-800 rounded text-rose-400 font-bold">
                  Büyüklük: Mw {currentScenario?.magnitudeMw.toFixed(1) || 7.2}
                </span>
                <span className="px-2.5 py-1 bg-[#0B0E17] border border-slate-800 rounded text-white">
                  Odak: {currentScenario?.depthKm || 12} km
                </span>
                <span className="px-2.5 py-1 bg-[#0B0E17] border border-slate-800 rounded text-cyan-300">
                  Dalga Hızı: {currentScenario?.wavefrontSpeed.toFixed(1) || 1.0}x
                </span>
                <span className="px-2.5 py-1 bg-[#0B0E17] border border-slate-800 rounded text-amber-300">
                  Arazi: {TERRAIN_CONTRAST_OPTIONS.find((c) => c.id === currentScenario?.terrainContrast)?.label || 'Yüksek Kontrast'}
                </span>
              </div>
            </div>

            {/* Section 1: Live Simulation Share URL */}
            <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>1. Canlı 3D Simülasyon Bağlantısı (URL)</span>
                </h3>
                {copyFeedback === 'url' && (
                  <span className="text-xs font-mono font-medium text-emerald-300 bg-emerald-950/90 px-3 py-1 rounded border border-emerald-500/40 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Bağlantı Panoya Kopyalandı!</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bu bağlantıyı tarayıcısında açan herkes doğrudan seçtiğiniz fay hattı, deprem büyüklüğü, dalga yayılım hızı ve arazi kontrast ayarlarıyla 3D simülasyona başlar.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-[#0B0E17] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className="px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                >
                  {copyFeedback === 'url' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Bağlantıyı Kopyala</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Section 2: Direct Share & Messaging Buttons */}
            <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>2. Doğrudan Paylaşım Kanalları</span>
              </h3>
              <p className="text-xs text-slate-400">
                Simülasyon bağlantısını veya kriz brifing metnini afet koordinasyon ekibinizle anında paylaşın.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Cihaz ile Paylaş (WhatsApp, Telegram vb.)</span>
                </button>

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(briefingText)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('ANKA-SİSMİK 3D: Ankara Deprem Simülasyonu ve Altyapı Hasar Analizi')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-sky-400 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Telegram</span>
                </a>

                <a
                  href={`mailto:?subject=${encodeURIComponent('ANKA-SİSMİK 3D Deprem Simülasyonu Brifingi')}&body=${encodeURIComponent(briefingText)}`}
                  className="px-3 py-2 text-xs font-semibold bg-[#0B0E17] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>E-posta</span>
                </a>
              </div>
            </div>

            {/* Section 3: AFAD / Disaster Management Briefing Report Text */}
            <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>3. AFAD & Acil Durum Brifing Metni</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCopyBriefing}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copyFeedback === 'briefing' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Metin Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Brifing Metnini Kopyala</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Acil durum mesajlaşma gruplarına, e-postalara veya resmi tutanaklara doğrudan yapıştırmaya uygun biçimlendirilmiş özet metin:
              </p>
              <pre className="bg-[#0B0E17] p-4 rounded-lg border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto select-all">
                {briefingText}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
