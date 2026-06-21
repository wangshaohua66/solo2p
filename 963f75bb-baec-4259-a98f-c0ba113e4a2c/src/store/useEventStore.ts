import { create } from 'zustand';
import type { EventItem, ApprovalStep } from '@/types';
import { events as mockEvents } from '@/mock';

interface EventState {
  events: EventItem[];
  wizardOpen: boolean;
  currentStep: number;
  formData: Partial<EventItem>;
  
  setWizardOpen: (open: boolean) => void;
  setCurrentStep: (step: number) => void;
  setFormData: (data: Partial<EventItem>) => void;
  resetForm: () => void;
  
  submitEvent: () => Promise<boolean>;
  approveEvent: (eventId: string, role: ApprovalStep['role'], comment?: string) => void;
  rejectEvent: (eventId: string, role: ApprovalStep['role'], comment: string) => void;
  
  getPendingApprovals: (role?: ApprovalStep['role']) => EventItem[];
}

export const useEventStore = create<EventState>((set, get) => ({
  events: mockEvents,
  wizardOpen: false,
  currentStep: 0,
  formData: {
    name: '',
    type: 'football',
    venueId: '',
    startDate: new Date(),
    endDate: new Date(),
    organizer: '',
    expectedRevenue: 0,
    description: '',
    requiredResources: [],
    equipmentMode: 'sports',
    status: 'draft',
  },

  setWizardOpen: (open) => set({ wizardOpen: open }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setFormData: (data) => set((state) => ({ formData: { ...state.formData, ...data } })),
  resetForm: () =>
    set({
      formData: {
        name: '',
        type: 'football',
        venueId: '',
        startDate: new Date(),
        endDate: new Date(),
        organizer: '',
        expectedRevenue: 0,
        description: '',
        requiredResources: [],
        equipmentMode: 'sports',
        status: 'draft',
      },
      currentStep: 0,
    }),

  submitEvent: async () => {
    const { formData } = get();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const newEvent: EventItem = {
      id: `event-${Date.now()}`,
      venueId: formData.venueId || 'venue-1',
      name: formData.name || '新赛事',
      type: formData.type || 'football',
      startDate: formData.startDate || new Date(),
      endDate: formData.endDate || new Date(),
      status: 'pending_approval',
      organizer: formData.organizer || '未知',
      expectedRevenue: formData.expectedRevenue || 0,
      requiredResources: formData.requiredResources || [],
      approvalSteps: [
        {
          id: `approval-${Date.now()}-1`,
          eventId: `event-${Date.now()}`,
          role: 'dispatcher',
          status: 'pending',
          createdAt: new Date(),
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        {
          id: `approval-${Date.now()}-2`,
          eventId: `event-${Date.now()}`,
          role: 'manager',
          status: 'pending',
          createdAt: new Date(),
        },
        {
          id: `approval-${Date.now()}-3`,
          eventId: `event-${Date.now()}`,
          role: 'finance',
          status: 'pending',
          createdAt: new Date(),
        },
      ],
      description: formData.description || '',
      equipmentMode: formData.equipmentMode || 'sports',
    };

    set((state) => ({
      events: [...state.events, newEvent],
      wizardOpen: false,
    }));
    
    return true;
  },

  approveEvent: (eventId, role, comment) => {
    set((state) => ({
      events: state.events.map((event) => {
        if (event.id !== eventId) return event;
        
        const updatedSteps = event.approvalSteps.map((step) => {
          if (step.role !== role) return step;
          return {
            ...step,
            status: 'approved' as const,
            comment,
            updatedAt: new Date(),
          };
        });
        
        const allApproved = updatedSteps.every((s) => s.status === 'approved');
        
        return {
          ...event,
          approvalSteps: updatedSteps,
          status: allApproved ? 'scheduled' : 'approved',
        };
      }),
    }));
  },

  rejectEvent: (eventId, role, comment) => {
    set((state) => ({
      events: state.events.map((event) => {
        if (event.id !== eventId) return event;
        
        return {
          ...event,
          status: 'rejected',
          approvalSteps: event.approvalSteps.map((step) => {
            if (step.role !== role) return step;
            return {
              ...step,
              status: 'rejected' as const,
              comment,
              updatedAt: new Date(),
            };
          }),
        };
      }),
    }));
  },

  getPendingApprovals: (role) => {
    const { events } = get();
    return events.filter((event) => {
      if (event.status !== 'pending_approval') return false;
      if (!role) return true;
      
      const step = event.approvalSteps.find((s) => s.role === role);
      return step?.status === 'pending';
    });
  },
}));
