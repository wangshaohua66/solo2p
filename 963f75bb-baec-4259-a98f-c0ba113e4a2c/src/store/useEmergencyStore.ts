import { create } from 'zustand';
import type { EmergencyPlan, EmergencyLog, NotificationRecord, EmergencyStep } from '@/types';
import { emergencyPlans as mockPlans } from '@/mock';

interface EmergencyState {
  plans: EmergencyPlan[];
  activeLog: EmergencyLog | null;
  logs: EmergencyLog[];
  isEmergencyActive: boolean;
  emergencyType: string | null;
  
  triggerPlan: (planId: string) => void;
  resolveEmergency: () => void;
  completeStep: (stepId: string, completedBy: string) => void;
  sendNotifications: (logId: string) => void;
  addNote: (note: string) => void;
  
  getLogsByType: (type: string) => EmergencyLog[];
  getActiveSteps: () => EmergencyStep[];
}

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  plans: mockPlans,
  activeLog: null,
  logs: [],
  isEmergencyActive: false,
  emergencyType: null,

  triggerPlan: (planId) => {
    const plan = get().plans.find((p) => p.id === planId);
    if (!plan) return;

    const log: EmergencyLog = {
      id: `log-${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      type: plan.type,
      status: 'triggered',
      triggeredAt: new Date(),
      triggeredBy: '当前用户',
      steps: plan.steps.map((s) => ({ ...s, status: 'pending' as const })),
      notifications: [],
    };

    set({
      activeLog: log,
      logs: [log, ...get().logs],
      isEmergencyActive: true,
      emergencyType: plan.type,
    });

    setTimeout(() => {
      get().sendNotifications(log.id);
    }, 1000);

    setTimeout(() => {
      set((state) => ({
        activeLog: state.activeLog?.id === log.id
          ? { ...state.activeLog, status: 'in_progress' }
          : state.activeLog,
      }));
    }, 2000);
  },

  resolveEmergency: () => {
    const { activeLog } = get();
    if (!activeLog) return;

    const resolvedLog: EmergencyLog = {
      ...activeLog,
      status: 'resolved',
      resolvedAt: new Date(),
    };

    set({
      activeLog: null,
      isEmergencyActive: false,
      emergencyType: null,
      logs: get().logs.map((l) => (l.id === resolvedLog.id ? resolvedLog : l)),
    });
  },

  completeStep: (stepId, completedBy) => {
    set((state) => {
      if (!state.activeLog) return state;

      const updatedSteps = state.activeLog.steps.map((s) =>
        s.id === stepId
          ? { ...s, status: 'completed' as const, completedAt: new Date(), completedBy }
          : s
      );

      return {
        activeLog: {
          ...state.activeLog,
          steps: updatedSteps,
        },
        logs: state.logs.map((l) =>
          l.id === state.activeLog?.id ? { ...l, steps: updatedSteps } : l
        ),
      };
    });
  },

  sendNotifications: (logId) => {
    const log = get().logs.find((l) => l.id === logId);
    if (!log) return;

    const plan = get().plans.find((p) => p.id === log.planId);
    if (!plan) return;

    const channels: NotificationRecord['channel'][] = ['app', 'sms', 'email'];
    const notifications: NotificationRecord[] = plan.notificationList.flatMap((recipient) =>
      channels.map((channel, idx) => ({
        id: `notif-${logId}-${recipient}-${channel}`,
        recipient,
        role: recipient,
        channel,
        status: idx === 0 ? 'delivered' : 'sent',
        sentAt: new Date(),
        deliveredAt: idx === 0 ? new Date() : undefined,
        content: `【应急预案触发】${plan.name}，请立即执行相关处置任务。`,
      }))
    );

    set((state) => ({
      activeLog: state.activeLog?.id === logId
        ? { ...state.activeLog, notifications }
        : state.activeLog,
      logs: state.logs.map((l) =>
        l.id === logId ? { ...l, notifications } : l
      ),
    }));
  },

  addNote: (note) => {
    set((state) => {
      if (!state.activeLog) return state;
      return {
        activeLog: { ...state.activeLog, notes: note },
        logs: state.logs.map((l) =>
          l.id === state.activeLog?.id ? { ...l, notes: note } : l
        ),
      };
    });
  },

  getLogsByType: (type) => {
    return get().logs.filter((l) => l.type === type);
  },

  getActiveSteps: () => {
    return get().activeLog?.steps || [];
  },
}));
