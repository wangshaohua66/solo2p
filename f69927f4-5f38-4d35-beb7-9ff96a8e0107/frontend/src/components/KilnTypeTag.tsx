import { Tag } from 'antd';
import type { KilnType } from '@/types';

const KILN_TYPE_CONFIG: Record<KilnType, { color: string; label: string }> = {
  EXPERIMENTAL: { color: 'blue', label: '实验窑' },
  WORKING: { color: 'orange', label: '工作窑' },
  ANNEALING: { color: 'green', label: '退火窑' },
};

interface KilnTypeTagProps {
  type: KilnType;
}

export default function KilnTypeTag({ type }: KilnTypeTagProps) {
  const config = KILN_TYPE_CONFIG[type];
  return <Tag color={config.color}>{config.label}</Tag>;
}
