import type { Mutation, MutationType, Pathogenicity } from '@/types';
import { generateId } from './storage';
import { smithWaterman } from './sequenceAligner';

const PATHOGENIC_DATABASE: Record<string, { pathogenicity: Pathogenicity; gene?: string }> = {
  'BRCA1_175': { pathogenicity: 'pathogenic', gene: 'BRCA1' },
  'BRCA1_6174delT': { pathogenicity: 'pathogenic', gene: 'BRCA1' },
  'BRCA2_6174delT': { pathogenicity: 'pathogenic', gene: 'BRCA2' },
  'TP53_R175H': { pathogenicity: 'pathogenic', gene: 'TP53' },
  'TP53_G245D': { pathogenicity: 'likely-pathogenic', gene: 'TP53' },
  'KRAS_G12D': { pathogenicity: 'pathogenic', gene: 'KRAS' },
  'KRAS_G12V': { pathogenicity: 'pathogenic', gene: 'KRAS' },
  'EGFR_L858R': { pathogenicity: 'pathogenic', gene: 'EGFR' },
  'EGFR_del19': { pathogenicity: 'pathogenic', gene: 'EGFR' },
  'PIK3CA_H1047R': { pathogenicity: 'pathogenic', gene: 'PIK3CA' },
  'PIK3CA_E545K': { pathogenicity: 'likely-pathogenic', gene: 'PIK3CA' },
};

export function detectMutations(reference: string, sample: string): Mutation[] {
  const mutations: Mutation[] = [];
  const alignment = smithWaterman(reference, sample);
  if (!alignment) return mutations;

  let refPos = alignment.startPos1;
  let samplePos = alignment.startPos2;

  for (let i = 0; i < alignment.alignedSeq1.length; i++) {
    const r = alignment.alignedSeq1[i];
    const s = alignment.alignedSeq2[i];

    if (r !== s) {
      let type: MutationType;
      let refBase = r;
      let altBase = s;

      if (r === '-') {
        type = 'Ins';
        refBase = '-';
        altBase = s;
        samplePos++;
      } else if (s === '-') {
        type = 'Del';
        altBase = '-';
        refPos++;
      } else {
        type = 'SNP';
        refPos++;
        samplePos++;
      }

      const key = generateMutationKey(refBase, altBase, refPos);
      const dbHit = PATHOGENIC_DATABASE[key];
      
      mutations.push({
        id: generateId('mut_'),
        position: refPos,
        refBase: refBase.toUpperCase(),
        altBase: altBase.toUpperCase(),
        type,
        pathogenicity: dbHit?.pathogenicity ?? 'uncertain',
        gene: dbHit?.gene,
        validated: false,
      });
    } else {
      refPos++;
      samplePos++;
    }
  }

  return mergeAdjacentMutations(mutations);
}

function generateMutationKey(ref: string, alt: string, pos: number): string {
  return `${ref}${pos}${alt}`;
}

function mergeAdjacentMutations(mutations: Mutation[]): Mutation[] {
  const result: Mutation[] = [];
  let i = 0;

  while (i < mutations.length) {
    const current = mutations[i];
    
    if (current.type === 'Ins' || current.type === 'Del') {
      let merged = { ...current };
      let j = i + 1;
      while (j < mutations.length && mutations[j].type === current.type &&
             mutations[j].position <= merged.position + (merged.type === 'Del' ? merged.refBase.length : 1)) {
        if (merged.type === 'Del') {
          merged.refBase += mutations[j].refBase === '-' ? '' : mutations[j].refBase;
        } else {
          merged.altBase += mutations[j].altBase === '-' ? '' : mutations[j].altBase;
        }
        j++;
      }
      merged.type = merged.refBase.length > 1 && merged.altBase.length > 1 ? 'Indel' : merged.type;
      result.push(merged);
      i = j;
    } else {
      result.push(current);
      i++;
    }
  }

  return result;
}

export function filterMutations(
  mutations: Mutation[],
  filters: {
    types?: MutationType[];
    pathogenicity?: Pathogenicity[];
    positionRange?: [number, number];
    validated?: boolean;
    searchText?: string;
  }
): Mutation[] {
  return mutations.filter((m) => {
    if (filters.types && !filters.types.includes(m.type)) return false;
    if (filters.pathogenicity && !filters.pathogenicity.includes(m.pathogenicity)) return false;
    if (filters.positionRange) {
      if (m.position < filters.positionRange[0] || m.position > filters.positionRange[1]) return false;
    }
    if (filters.validated !== undefined && m.validated !== filters.validated) return false;
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase();
      return (
        m.refBase.toLowerCase().includes(q) ||
        m.altBase.toLowerCase().includes(q) ||
        m.position.toString().includes(q) ||
        (m.gene ?? '').toLowerCase().includes(q) ||
        (m.note ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function exportMutationsCSV(mutations: Mutation[]): string {
  const headers = ['Position', 'Type', 'Ref', 'Alt', 'Pathogenicity', 'Gene', 'Validated', 'DOI', 'Note'];
  const rows = mutations.map((m) => [
    m.position,
    m.type,
    m.refBase,
    m.altBase,
    m.pathogenicity,
    m.gene ?? '',
    m.validated ? 'Yes' : 'No',
    m.doi ?? '',
    (m.note ?? '').replace(/,/g, ';'),
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
