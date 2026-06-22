import apiClient from './apiClient';
import type { Venue, Resource, Equipment } from '@/types';

export interface VenueStatsResponse {
  venueId: string;
  venueName: string;
  eventsCount: number;
  revenue: number;
  utilization: number;
  capacity: number;
}

export interface ResourceHeatmapData {
  resourceId: string;
  resourceName: string;
  utilization: number;
  status: 'available' | 'occupied' | 'maintenance' | 'transitioning';
  hourlyData: number[];
}

export const venueApi = {
  getVenues: (): Promise<Venue[]> => {
    return apiClient.get('/venues').then(res => res.data);
  },

  getVenueById: (id: string): Promise<Venue> => {
    return apiClient.get(`/venues/${id}`).then(res => res.data);
  },

  createVenue: (data: Omit<Venue, 'id'>): Promise<Venue> => {
    return apiClient.post('/venues', data).then(res => res.data);
  },

  updateVenue: (id: string, data: Partial<Venue>): Promise<Venue> => {
    return apiClient.put(`/venues/${id}`, data).then(res => res.data);
  },

  deleteVenue: (id: string): Promise<void> => {
    return apiClient.delete(`/venues/${id}`).then(res => res.data);
  },

  getVenueResources: (venueId: string): Promise<Resource[]> => {
    return apiClient.get(`/venues/${venueId}/resources`).then(res => res.data);
  },

  getVenueEquipment: (venueId: string): Promise<Equipment[]> => {
    return apiClient.get(`/venues/${venueId}/equipment`).then(res => res.data);
  },

  getVenueStats: (venueId: string, period?: string): Promise<VenueStatsResponse> => {
    const params = period ? { period } : {};
    return apiClient.get(`/venues/${venueId}/stats`, { params }).then(res => res.data);
  },

  getAllVenueStats: (period?: string): Promise<VenueStatsResponse[]> => {
    const params = period ? { period } : {};
    return apiClient.get('/venues/stats', { params }).then(res => res.data);
  },

  getResourceHeatmap: (venueId: string, date?: string): Promise<ResourceHeatmapData[]> => {
    const params = date ? { date } : {};
    return apiClient.get(`/venues/${venueId}/resources/heatmap`, { params }).then(res => res.data);
  },
};
