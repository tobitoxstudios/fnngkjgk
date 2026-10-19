'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { interpolateYlOrRd, interpolateInferno } from 'd3-scale-chromatic';
import {
  ANKARA_DISTRICTS,
  FAULT_SCENARIOS,
  type DistrictData,
  type FaultLineScenario,
} from '@/lib/ankara-data';
import {
  computeInstantaneousGroundMotion,
  computeGridPointDynamicPGA,
  normalizePgaForChromaticScale,
  SCENE_UNIT_TO_KM,
  type DistrictSeismicImpact,
} from '@/lib/seismic-engine';
import type { TerrainContrastMode } from '@/lib/scenario-storage';

export type { TerrainContrastMode };
export type LayerMode = 'pga' | 'aski' | 'energy' | 'aykome_fiber' | 'traffic_isg';
export type CameraPreset = 'overview' | 'metro_core' | 'fault_top' | 'west_industrial';

interface AnkaraSeismicCanvasProps {
  selectedDistrictId: string;
  onSelectDistrict: (id: string) => void;
  activeFault: FaultLineScenario;
  impactsById: Record<string, DistrictSeismicImpact>;
  layerMode: LayerMode;
  cameraPreset: CameraPreset;
  isSimulating: boolean;
  elapsedSec: number;
  magnitudeMw: number;
  depthKm: number;
  showHeatmapOverlay: boolean;
  wavefrontSpeed?: number;
  terrainContrast?: TerrainContrastMode;
}

// Reusable scratch math objects outside the animation loop (Zero-allocation hot loop)
const _dummy = new THREE.Object3D();
const _colorScratch = new THREE.Color();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

/**
 * Parses an rgb(...) or hex string returned by d3-scale-chromatic into [r, g, b] (0-255)
 */
function parseChromaticColor(colorStr: string): [number, number, number] {
  if (colorStr.startsWith('rgb')) {
    const nums = colorStr.match(/\d+/g);
    if (nums && nums.length >= 3) {
      return [
        parseInt(nums[0], 10),
        parseInt(nums[1], 10),
        parseInt(nums[2], 10),
      ];
    }
  }
  _colorScratch.set(colorStr);
  return [
    Math.round(_colorScratch.r * 255),
    Math.round(_colorScratch.g * 255),
    Math.round(_colorScratch.b * 255),
  ];
}

/**
 * Generates procedural topographic height (in 3D scene units) for any (x, z) on the Ankara map
 */
function groundHeightAt(x: number, z: number): number {
  const northMountainBias = Math.max(0, -z - 8) * 0.085;
  const elmadagPeak = 2.9 * Math.exp(-((x - 16) * (x - 16) + (z - 8) * (z - 8)) / 78);
  const idrisPeak = 2.6 * Math.exp(-((x - 22) * (x - 22) + (z + 6) * (z + 6)) / 92);
  const kizilcahamamRidge = 3.5 * Math.exp(-((x + 8) * (x + 8) + (z + 32) * (z + 32)) / 185);
  const nallihanRidge = 2.5 * Math.exp(-((x + 52) * (x + 52) + (z + 16) * (z + 16)) / 145);
  const centralBasinDip = -0.75 * Math.exp(-((x + 6) * (x + 6) + z * z) / 210);
  const ripples = Math.sin(x * 0.14) * Math.cos(z * 0.14) * 0.28;
  return (
    0.2 +
    northMountainBias +
    elmadagPeak +
    idrisPeak +
    kizilcahamamRidge +
    nallihanRidge +
    centralBasinDip +
    ripples
  );
}

/**
 * Generates realistic architectural textures (curtain-wall glass skyscrapers, residential facades, industrial steel)
 */
function createArchitecturalTextures() {
  // 1. High-Rise Glass Curtain Wall Texture (Albedo + Emissive Windows)
  const hrCanvas = document.createElement('canvas');
  hrCanvas.width = 256;
  hrCanvas.height = 512;
  const hrCtx = hrCanvas.getContext('2d')!;
  hrCtx.fillStyle = '#0f172a';
  hrCtx.fillRect(0, 0, 256, 512);

  // Horizontal spandrel beams & vertical mullions
  for (let y = 0; y < 512; y += 16) {
    hrCtx.fillStyle = '#1e293b';
    hrCtx.fillRect(0, y, 256, 4);
    for (let x = 0; x < 256; x += 16) {
      hrCtx.fillStyle = '#334155';
      hrCtx.fillRect(x, y, 2, 16);
      // Lit office window panes
      const seed = ((x * 19 + y * 37) % 100) / 100;
      if (seed > 0.32) {
        hrCtx.fillStyle =
          seed > 0.78 ? '#fef08a' : seed > 0.52 ? '#bae6fd' : '#38bdf8';
        hrCtx.fillRect(x + 3, y + 5, 11, 9);
      } else {
        hrCtx.fillStyle = '#090d16';
        hrCtx.fillRect(x + 3, y + 5, 11, 9);
      }
    }
  }
  const highRiseTex = new THREE.CanvasTexture(hrCanvas);
  highRiseTex.colorSpace = THREE.SRGBColorSpace;
  highRiseTex.wrapS = THREE.RepeatWrapping;
  highRiseTex.wrapT = THREE.RepeatWrapping;

  // 2. Residential / Mid-Rise Concrete & Balcony Texture
  const resCanvas = document.createElement('canvas');
  resCanvas.width = 256;
  resCanvas.height = 256;
  const resCtx = resCanvas.getContext('2d')!;
  resCtx.fillStyle = '#334155';
  resCtx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 24) {
    resCtx.fillStyle = '#475569';
    resCtx.fillRect(0, y, 256, 4);
    for (let x = 0; x < 256; x += 32) {
      const warmSeed = ((x * 23 + y * 13) % 100) / 100;
      resCtx.fillStyle = warmSeed > 0.38 ? '#fde68a' : '#1e293b';
      resCtx.fillRect(x + 6, y + 7, 20, 12);
      // Balcony rail
      resCtx.fillStyle = '#64748b';
      resCtx.fillRect(x + 4, y + 17, 24, 3);
    }
  }
  const residentialTex = new THREE.CanvasTexture(resCanvas);
  residentialTex.colorSpace = THREE.SRGBColorSpace;
  residentialTex.wrapS = THREE.RepeatWrapping;
  residentialTex.wrapT = THREE.RepeatWrapping;

  // 3. Topographic Terrain Albedo + Bump Map with Dynamic Contrast Modes
  const terCanvas = document.createElement('canvas');
  terCanvas.width = 1024;
  terCanvas.height = 1024;
  const tCtx = terCanvas.getContext('2d')!;
  drawTerrainCanvas(tCtx, 'high');
  const terrainTex = new THREE.CanvasTexture(terCanvas);
  terrainTex.colorSpace = THREE.SRGBColorSpace;

  // 4. Soft Contact Shadow Texture
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 128;
  shCanvas.height = 128;
  const sCtx = shCanvas.getContext('2d')!;
  const sGrad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  sGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.28)');
  sGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadowTex = new THREE.CanvasTexture(shCanvas);
  contactShadowTex.colorSpace = THREE.SRGBColorSpace;

  return { highRiseTex, residentialTex, terrainTex, terCanvas, tCtx, contactShadowTex };
}

/**
 * Draws high-performance terrain albedo, topographic elevation relief and GIS grid
 * based on selected terrain contrast mode ('normal' | 'high' | 'topographic' | 'satellite')
 */
