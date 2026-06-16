import { create } from 'zustand';
import { Incident, DispatchPlan, Notification, RescueTeam, Warehouse, MapPoint, IncidentStatistics, TimelineEvent } from '@/types';

interface CommandState {
  incidents: Incident[];
  currentIncident: Incident | null;
  dispatchPlans: DispatchPlan[];
  notifications: Notification[];
  teams: RescueTeam[];
  warehouses: Warehouse[];
  mapPoints: MapPoint[];
  statistics: IncidentStatistics;
  timelineEvents: TimelineEvent[];
  selectedTime: Date;
  isPlayingTimeline: boolean;
  filters: {
    incidentType: number | null;
    incidentLevel: number | null;
    incidentStatus: number | null;
    regionCode: string | null;
    dateRange: [string, string] | null;
  };
  setIncidents: (incidents: Incident[]) => void;
  setCurrentIncident: (incident: Incident | null) => void;
  setDispatchPlans: (plans: DispatchPlan[]) => void;
  setNotifications: (notifications: Notification[]) => void;
  setTeams: (teams: RescueTeam[]) => void;
  setWarehouses: (warehouses: Warehouse[]) => void;
  setMapPoints: (points: MapPoint[]) => void;
  setStatistics: (stats: IncidentStatistics) => void;
  setTimelineEvents: (events: TimelineEvent[]) => void;
  setSelectedTime: (time: Date) => void;
  setIsPlayingTimeline: (playing: boolean) => void;
  setFilters: (filters: Partial<CommandState['filters']>) => void;
  addNotification: (notification: Notification) => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  incidents: [],
  currentIncident: null,
  dispatchPlans: [],
  notifications: [],
  teams: [],
  warehouses: [],
  mapPoints: [],
  statistics: {
    total: 0,
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    pending: 0,
    responding: 0,
    handling: 0,
    closed: 0,
  },
  timelineEvents: [],
  selectedTime: new Date(),
  isPlayingTimeline: false,
  filters: {
    incidentType: null,
    incidentLevel: null,
    incidentStatus: null,
    regionCode: null,
    dateRange: null,
  },
  setIncidents: (incidents) => set({ incidents }),
  setCurrentIncident: (currentIncident) => set({ currentIncident }),
  setDispatchPlans: (dispatchPlans) => set({ dispatchPlans }),
  setNotifications: (notifications) => set({ notifications }),
  setTeams: (teams) => set({ teams }),
  setWarehouses: (warehouses) => set({ warehouses }),
  setMapPoints: (mapPoints) => set({ mapPoints }),
  setStatistics: (statistics) => set({ statistics }),
  setTimelineEvents: (timelineEvents) => set({ timelineEvents }),
  setSelectedTime: (selectedTime) => set({ selectedTime }),
  setIsPlayingTimeline: (isPlayingTimeline) => set({ isPlayingTimeline }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
}));
