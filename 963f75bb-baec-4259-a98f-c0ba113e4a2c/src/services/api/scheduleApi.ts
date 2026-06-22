import apiClient from './apiClient';
import type { ScheduleSlot } from '@/types';

export interface ScheduleSlotRequest {
  eventId: string;
  resourceId: string;
  startTime: Date;
  endTime: Date;
}

export interface LockSlotRequest {
  slotId: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export const scheduleApi = {
  getScheduleSlots: (params?: { venueId?: string; startDate?: string; endDate?: string; resourceId?: string; eventId?: string }): Promise<ScheduleSlot[]> => {
    return apiClient.get('/schedule/slots', { params }).then(res => res.data);
  },

  getSlotById: (id: string): Promise<ScheduleSlot> => {
    return apiClient.get(`/schedule/slots/${id}`).then(res => res.data);
  },

  createSlot: (data: ScheduleSlotRequest): Promise<ScheduleSlot> => {
    return apiClient.post('/schedule/slots', data).then(res => res.data);
  },

  updateSlot: (id: string, data: Partial<ScheduleSlotRequest>): Promise<ScheduleSlot> => {
    return apiClient.put(`/schedule/slots/${id}`, data).then(res => res.data);
  },

  deleteSlot: (id: string): Promise<void> => {
    return apiClient.delete(`/schedule/slots/${id}`).then(res => res.data);
  },

  lockSlot: (data: LockSlotRequest): Promise<ScheduleSlot> => {
    return apiClient.post('/schedule/slots/lock', data).then(res => res.data);
  },

  unlockSlot: (slotId: string): Promise<ScheduleSlot> => {
    return apiClient.post(`/schedule/slots/${slotId}/unlock`).then(res => res.data);
  },

  confirmSlot: (slotId: string): Promise<ScheduleSlot> => {
    return apiClient.post(`/schedule/slots/${slotId}/confirm`).then(res => res.data);
  },

  getMonthSchedule: (venueId: string, year: number, month: number): Promise<ScheduleSlot[]> => {
    return apiClient.get(`/schedule/venues/${venueId}/month/${year}/${month}`).then(res => res.data);
  },

  getWeekSchedule: (venueId: string, date: string): Promise<ScheduleSlot[]> => {
    return apiClient.get(`/schedule/venues/${venueId}/week`, { params: { date } }).then(res => res.data);
  },

  batchCreateSlots: (data: ScheduleSlotRequest[]): Promise<ScheduleSlot[]> => {
    return apiClient.post('/schedule/slots/batch', data).then(res => res.data);
  },
};
