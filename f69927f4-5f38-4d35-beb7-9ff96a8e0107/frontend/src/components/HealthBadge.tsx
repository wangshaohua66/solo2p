import { Tag } from 'antd';
import type { HealthStatus } from '@/types';

const HEALTH_CONFIG: Record<HealthStatus, { color: string; label: string }> = {
  HEALTHY: { color: 'green', label: '健康' },
  WARNING: { color: 'orange', label: '警告' },
  CRITICAL: { color: 'red', label: '危险' },
};

interface HealthBadgeProps {
  status: HealthStatus;
}

export default function HealthBadge({ status }: HealthBadgeProps) {
  const config = HEALTH_CONFIG[status];

  if (status === 'CRITICAL') {
    return <Tag color={config.color} className="health-badge-critical">{config.label}</Tag>;
  }

  return <Tag color={config.color}>{config.label}</Tag>;
}
