import type { SequenceData, SequenceFeature } from '@/types';
import { generateId } from './storage';

const COMPLEMENT_MAP: Record<string, string> = {
  A: 'T', T: 'A', C: 'G', G: 'C', N: 'N',
  a: 't', t: 'a', c: 'g', g: 'c', n: 'n',
};

export function parseFASTA(content: string): SequenceData[] {
  const sequences: SequenceData[] = [];
  const lines = content.trim().split(/\r?\n/);
  let currentName = '';
  let currentDesc = '';
  let currentSeq = '';

  for (const line of lines) {
    if (line.startsWith('>')) {
      if (currentName && currentSeq) {
        sequences.push(buildSequence(currentName, currentDesc, currentSeq, 'FASTA'));
      }
      const header = line.slice(1).trim();
      const spaceIdx = header.indexOf(' ');
      if (spaceIdx > 0) {
        currentName = header.slice(0, spaceIdx);
        currentDesc = header.slice(spaceIdx + 1);
      } else {
        currentName = header;
        currentDesc = '';
      }
      currentSeq = '';
    } else if (line.trim()) {
      currentSeq += line.trim().replace(/\s/g, '');
    }
  }

  if (currentName && currentSeq) {
    sequences.push(buildSequence(currentName, currentDesc, currentSeq, 'FASTA'));
  }

  return sequences;
}

export function parseGenBank(content: string): SequenceData[] {
  const sequences: SequenceData[] = [];
  const locusMatch = content.match(/LOCUS\s+(\S+)/);
  const name = locusMatch ? locusMatch[1] : 'Unknown';
  const defMatch = content.match(/DEFINITION\s+([\s\S]*?)\n\s*ACCESSION/);
  const description = defMatch ? defMatch[1].trim().replace(/\s+/g, ' ') : '';

  const features: SequenceFeature[] = [];
  const featureMatch = content.match(/FEATURES\s+Location\/Qualifiers([\s\S]*?)ORIGIN/);
  if (featureMatch) {
    const featureText = featureMatch[1];
    const featureRegex = /\s{5}(\w+)\s+([^\n]+(?:\n(?![\s]{5}\w)[^\n]+)*)/g;
    let fm: RegExpExecArray | null;
    while ((fm = featureRegex.exec(featureText)) !== null) {
      const type = fm[1];
      const locStr = fm[2].trim().split('\n')[0].trim();
      const locRange = parseGenBankLocation(locStr);
      if (locRange) {
        features.push({ type, start: locRange.start, end: locRange.end });
      }
    }
  }

  const originMatch = content.match(/ORIGIN([\s\S]*?)\/\//);
  if (originMatch) {
    const seq = originMatch[1].replace(/[\d\s/]/g, '').toUpperCase();
    sequences.push(buildSequence(name, description, seq, 'GenBank', features));
  }

  return sequences;
}

function parseGenBankLocation(loc: string): { start: number; end: number } | null {
  const m = loc.match(/(\d+)\.\.(\d+)/);
  if (m) {
    return { start: parseInt(m[1], 10) - 1, end: parseInt(m[2], 10) - 1 };
  }
  const single = loc.match(/^(\d+)$/);
  if (single) {
    const pos = parseInt(single[1], 10) - 1;
    return { start: pos, end: pos };
  }
  return null;
}

function buildSequence(
  name: string,
  description: string,
  sequence: string,
  format: 'FASTA' | 'GenBank',
  features?: SequenceFeature[]
): SequenceData {
  const cleanSeq = sequence.toUpperCase().replace(/[^ATCGN]/g, 'N');
  return {
    id: generateId('seq_'),
    name,
    description,
    sequence: cleanSeq,
    format,
    length: cleanSeq.length,
    features,
  };
}

export function parseSequenceFile(content: string, filename: string): SequenceData[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.gb') || lower.endsWith('.gbk') || lower.endsWith('.genbank')) {
    return parseGenBank(content);
  }
  return parseFASTA(content);
}

export function complement(seq: string): string {
  let result = '';
  for (let i = 0; i < seq.length; i++) {
    result += COMPLEMENT_MAP[seq[i]] ?? 'N';
  }
  return result;
}

export function reverseComplement(seq: string): string {
  return complement(seq).split('').reverse().join('');
}

export function translateToAminoAcid(seq: string): string {
  const codonTable: Record<string, string> = {
    TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
    TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
    TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
    TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
    CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
    CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
    CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
    CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
    ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
    ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
    AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
    AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
    GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
    GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
    GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
    GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
  };

  let result = '';
  for (let i = 0; i <= seq.length - 3; i += 3) {
    const codon = seq.slice(i, i + 3);
    result += codonTable[codon] ?? 'X';
  }
  return result;
}

export function gcContent(seq: string): number {
  if (seq.length === 0) return 0;
  let gc = 0;
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (c === 'G' || c === 'C' || c === 'g' || c === 'c') gc++;
  }
  return (gc / seq.length) * 100;
}

export function sequenceSearch(seq: string, query: string): number[] {
  if (!query || query.length < 2) return [];
  const q = query.toUpperCase().replace(/[^ATCGN]/g, '');
  if (q.length < 2) return [];
  const results: number[] = [];
  let idx = 0;
  while ((idx = seq.indexOf(q, idx)) !== -1) {
    results.push(idx);
    idx += 1;
  }
  return results;
}
