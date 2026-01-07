import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlanState {
  selectedPlanId: string | null;
  currentDay: number;
  viewDate: Date | null;
  showPlanSelector: boolean;
  showCustomPlanCreator: boolean;
  showFriendsPanel: boolean;
  showNotificationSettings: boolean;
  
  // Actions
  selectPlan: (planId: string) => void;
  deselectPlan: () => void;
  setCurrentDay: (day: number) => void;
  setViewDate: (date: Date) => void;
  nextDay: () => void;
  prevDay: () => void;
  togglePlanSelector: (show: boolean) => void;
  toggleCustomPlanCreator: (show: boolean) => void;
  toggleFriendsPanel: (show: boolean) => void;
  toggleNotificationSettings: (show: boolean) => void;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      selectedPlanId: null,
      currentDay: 1,
      viewDate: null,
      showPlanSelector: true,
      showCustomPlanCreator: false,
      showFriendsPanel: false,
      showNotificationSettings: false,

      selectPlan: (planId) =>
        set({
          selectedPlanId: planId,
          showPlanSelector: false,
          currentDay: 1,
        }),
      deselectPlan: () =>
        set({
          selectedPlanId: null,
          showPlanSelector: true,
          currentDay: 1,
        }),
      setCurrentDay: (day) => set({ currentDay: day }),
      setViewDate: (date) => set({ viewDate: date }),
      nextDay: () => set((state) => ({ currentDay: state.currentDay + 1 })),
      prevDay: () =>
        set((state) => ({
          currentDay: Math.max(1, state.currentDay - 1),
        })),
      togglePlanSelector: (show) => set({ showPlanSelector: show }),
      toggleCustomPlanCreator: (show) => set({ showCustomPlanCreator: show }),
      toggleFriendsPanel: (show) => set({ showFriendsPanel: show }),
      toggleNotificationSettings: (show) => set({ showNotificationSettings: show }),
    }),
    {
      name: 'plan-storage',
      // viewDate는 일시적인 UI 상태라 저장하지 않음
      partialize: (state) => ({
        selectedPlanId: state.selectedPlanId,
        currentDay: state.currentDay,
        showPlanSelector: state.showPlanSelector,
      }),
    }
  )
);
