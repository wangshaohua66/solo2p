import { create } from "zustand";
import type { Selection, HistoryAction, HistoryType } from "@/types/audio";
import { UNDO_STACK_LIMIT } from "@/types/audio";

interface EditorStore {
  selection: Selection | null;
  isSelecting: boolean;
  selectStart: number | null;
  undoStack: HistoryAction[];
  redoStack: HistoryAction[];
  showTranscript: boolean;
  showMinimap: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  activeRightTab: "markers" | "comments" | "transcript";

  setSelection: (s: Selection | null) => void;
  setIsSelecting: (v: boolean) => void;
  setSelectStart: (t: number | null) => void;
  startSelection: (t: number, trackId?: string) => void;
  updateSelectionEnd: (t: number) => void;
  clearSelection: () => void;

  pushHistory: <P, N>(type: HistoryType, previous: P, next: N) => void;
  undo: () => HistoryAction | null;
  redo: () => HistoryAction | null;
  clearHistory: () => void;

  setShowTranscript: (v: boolean) => void;
  setShowMinimap: (v: boolean) => void;
  setLeftPanelOpen: (v: boolean) => void;
  setRightPanelOpen: (v: boolean) => void;
  setActiveRightTab: (t: "markers" | "comments" | "transcript") => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  selection: null,
  isSelecting: false,
  selectStart: null,
  undoStack: [],
  redoStack: [],
  showTranscript: false,
  showMinimap: true,
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeRightTab: "markers",

  setSelection: (s) => set({ selection: s }),
  setIsSelecting: (v) => set({ isSelecting: v }),
  setSelectStart: (t) => set({ selectStart: t }),

  startSelection: (t, trackId) =>
    set({
      selectStart: t,
      isSelecting: true,
      selection: { start: t, end: t, activeTrackId: trackId },
    }),

  updateSelectionEnd: (t) => {
    const state = get();
    if (state.selectStart === null) return;
    const start = Math.min(state.selectStart, t);
    const end = Math.max(state.selectStart, t);
    if (end - start < 0.01) {
      set({
        selection: {
          start,
          end,
          activeTrackId: state.selection?.activeTrackId,
        },
      });
      return;
    }
    set({
      selection: {
        start,
        end,
        activeTrackId: state.selection?.activeTrackId,
      },
    });
  },

  clearSelection: () =>
    set({ selection: null, isSelecting: false, selectStart: null }),

  pushHistory: (type, previous, next) =>
    set((s) => {
      const action: HistoryAction = {
        type,
        timestamp: Date.now(),
        previous,
        next,
      };
      const stack = [...s.undoStack, action].slice(-UNDO_STACK_LIMIT);
      return { undoStack: stack, redoStack: [] };
    }),

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return null;
    const stack = [...state.undoStack];
    const action = stack.pop() as HistoryAction;
    const redo = [...state.redoStack, action].slice(-UNDO_STACK_LIMIT);
    set({ undoStack: stack, redoStack: redo });
    return action;
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return null;
    const stack = [...state.redoStack];
    const action = stack.pop() as HistoryAction;
    const undo = [...state.undoStack, action].slice(-UNDO_STACK_LIMIT);
    set({ undoStack: undo, redoStack: stack });
    return action;
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),

  setShowTranscript: (v) => set({ showTranscript: v }),
  setShowMinimap: (v) => set({ showMinimap: v }),
  setLeftPanelOpen: (v) => set({ leftPanelOpen: v }),
  setRightPanelOpen: (v) => set({ rightPanelOpen: v }),
  setActiveRightTab: (t) => set({ activeRightTab: t }),
}));
