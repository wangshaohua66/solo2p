import dayjs from 'dayjs';
import type { ReportFile, ReportType, AcceptanceConclusion } from '@/types';
import { mockTasks } from './mockTasks';

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seedRandom(88888);

function randomInRange(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[randomInRange(0, arr.length - 1)];
}

const UPLOADERS = [
  { name: '张工', id: 'user-001' },
  { name: '李工', id: 'user-002' },
  { name: '王工', id: 'user-003' },
  { name: '赵工', id: 'user-004' },
  { name: '孙工', id: 'user-005' },
  { name: '周工', id: 'user-006' },
];

const REPORT_TYPE_CONFIG: Record<ReportType, { label: string; ext: string; sizeRange: [number, number] }> = {
  maintenance_report: { label: '检修报告', ext: 'pdf', sizeRange: [1024 * 1024, 5 * 1024 * 1024] },
  acceptance_record: { label: '验收记录', ext: 'xlsx', sizeRange: [100 * 1024, 500 * 1024] },
  site_photo: { label: '现场照片', ext: 'zip', sizeRange: [10 * 1024 * 1024, 30 * 1024 * 1024] },
  test_report: { label: '试验报告', ext: 'pdf', sizeRange: [500 * 1024, 2 * 1024 * 1024] },
};

const REPORT_TYPES: ReportType[] = ['maintenance_report', 'acceptance_record', 'site_photo', 'test_report'];

const REMARKS = [
  '检修工作已完成，设备运行正常',
  '各项试验数据合格，满足规程要求',
  '现场照片已归档，作业规范',
  '验收通过，可投入运行',
  '有条件通过，需限期整改 minor 问题',
  '试验报告已审核签字',
];

function getConclusion(): AcceptanceConclusion {
  const r = rand();
  if (r < 0.7) return 'pass';
  if (r < 0.9) return 'conditional_pass';
  return 'fail';
}

function sanitizeName(name: string): string {
  return name.replace(/[\/\\:*?"<>|\s]/g, '_').replace(/_+/g, '_');
}

function generateReports(): ReportFile[] {
  const reports: ReportFile[] = [];
  let reportCounter = 0;

  const eligibleTasks = mockTasks.filter(
    (t) => t.approvalStatus === 'approved' || t.approvalStatus === 'completed' || t.approvalStatus === 'reviewing'
  );

  for (const task of eligibleTasks) {
    const reportCount = randomInRange(3, 5);
    const usedTypes = new Set<ReportType>();

    for (let i = 0; i < reportCount; i++) {
      let type: ReportType;
      if (i === 0) {
        type = 'maintenance_report';
      } else if (i === 1) {
        type = 'acceptance_record';
      } else {
        const availableTypes = REPORT_TYPES.filter((t) => !usedTypes.has(t));
        type = availableTypes.length > 0 ? pickRandom(availableTypes) : pickRandom(REPORT_TYPES);
      }
      usedTypes.add(type);

      const config = REPORT_TYPE_CONFIG[type];
      const daysAfter = randomInRange(1, 3);
      const uploadedAt = task.endTime + daysAfter * 24 * 60 * 60 * 1000 + randomInRange(0, 8 * 3600 * 1000);

      const dateStr = dayjs(uploadedAt).format('YYYYMMDD');
      const taskName = sanitizeName(task.title);
      const fileName = `${taskName}_${config.label}_${dateStr}.${config.ext}`;

      const size = randomInRange(config.sizeRange[0], config.sizeRange[1]);
      const uploader = pickRandom(UPLOADERS);

      const report: ReportFile = {
        id: `report-${String(++reportCounter).padStart(4, '0')}`,
        taskId: task.id,
        name: fileName,
        type,
        size,
        uploader: uploader.name,
        uploaderId: uploader.id,
        uploadedAt,
        conclusion: type === 'acceptance_record' ? getConclusion() : undefined,
        remark: type === 'acceptance_record' ? pickRandom(REMARKS) : undefined,
        fileUrl: `/reports/${task.id}/${reportCounter}`,
      };

      reports.push(report);
    }
  }

  return reports;
}

export const mockReports: ReportFile[] = generateReports();

export function getReportsByTaskId(taskId: string): ReportFile[] {
  return mockReports.filter((r) => r.taskId === taskId);
}

export function getReportsByTimeRange(start: number, end: number): ReportFile[] {
  return mockReports.filter((r) => r.uploadedAt >= start && r.uploadedAt <= end);
}
