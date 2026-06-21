import * as XLSX from 'xlsx';
import type { MaintenanceTask, Substation } from '@/types';
import { formatDateTime } from '@/utils/dateUtils';

const CATEGORY_MAP: Record<string, string> = {
  primary_outage: '一次设备停电检修',
  secondary_calibration: '二次设备校验',
  corridor_clearing: '线路走廊砍伐',
  technical_reform: '技改工程施工',
};

const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  submitted: '待审核',
  reviewing: '审核中',
  approved: '已批准',
  rejected: '已驳回',
  completed: '已完成',
};

const VOLTAGE_ORDER = ['500kV', '220kV', '110kV'];
const CATEGORY_ORDER = ['primary_outage', 'secondary_calibration', 'corridor_clearing', 'technical_reform'];

interface TaskDetailRow {
  任务名称: string;
  设备名称: string;
  电压等级: string;
  检修类型: string;
  开始时间: string;
  结束时间: string;
  时长小时: number;
  申请人: string;
  状态: string;
  受影响变电站: string;
  损失容量MVA: number;
}

interface SummaryByCategory {
  检修类型: string;
  任务数量: number;
  占比: string;
  总停电工时: number;
  平均时长小时: number;
}

interface SummaryByVoltage {
  电压等级: string;
  任务数量: number;
  占比: string;
  损失容量MVA: number;
}

interface SummaryByDepartment {
  部门: string;
  任务数量: number;
  占比: string;
  总停电工时: number;
}

export function exportMonthlyPlanExcel(
  tasks: MaintenanceTask[],
  stations: Substation[]
): void {
  if (tasks.length === 0) {
    return;
  }

  const stationMap = new Map<string, Substation>();
  for (const s of stations) {
    stationMap.set(s.id, s);
  }

  const detailRows: TaskDetailRow[] = tasks.map(task => {
    let voltageLevel = '';
    const affectedStation = stations.find(s => s.id === task.affectedStationIds[0]);
    if (affectedStation) {
      voltageLevel = affectedStation.voltageLevel;
    } else if (task.affectedStationIds.length > 0) {
      const firstStation = stations.find(s => task.affectedStationIds.includes(s.id));
      voltageLevel = firstStation?.voltageLevel || '';
    }

    const affectedStationNames = task.affectedStationIds
      .map(id => stationMap.get(id)?.name || id)
      .join('、');

    return {
      任务名称: task.title,
      设备名称: task.equipmentId || task.lineId || '',
      电压等级: voltageLevel,
      检修类型: CATEGORY_MAP[task.category] || task.category,
      开始时间: formatDateTime(task.startTime),
      结束时间: formatDateTime(task.endTime),
      时长小时: task.outageDurationH,
      申请人: task.applicant,
      状态: STATUS_MAP[task.approvalStatus] || task.approvalStatus,
      受影响变电站: affectedStationNames,
      损失容量MVA: task.lostCapacity,
    };
  });

  const total = tasks.length;

  const byCategory: SummaryByCategory[] = CATEGORY_ORDER.map(cat => {
    const filtered = tasks.filter(t => t.category === cat);
    const count = filtered.length;
    const totalHours = filtered.reduce((sum, t) => sum + t.outageDurationH, 0);
    return {
      检修类型: CATEGORY_MAP[cat] || cat,
      任务数量: count,
      占比: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%',
      总停电工时: Math.round(totalHours * 10) / 10,
      平均时长小时: count > 0 ? Math.round((totalHours / count) * 10) / 10 : 0,
    };
  }).filter(r => r.任务数量 > 0);

  const byVoltage: SummaryByVoltage[] = VOLTAGE_ORDER.map(vl => {
    const filtered = tasks.filter(t => {
      const station = stations.find(s => s.id === t.affectedStationIds[0]);
      return station?.voltageLevel === vl;
    });
    const count = filtered.length;
    const lostCapacity = filtered.reduce((sum, t) => sum + t.lostCapacity, 0);
    return {
      电压等级: vl,
      任务数量: count,
      占比: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%',
      损失容量MVA: Math.round(lostCapacity * 10) / 10,
    };
  }).filter(r => r.任务数量 > 0);

  const deptMap = new Map<string, MaintenanceTask[]>();
  for (const task of tasks) {
    if (!deptMap.has(task.department)) {
      deptMap.set(task.department, []);
    }
    deptMap.get(task.department)!.push(task);
  }
  const byDepartment: SummaryByDepartment[] = Array.from(deptMap.entries()).map(([dept, deptTasks]) => {
    const count = deptTasks.length;
    const totalHours = deptTasks.reduce((sum, t) => sum + t.outageDurationH, 0);
    return {
      部门: dept,
      任务数量: count,
      占比: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%',
      总停电工时: Math.round(totalHours * 10) / 10,
    };
  });
  byDepartment.sort((a, b) => b.任务数量 - a.任务数量);

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(detailRows);
  const colWidths1 = [
    { wch: 24 }, { wch: 20 }, { wch: 10 }, { wch: 16 },
    { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
    { wch: 8 }, { wch: 36 }, { wch: 12 },
  ];
  ws1['!cols'] = colWidths1;
  XLSX.utils.book_append_sheet(wb, ws1, '任务明细');

  const summaryData: Record<string, unknown>[] = [];
  summaryData.push({ A: '月度检修计划统计汇总', B: '', C: '', D: '', E: '' });
  summaryData.push({ A: `生成时间: ${formatDateTime(Date.now())}`, B: '', C: '', D: '', E: '' });
  summaryData.push({ A: `任务总数: ${total}`, B: '', C: '', D: '', E: '' });
  summaryData.push({ A: '', B: '', C: '', D: '', E: '' });

  summaryData.push({ A: '一、按检修类型统计', B: '', C: '', D: '', E: '' });
  summaryData.push({ A: '检修类型', B: '任务数量', C: '占比', D: '总停电工时', E: '平均时长小时' });
  for (const row of byCategory) {
    summaryData.push({
      A: row.检修类型,
      B: row.任务数量,
      C: row.占比,
      D: row.总停电工时,
      E: row.平均时长小时,
    });
  }
  summaryData.push({ A: '', B: '', C: '', D: '', E: '' });

  summaryData.push({ A: '二、按电压等级统计', B: '', C: '', D: '', E: '' });
  summaryData.push({ A: '电压等级', B: '任务数量', C: '占比', D: '损失容量MVA', E: '' });
  for (const row of byVoltage) {
    summaryData.push({
      A: row.电压等级,
      B: row.任务数量,
      C: row.占比,
      D: row.损失容量MVA,
      E: '',
    });
  }
  summaryData.push({ A: '', B: '', C: '', D: '', E: '' });

  summaryData.push({ A: '三、按部门统计', B: '', C: '', D: '', E: '' });
  summaryData.push({ A: '部门', B: '任务数量', C: '占比', D: '总停电工时', E: '' });
  for (const row of byDepartment) {
    summaryData.push({
      A: row.部门,
      B: row.任务数量,
      C: row.占比,
      D: row.总停电工时,
      E: '',
    });
  }

  const ws2 = XLSX.utils.json_to_sheet(summaryData, { header: ['A', 'B', 'C', 'D', 'E'], skipHeader: true });
  ws2['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, '统计汇总');

  const now = new Date();
  const fileName = `月度检修计划_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
