import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ResourcePanel } from './ResourcePanel';
import { useVenueStore } from '@/store/useVenueStore';
import { cn } from '@/utils/helpers';
import { useIsMobile } from '@/hooks/useResponsive';
import MobileResourceDrawer from '@/components/MobileResourceDrawer';
import { Layers } from 'lucide-react';

export function MainLayout() {
  const { isResourcePanelOpen, toggleResourcePanel } = useVenueStore();
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
            <div className={cn(
              'min-h-full',
              isMobile ? 'p-4 pb-24' : 'p-6'
            )}>
              <Outlet />
            </div>
          </main>

          {!isMobile && <ResourcePanel />}
        </div>
      </div>

      {isMobile && (
        <>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            style={{
              boxShadow: '0 4px 24px rgba(6, 182, 212, 0.4)',
            }}
          >
            <Layers className="w-6 h-6" />
          </button>

          <MobileResourceDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
          />
        </>
      )}
    </div>
  );
}
