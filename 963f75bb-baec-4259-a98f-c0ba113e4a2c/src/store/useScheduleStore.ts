import { create } from 'zustand';
import type { EventItem, ScheduleSlot, ConflictResult, ScheduleSuggestion } from '@/types';
import { events as mockEvents } from '@/mock';
import { detectConflicts } from '@/utils/conflictDetection';

interface ScheduleState {
  events: EventItem[];
  slots: ScheduleSlot[];
  selectedEventId: string | null;
  conflictResult: ConflictResult | null;
  isLoading: boolean;
  currentVenueId: string | null;
  setCurrentVenueId: (venueId: string | null) => void;
  selectEvent: (eventId: string | null) => void;
  getEventsByVenue: (venueId: string) => EventItem[];
  getEventsByDate: (date: Date) => EventItem[];
  checkConflicts: (eventData: Partial<EventItem>) => ConflictResult;
  addEvent: (event: EventItem) => void;
  updateEvent: (eventId: string, updates: Partial<EventItem>) => void;
  deleteEvent: (eventId: string) => void;
  loadEvents: () => void;
  suggestions: ScheduleSuggestion[];
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  events: mockEvents,
  slots: [],
  selectedEventId: null,
  conflictResult: null,
  isLoading: false,
  currentVenueId: null,
  suggestions: [],

  setCurrentVenueId: (venueId) => set({ currentVenueId: venueId }),

  selectEvent: (eventId) => set({ selectedEventId: eventId }),

  getEventsByVenue: (venueId) => {
    return get().events.filter((e) => e.venueId === venueId);
  },

  getEventsByDate: (date) => {
    const dateStr = date.toDateString();
    return get().events.filter((e) => {
      const start = new Date(e.startDate).toDateString();
      const end = new Date(e.endDate).toDateString();
      return dateStr >= start && dateStr <= end;
    });
  },

  checkConflicts: (eventData) => {
    const result = detectConflicts(eventData, get().events);
    set({ conflictResult: result, suggestions: result.suggestions });
    return result;
  },

  addEvent: (event) => {
    set((state) => ({ events: [...state.events, event] }));
  },

  updateEvent: (eventId, updates) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId ? { ...e, ...updates } : e
      ),
    }));
  },

  deleteEvent: (eventId) => {
    set((state) => ({
      events: state.events.filter((e) => e.id !== eventId),
    }));
  },

  loadEvents: () => {
    set({ isLoading: true });
    setTimeout(() => {
      set({ events: mockEvents, isLoading: false });
    }, 500);
  },
}));
