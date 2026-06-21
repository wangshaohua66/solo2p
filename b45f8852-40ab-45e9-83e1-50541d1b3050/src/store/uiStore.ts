import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import type { SidebarMode, GanttZoom } from '@/types';

interface UIState {
  sidebarCollapsed: boolean;
  sidebarMode: SidebarMode;
  conflictSidebarOpen: boolean;
  activeTabKey: string;
  ganttZoom: GanttZoom;
  conflictDetailId: string | null;
  breakpoint: 'xl' | 'lg' | 'md' | 'sm';
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setConflictSidebarOpen: (open: boolean) => void;
  setActiveTab: (key: string) => void;
  setGanttZoom: (zoom: GanttZoom) => void;
  setConflictDetailId: (id: string | null) => void;
  handleResize: () => void;
  initResizeListener: () => () => void;
}

export type UIStore = UIState & UIActions;

const BREAKPOINT_XL = 1440;
const BREAKPOINT_LG = 1024;
const BREAKPOINT_MD = 768;

const getInitialSidebarMode = (): SidebarMode => {
  if (typeof window === 'undefined') return 'full';
  const width = window.innerWidth;
  if (width >= BREAKPOINT_XL) return 'full';
  if (width >= BREAKPOINT_LG) return 'icon';
  if (width >= BREAKPOINT_MD) return 'top';
  return 'top';
};

const getInitialBreakpoint = (): UIState['breakpoint'] => {
  if (typeof window === 'undefined') return 'xl';
  const width = window.innerWidth;
  if (width >= BREAKPOINT_XL) return 'xl';
  if (width >= BREAKPOINT_LG) return 'lg';
  if (width >= BREAKPOINT_MD) return 'md';
  return 'sm';
};

const initialState: Omit<UIState, 'breakpoint'> & {
  breakpoint: UIState['breakpoint'];
} = {
  sidebarCollapsed: false,
  sidebarMode: getInitialSidebarMode(),
  conflictSidebarOpen: false,
  activeTabKey: 'plan',
  ganttZoom: 'week',
  conflictDetailId: null,
  breakpoint: getInitialBreakpoint(),
};

let resizeHandler: (() => void) | null = null;
let isResizeListenerInitialized = false;

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarMode: (mode) => {
        set({ sidebarMode: mode });
      },

      setConflictSidebarOpen: (open) => {
        set({ conflictSidebarOpen: open });
      },

      setActiveTab: (key) => {
        set({ activeTabKey: key });
      },

      setGanttZoom: (zoom) => {
        set({ ganttZoom: zoom });
      },

      setConflictDetailId: (id) => {
        set({ conflictDetailId: id });
      },

      handleResize: () => {
        if (typeof window === 'undefined') return;

        const width = window.innerWidth;
        let newMode: SidebarMode;
        let newBreakpoint: UIState['breakpoint'];

        if (width >= BREAKPOINT_XL) {
          newMode = 'full';
          newBreakpoint = 'xl';
        } else if (width >= BREAKPOINT_LG) {
          newMode = 'icon';
          newBreakpoint = 'lg';
        } else if (width >= BREAKPOINT_MD) {
          newMode = 'top';
          newBreakpoint = 'md';
        } else {
          newMode = 'top';
          newBreakpoint = 'sm';
        }

        const state = get();
        if (
          state.sidebarMode !== newMode ||
          state.breakpoint !== newBreakpoint
        ) {
          set({
            sidebarMode: newMode,
            breakpoint: newBreakpoint,
            sidebarCollapsed: newMode === 'icon' ? false : state.sidebarCollapsed,
          });
        }
      },

      initResizeListener: () => {
        if (typeof window === 'undefined') {
          return () => {};
        }

        if (isResizeListenerInitialized && resizeHandler) {
          return () => {
            if (resizeHandler) {
              window.removeEventListener('resize', resizeHandler);
            }
            isResizeListenerInitialized = false;
          };
        }

        resizeHandler = () => {
          get().handleResize();
        };

        window.addEventListener('resize', resizeHandler, { passive: true });
        isResizeListenerInitialized = true;

        get().handleResize();

        return () => {
          if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
            resizeHandler = null;
          }
          isResizeListenerInitialized = false;
        };
      },
    }),
    {
      name: 'ui-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

export const useUISelector = <T,>(
  selector: (state: UIStore) => T
): T => useUIStore(selector, shallow);
