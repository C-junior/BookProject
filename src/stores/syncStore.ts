import { create } from 'zustand'

interface SyncState {
    isSyncing: boolean
    lastSyncTime: Date | null
    isOnline: boolean
    syncErrors: string[]
    pendingChanges: number

    // Actions
    setSyncing: (syncing: boolean) => void
    setLastSyncTime: (time: Date) => void
    setOnline: (online: boolean) => void
    addSyncError: (error: string) => void
    clearSyncErrors: () => void
    setPendingChanges: (count: number) => void
    incrementPendingChanges: () => void
    decrementPendingChanges: () => void
}

export const useSyncStore = create<SyncState>((set) => ({
    isSyncing: false,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    syncErrors: [],
    pendingChanges: 0,

    setSyncing: (syncing) => set({ isSyncing: syncing }),

    setLastSyncTime: (time) => set({ lastSyncTime: time }),

    setOnline: (online) => set({ isOnline: online }),

    addSyncError: (error) => set((state) => ({
        syncErrors: [...state.syncErrors.slice(-4), error] // Keep last 5 errors
    })),

    clearSyncErrors: () => set({ syncErrors: [] }),

    setPendingChanges: (count) => set({ pendingChanges: count }),

    incrementPendingChanges: () => set((state) => ({
        pendingChanges: state.pendingChanges + 1
    })),

    decrementPendingChanges: () => set((state) => ({
        pendingChanges: Math.max(0, state.pendingChanges - 1)
    }))
}))

// Initialize online/offline listeners
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        useSyncStore.getState().setOnline(true)
    })

    window.addEventListener('offline', () => {
        useSyncStore.getState().setOnline(false)
    })
}
