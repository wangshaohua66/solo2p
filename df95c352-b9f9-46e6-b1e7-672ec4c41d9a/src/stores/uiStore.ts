import { create } from "zustand";

interface UIState {
  rightPanelOpen: boolean;
  rightPanelContent: "stats" | "notes" | "history" | null;
  sidebarCollapsed: boolean;
  addMemberModalOpen: boolean;
  addMeasurementModalOpen: boolean;
  addRecordModalOpen: boolean;
  exercisePickerOpen: boolean;
  templatePickerOpen: boolean;
  addExerciseModalOpen: boolean;

  toggleRightPanel: () => void;
  setRightPanelContent: (content: UIState["rightPanelContent"]) => void;
  toggleSidebar: () => void;

  setAddMemberModalOpen: (open: boolean) => void;
  setAddMeasurementModalOpen: (open: boolean) => void;
  setAddRecordModalOpen: (open: boolean) => void;
  setExercisePickerOpen: (open: boolean) => void;
  setTemplatePickerOpen: (open: boolean) => void;
  setAddExerciseModalOpen: (open: boolean) => void;
  closeAllModals: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  rightPanelOpen: false,
  rightPanelContent: null,
  sidebarCollapsed: false,
  addMemberModalOpen: false,
  addMeasurementModalOpen: false,
  addRecordModalOpen: false,
  exercisePickerOpen: false,
  templatePickerOpen: false,
  addExerciseModalOpen: false,

  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelContent: (content) => set({ rightPanelContent: content, rightPanelOpen: content !== null }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setAddMemberModalOpen: (open) => set({ addMemberModalOpen: open }),
  setAddMeasurementModalOpen: (open) => set({ addMeasurementModalOpen: open }),
  setAddRecordModalOpen: (open) => set({ addRecordModalOpen: open }),
  setExercisePickerOpen: (open) => set({ exercisePickerOpen: open }),
  setTemplatePickerOpen: (open) => set({ templatePickerOpen: open }),
  setAddExerciseModalOpen: (open) => set({ addExerciseModalOpen: open }),

  closeAllModals: () =>
    set({
      addMemberModalOpen: false,
      addMeasurementModalOpen: false,
      addRecordModalOpen: false,
      exercisePickerOpen: false,
      templatePickerOpen: false,
      addExerciseModalOpen: false,
    }),
}));
