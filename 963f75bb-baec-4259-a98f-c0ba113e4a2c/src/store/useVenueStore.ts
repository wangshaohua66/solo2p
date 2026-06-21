import { create } from 'zustand';
import type { Venue, Resource, Equipment } from '@/types';
import { venues as mockVenues, resources as mockResources, equipmentList as mockEquipment } from '@/mock';

interface VenueState {
  venues: Venue[];
  resources: Resource[];
  equipment: Equipment[];
  selectedVenueId: string;
  selectedResourceId: string | null;
  isResourcePanelOpen: boolean;
  equipmentMode: 'sports' | 'concert';
  
  setSelectedVenueId: (id: string) => void;
  setSelectedResourceId: (id: string | null) => void;
  toggleResourcePanel: () => void;
  setResourcePanelOpen: (open: boolean) => void;
  setEquipmentMode: (mode: 'sports' | 'concert') => void;
  
  getResourcesByVenue: (venueId: string) => Resource[];
  getResourcesByType: (venueId: string, type: string) => Resource[];
  getEquipmentByVenue: (venueId: string) => Equipment[];
  
  updateResourceStatus: (resourceId: string, status: Resource['status']) => void;
}

export const useVenueStore = create<VenueState>((set, get) => ({
  venues: mockVenues,
  resources: mockResources,
  equipment: mockEquipment,
  selectedVenueId: mockVenues[0]?.id || '',
  selectedResourceId: null,
  isResourcePanelOpen: true,
  equipmentMode: 'sports',

  setSelectedVenueId: (id) => set({ selectedVenueId: id, selectedResourceId: null }),
  setSelectedResourceId: (id) => set({ selectedResourceId: id }),
  toggleResourcePanel: () => set((state) => ({ isResourcePanelOpen: !state.isResourcePanelOpen })),
  setResourcePanelOpen: (open) => set({ isResourcePanelOpen: open }),
  setEquipmentMode: (mode) => set({ equipmentMode: mode }),

  getResourcesByVenue: (venueId) => {
    return get().resources.filter((r) => r.venueId === venueId);
  },

  getResourcesByType: (venueId, type) => {
    return get().resources.filter((r) => r.venueId === venueId && r.type === type);
  },

  getEquipmentByVenue: (venueId) => {
    return get().equipment.filter((e) => e.venueId === venueId);
  },

  updateResourceStatus: (resourceId, status) => {
    set((state) => ({
      resources: state.resources.map((r) =>
        r.id === resourceId ? { ...r, status } : r
      ),
    }));
  },
}));
