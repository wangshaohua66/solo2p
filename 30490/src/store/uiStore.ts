import { create } from 'zustand';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}

interface ModalState {
  isOpen: boolean;
  type: string | null;
  data: Record<string, unknown> | null;
}

interface UIState {
  toasts: ToastMessage[];
  modal: ModalState;
  loadingOverlay: boolean;
  actions: {
    showToast: (type: ToastMessage['type'], message: string, duration?: number) => void;
    dismissToast: (id: string) => void;
    clearToasts: () => void;
    openModal: (type: string, data?: Record<string, unknown>) => void;
    closeModal: () => void;
    setLoadingOverlay: (visible: boolean) => void;
  };
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  modal: {
    isOpen: false,
    type: null,
    data: null,
  },
  loadingOverlay: false,

  actions: {
    showToast: (type, message, duration = 3000) => {
      const id = `toast-${++toastId}`;
      const toast: ToastMessage = { id, type, message, duration };

      set((state) => ({ toasts: [...state.toasts, toast] }));

      if (duration > 0) {
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }));
        }, duration);
      }
    },

    dismissToast: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },

    clearToasts: () => {
      set({ toasts: [] });
    },

    openModal: (type, data = null) => {
      set({
        modal: {
          isOpen: true,
          type,
          data,
        },
      });
    },

    closeModal: () => {
      set({
        modal: {
          isOpen: false,
          type: null,
          data: null,
        },
      });
    },

    setLoadingOverlay: (visible) => {
      set({ loadingOverlay: visible });
    },
  },
}));
