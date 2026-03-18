import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
    keepScreenAwake: boolean
    wakeLockSentinel: WakeLockSentinel | null

    setKeepScreenAwake: (value: boolean) => Promise<void>
    releaseWakeLock: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            keepScreenAwake: false,
            wakeLockSentinel: null,

            setKeepScreenAwake: async (value: boolean) => {
                const { wakeLockSentinel } = get()

                if (value) {
                    try {
                        if ('wakeLock' in navigator) {
                            const sentinel = await navigator.wakeLock.request('screen')
                            set({ keepScreenAwake: true, wakeLockSentinel: sentinel })

                            sentinel.addEventListener('release', () => {
                                set({ wakeLockSentinel: null })
                            })
                        } else {
                            // API not supported — still save the preference
                            set({ keepScreenAwake: true })
                        }
                    } catch {
                        // Permission denied or page not visible
                        set({ keepScreenAwake: true })
                    }
                } else {
                    if (wakeLockSentinel) {
                        await wakeLockSentinel.release()
                    }
                    set({ keepScreenAwake: false, wakeLockSentinel: null })
                }
            },

            releaseWakeLock: async () => {
                const { wakeLockSentinel } = get()
                if (wakeLockSentinel) {
                    await wakeLockSentinel.release()
                    set({ wakeLockSentinel: null })
                }
            }
        }),
        {
            name: 'codex-settings',
            partialize: (state) => ({
                keepScreenAwake: state.keepScreenAwake
            })
        }
    )
)

// Re-acquire wake lock when page becomes visible again
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            const { keepScreenAwake, wakeLockSentinel } = useSettingsStore.getState()
            if (keepScreenAwake && !wakeLockSentinel && 'wakeLock' in navigator) {
                try {
                    const sentinel = await navigator.wakeLock.request('screen')
                    useSettingsStore.setState({ wakeLockSentinel: sentinel })
                } catch {
                    // Silently fail
                }
            }
        }
    })
}
