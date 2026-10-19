import { NextRequest, NextResponse } from 'next/server';
import { HAZMAT_COMPOUNDS } from '@/lib/ankara-data';

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  baseDelayMs = 450
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const delay =
        !Number.isNaN(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const errorBody = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} from ${url}: ${errorBody.slice(0, 200)}`);
  }
  throw new Error(`Exhausted retries for ${url}`);
}

export interface PubChemCompoundProfile {
  cid: number;
  nameTr: string;
  nameEn: string;
  iupacName: string;
  molecularFormula: string;
  molecularWeight: string;
  canonicalSmiles: string;
  inchiKey: string;
  tpsa: number;
  heavyAtomCount: number;
  complexity: number;
  charge: number;
  image2dUrl: string;
  pubchemRecordUrl: string;
  infrastructureSource: string;
  affectedDistrictsSummary: string;
  seismicHazardMechanism: string;
  ghsSignal: string;
  provenanceBadge: string;
  isLivePubChem: boolean;
}

const FALLBACK_PROFILES: Record<number, Partial<PubChemCompoundProfile>> = {
  297: {
    iupacName: 'methane',
    molecularFormula: 'CH4',
    molecularWeight: '16.043 g/mol',
    canonicalSmiles: 'C',
    inchiKey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
    tpsa: 0,
    heavyAtomCount: 1,
    complexity: 0,
    charge: 0,
  },
  14828: {
    iupacName: 'dioxosilane (Silicate / Asbestos Matrix)',
    molecularFormula: 'O2Si',
    molecularWeight: '60.08 g/mol',
    canonicalSmiles: 'O=[Si]=O',
    inchiKey: 'VYPSYNLAJGMNEJ-UHFFFAOYSA-N',
    tpsa: 34.1,
    heavyAtomCount: 3,
    complexity: 18.3,
    charge: 0,
  },
  402: {
    iupacName: 'sulfane (hydrogen sulfide)',
    molecularFormula: 'H2S',
    molecularWeight: '34.08 g/mol',
    canonicalSmiles: 'S',
    inchiKey: 'RWSOTUBLDIXVET-UHFFFAOYSA-N',
    tpsa: 0,
    heavyAtomCount: 1,
    complexity: 0,
    charge: 0,
  },
  6334: {
    iupacName: 'propane',
    molecularFormula: 'C3H8',
    molecularWeight: '44.10 g/mol',
    canonicalSmiles: 'CCC',
    inchiKey: 'ATUOYWHBWRKTHZ-UHFFFAOYSA-N',
    tpsa: 0,
    heavyAtomCount: 3,
    complexity: 0,
    charge: 0,
  },
  10340: {
    iupacName: 'disodium carbonate (Soda Ash / Trona)',
    molecularFormula: 'CNa2O3',
    molecularWeight: '105.99 g/mol',
    canonicalSmiles: '[C-]#[O+].[O-]C(=O)[O-].[Na+].[Na+]',
    inchiKey: 'CDBYLPFSWZWCQE-UHFFFAOYSA-L',
    tpsa: 63.2,
    heavyAtomCount: 6,
    complexity: 18.8,
    charge: 0,
  },
  5359596: {
    iupacName: 'arsenic',
    molecularFormula: 'As',
    molecularWeight: '74.9216 g/mol',
    canonicalSmiles: '[As]',
    inchiKey: 'RQNWIZPPADIBDY-UHFFFAOYSA-N',
    tpsa: 0,
    heavyAtomCount: 1,
    complexity: 0,
    charge: 0,
  },
};

export async function GET(req: NextRequest) {
  const cidParam = Number(req.nextUrl.searchParams.get('cid') || '297');
  const preset = HAZMAT_COMPOUNDS.find((c) => c.cid === cidParam) || HAZMAT_COMPOUNDS[0];
  const cid = preset.cid;

  const pugRestUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/Title,IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey,TPSA,HeavyAtomCount,Complexity,Charge/JSON`;

  try {
    const res = await fetchWithRetry(pugRestUrl, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    const prop = data?.PropertyTable?.Properties?.[0] || {};
    const fb = FALLBACK_PROFILES[cid] || {};

    const profile: PubChemCompoundProfile = {
      cid,
      nameTr: preset.nameTr,
      nameEn: preset.nameEn,
      iupacName: prop.IUPACName || fb.iupacName || preset.nameEn,
      molecularFormula: prop.MolecularFormula || fb.molecularFormula || preset.formulaFallback,
      molecularWeight: prop.MolecularWeight ? `${prop.MolecularWeight} g/mol` : fb.molecularWeight || 'N/A',
      canonicalSmiles: prop.CanonicalSMILES || fb.canonicalSmiles || '',
      inchiKey: prop.InChIKey || fb.inchiKey || '',
      tpsa: typeof prop.TPSA === 'number' ? prop.TPSA : fb.tpsa || 0,
      heavyAtomCount: typeof prop.HeavyAtomCount === 'number' ? prop.HeavyAtomCount : fb.heavyAtomCount || 1,
      complexity: typeof prop.Complexity === 'number' ? prop.Complexity : fb.complexity || 0,
      charge: typeof prop.Charge === 'number' ? prop.Charge : fb.charge || 0,
      image2dUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=large`,
      pubchemRecordUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      infrastructureSource: preset.infrastructureSource,
      affectedDistrictsSummary: preset.affectedDistrictsSummary,
      seismicHazardMechanism: preset.seismicHazardMechanism,
      ghsSignal: preset.ghsSignal,
      provenanceBadge: 'PubChem PUG-REST [Experimentally determined]',
      isLivePubChem: true,
    };

    return NextResponse.json(profile);
  } catch {
    const fb = FALLBACK_PROFILES[cid] || {};
    const fallbackProfile: PubChemCompoundProfile = {
      cid,
      nameTr: preset.nameTr,
      nameEn: preset.nameEn,
      iupacName: fb.iupacName || preset.nameEn,
      molecularFormula: fb.molecularFormula || preset.formulaFallback,
      molecularWeight: fb.molecularWeight || 'N/A',
      canonicalSmiles: fb.canonicalSmiles || '',
      inchiKey: fb.inchiKey || '',
      tpsa: fb.tpsa || 0,
      heavyAtomCount: fb.heavyAtomCount || 1,
      complexity: fb.complexity || 0,
      charge: fb.charge || 0,
      image2dUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=large`,
      pubchemRecordUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      infrastructureSource: preset.infrastructureSource,
      affectedDistrictsSummary: preset.affectedDistrictsSummary,
      seismicHazardMechanism: preset.seismicHazardMechanism,
      ghsSignal: preset.ghsSignal,
      provenanceBadge: 'PubChem PUG-REST [Curated Reference]',
      isLivePubChem: false,
    };
    return NextResponse.json(fallbackProfile);
  }
}
