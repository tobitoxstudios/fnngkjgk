'use client';

import React from 'react';
import {
  Droplets,
  Flame,
  FlaskConical,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react';
import {
  ANKARA_DISTRICTS,
  HAZMAT_COMPOUNDS,
  type DistrictData,
} from '@/lib/ankara-data';
import {
  computeInstantaneousGroundMotion,
  type DistrictSeismicImpact,
} from '@/lib/seismic-engine';

interface DistrictInspectorDrawerProps {
  district: DistrictData;
  impact: DistrictSeismicImpact;
  isOpen: boolean;
  onClose: () => void;
  onSelectDistrict: (id: string) => void;
  onOpenPubChem: (cid: number) => void;
  isSimulating: boolean;
  elapsedSec: number;
}

export default function DistrictInspectorDrawer({
  district,
  impact,
  isOpen,
  onClose,
  onSelectDistrict,
  onOpenPubChem,
  isSimulating,
  elapsedSec,
}: DistrictInspectorDrawerProps) {
  if (!isOpen) return null;

  const motion = computeInstantaneousGroundMotion(impact, elapsedSec, isSimulating);

  const linkedCompound =
    HAZMAT_COMPOUNDS.find((c) => district.primaryChemicalIds.includes(c.cid)) ||
    HAZMAT_COMPOUNDS[0];

  return (
    <aside
      aria-label={`${district.name} İlçe Sismik Özeti`}
      className="fixed top-16 right-4 z-20 w-[336px] max-w-[calc(100vw-2rem)] bg-[#0F1624] border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-100"
    >
      {/* Header: District Selector & Close */}
      <div className="p-3.5 border-b border-slate-800 bg-[#131C2E] flex items-center justify-between gap-2">
        <select
          aria-label="İlçe Seçimi"
          value={district.id}
          onChange={(e) => onSelectDistrict(e.target.value)}
          className="flex-1 min-w-0 truncate bg-[#0B0E17] text-slate-100 font-semibold text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
        >
          {ANKARA_DISTRICTS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} - {d.name} ({d.category})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onClose}
          aria-label="İlçe Panelini Kapat"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3.5 space-y-3 text-xs">
        {/* Subtitle metadata */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Nüfus: {district.population2026.toLocaleString('tr-TR')}</span>
          <span>·</span>
          <span>Rakım: {district.coords.elevationM}m</span>
          <span>·</span>
          <span className="text-cyan-400">{motion.phase}</span>
        </div>

        {/* 3 Core Seismic KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 bg-[#0B0E17] border border-slate-800 rounded-lg">
            <div className="text-[10px] text-slate-400">PGA İVMESİ</div>
            <div className="text-base font-mono font-bold tabular-nums text-amber-400 mt-0.5">
              {impact.pgaG.toFixed(3)}g
            </div>
          </div>
          <div className="p-2.5 bg-[#0B0E17] border border-slate-800 rounded-lg">
            <div className="text-[10px] text-slate-400">ŞİDDET</div>
            <div className="text-base font-mono font-bold tabular-nums text-cyan-400 mt-0.5">
              MMI {impact.mmiRoman}
            </div>
          </div>
          <div className="p-2.5 bg-[#0B0E17] border border-slate-800 rounded-lg">
            <div className="text-[10px] text-slate-400">S-DALGASI</div>
            <div className="text-base font-mono font-bold tabular-nums text-rose-400 mt-0.5">
              {impact.sWaveArrivalSec} sn
            </div>
          </div>
        </div>

        {/* Clean 4-Row Infrastructure Status Summary */}
        <div className="bg-[#0B0E17] border border-slate-800 rounded-lg divide-y divide-slate-800/80">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              <span>ASKİ Asbest/Eski Boru</span>
            </span>
            <span className="font-mono font-semibold text-sky-300 tabular-nums">
              %{district.aski.asbestosOrOldPipePercent} (~{impact.estimatedAsbestosPipeBreaks} Kırık)
            </span>
          </div>

          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Başkentgaz RMS Kesme</span>
            </span>
            <span className="font-mono font-semibold text-amber-300 tabular-nums">
              %{impact.baskentgazShutoffPercent} ({district.energy.gasSubscribers.toLocaleString('tr-TR')})
            </span>
          </div>

          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>Başkent EDAŞ Kesinti</span>
            </span>
            <span className="font-mono font-semibold text-rose-300 tabular-nums">
              {impact.edasOutageHouseholds.toLocaleString('tr-TR')} Hane
            </span>
          </div>

          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>MEB Okul & Fiber Ağı</span>
            </span>
            <span className="font-mono font-semibold text-emerald-300 tabular-nums">
              {district.schoolIsg.schoolCount} Okul · %{district.fiber.coveragePercent} Fiber
            </span>
          </div>
        </div>

        {/* Single Action Link to PubChem Secondary Chemical Risk */}
        <button
          type="button"
          onClick={() => onOpenPubChem(linkedCompound.cid)}
          className="w-full px-3 py-2 bg-[#131C2E] hover:bg-slate-800 border border-slate-700/80 rounded-lg flex items-center justify-between text-xs text-slate-200 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
            <span>İkincil Risk: {linkedCompound.nameTr}</span>
          </span>
          <span className="font-mono text-[11px] text-cyan-400">PubChem →</span>
        </button>
      </div>
    </aside>
  );
}
