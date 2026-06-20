import { api } from './api';
import type { Schedule, Venue, ScheduleConflict, ScheduleStatus } from '../types';
import { generateMockSchedules, generateMockVenues } from '../utils/mockData';

const USE_MOCK = true;

export const scheduleApi = {
  getList: async (params: Record<string, unknown> = {}) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const page = params.page as number || 1;
      const pageSize = params.pageSize as number || 20;
      const all = generateMockSchedules(100);
      const filtered = params.status 
        ? all.filter(s => s.status === params.status)
        : all;
      const start = (page - 1) * pageSize;
      return {
        data: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
      };
    }
    return api.get('/schedules', { params });
  },

  getVenues: async () => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return generateMockVenues();
    }
    return api.get<Venue[]>('/venues');
  },

  getById: async (id: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const schedules = generateMockSchedules(100);
      return schedules.find(s => s.id === id) || schedules[0];
    }
    return api.get<Schedule>(`/schedules/${id}`);
  },

  create: async (data: Partial<Schedule>) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        ...data,
        id: `sch-${Date.now()}`,
        status: 'pending' as ScheduleStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Schedule;
    }
    return api.post<Schedule>('/schedules', data);
  },

  update: async (id: string, data: Partial<Schedule>) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const schedules = generateMockSchedules(100);
      const schedule = schedules.find(s => s.id === id) || schedules[0];
      return { ...schedule, ...data, updatedAt: new Date().toISOString() };
    }
    return api.put<Schedule>(`/schedules/${id}`, data);
  },

  delete: async (id: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { success: true };
    }
    return api.delete(`/schedules/${id}`);
  },

  approve: async (id: string, status: ScheduleStatus, comment: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const schedules = generateMockSchedules(100);
      const schedule = schedules.find(s => s.id === id) || schedules[0];
      return { ...schedule, status, updatedAt: new Date().toISOString() };
    }
    return api.post<Schedule>(`/schedules/${id}/approve`, { status, comment });
  },

  lock: async (id: string, locked: boolean) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const schedules = generateMockSchedules(100);
      const schedule = schedules.find(s => s.id === id) || schedules[0];
      return { 
        ...schedule, 
        status: locked ? 'locked' as ScheduleStatus : 'approved' as ScheduleStatus,
        updatedAt: new Date().toISOString() 
      };
    }
    return api.post<Schedule>(`/schedules/${id}/lock`, { locked });
  },

  checkConflict: async (scheduleId: string, startDate: string, endDate: string, venueIds: string[]) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      const all = generateMockSchedules(100);
      const conflicts = all.filter(s => {
        if (s.id === scheduleId) return false;
        const hasVenue = s.venueIds.some(v => venueIds.includes(v));
        const dateOverlap = !(s.endDate < startDate || s.startDate > endDate);
        return hasVenue && dateOverlap;
      });
      return {
        hasConflict: conflicts.length > 0,
        conflicts,
      } as ScheduleConflict;
    }
    return api.get<ScheduleConflict>('/schedules/check-conflict', {
      params: { scheduleId, venueIds: venueIds.join(','), startDate, endDate },
    });
  },

  cancel: async (id: string, reason = '') => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const schedules = generateMockSchedules(100);
      const schedule = schedules.find(s => s.id === id) || schedules[0];
      return { 
        ...schedule, 
        status: 'cancelled' as ScheduleStatus,
        updatedAt: new Date().toISOString() 
      };
    }
    return api.post<Schedule>(`/schedules/${id}/cancel`, { reason });
  },
};
