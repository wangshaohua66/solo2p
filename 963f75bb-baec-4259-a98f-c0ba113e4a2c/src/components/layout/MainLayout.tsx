import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ResourcePanel } from './ResourcePanel';
import { useVenueStore } from '@/store/useVenueStore';
import { cn } from '@/utils/helpers';
import { useIsMobile } from '@/hooks/useResponsive';

export function MainLayout() {
  const { isResourcePanelOpen } = useVenueStore();
  const isMobile = useIsMobile();

  return (
    <div className="h-screen flex bg-slate-950 text-slate-100 overflow-hidden">
      <div className="relative z-30">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        
        <div className="flex-1 flex overflow-hidden">
          <main className={cn(
            'flex-1 overflow-auto transition-all duration-300',
            isResourcePanelOpen && !isMobile ? 'mr-0' : ''
          )}>
            <div className="p-6 min-h-full">
              <Outlet />
            </div>
          </main>

          {!isMobile && <ResourcePanel />}
        </div>
      </div>

      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <MobileBottomNav />
        </div>
      )}
    </div>
  );
}

function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/schedule', label: '档期', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', activeColor: 'text-cyan-400' },
    { path: '/resources', label: '资源', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', activeColor: 'text-cyan-400' },
    { path: '/events', label: '申报', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z', activeColor: 'text-cyan-400' },
    { path: '/dashboard', label: '数据', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', activeColor: 'text-cyan-400' },
    { path: '/emergency', label: '应急', icon: 'M13 10V3L4 14h7v7l9-11h-7z', activeColor: 'text-red-400' },
  ];

  return (
    <nav className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 px-2 py-2">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 transition-colors',
                isActive ? item.activeColor : 'text-slate-400'
              )}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
