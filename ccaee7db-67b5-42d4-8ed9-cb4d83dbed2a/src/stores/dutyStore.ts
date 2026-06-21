import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  UserInfo,
  DutyRecord,
  HandoverRecord,
  DutyShift,
} from '@/types';

// 值班Store状态接口
interface DutyState {
  currentUser: UserInfo;
  dutyRecords: DutyRecord[];
  handoverRecords: HandoverRecord[];
  currentShift: {
    shift: DutyShift;
    date: string;
    records: DutyRecord[];
    hoursRemaining: number;
  } | null;
  pendingHandover: HandoverRecord | null;
  dutyStatistics: {
    totalShifts: number;
    thisMonthShifts: number;
    totalHours: number;
    continuousHours: number;
    overtimeWarnings: number;
  };
}

// 值班Store操作接口
interface DutyActions {
  createHandover: () => HandoverRecord;
  submitHandover: (record: HandoverRecord) => void;
  confirmHandover: (recordId: string, signature: string) => void;
  updateShiftRecord: (id: string, updates: Partial<DutyRecord>) => void;
  addDutyRecord: (record: DutyRecord) => void;
  getRecordsByDate: (date: string) => DutyRecord[];
  getRecordsByWeek: (weekStart: string) => DutyRecord[];
  getRecordsByMonth: (yearMonth: string) => DutyRecord[];
  calculateContinuousHours: (userId: string) => number;
  detectOvertime: (userId: string) => boolean;
}

type DutyStore = DutyState & DutyActions;

// 四个值班人员配置
const DUTY_USERS: Array<{ id: string; name: string; avatar: string; phone: string }> = [
  {
    id: 'u001',
    name: '李建国',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=%E4%B8%AD%E5%B9%B4%E7%94%B7%E6%80%A7%E5%A4%B4%E5%83%8F%20%E4%B8%93%E4%B8%9A%E6%81%AC%E7%9A%84%E7%94%B5%E8%A7%86%E5%8F%B0%E5%91%98%E5%B7%A5%20%E8%93%9D%E8%89%B2%E8%A1%AC%E8%A1%AB&image_size=square',
    phone: '13800000001',
  },
  {
    id: 'u002',
    name: '王美玲',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=%E4%B8%AD%E5%B9%B4%E5%A5%B3%E6%80%A7%E5%A4%B4%E5%83%8F%20%E4%B8%93%E4%B8%9A%E6%81%AC%E7%9A%84%E7%94%B5%E8%A7%86%E5%8F%B0%E5%91%98%E5%B7%A5%20%E8%93%9D%E8%89%B2%E8%A1%AC%E8%A1%AB&image_size=square',
    phone: '13800000002',
  },
  {
    id: 'u003',
    name: '张伟',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=%E9%9D%92%E5%B9%B4%E7%94%B7%E6%80%A7%E5%A4%B4%E5%83%8F%20%E4%B8%93%E4%B8%9A%E6%81%AC%E7%9A%84%E7%94%B5%E8%A7%86%E5%8F%B0%E5%91%98%E5%B7%A5%20%E8%93%9D%E8%89%B2%E8%A1%AC%E8%A1%AB&image_size=square',
    phone: '13800000003',
  },
  {
    id: 'u004',
    name: '赵晓东',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=%E9%9D%92%E5%B9%B4%E7%94%B7%E6%80%A7%E5%A4%B4%E5%83%8F%20%E4%B8%93%E4%B8%9A%E6%81%AC%E7%9A%84%E7%94%B5%E8%A7%86%E5%8F%B0%E5%91%98%E5%B7%A5%20%E7%81%B0%E8%89%B2%E8%A1%AC%E8%A1%AB&image_size=square',
    phone: '13800000004',
  },
];

// 用户权限配置
const OPERATOR_PERMISSIONS = ['monitor:view', 'alarm:handle', 'duty:handover'];

// 班次定义：早班8:00-16:00，中班16:00-24:00，夜班0:00-8:00
const SHIFT_HOURS: Record<DutyShift, { start: number; duration: number }> = {
  morning: { start: 8, duration: 8 },
  afternoon: { start: 16, duration: 8 },
  night: { start: 0, duration: 8 },
};

