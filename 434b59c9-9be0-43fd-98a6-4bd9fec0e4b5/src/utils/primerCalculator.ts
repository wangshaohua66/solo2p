import type { Primer, PrimerDirection, PrimerConfigParams } from '@/types';
import { gcContent, reverseComplement } from './sequenceParser';
import { generateId } from './storage';

export { gcContent };

const SALT_CONCENTRATION = 50;
const OLIGO_CONCENTRATION = 0.2;

export function calculateTm(seq: string): number {
  if (seq.length === 0) return 0;

  let gc = 0;
  let at = 0;
  for (const c of seq) {
    if (c === 'G' || c === 'C' || c === 'g' || c === 'c') gc++;
    else if (c === 'A' || c === 'T' || c === 'a' || c === 't') at++;
  }

  if (seq.length <= 14) {
    return 2 * at + 4 * gc;
  }

  const gcPct = (gc / seq.length) * 100;
  const tm = 64.9 + 0.41 * gcPct - 500 / seq.length +
    16.6 * Math.log10(SALT_CONCENTRATION / 1000);
  return Math.round(tm * 10) / 10;
}

export function calculateHairpinTm(seq: string): number {
  const rc = reverseComplement(seq);
  let maxMatch = 0;
  const n = seq.length;

  for (let offset = -n + 1; offset < n; offset++) {
    let matches = 0;
    for (let i = 0; i < n; i++) {
      const j = i + offset;
      if (j >= 0 && j < n && i < n - offset && seq[i] === rc[j]) {
        matches++;
      }
    }
    maxMatch = Math.max(maxMatch, matches);
  }

  if (maxMatch < 4) return 0;
  return Math.round((maxMatch * 2) * 10) / 10;
}

export function calculateSelfDimerTm(seq: string): number {
  const rc = reverseComplement(seq);
  let maxRun = 0;
  let currentRun = 0;

  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === rc[i]) {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  if (maxRun < 4) return 0;
  return Math.round((maxRun * 2.5) * 10) / 10;
}

