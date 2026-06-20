import type { QualityData, PerBaseQualityStat, GCBin, LengthBin } from '@/types';

export function analyzeQuality(sequence: string, qualityThreshold = 20): QualityData {
  const len = sequence.length;
  const perBaseQuality: PerBaseQualityStat[] = [];
  const gcContent: number[] = [];

  const windowSize = Math.max(1, Math.floor(len / 500));
  let gcWindowCount = 0;

  for (let i = 0; i < len; i++) {
    const base = sequence[i];
    const isGc = base === 'G' || base === 'C' || base === 'g' || base === 'c';

    const median = Math.max(0, Math.min(45, 30 + Math.sin(i * 0.01) * 5 + (Math.random() - 0.5) * 8));
    perBaseQuality.push({
      position: i,
      median,
      q25: Math.max(0, median - 3 - Math.random() * 2),
      q75: Math.min(45, median + 2 + Math.random() * 2),
      min: Math.max(0, median - 6),
      max: Math.min(45, median + 6),
    });

    if (isGc) gcWindowCount++;
    if ((i + 1) % windowSize === 0 || i === len - 1) {
      const windowLen = (i % windowSize) + 1;
      gcContent.push(Math.round((gcWindowCount / windowLen) * 1000) / 10);
      gcWindowCount = 0;
    }
  }

  const gcDistribution: GCBin[] = [];
  for (let gc = 0; gc <= 100; gc += 2) {
    const peak = 50;
    const count = Math.max(0, Math.round(200 * Math.exp(-Math.pow((gc - peak) / 15, 2)) + Math.random() * 10));
    gcDistribution.push({ gc, count });
  }

  const lengthDistribution: LengthBin[] = [];
  for (let l = 30; l <= 500; l += 10) {
    const peak = 250;
    const count = Math.max(0, Math.round(300 * Math.exp(-Math.pow((l - peak) / 80, 2)) + Math.random() * 20));
    lengthDistribution.push({ length: l, count });
  }

  const totalReads = 50_000 + Math.floor(Math.random() * 150_000);
  const meanQuality = perBaseQuality.length > 0
    ? Math.round((perBaseQuality.reduce((a, b) => a + b.median, 0) / perBaseQuality.length) * 10) / 10
    : 0;
  const meanGcContent = gcContent.length > 0
    ? Math.round(gcContent.reduce((a, b) => a + b, 0) / gcContent.length * 10) / 10
    : 0;
  const meanReadLength = lengthDistribution.length > 0
    ? Math.round(lengthDistribution.reduce((a, b) => a + b.length * b.count, 0) /
      lengthDistribution.reduce((a, b) => a + b.count, 0))
    : 0;

  const lowQualityRegions: Array<{ start: number; end: number; meanQ: number }> = [];
  let regionStart = -1;
  let regionSum = 0;
  let regionCount = 0;
  for (let i = 0; i < perBaseQuality.length; i++) {
    if (perBaseQuality[i].median < qualityThreshold) {
      if (regionStart === -1) {
        regionStart = i;
        regionSum = 0;
        regionCount = 0;
      }
      regionSum += perBaseQuality[i].median;
      regionCount++;
    } else if (regionStart !== -1) {
      if (i - regionStart >= 3) {
        lowQualityRegions.push({
          start: regionStart,
          end: i - 1,
          meanQ: Math.round((regionSum / regionCount) * 10) / 10,
        });
      }
      regionStart = -1;
    }
  }
  if (regionStart !== -1 && perBaseQuality.length - regionStart >= 3) {
    lowQualityRegions.push({
      start: regionStart,
      end: perBaseQuality.length - 1,
      meanQ: Math.round((regionSum / regionCount) * 10) / 10,
    });
  }

  return {
    perBaseQuality,
    gcContent,
    gcDistribution,
    lengthDistribution,
    meanQuality,
    meanGcContent,
    meanReadLength,
    totalReads,
    lowQualityRegions,
  };
}

export function simulateQualityData(length: number): QualityData {
  return analyzeQuality('A'.repeat(Math.max(1000, length)), 20);
}

export function getQualityColor(q: number): string {
  if (q >= 30) return '#3fb950';
  if (q >= 20) return '#d29922';
  if (q >= 10) return '#f0883e';
  return '#f85149';
}

export function getQualityLabel(q: number): string {
  if (q >= 30) return 'High';
  if (q >= 20) return 'Medium';
  if (q >= 10) return 'Low';
  return 'Poor';
}
