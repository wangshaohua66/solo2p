import { useEffect, useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Library,
  Upload,
  Map,
  Clock,
  Settings,
  FileText,
  HardDrive,
} from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { translate } from '@/i18n';
import { getStorageUsage } from '@/storage/opfs';
import { formatFileSize } from '@/storage/fileOperations';
import styles from './Sidebar.module.css';

interface MenuItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  label: string;
}

interface StorageInfo {
  used: number;
  quota: number;
}

const menuItems: Omit<MenuItem, 'label'>[] = [
  { to: '/', icon: LayoutDashboard, labelKey: 'common.dashboard' },
  { to: '/library', icon: Library, labelKey: 'nav.library' },
  { to: '/upload', icon: Upload, labelKey: 'library.uploadZone' },
  { to: '/map', icon: Map, labelKey: 'nav.map' },
  { to: '/timeline', icon: Clock, labelKey: 'nav.timeline' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
  { to: '/logs', icon: FileText, labelKey: 'nav.logs' },
];

const labelFallback: Record<string, string> = {
  'common.dashboard': '仪表盘',
  'nav.library': '录音库',
  'library.uploadZone': '上传',
  'nav.map': '地图',
  'nav.timeline': '时间线',
  'nav.settings': '设置',
  'nav.logs': '操作日志',
  'settings.storageUsage': '存储使用',
};

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar = ({ mobileOpen, onMobileClose }: SidebarProps) => {
  const language = useSettingsStore((s) => s.language);
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ used: 0, quota: 0 });

  const t = (key: string) => {
    const translated = translate(language, key);
    return translated === key ? labelFallback[key] || key : translated;
  };

  useEffect(() => {
    let cancelled = false;

    const loadStorageUsage = async () => {
      try {
        const usage = await getStorageUsage();
        if (!cancelled) {
          setStorageInfo(usage);
        }
      } catch {
        if (!cancelled) {
          setStorageInfo({ used: 0, quota: 0 });
        }
      }
    };

    void loadStorageUsage();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOverlayClick = useCallback(() => {
    onMobileClose();
  }, [onMobileClose]);

  const usagePercent = storageInfo.quota > 0
    ? Math.min((storageInfo.used / storageInfo.quota) * 100, 100)
    : 0;

  const items: MenuItem[] = menuItems.map((item) => ({
    ...item,
    label: t(item.labelKey),
  }));

  return (
    <>
      <aside
        className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''} ${
          mobileOpen ? styles.mobileOpen : ''
        }`}
      >
        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                    }
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className={styles.navIcon} />
                    <span className={styles.navLabel}>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.storageSection}>
          <div className={styles.storageWrapper}>
            <div className={styles.storageHeader}>
              <span className={styles.storageLabel}>
                <HardDrive className={styles.storageIcon} />
                <span>{t('settings.storageUsage')}</span>
              </span>
            </div>
            <div className={styles.storageBar}>
              <div
                className={styles.storageProgress}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className={styles.storageNumbers}>
              <span className={styles.storageUsed}>{formatFileSize(storageInfo.used)}</span>
              <span>/</span>
              <span className={styles.storageQuota}>{formatFileSize(storageInfo.quota)}</span>
            </div>
          </div>
        </div>
      </aside>

      <div
        className={`${styles.overlay} ${mobileOpen ? styles.active : ''}`}
        onClick={handleOverlayClick}
      />
    </>
  );
};

export default Sidebar;