export function designPrimers(
  template: string,
  targetStart: number,
  targetEnd: number,
  config: PrimerConfigParams
): { forward: Primer[]; reverse: Primer[] } {
  const forward: Primer[] = [];
  const reverse: Primer[] = [];

  if (!template || targetEnd <= targetStart) return { forward, reverse };

  const targetSize = targetEnd - targetStart;
  const productMin = Math.min(config.productSizeMin, targetSize);
  const productMax = Math.max(config.productSizeMax, targetSize + 100);

  for (let len = config.primerLengthMin; len <= config.primerLengthMax; len++) {
    for (let start = Math.max(0, targetStart - productMax + len); start <= targetStart; start++) {
      const end = start + len;
      if (end > template.length) break;
      const seq = template.slice(start, end);
      const tm = calculateTm(seq);
      const gc = gcContent(seq);
      const productSize = targetEnd - start;

      if (
        tm >= config.tmMin && tm <= config.tmMax &&
        gc >= config.gcMin && gc <= config.gcMax &&
        productSize >= productMin && productSize <= productMax
      ) {
        const warnings: string[] = [];
        const hairpinTm = calculateHairpinTm(seq);
        const selfDimerTm = calculateSelfDimerTm(seq);
        const gcValue = Math.round(gc * 10) / 10;
        let penalty = 0;
        penalty += Math.abs(tm - (config.tmMin + config.tmMax) / 2);
        penalty += Math.abs(gcValue - 50) * 0.3;

        if (config.checkHairpin && hairpinTm > 40) {
          warnings.push(`发夹结构 Tm ${hairpinTm}°C 过高`);
          penalty += 5;
        }
        if (config.checkDimer && selfDimerTm > 35) {
          warnings.push(`自二聚体 Tm ${selfDimerTm}°C 过高`);
          penalty += 5;
        }
        if (seq.endsWith('A') || seq.endsWith('T')) {
          penalty += 1;
          if (config.checkThreePrimeSpecificity) {
            warnings.push('3\'端为 A/T，特异性较低');
          }
        }
        const passFilter = warnings.length === 0;

        forward.push({
          id: generateId('primer_'),
          name: `F${forward.length + 1}`,
          direction: 'forward',
          sequence: seq,
          start,
          end: end,
          length: len,
          tm,
          gcContent: gcValue,
          productSize,
          hairpinTm,
          selfDimerTm,
          penalty: Math.round(penalty * 100) / 100,
          passFilter,
          warnings: warnings.length > 0 ? warnings : undefined,
        });
      }
    }
  }

  const rcTemplate = reverseComplement(template);
  const templateLen = template.length;

  for (let len = config.primerLengthMin; len <= config.primerLengthMax; len++) {
    for (let rcStart = Math.max(0, templateLen - targetEnd - productMax + len);
         rcStart <= templateLen - targetEnd;
         rcStart++) {
      const rcEnd = rcStart + len;
      if (rcEnd > rcTemplate.length) break;
      const seq = rcTemplate.slice(rcStart, rcEnd);
      const tm = calculateTm(seq);
      const gc = gcContent(seq);
      const fwdStart = templateLen - rcEnd;
      const productSize = targetEnd - fwdStart;

      if (
        tm >= config.tmMin && tm <= config.tmMax &&
        gc >= config.gcMin && gc <= config.gcMax &&
        productSize >= productMin && productSize <= productMax
      ) {
        const warnings: string[] = [];
        const hairpinTm = calculateHairpinTm(seq);
        const selfDimerTm = calculateSelfDimerTm(seq);
        const gcValue = Math.round(gc * 10) / 10;
        let penalty = 0;
        penalty += Math.abs(tm - (config.tmMin + config.tmMax) / 2);
        penalty += Math.abs(gcValue - 50) * 0.3;

        if (config.checkHairpin && hairpinTm > 40) {
          warnings.push(`发夹结构 Tm ${hairpinTm}°C 过高`);
          penalty += 5;
        }
        if (config.checkDimer && selfDimerTm > 35) {
          warnings.push(`自二聚体 Tm ${selfDimerTm}°C 过高`);
          penalty += 5;
        }
        if (seq.endsWith('A') || seq.endsWith('T')) {
          penalty += 1;
          if (config.checkThreePrimeSpecificity) {
            warnings.push('3\'端为 A/T，特异性较低');
          }
        }
        const passFilter = warnings.length === 0;

        reverse.push({
          id: generateId('primer_'),
          name: `R${reverse.length + 1}`,
          direction: 'reverse' as PrimerDirection,
          sequence: seq,
          start: templateLen - rcEnd,
          end: templateLen - rcStart,
          length: len,
          tm,
          gcContent: gcValue,
          productSize,
          hairpinTm,
          selfDimerTm,
          penalty: Math.round(penalty * 100) / 100,
          passFilter,
          warnings: warnings.length > 0 ? warnings : undefined,
        });
      }
    }
  }

  forward.sort((a, b) => Math.abs(a.tm - (config.tmMin + config.tmMax) / 2) -
                          Math.abs(b.tm - (config.tmMin + config.tmMax) / 2));
  reverse.sort((a, b) => Math.abs(a.tm - (config.tmMin + config.tmMax) / 2) -
                          Math.abs(b.tm - (config.tmMin + config.tmMax) / 2));

  return { forward: forward.slice(0, 10), reverse: reverse.slice(0, 10) };
}

export function exportPrimersCSV(primers: Primer[]): string {
  const headers = ['Name', 'Direction', 'Sequence', 'Start', 'Length', 'Tm', 'GC%', 'Product Size'];
  const rows = primers.map((p) => [
    p.name,
    p.direction,
    p.sequence,
    p.start,
    p.length,
    p.tm,
    p.gcContent,
    p.productSize ?? '',
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generatePrimerOrderForm(primers: Primer[]): string {
  const lines = [
    '# Primer Order Form',
    `# Generated: ${new Date().toISOString()}`,
    '# Name\tSequence\tScale\tPurification',
    '',
  ];

  for (const p of primers) {
    lines.push(`${p.name}\t${p.sequence}\t25nmole\tSTD`);
  }

  return lines.join('\n');
}
