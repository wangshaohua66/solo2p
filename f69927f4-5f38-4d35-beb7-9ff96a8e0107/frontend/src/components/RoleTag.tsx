import { Tag } from 'antd';
import type { MemberRole } from '@/types';

const ROLE_CONFIG: Record<MemberRole, { color: string; label: string }> = {
  STUDENT: { color: 'blue', label: '学生' },
  REGULAR: { color: 'green', label: '普通' },
  PROFESSIONAL: { color: 'purple', label: '专业艺术家' },
  ADMIN: { color: 'red', label: '管理员' },
};

interface RoleTagProps {
  role: MemberRole;
}

export default function RoleTag({ role }: RoleTagProps) {
  const config = ROLE_CONFIG[role];
  return <Tag color={config.color}>{config.label}</Tag>;
}
