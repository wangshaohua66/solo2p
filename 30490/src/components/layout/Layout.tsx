import { useEffect, useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import Header from './Header';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return CheckCircle2;
    case 'error':
      return XCircle;
    case 'warning':
      return AlertTriangle;
    case 'info':
    default:
      return Info;
  }
};

export const Layout = () => {
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const { setSidebarCollapsed } = useSettingsStore((s) => s.actions);
  const toasts = useUIStore((s) => s.toasts);
  const { dismissToast } = useUIStore((s) => s.actions);

  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const mobile = width < 768;
    const tablet = width >= 768 && width < 1280;

    setIsMobile(mobile);
    setIsTablet(tablet);

    if (mobile) {
      setSidebarCollapsed(true);
    } else if (tablet) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }
  }, [setSidebarCollapsed]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (isMobile && !sidebarCollapsed) {
      setMobileMenuOpen(true);
    } else if (!isMobile) {
      setMobileMenuOpen(false);
    }
  }, [sidebarCollapsed, isMobile]);

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false);
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  const toastItems: Toast[] = toasts.map((t) => ({
    id: t.id,
    message: t.message,
    type: t.type as ToastType,
  }));

  return (
    <div className={styles.layout}>
      <Header />
      <Sidebar mobileOpen={isMobile && mobileMenuOpen} onMobileClose={handleMobileClose} />

      <main className={`${styles.main} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      <div className={styles.toastContainer} role="region" aria-label="通知">
        {toastItems.map((toast) => {
          const Icon = getToastIcon(toast.type);
          return (
            <div key={toast.id} className={styles.toastItem}>
              <Icon className={`${styles.toastIcon} ${styles[toast.type]}`} />
              <span className={styles.toastMessage}>{toast.message}</span>
              <button
                type="button"
                className={styles.toastClose}
                onClick={() => dismissToast(toast.id)}
                aria-label="关闭通知"
              >
                <X className={styles.closeIcon} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Layout;
