import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAppStore } from '@/store';
import clsx from 'clsx';

export default function Layout() {
  const { sidebarCollapsed, token, loadWarningStats } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
    else loadWarningStats();
  }, [token, navigate, loadWarningStats]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className={clsx('transition-all duration-200', sidebarCollapsed ? 'ml-16' : 'ml-60')}>
        <Topbar />
        <main className="p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
