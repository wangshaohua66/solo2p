import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import type {
  Substation,
  Equipment,
  TransmissionLine,
  AdjacencyMap,
  PowerSupplyPath,
} from '@/types';
import {
  buildAdjacencyMap,
  findPowerSupplyPaths,
} from '@/utils/topologyAnalyzer';
import { mockSubstations } from '@/data/mockSubstations';
import { mockLines } from '@/data/mockLines';
import { mockEquipment } from '@/data/mockEquipment';

interface EquipmentState {
  substations: Substation[];
  lines: TransmissionLine[];
  equipments: Equipment[];
  loading: boolean;
  adjacencyMap: AdjacencyMap;
  selectedEquipmentId: string | null;
  highlightPath: PowerSupplyPath[];
}

interface EquipmentActions {
  initData: () => Promise<void>;
  selectEquipment: (id: string) => void;
  clearSelection: () => void;
}

export type EquipmentStore = EquipmentState & EquipmentActions;

const EQUIPMENT_CACHE_KEY = 'equipment_store_cache_v2_202607';
const CACHE_TTL = 1000 * 60 * 60;

const initialState: EquipmentState = {
  substations: [],
  lines: [],
  equipments: [],
  loading: false,
  adjacencyMap: new Map(),
  selectedEquipmentId: null,
  highlightPath: [],
};

const loadFromCache = (): EquipmentState | null => {
  try {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem(EQUIPMENT_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    const { timestamp, data } = parsed;
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(EQUIPMENT_CACHE_KEY);
      return null;
    }
    return {
      ...data,
      adjacencyMap: new Map(data.adjacencyMap),
    };
  } catch {
    return null;
  }
};

const saveToCache = (state: EquipmentState): void => {
  try {
    if (typeof window === 'undefined') return;
    const data = {
      ...state,
      adjacencyMap: Array.from(state.adjacencyMap.entries()),
    };
    localStorage.setItem(
      EQUIPMENT_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // ignore
  }
};

export const useEquipmentStore = create<EquipmentStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      initData: async () => {
        set({ loading: true });

        const cached = loadFromCache();
        if (
          cached &&
          cached.substations.length > 0 &&
          cached.adjacencyMap.size > 0
        ) {
          set({
            substations: cached.substations,
            lines: cached.lines,
            equipments: cached.equipments,
            adjacencyMap: cached.adjacencyMap,
            loading: false,
          });
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        const substations = [...mockSubstations];
        const lines = [...mockLines];
        const equipments = [...mockEquipment];
        const adjacencyMap = buildAdjacencyMap(substations, lines, equipments);

        const newState: EquipmentState = {
          substations,
          lines,
          equipments,
          adjacencyMap,
          loading: false,
          selectedEquipmentId: null,
          highlightPath: [],
        };

        set(newState);
        saveToCache(newState);
      },

      selectEquipment: (id: string) => {
        const state = get();
        const paths = findPowerSupplyPaths(
          id,
          state.adjacencyMap,
          state.substations
        );
        set({
          selectedEquipmentId: id,
          highlightPath: paths,
        });
      },

      clearSelection: () => {
        set({
          selectedEquipmentId: null,
          highlightPath: [],
        });
      },
    }),
    {
      name: 'equipment-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

export const useEquipmentSelector = <T,>(
  selector: (state: EquipmentStore) => T
): T => useEquipmentStore(selector, shallow);
