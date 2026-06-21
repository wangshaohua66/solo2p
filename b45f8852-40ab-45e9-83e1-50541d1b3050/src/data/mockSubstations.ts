import type { Substation, VoltageLevel } from '@/types';

const REGIONS = ['东区', '南区', '西区', '北区', '中区'] as const;

const REGION_CENTERS: Record<string, { cx: number; cy: number }> = {
  北区: { cx: 225, cy: 150 },
  东区: { cx: 1000, cy: 325 },
  南区: { cx: 600, cy: 600 },
  西区: { cx: 225, cy: 500 },
  中区: { cx: 600, cy: 375 },
};

const REGION_RANGES: Record<string, { xMin: number; xMax: number; yMin: number; yMax: number }> = {
  北区: { xMin: 50, xMax: 400, yMin: 50, yMax: 250 },
  东区: { xMin: 800, xMax: 1200, yMin: 200, yMax: 450 },
  南区: { xMin: 400, xMax: 800, yMin: 500, yMax: 700 },
  西区: { xMin: 50, xMax: 400, yMin: 350, yMax: 650 },
  中区: { xMin: 400, xMax: 800, yMin: 250, yMax: 500 },
};

const NAME_500KV_PREFIXES = [
  '江北源', '江南源', '城东源', '城西源', '城北源', '城南源',
  '中原源', '东海源', '西湖源', '南山源', '北辰源', '紫金山源',
  '玄武源', '青龙源', '白虎源', '朱雀源', '麒麟源', '凤凰源',
  '卧龙源', '蟠龙源', '天柱源', '地脉源', '星辰源', '日月源',
  '云河源', '雷霆源', '风雨源', '彩虹源',
];

const NAME_220KV_PREFIXES = [
  '科技', '工业', '金融', '商贸', '物流', '文化', '教育', '医疗',
  '政务', '体育', '会展', '空港', '高铁', '地铁', '滨江', '湖滨',
  '山林', '田园', '新城', '古城', '东郊', '西郊', '南郊', '北郊',
  '中原', '东方', '西方', '南方', '北方', '中央', '紫金', '玄武',
  '鼓楼', '秦淮', '建邺', '雨花', '栖霞', '江宁', '浦口', '六合',
  '溧水', '高淳', '滨江', '九龙', '仙林', '麒麟', '板桥', '滨江',
  '江心', '八卦', '燕子', '幕府', '雨花台', '红山', '白马', '古林',
  '清凉', '乌龙', '莫愁', '玄武', '月牙', '梅花', '樱花', '桂花',
  '雪松', '水杉', '银杏', '梧桐', '垂柳', '香樟', '玉兰', '海棠',
  '牡丹', '芍药', '月季', '迎春', '连翘', '紫荆', '紫薇', '木槿',
];

const NAME_110KV_PREFIXES = [
  '华兴', '华盛', '华茂', '华达', '华信', '华诚', '华瑞', '华丰',
  '恒泰', '恒盛', '恒达', '恒信', '恒瑞', '恒丰', '恒诚', '恒茂',
  '永泰', '永兴', '永盛', '永达', '永信', '永诚', '永瑞', '永丰',
  '安泰', '安盛', '安达', '安信', '安诚', '安瑞', '安丰', '安茂',
  '正泰', '正盛', '正达', '正信', '正诚', '正瑞', '正丰', '正茂',
  '宏泰', '宏盛', '宏达', '宏信', '宏诚', '宏瑞', '宏丰', '宏茂',
  '博泰', '博盛', '博达', '博信', '博诚', '博瑞', '博丰', '博茂',
  '锦泰', '锦盛', '锦达', '锦信', '锦诚', '锦瑞', '锦丰', '锦茂',
  '金泰', '金盛', '金达', '金信', '金诚', '金瑞', '金丰', '金茂',
  '银泰', '银盛', '银达', '银信', '银诚', '银瑞', '银丰', '银茂',
  '瑞泰', '瑞盛', '瑞达', '瑞信', '瑞诚', '瑞丰', '瑞茂', '瑞安',
  '兴泰', '兴盛', '兴达', '兴信', '兴诚', '兴瑞', '兴丰', '兴茂',
  '顺泰', '顺盛', '顺达', '顺信', '顺诚', '顺瑞', '顺丰', '顺茂',
  '利泰', '利盛', '利达', '利信', '利诚', '利瑞', '利丰', '利茂',
  '宝泰', '宝盛', '宝达', '宝信', '宝诚', '宝瑞', '宝丰', '宝茂',
  '德泰', '德盛', '德达', '德信', '德诚', '德瑞', '德丰', '德茂',
  '昌泰', '昌盛', '昌达', '昌信', '昌诚', '昌瑞', '昌丰', '昌茂',
  '盛泰', '盛达', '盛信', '盛诚', '盛瑞', '盛丰', '盛茂', '盛安',
  '裕泰', '裕盛', '裕达', '裕信', '裕诚', '裕瑞', '裕丰', '裕茂',
  '荣泰', '荣盛', '荣达', '荣信', '荣诚', '荣瑞', '荣丰', '荣茂',
  '光泰', '光盛', '光达', '光信', '光诚', '光瑞', '光丰', '光茂',
  '明泰', '明盛', '明达', '明信', '明诚', '明瑞', '明丰', '明茂',
  '辉泰', '辉盛', '辉达', '辉信', '辉诚', '辉瑞', '辉丰', '辉茂',
  '耀泰', '耀盛', '耀达', '耀信', '耀诚', '耀瑞', '耀丰', '耀茂',
  '晨泰', '晨盛', '晨达', '晨信', '晨诚', '晨瑞', '晨丰', '晨茂',
  '景泰', '景盛', '景达', '景信', '景诚', '景瑞', '景丰', '景茂',
  '悦泰', '悦盛', '悦达', '悦信', '悦诚', '悦瑞', '悦丰', '悦茂',
  '欣泰', '欣盛', '欣达', '欣信', '欣诚', '欣瑞', '欣丰', '欣茂',
  '润泰', '润泽', '润达', '润信', '润诚', '润瑞', '润丰', '润茂',
  '泽泰', '泽盛', '泽达', '泽信', '泽诚', '泽瑞', '泽丰', '泽茂',
  '豪泰', '豪盛', '豪达', '豪信', '豪诚', '豪瑞', '豪丰', '豪茂',
  '凯泰', '凯盛', '凯达', '凯信', '凯诚', '凯瑞', '凯丰', '凯茂',
  '建泰', '建盛', '建达', '建信', '建诚', '建瑞', '建丰', '建茂',
  '国源', '国盛', '国达', '国信', '国诚', '国瑞', '国丰', '国茂',
  '中源', '中盛', '中达', '中信', '中诚', '中瑞', '中丰', '中茂',
  '东源', '东盛', '东达', '东信', '东诚', '东瑞', '东丰', '东茂',
  '南源', '南盛', '南达', '南信', '南诚', '南瑞', '南丰', '南茂',
  '西源', '西盛', '西达', '西信', '西诚', '西瑞', '西丰', '西茂',
  '北源', '北盛', '北达', '北信', '北诚', '北瑞', '北丰', '北茂',
];

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seedRandom(42);

