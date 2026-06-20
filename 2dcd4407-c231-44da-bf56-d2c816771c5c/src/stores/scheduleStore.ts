import { create } from 'zustand';
import type { Schedule, Venue, ScheduleConflict, PageResult, ScheduleStatus } from '../types';
import { scheduleApi } from '../services/scheduleApi';

interface ScheduleState {
  schedules: Schedule[];
  venues: Venue[];
  currentSchedule: Schedule | null;
  selectedVenueIds: string[];
  dateRange: { start: string; end: string };
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  conflictInfo: ScheduleConflict | null;

  fetchSchedules: (params?: Record<string, unknown>) => Promise<void>;
  fetchVenues: () => Promise<void>;
  fetchScheduleById: (id: string) => Promise<Schedule>;
  createSchedule: (data: Partial<Schedule>) => Promise<Schedule>;
  updateSchedule: (id: string, data: Partial<Schedule>) => Promise<Schedule>;
  deleteSchedule: (id: string) => Promise<void>;
  approveSchedule: (id: string, status?: ScheduleStatus, comment?: string) => Promise<Schedule>;
  lockSchedule: (id: string, locked?: boolean) => Promise<Schedule>;
  cancelSchedule: (id: string, reason?: string) => Promise<Schedule>;
  checkConflict: (scheduleId: string, startDate: string, endDate: string, venueIds: string[]) => Promise<ScheduleConflict>;
  setCurrentSchedule: (schedule: Schedule | null) => void;
  setDateRange: (range: { start: string; end: string }) => void;
  setSelectedVenueIds: (ids: string[]) => void;
  setPagination: (page: number, pageSize: number) => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  venues: [],
  currentSchedule: null,
  selectedVenueIds: [],
  dateRange: { start: '', end: '' },
  loading: false,
  total: 0,
  page: 1,
  pageSize: 20,
  conflictInfo: null,

  fetchSchedules: async (params = {}) => {
    set({ loading: true });
    try {
      const { page, pageSize } = get();
      const response = await scheduleApi.getList({
        page,
        pageSize,
        ...params,
      }) as unknown as PageResult<Schedule>;
      set({
        schedules: response.data,
        total: response.total,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  fetchVenues: async () => {
    set({ loading: true });
    try {
      const venues = await scheduleApi.getVenues();
      set({ venues, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  fetchScheduleById: async (id: string) => {
    set({ loading: true });
    try {
      const schedule = await scheduleApi.getById(id);
      set({ currentSchedule: schedule, loading: false });
      return schedule;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  createSchedule: async (data: Partial<Schedule>) => {
    set({ loading: true });
    try {
      const schedule = await scheduleApi.create(data);
      set((state) => ({
        schedules: [schedule, ...state.schedules],
        loading: false,
      }));
      return schedule;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  updateSchedule: async (id: string, data: Partial<Schedule>) => {
    set({ loading: true });
    try {
      const schedule = await scheduleApi.update(id, data);
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? schedule : s)),
        currentSchedule: state.currentSchedule?.id === id ? schedule : state.currentSchedule,
        loading: false,
      }));
      return schedule;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  deleteSchedule: async (id: string) => {
    set({ loading: true });
    try {
      await scheduleApi.delete(id);
      set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  approveSchedule: async (id: string, status: ScheduleStatus = 'approved', comment = '') => {
    set({ loading: true });
    try {
      const schedule = await scheduleApi.approve(id, status, comment);
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? schedule : s)),
        currentSchedule: state.currentSchedule?.id === id ? schedule : state.currentSchedule,
        loading: false,
      }));
      return schedule;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  lockSchedule: async (id: string, locked = true) => {
    set({ loading: true });
    try {
      const schedule = await scheduleApi.lock(id, locked);
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? schedule : s)),
        loading: false,
      }));
      return schedule;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  cancelSchedule: async (id: string, reason = '') => {
    set({ loading: true });
    try {
      const schedule = await scheduleApi.cancel(id, reason);
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? schedule : s)),
        loading: false,
      }));
      return schedule;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  checkConflict: async (scheduleId: string, startDate: string, endDate: string, venueIds: string[]) => {
    try {
      const conflict = await scheduleApi.checkConflict(scheduleId, startDate, endDate, venueIds);
      set({ conflictInfo: conflict });
      return conflict;
    } catch (error) {
      throw error;
    }
  },

  setCurrentSchedule: (schedule: Schedule | null) => {
    set({ currentSchedule: schedule });
  },

  setDateRange: (range: { start: string; end: string }) => {
    set({ dateRange: range });
  },

  setSelectedVenueIds: (ids: string[]) => {
    set({ selectedVenueIds: ids });
  },

  setPagination: (page: number, pageSize: number) => {
    set({ page, pageSize });
  },
}));
