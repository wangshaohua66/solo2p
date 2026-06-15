import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Map, ClipboardList, BarChart3, Settings, Bell } from 'lucide-react';
import { useWorkOrderStore } from '@/stores/workorderStore';
import { useEffect } from 'react';
import styles from './Layout.module.css';

export default function Layout() {
  const location = useLocation();
  const { unreadCount, connectNotifyWebSocket, disconnectNotifyWebSocket } = useWorkOrderStore();

  useEffect(() => {
    connectNotifyWebSocket();
    return () => disconnectNotifyWebSocket();
  }, [connectNotifyWebSocket, disconnectNotifyWebSocket]);

  const navItems = [
    { to: '/patrol', label: '巡查管理', icon: Map },
    { to: '/workorders', label: '工单管理', icon: ClipboardList },
    { to: '/statistics', label: '统计分析', icon: BarChart3 },
    { to: '/admin', label: '系统管理', icon: Settings }
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/patrol':
        return '巡查管理';
      case '/workorders':
        return '工单管理';
      case '/statistics':
        return '统计分析';
      case '/admin':
        return '系统管理';
      default:
        return '道路病害管理系统';
    }
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h1 className={styles.logo}>道路病害管理系统</h1>
        </div>
        <nav className={styles.navMenu}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={styles.mainContainer}>
        <header className={styles.topbar}>
          <h2 className={styles.pageTitle}>{getPageTitle()}</h2>
          <div className={styles.topbarActions}>
            <button className={styles.notificationBtn}>
              <Bell size={20} />
              {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
            </button>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
