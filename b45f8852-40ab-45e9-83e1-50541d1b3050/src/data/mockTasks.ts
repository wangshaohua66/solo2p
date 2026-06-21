import dayjs from 'dayjs';
import type {
  MaintenanceTask,
  MaintenanceCategory,
  ApprovalStatus,
  OutageLevel,
  ApprovalEntry,
  UserLevel,
  VoltageLevel,
} from '@/types';
import { substations } from './mockSubstations';
import { equipments } from './mockEquipment';
import { lines } from './mockLines';

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seedRandom(77777);

function randomInRange(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[randomInRange(0, arr.length - 1)];
}

function pickNRandom<T>(arr: T[], n: number): T[] {
  const result: T[] = [];
  const copy = [...arr];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = randomInRange(0, copy.length - 1);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

const BASE_DATE = dayjs('2026-07-01 00:00:00');
const BASE_TS = BASE_DATE.valueOf();
const MONTH_END = dayjs('2026-07-31 23:59:59').valueOf();
const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

const CATEGORY_COUNTS: Array<{ cat: MaintenanceCategory; count: number }> = [
  { cat: 'primary_outage', count: 74 },
  { cat: 'secondary_calibration', count: 47 },
  { cat: 'corridor_clearing', count: 28 },
  { cat: 'technical_reform', count: 37 },
];

const STATUS_COUNTS: Array<{ status: ApprovalStatus; count: number }> = [
  { status: 'draft', count: 28 },
  { status: 'submitted', count: 37 },
  { status: 'reviewing', count: 19 },
  { status: 'approved', count: 84 },
  { status: 'rejected', count: 9 },
  { status: 'completed', count: 9 },
];

const APPLICANTS = [
  { name: '张工', id: 'user-001', dept: '检修一工区' },
  { name: '李工', id: 'user-002', dept: '检修二工区' },
  { name: '王工', id: 'user-003', dept: '继保自动化班' },
  { name: '赵工', id: 'user-004', dept: '运检部线路班' },
  { name: '孙工', id: 'user-005', dept: '技改工程部' },
  { name: '周工', id: 'user-006', dept: '检修一工区' },
  { name: '吴工', id: 'user-007', dept: '变电运维班' },
  { name: '郑工', id: 'user-008', dept: '检修二工区' },
];

const REVIEWER = { id: 'user-010', name: '李审核' };
const APPROVER = { id: 'user-020', name: '王批准' };

const REJECT_REASONS = [
  '方案缺少负荷转移措施，请补充后重新提交',
  '安全措施不完善，存在作业风险',
  '与其他检修任务时间冲突，请调整时间窗',
  '检修工期过长，请优化作业方案',
  '保电期间不宜安排停电，请选择其他时段',
];

const WORK_CONTENTS: Record<MaintenanceCategory, string[]> = {
  primary_outage: [
    '主变压器油色谱分析、绝缘测试、绕组变形试验',
    '220kV母线绝缘子清扫、金具检查、红外测温',
    '110kV断路器预防性试验、机构检查、SF6气体检测',
    '主变压器绝缘油真空滤油处理、油化试验、密封检查',
    '500kV电流互感器介损测试、绝缘油试验',
    '电压互感器误差测试、二次回路检查',
    '避雷器阻性电流测试、放电计数器校验',
    '隔离开关触头检修、机构润滑、传动试验',
  ],
  secondary_calibration: [
    '线路保护装置定检、逻辑校验、传动试验',
    '主变差动保护装置校验、整组传动',
    '母线保护装置硬件检查、功能测试',
    '断路器失灵保护回路检查、模拟试验',
    '故障录波装置定检、波形分析、数据核对',
    '安全自动装置校验、联调试验',
    '备自投装置逻辑验证、整组传动',
    '安稳控制系统策略验证、模拟测试',
  ],
  corridor_clearing: [
    '线路走廊#5-#15杆塔间超高树木砍伐',
    '220kV线路#8-#22通道竹子清理',
    '110kV线路沿线违章建筑拆除协调',
    '500kV线路跨河段漂浮物清理',
    '线路保护区内施工隐患排查整改',
    '杆塔基础周边土方开挖防护',
    '重要跨越段绝缘子防污闪清扫',
    '山火隐患点隔离带开辟',
  ],
  technical_reform: [
    '110kV开关柜更换为气体绝缘开关柜',
    '主变中性点加装消弧线圈装置',
    '老旧隔离开关电动化改造',
    '变电站视频监控系统升级改造',
    '加装智能巡检机器人系统',
    '主变风冷系统智能化改造',
    '直流系统蓄电池组更换',
    '继电保护装置智能化升级',
  ],
};

const TITLE_PREFIX: Record<MaintenanceCategory, string[]> = {
  primary_outage: [
    '主变压器例行检修',
    '母线停电清扫',
    '断路器预防性试验',
    '主变绝缘油处理',
    '互感器年度试验',
    '避雷器带电检测',
  ],
  secondary_calibration: [
    '线路保护装置校验',
    '主变保护定检',
    '母线保护校验',
    '故障录波装置定检',
    '安全自动装置校验',
    '备自投装置校验',
  ],
  corridor_clearing: [
    '线路走廊超高树木砍伐',
    '线路通道竹子清理',
    '山火隐患隔离带开辟',
    '绝缘子防污闪清扫',
    '施工隐患排查整改',
  ],
  technical_reform: [
    '开关柜智能化技改',
    '保护装置升级改造',
    '隔离开关电动化改造',
    '智能巡检系统加装',
    '风冷系统智能改造',
    '蓄电池组更换技改',
  ],
};

function getEquipmentVoltageLevel(eqId: string): VoltageLevel {
  if (eqId.startsWith('eq-tf-5') || eqId.startsWith('eq-br-5') || eqId.startsWith('eq-bb-5')) return '500kV';
  if (eqId.startsWith('eq-tf-2') || eqId.startsWith('eq-br-2') || eqId.startsWith('eq-bb-2')) return '220kV';
  return '110kV';
}

function voltageToLevel(vl: VoltageLevel): OutageLevel {
  return vl === '500kV' ? 'level1' : vl === '220kV' ? 'level2' : 'level3';
}

function outageLevelToUserLevel(level: OutageLevel): UserLevel {
  return level === 'level1' ? 'A' : level === 'level2' ? 'B' : 'C';
}

function clampToJuly(ts: number, durationH: number): { start: number; end: number; dur: number } {
  let start = ts;
  const durMs = durationH * HOUR_MS;
  let end = start + durMs;
  if (end > MONTH_END) {
    end = MONTH_END;
    start = Math.max(BASE_TS, end - durMs);
  }
  if (start < BASE_TS) {
    start = BASE_TS;
    end = Math.min(MONTH_END, start + durMs);
  }
  const dur = Math.max(2, Math.round((end - start) / HOUR_MS));
  return { start, end, dur };
}

function generateApprovalLog(
  taskId: string,
  status: ApprovalStatus,
  taskStartTs: number
): ApprovalEntry[] {
  const log: ApprovalEntry[] = [];
  let logCounter = 0;
  const mkId = () => `log-${taskId.split('-')[1]}-${String(++logCounter).padStart(3, '0')}`;
  const beforeStart = taskStartTs - DAY_MS * randomInRange(5, 20);
  if (status === 'draft') return log;

  log.push({
    id: mkId(),
    taskId,
    operatorId: APPLICANTS[0].id,
    operatorName: APPLICANTS[0].name,
    action: 'submit',
    operatedAt: beforeStart,
  });
  if (status === 'submitted') return log;

  if (status === 'rejected') {
    const atReviewer = rand() > 0.4;
    if (atReviewer) {
      log.push({
        id: mkId(),
        taskId,
        operatorId: REVIEWER.id,
        operatorName: REVIEWER.name,
        action: 'review_reject',
        role: 'reviewer',
        comment: pickRandom(REJECT_REASONS),
        operatedAt: beforeStart + HOUR_MS * randomInRange(2, 10),
      });
    } else {
      log.push({
        id: mkId(),
        taskId,
        operatorId: REVIEWER.id,
        operatorName: REVIEWER.name,
        action: 'review_pass',
        role: 'reviewer',
        comment: '初审通过，请复审',
        operatedAt: beforeStart + HOUR_MS * randomInRange(2, 10),
      });
      log.push({
        id: mkId(),
        taskId,
        operatorId: APPROVER.id,
        operatorName: APPROVER.name,
        action: 'approve_reject',
        role: 'approver',
        comment: pickRandom(REJECT_REASONS),
        operatedAt: beforeStart + HOUR_MS * randomInRange(12, 24),
      });
    }
    return log;
  }

  log.push({
    id: mkId(),
    taskId,
    operatorId: REVIEWER.id,
    operatorName: REVIEWER.name,
    action: 'review_pass',
    role: 'reviewer',
    comment: '方案可行，注意安全措施',
    operatedAt: beforeStart + HOUR_MS * randomInRange(2, 10),
  });
  if (status === 'reviewing') return log;

  log.push({
    id: mkId(),
    taskId,
    operatorId: APPROVER.id,
    operatorName: APPROVER.name,
    action: 'approve',
    role: 'approver',
    comment: '同意执行，请按方案落实',
    operatedAt: beforeStart + HOUR_MS * randomInRange(12, 24),
  });
  return log;
}

interface TaskSpec {
  id: string;
  category: MaintenanceCategory;
  status: ApprovalStatus;
  startTime: number;
  durationH: number;
  equipmentId?: string;
  lineId?: string;
  targetSubstationId: string;
  voltageLevel: VoltageLevel;
  affectedStationIds: string[];
  lostCapacity: number;
}

function generateTasks(): MaintenanceTask[] {
  const TOTAL = 186;

  const categoriesPool: MaintenanceCategory[] = [];
  for (const { cat, count } of CATEGORY_COUNTS) {
    for (let i = 0; i < count; i++) categoriesPool.push(cat);
  }
  for (let i = categoriesPool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [categoriesPool[i], categoriesPool[j]] = [categoriesPool[j], categoriesPool[i]];
  }

  const statusPool: ApprovalStatus[] = [];
  for (const { status, count } of STATUS_COUNTS) {
    for (let i = 0; i < count; i++) statusPool.push(status);
  }
  for (let i = statusPool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]];
  }

  const subs500 = substations.filter((s) => s.voltageLevel === '500kV');
  const subs220 = substations.filter((s) => s.voltageLevel === '220kV');
  const subs110 = substations.filter((s) => s.voltageLevel === '110kV');

  const equip500 = equipments.filter((e) => getEquipmentVoltageLevel(e.id) === '500kV');
  const equip220 = equipments.filter((e) => getEquipmentVoltageLevel(e.id) === '220kV');
  const equip110 = equipments.filter((e) => getEquipmentVoltageLevel(e.id) === '110kV');

  // ====== 预定义冲突设备对（10对） ======
  const dupConflicts: { eqId: string; taskA: number; taskB: number; baseDay: number }[] = [];
  const dupEqs = pickNRandom(equip500.concat(equip220), 10);
  for (let i = 0; i < 10; i++) {
    dupConflicts.push({
      eqId: dupEqs[i].id,
      taskA: i * 2,
      taskB: i * 2 + 1,
      baseDay: 5 + i * 2,
    });
  }
  const dupTaskIndices = new Set<number>();
  dupConflicts.forEach((d) => { dupTaskIndices.add(d.taskA); dupTaskIndices.add(d.taskB); });

  // ====== 预定义片区冲突（8组） ======
  const regions = ['东区', '南区', '西区', '北区', '中区'];
  const areaConflicts: { group: string[]; taskA: number; taskB: number; baseDay: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const region = regions[i % regions.length];
    const sts = substations.filter((s) => s.region === region);
    const group = pickNRandom(sts, Math.min(3, sts.length)).map((s) => s.id);
    if (group.length >= 2) {
      areaConflicts.push({
        group,
        taskA: 160 + i * 2,
        taskB: 160 + i * 2 + 1,
        baseDay: 15 + i * 2,
      });
    }
  }
  const areaTaskIndices = new Set<number>();
  areaConflicts.forEach((a) => { areaTaskIndices.add(a.taskA); areaTaskIndices.add(a.taskB); });

  // 确保冲突任务不是corridor_clearing
  const NON_CORRIDOR: MaintenanceCategory[] = [
    'primary_outage',
    'secondary_calibration',
    'technical_reform',
  ];
  for (const idx of dupTaskIndices) {
    if (categoriesPool[idx] === 'corridor_clearing') {
      categoriesPool[idx] = NON_CORRIDOR[randomInRange(0, 2)];
    }
  }
  for (const idx of areaTaskIndices) {
    if (categoriesPool[idx] === 'corridor_clearing') {
      categoriesPool[idx] = NON_CORRIDOR[randomInRange(0, 2)];
    }
  }

  // ====== 预定义保供电冲突（5个） ======
  const protectionConflicts: { taskIdx: number; baseDay: number }[] = [
    { taskIdx: 36, baseDay: 1 },
    { taskIdx: 37, baseDay: 2 },
    { taskIdx: 38, baseDay: 2 },
    { taskIdx: 39, baseDay: 28 },
    { taskIdx: 40, baseDay: 29 },
  ];

  // ====== 预定义高峰负荷冲突（12个） ======
  const peakConflicts: number[] = [];
  for (let i = 0; i < 12; i++) peakConflicts.push(41 + i);

  // ====== 生成TaskSpec ======
  const specs: TaskSpec[] = [];
  const usedDup = new Map<string, number>();

  for (let i = 0; i < TOTAL; i++) {
    const category = categoriesPool[i];
    let voltageLevel: VoltageLevel;
    const roll = rand();
    if (category === 'corridor_clearing') {
      voltageLevel = roll < 0.2 ? '500kV' : roll < 0.6 ? '220kV' : '110kV';
    } else {
      voltageLevel = roll < 0.15 ? '500kV' : roll < 0.5 ? '220kV' : '110kV';
    }

    let equipmentId: string | undefined;
    let lineId: string | undefined;
    let targetSubstationId: string;

    // 检查重复检修冲突
    const dupC = dupConflicts.find((d) => d.taskA === i || d.taskB === i);
    if (dupC && category !== 'corridor_clearing') {
      equipmentId = dupC.eqId;
      voltageLevel = getEquipmentVoltageLevel(equipmentId);
      const eq = equipments.find((e) => e.id === equipmentId)!;
      targetSubstationId = eq.substationId;
      const prev = usedDup.get(equipmentId) || 0;
      usedDup.set(equipmentId, prev + 1);
    } else if (category === 'corridor_clearing') {
      const pool = lines.filter((l) => l.voltageLevel === voltageLevel);
      const ln = pickRandom(pool);
      lineId = ln.id;
      targetSubstationId = ln.fromStationId;
    } else {
      const pool =
        voltageLevel === '500kV' ? equip500 : voltageLevel === '220kV' ? equip220 : equip110;
      const eq = pickRandom(pool);
      equipmentId = eq.id;
      targetSubstationId = eq.substationId;
    }

    // 时间
    let startDay: number;
    let startHour: number;
    let durationH: number;

    if (dupC) {
      startDay = dupC.baseDay;
      startHour = dupC.taskA === i ? 8 : 14;
      durationH = 10;
    } else {
      const areaC = areaConflicts.find((a) => a.taskA === i || a.taskB === i);
      if (areaC) {
        startDay = areaC.baseDay;
        startHour = areaC.taskA === i ? 9 : 13;
        durationH = 12;
      } else if (protectionConflicts.some((p) => p.taskIdx === i)) {
        const pc = protectionConflicts.find((p) => p.taskIdx === i)!;
        startDay = pc.baseDay;
        startHour = randomInRange(9, 17);
        durationH = randomInRange(6, 10);
      } else if (peakConflicts.includes(i)) {
        startDay = 3 + (i % 25);
        startHour = 19;
        durationH = Math.min(randomInRange(2, 4), 3);
      } else {
        startDay = randomInRange(3, 27);
        startHour = randomInRange(6, 18);
        durationH = randomInRange(2, 72);
      }
    }

    const rawStart = BASE_TS + (startDay - 1) * DAY_MS + startHour * HOUR_MS;
    const { start: startTime, end: endTime, dur } = clampToJuly(rawStart, durationH);

    // 影响站
    const targetSub = substations.find((s) => s.id === targetSubstationId)!;
    let affectedStationIds: string[];
    const areaC = areaConflicts.find((a) => a.taskA === i || a.taskB === i);
    if (areaC) {
      affectedStationIds = [...areaC.group];
    } else {
      const sameRegionStations = substations.filter((s) => s.region === targetSub.region);
      const extraCount = randomInRange(0, Math.min(7, sameRegionStations.length - 1));
      const extras = pickNRandom(
        sameRegionStations.filter((s) => s.id !== targetSubstationId),
        extraCount
      ).map((s) => s.id);
      affectedStationIds = [targetSubstationId, ...extras];
    }

    let lostCapacity = 0;
    for (const sid of affectedStationIds) {
      const s = substations.find((x) => x.id === sid)!;
      lostCapacity += Math.round(s.capacity * (rand() * 0.4 + 0.1));
    }
    lostCapacity = Math.max(20, Math.min(800, lostCapacity));

    specs.push({
      id: `task-${String(i + 1).padStart(3, '0')}`,
      category,
      status: statusPool[i],
      startTime,
      durationH: dur,
      equipmentId,
      lineId,
      targetSubstationId,
      voltageLevel,
      affectedStationIds,
      lostCapacity,
    });
  }

  // ====== 生成最终任务 ======
  const tasks: MaintenanceTask[] = [];
  for (const spec of specs) {
    const outageLevel: OutageLevel = voltageToLevel(spec.voltageLevel);
    const affectedUserLevel: UserLevel = outageLevelToUserLevel(outageLevel);
    const applicant = pickRandom(APPLICANTS);
    const targetSub = substations.find((s) => s.id === spec.targetSubstationId)!;
    const titleBase = pickRandom(TITLE_PREFIX[spec.category]);
    const title = `${targetSub.name} ${titleBase}`;
    const workContent = pickRandom(WORK_CONTENTS[spec.category]);
    const approvalLog = generateApprovalLog(spec.id, spec.status, spec.startTime);
    const createdAt = spec.startTime - DAY_MS * randomInRange(10, 30);
    const lastLog =
      approvalLog.length > 0 ? approvalLog[approvalLog.length - 1].operatedAt : createdAt;
    const updatedAt = Math.max(createdAt + HOUR_MS * 2, lastLog);
    const endTime = Math.min(
      MONTH_END,
      spec.startTime + spec.durationH * HOUR_MS
    );

    tasks.push({
      id: spec.id,
      title,
      category: spec.category,
      equipmentId: spec.equipmentId,
      lineId: spec.lineId,
      startTime: spec.startTime,
      endTime,
      outageDurationH: Math.max(2, Math.round((endTime - spec.startTime) / HOUR_MS)),
      outageLevel,
      applicant: applicant.name,
      applicantId: applicant.id,
      department: applicant.dept,
      workContent,
      approvalStatus: spec.status,
      approvalLog,
      affectedStationIds: spec.affectedStationIds,
      lostCapacity: spec.lostCapacity,
      affectedUserLevel,
      loadTransferPlan:
        outageLevel !== 'level3'
          ? `负荷转移至相邻${
              outageLevel === 'level1' ? '500kV' : outageLevel === 'level2' ? '220kV' : '110kV'
            }变电站供电`
          : undefined,
      createdAt,
      updatedAt,
    });
  }

  return tasks;
}

export const tasks: MaintenanceTask[] = generateTasks();
export const mockTasks: MaintenanceTask[] = tasks;
