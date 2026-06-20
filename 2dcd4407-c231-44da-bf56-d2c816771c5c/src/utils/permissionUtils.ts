import type { UserRole } from '../types';
import { useUserStore } from '../stores/userStore';

export interface MenuItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  roles: UserRole[];
  children?: MenuItem[];
}

export const MENU_CONFIG: MenuItem[] = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: 'DashboardOutlined',
    path: '/dashboard',
    roles: ['admin', 'operator', 'organizer', 'exhibitor', 'provider'],
  },
  {
    key: 'schedule',
    label: '档期管理',
    icon: 'CalendarOutlined',
    path: '/schedule',
    roles: ['admin', 'operator', 'organizer'],
  },
  {
    key: 'contract',
    label: '合同中心',
    icon: 'FileTextOutlined',
    path: '/contract',
    roles: ['admin', 'operator', 'organizer', 'exhibitor'],
  },
  {
    key: 'finance',
    label: '财务结算',
    icon: 'DollarOutlined',
    path: '/finance',
    roles: ['admin', 'operator'],
  },
  {
    key: 'booth',
    label: '展位分布',
    icon: 'AppstoreOutlined',
    path: '/booth',
    roles: ['admin', 'operator', 'organizer', 'exhibitor', 'visitor'],
  },
  {
    key: 'provider',
    label: '服务商管理',
    icon: 'TeamOutlined',
    path: '/provider',
    roles: ['admin', 'operator', 'provider'],
  },
  {
    key: 'visitor',
    label: '观众服务',
    icon: 'UserOutlined',
    path: '/visitor',
    roles: ['admin', 'operator', 'visitor'],
  },
  {
    key: 'analytics',
    label: '数据分析',
    icon: 'BarChartOutlined',
    path: '/analytics',
    roles: ['admin', 'operator'],
  },
  {
    key: 'system',
    label: '系统管理',
    icon: 'SettingOutlined',
    path: '/system',
    roles: ['admin'],
  },
];

export const getMenusByRole = (role: UserRole): MenuItem[] => {
  return MENU_CONFIG.filter(menu => menu.roles.includes(role));
};

export const hasRoutePermission = (path: string, role: UserRole): boolean => {
  const checkMenu = (menus: MenuItem[]): boolean => {
    for (const menu of menus) {
      if (menu.path === path) {
        return menu.roles.includes(role);
      }
      if (menu.children) {
        if (checkMenu(menu.children)) return true;
      }
    }
    return false;
  };
  return checkMenu(MENU_CONFIG);
};

export const usePermission = () => {
  const { user, hasPermission, hasRole } = useUserStore();

  const menus = user ? getMenusByRole(user.role) : [];

  const canAccess = (permission: string): boolean => {
    return hasPermission(permission);
  };

  const canAccessRole = (role: UserRole | UserRole[]): boolean => {
    return hasRole(role);
  };

  return {
    menus,
    canAccess,
    canAccessRole,
    user,
  };
};

export const PERMISSIONS = {
  SCHEDULE: {
    VIEW: 'schedule:view',
    CREATE: 'schedule:create',
    EDIT: 'schedule:edit',
    DELETE: 'schedule:delete',
    APPROVE: 'schedule:approve',
    LOCK: 'schedule:lock',
  },
  CONTRACT: {
    VIEW: 'contract:view',
    CREATE: 'contract:create',
    EDIT: 'contract:edit',
    DELETE: 'contract:delete',
    APPROVE: 'contract:approve',
    SIGN: 'contract:sign',
  },
  FINANCE: {
    VIEW: 'finance:view',
    CREATE: 'finance:create',
    EDIT: 'finance:edit',
    CONFIRM: 'finance:confirm',
    REFUND: 'finance:refund',
    EXPORT: 'finance:export',
  },
  BOOTH: {
    VIEW: 'booth:view',
    EDIT: 'booth:edit',
    ALLOCATE: 'booth:allocate',
  },
  PROVIDER: {
    VIEW: 'provider:view',
    APPROVE: 'provider:approve',
    DISPATCH: 'provider:dispatch',
  },
  SYSTEM: {
    USER: 'system:user',
    ROLE: 'system:role',
    LOG: 'system:log',
    BACKUP: 'system:backup',
  },
} as const;
