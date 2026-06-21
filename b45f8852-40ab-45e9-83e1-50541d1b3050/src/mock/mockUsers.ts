import type { OnlineUser } from '@/types';

const MOCK_USER_COLORS = [
  '#6366F1',
  '#EC4899',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#14B8A6',
  '#A855F7',
  '#0EA5E9',
  '#22C55E',
  '#E11D48',
  '#0891B2',
];

const DEPARTMENTS = [
  '检修一工区',
  '检修二工区',
  '变电运维班',
  '输电运维班',
  '调度控制室',
  '继电保护班',
  '自动化班',
];

const ROLES = [
  '检修工程师',
  '运维工程师',
  '调度员',
  '保护专员',
  '自动化工程师',
  '班组长',
  '技术员',
];

const MOCK_USER_NAMES = [
  { name: '李工', dept: 0, role: 0 },
  { name: '王师傅', dept: 0, role: 5 },
  { name: '张晓明', dept: 1, role: 0 },
  { name: '刘芳', dept: 2, role: 1 },
  { name: '陈建国', dept: 3, role: 1 },
  { name: '赵雷', dept: 4, role: 2 },
  { name: '孙丽华', dept: 5, role: 3 },
  { name: '周伟', dept: 6, role: 4 },
  { name: '吴强', dept: 0, role: 6 },
  { name: '郑雪', dept: 1, role: 6 },
  { name: '黄海', dept: 2, role: 5 },
  { name: '林涛', dept: 3, role: 0 },
  { name: '徐敏', dept: 4, role: 2 },
  { name: '马超', dept: 5, role: 3 },
  { name: '朱琳', dept: 6, role: 4 },
];

export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
}

export const mockUsers: Array<Omit<OnlineUser, 'lastActiveAt'>> = MOCK_USER_NAMES.map(
  (user, index) => {
    return {
      id: generateId('user'),
      name: user.name,
      role: ROLES[user.role],
      color: MOCK_USER_COLORS[index % MOCK_USER_COLORS.length],
    };
  }
);

export const generateRandomUsers = (): OnlineUser[] => {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return mockUsers.map((user) => {
    const randomOffset = Math.floor(Math.random() * fiveMinutes);
    return {
      ...user,
      lastActiveAt: now - randomOffset,
    };
  });
};

export const getCurrentUser = (): OnlineUser => {
  return {
    id: 'user-current',
    name: '张工',
    role: '系统管理员',
    color: '#6366F1',
    lastActiveAt: Date.now(),
  };
};

export const DEPARTMENT_LIST = DEPARTMENTS;
export const ROLE_LIST = ROLES;
