import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Member, BodyMeasurement, TrainingRecord } from "@/types";
import { generateMockMembers } from "@/utils/mockData";

interface MemberState {
  members: Member[];
  selectedMemberId: string | null;
  searchQuery: string;
  selectedTags: string[];
  isLoading: boolean;

  initMockData: () => void;
  setSelectedMember: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;

  addMember: (member: Omit<Member, "id" | "createdAt" | "bodyMeasurements" | "trainingRecords"> & Partial<Member>) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  deleteMember: (id: string) => void;

  addBodyMeasurement: (memberId: string, measurement: Omit<BodyMeasurement, "id">) => void;
  updateBodyMeasurement: (memberId: string, measurementId: string, updates: Partial<BodyMeasurement>) => void;

  addTrainingRecord: (memberId: string, record: Omit<TrainingRecord, "id">) => void;
  updateTrainingRecord: (memberId: string, recordId: string, updates: Partial<TrainingRecord>) => void;
  deleteTrainingRecord: (memberId: string, recordId: string) => void;

  getFilteredMembers: () => Member[];
  getMember: (id: string) => Member | undefined;
  getAllTags: () => string[];
}

export const useMemberStore = create<MemberState>()(
  persist(
    (set, get) => ({
      members: [],
      selectedMemberId: null,
      searchQuery: "",
      selectedTags: [],
      isLoading: false,

      initMockData: () => {
        if (get().members.length === 0) {
          const members = generateMockMembers(50);
          set({ members, selectedMemberId: members[0]?.id || null });
        }
      },

      setSelectedMember: (id) => set({ selectedMemberId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      toggleTag: (tag) =>
        set((state) => ({
          selectedTags: state.selectedTags.includes(tag)
            ? state.selectedTags.filter((t) => t !== tag)
            : [...state.selectedTags, tag],
        })),
      clearFilters: () => set({ searchQuery: "", selectedTags: [] }),

      addMember: (member) =>
        set((state) => ({
          members: [
            {
              ...member,
              id: `member-${Date.now()}`,
              createdAt: new Date().toISOString().split("T")[0],
              bodyMeasurements: [],
              trainingRecords: [],
              tags: member.tags || [],
            } as Member,
            ...state.members,
          ],
        })),

      updateMember: (id, updates) =>
        set((state) => ({
          members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),

      deleteMember: (id) =>
        set((state) => ({
          members: state.members.filter((m) => m.id !== id),
          selectedMemberId: state.selectedMemberId === id ? null : state.selectedMemberId,
        })),

      addBodyMeasurement: (memberId, measurement) =>
        set((state) => ({
          members: state.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  weight: measurement.weight || m.weight,
                  bodyMeasurements: [
                    { ...measurement, id: `bm-${Date.now()}` },
                    ...m.bodyMeasurements,
                  ],
                }
              : m
          ),
        })),

      updateBodyMeasurement: (memberId, measurementId, updates) =>
        set((state) => ({
          members: state.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  bodyMeasurements: m.bodyMeasurements.map((bm) =>
                    bm.id === measurementId ? { ...bm, ...updates } : bm
                  ),
                }
              : m
          ),
        })),

      addTrainingRecord: (memberId, record) =>
        set((state) => ({
          members: state.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  trainingRecords: [
                    { ...record, id: `tr-${Date.now()}` },
                    ...m.trainingRecords,
                  ],
                }
              : m
          ),
        })),

      updateTrainingRecord: (memberId, recordId, updates) =>
        set((state) => ({
          members: state.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  trainingRecords: m.trainingRecords.map((r) =>
                    r.id === recordId ? { ...r, ...updates } : r
                  ),
                }
              : m
          ),
        })),

      deleteTrainingRecord: (memberId, recordId) =>
        set((state) => ({
          members: state.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  trainingRecords: m.trainingRecords.filter((r) => r.id !== recordId),
                }
              : m
          ),
        })),

      getFilteredMembers: () => {
        const { members, searchQuery, selectedTags } = get();
        return members.filter((m) => {
          const matchesSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesTags = selectedTags.length === 0 || selectedTags.every((t) => m.tags.includes(t));
          return matchesSearch && matchesTags;
        });
      },

      getMember: (id) => get().members.find((m) => m.id === id),

      getAllTags: () => {
        const tags = new Set<string>();
        get().members.forEach((m) => m.tags.forEach((t) => tags.add(t)));
        return Array.from(tags).sort();
      },
    }),
    {
      name: "fitcoach-members",
      partialize: (state) => ({
        members: state.members,
        selectedMemberId: state.selectedMemberId,
      }),
    }
  )
);