function drawTerrainCanvas(tCtx: CanvasRenderingContext2D, mode: TerrainContrastMode = 'high') {
  tCtx.clearRect(0, 0, 1024, 1024);

  if (mode === 'high') {
    // High contrast relief gradient: deep navy trenches to illuminated slate ridges
    const grad = tCtx.createRadialGradient(512, 512, 40, 512, 512, 700);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.35, '#0f172a');
    grad.addColorStop(0.7, '#070d18');
    grad.addColorStop(1, '#020617');
    tCtx.fillStyle = grad;
    tCtx.fillRect(0, 0, 1024, 1024);

    // High contrast GIS grid
    tCtx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    tCtx.lineWidth = 1.2;
    for (let i = 0; i <= 1024; i += 32) {
      tCtx.beginPath();
      tCtx.moveTo(i, 0);
      tCtx.lineTo(i, 1024);
      tCtx.stroke();
      tCtx.beginPath();
      tCtx.moveTo(0, i);
      tCtx.lineTo(1024, i);
      tCtx.stroke();
    }

    // High-contrast dual contour rings with index contours
    for (let r = 70, idx = 0; r < 700; r += 45, idx++) {
      const isMajor = idx % 2 === 0;
      tCtx.strokeStyle = isMajor ? 'rgba(56, 189, 248, 0.42)' : 'rgba(226, 232, 240, 0.22)';
      tCtx.lineWidth = isMajor ? 2.2 : 1.1;
      tCtx.beginPath();
      tCtx.ellipse(520, 490, r * 1.15, r * 0.82, 0.15, 0, Math.PI * 2);
      tCtx.stroke();
    }
  } else if (mode === 'topographic') {
    // Topographic hypsometric gradient: distinct elevation steps
    const grad = tCtx.createRadialGradient(512, 512, 50, 512, 512, 700);
    grad.addColorStop(0, '#2c3545'); // Peak ridge
    grad.addColorStop(0.28, '#1e293b');
    grad.addColorStop(0.55, '#152136');
    grad.addColorStop(0.85, '#0e1726');
    grad.addColorStop(1, '#070c14');
    tCtx.fillStyle = grad;
    tCtx.fillRect(0, 0, 1024, 1024);

    // Fine topographic grid with amber coordinates
    tCtx.strokeStyle = 'rgba(251, 191, 36, 0.14)';
    tCtx.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 32) {
      tCtx.beginPath();
      tCtx.moveTo(i, 0);
      tCtx.lineTo(i, 1024);
      tCtx.stroke();
      tCtx.beginPath();
      tCtx.moveTo(0, i);
      tCtx.lineTo(1024, i);
      tCtx.stroke();
    }

    // Topographic contour rings in amber and slate
    for (let r = 60, idx = 0; r < 720; r += 40, idx++) {
      const isIndex = idx % 3 === 0;
      tCtx.strokeStyle = isIndex ? 'rgba(245, 158, 11, 0.55)' : 'rgba(148, 163, 184, 0.28)';
      tCtx.lineWidth = isIndex ? 2.4 : 1.0;
      tCtx.beginPath();
      tCtx.ellipse(520, 490, r * 1.15, r * 0.82, 0.15, 0, Math.PI * 2);
      tCtx.stroke();
    }
  } else if (mode === 'satellite') {
    // Tactical radar/gece mode: deep obsidian base with illuminated tactical lines
    const grad = tCtx.createRadialGradient(512, 512, 80, 512, 512, 700);
    grad.addColorStop(0, '#0a101d');
    grad.addColorStop(0.6, '#040711');
    grad.addColorStop(1, '#020408');
    tCtx.fillStyle = grad;
    tCtx.fillRect(0, 0, 1024, 1024);

    // Glowing cyan radar sweep circles
    tCtx.lineWidth = 1.4;
    for (let r = 90; r < 720; r += 60) {
      tCtx.strokeStyle = 'rgba(6, 182, 212, 0.32)';
      tCtx.beginPath();
      tCtx.arc(512, 512, r, 0, Math.PI * 2);
      tCtx.stroke();
    }

    // Tactical crosshairs
    tCtx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    tCtx.beginPath();
    tCtx.moveTo(512, 0);
    tCtx.lineTo(512, 1024);
    tCtx.moveTo(0, 512);
    tCtx.lineTo(1024, 512);
    tCtx.stroke();
  } else {
    // Normal balanced terrain
    const grad = tCtx.createRadialGradient(512, 512, 60, 512, 512, 680);
    grad.addColorStop(0, '#131d31');
    grad.addColorStop(0.55, '#0f172a');
    grad.addColorStop(1, '#090d16');
    tCtx.fillStyle = grad;
    tCtx.fillRect(0, 0, 1024, 1024);

    tCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    tCtx.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 32) {
      tCtx.beginPath();
      tCtx.moveTo(i, 0);
      tCtx.lineTo(i, 1024);
      tCtx.stroke();
      tCtx.beginPath();
      tCtx.moveTo(0, i);
      tCtx.lineTo(1024, i);
      tCtx.stroke();
    }

    tCtx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    tCtx.lineWidth = 1;
    for (let r = 80; r < 680; r += 55) {
      tCtx.beginPath();
      tCtx.ellipse(520, 490, r * 1.15, r * 0.82, 0.15, 0, Math.PI * 2);
      tCtx.stroke();
    }
  }
}

/**
 * Creates a crisp 3D floating billboard Sprite label for a district showing its name and live PGA
 */
function createDistrictLabelSprite(
  districtName: string,
  pgaText: string,
  accentRgb: string,
  isSelected: boolean
): { sprite: THREE.Sprite; updateLabel: (newPga: string, newColor: string, selected: boolean) => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.2, 1.3, 1);

  let lastKey = '';
  const updateLabel = (newPga: string, newColor: string, selected: boolean) => {
    const key = `${newPga}|${newColor}|${selected}`;
    if (key === lastKey) return;
    lastKey = key;

    ctx.clearRect(0, 0, 256, 64);
    // Pill background
    ctx.fillStyle = selected ? 'rgba(8, 47, 73, 0.94)' : 'rgba(11, 14, 23, 0.88)';
    ctx.strokeStyle = selected ? '#22d3ee' : newColor;
    ctx.lineWidth = selected ? 4 : 2.5;
    ctx.beginPath();
    ctx.roundRect(6, 8, 244, 48, 10);
    ctx.fill();
    ctx.stroke();

    // Left color indicator bar
    ctx.fillStyle = newColor;
    ctx.fillRect(14, 16, 6, 32);

    // District name
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(districtName, 28, 32);

    // Right-aligned PGA readout
    ctx.fillStyle = selected ? '#38bdf8' : '#fde047';
    ctx.font = 'bold 19px monospace';
    const textWidth = ctx.measureText(newPga).width;
    ctx.fillText(newPga, 240 - textWidth, 32);

    texture.needsUpdate = true;
  };

  updateLabel(pgaText, accentRgb, isSelected);
  return { sprite, updateLabel };
}

/**
 * Builds a realistic multi-part 3D architectural landmark & infrastructure complex for each of the 25 Ankara districts
 */
