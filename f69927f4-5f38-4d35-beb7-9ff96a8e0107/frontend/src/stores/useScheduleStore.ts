import { create } from 'zustand';
import type { Schedule } from '@/types';
import * as scheduleApi from '@/api/schedule';

interface ScheduleState {
  schedules: Schedule[];
  selectedSchedule: Schedule | null;
  loading: boolean;
  fetchSchedules: (params?: Record<string, unknown>) => Promise<void>;
  createSchedule: (data: Partial<Schedule>) => Promise<void>;
  updateSchedule: (id: number, data: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: number) => Promise<void>;
  selectSchedule: (schedule: Schedule | null) => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  selectedSchedule: null,
  loading: false,

  fetchSchedules: async (params) => {
    set({ loading: true });
    try {
      const result = await scheduleApi.listSchedules(params);
      set({ schedules: result.content, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createSchedule: async (data) => {
    const newSchedule = await scheduleApi.createSchedule(data);
    set((state) => ({ schedules: [...state.schedules, newSchedule] }));
  },

  updateSchedule: async (id, data) => {
    const updated = await scheduleApi.updateSchedule(id, data);
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === id ? updated : s)),
      selectedSchedule:
        state.selectedSchedule?.id === id ? updated : state.selectedSchedule,
    }));
  },

  deleteSchedule: async (id) => {
    await scheduleApi.deleteSchedule(id);
    set((state) => ({
      schedules: state.schedules.filter((s) => s.id !== id),
      selectedSchedule:
        state.selectedSchedule?.id === id ? null : state.selectedSchedule,
    }));
  },

  selectSchedule: (schedule) => set({ selectedSchedule: schedule }),
}));
