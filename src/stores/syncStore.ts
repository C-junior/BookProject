import { create } from 'zustand'

type DirtyCategory = 'progress' | 'annotations' | 'collections' | 'bookMetadata'

interface SyncState {
    isSyncing: boolean
    lastSyncTime: Date | null
    isOnline: boolean
    syncErrors: string[]
    pendingChanges: number

    // Offline queue: tracks which categories have unsynced local changes
    dirtyFlags: Record<DirtyCategory, boolean>

    // Actions
    setSyncing: (syncing: boolean) => void
    setLastSyncTime: (time: Date) => void
    setOnline: (online: boolean) => void
    addSyncError: (error: string) => void
    clearSyncErrors: () => void
    setPendingChanges: (count: number) => void
    incrementPendingChanges: () => void
    decrementPendingChanges: () => void
    markDirty: (category: DirtyCategory) => void
    clearDirty: (category: DirtyCategory) => void
    getDirtyCategories: () => DirtyCategory[]
}

export const useSyncStore = create<SyncState>((set, get) => ({
    isSyncing: false,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    syncErrors: [],
    pendingChanges: 0,
    dirtyFlags: {
        progress: false,
        annotations: false,
        collections: false,
        bookMetadata: false
    },

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
    })),

    markDirty: (category) => set((state) => ({
        dirtyFlags: { ...state.dirtyFlags, [category]: true },
        pendingChanges: state.pendingChanges + 1
    })),

    clearDirty: (category) => set((state) => ({
        dirtyFlags: { ...state.dirtyFlags, [category]: false },
        pendingChanges: Math.max(0, state.pendingChanges - 1)
    })),

    getDirtyCategories: () => {
        const { dirtyFlags } = get()
        return (Object.keys(dirtyFlags) as DirtyCategory[]).filter(k => dirtyFlags[k])
    }
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

export type { DirtyCategory }