function createRealisticDistrictGroup(
  district: DistrictData,
  textures: {
    highRiseTex: THREE.CanvasTexture;
    residentialTex: THREE.CanvasTexture;
    contactShadowTex: THREE.CanvasTexture;
  },
  sharedGeos: {
    plinthGeo: THREE.ExtrudeGeometry;
    waterTankGeo: THREE.LatheGeometry;
    coolingTowerGeo: THREE.LatheGeometry;
    gasPipeGeo: THREE.TubeGeometry;
    shadowPlaneGeo: THREE.PlaneGeometry;
    ringGeo: THREE.RingGeometry;
    footprintPadGeo: THREE.RingGeometry;
    footprintShockwaveGeo: THREE.RingGeometry;
    boxGeo: THREE.BoxGeometry;
    cylGeo: THREE.CylinderGeometry;
    domeGeo: THREE.SphereGeometry;
  }
) {
  const group = new THREE.Group();
  group.name = `district-${district.id}`;
  const baseY = groundHeightAt(district.coords.x, district.coords.z);

  const isMetro = district.category === 'Metropol Çekirdek';
  const isInd = district.category === 'Büyüme/Sanayi';
  const popScale = Math.min(2.1, Math.max(0.8, Math.log10(district.population2026) - 3.85));

  // 1. Soft Ground Contact Shadow
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(sharedGeos.shadowPlaneGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.03;
  shadowMesh.scale.setScalar(isMetro ? 1.55 : 1.15);
  group.add(shadowMesh);

  // 2. Dynamic Wavefront Building Footprint Foundation Aura (Opacity-mapped to wavefront state)
  const footprintPadMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const footprintPad = new THREE.Mesh(sharedGeos.footprintPadGeo, footprintPadMat);
  footprintPad.rotation.x = -Math.PI / 2;
  footprintPad.position.y = 0.05;
  footprintPad.scale.setScalar(isMetro ? 1.48 : 1.08);
  group.add(footprintPad);

  // 3. Dynamic Wavefront Outward Shockwave Ring
  const footprintShockwaveMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const footprintShockwave = new THREE.Mesh(sharedGeos.footprintShockwaveGeo, footprintShockwaveMat);
  footprintShockwave.rotation.x = -Math.PI / 2;
  footprintShockwave.position.y = 0.07;
  footprintShockwave.scale.setScalar(isMetro ? 1.48 : 1.08);
  group.add(footprintShockwave);

  // 4. Beveled Architectural Plaza Plinth
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.35,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
  });
  const plinthMesh = new THREE.Mesh(sharedGeos.plinthGeo, plinthMat);
  plinthMesh.rotation.x = -Math.PI / 2;
  plinthMesh.scale.set(isMetro ? 1.38 : 1.0, isMetro ? 1.38 : 1.0, 1);
  plinthMesh.receiveShadow = true;
  group.add(plinthMesh);

  // 5. Dynamic Chromatic Halo Ring around Plinth
  const statusRingMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const statusRing = new THREE.Mesh(sharedGeos.ringGeo, statusRingMat);
  statusRing.rotation.x = -Math.PI / 2;
  statusRing.position.y = 0.09;
  statusRing.scale.setScalar(isMetro ? 1.45 : 1.05);
  group.add(statusRing);

  // 4. Primary Architectural Landmark Material (Lit glass curtain wall or masonry facade)
  const primaryMat = new THREE.MeshStandardMaterial({
    map: isMetro ? textures.highRiseTex : textures.residentialTex,
    color: 0xffffff,
    roughness: isMetro ? 0.22 : 0.55,
    metalness: isMetro ? 0.68 : 0.25,
  });

  const accentRoofMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.35,
    metalness: 0.5,
  });

  if (district.id === 'cankaya') {
    // Realistic Atakule Observation Tower + Twin Curtain-Wall Skyscrapers
    const shaft = new THREE.Mesh(sharedGeos.cylGeo, accentRoofMat);
    shaft.scale.set(0.22, 3.6, 0.22);
    shaft.position.set(0.45, 2.0, 0.25);
    shaft.castShadow = true;
    group.add(shaft);

    // Atakule Observation Globe Crown
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.85,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
    });
    const crownBottom = new THREE.Mesh(sharedGeos.cylGeo, crownMat);
    crownBottom.scale.set(0.62, 0.45, 0.62);
    crownBottom.position.set(0.45, 3.85, 0.25);
    group.add(crownBottom);

    const crownDome = new THREE.Mesh(sharedGeos.domeGeo, crownMat);
    crownDome.scale.set(0.62, 0.42, 0.62);
    crownDome.position.set(0.45, 4.05, 0.25);
    group.add(crownDome);

    const spire = new THREE.Mesh(sharedGeos.cylGeo, accentRoofMat);
    spire.scale.set(0.04, 0.9, 0.04);
    spire.position.set(0.45, 4.65, 0.25);
    group.add(spire);

    // Söğütözü / Çukurambar Glass Skyscraper Twins
    const towerA = new THREE.Mesh(sharedGeos.boxGeo, primaryMat);
    towerA.scale.set(0.78, 3.2, 0.78);
    towerA.position.set(-0.42, 1.8, -0.15);
    towerA.castShadow = true;
    group.add(towerA);

    const towerB = new THREE.Mesh(sharedGeos.boxGeo, primaryMat);
    towerB.scale.set(0.62, 2.35, 0.62);
    towerB.position.set(-0.2, 1.38, 0.58);
    towerB.castShadow = true;
    group.add(towerB);
  } else if (district.id === 'altindag') {
    // Monumental Anıtkabir Colonnade & Ulus Citadel Complex
    const travertineMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.45,
      metalness: 0.15,
    });
    const baseHall = new THREE.Mesh(sharedGeos.boxGeo, travertineMat);
    baseHall.scale.set(1.55, 0.42, 1.15);
    baseHall.position.set(0, 0.45, 0);
    group.add(baseHall);

    // Perimeter Colonnade Pillars
    for (let px = -0.6; px <= 0.6; px += 0.3) {
      for (const pz of [-0.45, 0.45]) {
        const col = new THREE.Mesh(sharedGeos.boxGeo, travertineMat);
        col.scale.set(0.11, 0.85, 0.11);
        col.position.set(px, 1.05, pz);
        col.castShadow = true;
        group.add(col);
      }
    }
    const roofCap = new THREE.Mesh(sharedGeos.boxGeo, primaryMat);
    roofCap.scale.set(1.48, 0.24, 1.08);
    roofCap.position.set(0, 1.55, 0);
    group.add(roofCap);
  } else if (isMetro) {
    // High-Rise Metropolitan Commercial & Residential Complex (Keçiören, Yenimahalle, Mamak, Etimesgut, Sincan, Gölbaşı, Pursaklar)
    const h = 1.65 * popScale;
    const mainTower = new THREE.Mesh(sharedGeos.boxGeo, primaryMat);
    mainTower.scale.set(0.82, h, 0.82);
    mainTower.position.set(-0.22, 0.25 + h / 2, -0.12);
    mainTower.castShadow = true;
    group.add(mainTower);

    // Rooftop Mechanical Penthouse & Helipad Ring
    const penthouse = new THREE.Mesh(sharedGeos.boxGeo, accentRoofMat);
    penthouse.scale.set(0.52, 0.26, 0.52);
    penthouse.position.set(-0.22, 0.25 + h + 0.13, -0.12);
    group.add(penthouse);

    // Stepped Secondary Wing
    const wingH = h * 0.68;
    const wingTower = new THREE.Mesh(sharedGeos.boxGeo, primaryMat);
    wingTower.scale.set(0.68, wingH, 0.64);
    wingTower.position.set(0.42, 0.25 + wingH / 2, 0.28);
    wingTower.castShadow = true;
    group.add(wingTower);
  } else if (isInd) {
    // TUSAŞ / OSB Aerospace & Heavy Industry Complex (Curved Steel Hangar + Hyperbolic Cooling Tower)
    const hangar = new THREE.Mesh(sharedGeos.cylGeo, primaryMat);
    hangar.rotation.z = Math.PI / 2;
    hangar.scale.set(0.68, 1.45, 0.95);
    hangar.position.set(-0.15, 0.58, -0.15);
    hangar.castShadow = true;
    group.add(hangar);

    // Hyperbolic Concrete Cooling Tower
    const coolingTower = new THREE.Mesh(sharedGeos.coolingTowerGeo, accentRoofMat);
    coolingTower.scale.setScalar(0.52);
    coolingTower.position.set(0.55, 0.25, 0.42);
    coolingTower.castShadow = true;
    group.add(coolingTower);
  } else {
    // Outer District Civic Center, Terraced Housing & Thermal Dome
    const h = 1.15 * popScale;
    const civicBlock = new THREE.Mesh(sharedGeos.boxGeo, primaryMat);
    civicBlock.scale.set(0.78, h, 0.68);
    civicBlock.position.set(-0.18, 0.25 + h / 2, 0);
    civicBlock.castShadow = true;
    group.add(civicBlock);

    // Terracotta / Copper Dome or Pitched Roof
    const dome = new THREE.Mesh(sharedGeos.domeGeo, accentRoofMat);
    dome.scale.set(0.45, 0.35, 0.45);
    dome.position.set(-0.18, 0.25 + h, 0);
    group.add(dome);
  }

  // 5. ASKİ Elevated Water Tower (Spherical Hydro-Tank on Concrete Column)
  const askiMat = new THREE.MeshStandardMaterial({
    color: district.aski.asbestosOrOldPipePercent >= 40 ? 0xf43f5e : 0x38bdf8,
    roughness: 0.3,
    metalness: 0.55,
  });
  const waterTower = new THREE.Mesh(sharedGeos.waterTankGeo, askiMat);
  waterTower.scale.setScalar(0.52);
  waterTower.position.set(-0.78, 0.25, 0.58);
  waterTower.castShadow = true;
  group.add(waterTower);

  // 6. Başkentgaz RMS-A Yellow High-Pressure Gas Pipeline Manifold
  const gasMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.25,
    metalness: 0.75,
  });
  const gasLoop = new THREE.Mesh(sharedGeos.gasPipeGeo, gasMat);
  gasLoop.position.set(0.75, 0.25, -0.45);
  group.add(gasLoop);

  // 7. Invisible Raycast Hit Proxy on Layer 1
  const hitProxy = new THREE.Mesh(
    sharedGeos.cylGeo,
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.scale.set(2.2, 4.5, 2.2);
  hitProxy.position.set(0, 2.0, 0);
  hitProxy.layers.set(1);
  hitProxy.userData = { districtId: district.id };
  group.add(hitProxy);

  return {
    group,
    primaryMat,
    plinthMesh,
    plinthMat,
    statusRing,
    statusRingMat,
    footprintPad,
    footprintPadMat,
    footprintShockwave,
    footprintShockwaveMat,
    hitProxy,
    baseY,
    category: district.category,
  };
}