function randomInRange(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomInRangeFloat(min: number, max: number): number {
  return Math.round((rand() * (max - min) + min) * 10) / 10;
}

function pickRegionForSubstation(index: number, total: number): string {
  const regionWeights = [0.22, 0.2, 0.2, 0.2, 0.18];
  const cumulative = regionWeights.reduce((acc: number[], w, i) => {
    acc.push((acc[i - 1] || 0) + w);
    return acc;
  }, []);
  const position = (index + 1) / total;
  for (let i = 0; i < cumulative.length; i++) {
    if (position <= cumulative[i]) return REGIONS[i];
  }
  return REGIONS[0];
}

function generatePosition(region: string, jitterRatio: number = 0.8): { x: number; y: number } {
  const range = REGION_RANGES[region];
  const center = REGION_CENTERS[region];
  const useCenter = rand() > jitterRatio;
  if (useCenter) {
    return {
      x: randomInRange(center.cx - 100, center.cx + 100),
      y: randomInRange(center.cy - 80, center.cy + 80),
    };
  }
  return {
    x: randomInRange(range.xMin, range.xMax),
    y: randomInRange(range.yMin, range.yMax),
  };
}

function generateSubstations(): Substation[] {
  const subs: Substation[] = [];

  for (let i = 0; i < 28; i++) {
    const id = `sub-500-${String(i + 1).padStart(3, '0')}`;
    const nameIdx = i % NAME_500KV_PREFIXES.length;
    const name = `${NAME_500KV_PREFIXES[nameIdx]}500kV变`;
    const region = pickRegionForSubstation(i, 28);
    const pos = generatePosition(region, 0.6);
    const capacity = randomInRange(1000, 3000);
    subs.push({
      id,
      name,
      voltageLevel: '500kV',
      capacity,
      region,
      x: Math.max(50, Math.min(1200, pos.x)),
      y: Math.max(50, Math.min(700, pos.y)),
    });
  }

  for (let i = 0; i < 85; i++) {
    const id = `sub-220-${String(i + 1).padStart(3, '0')}`;
    const nameIdx = i % NAME_220KV_PREFIXES.length;
    const name = `${NAME_220KV_PREFIXES[nameIdx]}220kV变`;
    const region = pickRegionForSubstation(i, 85);
    const pos = generatePosition(region, 0.75);
    const capacity = randomInRange(180, 540);
    subs.push({
      id,
      name,
      voltageLevel: '220kV',
      capacity,
      region,
      x: Math.max(50, Math.min(1200, pos.x)),
      y: Math.max(50, Math.min(700, pos.y)),
    });
  }

  for (let i = 0; i < 320; i++) {
    const id = `sub-110-${String(i + 1).padStart(3, '0')}`;
    const nameIdx = i % NAME_110KV_PREFIXES.length;
    const suffix = nameIdx >= NAME_110KV_PREFIXES.length ? `_${Math.floor(i / NAME_110KV_PREFIXES.length)}` : '';
    const name = `${NAME_110KV_PREFIXES[nameIdx]}${suffix}110kV变`;
    const region = pickRegionForSubstation(i, 320);
    const pos = generatePosition(region, 0.85);
    const capacity = randomInRange(40, 120);
    subs.push({
      id,
      name,
      voltageLevel: '110kV',
      capacity,
      region,
      x: Math.max(50, Math.min(1200, pos.x)),
      y: Math.max(50, Math.min(700, pos.y)),
    });
  }

  return subs;
}

export const substations: Substation[] = generateSubstations();
export const stations500kVIds: string[] = substations
  .filter((s) => s.voltageLevel === '500kV')
  .map((s) => s.id);

export const mockSubstations: Substation[] = substations;
