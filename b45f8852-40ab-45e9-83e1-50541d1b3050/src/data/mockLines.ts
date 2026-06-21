import type { TransmissionLine, Substation, VoltageLevel } from '@/types';
import { substations } from './mockSubstations';

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seedRandom(99999);

function randomInRange(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomInRangeFloat(min: number, max: number): number {
  return Math.round((rand() * (max - min) + min) * 10) / 10;
}

function calcDistance(a: Substation, b: Substation): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function groupByRegion<T extends Substation>(subs: T[]): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const s of subs) {
    if (!result[s.region]) result[s.region] = [];
    result[s.region].push(s);
  }
  return result;
}

function findNearest(
  target: Substation,
  pool: Substation[],
  excludeIds: Set<string>
): Substation | null {
  let best: Substation | null = null;
  let bestDist = Infinity;
  for (const s of pool) {
    if (excludeIds.has(s.id)) continue;
    const d = calcDistance(target, s);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

function findTopKNearest(
  target: Substation,
  pool: Substation[],
  excludeIds: Set<string>,
  k: number
): Substation[] {
  const candidates = pool
    .filter((s) => !excludeIds.has(s.id) && s.id !== target.id)
    .map((s) => ({ s, d: calcDistance(target, s) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  return candidates.map((c) => c.s);
}

function generateLines(): TransmissionLine[] {
  const lines: TransmissionLine[] = [];
  let id500 = 0;
  let id220 = 0;
  let id110 = 0;

  const subs500 = substations.filter((s) => s.voltageLevel === '500kV');
  const subs220 = substations.filter((s) => s.voltageLevel === '220kV');
  const subs110 = substations.filter((s) => s.voltageLevel === '110kV');

  const byRegion500 = groupByRegion(subs500);
  const byRegion220 = groupByRegion(subs220);
  const byRegion110 = groupByRegion(subs110);

  const regions = ['东区', '南区', '西区', '北区', '中区'];
  const usedPairs = new Set<string>();

  function pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function addLine(
    from: Substation,
    to: Substation,
    vl: VoltageLevel,
    length?: number
  ): TransmissionLine | null {
    if (from.id === to.id) return null;
    const pk = pairKey(from.id, to.id);
    if (usedPairs.has(pk)) return null;
    usedPairs.add(pk);

    let lineId: string;
    if (vl === '500kV') {
      id500++;
      lineId = `line-500-${String(id500).padStart(3, '0')}`;
    } else if (vl === '220kV') {
      id220++;
      lineId = `line-220-${String(id220).padStart(3, '0')}`;
    } else {
      id110++;
      lineId = `line-110-${String(id110).padStart(3, '0')}`;
    }

    const km =
      length !== undefined
        ? length
        : Math.max(
            vl === '500kV' ? 15 : vl === '220kV' ? 8 : 5,
            Math.min(
              vl === '500kV' ? 120 : vl === '220kV' ? 80 : 40,
              Math.round((calcDistance(from, to) / 10) * 10) / 10 +
                randomInRangeFloat(0, 10)
            )
          );

    return {
      id: lineId,
      name: `${from.name.split('kV')[0]}-${to.name.split('kV')[0]}${
        vl === '500kV' ? 'I线' : vl === '220kV' ? '联络线' : '馈线'
      }`,
      fromStationId: from.id,
      toStationId: to.id,
      lengthKm: km,
      voltageLevel: vl,
    };
  }

  function tryPush(line: TransmissionLine | null) {
    if (line) lines.push(line);
  }

  // ========== 500kV互联: 精确40条 ==========
  const TARGET_500 = 40;
  // 区域内环形 + 最近邻
  for (const region of regions) {
    const r500 = byRegion500[region] || [];
    if (r500.length >= 2) {
      for (let i = 0; i < r500.length; i++) {
        if (lines.filter((l) => l.voltageLevel === '500kV').length >= TARGET_500) break;
        const next = (i + 1) % r500.length;
        tryPush(addLine(r500[i], r500[next], '500kV'));
      }
      // 最近邻补充
      for (let i = 0; i < r500.length; i++) {
        if (lines.filter((l) => l.voltageLevel === '500kV').length >= TARGET_500) break;
        const near = findNearest(r500[i], r500, new Set([r500[i].id]));
        if (near) tryPush(addLine(r500[i], near, '500kV'));
      }
    }
  }

  // 跨区域主干连接
  const regionReps = regions
    .map((r) => (byRegion500[r] && byRegion500[r].length > 0 ? byRegion500[r][0] : null))
    .filter((x): x is Substation => x !== null);
  for (let i = 0; i < regionReps.length; i++) {
    if (lines.filter((l) => l.voltageLevel === '500kV').length >= TARGET_500) break;
    const next = (i + 1) % regionReps.length;
    tryPush(addLine(regionReps[i], regionReps[next], '500kV'));
  }

  // 随机补充到40
  let attempts = 0;
  while (
    lines.filter((l) => l.voltageLevel === '500kV').length < TARGET_500 &&
    attempts < 500
  ) {
    attempts++;
    const i = randomInRange(0, subs500.length - 1);
    const j = randomInRange(0, subs500.length - 1);
    if (i === j) continue;
    tryPush(addLine(subs500[i], subs500[j], '500kV'));
  }

  // ========== 500kV→220kV: 精确100条 ==========
  const TARGET_500_220 = 100;
  const linesBefore500_220 = lines.filter(
    (l) => l.voltageLevel === '220kV'
  ).length;

  const connected220 = new Set<string>();

  // 首先区域内就近连接，确保覆盖所有220kV站
  for (const region of regions) {
    const r500 = byRegion500[region] || [];
    const r220 = byRegion220[region] || [];
    if (r500.length === 0 || r220.length === 0) continue;
    for (const s220 of r220) {
      if (
        lines.filter((l) => l.voltageLevel === '220kV').length -
          linesBefore500_220 >=
        TARGET_500_220
      )
        break;
      const near = findNearest(s220, r500, new Set());
      if (near) {
        const line = addLine(near, s220, '220kV');
        if (line) {
          lines.push(line);
          connected220.add(s220.id);
        }
      }
    }
  }

  // 覆盖剩下没连上的220kV (跨区域)
  for (const s220 of subs220) {
    if (connected220.has(s220.id)) continue;
    if (
      lines.filter((l) => l.voltageLevel === '220kV').length -
        linesBefore500_220 >=
      TARGET_500_220
    )
      break;
    const near = findNearest(s220, subs500, new Set());
    if (near) {
      const line = addLine(near, s220, '220kV');
      if (line) {
        lines.push(line);
        connected220.add(s220.id);
      }
    }
  }

  // 剩余名额随机冗余连接
  attempts = 0;
  while (
    lines.filter((l) => l.voltageLevel === '220kV').length - linesBefore500_220 <
      TARGET_500_220 &&
    attempts < 1000
  ) {
    attempts++;
    const s220 = subs220[randomInRange(0, subs220.length - 1)];
    const s500 = subs500[randomInRange(0, subs500.length - 1)];
    tryPush(addLine(s500, s220, '220kV'));
  }

  // ========== 220kV互联: 精确80条 ==========
  const TARGET_220_INTER = 80;
  const linesBefore220Inter = lines.filter(
    (l) => l.voltageLevel === '220kV'
  ).length;

  // 区域内top2最近邻
  for (const region of regions) {
    const r220 = byRegion220[region] || [];
    if (r220.length < 2) continue;
    for (let i = 0; i < r220.length; i++) {
      if (
        lines.filter((l) => l.voltageLevel === '220kV').length -
          linesBefore220Inter >=
        TARGET_220_INTER
      )
        break;
      const tops = findTopKNearest(r220[i], r220, new Set([r220[i].id]), 2);
      for (const t of tops) {
        if (
          lines.filter((l) => l.voltageLevel === '220kV').length -
            linesBefore220Inter >=
          TARGET_220_INTER
        )
          break;
        tryPush(addLine(r220[i], t, '220kV'));
      }
    }
  }

  // 跨区域随机补充
  attempts = 0;
  while (
    lines.filter((l) => l.voltageLevel === '220kV').length -
      linesBefore220Inter <
      TARGET_220_INTER &&
    attempts < 800
  ) {
    attempts++;
    const i = randomInRange(0, subs220.length - 1);
    const j = randomInRange(0, subs220.length - 1);
    if (i === j) continue;
    tryPush(addLine(subs220[i], subs220[j], '220kV'));
  }

  // ========== 220kV→110kV: 精确180条 ==========
  const TARGET_220_110 = 180;
  const linesBefore220_110 = lines.filter(
    (l) => l.voltageLevel === '110kV'
  ).length;

  // 区域内按配额分配
  for (const region of regions) {
    const r220 = byRegion220[region] || [];
    const r110 = byRegion110[region] || [];
    if (r220.length === 0 || r110.length === 0) continue;
    const quota = Math.round((TARGET_220_110 / subs110.length) * r110.length);
    let assigned = 0;
    for (const s110 of r110) {
      if (assigned >= quota) break;
      if (
        lines.filter((l) => l.voltageLevel === '110kV').length -
          linesBefore220_110 >=
        TARGET_220_110
      )
        break;
      const tops = findTopKNearest(s110, r220, new Set(), 1);
      for (const t of tops) {
        const line = addLine(t, s110, '110kV');
        if (line) {
          lines.push(line);
          assigned++;
          break;
        }
      }
    }
  }

  // 补充到180
  attempts = 0;
  while (
    lines.filter((l) => l.voltageLevel === '110kV').length -
      linesBefore220_110 <
      TARGET_220_110 &&
    attempts < 1500
  ) {
    attempts++;
    const s220 = subs220[randomInRange(0, subs220.length - 1)];
    const s110 = subs110[randomInRange(0, subs110.length - 1)];
    tryPush(addLine(s220, s110, '110kV'));
  }

  return lines;
}

export const lines: TransmissionLine[] = generateLines();
export const mockLines: TransmissionLine[] = lines;
