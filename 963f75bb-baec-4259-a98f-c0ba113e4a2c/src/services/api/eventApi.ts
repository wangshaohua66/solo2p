import apiClient from './apiClient';
import type { EventItem, ConflictResult, ScheduleSuggestion } from '@/types';

export interface CreateEventRequest {
  venueId: string;
  name: string;
  type: string;
  startDate: Date;
  endDate: Date;
  organizer: string;
  expectedRevenue: number;
  requiredResources: string[];
  description: string;
  equipmentMode: 'sports' | 'concert';
}

export interface UpdateEventRequest {
  name?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  organizer?: string;
  expectedRevenue?: number;
  description?: string;
}

export const eventApi = {
  getEvents: (params?: { venueId?: string; startDate?: string; endDate?: string; status?: string; type?: string }): Promise<EventItem[]> => {
    return apiClient.get('/events', { params }).then(res => res.data);
  },

  getEventById: (id: string): Promise<EventItem> => {
    return apiClient.get(`/events/${id}`).then(res => res.data);
  },

  createEvent: (data: CreateEventRequest): Promise<EventItem> => {
    return apiClient.post('/events', data).then(res => res.data);
  },

  updateEvent: (id: string, data: UpdateEventRequest): Promise<EventItem> => {
    return apiClient.put(`/events/${id}`, data).then(res => res.data);
  },

  deleteEvent: (id: string): Promise<void> => {
    return apiClient.delete(`/events/${id}`).then(res => res.data);
  },

  checkConflicts: (data: { venueId: string; startDate: Date; endDate: Date; excludeEventId?: string }): Promise<ConflictResult> => {
    return apiClient.post('/events/check-conflicts', data).then(res => res.data);
  },

  getSuggestions: (data: { venueId: string; startDate: Date; endDate: Date }): Promise<ScheduleSuggestion[]> => {
    return apiClient.post('/events/suggestions', data).then(res => res.data);
  },

  submitApproval: (eventId: string): Promise<EventItem> => {
    return apiClient.post(`/events/${eventId}/submit-approval`).then(res => res.data);
  },

  approveEvent: (eventId: string, stepId: string, comment?: string): Promise<EventItem> => {
    return apiClient.post(`/events/${eventId}/approve`, { stepId, comment }).then(res => res.data);
  },

  rejectEvent: (eventId: string, stepId: string, comment: string): Promise<EventItem> => {
    return apiClient.post(`/events/${eventId}/reject`, { stepId, comment }).then(res => res.data);
  },
};
