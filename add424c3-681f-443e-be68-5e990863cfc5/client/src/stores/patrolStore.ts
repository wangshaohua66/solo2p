import { create } from 'zustand';
import {
  reportTrack as apiReportTrack,
  getPatrolTracks as apiGetPatrolTracks,
  getCoverage as apiGetCoverage,
  type ReportTrackParams,
  type CoverageResponse
} from '@/services/api';
import type { TrackPoint } from '@/types';
import { patrolSocket } from '@/services/websocket';

export interface RoadCoverageItem {
  roadSectionId: string;
  roadSectionName: string;
  coverageRate: number;
}

interface PatrolState {
  trackPoints: TrackPoint[];
  currentInspectorId: string | null;
  currentPatrolId: string;
  wsConnected: boolean;
  loading: boolean;
  error: string | null;
  coverageList: RoadCoverageItem[];
  coverageData: CoverageResponse | null;

  startPatrol: (inspectorId: string) => void;
  disconnectPatrolWebSocket: () => void;
  addTrackPoint: (point: ReportTrackParams) => Promise<void>;
  fetchTrackPoints: (patrolId: string) => Promise<void>;
  fetchCoverage: () => Promise<void>;
  clearError: () => void;
}

const ROAD_NAMES: Record<string, string> = {
  'road-001': 'G104国道北京段',
  'road-002': 'S302省道密云段',
  'road-003': 'G205国道通州段',
  'road-004': 'S201省道昌平段',
  'road-005': 'G108国道房山段'
};

export const usePatrolStore = create<PatrolState>((set, get) => ({
  trackPoints: [],
  currentInspectorId: null,
  currentPatrolId: 'default',
  wsConnected: false,
  loading: false,
  error: null,
  coverageList: [],
  coverageData: null,

  startPatrol: (inspectorId) => {
    set({ currentInspectorId: inspectorId, error: null });
    const patrolId = `patrol-${inspectorId}-${Date.now()}`;
    set({ currentPatrolId: patrolId });

    patrolSocket.connect();
    patrolSocket.onConnection((connected) => {
      set({ wsConnected: connected });
    });
    patrolSocket.onTrackPoint((point) => {
      set((state) => ({ trackPoints: [...state.trackPoints, point] }));
    });

    if (!patrolSocket.isConnected()) {
      setTimeout(() => {
        if (patrolSocket.isConnected()) {
          set({ wsConnected: true });
        }
      }, 1000);
    } else {
      set({ wsConnected: true });
    }
  },

  disconnectPatrolWebSocket: () => {
    patrolSocket.disconnect();
    set({ wsConnected: false, currentInspectorId: null });
  },

  addTrackPoint: async (point) => {
    set({ loading: true, error: null });
    try {
      const patrolId = get().currentPatrolId;
      const data = await apiReportTrack({ ...point, patrolId });
      const state = get();
      set({ trackPoints: [...state.trackPoints, data], loading: false });

      if (patrolSocket.isConnected()) {
        patrolSocket.reportTrack(point);
      }
    } catch (e: any) {
      set({ error: e.message || '上报轨迹点失败', loading: false });
    }
  },

  fetchTrackPoints: async (patrolId) => {
    set({ loading: true, error: null });
    try {
      const points = await apiGetPatrolTracks({ patrolId });
      set({ trackPoints: points, loading: false });
    } catch (e: any) {
      set({ error: e.message || '获取轨迹失败', loading: false });
    }
  },

  fetchCoverage: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiGetCoverage();
      const list: RoadCoverageItem[] = Object.keys(ROAD_NAMES).map((id) => ({
        roadSectionId: id,
        roadSectionName: ROAD_NAMES[id],
        coverageRate: data.coveredSectionIds.includes(id)
          ? data.coverageRate
          : data.coverageRate * 0.2 * Math.random()
      }));
      list[0].coverageRate = data.coverageRate;
      set({
        coverageList: list,
        coverageData: data,
        loading: false
      });
    } catch (e: any) {
      set({ error: e.message || '获取覆盖率失败', loading: false });
    }
  },

  clearError: () => set({ error: null })
}));
