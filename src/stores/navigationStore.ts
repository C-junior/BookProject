import { create } from 'zustand'

export type TabId = 'library' | 'store' | 'settings'

interface NavigationState {
    activeTab: TabId
    setActiveTab: (tab: TabId) => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
    activeTab: 'library',
    setActiveTab: (tab) => set({ activeTab: tab }),
}))