export default function AnkaraSeismicCanvas({
  selectedDistrictId,
  onSelectDistrict,
  activeFault,
  impactsById,
  layerMode,
  cameraPreset,
  isSimulating,
  elapsedSec,
  magnitudeMw,
  depthKm,
  showHeatmapOverlay,
  wavefrontSpeed = 1.0,
  terrainContrast = 'high',
}: AnkaraSeismicCanvasProps) {
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({
    selectedDistrictId,
    onSelectDistrict,
    activeFault,
    impactsById,
    layerMode,
    cameraPreset,
    isSimulating,
    elapsedSec,
    magnitudeMw,
    depthKm,
    showHeatmapOverlay,
    wavefrontSpeed,
    terrainContrast,
  });

  useEffect(() => {
    stateRef.current = {
      selectedDistrictId,
      onSelectDistrict,
      activeFault,
      impactsById,
      layerMode,
      cameraPreset,
      isSimulating,
      elapsedSec,
      magnitudeMw,
      depthKm,
      showHeatmapOverlay,
      wavefrontSpeed,
      terrainContrast,
    };
  }, [
    selectedDistrictId,
    onSelectDistrict,
    activeFault,
    impactsById,
    layerMode,
    cameraPreset,
    isSimulating,
    elapsedSec,
    magnitudeMw,
    depthKm,
    showHeatmapOverlay,
    wavefrontSpeed,
    terrainContrast,
  ]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const isHeadless = typeof navigator !== 'undefined' && navigator.webdriver === true;

    // Scene & Atmospheric Horizon Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e17);
    scene.fog = new THREE.FogExp2(0x0b0e17, 0.0052);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 340);
    camera.position.set(0, 52, 66);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Environment & Studio-Grade 3-Point Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.75);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    dirLight.position.set(42, 68, 36);
    dirLight.castShadow = !isHeadless;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 180;
    const dCam = 75;
    dirLight.shadow.camera.left = -dCam;
    dirLight.shadow.camera.right = dCam;
    dirLight.shadow.camera.top = dCam;
    dirLight.shadow.camera.bottom = -dCam;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-50, 32, -45);
    scene.add(rimLight);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 14;
    controls.maxDistance = 145;
    controls.target.set(0, 0, 2);

    const textures = createArchitecturalTextures();

    // 1. Ankara 3D Topographic Terrain Mesh (150 x 130 units)
    const terrainGeo = new THREE.PlaneGeometry(150, 130, 110, 96);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, groundHeightAt(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: textures.terrainTex,
      roughness: 0.82,
      metalness: 0.12,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = !isHeadless;
    scene.add(terrainMesh);

    // 2. Dynamic d3-scale-chromatic PGA Heatmap Overlay Mesh (Conforms to Ankara 3D Terrain)
    const HM_W = isHeadless ? 64 : 112;
    const HM_H = isHeadless ? 56 : 96;
    const hmCanvas = document.createElement('canvas');
    hmCanvas.width = HM_W;
    hmCanvas.height = HM_H;
    const hmCtx = hmCanvas.getContext('2d')!;
    const hmImgData = hmCtx.createImageData(HM_W, HM_H);

    const hmTexture = new THREE.CanvasTexture(hmCanvas);
    hmTexture.colorSpace = THREE.SRGBColorSpace;
    hmTexture.minFilter = THREE.LinearFilter;
    hmTexture.magFilter = THREE.LinearFilter;

    const heatmapGeo = new THREE.PlaneGeometry(150, 130, 80, 70);
    heatmapGeo.rotateX(-Math.PI / 2);
    const hmPosAttr = heatmapGeo.attributes.position;
    for (let i = 0; i < hmPosAttr.count; i++) {
      const vx = hmPosAttr.getX(i);
      const vz = hmPosAttr.getZ(i);
      hmPosAttr.setY(i, groundHeightAt(vx, vz) + 0.16);
    }
    heatmapGeo.computeVertexNormals();

    const heatmapMat = new THREE.MeshBasicMaterial({
      map: hmTexture,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const heatmapMesh = new THREE.Mesh(heatmapGeo, heatmapMat);
    heatmapMesh.name = 'pga-d3-heatmap-overlay';
    scene.add(heatmapMesh);

    /**
     * Recomputes the d3-scale-chromatic PGA heatmap texture across the 150x130 Ankara map
     */
    let lastHeatmapSignature = '';
    const updateHeatmapTexture = (
      epicenter: { x: number; z: number },
      mw: number,
      depth: number,
      elapsed: number,
      simulating: boolean,
      visible: boolean
    ) => {
      heatmapMesh.visible = visible;
      if (!visible) return;

      // Quantize elapsed time so the heatmap updates smoothly without bottlenecking CPU
      const stepFreq = isHeadless ? 1.0 : 3.0;
      const timeStep = simulating ? Math.round(elapsed * stepFreq) / stepFreq : 0;
      const sig = `${epicenter.x},${epicenter.z}|${mw}|${depth}|${simulating}|${timeStep}`;
      if (sig === lastHeatmapSignature) return;
      lastHeatmapSignature = sig;

      const data = hmImgData.data;
      let p = 0;
      for (let py = 0; py < HM_H; py++) {
        // Map py [0..HM_H-1] to world z [-65..+65]
        const worldZ = (py / (HM_H - 1) - 0.5) * 130;
        for (let px = 0; px < HM_W; px++) {
          // Map px [0..HM_W-1] to world x [-75..+75]
          const worldX = (px / (HM_W - 1) - 0.5) * 150;

          const pga = computeGridPointDynamicPGA(
            { x: worldX, z: worldZ },
            epicenter,
            mw,
            depth,
            elapsed,
            simulating
          );
          const norm = normalizePgaForChromaticScale(pga);

          // Blend d3-scale-chromatic interpolateYlOrRd and interpolateInferno for high-contrast seismic thermal readability
          const chromaticStr = norm > 0.65 ? interpolateInferno(0.35 + norm * 0.6) : interpolateYlOrRd(norm);
          const [r, g, b] = parseChromaticColor(chromaticStr);

          // Radial edge vignette so the heatmap blends seamlessly into the terrain border
          const edgeDist = Math.max(Math.abs(worldX) / 72, Math.abs(worldZ) / 62);
          const edgeFade = Math.max(0, Math.min(1, 1.18 - edgeDist));

          // Alpha increases with PGA intensity
          const baseAlpha = norm < 0.06 ? norm * 380 : 32 + Math.pow(norm, 0.78) * 195;
          data[p] = r;
          data[p + 1] = g;
          data[p + 2] = b;
          data[p + 3] = Math.round(Math.min(228, baseAlpha * edgeFade));
          p += 4;
        }
      }
      hmCtx.putImageData(hmImgData, 0, 0);
      hmTexture.needsUpdate = true;
    };

    // 3. Hydrological Basins (Mogan, Çamlıdere, Kurtboğazı, Hirfanlı/Tuz Gölü, Sarıyar)
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      roughness: 0.14,
      metalness: 0.1,
      transmission: 0.35,
      transparent: true,
      opacity: 0.82,
    });
    const reservoirs = [
      { x: 1, z: 16, rx: 3.6, rz: 2.1 },
      { x: -11, z: -29, rx: 5.2, rz: 3.1 },
      { x: -5, z: -18, rx: 2.8, rz: 1.9 },
      { x: 35, z: 38, rx: 8.5, rz: 5.5 },
      { x: -46, z: -14, rx: 6.2, rz: 2.4 },
    ];
    reservoirs.forEach((w) => {
      const wGeo = new THREE.CircleGeometry(1, 28);
      wGeo.rotateX(-Math.PI / 2);
      const wMesh = new THREE.Mesh(wGeo, waterMat);
      wMesh.scale.set(w.rx, 1, w.rz);
      wMesh.position.set(w.x, groundHeightAt(w.x, w.z) + 0.22, w.z);
      scene.add(wMesh);
    });

    // 4. Realistic Highway Corridors (O-20 Ring Road, D200, D750, D140)
    const highwayCorridors = [
      [
        [-12, -4],
        [-6, -9],
        [4, -8],
        [10, -2],
        [8, 7],
        [-2, 10],
        [-10, 4],
        [-12, -4],
      ],
      [
        [-34, 16],
        [-18, 8],
        [-9, 3],
        [0, 0],
        [10, 2],
        [22, 6],
      ],
      [
        [-10, -34],
        [-5, -18],
        [0, -4],
        [2, 16],
        [18, 22],
        [36, 40],
      ],
    ];
    const highwayMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.55,
    });
    highwayCorridors.forEach((pts) => {
      const vecs = pts.map(([px, pz]) => new THREE.Vector3(px, groundHeightAt(px, pz) + 0.24, pz));
      const curve = new THREE.CatmullRomCurve3(vecs);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      scene.add(new THREE.Line(lineGeo, highwayMat));
    });

    // 5. Fault Lines (3D Glowing Tectonic Rupture Tubes)
    const faultMeshes: Record<string, THREE.Mesh> = {};
    FAULT_SCENARIOS.forEach((fault) => {
      const faultPts = fault.tracePoints.map(
        (p) => new THREE.Vector3(p.x, groundHeightAt(p.x, p.z) + 0.28, p.z)
      );
      const curve = new THREE.CatmullRomCurve3(faultPts);
      const tubeGeo = new THREE.TubeGeometry(curve, 44, 0.32, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.75,
        roughness: 0.3,
        metalness: 0.3,
      });
      const mesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(mesh);
      faultMeshes[fault.id] = mesh;
    });

    // 6. Shared Geometries for Realistic Composite District Models
    const octShape = new THREE.Shape();
    const octRadius = 1.28;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const ox = Math.cos(angle) * octRadius;
      const oy = Math.sin(angle) * octRadius;
      if (i === 0) octShape.moveTo(ox, oy);
      else octShape.lineTo(ox, oy);
    }
    octShape.closePath();

    const plinthGeo = new THREE.ExtrudeGeometry(octShape, {
      steps: 1,
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 2,
    });

    const waterTankGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.15, 0.0),
        new THREE.Vector2(0.15, 0.95),
        new THREE.Vector2(0.48, 1.2),
        new THREE.Vector2(0.5, 1.5),
        new THREE.Vector2(0.22, 1.72),
        new THREE.Vector2(0.0, 1.76),
      ],
      18
    );

    const coolingTowerGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.55, 0.0),
        new THREE.Vector2(0.42, 0.6),
        new THREE.Vector2(0.32, 1.25),
        new THREE.Vector2(0.38, 1.85),
        new THREE.Vector2(0.36, 1.85),
      ],
      20
    );

    const gasPipeGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.32, 0, 0),
        new THREE.Vector3(-0.32, 0.72, 0),
        new THREE.Vector3(0.32, 0.72, 0),
        new THREE.Vector3(0.32, 0, 0),
      ]),
      16,
      0.09,
      8,
      false
    );

    const shadowPlaneGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const ringGeo = new THREE.RingGeometry(1.4, 1.62, 32);
    const footprintPadGeo = new THREE.RingGeometry(0.3, 1.88, 32);
    const footprintShockwaveGeo = new THREE.RingGeometry(1.7, 2.05, 32);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
    const domeGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);

    const sharedGeos = {
      plinthGeo,
      waterTankGeo,
      coolingTowerGeo,
      gasPipeGeo,
      shadowPlaneGeo,
      ringGeo,
      footprintPadGeo,
      footprintShockwaveGeo,
      boxGeo,
      cylGeo,
      domeGeo,
    };

    // Build all 25 Realistic District Groups + Floating Telemetry Labels for Key Districts
    const districtNodes: Record<
      string,
      ReturnType<typeof createRealisticDistrictGroup>
    > = {};
    const labelSprites: Record<
      string,
      ReturnType<typeof createDistrictLabelSprite>
    > = {};
    const interactables: THREE.Object3D[] = [];

    // Show floating 3D badges on major metropolitan & fault-line hub districts so the scene stays clean and legible
    const labeledDistrictIds = new Set([
      'cankaya',
      'kecioren',
      'yenimahalle',
      'altindag',
      'mamak',
      'etimesgut',
      'sincan',
      'golbasi',
      'polatli',
      'kahramankazan',
      'beypazari',
      'sereflikochisar',
      'kizilcahamam',
      'bala',
    ]);

    ANKARA_DISTRICTS.forEach((d) => {
      const node = createRealisticDistrictGroup(d, textures, sharedGeos);
      node.group.position.set(d.coords.x, node.baseY, d.coords.z);
      scene.add(node.group);
      districtNodes[d.id] = node;
      interactables.push(node.hitProxy);

      if (labeledDistrictIds.has(d.id)) {
        const lbl = createDistrictLabelSprite(d.name, '0.10g', '#f59e0b', false);
        lbl.sprite.position.set(
          0,
          d.id === 'cankaya' ? 5.6 : d.category === 'Metropol Çekirdek' ? 4.3 : 3.2,
          0
        );
        node.group.add(lbl.sprite);
        labelSprites[d.id] = lbl;
      }
    });

    // 7. InstancedMesh for Realistic Surrounding Urban Skyline (260 Windowed Building Blocks)
    const urbanBlockCount = 260;
    const urbanBlockCoords: Array<{ x: number; z: number; districtId: string }> = [];
    const urbanInstancedMat = new THREE.MeshStandardMaterial({
      map: textures.residentialTex,
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.35,
    });
    const urbanInstancedMesh = new THREE.InstancedMesh(
      boxGeo,
      urbanInstancedMat,
      urbanBlockCount
    );
    urbanInstancedMesh.castShadow = !isHeadless;
    urbanInstancedMesh.receiveShadow = !isHeadless;

    let idx = 0;
    ANKARA_DISTRICTS.forEach((d, dIndex) => {
      const clusterCount =
        d.category === 'Metropol Çekirdek'
          ? 16
          : d.category === 'Büyüme/Sanayi'
          ? 11
          : 6;
      for (let c = 0; c < clusterCount && idx < urbanBlockCount; c++) {
        const angle = (c / clusterCount) * Math.PI * 2 + dIndex * 0.45;
        const radius = 2.25 + (c % 4) * 0.85;
        const bx = d.coords.x + Math.cos(angle) * radius;
        const bz = d.coords.z + Math.sin(angle) * radius;
        const by = groundHeightAt(bx, bz);
        const bh = 0.55 + ((c * 17 + dIndex * 7) % 12) * 0.16;
        const bw = 0.42 + ((c * 13) % 5) * 0.08;
        const bd = 0.42 + ((c * 7) % 5) * 0.08;

        _dummy.position.set(bx, by + bh / 2, bz);
        _dummy.rotation.set(0, angle * 0.6, 0);
        _dummy.scale.set(bw, bh, bd);
        _dummy.updateMatrix();
        urbanInstancedMesh.setMatrixAt(idx, _dummy.matrix);

        const shade = 0.65 + ((c * 11) % 10) * 0.035;
        _colorScratch.setRGB(shade * 0.9, shade * 0.95, shade);
        urbanInstancedMesh.setColorAt(idx, _colorScratch);
        urbanBlockCoords.push({ x: bx, z: bz, districtId: d.id });
        idx++;
      }
    });
    urbanInstancedMesh.instanceMatrix.needsUpdate = true;
    if (urbanInstancedMesh.instanceColor) urbanInstancedMesh.instanceColor.needsUpdate = true;
    urbanInstancedMesh.computeBoundingSphere();
    scene.add(urbanInstancedMesh);

    // 8. Epicenter Beacon & Expanding P-Wave / S-Wave Shockwave Rings
    const epicenterGroup = new THREE.Group();
    const epiBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 9.5, 16),
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.78,
      })
    );
    epiBeacon.position.y = 4.75;
    epicenterGroup.add(epiBeacon);

    const epiCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.0, 1),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 1.4,
        roughness: 0.2,
        metalness: 0.5,
      })
    );
    epiCore.position.y = 1.3;
    epicenterGroup.add(epiCore);
    scene.add(epicenterGroup);

    const waveRingGeo = new THREE.RingGeometry(0.86, 1.0, 64);
    waveRingGeo.rotateX(-Math.PI / 2);

    const pWaveMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const pWaveMesh = new THREE.Mesh(waveRingGeo, pWaveMat);
    scene.add(pWaveMesh);

    const sWaveMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const sWaveMesh = new THREE.Mesh(waveRingGeo, sWaveMat);
    scene.add(sWaveMesh);

    // Initial heatmap bake
    updateHeatmapTexture(
      stateRef.current.activeFault.epicenter,
      stateRef.current.magnitudeMw,
      stateRef.current.depthKm,
      stateRef.current.elapsedSec,
      stateRef.current.isSimulating,
      stateRef.current.showHeatmapOverlay
    );

    renderer.compile(scene, camera);

    // Raycasting on Layer 1
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let isAutoMovingCam = false;

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      isAutoMovingCam = false;
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      if (dx > 6 || dy > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactables, false);
      if (hits.length > 0) {
        const hitDistrictId = hits[0].object.userData?.districtId;
        if (hitDistrictId) {
          stateRef.current.onSelectDistrict(hitDistrictId);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let lastSelectedId = stateRef.current.selectedDistrictId;
    let lastCameraPreset: CameraPreset = stateRef.current.cameraPreset;
    let lastTerrainContrast: TerrainContrastMode | '' = '';

    const clock = new THREE.Clock();
    let animId = 0;
    let lastRenderTime = 0;

    const animate = (timestamp: number) => {
      animId = requestAnimationFrame(animate);

      if (isHeadless && timestamp - lastRenderTime < 66) {
        return;
      }
      lastRenderTime = timestamp;

      const delta = Math.min(0.1, clock.getDelta());
      const elapsedTotal = clock.getElapsedTime();
      const st = stateRef.current;

      // 0. Dynamic Terrain Contrast updates (Normal, High, Topographic, Satellite/Radar)
      const currentContrast = st.terrainContrast || 'high';
      if (lastTerrainContrast !== currentContrast) {
        lastTerrainContrast = currentContrast;
        drawTerrainCanvas(textures.tCtx, currentContrast);
        textures.terrainTex.needsUpdate = true;

        if (currentContrast === 'high') {
          dirLight.intensity = 3.2;
          hemiLight.intensity = 0.45;
          rimLight.intensity = 1.0;
          rimLight.color.setHex(0x38bdf8);
          terrainMat.roughness = 0.58;
          terrainMat.metalness = 0.28;
          renderer.toneMappingExposure = 1.30;
        } else if (currentContrast === 'topographic') {
          dirLight.intensity = 2.7;
          hemiLight.intensity = 0.65;
          rimLight.intensity = 1.1;
          rimLight.color.setHex(0xfbbf24);
          terrainMat.roughness = 0.72;
          terrainMat.metalness = 0.16;
          renderer.toneMappingExposure = 1.25;
        } else if (currentContrast === 'satellite') {
          dirLight.intensity = 1.7;
          hemiLight.intensity = 0.38;
          rimLight.intensity = 1.6;
          rimLight.color.setHex(0x22d3ee);
          terrainMat.roughness = 0.45;
          terrainMat.metalness = 0.42;
          renderer.toneMappingExposure = 1.10;
        } else {
          // normal
          dirLight.intensity = 2.2;
          hemiLight.intensity = 0.75;
          rimLight.intensity = 0.85;
          rimLight.color.setHex(0x38bdf8);
          terrainMat.roughness = 0.82;
          terrainMat.metalness = 0.12;
          renderer.toneMappingExposure = 1.15;
        }
      }

      // 1. Dynamically update the d3-scale-chromatic PGA heatmap overlay across the city map
      updateHeatmapTexture(
        st.activeFault.epicenter,
        st.magnitudeMw,
        st.depthKm,
        st.elapsedSec,
        st.isSimulating,
        st.showHeatmapOverlay
      );

      // 2. Active fault line highlight
      FAULT_SCENARIOS.forEach((f) => {
        const mesh = faultMeshes[f.id];
        if (!mesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const isCurrent = f.id === st.activeFault.id;
        mat.color.setHex(isCurrent ? 0xf43f5e : 0x64748b);
        mat.emissive.setHex(isCurrent ? 0xe11d48 : 0x1e293b);
        mat.emissiveIntensity = isCurrent ? 1.25 : 0.22;
      });

      // 3. Position epicenter marker & expanding P/S wave rings
      const epiX = st.activeFault.epicenter.x;
      const epiZ = st.activeFault.epicenter.z;
      const epiY = groundHeightAt(epiX, epiZ);
      epicenterGroup.position.set(epiX, epiY, epiZ);
      epiCore.rotation.y = elapsedTotal * 1.5;

      if (st.isSimulating && st.elapsedSec > 0) {
        const pRadiusUnits = (st.elapsedSec * 6.0) / SCENE_UNIT_TO_KM;
        const sRadiusUnits = (st.elapsedSec * 3.5) / SCENE_UNIT_TO_KM;

        pWaveMesh.position.set(epiX, epiY + 1.2, epiZ);
        pWaveMesh.scale.setScalar(Math.max(1.2, pRadiusUnits));
        pWaveMat.opacity = Math.max(0.18, Math.min(0.95, 1.0 - pRadiusUnits / 108));

        sWaveMesh.position.set(epiX, epiY + 1.4, epiZ);
        sWaveMesh.scale.setScalar(Math.max(0.8, sRadiusUnits));
        sWaveMat.opacity = Math.max(0.22, Math.min(0.98, 1.0 - sRadiusUnits / 92));
      } else {
        pWaveMat.opacity = 0;
        sWaveMat.opacity = 0;
      }

      // 4. Update all 25 district models with d3-scale-chromatic PGA colors, building footprint wavefronts & seismic shaking
      ANKARA_DISTRICTS.forEach((d) => {
        const node = districtNodes[d.id];
        const impact = st.impactsById[d.id];
        if (!node || !impact) return;

        const isSelected = d.id === st.selectedDistrictId;

        // Compute dynamic or static PGA for this district and map via d3-scale-chromatic
        const dynamicDistrictPga = st.isSimulating
          ? computeGridPointDynamicPGA(
              d.coords,
              st.activeFault.epicenter,
              st.magnitudeMw,
              st.depthKm,
              st.elapsedSec,
              true
            )
          : impact.pgaG;

        const normPga = normalizePgaForChromaticScale(dynamicDistrictPga);
        const d3ColorStr = interpolateYlOrRd(normPga);
        const [r, g, b] = parseChromaticColor(d3ColorStr);
        _colorScratch.setRGB(r / 255, g / 255, b / 255);

        // Tint building facade subtly while keeping realistic window texture crisp
        node.primaryMat.color.setRGB(
          0.55 + (r / 255) * 0.55,
          0.55 + (g / 255) * 0.5,
          0.6 + (b / 255) * 0.45
        );
        node.statusRingMat.color.copy(
          isSelected ? new THREE.Color(0x22d3ee) : _colorScratch
        );
        node.statusRing.scale.setScalar(
          (d.category === 'Metropol Çekirdek' ? 1.45 : 1.05) * (isSelected ? 1.38 : 1.08)
        );

        // 4b. 3D Wavefront Propagation through Building Footprints (Opacity-based intensity mapping)
        const pArrival = impact.pWaveArrivalSec;
        const sArrival = impact.sWaveArrivalSec;
        const isMetroCat = node.category === 'Metropol Çekirdek';
        const baseFootprintScale = isMetroCat ? 1.48 : 1.08;

        if (!st.isSimulating) {
          // Static / Post-Earthquake state: Footprint opacity directly visualizes permanent damage severity
          const damageFraction = Math.min(1, impact.compositeDamageScore / 100);
          const settledOpacity = 0.32 + damageFraction * 0.56;
          node.footprintPadMat.opacity = settledOpacity;
          node.footprintPadMat.color.copy(_colorScratch);
          node.footprintPad.scale.setScalar(baseFootprintScale * (1.0 + damageFraction * 0.22));
          node.footprintShockwaveMat.opacity = 0;
          node.plinthMat.emissive.copy(_colorScratch);
          node.plinthMat.emissiveIntensity = damageFraction * 0.28;
          node.statusRingMat.opacity = isSelected ? 1.0 : Math.max(0.45, damageFraction);
        } else {
          // Dynamic Wavefront Propagation Mode
          if (st.elapsedSec < pArrival) {
            // Zone 0: Ahead of seismic wavefront (Undisturbed calm footprint)
            node.footprintPadMat.opacity = 0.16;
            node.footprintPadMat.color.setHex(0x38bdf8);
            node.footprintPad.scale.setScalar(baseFootprintScale);
            node.footprintShockwaveMat.opacity = 0;
            node.plinthMat.emissive.setHex(0x000000);
            node.plinthMat.emissiveIntensity = 0;
            node.statusRingMat.opacity = isSelected ? 1.0 : 0.22;
          } else if (st.elapsedSec >= pArrival && st.elapsedSec < sArrival) {
            // Zone 1: P-Wave (Compressional Wavefront) arrives at building footprint
            // Rapid compressional vibration & warning opacity illumination
            const pSpan = Math.max(0.6, sArrival - pArrival);
            const pProgress = Math.min(1, Math.max(0, (st.elapsedSec - pArrival) / pSpan));
            const pPulse = 0.7 + 0.3 * Math.sin(elapsedTotal * 24 + d.coords.x);
            // Opacity swells as compressional energy moves through the building foundation
            const pOpacity = 0.30 + 0.38 * pProgress * pPulse;
            node.footprintPadMat.opacity = pOpacity;
            // Warm chromatic transition (cyan to warning gold)
            node.footprintPadMat.color.setRGB(
              0.22 + pProgress * 0.74,
              0.74 + pProgress * 0.18,
              0.96 - pProgress * 0.72
            );
            node.footprintPad.scale.setScalar(baseFootprintScale * (1.0 + pProgress * 0.14));
            node.footprintShockwaveMat.opacity = 0.42 * pProgress;
            node.footprintShockwaveMat.color.setHex(0xf59e0b);
            node.footprintShockwave.scale.setScalar(baseFootprintScale * (1.0 + pProgress * 0.2));
            node.plinthMat.emissive.setHex(0x38bdf8);
            node.plinthMat.emissiveIntensity = 0.25 * pProgress;
            node.statusRingMat.opacity = 0.55 * pProgress;
          } else {
            // Zone 2: S-Wave & Surface Wave (Destructive Shear Shockwave) impacts building footprint
            const timeSinceS = st.elapsedSec - sArrival;
            if (timeSinceS < 6.5) {
              // Active violent shear rupture through building footprint
              const sSurge = Math.exp(-timeSinceS / 3.2);
              // Opacity surges to peak thermal intensity (0.95+)
              node.footprintPadMat.opacity = Math.min(1.0, 0.62 + 0.36 * sSurge);
              node.footprintPadMat.color.copy(_colorScratch);
              // Shockwave ring visually expands outward through the footprint into adjacent city blocks
              const shockwaveScale = 1.0 + (timeSinceS / 6.5) * 1.35;
              node.footprintShockwave.scale.setScalar(baseFootprintScale * shockwaveScale);
              node.footprintShockwaveMat.opacity = Math.max(0, (1 - timeSinceS / 6.5) * 0.95);
              node.footprintShockwaveMat.color.copy(_colorScratch);
              node.footprintPad.scale.setScalar(baseFootprintScale * (1.1 + sSurge * 0.32));
              node.plinthMat.emissive.copy(_colorScratch);
              node.plinthMat.emissiveIntensity = 0.55 * sSurge;
              node.statusRingMat.opacity = 0.95;
            } else {
              // Post-Shockwave Damage Footprint: Shaking has passed, leaving permanent damage footprint
              const damageFraction = Math.min(1, impact.compositeDamageScore / 100);
              const settledOpacity = 0.32 + damageFraction * 0.58;
              node.footprintPadMat.opacity = settledOpacity;
              node.footprintPadMat.color.copy(_colorScratch);
              node.footprintPad.scale.setScalar(baseFootprintScale * (1.0 + damageFraction * 0.22));
              node.footprintShockwaveMat.opacity = 0;
              node.plinthMat.emissive.copy(_colorScratch);
              node.plinthMat.emissiveIntensity = damageFraction * 0.32;
              node.statusRingMat.opacity = isSelected ? 1.0 : Math.max(0.45, damageFraction);
            }
          }
        }

        // Update floating 3D label badge if present
        const lbl = labelSprites[d.id];
        if (lbl) {
          lbl.updateLabel(
            `${impact.pgaG.toFixed(2)}g`,
            d3ColorStr,
            isSelected
          );
        }

        // Instantaneous seismic ground shaking
        const motion = computeInstantaneousGroundMotion(impact, st.elapsedSec, st.isSimulating);
        if (motion.intensity > 0) {
          const shakeX = Math.sin(elapsedTotal * 34 + d.coords.x) * motion.intensity * 0.45;
          const shakeZ = Math.cos(elapsedTotal * 29 + d.coords.z) * motion.intensity * 0.45;
          const shakeY = Math.abs(Math.sin(elapsedTotal * 42)) * motion.intensity * 0.24;
          node.group.position.set(d.coords.x + shakeX, node.baseY + shakeY, d.coords.z + shakeZ);
          node.group.rotation.z = Math.sin(elapsedTotal * 26 + d.coords.x) * motion.intensity * 0.085;
        } else {
          node.group.position.set(d.coords.x, node.baseY, d.coords.z);
          node.group.rotation.z = 0;
        }
      });

      // 4c. Update surrounding urban skyline blocks as wavefront sweeps across the city
      if (st.isSimulating && urbanBlockCoords.length > 0) {
        for (let i = 0; i < urbanBlockCount; i++) {
          const b = urbanBlockCoords[i];
          if (!b) continue;
          const imp = st.impactsById[b.districtId];
          if (!imp) continue;
          const pArr = imp.pWaveArrivalSec;
          const sArr = imp.sWaveArrivalSec;

          if (st.elapsedSec < pArr) {
            _colorScratch.setRGB(0.52, 0.58, 0.68);
          } else if (st.elapsedSec < sArr) {
            _colorScratch.setRGB(0.85, 0.88, 0.58);
          } else {
            const timeSinceS = st.elapsedSec - sArr;
            if (timeSinceS < 5.0) {
              _colorScratch.setRGB(1.0, 0.65, 0.28);
            } else {
              const norm = normalizePgaForChromaticScale(imp.pgaG);
              const col = parseChromaticColor(interpolateYlOrRd(norm));
              _colorScratch.setRGB(
                0.4 + (col[0] / 255) * 0.6,
                0.4 + (col[1] / 255) * 0.55,
                0.45 + (col[2] / 255) * 0.5
              );
            }
          }
          urbanInstancedMesh.setColorAt(i, _colorScratch);
        }
        if (urbanInstancedMesh.instanceColor) {
          urbanInstancedMesh.instanceColor.needsUpdate = true;
        }
      }

      // 5. Smooth Camera Transitions
      if (st.cameraPreset !== lastCameraPreset) {
        lastCameraPreset = st.cameraPreset;
        isAutoMovingCam = true;
        if (st.cameraPreset === 'overview') {
          _targetCamPos.set(0, 52, 66);
          _targetLookAt.set(0, 0, 2);
        } else if (st.cameraPreset === 'metro_core') {
          _targetCamPos.set(4, 24, 22);
          _targetLookAt.set(2, 1, -2);
        } else if (st.cameraPreset === 'fault_top') {
          _targetCamPos.set(0, 88, 12);
          _targetLookAt.set(0, 0, 0);
        } else if (st.cameraPreset === 'west_industrial') {
          _targetCamPos.set(-28, 28, 24);
          _targetLookAt.set(-18, 1, -4);
        }
      } else if (st.selectedDistrictId && st.selectedDistrictId !== lastSelectedId) {
        lastSelectedId = st.selectedDistrictId;
        isAutoMovingCam = true;
        const sel = ANKARA_DISTRICTS.find((d) => d.id === st.selectedDistrictId);
        if (sel) {
          const gy = groundHeightAt(sel.coords.x, sel.coords.z);
          _targetLookAt.set(sel.coords.x, gy + 1.2, sel.coords.z);
          _targetCamPos.set(sel.coords.x + 14, gy + 22, sel.coords.z + 24);
        }
      }

      const dampAlpha = 1 - Math.exp(-3.5 * delta);
      controls.target.lerp(_targetLookAt, dampAlpha * 0.45);
      if (isAutoMovingCam) {
        camera.position.lerp(_targetCamPos, dampAlpha * 0.35);
        if (camera.position.distanceTo(_targetCamPos) < 0.6) {
          isAutoMovingCam = false;
        }
      }
      controls.update();

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      heatmapGeo.dispose();
      heatmapMat.dispose();
      hmTexture.dispose();
      textures.highRiseTex.dispose();
      textures.residentialTex.dispose();
      textures.terrainTex.dispose();
      textures.contactShadowTex.dispose();
      plinthGeo.dispose();
      waterTankGeo.dispose();
      coolingTowerGeo.dispose();
      gasPipeGeo.dispose();
      shadowPlaneGeo.dispose();
      ringGeo.dispose();
      footprintPadGeo.dispose();
      footprintShockwaveGeo.dispose();
      boxGeo.dispose();
      cylGeo.dispose();
      domeGeo.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      data-testid="ankara-3d-canvas"
      data-heatmap={showHeatmapOverlay ? 'active' : 'hidden'}
      className="fixed inset-0 w-screen h-screen overflow-hidden cursor-crosshair z-0"
      aria-label="Ankara 25 İlçe 3B Sismik ve PGA Isı Haritası Simülasyon Sahnesi"
    />
  );
}
