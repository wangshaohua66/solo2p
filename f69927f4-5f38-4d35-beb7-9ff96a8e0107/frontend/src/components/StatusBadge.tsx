import { Tag } from 'antd';
import type { ScheduleStatus } from '@/types';

const STATUS_CONFIG: Record<ScheduleStatus, { color: string; label: string }> = {
  PENDING: { color: '#8C8C8C', label: '待排程' },
  FIRING: { color: '#E8602C', label: '烧制中' },
  COOLING: { color: '#3B6FA0', label: '冷却中' },
  COMPLETED: { color: '#52C41A', label: '已完成' },
  CANCELLED: { color: 'default', label: '已取消' },
};

interface StatusBadgeProps {
  status: ScheduleStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}