// 生成唯一ID
function generateId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// 格式化日期为 YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 解析 YYYY-MM-DD 日期字符串
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// 获取某天某班次的开始和结束时间戳
function getShiftTimestamps(dateStr: string, shift: DutyShift): { startTime: number; endTime: number } {
  const date = parseDate(dateStr);
  const { start, duration } = SHIFT_HOURS[shift];
  const startTime = new Date(date);
  startTime.setHours(start, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
  return { startTime: startTime.getTime(), endTime: endTime.getTime() };
}

// 获取当前班次信息
function getCurrentShiftInfo(
  records: DutyRecord[],
): DutyState['currentShift'] {
  const now = new Date();
  const currentHour = now.getHours();
  const today = formatDate(now);

  let shift: DutyShift;
  let date = today;

  if (currentHour >= 8 && currentHour < 16) {
    shift = 'morning';
  } else if (currentHour >= 16 && currentHour < 24) {
    shift = 'afternoon';
  } else {
    shift = 'night';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    date = formatDate(yesterday);
  }

  const currentRecords = records.filter(
    (r: DutyRecord) => r.date === date && r.shift === shift,
  );

  const { endTime } = getShiftTimestamps(date, shift);
  const hoursRemaining = Math.max(0, (endTime - now.getTime()) / (1000 * 60 * 60));

  return {
    shift,
    date,
    records: currentRecords,
    hoursRemaining: Number(hoursRemaining.toFixed(1)),
  };
}

// 计算值班统计数据
function calculateStatistics(
  records: DutyRecord[],
  userId: string,
  now: Date,
): DutyState['dutyStatistics'] {
  const userRecords = records.filter((r: DutyRecord) => r.userId === userId);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthRecords = userRecords.filter((r: DutyRecord) => r.date.startsWith(thisMonth));

  const totalShifts = userRecords.length;
  const thisMonthShifts = thisMonthRecords.length;
  const totalHours = userRecords.length * 8;

  let continuousHours = 0;
  const completedRecords = [...userRecords]
    .filter((r: DutyRecord) => r.status !== 'pending')
    .sort((a: DutyRecord, b: DutyRecord) => b.endTime - a.endTime);

  if (completedRecords.length > 0) {
    let lastEndTime = now.getTime();
    for (const record of completedRecords) {
      const gap = lastEndTime - record.endTime;
      if (gap <= 16 * 60 * 60 * 1000) {
        continuousHours += 8;
        lastEndTime = record.startTime;
      } else {
        break;
      }
    }
  }

  let overtimeWarnings = 0;
  const sortedRecords = [...userRecords].sort(
    (a: DutyRecord, b: DutyRecord) => a.startTime - b.startTime,
  );
  let consecutiveCount = 0;
  let lastEnd = 0;
  for (const record of sortedRecords) {
    if (lastEnd > 0 && record.startTime - lastEnd <= 16 * 60 * 60 * 1000) {
      consecutiveCount++;
      if (consecutiveCount >= 2) {
        overtimeWarnings++;
      }
    } else {
      consecutiveCount = 1;
    }
    lastEnd = record.endTime;
  }

  return {
    totalShifts,
    thisMonthShifts,
    totalHours,
    continuousHours,
    overtimeWarnings,
  };
}

// 生成当前月份完整排班Mock数据
function generateDutyRecords(): DutyRecord[] {
  const records: DutyRecord[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const totalDays = lastDay.getDate();

  const userCount = DUTY_USERS.length;
  const shifts: DutyShift[] = ['morning', 'afternoon', 'night'];

  let globalOffset = 0;

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dateStr = formatDate(date);

    for (let s = 0; s < shifts.length; s++) {
      const shift = shifts[s];
      const userIndex = (globalOffset + s) % userCount;
      const user = DUTY_USERS[userIndex];
      const { startTime, endTime } = getShiftTimestamps(dateStr, shift);

      let status: DutyRecord['status'] = 'completed';
      const nowTime = now.getTime();
      if (startTime > nowTime) {
        status = 'pending';
      } else if (endTime > nowTime) {
        status = 'ongoing';
      }

      const record: DutyRecord = {
        id: generateId('dr'),
        date: dateStr,
        shift,
        userId: user.id,
        userName: user.name,
        startTime,
        endTime,
        status,
      };
      records.push(record);
    }

    globalOffset += 1;
  }

  return records;
}

// 生成最近5条交接班历史Mock记录
function generateHandoverRecords(dutyRecords: DutyRecord[]): HandoverRecord[] {
  const records: HandoverRecord[] = [];

  const completedRecords = dutyRecords
    .filter((r: DutyRecord) => r.status === 'completed')
    .sort((a: DutyRecord, b: DutyRecord) => b.endTime - a.endTime);

  const shiftSummaries = [
    '当班期间整体播出正常，共处理告警8起，其中信号丢失2起、码率异常3起、音频丢失2起、黑帧1起，均已恢复正常。省会中心机房设备巡检完成，温度电压正常。',
    '当班期间播出状况良好，处理告警5起，全部为码率波动告警，已通知技术部核查。完成凌晨2点例行设备巡检，所有发射机参数正常。',
    '白班交接，处理告警12起，其中紧急告警2起（昌都市传输机房信号中断，已切换备用链路恢复）。省卫视高清频道有轻微码率波动，持续观察中。',
    '中班期间共处理告警6起，均为一般性告警。省会播控机房主备切换测试完成，一切正常。明日设备维护计划表已更新。',
    '夜班交接，整体平稳，处理告警3起（静帧检测误报2起，音频波动1起）。清晨6点完成全部机房远程巡检，118个机房在线正常，2个离线已记录待处理。',
  ];

  const pendingItemsPool = [
    ['跟进昌都市传输机房备用链路稳定性测试报告', '安排明天上午9点省卫视高清频道码率专项核查'],
    ['明州市分中心机房空调故障报修跟进', '本月设备维护记录整理归档'],
    ['等待技术部反馈信号中断原因分析报告', '周五安全例会材料准备'],
    [],
    ['离线机房故障处理跟进：st0118、st0119', '新频道上线测试安排：下周一'],
  ];

  const alarmsHandledPool = [8, 5, 12, 6, 3];

  for (let i = 0; i < Math.min(5, Math.floor(completedRecords.length / 2)); i++) {
    const fromRecord = completedRecords[i * 2 + 1];
    const toRecord = completedRecords[i * 2];
    if (!fromRecord || !toRecord) continue;

    const handoverTime = new Date(fromRecord.endTime);
    handoverTime.setMinutes(handoverTime.getMinutes() + Math.floor(Math.random() * 15) - 5);

    const record: HandoverRecord = {
      id: generateId('hr'),
      date: fromRecord.date,
      shift: fromRecord.shift,
      fromUserId: fromRecord.userId,
      fromUserName: fromRecord.userName,
      toUserId: toRecord.userId,
      toUserName: toRecord.userName,
      summary: shiftSummaries[i % shiftSummaries.length],
      pendingItems: pendingItemsPool[i % pendingItemsPool.length],
      alarmsHandled: alarmsHandledPool[i % alarmsHandledPool.length],
      signature: `sign_${fromRecord.userId}_${Date.now() - i * 86400000}`,
      createdAt: handoverTime.getTime(),
      confirmedAt: handoverTime.getTime() + 60 * 1000 * (2 + Math.floor(Math.random() * 5)),
    };
    records.push(record);
  }

  return records.sort(
    (a: HandoverRecord, b: HandoverRecord) => b.createdAt - a.createdAt,
  );
}

// ===== 初始化Mock数据（IIFE） =====
const INITIAL_DATA = (() => {
  const initialDutyRecords = generateDutyRecords();
  const initialHandoverRecords = generateHandoverRecords(initialDutyRecords);
  const now = new Date();
  return {
    dutyRecords: initialDutyRecords,
    handoverRecords: initialHandoverRecords,
    currentShift: getCurrentShiftInfo(initialDutyRecords),
    dutyStatistics: calculateStatistics(initialDutyRecords, 'u001', now),
  };
})();

export const useDutyStore = create<DutyStore>()(
  immer((set, get) => ({
    // ===== 状态初始值 =====
    currentUser: {
      id: 'u001',
      name: '李建国',
      role: 'operator',
      avatar: DUTY_USERS[0].avatar,
      phone: DUTY_USERS[0].phone,
      permissions: OPERATOR_PERMISSIONS,
    },
    dutyRecords: INITIAL_DATA.dutyRecords,
    handoverRecords: INITIAL_DATA.handoverRecords,
    currentShift: INITIAL_DATA.currentShift,
    pendingHandover: null,
    dutyStatistics: INITIAL_DATA.dutyStatistics,

    // ===== 操作方法 =====

    // 从当前班次创建交接班记录
    createHandover: () => {
      const state = get();
      const { currentShift, currentUser, dutyRecords } = state;

      if (!currentShift) {
        throw new Error('当前无值班班次信息');
      }

      const shifts: DutyShift[] = ['morning', 'afternoon', 'night'];
      const currentShiftIndex = shifts.indexOf(currentShift.shift);
      const nextShiftIndex = (currentShiftIndex + 1) % shifts.length;
      const nextShift = shifts[nextShiftIndex];

      let nextDate = currentShift.date;
      if (nextShiftIndex === 0) {
        const d = parseDate(currentShift.date);
        d.setDate(d.getDate() + 1);
        nextDate = formatDate(d);
      }

      const nextRecords = dutyRecords.filter(
        (r: DutyRecord) => r.date === nextDate && r.shift === nextShift,
      );
      const nextUser = nextRecords.length > 0 ? nextRecords[0] : null;

      const handledAlarms = Math.floor(Math.random() * 10) + 3;

      const handover: HandoverRecord = {
        id: generateId('hr'),
        date: currentShift.date,
        shift: currentShift.shift,
        fromUserId: currentUser.id,
        fromUserName: currentUser.name,
        toUserId: nextUser?.userId || '',
        toUserName: nextUser?.userName || '',
        summary: '',
        pendingItems: [],
        alarmsHandled: handledAlarms,
        signature: '',
        createdAt: Date.now(),
        confirmedAt: 0,
      };

      set((s) => {
        s.pendingHandover = handover;
      });

      return handover;
    },

    // 提交交接班记录（交班人提交，待接班人确认）
    submitHandover: (record) => {
      set((state) => {
        const existingIndex = state.handoverRecords.findIndex(
          (r: HandoverRecord) => r.id === record.id,
        );
        if (existingIndex >= 0) {
          state.handoverRecords[existingIndex] = record;
        } else {
          state.handoverRecords.unshift(record);
        }

        if (state.pendingHandover?.id === record.id) {
          state.pendingHandover = null;
        }
      });
    },

    // 确认交接班记录（接班人签名确认）
    confirmHandover: (recordId, signature) => {
      set((state) => {
        const record = state.handoverRecords.find(
          (r: HandoverRecord) => r.id === recordId,
        );
        if (record) {
          record.signature = signature;
          record.confirmedAt = Date.now();

          const fromRecords = state.dutyRecords.filter(
            (r: DutyRecord) =>
              r.date === record.date &&
              r.shift === record.shift &&
              r.userId === record.fromUserId,
          );
          for (const r of fromRecords) {
            if (r.status === 'ongoing') {
              r.status = 'completed';
            }
          }

          state.currentShift = getCurrentShiftInfo(state.dutyRecords);
          state.dutyStatistics = calculateStatistics(
            state.dutyRecords,
            state.currentUser.id,
            new Date(),
          );
        }
      });
    },

    // 更新单条值班记录
    updateShiftRecord: (id, updates) => {
      set((state) => {
        const index = state.dutyRecords.findIndex(
          (r: DutyRecord) => r.id === id,
        );
        if (index >= 0) {
          state.dutyRecords[index] = { ...state.dutyRecords[index], ...updates };
          state.currentShift = getCurrentShiftInfo(state.dutyRecords);
          state.dutyStatistics = calculateStatistics(
            state.dutyRecords,
            state.currentUser.id,
            new Date(),
          );
        }
      });
    },

    // 新增值班记录
    addDutyRecord: (record) => {
      set((state) => {
        state.dutyRecords.push(record);
        state.currentShift = getCurrentShiftInfo(state.dutyRecords);
        state.dutyStatistics = calculateStatistics(
          state.dutyRecords,
          state.currentUser.id,
          new Date(),
        );
      });
    },

    // 按日期查询值班记录
    getRecordsByDate: (date) => {
      return get().dutyRecords.filter((r: DutyRecord) => r.date === date);
    },

    // 按周查询值班记录（weekStart为周一日期 YYYY-MM-DD）
    getRecordsByWeek: (weekStart) => {
      const start = parseDate(weekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const endTime = end.getTime();
      const startTime = start.getTime();

      return get().dutyRecords.filter(
        (r: DutyRecord) => r.startTime >= startTime && r.startTime < endTime,
      );
    },

    // 按月份查询值班记录（yearMonth格式 YYYY-MM）
    getRecordsByMonth: (yearMonth) => {
      return get().dutyRecords.filter((r: DutyRecord) => r.date.startsWith(yearMonth));
    },

    // 计算用户连续值班时长（小时）
    calculateContinuousHours: (userId) => {
      const { dutyRecords } = get();
      const now = new Date();
      const stats = calculateStatistics(dutyRecords, userId, now);
      return stats.continuousHours;
    },

    // 检测是否超时（连续超过12小时返回true）
    detectOvertime: (userId) => {
      const continuousHours = get().calculateContinuousHours(userId);
      return continuousHours > 12;
    },
  })),
);
