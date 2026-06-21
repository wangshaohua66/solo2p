import { create } from 'zustand';
import type { RevenueData, SalesAlert, DashboardStats, VenueStats, TicketType } from '@/types';
import { revenueData as mockRevenueData, salesAlerts as mockAlerts, dashboardStats as mockStats, venueStats as mockVenueStats, ticketTypes as mockTickets } from '@/mock';

interface DashboardState {
  revenueData: RevenueData[];
  salesAlerts: SalesAlert[];
  stats: DashboardStats;
  venueStats: VenueStats[];
  ticketTypes: TicketType[];
  selectedPeriod: 'day' | 'week' | 'month' | 'quarter' | 'year';
  isLoading: boolean;
  
  setSelectedPeriod: (period: DashboardState['selectedPeriod']) => void;
  loadDashboardData: () => void;
  resolveAlert: (alertId: string) => void;
  getRevenueByVenue: (venueId: string) => number;
  getRevenueByEventType: (type: string) => number;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  revenueData: mockRevenueData,
  salesAlerts: mockAlerts,
  stats: mockStats,
  venueStats: mockVenueStats,
  ticketTypes: mockTickets,
  selectedPeriod: 'month',
  isLoading: false,

  setSelectedPeriod: (period) => set({ selectedPeriod: period }),

  loadDashboardData: () => {
    set({ isLoading: true });
    setTimeout(() => {
      set({ isLoading: false });
    }, 800);
  },

  resolveAlert: (alertId) => {
    set((state) => ({
      salesAlerts: state.salesAlerts.map((a) =>
        a.id === alertId ? { ...a, resolved: true } : a
      ),
      stats: {
        ...state.stats,
        activeAlerts: state.stats.activeAlerts - 1,
      },
    }));
  },

  getRevenueByVenue: (venueId) => {
    return get()
      .revenueData.filter((d) => d.venueId === venueId)
      .reduce((sum, d) => sum + d.revenue, 0);
  },

  getRevenueByEventType: (type) => {
    return get()
      .revenueData.filter((d) => d.eventType === type)
      .reduce((sum, d) => sum + d.revenue, 0);
  },
}));
